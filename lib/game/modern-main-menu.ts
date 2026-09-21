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
let cachedModernMainBackground:HTMLImageElement|undefined;
let cachedModernMainBackgroundPromise:Promise<HTMLImageElement>|undefined;
export function preloadModernMainMenuBackground(){
 if(cachedModernMainBackground)return Promise.resolve(cachedModernMainBackground);
 if(cachedModernMainBackgroundPromise)return cachedModernMainBackgroundPromise;
 cachedModernMainBackgroundPromise=new Promise((resolve,reject)=>{
  const image=new Image();image.decoding='async';
  image.onload=()=>{cachedModernMainBackground=image;resolve(image);};
  image.onerror=()=>{cachedModernMainBackgroundPromise=undefined;reject(new Error('Modern main menu background failed to load'));};
  image.src='/ui/stunts-dx-main-background.webp';
 });
 return cachedModernMainBackgroundPromise;
}
export function drawModernMainMenuBackground(canvas:HTMLCanvasElement,image:HTMLImageElement){
 const context=canvas.getContext('2d')!;
 const sourceRatio=image.naturalWidth/image.naturalHeight,targetRatio=canvas.width/canvas.height;
 let sw=image.naturalWidth,sh=image.naturalHeight,sx=0,sy=0;
 if(sourceRatio>targetRatio){sw=sh*targetRatio;sx=(image.naturalWidth-sw)/2;}
 else if(sourceRatio<targetRatio){sh=sw/targetRatio;sy=(image.naturalHeight-sh)/2;}
 context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 context.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
}

export function createModernMainMenu(options:{
 canvas:HTMLCanvasElement;
 assets:Assets;
 configuration:number[];
 track:TrackState;
 palette:number[];
 materialIndices:number[];
 backgroundArt?:HTMLImageElement;
}){
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 const menuCanvasBackground=canvas.style.background,menuCanvasZIndex=canvas.style.zIndex;
 canvas.style.background='transparent';canvas.style.zIndex='2';

 const carShowroom=createModernCarShowroom(options.palette,options.materialIndices);
 const carSurface=carShowroom.canvas;
 const trackSurface=document.createElement('canvas');
 let trackView:ReturnType<typeof createBlissEditor3DView>|undefined;
 let trackSignature='';
 const backgroundArt=options.backgroundArt??cachedModernMainBackground;
 let backgroundArtReady=!!backgroundArt?.complete&&!!backgroundArt.naturalWidth;
 let closed=false,suspended=false,focus:ModernMainMenuAction='none',hover:ModernMainMenuAction='none',keyboardFocus=false,carAngle=80,lastCarFrame=performance.now(),animationFrame=0;
 if(!backgroundArtReady&&!options.backgroundArt){
  void preloadModernMainMenuBackground().then(image=>{if(closed)return;cachedModernMainBackground=image;backgroundArtReady=true;render();}).catch(()=>{});
 }

 const mount=(surface:HTMLCanvasElement,kind:string)=>{
  const parent=canvas.parentElement;if(!parent)return;
  surface.classList.add(kind);surface.setAttribute('aria-hidden','true');
  for(const [property,value] of [
   ['position','absolute'],['pointer-events','none'],['display','block'],['transform','none'],
   ['max-width','none'],['max-height','none'],['margin','0'],['padding','0'],['border','0'],
   ['background','#101b25'],['z-index','1'],['border-radius','2px'],
  ] as const)surface.style.setProperty(property,value,'important');
  parent.insertBefore(surface,canvas);
 };
 mount(carSurface,'modern-main-car-preview');
 mount(trackSurface,'modern-main-track-preview');

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=3,lineWidth=1)=>{
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
  const c=selected?'#fff':'#d8d8d8',s=Math.min(sx(),sy()),X=x*sx(),Y=y*sy(),u=sy();
  ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=Math.max(1.2*s,1);ctx.lineCap='round';ctx.lineJoin='round';
  if(action==='drive'){
   // Proper little checkered flag, matching the reference menu language.
   ctx.beginPath();ctx.moveTo(X-4.3*u,Y+4*u);ctx.lineTo(X-2.8*u,Y-4*u);ctx.stroke();
   const cell=1.7*u;for(let r=0;r<3;r++)for(let col=0;col<4;col++)if((r+col)%2===0)ctx.fillRect(X-2.7*u+col*cell,Y-4*u+r*cell,cell,cell);
  }else if(action==='opponent'){
   // Helmet silhouette.
   ctx.beginPath();ctx.arc(X-1*u,Y,4.1*u,Math.PI*.9,Math.PI*1.95);ctx.lineTo(X+3.6*u,Y+1.2*u);ctx.lineTo(X+.5*u,Y+1.2*u);ctx.lineTo(X-.5*u,Y+4*u);ctx.lineTo(X-4*u,Y+4*u);ctx.closePath();ctx.fill();
   ctx.fillStyle=selected?'#d6d36b':'#27313a';ctx.fillRect(X-.3*u,Y-1.3*u,3.6*u,1.35*u);
  }else if(action==='editor'){
   // Stunts ramp/loop style editor mark.
   ctx.beginPath();ctx.moveTo(X-4.6*u,Y+3.4*u);ctx.lineTo(X+2.8*u,Y-4*u);ctx.lineTo(X+2.8*u,Y+3.4*u);ctx.closePath();ctx.stroke();
   ctx.beginPath();ctx.moveTo(X-.8*u,Y+2.5*u);ctx.lineTo(X+2*u,Y-.3*u);ctx.stroke();
  }else if(action==='replays'){
   ctx.beginPath();ctx.arc(X,Y,4.2*u,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(X-1.1*u,Y-2.3*u);ctx.lineTo(X+2.7*u,Y);ctx.lineTo(X-1.1*u,Y+2.3*u);ctx.closePath();ctx.fill();
  }else if(action==='options'){
   ctx.save();ctx.translate(X,Y);for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.fillRect(-.9*u,-4.9*u,1.8*u,2*u);}ctx.beginPath();ctx.arc(0,0,3.5*u,0,Math.PI*2);ctx.fill();ctx.fillStyle=selected?'#d6d36b':'#27313a';ctx.beginPath();ctx.arc(0,0,1.3*u,0,Math.PI*2);ctx.fill();ctx.restore();
  }else if(action==='exit'){
   ctx.strokeRect(X-3.9*u,Y-4*u,5*u,8*u);ctx.beginPath();ctx.moveTo(X-1*u,Y);ctx.lineTo(X+4.4*u,Y);ctx.moveTo(X+2.2*u,Y-2.1*u);ctx.lineTo(X+4.4*u,Y);ctx.lineTo(X+2.2*u,Y+2.1*u);ctx.stroke();
   ctx.beginPath();ctx.moveTo(X-3.9*u,Y-4*u);ctx.lineTo(X-5*u,Y-3*u);ctx.lineTo(X-5*u,Y+3*u);ctx.lineTo(X-3.9*u,Y+4*u);ctx.closePath();ctx.fill();
  }else if(action==='car'){
   ctx.beginPath();ctx.moveTo(X-4.7*u,Y+1.2*u);ctx.lineTo(X-3*u,Y-1.7*u);ctx.lineTo(X+1.9*u,Y-2.4*u);ctx.lineTo(X+4.5*u,Y+1.2*u);ctx.closePath();ctx.fill();ctx.fillStyle=selected?'#d6d36b':'#27313a';ctx.beginPath();ctx.arc(X-2.8*u,Y+2.4*u,1.25*u,0,Math.PI*2);ctx.arc(X+2.7*u,Y+2.4*u,1.25*u,0,Math.PI*2);ctx.fill();
  }else if(action==='track'){
   ctx.beginPath();ctx.moveTo(X-4.7*u,Y+3.8*u);ctx.lineTo(X-1*u,Y-4*u);ctx.lineTo(X+1.9*u,Y+1.6*u);ctx.lineTo(X+4.6*u,Y-2.8*u);ctx.stroke();
  }
  ctx.restore();
 };
 const button=(bounds:Bounds,caption:string,action:ModernMainMenuAction,size=6.1)=>{
  const selected=active(action);
  rect(bounds.x,bounds.y,bounds.w,bounds.h,selected?'#454d28':'#232323',selected?'#bdca66':'#555',3,selected?1.45:1);
  line(bounds.x+2,bounds.y+1,bounds.x+bounds.w-1,bounds.y+1,selected?'#d8e27e':'#555',.45);
  icon(action,bounds.x+8,bounds.y+bounds.h/2,selected);
  label(caption,bounds.x+15,bounds.y+bounds.h/2+.2,size,selected?'#fff':'#eee',850,'left',true);
  label('›',bounds.x+bounds.w-6,bounds.y+bounds.h/2,size+1.5,selected?'#fff':'#aaa',850,'center');
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
   carShowroom.draw(shape,raceShape,Math.max(0,options.configuration[4]??0),Math.max(1,Math.round(carPreview.w*scale)),Math.max(1,Math.round(carPreview.h*scale)),{angle:carAngle,pitch:0,zoom:1.28});
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

  if(backgroundArtReady&&backgroundArt){
   ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   const sourceRatio=backgroundArt.naturalWidth/backgroundArt.naturalHeight,targetRatio=canvas.width/canvas.height;
   let sw=backgroundArt.naturalWidth,sh=backgroundArt.naturalHeight,sx0=0,sy0=0;
   if(sourceRatio>targetRatio){sw=sh*targetRatio;sx0=(backgroundArt.naturalWidth-sw)/2;}
   else if(sourceRatio<targetRatio){sh=sw/targetRatio;sy0=(backgroundArt.naturalHeight-sh)/2;}
   ctx.drawImage(backgroundArt,sx0,sy0,sw,sh,0,0,canvas.width,canvas.height);
   // Darken the lower UI field just enough for the panels to read while
   // leaving the loop, car and checker artwork visible around them.
   const shade=ctx.createLinearGradient(0,38*sy(),0,canvas.height);
   shade.addColorStop(0,'rgba(14,17,19,.06)');
   shade.addColorStop(.38,'rgba(14,17,19,.28)');
   shade.addColorStop(1,'rgba(9,11,12,.58)');
   ctx.fillStyle=shade;ctx.fillRect(0,38*sy(),canvas.width,canvas.height-38*sy());
   ctx.restore();
  }else{
   const background=ctx.createLinearGradient(0,0,0,canvas.height);
   background.addColorStop(0,'#31363a');background.addColorStop(.28,'#272c30');background.addColorStop(1,'#171b1e');
   ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
   checkerFlag(250,47,.72,false,.075);checkerFlag(32,150,.68,true,.055);
   ctx.fillStyle='rgba(255,255,255,.018)';for(let y=45;y<200;y+=7)ctx.fillRect(0,y*sy(),canvas.width,sy());
   label('STUNTS DX',13,20,15,'#e2d52f',900,'left',true);
  }
  line(0,43,320,43,'rgba(160,176,187,.82)',1);

  rect(7,45,82,148,'rgba(17,17,17,.90)','#3b3b3b',4);
  label('MAIN MENU',13,50,5.2,'#aaa',800);
  button(driveButton,'RACE','drive',6.8);
  button(opponentButton,'OPPONENT','opponent',5.5);
  button(editorButton,'TRACK EDITOR','editor',5.1);
  button(replaysButton,'REPLAYS','replays',5.7);
  button(optionsButton,'OPTIONS','options',5.8);
  button(exitButton,'EXIT','exit',5.9);
  label('ENTER  SELECT',13,179,3.8,'#d0d0d0',650);
  label('ESC  EXIT',13,186,3.8,'#c0c0c0',650);

  rect(94,45,105,148,'rgba(17,17,17,.90)','#3b3b3b',4);
  label('CURRENT CAR',101,50,5.1,'#aaa',800);
  fitToWidth(car.name??car.id,101,59,91,6.4,'#d8d66d',800,true);
  ctx.clearRect(carPreview.x*sx(),carPreview.y*sy(),carPreview.w*sx(),carPreview.h*sy());
  line(101,132,193,132,'#565656',1.2);
  label('GEARS',101,139,3.7,'#777',600);label(String(car.gears??'?'),193,139,4.1,'#ddd',600,'right');
  label('WEIGHT',101,146,3.7,'#777',600);label(`${car.mass??'?'} KG`,193,146,4.1,'#ddd',600,'right');
  label('MAX RPM',101,153,3.7,'#777',600);label(String(car.maxRPM??'?'),193,153,4.1,'#ddd',600,'right');
  label('IDLE RPM',101,160,3.7,'#777',600);label(String(car.idleRPM??'?'),193,160,4.1,'#ddd',600,'right');
  button(carButton,'CHANGE CAR','car',5.1);

  rect(204,45,109,148,'rgba(17,17,17,.90)','#3b3b3b',4);
  label('SELECTED TRACK',211,50,5.1,'#aaa',800);
  fitToWidth(options.track.name||'UNTITLED',211,59,94,6.4,'#d8d66d',800,true);
  ctx.clearRect(trackPreview.x*sx(),trackPreview.y*sy(),trackPreview.w*sx(),trackPreview.h*sy());
  line(211,132,305,132,'#565656',1.2);
  const roadCells=Array.from(decoded.track).filter(value=>value!==0).length;
  const terrainCells=Array.from(decoded.terrain).filter(value=>value!==0).length;
  label('SCENERY',211,142,3.7,'#777',600);label(sceneryName(decoded.landscape),305,142,4.1,'#ddd',600,'right');
  label('TRACK PIECES',211,150,3.7,'#777',600);label(String(roadCells),305,150,4.1,'#ddd',600,'right');
  label('TERRAIN TILES',211,158,3.7,'#777',600);label(String(terrainCells),305,158,4.1,'#ddd',600,'right');
  button(trackButton,'CHANGE TRACK','track',5);

  line(7,196,313,196,'#3b3b3b');
  label('STUNTS DX',8,198,3.4,'#777',600);
  label('SAME ROADS. BIGGER POSSIBILITIES.',312,198,3.4,'#777',600,'right');
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

 const captureBackground=()=>{
  const shot=document.createElement('canvas');shot.width=canvas.width;shot.height=canvas.height;
  const out=shot.getContext('2d')!;out.drawImage(canvas,0,0);
  out.drawImage(carSurface,carPreview.x*sx(),carPreview.y*sy(),carPreview.w*sx(),carPreview.h*sy());
  out.drawImage(trackSurface,trackPreview.x*sx(),trackPreview.y*sy(),trackPreview.w*sx(),trackPreview.h*sy());
  return shot;
 };
 const animateCar=(now:number)=>{
  if(closed)return;
  const delta=Math.min(100,Math.max(0,now-lastCarFrame));lastCarFrame=now;
  if(!suspended){carAngle=(carAngle+delta*.04)%1024;renderCar();}
  animationFrame=requestAnimationFrame(animateCar);
 };
 animationFrame=requestAnimationFrame(animateCar);
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
  captureBackground,
  setSuspended(value:boolean){
   suspended=value;
   carSurface.style.display=value?'none':'block';trackSurface.style.display=value?'none':'block';
   if(!value)render();
  },
  close(){if(closed)return;closed=true;cancelAnimationFrame(animationFrame);observer.disconnect();trackView?.close();trackView=undefined;carShowroom.close();carSurface.remove();trackSurface.remove();canvas.style.background=menuCanvasBackground;canvas.style.zIndex=menuCanvasZIndex;}
 };
}
