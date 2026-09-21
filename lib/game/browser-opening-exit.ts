import {focusBrowserGameCanvas} from './browser-game-focus.ts';
import {originalOpeningExitDialog} from './opening-exit-flow.ts';
import {createBrowserMenuInput} from './browser-menu-input.ts';
import {interactNativeOriginalDialog} from './native-dialog-interaction.ts';
import {drawOriginalDialog} from './dialog-raster.ts';
import {createNativeDisplayDialogRuntime} from './native-display-dialog-runtime.ts';
import {captureNativeDisplayDialogBackground} from './native-display-dialog-background.ts';
import type {createNativeDisplayCommonState} from './native-display-common-state.ts';
import {enhancedMenuEnabled} from './native-options-runtime.ts';
export interface BrowserOpeningDisplay {owner:Awaited<ReturnType<typeof createNativeDisplayCommonState>>;present():void}

async function confirmModernExit(canvas:HTMLCanvasElement,input:ReturnType<typeof createBrowserMenuInput>,background?:HTMLCanvasElement){
 const context=canvas.getContext('2d')!,saved=background??document.createElement('canvas');
 if(!background){saved.width=canvas.width;saved.height=canvas.height;saved.getContext('2d')!.drawImage(canvas,0,0);}
 let selected=0,pointerChoice=-1,pointerActivate=false;
 const sx=()=>canvas.width/320,sy=()=>canvas.height/200,buttons=[{x:103,y:111,w:51,h:19},{x:166,y:111,w:51,h:19}];
 const draw=()=>{
  context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(saved,0,0);context.fillStyle='rgba(0,0,0,.72)';context.fillRect(0,0,canvas.width,canvas.height);
  const rect=(x:number,y:number,w:number,h:number,fill:string,stroke:string,radius=5,lineWidth=1)=>{
   const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
   context.beginPath();context.roundRect(X,Y,W,H,R);context.fillStyle=fill;context.fill();context.strokeStyle=stroke;context.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));context.stroke();
  };
  const label=(value:string,x:number,y:number,size:number,colour:string,weight=600)=>{
   context.fillStyle=colour;context.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;context.textAlign='center';context.textBaseline='middle';context.fillText(value,x*sx(),y*sy());
  };
  rect(84,65,152,72,'#141414','#777',7,1.4);label('EXIT GAME?',160,83,8,'#eee',750);label('Return to desktop?',160,99,4.8,'#888',500);
  buttons.forEach((b,index)=>{const active=index===selected;rect(b.x,b.y,b.w,b.h,active?'#454d28':'#242424',active?'#bdca66':'#555',4,active?1.5:1);label(index?'EXIT':'CANCEL',b.x+b.w/2,b.y+b.h/2,5.4,active?'#fff':'#ccc',650);});
 };
 const choiceAt=(event:{clientX:number;clientY:number})=>{
  const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left)*320/bounds.width,y=(event.clientY-bounds.top)*200/bounds.height;
  return buttons.findIndex(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
 };
 const pointerMove=(event:PointerEvent)=>{
  const index=choiceAt(event);if(index<0||index===selected)return;
  selected=index;draw();
 };
 const pointerDown=(event:PointerEvent)=>{
  const index=choiceAt(event);if(index<0)return;
  event.preventDefault();event.stopImmediatePropagation();selected=index;pointerChoice=index;pointerActivate=true;draw();
 };
 canvas.addEventListener('pointermove',pointerMove,true);canvas.addEventListener('pointerdown',pointerDown,true);draw();
 try{
  for(;;){
   const sample=await input.read();
   if(pointerActivate){pointerActivate=false;return pointerChoice===1?1:0;}
   const key=sample.key;
   if(key===27)return 0;
   if(key===0x4b00||key===0x4d00||key===0x4800||key===0x5000){selected^=1;draw();continue;}
   if(key===13||key===32)return selected===1?1:0;
  }
 }finally{canvas.removeEventListener('pointermove',pointerMove,true);canvas.removeEventListener('pointerdown',pointerDown,true);context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(saved,0,0);}
}
/** Main2D16..2D4E: original exit confirmation after Escape from the opening.
 * The current opening framebuffer remains the background in every display. */
export async function confirmBrowserOpeningExit(canvas:HTMLCanvasElement,signal:AbortSignal,native?:BrowserOpeningDisplay,background?:HTMLCanvasElement){
 const response=await fetch('/game/main-dialog-text.json',{signal});if(!response.ok)throw Error('Original exit prompt could not load');
 const {resources}=await response.json() as {resources:Record<string,number[]>};
 const input=createBrowserMenuInput(canvas,{onPoll(){if(signal.aborted)throw new DOMException('Opening closed','AbortError');}}),close=()=>input.close();signal.addEventListener('abort',close,{once:true});
 try{
  focusBrowserGameCanvas(canvas);
  if(enhancedMenuEnabled())return await confirmModernExit(canvas,input,background);
  if(native){
   const {owner}=native,present=()=>native.present(),m=owner.memory(),v=new DataView(m.buffer,m.byteOffset,m.byteLength);
   const dialogs=createNativeDisplayDialogRuntime({...input,input:input.read,memory:()=>owner.memory(),d:owner.d,mode:owner.mode,drawing:owner.drawing,resources,present,capture:retain=>captureNativeDisplayDialogBackground(owner,retain)},0xe800);
   const answer=await dialogs.dialog(originalOpeningExitDialog.resource,originalOpeningExitDialog.mode,originalOpeningExitDialog.selected,v.getUint16(owner.d+0x4ec2,true));
   return answer;
  }
  const [fontResponse,paletteResponse]=await Promise.all([fetch('/game/fontdef.fnt',{signal}),fetch('/game/track-materials.json',{signal})]);
  if(!fontResponse.ok||!paletteResponse.ok)throw Error('Original exit dialog drawing resources could not load');
  const font=new Uint8Array(await fontResponse.arrayBuffer()),{palette}=await paletteResponse.json() as {palette:number[]},pixels=new Uint8Array(65536);
  const context=canvas.getContext('2d')!,saved=document.createElement('canvas');saved.width=canvas.width;saved.height=canvas.height;saved.getContext('2d')!.drawImage(canvas,0,0);
  const surface=document.createElement('canvas');surface.width=320;surface.height=200;const drawing=surface.getContext('2d')!,image=drawing.createImageData(320,200);
  const restore=()=>{context.setTransform(1,0,0,1,0,0);context.drawImage(saved,0,0);};
  const result=await interactNativeOriginalDialog({font,input:input.read,release:()=>input.release(),gameCounter:()=>input.gameCounter(),restore,draw(selection){
   const {layout}=drawOriginalDialog(pixels,font,resources.edos,selection,{text:15,border:4,disabled:1},undefined,2);
   const [left,right,top,bottom]=layout.bounds;
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const at=y*320+x,c=pixels[at]*3;image.data.set([palette[c],palette[c+1],palette[c+2],255],at*4);}
   drawing.putImageData(image,0,0);restore();context.imageSmoothingEnabled=false;
   context.drawImage(surface,left,top,right-left,bottom-top,left*canvas.width/320,top*canvas.height/200,(right-left)*canvas.width/320,(bottom-top)*canvas.height/200);
  }},resources.edos,originalOpeningExitDialog.mode,originalOpeningExitDialog.selected);
  return result;
 }finally{signal.removeEventListener('abort',close);input.close();}
}
