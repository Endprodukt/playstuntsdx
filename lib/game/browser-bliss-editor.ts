import {BlissEditorCore} from './bliss-editor-core.ts';
import {blissElementData,blissPalettePages} from './bliss-element-data.ts';
import {blissOriginalMapImageData,blissOriginalPaletteImageData,type BlissOriginalMapResources,BLISS_ORIGINAL_MAP_SIZE} from './bliss-original-map.ts';
import {encodeBlissTrack} from './bliss-track.ts';
import {transformBlissTerrainCode,transformBlissTrackCode,type BlissTransformOperation} from './bliss-transformations.ts';

export interface BrowserBlissEditorHost {
 canvas:HTMLCanvasElement;
 track:{name:string;path:string;raw:number[]};
 palette:ReadonlyArray<number>;
 resources:BlissOriginalMapResources;
 writeTrack(path:string,name:string,bytes:Uint8Array):Promise<number>;
 clearScores(path:string,name:string):Promise<void>;
 exists(path:string,name:string):Promise<boolean>;
 customTrackExists?(name:string):Promise<boolean>;
 persistCustomTrack?(name:string,bytes:Uint8Array):Promise<string>;
 presets?:readonly {terrain:number[]}[];
}

type Tool='place'|'erase'|'link'|'flood'|'dry'|'raise'|'lower'|'terrain';

const button=(label:string,action:()=>void)=>{
 const element=document.createElement('button');element.type='button';element.textContent=label;
 element.style.cssText='border:1px solid #555;background:#232323;color:#eee;border-radius:4px;padding:7px 9px;cursor:pointer;font:12px/1.1 system-ui,Segoe UI,sans-serif;';
 element.addEventListener('click',action);return element;
};
const panel=(title:string)=>{
 const root=document.createElement('section');root.style.cssText='min-width:0;background:#111;border:1px solid #3b3b3b;border-radius:6px;padding:10px;overflow:hidden;';
 const heading=document.createElement('strong');heading.textContent=title;heading.style.cssText='display:block;margin-bottom:8px;color:#eee;font:600 12px/1.2 system-ui,Segoe UI,sans-serif;';
 root.append(heading);return root;
};
const setActive=(element:HTMLButtonElement,active:boolean)=>{element.style.background=active?'#5b6330':'#232323';element.style.borderColor=active?'#b4c35a':'#555';};

/** First native PlayStunts DX shell for the Bliss port.
 * It intentionally renders with editor art extracted from the user's Stunts
 * files instead of redistributing Bliss' biggfx atlas. */
export async function runBrowserBlissEditor(host:BrowserBlissEditorHost){
 const core=BlissEditorCore.fromBytes(Uint8Array.from(host.track.raw));
 let tool:Tool='place',brush=4,terrainBrush=0,page=0,cellX=0,cellY=0,painting=false,closed=false,zoom=1;
 const overlay=document.createElement('div');overlay.tabIndex=-1;overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#090909;color:#ddd;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:12px;box-sizing:border-box;font-family:system-ui,Segoe UI,sans-serif;';
 const top=document.createElement('div');top.style.cssText='display:flex;align-items:center;gap:8px;min-width:0;';
 const title=document.createElement('strong');title.textContent='PlayStunts DX — Bliss Track Editor';title.style.cssText='font-size:14px;color:#fff;margin-right:auto;';
 const name=document.createElement('span');name.textContent=host.track.name+'.TRK';name.style.cssText='color:#aaa;font-size:12px;';
 const status=document.createElement('span');status.style.cssText='color:#c8c8c8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw;';
 top.append(title,name,status);

 const main=document.createElement('div');main.style.cssText='display:grid;grid-template-columns:minmax(360px,460px) minmax(0,1fr) minmax(210px,270px);gap:10px;min-height:0;';
 const palettePanel=panel('Track pieces');
 palettePanel.style.display='grid';palettePanel.style.gridTemplateRows='auto auto minmax(0,1fr) auto';palettePanel.style.gap='8px';
 const selectedPiece=document.createElement('div');selectedPiece.style.cssText='display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;align-items:center;min-height:126px;padding:8px;border:1px solid #353535;background:#0b0b0b;border-radius:5px;';
 const selectedPreview=document.createElement('canvas');selectedPreview.width=32;selectedPreview.height=32;selectedPreview.style.cssText='width:112px;height:112px;image-rendering:pixelated;display:block;background:#070707;border:1px solid #292929;';
 const selectedInfo=document.createElement('div');selectedInfo.style.cssText='min-width:0;';
 const selectedName=document.createElement('strong');selectedName.style.cssText='display:block;color:#fff;font-size:14px;line-height:1.25;margin-bottom:5px;';
 const selectedCode=document.createElement('span');selectedCode.style.cssText='display:block;color:#888;font-size:11px;';
 selectedInfo.append(selectedName,selectedCode);selectedPiece.append(selectedPreview,selectedInfo);
 const paletteGrid=document.createElement('div');paletteGrid.style.cssText='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;align-content:start;overflow:auto;min-height:0;padding-right:3px;';
 const pageBar=document.createElement('div');pageBar.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding-top:6px;border-top:1px solid #2d2d2d;';
 palettePanel.append(selectedPiece,paletteGrid,pageBar);

 const mapPanel=panel('30 × 30 track');
 mapPanel.style.display='grid';mapPanel.style.gridTemplateRows='auto auto minmax(0,1fr)';mapPanel.style.placeItems='stretch';
 const zoomBar=document.createElement('div');zoomBar.style.cssText='display:flex;justify-content:center;align-items:center;gap:5px;margin:-2px 0 8px;';
 const zoomOut=button('−',()=>setZoom(zoom-.25)),zoomReset=button('100%',()=>setZoom(1)),zoomIn=button('+',()=>setZoom(zoom+.25)),zoomFit=button('Fit',()=>fitMap());
 zoomOut.title='Zoom out';zoomIn.title='Zoom in';zoomReset.title='Actual size';zoomFit.title='Fit map to editor';
 for(const control of [zoomOut,zoomReset,zoomIn,zoomFit])control.style.padding='4px 8px';
 const mapWrap=document.createElement('div');mapWrap.style.cssText='min-height:0;min-width:0;display:grid;place-items:center;overflow:auto;background:#050505;border-radius:4px;';
 const map=document.createElement('canvas');map.width=BLISS_ORIGINAL_MAP_SIZE;map.height=BLISS_ORIGINAL_MAP_SIZE;map.style.cssText='display:block;image-rendering:pixelated;width:480px;height:480px;max-width:none;max-height:none;cursor:crosshair;box-shadow:0 0 0 1px #333;flex:none;';
 mapWrap.append(map);mapPanel.append(zoomBar,mapWrap);

 const toolsPanel=panel('Tools');
 const tools=document.createElement('div');tools.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:5px;';
 const toolButtons=new Map<Tool,HTMLButtonElement>();
 const chooseTool=(next:Tool)=>{tool=next;for(const [key,value] of toolButtons)setActive(value,key===tool);renderStatus();};
 for(const [key,label] of [['place','Place'],['erase','Erase'],['link','Auto link'],['flood','Flood'],['dry','Dry'],['raise','Raise'],['lower','Lower'],['terrain','Terrain tile']] as const){
  const control=button(label,()=>chooseTool(key));toolButtons.set(key,control);tools.append(control);
 }
 const transformBox=document.createElement('div');transformBox.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:10px;';
 const rotate=button('Rotate ↻',()=>transformBrush('clockwise','Rotate'));
 const flipH=button('Flip ↔',()=>transformBrush('hflip','Horizontal flip'));
 const flipV=button('Flip ↕',()=>transformBrush('vflip','Vertical flip'));
 transformBox.append(rotate,flipH,flipV);
 const help=document.createElement('p');help.textContent='Left click/drag edits · Right click erases · Mouse wheel zooms · Ctrl+Z/Y undo/redo · 1–8 select tools · R rotates · H/V flip.';help.style.cssText='font-size:11px;line-height:1.35;color:#999;margin:10px 0 0;';
 toolsPanel.append(tools,transformBox,help);

 main.append(palettePanel,mapPanel,toolsPanel);

 const footer=document.createElement('div');footer.style.cssText='display:flex;align-items:center;gap:7px;min-width:0;';
 const coords=document.createElement('span');coords.style.cssText='font-size:11px;color:#888;margin-right:auto;';
 const undo=button('Undo',()=>{if(core.undo())changed('Undo');});
 const redo=button('Redo',()=>{if(core.redo())changed('Redo');});
 const validate=button('Check track',()=>{
  const result=core.check();
  status.textContent=result.ok?'Track OK — winning path found':'Track check: '+result.reason+' · error '+result.error;
  status.style.color=result.ok?'#aee18a':'#ffbd7a';
 });
 const newTrackButton=button('New',()=>{void createNewTrack();});
 const save=button('Save',()=>{void saveTrack();});
 const saveAs=button('Save As',()=>{void saveTrack(true);});
 const done=button('Done',()=>{void finish();});
 footer.append(coords,newTrackButton,undo,redo,validate,save,saveAs,done);
 overlay.append(top,main,footer);document.body.append(overlay);

 const context=map.getContext('2d',{alpha:false})!;
 const setZoom=(next:number)=>{
  zoom=Math.max(.5,Math.min(4,Math.round(next*4)/4));
  const size=Math.round(BLISS_ORIGINAL_MAP_SIZE*zoom);
  map.style.width=size+'px';map.style.height=size+'px';zoomReset.textContent=Math.round(zoom*100)+'%';
 };
 const fitMap=()=>{
  const width=Math.max(1,mapWrap.clientWidth-20),height=Math.max(1,mapWrap.clientHeight-20);
  setZoom(Math.min(4,width/BLISS_ORIGINAL_MAP_SIZE,height/BLISS_ORIGINAL_MAP_SIZE));
 };
 const renderMap=()=>{
  context.putImageData(blissOriginalMapImageData(core.track,host.resources,host.palette),0,0);
  context.save();context.strokeStyle='rgba(255,255,255,.85)';context.lineWidth=1;context.strokeRect(cellX*16+.5,cellY*16+.5,15,15);context.restore();
 };
 const renderStatus=()=>{
  const activeCode=tool==='terrain'?terrainBrush:brush;
  const label=tool==='terrain'?('Terrain '+terrainBrush):(blissElementData[brush]?.id||('Element '+brush));
  status.textContent=(core.modified?'Modified · ':'')+tool.toUpperCase()+' · '+label+' ['+activeCode+']';
  status.style.color=core.modified?'#f2d36d':'#c8c8c8';
  coords.textContent='Cell '+(cellX+1)+','+(cellY+1)+' · landscape '+core.track.landscape+' · format '+core.track.format;
  undo.disabled=!core.history.canUndo;redo.disabled=!core.history.canRedo;
 };
 const changed=(message='')=>{
  const bytes=encodeBlissTrack(core.track).subarray(0,1802);host.track.raw=Array.from(bytes);
  renderMap();renderStatus();if(message)status.textContent=message+' · '+status.textContent;
 };
 const paletteLabels=['Paved','Dirt','Ice','Stunts','Banked','Splits','Highway','Elevated','Spins','Scenery','Terrain','Terrain 2'] as const;
 const pageCodes=(index:number)=>Array.from(new Set(blissPalettePages[index])).filter(code=>index>=10?code<=18:code>0&&code<253);
 const drawPreview=(canvas:HTMLCanvasElement,code:number,terrain:boolean,size:number)=>{
  const image=blissOriginalPaletteImageData(code,terrain,host.resources,host.palette);
  canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d',{alpha:false})!.putImageData(image,0,0);
  canvas.style.width=size+'px';canvas.style.height=size+'px';
 };
 const renderPalette=()=>{
  const terrainPage=page>=10,currentCode=terrainPage?terrainBrush:brush,currentLabel=terrainPage?('Terrain '+terrainBrush):(blissElementData[brush]?.id||('Element '+brush));
  selectedName.textContent=currentLabel;selectedCode.textContent=(terrainPage?'Terrain tile ':'Track element ')+currentCode;
  drawPreview(selectedPreview,currentCode,terrainPage,112);

  paletteGrid.replaceChildren();
  for(const code of pageCodes(page)){
   const label=terrainPage?('Terrain '+code):(blissElementData[code]?.id||('Element '+code));
   const entry=button('',()=>{
    if(terrainPage){terrainBrush=code;chooseTool('terrain');}
    else{brush=code;chooseTool('place');}
    renderPalette();
   });
   entry.title=label;entry.setAttribute('aria-label',label);
   entry.style.cssText+='display:grid;place-items:center;min-height:74px;padding:4px;overflow:hidden;';
   const preview=document.createElement('canvas');preview.style.cssText='image-rendering:pixelated;display:block;';
   drawPreview(preview,code,terrainPage,64);entry.append(preview);
   setActive(entry,code===currentCode);paletteGrid.append(entry);
  }

  pageBar.replaceChildren();
  for(let i=0;i<blissPalettePages.length;i++){
   const terrain=i>=10,codes=pageCodes(i),representative=codes[0]??0;
   const pageButton=button('',()=>{page=i;renderPalette();});
   pageButton.title=paletteLabels[i]??('Page '+(i+1));pageButton.setAttribute('aria-label',pageButton.title);
   pageButton.style.cssText+='display:grid;place-items:center;height:48px;padding:3px;overflow:hidden;';
   const icon=document.createElement('canvas');icon.style.cssText='image-rendering:pixelated;display:block;';
   drawPreview(icon,representative,terrain,38);pageButton.append(icon);
   setActive(pageButton,page===i);pageBar.append(pageButton);
  }
 };
 const mapCoordinates=(event:PointerEvent)=>{
  const rect=map.getBoundingClientRect(),px=(event.clientX-rect.left)*map.width/rect.width,py=(event.clientY-rect.top)*map.height/rect.height;
  return {x:Math.max(0,Math.min(29,Math.floor(px/16))),y:Math.max(0,Math.min(29,Math.floor(py/16))),vx:Math.max(0,Math.min(30,Math.round(px/16))),vy:Math.max(0,Math.min(30,Math.round(py/16)))};
 };
 const apply=(event:PointerEvent,forceErase=false)=>{
  const p=mapCoordinates(event);cellX=p.x;cellY=p.y;
  if(forceErase||event.button===2||tool==='erase')core.clear(p.x,p.y);
  else if(tool==='place')core.place(p.x,p.y,brush);
  else if(tool==='link')core.link(p.x,p.y);
  else if(tool==='flood')core.flood(p.vx,p.vy);
  else if(tool==='dry')core.dry(p.vx,p.vy);
  else if(tool==='raise')core.raise(p.vx,p.vy);
  else if(tool==='lower')core.lower(p.vx,p.vy);
  else if(tool==='terrain')core.paintTerrain(p.x,p.y,terrainBrush);
  changed();
 };
 const pointerDown=(event:PointerEvent)=>{event.preventDefault();painting=true;map.setPointerCapture(event.pointerId);apply(event,event.button===2);};
 const pointerMove=(event:PointerEvent)=>{const p=mapCoordinates(event);if(p.x!==cellX||p.y!==cellY){cellX=p.x;cellY=p.y;if(painting&&(event.buttons&3))apply(event,(event.buttons&2)!==0);else{renderMap();renderStatus();}}};
 const pointerUp=(event:PointerEvent)=>{painting=false;if(map.hasPointerCapture(event.pointerId))map.releasePointerCapture(event.pointerId);};
 map.addEventListener('pointerdown',pointerDown);map.addEventListener('pointermove',pointerMove);map.addEventListener('pointerup',pointerUp);map.addEventListener('pointercancel',pointerUp);map.addEventListener('contextmenu',event=>event.preventDefault());
 map.addEventListener('wheel',event=>{event.preventDefault();setZoom(zoom+(event.deltaY<0?.25:-.25));},{passive:false});

 const keyDown=(event:KeyboardEvent)=>{
  if(event.ctrlKey&&(event.code==='KeyZ'||event.code==='KeyY')){event.preventDefault();if(event.code==='KeyZ'){if(core.undo())changed('Undo');}else if(core.redo())changed('Redo');return;}
  if(event.code==='Escape'){event.preventDefault();void finish();return;}
  if(event.code==='KeyR'){event.preventDefault();transformBrush('clockwise','Rotate');return;}
  if(event.code==='KeyH'){event.preventDefault();transformBrush('hflip','Horizontal flip');return;}
  if(event.code==='KeyV'){event.preventDefault();transformBrush('vflip','Vertical flip');return;}
  const keys:Record<string,Tool>={Digit1:'place',Digit2:'erase',Digit3:'link',Digit4:'flood',Digit5:'dry',Digit6:'raise',Digit7:'lower',Digit8:'terrain'};
  if(keys[event.code]){event.preventDefault();chooseTool(keys[event.code]);}
 };
 window.addEventListener('keydown',keyDown,true);

 function transformBrush(operation:BlissTransformOperation,label:string){
  const terrain=tool==='terrain';
  const before=terrain?terrainBrush:brush;
  const next=terrain?transformBlissTerrainCode(before,operation):transformBlissTrackCode(before,operation);
  if(terrain)terrainBrush=next;else brush=next;
  renderPalette();renderStatus();
  if(next===before){
   status.textContent=label+': this piece is symmetrical, so its orientation does not change.';
   status.style.color='#aaa';
  }else{
   status.textContent=label+' → '+next+' · '+(terrain?('Terrain '+next):(blissElementData[next]?.id||('Element '+next)));
   status.style.color='#aee18a';
  }
 }

 async function createNewTrack(){
  if(core.modified&&!window.confirm('Discard the current unsaved changes and create a new track?'))return;
  const names=['Desert','Tropical','Alpine','City','Country'];
  const current=Math.max(0,Math.min(4,core.track.landscape))+1;
  const answer=window.prompt('New track environment:\n1 Desert\n2 Tropical\n3 Alpine\n4 City\n5 Country',String(current));
  if(answer===null)return;
  const choice=Number.parseInt(answer.trim(),10)-1;
  if(!Number.isInteger(choice)||choice<0||choice>4){window.alert('Choose a number from 1 to 5.');return;}
  const preset=host.presets?.[choice]?.terrain;
  core.newTrack({landscape:choice,format:preset?.[900]??152,terrain:preset});
  host.track.name='';name.textContent='UNTITLED.TRK';cellX=0;cellY=0;page=0;brush=4;terrainBrush=0;chooseTool('place');
  changed('New '+names[choice]+' track');
 }

 async function requestedTrackName(force=false){
  if(!force&&host.track.name){
   const isCustom=host.customTrackExists?await host.customTrackExists(host.track.name):true;
   if(isCustom)return host.track.name;
  }
  const entered=window.prompt('Track name (maximum 8 characters):',host.track.name||'NEWTRACK');
  if(entered===null)return null;
  const clean=entered.trim().replace(/[^A-Za-z0-9_-]/g,'_').toUpperCase().slice(0,8);
  if(!clean){window.alert('Please enter a track name.');return null;}
  return clean;
 }

 async function saveTrack(forceName=false){
  const target=await requestedTrackName(forceName);if(!target)return false;
  const savePath='';
  const targetIsCustom=host.customTrackExists?await host.customTrackExists(target):false;
  const targetExists=await host.exists(savePath,target);
  if(targetExists&&!targetIsCustom&&target!==host.track.name){
   window.alert(target+'.TRK is already a supplied track. Choose another name for the custom track.');
   return false;
  }
  if(targetIsCustom&&(forceName||target!==host.track.name)&&!window.confirm(target+'.TRK already exists in Custom Tracks. Overwrite it?'))return false;
  const bytes=encodeBlissTrack(core.track).subarray(0,1802);
  let customLocation='';
  try{
   if(host.persistCustomTrack)customLocation=await host.persistCustomTrack(target,bytes);
  }catch(error){
   status.textContent='Could not save to Custom Tracks: '+String(error);status.style.color='#ff9b9b';return false;
  }
  const statusCode=await host.writeTrack(savePath,target,bytes);
  if(statusCode){status.textContent='Track was written to Custom Tracks, but could not be added to the current track list.';status.style.color='#ffbd7a';return false;}
  host.track.name=target;host.track.path=savePath;
  name.textContent=host.track.name+'.TRK';
  await host.clearScores(savePath,host.track.name);host.track.raw=Array.from(bytes);core.markSaved();renderStatus();
  status.textContent=customLocation?'Saved to '+customLocation:'Saved '+host.track.name+'.TRK';
  status.style.color='#aee18a';return true;
 }
 async function finish(){
  if(closed)return;
  if(core.modified){
   const choice=window.confirm('Save changes to '+host.track.name+'.TRK before leaving the Bliss editor?');
   if(choice&&!await saveTrack())return;
  }
  closed=true;cleanup();resolveDone?.();
 }
 const cleanup=()=>{window.removeEventListener('keydown',keyDown,true);overlay.remove();};
 let resolveDone:(()=>void)|undefined;
 renderPalette();renderMap();renderStatus();chooseTool('place');overlay.focus();
 requestAnimationFrame(()=>fitMap());
 await new Promise<void>(resolve=>{resolveDone=resolve;});
 cleanup();
}
