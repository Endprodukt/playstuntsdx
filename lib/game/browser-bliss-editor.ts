import {BlissEditorCore} from './bliss-editor-core.ts';
import {blissElementData,blissPalettePages} from './bliss-element-data.ts';
import {blissOriginalMapImageData,type BlissOriginalMapResources,BLISS_ORIGINAL_MAP_SIZE} from './bliss-original-map.ts';
import {encodeBlissTrack} from './bliss-track.ts';
import {transformBlissTrackCode} from './bliss-transformations.ts';

export interface BrowserBlissEditorHost {
 canvas:HTMLCanvasElement;
 track:{name:string;path:string;raw:number[]};
 palette:ReadonlyArray<number>;
 resources:BlissOriginalMapResources;
 writeTrack(path:string,name:string,bytes:Uint8Array):Promise<number>;
 clearScores(path:string,name:string):Promise<void>;
}

type Tool='place'|'erase'|'link'|'flood'|'dry'|'raise'|'lower';

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
 let tool:Tool='place',brush=4,page=0,cellX=0,cellY=0,painting=false,closed=false;
 const overlay=document.createElement('div');overlay.tabIndex=-1;overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#090909;color:#ddd;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:12px;box-sizing:border-box;font-family:system-ui,Segoe UI,sans-serif;';
 const top=document.createElement('div');top.style.cssText='display:flex;align-items:center;gap:8px;min-width:0;';
 const title=document.createElement('strong');title.textContent='PlayStunts DX — Bliss Track Editor';title.style.cssText='font-size:14px;color:#fff;margin-right:auto;';
 const name=document.createElement('span');name.textContent=host.track.name+'.TRK';name.style.cssText='color:#aaa;font-size:12px;';
 const status=document.createElement('span');status.style.cssText='color:#c8c8c8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw;';
 top.append(title,name,status);

 const main=document.createElement('div');main.style.cssText='display:grid;grid-template-columns:minmax(250px,310px) minmax(0,1fr) minmax(190px,250px);gap:10px;min-height:0;';
 const palettePanel=panel('Track pieces');
 const pageBar=document.createElement('div');pageBar.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;';
 const paletteGrid=document.createElement('div');paletteGrid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;align-content:start;overflow:auto;max-height:calc(100vh - 150px);';
 palettePanel.append(pageBar,paletteGrid);

 const mapPanel=panel('30 × 30 track');
 mapPanel.style.display='grid';mapPanel.style.gridTemplateRows='auto minmax(0,1fr)';mapPanel.style.placeItems='stretch';
 const mapWrap=document.createElement('div');mapWrap.style.cssText='min-height:0;display:grid;place-items:center;overflow:auto;background:#050505;border-radius:4px;';
 const map=document.createElement('canvas');map.width=BLISS_ORIGINAL_MAP_SIZE;map.height=BLISS_ORIGINAL_MAP_SIZE;map.style.cssText='display:block;image-rendering:pixelated;max-width:100%;max-height:100%;width:auto;height:auto;cursor:crosshair;box-shadow:0 0 0 1px #333;';
 mapWrap.append(map);mapPanel.append(mapWrap);

 const toolsPanel=panel('Tools');
 const tools=document.createElement('div');tools.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:5px;';
 const toolButtons=new Map<Tool,HTMLButtonElement>();
 const chooseTool=(next:Tool)=>{tool=next;for(const [key,value] of toolButtons)setActive(value,key===tool);renderStatus();};
 for(const [key,label] of [['place','Place'],['erase','Erase'],['link','Auto link'],['flood','Flood'],['dry','Dry'],['raise','Raise'],['lower','Lower']] as const){
  const control=button(label,()=>chooseTool(key));toolButtons.set(key,control);tools.append(control);
 }
 const transformBox=document.createElement('div');transformBox.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:10px;';
 const rotate=button('Rotate',()=>{brush=transformBlissTrackCode(brush,'clockwise');renderPalette();renderStatus();});
 const flip=button('Flip H',()=>{brush=transformBlissTrackCode(brush,'hflip');renderPalette();renderStatus();});
 transformBox.append(rotate,flip);
 const help=document.createElement('p');help.textContent='Left click/drag edits · Right click erases · Ctrl+Z/Y undo/redo · 1–7 select tools · R rotates brush · H flips brush.';help.style.cssText='font-size:11px;line-height:1.35;color:#999;margin:10px 0 0;';
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
 const save=button('Save',()=>{void saveTrack();});
 const done=button('Done',()=>{void finish();});
 footer.append(coords,undo,redo,validate,save,done);
 overlay.append(top,main,footer);document.body.append(overlay);

 const context=map.getContext('2d',{alpha:false})!;
 const renderMap=()=>{
  context.putImageData(blissOriginalMapImageData(core.track,host.resources,host.palette),0,0);
  context.save();context.strokeStyle='rgba(255,255,255,.85)';context.lineWidth=1;context.strokeRect(cellX*16+.5,cellY*16+.5,15,15);context.restore();
 };
 const renderStatus=()=>{
  const label=blissElementData[brush]?.id||('Element '+brush);
  status.textContent=(core.modified?'Modified · ':'')+tool.toUpperCase()+' · '+label+' ['+brush+']';
  status.style.color=core.modified?'#f2d36d':'#c8c8c8';
  coords.textContent='Cell '+(cellX+1)+','+(cellY+1)+' · landscape '+core.track.landscape+' · format '+core.track.format;
  undo.disabled=!core.history.canUndo;redo.disabled=!core.history.canRedo;
 };
 const changed=(message='')=>{
  const bytes=encodeBlissTrack(core.track).subarray(0,1802);host.track.raw=Array.from(bytes);
  renderMap();renderStatus();if(message)status.textContent=message+' · '+status.textContent;
 };
 const renderPalette=()=>{
  pageBar.replaceChildren();
  for(let i=0;i<blissPalettePages.length;i++){
   const pageButton=button(String(i+1),()=>{page=i;renderPalette();});pageButton.style.padding='4px 7px';setActive(pageButton,page===i);pageBar.append(pageButton);
  }
  paletteGrid.replaceChildren();
  for(const code of blissPalettePages[page]){
   const label=blissElementData[code]?.id||('Element '+code),entry=button(code+' · '+label,()=>{brush=code;chooseTool('place');renderPalette();});
   entry.title=label;entry.style.textAlign='left';entry.style.padding='6px';entry.style.fontSize='11px';setActive(entry,code===brush);paletteGrid.append(entry);
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
  changed();
 };
 const pointerDown=(event:PointerEvent)=>{event.preventDefault();painting=true;map.setPointerCapture(event.pointerId);apply(event,event.button===2);};
 const pointerMove=(event:PointerEvent)=>{const p=mapCoordinates(event);if(p.x!==cellX||p.y!==cellY){cellX=p.x;cellY=p.y;if(painting&&(event.buttons&3))apply(event,(event.buttons&2)!==0);else{renderMap();renderStatus();}}};
 const pointerUp=(event:PointerEvent)=>{painting=false;if(map.hasPointerCapture(event.pointerId))map.releasePointerCapture(event.pointerId);};
 map.addEventListener('pointerdown',pointerDown);map.addEventListener('pointermove',pointerMove);map.addEventListener('pointerup',pointerUp);map.addEventListener('pointercancel',pointerUp);map.addEventListener('contextmenu',event=>event.preventDefault());

 const keyDown=(event:KeyboardEvent)=>{
  if(event.ctrlKey&&(event.code==='KeyZ'||event.code==='KeyY')){event.preventDefault();if(event.code==='KeyZ'){if(core.undo())changed('Undo');}else if(core.redo())changed('Redo');return;}
  if(event.code==='Escape'){event.preventDefault();void finish();return;}
  if(event.code==='KeyR'){event.preventDefault();brush=transformBlissTrackCode(brush,'clockwise');renderPalette();renderStatus();return;}
  if(event.code==='KeyH'){event.preventDefault();brush=transformBlissTrackCode(brush,'hflip');renderPalette();renderStatus();return;}
  const keys:Record<string,Tool>={Digit1:'place',Digit2:'erase',Digit3:'link',Digit4:'flood',Digit5:'dry',Digit6:'raise',Digit7:'lower'};
  if(keys[event.code]){event.preventDefault();chooseTool(keys[event.code]);}
 };
 window.addEventListener('keydown',keyDown,true);

 async function saveTrack(){
  const bytes=encodeBlissTrack(core.track).subarray(0,1802),statusCode=await host.writeTrack(host.track.path,host.track.name,bytes);
  if(statusCode){status.textContent='Save failed · status '+statusCode;status.style.color='#ff9b9b';return false;}
  await host.clearScores(host.track.path,host.track.name);host.track.raw=Array.from(bytes);core.markSaved();renderStatus();status.textContent='Saved '+host.track.name+'.TRK';status.style.color='#aee18a';return true;
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
 await new Promise<void>(resolve=>{resolveDone=resolve;});
 cleanup();
}
