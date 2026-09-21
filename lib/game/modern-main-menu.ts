import {createModernCarShowroom} from './upgraded-car-menu';
import {createBlissEditor3DView,type BlissEditor3DCameraState} from './bliss-editor-3d';
import {decodeBlissTrack} from './bliss-track';
import {enhancedRenderResolution} from './enhanced-resolution-settings';
import type {Assets} from './types';

export type ModernMainMenuAction='drive'|'car'|'track'|'opponent'|'options'|'exit'|'none';

type TrackState={name:string;path:string;raw:number[]};

const actions:ModernMainMenuAction[]=['drive','opponent','options','exit','car','track'];
const carPreview={x:105,y:66,w:88,h:57};
const trackPreview={x:211,y:66,w:96,h:69};
const driveButton={x:12,y:56,w:72,h:22};
const opponentButton={x:12,y:83,w:72,h:19};
const optionsButton={x:12,y:107,w:72,h:19};
const exitButton={x:12,y:131,w:72,h:19};
const carButton={x:108,y:164,w:81,h:18};
const trackButton={x:215,y:164,w:88,h:18};

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
   ['background','#071018'],['z-index','1'],['border-radius','1px'],
  ] as const)surface.style.setProperty(property,value,'important');
  parent.insertBefore(surface,canvas);
 };
 mount(carSurface,'modern-main-car-preview');
 mount(trackSurface,'modern-main-track-preview');

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#27455c',radius=2,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(1,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const line=(x1:number,y1:number,x2:number,y2:number,colour:string,width=1)=>{
  ctx.beginPath();ctx.moveTo(x1*sx(),y1*sy());ctx.lineTo(x2*sx(),y2*sy());ctx.strokeStyle=colour;ctx.lineWidth=Math.max(1,width*Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=7,colour='#e8edf0',weight=600,align:CanvasTextAlign='left',italic=false)=>{
  ctx.fillStyle=colour;ctx.font=`${italic?'italic ':''}${weight} ${Math.max(9,size*sy())}px \"Arial Narrow\",\"Segoe UI\",sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const fit=(value:string,max:number)=>value.length<=max?value:value.slice(0,Math.max(1,max-1))+'…';
 const inside=(x:number,y:number,b:{x:number;y:number;w:number;h:number})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
 const activeAction=()=>hover!=='none'?hover:(keyboardFocus?focus:'none');
 const active=(action:ModernMainMenuAction)=>activeAction()===action;
 const button=(bounds:{x:number;y:number;w:number;h:number},caption:string,action:ModernMainMenuAction,size=6.4)=>{
  const selected=active(action);
  rect(bounds.x,bounds.y,bounds.w,bounds.h,selected?'#f5dc32':'#102638',selected?'#fff2a3':'#3d6986',2,selected?1.4:1);
  if(!selected){
   ctx.fillStyle='#17435f';ctx.fillRect(bounds.x*sx(),bounds.y*sy(),2*sx(),bounds.h*sy());
  }
  label(caption,bounds.x+7,bounds.y+bounds.h/2+.3,size,selected?'#08121a':'#e7edf1',800,'left',true);
  label('›',bounds.x+bounds.w-7,bounds.y+bounds.h/2,size+2,selected?'#08121a':'#68b7df',800,'center');
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

 const checker=(x:number,y:number,size=4,cols=5,rows=2)=>{
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)if((row+col)&1){
   ctx.fillStyle='#57bee8';ctx.fillRect((x+col*size)*sx(),(y+row*size)*sy(),size*sx(),size*sy());
  }
 };
 const stuntMotif=()=>{
  ctx.save();
  ctx.globalAlpha=.18;ctx.strokeStyle='#54b8df';ctx.lineWidth=Math.max(1,1.1*Math.min(sx(),sy()));
  ctx.beginPath();ctx.moveTo(190*sx(),28*sy());ctx.lineTo(210*sx(),28*sy());ctx.quadraticCurveTo(221*sx(),5*sy(),232*sx(),28*sy());ctx.lineTo(248*sx(),28*sy());
  ctx.arc(263*sx(),28*sy(),12*Math.min(sx(),sy()),Math.PI,Math.PI*3,false);ctx.stroke();
  ctx.restore();
 };

 const render=()=>{
  if(closed||suspended)return;
  syncBounds();
  const car=renderCar(),decoded=renderTrack();
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);

  const background=ctx.createLinearGradient(0,0,0,canvas.height);
  background.addColorStop(0,'#081724');background.addColorStop(1,'#050b11');ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0d2537';ctx.fillRect(0,0,canvas.width,37*sy());
  line(0,37,320,37,'#3b91bd',1);
  stuntMotif();

  // Original-inspired STUNTS DX wordmark: bold italic block lettering, cyan
  // shadow and checker detail instead of the previous plain system heading.
  label('STUNTS',14,18,16,'#66c9ef',900,'left',true);
  label('STUNTS',12.7,16.7,16,'#f1f2ee',900,'left',true);
  label('DX',78,17,14,'#61d3ef',900,'left',true);
  checker(111,10,4,6,2);
  label('DRIVE  •  BUILD  •  JUMP  •  REPEAT',151,13,4.2,'#8ab5cd',700);
  label('A MODERN REMASTER OF A CLASSIC',151,23,4,'#597c92',650);

  rect(7,44,82,148,'#0a1721','#2d536b',3);
  label('MAIN MENU',13,50,5.3,'#71bfe3',800);
  button(driveButton,'RACE','drive',7.5);
  button(opponentButton,'OPPONENT','opponent',6.1);
  button(optionsButton,'OPTIONS','options',6.4);
  button(exitButton,'EXIT','exit',6.4);
  line(13,157,82,157,'#244459');
  label('MOUSE OR D-PAD',13,164,4.1,'#6e8fa4',650);
  label('ENTER  SELECT',13,173,4.1,'#b7c8d2',650);
  label('ESC  EXIT',13,181,4.1,'#b7c8d2',650);
  checker(63,183,3,6,2);

  rect(94,44,104,148,'#0a1721','#2d536b',3);
  label('CURRENT CAR',101,51,5.2,'#b9d7e7',800);
  label(fit(car.name??car.id,14),191,51,5.2,'#f0dd61',800,'right',true);
  ctx.clearRect(carPreview.x*sx(),carPreview.y*sy(),carPreview.w*sx(),carPreview.h*sy());
  line(101,130,191,130,'#223e50');
  label(car.id,101,137,4.5,'#6fb5d6',750);
  label(`${car.gears??'?'} GEARS`,101,146,4,'#a9bbc5',600);
  label(`${car.mass??'?'} KG`,191,146,4,'#a9bbc5',600,'right');
  label(`${car.maxRPM??'?'} RPM`,101,154,4,'#a9bbc5',600);
  button(carButton,'CHANGE CAR','car',5.3);

  rect(203,44,110,148,'#0a1721','#2d536b',3);
  label('SELECTED TRACK',210,51,5.2,'#b9d7e7',800);
  label(fit(options.track.name||'UNTITLED',15),306,51,5.2,'#f0dd61',800,'right',true);
  ctx.clearRect(trackPreview.x*sx(),trackPreview.y*sy(),trackPreview.w*sx(),trackPreview.h*sy());
  line(210,140,306,140,'#223e50');
  label('SCENERY',210,146,3.8,'#6e8fa4',700);
  label(sceneryName(decoded.landscape),306,146,4.2,'#d9e3e8',700,'right');
  label('FORMAT',210,154,3.8,'#6e8fa4',700);
  label(String(decoded.format),306,154,4.2,'#d9e3e8',700,'right');
  button(trackButton,'CHANGE TRACK','track',5.1);

  line(7,196,313,196,'#22475e');
  label('STUNTS DX',8,198,3.5,'#4d87a5',700);
  label('SAME ROADS. BIGGER POSSIBILITIES.',312,198,3.5,'#4d87a5',700,'right');
  ctx.restore();
  carSurface.style.display='block';trackSurface.style.display='block';
 };

 const actionAt=(event:{clientX:number;clientY:number}):ModernMainMenuAction=>{
  const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
  if(inside(x,y,driveButton))return 'drive';
  if(inside(x,y,opponentButton))return 'opponent';
  if(inside(x,y,optionsButton))return 'options';
  if(inside(x,y,exitButton))return 'exit';
  // Only the actual buttons are interactive. Entering a preview card must not
  // light up CHANGE CAR / CHANGE TRACK.
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
