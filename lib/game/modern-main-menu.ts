import {createModernCarShowroom} from './upgraded-car-menu';
import {createBlissEditor3DView,type BlissEditor3DCameraState} from './bliss-editor-3d';
import {decodeBlissTrack} from './bliss-track';
import {enhancedRenderResolution} from './enhanced-resolution-settings';
import type {Assets} from './types';

export type ModernMainMenuAction='drive'|'car'|'track'|'opponent'|'options'|'none';

type TrackState={name:string;path:string;raw:number[]};

const actions:ModernMainMenuAction[]=['drive','car','track','opponent','options'];
const carPreview={x:98,y:59,w:94,h:64};
const trackPreview={x:207,y:59,w:101,h:78};
const driveButton={x:13,y:52,w:69,h:24};
const opponentButton={x:13,y:81,w:69,h:24};
const optionsButton={x:13,y:110,w:69,h:24};
const carButton={x:104,y:164,w:82,h:20};
const trackButton={x:213,y:164,w:88,h:20};

const carId=(configuration:readonly number[])=>String.fromCharCode(...configuration.slice(0,4));
const sceneryName=(landscape:number)=>['DESERT','TROPICAL','CITY','COUNTRY','ALPINE'][landscape]??('SCENERY '+landscape);

export function createModernMainMenu(options:{
 canvas:HTMLCanvasElement;
 assets:Assets;
 configuration:number[];
 track:TrackState;
 palette:readonly number[];
 materialIndices:readonly number[];
}){
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 const menuCanvasBackground=canvas.style.background,menuCanvasZIndex=canvas.style.zIndex;
 canvas.style.background='transparent';canvas.style.zIndex='2';

 const carShowroom=createModernCarShowroom(options.palette,options.materialIndices);
 const carSurface=carShowroom.canvas;
 const trackSurface=document.createElement('canvas');
 let trackView:ReturnType<typeof createBlissEditor3DView>|undefined;
 let trackSignature='';
 let closed=false,focus:ModernMainMenuAction='drive',hover:ModernMainMenuAction='none';

 const mount=(surface:HTMLCanvasElement,kind:string)=>{
  const parent=canvas.parentElement;if(!parent)return;
  surface.classList.add(kind);surface.setAttribute('aria-hidden','true');
  for(const [property,value] of [
   ['position','absolute'],['pointer-events','none'],['display','block'],['transform','none'],
   ['max-width','none'],['max-height','none'],['margin','0'],['padding','0'],['border','0'],
   ['background','#101010'],['z-index','1'],['border-radius','3px'],
  ] as const)surface.style.setProperty(property,value,'important');
  parent.insertBefore(surface,canvas);
 };
 mount(carSurface,'modern-main-car-preview');
 mount(trackSurface,'modern-main-track-preview');

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#4a4a4a',radius=4,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=7,colour='#e8e8e8',weight=500,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const fit=(value:string,max:number)=>value.length<=max?value:value.slice(0,Math.max(1,max-1))+'…';
 const inside=(x:number,y:number,b:{x:number;y:number;w:number;h:number})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
 const active=(action:ModernMainMenuAction)=>focus===action||hover===action;
 const button=(bounds:{x:number;y:number;w:number;h:number},caption:string,action:ModernMainMenuAction,size=6.5)=>{
  const selected=active(action);
  rect(bounds.x,bounds.y,bounds.w,bounds.h,selected?'#676a49':'#555657',selected?'#d8d66d':'#777',4,selected?1.5:1);
  label(caption,bounds.x+bounds.w/2,bounds.y+bounds.h/2+.2,size,selected?'#fff':'#ededed',650,'center');
 };

 const syncBounds=()=>{
  const parent=canvas.parentElement;if(!parent)return;
  const base=canvas.getBoundingClientRect(),p=parent.getBoundingClientRect(),scaleX=base.width/320,scaleY=base.height/200;
  const place=(surface:HTMLCanvasElement,b:{x:number;y:number;w:number;h:number})=>{
   surface.style.setProperty('left',`${base.left-p.left+b.x*scaleX}px`,'important');
   surface.style.setProperty('top',`${base.top-p.top+b.y*scaleY}px`,'important');
   surface.style.setProperty('width',`${b.w*scaleX}px`,'important');
   surface.style.setProperty('height',`${b.h*scaleY}px`,'important');
  };
  place(carSurface,carPreview);place(trackSurface,trackPreview);
 };

 const renderCar=()=>{
  const id=carId(options.configuration),car=options.assets.cars.find(entry=>entry.id===id)??options.assets.cars[0];
  if(!car)return {id,name:'NO CAR',gears:0,mass:0,maxRPM:0};
  const shape=options.assets.shapes['ST'+car.id]?.car0,raceShape=options.assets.shapes['ST'+car.id]?.car1;
  if(shape){
   const scale=enhancedRenderResolution().width/320;
   carShowroom.draw(shape,raceShape,Math.max(0,options.configuration[4]??0),Math.max(1,Math.round(carPreview.w*scale)),Math.max(1,Math.round(carPreview.h*scale)),{angle:80,pitch:0,zoom:1});
  }
  return car;
 };

 const camera:BlissEditor3DCameraState={position:[15360,29000,13500],target:[15360,-1800,-15360],fov:48};
 const renderTrack=()=>{
  const signature=options.track.name+'/'+options.track.raw.length+'/'+options.track.raw.slice(0,1802).reduce((hash,byte,index)=>(Math.imul(hash^byte,16777619)+index)>>>0,2166136261);
  const decoded=decodeBlissTrack(Uint8Array.from(options.track.raw));
  if(!trackView){
   trackView=createBlissEditor3DView(trackSurface,options.assets,decoded,{initialCamera:camera,transparentBackground:true,showGround:true,showBasePlane:false,pixelRatio:()=>Math.max(1,(enhancedRenderResolution().width/320)*trackPreview.w/Math.max(1,trackSurface.clientWidth||trackPreview.w))});
  }else if(signature!==trackSignature){trackView.update(decoded);trackView.resetView();}
  trackSignature=signature;trackView.render();
  return decoded;
 };

 const render=()=>{
  if(closed)return;
  syncBounds();
  const car=renderCar(),decoded=renderTrack();
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#686a6c';ctx.fillRect(0,0,canvas.width,canvas.height);

  rect(7,6,306,28,'#5c5e60','#7d7f80',5);
  label('STUNTS',14,20,14,'#ededed',900);
  label('DX',71,20,14,'#d8d66d',900);
  label('DRIVE  ·  BUILD  ·  REPEAT',305,20,5.2,'#d4d4d4',600,'right');

  rect(7,39,81,154,'#4f5152','#7a7b7c',5);
  label('MAIN MENU',13,46,6,'#d8d66d',750);
  button(driveButton,'RACE','drive',8);
  button(opponentButton,'OPPONENT','opponent',6.3);
  button(optionsButton,'OPTIONS','options',6.8);
  label('Car and track selection',13,146,4.2,'#c6c6c6',500);
  label('live in the preview cards.',13,153,4.2,'#c6c6c6',500);
  label('ESC  Exit',13,181,4.5,'#bcbcbc',550);

  rect(93,39,104,154,'#4f5152','#7a7b7c',5);
  label('CURRENT CAR',100,49,6,'#dadada',750);
  label(fit(car.name??car.id,14),190,49,6,'#d8d66d',750,'right');
  ctx.clearRect(carPreview.x*sx(),carPreview.y*sy(),carPreview.w*sx(),carPreview.h*sy());
  label(car.id,100,133,5,'#aaa',650);
  label(`${car.gears??'?'} GEARS`,100,142,4.4,'#cfcfcf',550);
  label(`${car.mass??'?'} KG`,190,142,4.4,'#cfcfcf',550,'right');
  label(`${car.maxRPM??'?'} RPM`,100,151,4.4,'#cfcfcf',550);
  button(carButton,'CHANGE CAR','car',5.8);

  rect(202,39,111,154,'#4f5152','#7a7b7c',5);
  label('SELECTED TRACK',208,49,6,'#dadada',750);
  label(fit(options.track.name||'UNTITLED',15),307,49,6,'#d8d66d',750,'right');
  ctx.clearRect(trackPreview.x*sx(),trackPreview.y*sy(),trackPreview.w*sx(),trackPreview.h*sy());
  label('SCENERY',208,143,4.1,'#a9a9a9',650);
  label(sceneryName(decoded.landscape),307,143,4.8,'#e3e3e3',650,'right');
  label('FORMAT',208,151,4.1,'#a9a9a9',650);
  label(String(decoded.format),307,151,4.8,'#e3e3e3',650,'right');
  button(trackButton,'CHANGE TRACK','track',5.4);
  ctx.restore();
  carSurface.style.display='block';trackSurface.style.display='block';
 };

 const actionAt=(event:{clientX:number;clientY:number}):ModernMainMenuAction=>{
  const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
  if(inside(x,y,driveButton))return 'drive';
  if(inside(x,y,opponentButton))return 'opponent';
  if(inside(x,y,optionsButton))return 'options';
  if(inside(x,y,carButton)||inside(x,y,{x:93,y:39,w:104,h:154}))return 'car';
  if(inside(x,y,trackButton)||inside(x,y,{x:202,y:39,w:111,h:154}))return 'track';
  return 'none';
 };

 const observer=new ResizeObserver(()=>{syncBounds();trackView?.render();});
 observer.observe(canvas);render();

 return {
  render,
  setFocus(action:ModernMainMenuAction){focus=action;render();},
  actionAt,
  hoverAt(event:{clientX:number;clientY:number}){const next=actionAt(event);if(next!==hover){hover=next;render();}},
  clearHover(){if(hover!=='none'){hover='none';render();}},
  nextFocus(direction:1|-1){const index=Math.max(0,actions.indexOf(focus));focus=actions[(index+direction+actions.length)%actions.length];render();return focus;},
  close(){if(closed)return;closed=true;observer.disconnect();trackView?.close();trackView=undefined;carShowroom.close();carSurface.remove();trackSurface.remove();canvas.style.background=menuCanvasBackground;canvas.style.zIndex=menuCanvasZIndex;}
 };
}
