import {originalHighScoreRow} from './high-score-format.ts';
import type {Assets} from './types.ts';
import type {BlissTrack} from './bliss-track.ts';
import type {NativeMenuTrack} from './native-track-runtime.ts';
import type {BlissEditor3DView} from './bliss-editor-3d.ts';
import type {ModernTrackMenuAction,ModernTrackMenuPresentation} from './modern-track-menu-runtime.ts';

type PreviewFactory=(canvas:HTMLCanvasElement,assets:Assets,track:BlissTrack,options:{initialCamera:{position:[number,number,number];target:[number,number,number];fov:number};transparentBackground:boolean;showGround:boolean})=>BlissEditor3DView;

export type EnhancedTrackMenuPresentation=ModernTrackMenuPresentation&{
 active(active:boolean):void;
 inPreview(event:{clientX:number;clientY:number}):boolean;
 actionAt(event:{clientX:number;clientY:number}):ModernTrackMenuAction;
 scrollDropdown(delta:number):boolean;
 orbit(dx:number,dy:number):void;
 pan(dx:number,dy:number):void;
 dolly(delta:number,x:number,y:number):void;
};

const text=(bytes:ReadonlyArray<number>)=>String.fromCharCode(...bytes).replace(/\0.*$/s,'');
const selector={x:12,y:38,w:174,h:21},importButton={x:191,y:38,w:54,h:21},editButton={x:250,y:38,w:55,h:21},doneButton={x:266,y:10,w:39,h:15};
const previewRect={x:8,y:66,w:218,h:126};
const dropdownRowHeight=15,dropdownRows=8;

export function createEnhancedTrackMenuPresentation(options:{
 canvas:HTMLCanvasElement;
 assets:Assets;
 decodeTrack:(bytes:Uint8Array)=>BlissTrack;
 createPreview:PreviewFactory;
 originalCamera:{position:[number,number,number];target:[number,number,number];fov:number};
 previewEnabled:boolean;
}):EnhancedTrackMenuPresentation{
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 const previewCanvas=document.createElement('canvas');previewCanvas.width=1280;previewCanvas.height=800;
 let preview:BlissEditor3DView|undefined,signature='',track:NativeMenuTrack|undefined,score:ReadonlyArray<number>|null=null,enabled=true;
 let tracks:string[]=[],selectedTrack=0,dropdownOpen=false,dropdownStart=0;

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=5,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=8,colour='#eee',weight=400,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const fit=(value:string,max=23)=>value.length<=max?value:value.slice(0,Math.max(1,max-1))+'…';
 const trackSignature=(value:NativeMenuTrack)=>value.name+'/'+value.raw.length+'/'+value.raw.slice(0,1802).reduce((hash,byte,index)=>(Math.imul(hash^byte,16777619)+index)>>>0,2166136261);
 const ensurePreview=()=>{
  if(!track)throw Error('Modern track menu requires an active track');
  const next=trackSignature(track);
  if(preview&&signature===next)return preview;
  const decoded=options.decodeTrack(Uint8Array.from(track.raw));
  if(!preview)preview=options.createPreview(previewCanvas,options.assets,decoded,{initialCamera:options.originalCamera,transparentBackground:true,showGround:true});
  else{preview.update(decoded);preview.resetView();}
  signature=next;return preview;
 };
 const button=(bounds:{x:number;y:number;w:number;h:number},caption:string,accent=false)=>{
  rect(bounds.x,bounds.y,bounds.w,bounds.h,accent?'#5b6330':'#232323',accent?'#b4c35a':'#555',4);
  label(caption,bounds.x+bounds.w/2,bounds.y+bounds.h/2+.2,7,accent?'#fff':'#e8e8e8',600,'center');
 };
 const updateDropdownStart=()=>{
  if(!tracks.length){dropdownStart=0;return;}
  const maxStart=Math.max(0,tracks.length-dropdownRows);
  dropdownStart=Math.max(0,Math.min(maxStart,selectedTrack-Math.floor(dropdownRows/2)));
 };
 const drawDropdown=()=>{
  const visible=tracks.slice(dropdownStart,dropdownStart+dropdownRows);
  const height=Math.max(1,visible.length)*dropdownRowHeight+4;
  rect(selector.x,selector.y+selector.h+2,selector.w,height,'#111','#666',4);
  visible.forEach((name,row)=>{
   const index=dropdownStart+row,y=selector.y+selector.h+4+row*dropdownRowHeight;
   if(index===selectedTrack)rect(selector.x+2,y-1,selector.w-4,dropdownRowHeight,'#5b6330','#879044',3);
   label(fit(name,24),selector.x+7,y+dropdownRowHeight/2-1,7,index===selectedTrack?'#fff':'#ddd',index===selectedTrack?650:450);
  });
  if(tracks.length>dropdownRows)label(`${selectedTrack+1} / ${tracks.length}`,selector.x+selector.w-6,selector.y+selector.h+height-6,6,'#888',400,'right');
 };

 const render=()=>{
  if(!enabled||!track)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);

  rect(7,6,306,25,'#111','#3b3b3b',6);
  label('TRACK SELECT',15,18.5,10,'#aeb56e',700);
  button(doneButton,'DONE');

  rect(7,34,306,29,'#111','#3b3b3b',6);
  rect(selector.x,selector.y,selector.w,selector.h,'#191919',dropdownOpen?'#b4c35a':'#555',4);
  label(fit(tracks[selectedTrack]??track.name??'UNTITLED',23),selector.x+7,selector.y+selector.h/2,8,'#f2f2f2',600);
  label(dropdownOpen?'▴':'▾',selector.x+selector.w-9,selector.y+selector.h/2,8,'#aaa',700,'center');
  button(importButton,'IMPORT');
  button(editButton,'EDIT');

  rect(7,65,220,128,'#111','#3b3b3b',6);
  ctx.save();ctx.beginPath();ctx.roundRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy(),4*Math.min(sx(),sy()));ctx.clip();
  ctx.fillStyle='#0b0d0a';ctx.fillRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  if(options.previewEnabled){
   const view=ensurePreview();view.render();ctx.drawImage(previewCanvas,previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  }else label('3D PREVIEW DISABLED',previewRect.x+previewRect.w/2,previewRect.y+previewRect.h/2,8,'#777',600,'center');
  ctx.restore();

  rect(232,65,81,128,'#111','#3b3b3b',6);
  label('TRACK INFO',239,77,8,'#aaa',700);
  label('NAME',239,91,6,'#777',600);label(fit(track.name||'UNTITLED',13),239,101,8,'#eee',650);
  if(score&&(score[50]|score[51]<<8)!==65535){
   const row=originalHighScoreRow(score),fields=row.fields.map(text);
   label('HIGH SCORE',239,118,7,'#aaa',700);
   label(fit(fields[0]||'—',13),239,130,7,'#eee',600);
   label(fit(fields[1]||'',13),239,141,6,'#aaa');
   label(fit(fields[2]||'',13),239,151,6,'#aaa');
   label(fields[3]||'',239,164,9,'#d8d66d',700);
  }else{
   label('HIGH SCORE',239,118,7,'#aaa',700);label('No record yet',239,131,6,'#777');
  }
  label('Drag  orbit',239,176,6,'#777');label('R-drag pan',239,184,6,'#777');label('Wheel zoom',239,191,6,'#777');

  if(dropdownOpen)drawDropdown();
  ctx.restore();
 };

 const hit=(x:number,y:number):ModernTrackMenuAction=>{
  const inside=(b:{x:number;y:number;w:number;h:number})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
  if(dropdownOpen){
   const top=selector.y+selector.h+3,bottom=top+Math.min(dropdownRows,tracks.length)*dropdownRowHeight;
   if(x>=selector.x&&x<=selector.x+selector.w&&y>=top&&y<bottom){
    const row=Math.floor((y-top)/dropdownRowHeight),index=dropdownStart+row;
    if(index<tracks.length)return {type:'track',index};
   }
  }
  if(inside(selector))return {type:'selector'};
  if(inside(importButton))return {type:'import'};
  if(inside(editButton))return {type:'edit'};
  if(inside(doneButton))return {type:'done'};
  return {type:'none'};
 };

 return {
  async draw(nextTrack,nextScore){track=nextTrack;score=nextScore;signature='';if(options.previewEnabled)ensurePreview();render();},
  setTracks(names,nextSelected,open){tracks=[...names];selectedTrack=Math.max(0,Math.min(Math.max(0,tracks.length-1),nextSelected));dropdownOpen=open;updateDropdownStart();},
  hit,
  actionAt(event){const r=canvas.getBoundingClientRect();return hit((event.clientX-r.left)*320/r.width,(event.clientY-r.top)*200/r.height);},
  scrollDropdown(delta){
   if(!dropdownOpen||tracks.length<=dropdownRows)return false;
   const maxStart=Math.max(0,tracks.length-dropdownRows),direction=delta>0?1:-1;
   dropdownStart=Math.max(0,Math.min(maxStart,dropdownStart+direction));
   selectedTrack=Math.max(dropdownStart,Math.min(dropdownStart+dropdownRows-1,selectedTrack));
   render();return true;
  },
  render,
  active(active){enabled=active;if(active)render();},
  inPreview(event){
   if(dropdownOpen)return false;
   const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
   return enabled&&options.previewEnabled&&x>=previewRect.x&&x<=previewRect.x+previewRect.w&&y>=previewRect.y&&y<=previewRect.y+previewRect.h;
  },
  orbit(dx,dy){if(options.previewEnabled){ensurePreview().orbit(dx,dy);render();}},
  pan(dx,dy){if(options.previewEnabled){ensurePreview().pan(dx,dy);render();}},
  dolly(delta,x,y){if(options.previewEnabled){ensurePreview().dolly(delta,x,y);render();}},
  close(){preview?.close();preview=undefined;previewCanvas.width=previewCanvas.height=1;}
 };
}
