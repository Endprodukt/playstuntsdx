import {originalHighScoreRow} from './high-score-format.ts';
import type {Assets} from './types.ts';
import type {NativeTrackMenuPresentation,NativeMenuTrack} from './native-track-runtime.ts';
import type {BlissEditor3DView} from './bliss-editor-3d.ts';

type PreviewFactory=(canvas:HTMLCanvasElement,assets:Assets,track:ReturnType<typeof import('./bliss-track.ts')['decodeBlissTrack']>,options:{initialCamera:{position:[number,number,number];target:[number,number,number];fov:number};transparentBackground:boolean;showGround:boolean})=>BlissEditor3DView;

export type EnhancedTrackMenuPresentation=NativeTrackMenuPresentation&{
 render():void;
 active(active:boolean):void;
 inPreview(event:{clientX:number;clientY:number}):boolean;
 orbit(dx:number,dy:number):void;
 pan(dx:number,dy:number):void;
 dolly(delta:number,x:number,y:number):void;
 close():void;
};

const text=(bytes:ReadonlyArray<number>)=>String.fromCharCode(...bytes).replace(/\0.*$/s,'');

export function createEnhancedTrackMenuPresentation(options:{
 canvas:HTMLCanvasElement;
 assets:Assets;
 decodeTrack:(bytes:Uint8Array)=>ReturnType<typeof import('./bliss-track.ts')['decodeBlissTrack']>;
 createPreview:PreviewFactory;
 originalCamera:{position:[number,number,number];target:[number,number,number];fov:number};
 file:NativeTrackMenuPresentation['file'];
}):EnhancedTrackMenuPresentation{
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 const previewCanvas=document.createElement('canvas');previewCanvas.width=1280;previewCanvas.height=800;
 let preview:BlissEditor3DView|undefined,signature='',track:NativeMenuTrack|undefined,score:ReadonlyArray<number>|null=null,selection=0,enabled=true;

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=6)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=10,colour='#eee',weight=400,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const trackSignature=(value:NativeMenuTrack)=>value.name+'/'+value.raw.length+'/'+value.raw.slice(0,1802).reduce((hash,byte,index)=>(Math.imul(hash^byte,16777619)+index)>>>0,2166136261);
 const ensurePreview=()=>{
  if(!track)throw Error('Enhanced track menu requires an active track');
  const next=trackSignature(track);
  if(preview&&signature===next)return preview;
  const decoded=options.decodeTrack(Uint8Array.from(track.raw));
  if(!preview)preview=options.createPreview(previewCanvas,options.assets,decoded,{initialCamera:options.originalCamera,transparentBackground:true,showGround:false});
  else{preview.update(decoded);preview.resetView();}
  signature=next;return preview;
 };
 const drawButton=(index:number,x:number,labelText:string)=>{
  const selected=index===selection;
  rect(x,171,96,26,selected?'#5b6330':'#232323',selected?'#b4c35a':'#555',4);
  label(labelText,x+48,184,10,selected?'#fff':'#e5e5e5',600,'center');
 };
 const render=()=>{
  if(!enabled||!track)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);
  rect(7,6,306,25,'#111');
  label('TRACK SELECT',16,18.5,10,'#aeb56e',700);
  label(track.name||'UNTITLED',304,18.5,12,'#fff',700,'right');

  rect(7,36,213,128,'#111');
  const view=ensurePreview();view.render();
  ctx.save();ctx.beginPath();ctx.roundRect(11*sx(),40*sy(),205*sx(),120*sy(),4*Math.min(sx(),sy()));ctx.clip();
  ctx.fillStyle='#0a0a0a';ctx.fillRect(11*sx(),40*sy(),205*sx(),120*sy());
  ctx.drawImage(previewCanvas,11*sx(),40*sy(),205*sx(),120*sy());ctx.restore();

  rect(225,36,88,128,'#111');
  label('TRACK INFO',232,47,9,'#aaa',700);
  label('Name',232,61,8,'#888');label(track.name||'UNTITLED',232,71,9,'#eee',600);
  if(score&&(score[50]|score[51]<<8)!==65535){
   const row=originalHighScoreRow(score),fields=row.fields.map(text);
   label('HIGH SCORE',232,90,9,'#aaa',700);
   label(fields[0]||'—',232,102,8,'#eee',600);
   label(fields[1]||'',232,113,8,'#bbb');
   label(fields[2]||'',232,124,8,'#bbb');
   label(fields[3]||'',232,137,10,'#d8d66d',700);
  }else{
   label('HIGH SCORE',232,90,9,'#aaa',700);label('No record yet',232,103,8,'#777');
  }
  label('Drag: orbit',232,145,7,'#777');label('Right drag: pan',232,153,7,'#777');label('Wheel: zoom',232,160,7,'#777');

  drawButton(0,16,'LOAD TRACK');drawButton(1,112,'EDIT TRACK');drawButton(2,208,'DONE');
  ctx.restore();
 };

 return {
  file:options.file,
  async draw(nextTrack,nextScore){track=nextTrack;score=nextScore;signature='';ensurePreview();render();},
  capture(){return {restore:render,close(){}};},
  outline(nextSelection){selection=Math.max(0,Math.min(2,nextSelection));render();},
  render,
  active(active){enabled=active;if(active)render();},
  inPreview(event){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;return enabled&&x>=11&&x<=216&&y>=40&&y<=160;},
  orbit(dx,dy){ensurePreview().orbit(dx,dy);render();},
  pan(dx,dy){ensurePreview().pan(dx,dy);render();},
  dolly(delta,x,y){ensurePreview().dolly(delta,x,y);render();},
  close(){preview?.close();preview=undefined;previewCanvas.width=previewCanvas.height=1;}
 };
}
