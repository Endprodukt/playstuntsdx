import {createModernCarShowroom} from './upgraded-car-menu';
import {createBlissEditor3DView,type BlissEditor3DCameraState} from './bliss-editor-3d';
import {decodeBlissTrack} from './bliss-track';
import {enhancedRenderResolution} from './enhanced-resolution-settings';
import type {Assets} from './types';

export type ModernMainMenuAction='drive'|'car'|'track'|'opponent'|'editor'|'replays'|'options'|'exit'|'none';

type TrackState={name:string;path:string;raw:number[]};
type Bounds={x:number;y:number;w:number;h:number};

const actions:ModernMainMenuAction[]=['drive','opponent','editor','replays','options','exit','car','track'];
const carPreview:Bounds={x:104,y:69,w:91,h:58};
const trackPreview:Bounds={x:214,y:69,w:91,h:58};
const driveButton:Bounds={x:12,y:55,w:72,h:17};
const opponentButton:Bounds={x:12,y:75,w:72,h:17};
const editorButton:Bounds={x:12,y:95,w:72,h:17};
const replaysButton:Bounds={x:12,y:115,w:72,h:17};
const optionsButton:Bounds={x:12,y:135,w:72,h:17};
const exitButton:Bounds={x:12,y:155,w:72,h:17};
const carButton:Bounds={x:108,y:169,w:82,h:16};
const trackButton:Bounds={x:218,y:169,w:82,h:16};

const carId=(configuration:readonly number[])=>String.fromCharCode(...configuration.slice(0,4));
const sceneryName=(landscape:number)=>['DESERT','TROPICAL','CITY','COUNTRY','ALPINE'][landscape]??('SCENERY '+landscape);

export function createModernMainMenu(options:{
 canvas:HTMLCanvasElement;
 assets:Assets;
 configuration:number[];
 track:TrackState;
 palette:number[];
 materialIndices:number[];
}){
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 const menuCanvasBackground=canvas.style.background,menuCanvasZIndex=canvas.style.zIndex;
 canvas.style.background='transparent';canvas.style.zIndex='2';

 const carShowroom=createModernCarShowroom(options.palette,options.materialIndices);
 const carSurface=carShowroom.canvas;
 const trackSurface=document.createElement('canvas');
 let trackView:ReturnType<typeof createBlissEditor3DView>|undefined;
 let trackSignature='';
 let closed=false,suspended=false,focus:ModernMainMenuAction='none',hover:ModernMainMenuAction='none',keyboardFocus=false;

 const mount=(surface:HTMLCanvasElement,kind:string)=>{
  const parent=canvas.parentElement;if(!parent)return;
  surface.classList.add(kind);surface.setAttribute('aria-hidden','true');
  for(const [property,value] of [
   ['position','absolute'],['pointer-events','none'],['display','block'],['transform','none'],
   ['max-width','none'],['max-height','none'],['margin','0'],['padding','0'],['border','0'],
   ['background','#121314'],['z-index','1'],['border-radius','2px'],
  ] as const)surface.style.setProperty(property,value,'important');
  parent.insertBefore(surface,canvas);
 };
 mount(carSurface,'modern-main-car-preview');
 mount(trackSurface,'modern-main-track-preview');

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#777',radius=3,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(1,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const line=(x1:number,y1:number,x2:number,y2:number,colour:string,width=1)=>{
  ctx.beginPath();ctx.moveTo(x1*sx(),y1*sy());ctx.lineTo(x2*sx(),y2*sy());ctx.strokeStyle=colour;ctx.lineWidth=Math.max(1,width*Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=7,colour='#ececec',weight=600,align:CanvasTextAlign='left',italic=false)=>{
  ctx.fillStyle=colour;ctx.font=`${italic?'italic ':''}${weight} ${Math.max(9,size*sy())}px "Arial Narrow","Segoe UI",sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const fitToWidth=(value:string,x:number,y:number,maxWidth:number,startSize:number,colour:string,weight=750,italic=false)=>{
  let size=startSize;
  for(;size>3.8;size-=.25){
   ctx.font=`${italic?'italic ':''}${weight} ${Math.max(9,size*sy())}px "Arial Narrow","Segoe UI",sans-serif`;
   if(ctx.measureText(value).width<=maxWidth*sx())break;
  }
  label(value,x,y,size,colour,weight,'left',italic);
 };
 const inside=(x:number,y:number,b:Bounds)=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
 const activeAction=()=>hover!=='none'?hover:(keyboardFocus?focus:'none');
 const active=(action:ModernMainMenuAction)=>activeAction()===action;

 const icon=(action:ModernMainMenuAction,x:number,y:number,selected:boolean)=>{
  const c=selected?'#303030':'#d8d8d8',s=Math.min(sx(),sy());
  ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=Math.max(1.2*s,1);ctx.lineCap='round';ctx.lineJoin='round';
  const X=x*sx(),Y=y*sy(),u=sy();
  if(action==='drive'){
   ctx.beginPath();ctx.moveTo(X-3*u,Y+3*u);ctx.lineTo(X+3*u,Y-3*u);ctx.moveTo(X-3*u,Y-3*u);ctx.lineTo(X+3*u,Y+3*u);ctx.stroke();
  }else if(action==='opponent'){
   ctx.beginPath();ctx.arc(X,Y,3*u,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(X-4*u,Y+4*u);ctx.lineTo(X+4*u,Y+4*u);ctx.stroke();
  }else if(action==='editor'){
   ctx.beginPath();ctx.moveTo(X-4*u,Y+3*u);ctx.lineTo(X+4*u,Y-4*u);ctx.moveTo(X-3*u,Y-4*u);ctx.lineTo(X+3*u,Y+3*u);ctx.stroke();
  }else if(action==='replays'){
   ctx.beginPath();ctx.arc(X,Y,4*u,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(X-1*u,Y-2*u);ctx.lineTo(X+3*u,Y);ctx.lineTo(X-1*u,Y+2*u);ctx.closePath();ctx.fill();
  }else if(action==='options'){
   ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?3*u:4*u;const px=X+Math.cos(a)*r,py=Y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(X,Y,1.4*u,0,Math.PI*2);ctx.stroke();
  }else if(action==='exit'){
   ctx.strokeRect(X-3*u,Y-4*u,5*u,8*u);ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(X+5*u,Y);ctx.moveTo(X+3*u,Y-2*u);ctx.lineTo(X+5*u,Y);ctx.lineTo(X+3*u,Y+2*u);ctx.stroke();
  }else if(action==='car'){
   ctx.beginPath();ctx.moveTo(X-5*u,Y+2*u);ctx.lineTo(X-3*u,Y-1*u);ctx.lineTo(X+2*u,Y-2*u);ctx.lineTo(X+5*u,Y+2*u);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(X-3*u,Y+3*u,1.2*u,0,Math.PI*2);ctx.arc(X+3*u,Y+3*u,1.2*u,0,Math.PI*2);ctx.fill();
  }else if(action==='track'){
   ctx.beginPath();ctx.moveTo(X-4*u,Y+4*u);ctx.lineTo(X-1*u,Y-4*u);ctx.lineTo(X+2*u,Y+1*u);ctx.lineTo(X+5*u,Y-3*u);ctx.stroke();
  }
  ctx.restore();
 };
 const button=(bounds:Bounds,caption:string,action:ModernMainMenuAction,size=6.1)=>{
  const selected=active(action);
  rect(bounds.x,bounds.y,bounds.w,bounds.h,selected?'#d6d36b':'#555759',selected?'#efeaa0':'#7c7d7e',3,selected?1.4:1);
  ctx.fillStyle=selected?'#b9b75f':'#6c6e70';ctx.fillRect(bounds.x*sx(),bounds.y*sy(),2*sx(),bounds.h*sy());
  icon(action,bounds.x+8,bounds.y+bounds.h/2,selected);
  label(caption,bounds.x+15,bounds.y+bounds.h/2+.2,size,selected?'#2e2e2e':'#f0f0f0',800,'left',true);
  label('›',bounds.x+bounds.w-6,bounds.y+bounds.h/2,size+1.5,selected?'#2e2e2e':'#d6d6d6',800,'center');
 };

 const syncBounds=()=>{
  const parent=canvas.parentElement;if(!parent)return;
  const base=canvas.getBoundingClientRect(),p=parent.getBoundingClientRect(),scaleX=base.width/320,scaleY=base.height/200;
  const place=(surface:HTMLCanvasElement,b:Bounds)=>{
   surface.style.setProperty('left',`${base.left-p.left+b.x*scaleX}px`,'important');
   surface.style.setProperty('top',`${base.top-p.top+b.y*scaleY}px`,'important');
   surface.style.setProperty('width',`${b.w*scaleX}px`,'important');
   surface.style.setProperty('height',`${b.h*scaleY}px`,'important');
  };
  place(carSurface,carPreview);place(trackSurface,trackPreview);
 };

 const renderCar=()=>{
  const id=carId(options.configuration),car=options.assets.cars.find(entry=>entry.id===id)??options.assets.cars[0];
  if(!car)return {id,name:'NO CAR',gears:0,mass:0,maxRPM:0,idleRPM:0,torqueCurve:[] as number[]};
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

 const checkerFlag=(x:number,y:number,scale:number,flip=false,alpha=.1)=>{
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(x*sx(),y*sy());ctx.scale(flip?-1:1,1);ctx.rotate(-.12);
  const cell=5*scale;
  for(let row=0;row<5;row++)for(let col=0;col<7;col++){
   ctx.fillStyle=(row+col)&1?'#efefef':'#222';
   const wave=Math.sin((col*.8)+(row*.55))*1.1*scale;
   ctx.fillRect((col*cell)*sx(),(row*cell+wave)*sy(),cell*sx()+1,cell*sy()+1);
  }
  ctx.restore();
 };

 const render=()=>{
  if(closed||suspended)return;
  syncBounds();
  const car=renderCar(),decoded=renderTrack();
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);

  const background=ctx.createLinearGradient(0,0,0,canvas.height);
  background.addColorStop(0,'#686a6c');background.addColorStop(.35,'#5c5e60');background.addColorStop(1,'#484a4c');ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
  checkerFlag(246,6,.72,false,.08);checkerFlag(36,151,.62,true,.065);
  ctx.fillStyle='rgba(255,255,255,.025)';for(let y=0;y<200;y+=8)ctx.fillRect(0,y*sy(),canvas.width,sy());
  rect(6,5,308,34,'rgba(75,77,79,.92)','#808284',4);
  line(7,40,313,40,'#8e9091');

  // Placeholder wordmark treatment until the exact supplied STUNTS DX logo is
  // wired in. It intentionally keeps the original-style italic silhouette.
  label('STUNTS',13.5,21.5,16,'#2f3031',900,'left',true);
  label('STUNTS',12,20,16,'#eeeeea',900,'left',true);
  label('DX',78,20,13,'#d7d66f',900,'left',true);
  label('DRIVE  •  BUILD  •  JUMP  •  REPEAT',150,15,4.1,'#d1d1d1',700);
  label('STUNTS DX',150,25,4,'#aeb0b1',700);

  rect(7,45,82,148,'#505254','#7b7d7e',4);
  label('MAIN MENU',13,50,5.2,'#dedede',800);
  button(driveButton,'RACE','drive',6.8);
  button(opponentButton,'OPPONENT','opponent',5.5);
  button(editorButton,'TRACK EDITOR','editor',5.1);
  button(replaysButton,'REPLAYS','replays',5.7);
  button(optionsButton,'OPTIONS','options',5.8);
  button(exitButton,'EXIT','exit',5.9);
  label('ENTER  SELECT',13,179,3.8,'#d0d0d0',650);
  label('ESC  EXIT',13,186,3.8,'#c0c0c0',650);

  rect(94,45,105,148,'#505254','#7b7d7e',4);
  label('CURRENT CAR',101,50,5.1,'#e5e5e5',800);
  fitToWidth(car.name??car.id,101,59,91,6.1,'#e1df7c',800,true);
  ctx.clearRect(carPreview.x*sx(),carPreview.y*sy(),carPreview.w*sx(),carPreview.h*sy());
  line(101,132,193,132,'#858788',1.2);
  label('GEARS',101,139,3.7,'#c1c1c1',650);label(String(car.gears??'?'),193,139,4.1,'#f0f0f0',750,'right');
  label('WEIGHT',101,146,3.7,'#c1c1c1',650);label(`${car.mass??'?'} KG`,193,146,4.1,'#f0f0f0',750,'right');
  label('MAX RPM',101,153,3.7,'#c1c1c1',650);label(String(car.maxRPM??'?'),193,153,4.1,'#f0f0f0',750,'right');
  label('IDLE RPM',101,160,3.7,'#c1c1c1',650);label(String(car.idleRPM??'?'),193,160,4.1,'#f0f0f0',750,'right');
  button(carButton,'CHANGE CAR','car',5.1);

  rect(204,45,109,148,'#505254','#7b7d7e',4);
  label('SELECTED TRACK',211,50,5.1,'#e5e5e5',800);
  fitToWidth(options.track.name||'UNTITLED',211,59,94,6.1,'#e1df7c',800,true);
  ctx.clearRect(trackPreview.x*sx(),trackPreview.y*sy(),trackPreview.w*sx(),trackPreview.h*sy());
  line(211,132,305,132,'#858788',1.2);
  const roadCells=Array.from(decoded.track).filter(value=>value!==0).length;
  const terrainCells=Array.from(decoded.terrain).filter(value=>value!==0).length;
  label('SCENERY',211,142,3.7,'#c1c1c1',650);label(sceneryName(decoded.landscape),305,142,4.1,'#f0f0f0',750,'right');
  label('TRACK PIECES',211,150,3.7,'#c1c1c1',650);label(String(roadCells),305,150,4.1,'#f0f0f0',750,'right');
  label('TERRAIN TILES',211,158,3.7,'#c1c1c1',650);label(String(terrainCells),305,158,4.1,'#f0f0f0',750,'right');
  button(trackButton,'CHANGE TRACK','track',5);

  line(7,196,313,196,'#808283');
  label('STUNTS DX',8,198,3.4,'#c9c9c9',700);
  label('DRIVE · BUILD · REPLAY · CREATE',312,198,3.4,'#c9c9c9',700,'right');
  ctx.restore();
  carSurface.style.display='block';trackSurface.style.display='block';
 };

 const actionAt=(event:{clientX:number;clientY:number}):ModernMainMenuAction=>{
  const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
  if(inside(x,y,driveButton))return 'drive';
  if(inside(x,y,opponentButton))return 'opponent';
  if(inside(x,y,editorButton))return 'editor';
  if(inside(x,y,replaysButton))return 'replays';
  if(inside(x,y,optionsButton))return 'options';
  if(inside(x,y,exitButton))return 'exit';
  if(inside(x,y,carButton))return 'car';
  if(inside(x,y,trackButton))return 'track';
  return 'none';
 };

 const observer=new ResizeObserver(()=>{if(!suspended){syncBounds();trackView?.render();render();}});
 observer.observe(canvas);render();

 return {
  render,
  setFocus(action:ModernMainMenuAction){focus=action;keyboardFocus=action!=='none';render();},
  actionAt,
  hoverAt(event:{clientX:number;clientY:number}){
   keyboardFocus=false;
   const next=actionAt(event);if(next!==hover){hover=next;render();}else if(next==='none')render();
  },
  clearHover(){keyboardFocus=false;if(hover!=='none'){hover='none';render();}},
  nextFocus(direction:1|-1){
   hover='none';keyboardFocus=true;
   if(focus==='none'){focus='drive';render();return focus;}
   const index=Math.max(0,actions.indexOf(focus));focus=actions[(index+direction+actions.length)%actions.length];render();return focus;
  },
  setSuspended(value:boolean){
   suspended=value;
   carSurface.style.display=value?'none':'block';trackSurface.style.display=value?'none':'block';
   if(!value)render();
  },
  close(){if(closed)return;closed=true;observer.disconnect();trackView?.close();trackView=undefined;carShowroom.close();carSurface.remove();trackSurface.remove();canvas.style.background=menuCanvasBackground;canvas.style.zIndex=menuCanvasZIndex;}
 };
}
