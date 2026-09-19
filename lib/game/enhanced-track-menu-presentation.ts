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
 wheelAction(delta:number):ModernTrackMenuAction|undefined;
 orbit(dx:number,dy:number):void;
 pan(dx:number,dy:number):void;
 dolly(delta:number,x:number,y:number):void;
 hoverAt(event:{clientX:number;clientY:number}):void;
 clearHover():void;
};

const text=(bytes:ReadonlyArray<number>)=>String.fromCharCode(...bytes).replace(/\0.*$/s,'');
const selector={x:105,y:10,w:101,h:22},importButton={x:210,y:10,w:46,h:22},editButton={x:260,y:10,w:45,h:22},doneButton={x:232,y:174,w:81,h:23};
const previewRect={x:8,y:45,w:218,h:147};
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
 let tracks:string[]=[],selectedTrack=0,dropdownOpen=false,dropdownStart=0,hoverAction:ModernTrackMenuAction={type:'none'};

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
 const hovered=(type:ModernTrackMenuAction['type'])=>hoverAction.type===type;
 const button=(bounds:{x:number;y:number;w:number;h:number},caption:string,type:ModernTrackMenuAction['type'])=>{
  const over=hovered(type);
  rect(bounds.x,bounds.y,bounds.w,bounds.h,over?'#5b6330':'#232323',over?'#b4c35a':'#555',4,over?1.5:1);
  label(caption,bounds.x+bounds.w/2,bounds.y+bounds.h/2+.2,7,over?'#fff':'#e8e8e8',600,'center');
 };
 const mouseIcon=(x:number,y:number,kind:'left'|'right'|'wheel',scale=.52)=>{
  const X=x*sx(),Y=y*sy(),S=Math.min(sx(),sy())*scale;
  ctx.save();ctx.translate(X,Y);ctx.scale(S,S);
  ctx.lineWidth=1.5;ctx.strokeStyle='#b8b8b8';ctx.fillStyle='#b8b8b8';ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();ctx.roundRect(-7,-9,14,18,6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-7,-2);ctx.lineTo(7,-2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(0,-2);ctx.stroke();
  if(kind==='left'){ctx.beginPath();ctx.roundRect(-6.1,-8.1,5.3,5.2,2);ctx.fill();}
  else if(kind==='right'){ctx.beginPath();ctx.roundRect(.8,-8.1,5.3,5.2,2);ctx.fill();}
  else{ctx.beginPath();ctx.roundRect(-1.35,-7.6,2.7,4.4,1.3);ctx.fill();}
  ctx.restore();
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
   const over=hoverAction.type==='track'&&hoverAction.index===index;
   if(index===selectedTrack||over)rect(selector.x+2,y-1,selector.w-4,dropdownRowHeight,over?'#646d34':'#5b6330',over?'#c1d064':'#879044',3,over?1.5:1);
   label(fit(name,24),selector.x+7,y+dropdownRowHeight/2-1,7,index===selectedTrack||over?'#fff':'#ddd',index===selectedTrack||over?650:450);
  });
  if(tracks.length>dropdownRows)label(`${selectedTrack+1} / ${tracks.length}`,selector.x+selector.w-6,selector.y+selector.h+height-6,6,'#888',400,'right');
 };

 const render=()=>{
  if(!enabled||!track)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);

  rect(7,6,306,30,'#111','#3b3b3b',6);
  label('TRACK SELECT',15,21,9,'#aeb56e',700);

  rect(selector.x,selector.y,selector.w,selector.h,hovered('selector')?'#2f341c':'#191919',dropdownOpen||hovered('selector')?'#b4c35a':'#555',4,dropdownOpen||hovered('selector')?1.5:1);
  label(fit(tracks[selectedTrack]??track.name??'UNTITLED',13),selector.x+6,selector.y+selector.h/2,7,'#f2f2f2',600);
  label(dropdownOpen?'▴':'▾',selector.x+selector.w-9,selector.y+selector.h/2,8,'#aaa',700,'center');
  button(importButton,'IMPORT','import');
  button(editButton,'EDIT','edit');

  rect(7,44,220,153,'#111','#3b3b3b',6);
  ctx.save();ctx.beginPath();ctx.roundRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy(),4*Math.min(sx(),sy()));ctx.clip();
  ctx.fillStyle='#0b0d0a';ctx.fillRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  if(options.previewEnabled){
   const view=ensurePreview();view.render();ctx.drawImage(previewCanvas,previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  }else label('3D PREVIEW DISABLED',previewRect.x+previewRect.w/2,previewRect.y+previewRect.h/2,8,'#777',600,'center');
  ctx.restore();

  rect(232,44,81,126,'#111','#3b3b3b',6);
  label('TRACK INFO',239,56,8,'#aaa',700);
  label('NAME',239,70,6,'#777',600);label(fit(track.name||'UNTITLED',13),239,80,8,'#eee',650);
  if(score&&(score[50]|score[51]<<8)!==65535){
   const row=originalHighScoreRow(score),fields=row.fields.map(text);
   label('HIGH SCORE',239,96,7,'#aaa',700);
   label(fit(fields[0]||'—',13),239,108,7,'#eee',600);
   label(fit(fields[1]||'',13),239,119,6,'#aaa');
   label(fit(fields[2]||'',13),239,129,6,'#aaa');
   label(fields[3]||'',239,141,8,'#d8d66d',700);
  }else{
   label('HIGH SCORE',239,96,7,'#aaa',700);label('No record yet',239,108,6,'#777');
  }
  // Preview controls belong to the 3D viewport, not Track Info.
  rect(previewRect.x+4,previewRect.y+previewRect.h-14,previewRect.w-8,10,'rgba(8,8,8,.68)','rgba(90,90,90,.5)',3,.5);
  const controlsY=previewRect.y+previewRect.h-9;
  mouseIcon(previewRect.x+22,controlsY,'left');
  label('Orbit',previewRect.x+29,controlsY,3.8,'#b7b7b7',500);
  mouseIcon(previewRect.x+78,controlsY,'right');
  label('Pan',previewRect.x+85,controlsY,3.8,'#b7b7b7',500);
  mouseIcon(previewRect.x+128,controlsY,'wheel');
  label('Zoom',previewRect.x+135,controlsY,3.8,'#b7b7b7',500);
  button(doneButton,'DONE','done');

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
  hoverAt(event){
   const next=this.actionAt(event);
   const changed=JSON.stringify(next)!==JSON.stringify(hoverAction);
   hoverAction=next;if(changed)render();
  },
  clearHover(){if(hoverAction.type!=='none'){hoverAction={type:'none'};render();}},
  scrollDropdown(delta){
   if(!dropdownOpen||tracks.length<=dropdownRows)return false;
   const maxStart=Math.max(0,tracks.length-dropdownRows),direction=delta>0?1:-1;
   dropdownStart=Math.max(0,Math.min(maxStart,dropdownStart+direction));
   selectedTrack=Math.max(dropdownStart,Math.min(dropdownStart+dropdownRows-1,selectedTrack));
   render();return true;
  },
  wheelAction(delta){
   if(dropdownOpen||hoverAction.type!=='selector'||!tracks.length)return undefined;
   const direction=delta>0?1:-1;
   return {type:'track',index:(selectedTrack+direction+tracks.length)%tracks.length};
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
