import {analyzeBlissRoute,traceBlissPath} from '../lib/game/bliss-route';
import {decodeBlissTrack,type BlissTrack} from '../lib/game/bliss-track';
import {createBlissEditor3DView,type BlissEditor3DView} from '../lib/game/bliss-editor-3d';
import {RACE_MAP_CLEAR_EVENT,RACE_MAP_FRAME_EVENT,type RaceMapFrame} from '../lib/game/race-map-state';
import {blissEditorActive} from '../lib/game/bliss-editor-presence';
import type {Assets} from '../lib/game/types';

type Layer='ground'|'terrain'|'track'|'buildings'|'items'|'paths';
type Settings={size:number;layers:Record<Layer,boolean>};

const settingsKey='playstunts-dx-race-map-v1';
const layers:readonly {id:Layer;label:string}[]=[
 {id:'ground',label:'Ground'},
 {id:'terrain',label:'Terrain'},
 {id:'track',label:'Track'},
 {id:'buildings',label:'Buildings'},
 {id:'items',label:'Items'},
 {id:'paths',label:'Paths'},
];

const defaults:Settings={
 size:300,
 layers:{ground:true,terrain:true,track:true,buildings:true,items:true,paths:false},
};

function loadSettings():Settings{
 try{
  const saved=JSON.parse(localStorage.getItem(settingsKey)??'null') as Partial<Settings>|null;
  if(!saved)return structuredClone(defaults);
  return {
   size:Math.max(180,Math.min(520,Number(saved.size)||defaults.size)),
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
 let frame:RaceMapFrame|undefined,visible=false,disposed=false;
 let cachedSignature=-1,cachedTrack:BlissTrack|undefined,cachedPaths:ReturnType<typeof traceBlissPath>[]=[];
 let preview:BlissEditor3DView|undefined;

 const root=document.createElement('div');
 root.style.cssText='position:fixed;left:12px;top:12px;z-index:2147483600;display:none;pointer-events:auto;font:12px/1.2 system-ui,Segoe UI,sans-serif;color:#eee;';

 const toggle=document.createElement('button');
 toggle.type='button';toggle.textContent='Map [F9]';
 toggle.style.cssText='display:none;border:1px solid #555;background:#181818;color:#eee;border-radius:5px;padding:7px 10px;cursor:pointer;box-shadow:0 3px 16px rgba(0,0,0,.45);font:600 12px/1.2 system-ui,Segoe UI,sans-serif;';

 const panel=document.createElement('div');
 panel.style.cssText='display:none;margin-top:6px;background:rgba(12,12,12,.94);border:1px solid #555;border-radius:7px;padding:8px;box-shadow:0 8px 26px rgba(0,0,0,.55);backdrop-filter:blur(2px);';

 const header=document.createElement('div');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;';
 const title=document.createElement('strong');title.textContent='Race Map';title.style.cssText='font-size:12px;color:#e9e9e9;';
 const hint=document.createElement('span');hint.textContent='F9 / M';hint.style.cssText='font-size:10px;color:#888;';
 header.append(title,hint);

 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=900;
 canvas.style.cssText='display:block;background:#080b08;border:1px solid #444;border-radius:5px;';

 const map3d=document.createElement('canvas');map3d.width=900;map3d.height=900;

 const sizeRow=document.createElement('div');sizeRow.style.cssText='display:grid;grid-template-columns:42px 1fr 42px;gap:7px;align-items:center;margin-top:8px;';
 const sizeLabel=document.createElement('span');sizeLabel.textContent='Size';sizeLabel.style.color='#aaa';
 const sizeInput=document.createElement('input');sizeInput.type='range';sizeInput.min='180';sizeInput.max='520';sizeInput.step='10';sizeInput.value=String(settings.size);
 const sizeValue=document.createElement('output');sizeValue.textContent=String(settings.size);sizeValue.style.cssText='text-align:right;color:#aaa;font:11px ui-monospace,Consolas,monospace;';
 sizeRow.append(sizeLabel,sizeInput,sizeValue);

 const layerGrid=document.createElement('div');layerGrid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:8px;';
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

 panel.append(header,canvas,sizeRow,layerGrid);
 root.append(toggle,panel);document.body.append(root);

 const applySize=()=>{
  const size=settings.size;canvas.style.width=size+'px';canvas.style.height=size+'px';panel.style.width=(size+2)+'px';sizeValue.textContent=String(size);
 };
 applySize();renderLayerButtons();

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

 function drawPaths(ctx:CanvasRenderingContext2D,width:number){
  if(!settings.layers.paths||!cachedPaths.length)return;
  const cell=width/30;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  cachedPaths.forEach((trace,index)=>{
   if(trace.steps.length<2)return;
   ctx.beginPath();
   trace.steps.forEach((step,stepIndex)=>{
    const x=(step.x+.5)*cell,y=(step.y+.5)*cell;
    if(stepIndex===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   });
   ctx.strokeStyle=index===0?'rgba(78,232,247,.88)':'rgba(78,232,247,.22)';
   ctx.lineWidth=index===0?Math.max(2.5,cell*.11):Math.max(1.2,cell*.045);ctx.stroke();
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
  preview.render();
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const width=canvas.width,height=canvas.height;
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#080b08';ctx.fillRect(0,0,width,height);
  ctx.drawImage(map3d,0,0,width,height);
  drawPaths(ctx,width);
  const px=Math.max(0,Math.min(width,frame.x/30720*width));
  const py=Math.max(0,Math.min(height,(1-frame.z/30720)*height));
  drawArrow(ctx,px,py,frame.heading,width/900);
 }

 const syncVisibility=()=>{
  root.style.display=frame?'block':'none';
  toggle.style.display=frame?'block':'none';
  panel.style.display=frame&&visible?'block':'none';
  toggle.style.background=visible?'#4e582c':'#181818';
  toggle.style.borderColor=visible?'#9bac54':'#555';
 };

 const toggleMap=()=>{if(!frame)return;visible=!visible;syncVisibility();if(visible)draw();};
 toggle.addEventListener('click',toggleMap);
 sizeInput.addEventListener('input',()=>{settings.size=Number(sizeInput.value);applySize();draw();});
 sizeInput.addEventListener('change',()=>storeSettings(settings));

 const onFrame=(event:Event)=>{
  frame=(event as CustomEvent<RaceMapFrame>).detail;syncVisibility();if(visible)draw();
 };
 const onClear=()=>{frame=undefined;visible=false;syncVisibility();};
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
  disposed=true;preview?.close();window.removeEventListener(RACE_MAP_FRAME_EVENT,onFrame as EventListener);window.removeEventListener(RACE_MAP_CLEAR_EVENT,onClear);window.removeEventListener('keydown',onKey,true);root.remove();
 };
}
