import {analyzeBlissRoute,traceBlissPath} from '../lib/game/bliss-route';
import {decodeBlissTrack,type BlissTrack} from '../lib/game/bliss-track';
import {createBlissEditor3DView,type BlissEditor3DView} from '../lib/game/bliss-editor-3d';
import {RACE_MAP_CLEAR_EVENT,RACE_MAP_FRAME_EVENT,type RaceMapFrame} from '../lib/game/race-map-state';
import {normalizeRaceHeading,requestRaceTeleport,type RaceSpawn} from '../lib/game/race-spawn';
import {blissEditorActive} from '../lib/game/bliss-editor-presence';
import type {Assets} from '../lib/game/types';

type Layer='ground'|'terrain'|'track'|'buildings'|'items'|'paths';
type Settings={width:number;height:number;layers:Record<Layer,boolean>};

const settingsKey='playstunts-dx-race-map-v1';
const openMapOnRaceStartStorageKey='playstunts-dx-open-map-on-race-start';
const layers:readonly {id:Layer;label:string}[]=[
 {id:'ground',label:'Ground'},
 {id:'terrain',label:'Terrain'},
 {id:'track',label:'Track'},
 {id:'buildings',label:'Buildings'},
 {id:'items',label:'Items'},
 {id:'paths',label:'Paths'},
];

const defaults:Settings={
 width:360,height:470,
 layers:{ground:true,terrain:true,track:true,buildings:true,items:true,paths:false},
};

function loadSettings():Settings{
 try{
  const saved=JSON.parse(localStorage.getItem(settingsKey)??'null') as (Partial<Settings>&{size?:number})|null;
  if(!saved)return structuredClone(defaults);
  const migrated=Number(saved.size);
  return {
   width:Math.max(220,Number(saved.width)||(migrated?migrated+18:defaults.width)),
   height:Math.max(280,Number(saved.height)||(migrated?migrated+115:defaults.height)),
   layers:{...defaults.layers,...saved.layers},
  };
 }catch{return structuredClone(defaults);}
}

function storeSettings(settings:Settings){
 try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{}
}

function trackSignature(track:ReadonlyArray<number>){
 let hash=2166136261;
 for(let i=0;i<Math.min(track.length,1802);i++)hash=Math.imul((hash^track[i])>>>0,16777619)>>>0;
 return hash>>>0;
}

function drawArrow(ctx:CanvasRenderingContext2D,x:number,y:number,heading:number,scale:number){
 ctx.save();ctx.translate(x,y);ctx.rotate(-heading*Math.PI/512);
 ctx.beginPath();ctx.moveTo(0,-13*scale);ctx.lineTo(8*scale,9*scale);ctx.lineTo(0,5*scale);ctx.lineTo(-8*scale,9*scale);ctx.closePath();
 ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.9)';ctx.lineWidth=Math.max(2,2.6*scale);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,2.8*scale,0,Math.PI*2);ctx.fillStyle='#d9e65b';ctx.fill();
 ctx.restore();
}

export function installDesktopRaceMap(assets:Assets){
 const settings=loadSettings();
 let frame:RaceMapFrame|undefined,visible=false,disposed=false,openedForRace=false;
 let cachedSignature=-1,cachedTrack:BlissTrack|undefined,cachedPaths:ReturnType<typeof traceBlissPath>[]=[];
 let preview:BlissEditor3DView|undefined,spawn:RaceSpawn|undefined;

 const root=document.createElement('div');
 root.style.cssText='position:fixed;left:12px;top:12px;z-index:2147483600;display:none;pointer-events:auto;font:12px/1.2 system-ui,Segoe UI,sans-serif;color:#eee;';

 const toggle=document.createElement('button');
 toggle.type='button';toggle.textContent='Map [F9]';
 toggle.style.cssText='display:none;border:1px solid #555;background:#181818;color:#eee;border-radius:5px;padding:7px 10px;cursor:pointer;box-shadow:0 3px 16px rgba(0,0,0,.45);font:600 12px/1.2 system-ui,Segoe UI,sans-serif;';

 const panel=document.createElement('div');
 panel.style.cssText='display:none;margin-top:6px;background:rgba(12,12,12,.94);border:1px solid #555;border-radius:7px;padding:8px;box-shadow:0 8px 26px rgba(0,0,0,.55);backdrop-filter:blur(2px);resize:both;overflow:hidden;min-width:220px;min-height:280px;box-sizing:border-box;grid-template-rows:auto minmax(120px,1fr) auto;gap:7px;';

 const header=document.createElement('div');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;';
 const title=document.createElement('strong');title.textContent='Race Map';title.style.cssText='font-size:12px;color:#e9e9e9;';
 const hint=document.createElement('span');hint.textContent='F9 / M';hint.style.cssText='font-size:10px;color:#888;';
 const buttonLike=(text:string,titleText:string)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.title=titleText;b.style.cssText='border:1px solid #555;background:#202020;color:#eee;border-radius:4px;padding:3px 6px;cursor:pointer;font:10px/1.1 system-ui,Segoe UI,sans-serif;';return b;};
 const spawnTool=document.createElement('button');spawnTool.type='button';spawnTool.draggable=true;spawnTool.title='Drag onto the map to set a practice/teleport point';spawnTool.innerHTML='<svg viewBox="0 0 20 24" width="14" height="17" aria-hidden="true"><circle cx="10" cy="4" r="3" fill="#e6b94a"/><path d="M7 8h6l2 6-2 1-1-4v11H9v-7H7v7H4V11l-1 4-2-1 2-6z" fill="#e6b94a"/></svg>';
 spawnTool.style.cssText='margin-left:auto;border:1px solid #665a32;background:#262116;color:#eee;border-radius:4px;padding:3px 6px;cursor:grab;';
 const turnLeft=buttonLike('↶','Turn marker left'),turnRight=buttonLike('↷','Turn marker right'),go=buttonLike('Go Here','Teleport to marker');
 turnLeft.style.display=turnRight.style.display=go.style.display='none';
 const refreshSpawnControls=()=>{const show=!!spawn;turnLeft.style.display=turnRight.style.display=go.style.display=show?'inline-block':'none';};
 turnLeft.addEventListener('click',()=>{if(spawn){spawn.heading=normalizeRaceHeading(spawn.heading-32);draw();}});
 turnRight.addEventListener('click',()=>{if(spawn){spawn.heading=normalizeRaceHeading(spawn.heading+32);draw();}});
 go.addEventListener('click',()=>{if(spawn)requestRaceTeleport({...spawn});});
 spawnTool.addEventListener('dragstart',event=>{event.dataTransfer?.setData('text/plain','playstunts-race-spawn');if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';});
 header.append(title,hint,spawnTool,turnLeft,turnRight,go);

 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=900;
 canvas.style.cssText='display:block;width:100%;height:100%;min-width:0;min-height:0;background:#080b08;border:1px solid #444;border-radius:5px;box-sizing:border-box;';
 canvas.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
 canvas.addEventListener('drop',event=>{
  event.preventDefault();if(!preview||!frame)return;
  const visibleBounds=canvas.getBoundingClientRect(),hiddenBounds=map3d.getBoundingClientRect();
  const point=preview.worldAt(hiddenBounds.left+(event.clientX-visibleBounds.left),hiddenBounds.top+(event.clientY-visibleBounds.top));if(!point)return;
  spawn={x:point.x,z:point.z,heading:suggestedSpawnHeading(point.x,point.z,frame.heading)};refreshSpawnControls();draw();
 });
 canvas.addEventListener('wheel',event=>{
  if(!spawn||!preview)return;
  const visibleBounds=canvas.getBoundingClientRect(),p=preview.projectWorld(spawn.x,spawn.z);if(!p)return;
  const px=(event.clientX-visibleBounds.left)*(canvas.width/Math.max(1,visibleBounds.width)),py=(event.clientY-visibleBounds.top)*(canvas.height/Math.max(1,visibleBounds.height));
  const mx=p.x*(canvas.width/Math.max(1,map3d.clientWidth)),my=p.y*(canvas.height/Math.max(1,map3d.clientHeight));
  if(Math.hypot(px-mx,py-my)>28*(window.devicePixelRatio||1))return;
  event.preventDefault();spawn.heading=normalizeRaceHeading(spawn.heading+(event.deltaY>0?32:-32));draw();
 },{passive:false});

 const map3d=document.createElement('canvas');map3d.width=900;map3d.height=900;map3d.style.cssText='position:fixed;left:-10000px;top:0;width:900px;height:900px;opacity:0;pointer-events:none;';document.body.appendChild(map3d);

 const layerGrid=document.createElement('div');layerGrid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;';
 const layerButtons=new Map<Layer,HTMLButtonElement>();
 const renderLayerButtons=()=>{
  for(const layer of layers){
   const button=layerButtons.get(layer.id);if(!button)continue;
   const on=settings.layers[layer.id];
   button.setAttribute('aria-pressed',String(on));
   button.style.background=on?'#4e582c':'#202020';button.style.borderColor=on?'#9bac54':'#555';button.style.color=on?'#fff':'#aaa';
  }
 };
 for(const layer of layers){
  const button=document.createElement('button');button.type='button';button.textContent=layer.label;
  button.style.cssText='border:1px solid #555;border-radius:4px;padding:5px 6px;cursor:pointer;font:10px/1.1 system-ui,Segoe UI,sans-serif;';
  button.addEventListener('click',()=>{
   settings.layers[layer.id]=!settings.layers[layer.id];storeSettings(settings);renderLayerButtons();
   preview?.setLayers({
    ground:settings.layers.ground,terrain:settings.layers.terrain,track:settings.layers.track,
    buildings:settings.layers.buildings,items:settings.layers.items,
   });
   draw();
  });
  layerButtons.set(layer.id,button);layerGrid.append(button);
 }

 panel.append(header,canvas,layerGrid);
 root.append(toggle,panel);document.body.append(root);

 const applyPanelSize=()=>{
  panel.style.width=settings.width+'px';panel.style.height=settings.height+'px';
 };
 applyPanelSize();renderLayerButtons();

 function rebuildTrack(){
  if(!frame)return;
  const signature=trackSignature(frame.track);if(signature===cachedSignature&&cachedTrack&&preview)return;
  cachedSignature=signature;cachedTrack=decodeBlissTrack(Uint8Array.from(frame.track));
  cachedPaths=[];
  try{
   const analysis=analyzeBlissRoute(cachedTrack);
   cachedPaths=analysis.paths.slice(0,128).map((_,index)=>traceBlissPath(cachedTrack!,analysis,index));
  }catch{cachedPaths=[];}
  preview?.close();
  preview=createBlissEditor3DView(map3d,assets,cachedTrack,{
   initialCamera:{position:[15360,50000,-15360],target:[15360,0,-15360],fov:36},
   transparentBackground:true,
   showGround:settings.layers.ground,
   showAnnotations:false,
   layers:{
    ground:settings.layers.ground,terrain:settings.layers.terrain,track:settings.layers.track,
    buildings:settings.layers.buildings,items:settings.layers.items,
   },
  });
 }

 function suggestedSpawnHeading(x:number,z:number,fallback:number){
  let bestStep:{x:number;y:number}|undefined,nextStep:{x:number;y:number}|undefined,bestDistance=Infinity;
  for(const trace of cachedPaths){
   for(let i=0;i<trace.steps.length;i++){
    const step=trace.steps[i],sx=(step.x+.5)*1024,sz=(29-step.y+.5)*1024,distance=Math.hypot(x-sx,z-sz);
    if(distance>=bestDistance)continue;
    const next=trace.steps[Math.min(trace.steps.length-1,i+1)]===step?trace.steps[Math.max(0,i-1)]:trace.steps[Math.min(trace.steps.length-1,i+1)];
    bestDistance=distance;bestStep=step;nextStep=next;
   }
  }
  if(bestStep&&nextStep){
   const ax=(bestStep.x+.5)*1024,az=(29-bestStep.y+.5)*1024,bx=(nextStep.x+.5)*1024,bz=(29-nextStep.y+.5)*1024;
   if(ax!==bx||az!==bz)return normalizeRaceHeading(-Math.atan2(bx-ax,bz-az)*512/Math.PI);
  }
  return normalizeRaceHeading(fallback);
 }

 function drawPaths(ctx:CanvasRenderingContext2D,width:number,height:number){
  if(!settings.layers.paths||!cachedPaths.length||!preview)return;
  const scaleX=width/Math.max(1,map3d.clientWidth),scaleY=height/Math.max(1,map3d.clientHeight);ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  cachedPaths.forEach((trace,index)=>{
   if(trace.steps.length<2)return;
   ctx.beginPath();let started=false;
   trace.steps.forEach(step=>{
    const projected=preview!.projectWorld((step.x+.5)*1024,(29-step.y+.5)*1024);
    if(!projected)return;
    if(!started){ctx.moveTo(projected.x*scaleX,projected.y*scaleY);started=true;}
    else ctx.lineTo(projected.x*scaleX,projected.y*scaleY);
   });
   if(!started)return;
   ctx.strokeStyle=index===0?'rgba(78,232,247,.88)':'rgba(78,232,247,.22)';
   ctx.lineWidth=index===0?Math.max(2.5,Math.min(scaleX,scaleY)*3.3):Math.max(1.2,Math.min(scaleX,scaleY)*1.5);ctx.stroke();
  });
  ctx.restore();
 }

 function draw(){
  if(!frame||!visible)return;
  rebuildTrack();if(!cachedTrack||!preview)return;
  preview.setLayers({
   ground:settings.layers.ground,terrain:settings.layers.terrain,track:settings.layers.track,
   buildings:settings.layers.buildings,items:settings.layers.items,
  });
  const bounds=canvas.getBoundingClientRect(),cssWidth=Math.max(1,Math.round(bounds.width)),cssHeight=Math.max(1,Math.round(bounds.height));
  map3d.style.width=cssWidth+'px';map3d.style.height=cssHeight+'px';
  const pixelScale=Math.min(2,window.devicePixelRatio||1);
  const pixelWidth=Math.max(1,Math.round(cssWidth*pixelScale)),pixelHeight=Math.max(1,Math.round(cssHeight*pixelScale));
  if(canvas.width!==pixelWidth)canvas.width=pixelWidth;if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
  preview.render();
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const width=canvas.width,height=canvas.height;
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#080b08';ctx.fillRect(0,0,width,height);
  ctx.drawImage(map3d,0,0,width,height);
  drawPaths(ctx,width,height);
  const projected=preview.projectWorld(frame.x,frame.z);
  const scaleX=width/Math.max(1,map3d.clientWidth),scaleY=height/Math.max(1,map3d.clientHeight),scale=Math.min(scaleX,scaleY);
  if(projected)drawArrow(ctx,projected.x*scaleX,projected.y*scaleY,frame.heading,scale);
  if(spawn){
   const p=preview.projectWorld(spawn.x,spawn.z);
   if(p){
    const x=p.x*scaleX,y=p.y*scaleY;
    ctx.save();ctx.translate(x,y);ctx.rotate(-spawn.heading*Math.PI/512);
    ctx.strokeStyle='#ffca3a';ctx.fillStyle='#ffca3a';ctx.lineWidth=Math.max(2,2*scale);
    ctx.beginPath();ctx.moveTo(0,-19*scale);ctx.lineTo(0,9*scale);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-19*scale);ctx.lineTo(-5*scale,-10*scale);ctx.lineTo(5*scale,-10*scale);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.arc(0,3*scale,5*scale,0,Math.PI*2);ctx.fill();ctx.restore();
   }
  }
 }

 const syncVisibility=()=>{
  root.style.display=frame?'block':'none';
  toggle.style.display=frame?'block':'none';
  panel.style.display=frame&&visible?'grid':'none';
  toggle.style.background=visible?'#4e582c':'#181818';
  toggle.style.borderColor=visible?'#9bac54':'#555';
 };

 const toggleMap=()=>{if(!frame)return;visible=!visible;syncVisibility();if(visible)draw();};
 toggle.addEventListener('click',toggleMap);
 const resizeObserver=new ResizeObserver(()=>{
  if(panel.style.display==='none')return;
  settings.width=Math.max(220,Math.round(panel.getBoundingClientRect().width));
  settings.height=Math.max(280,Math.round(panel.getBoundingClientRect().height));
  storeSettings(settings);requestAnimationFrame(draw);
 });
 resizeObserver.observe(panel);

 const onFrame=(event:Event)=>{
  frame=(event as CustomEvent<RaceMapFrame>).detail;
  if(!openedForRace){
   openedForRace=true;
   const saved=window.localStorage.getItem(openMapOnRaceStartStorageKey)?.trim().toLowerCase();
   if(saved&&['1','true','yes','on'].includes(saved))visible=true;
  }
  syncVisibility();if(visible)draw();
 };
 const onClear=()=>{frame=undefined;spawn=undefined;refreshSpawnControls();visible=false;openedForRace=false;syncVisibility();};
 const onKey=(event:KeyboardEvent)=>{
  if(disposed||event.repeat||!frame||blissEditorActive())return;
  const target=event.target as HTMLElement|null;
  if(target&&(target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.tagName==='SELECT'||target.isContentEditable))return;
  if(event.code!=='F9'&&event.code!=='KeyM')return;
  event.preventDefault();event.stopImmediatePropagation();toggleMap();
 };

 window.addEventListener(RACE_MAP_FRAME_EVENT,onFrame as EventListener);
 window.addEventListener(RACE_MAP_CLEAR_EVENT,onClear);
 window.addEventListener('keydown',onKey,true);

 return ()=>{
  disposed=true;resizeObserver.disconnect();preview?.close();window.removeEventListener(RACE_MAP_FRAME_EVENT,onFrame as EventListener);window.removeEventListener(RACE_MAP_CLEAR_EVENT,onClear);window.removeEventListener('keydown',onKey,true);map3d.remove();root.remove();
 };
}
