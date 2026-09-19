import type {NativeMenuCar} from './native-car-runtime.ts';
import {originalCarAccelerationGraph} from './car-menu-raster.ts';
import type {ModernCarMenuAction,ModernCarMenuPresentation} from './modern-car-menu-runtime.ts';

const selector={x:86,y:10,w:166,h:22},importButton={x:257,y:10,w:48,h:22},doneButton={x:232,y:174,w:81,h:23};
const transmissionButton={x:232,y:137,w:81,h:16},colourButton={x:232,y:155,w:81,h:16};
const previewRect={x:8,y:45,w:218,h:92},infoRect={x:232,y:44,w:81,h:89};
const graphRect={x:8,y:143,w:72,h:49},descriptionRect={x:85,y:143,w:140,h:49};
const dropdownRowHeight=15,dropdownRows=8;

export function createEnhancedCarMenuPresentation(options:{
 canvas:HTMLCanvasElement;
 palette:number[];
 preview:(car:NativeMenuCar,paint:number)=>Promise<{canvas:HTMLCanvasElement;paintCount:number;render(angle:number):void}|null>;
}):ModernCarMenuPresentation{
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 let cars:readonly NativeMenuCar[]=[],selected=0,dropdownOpen=false,dropdownStart=0,hover:ModernCarMenuAction={type:'none'};
 let current:NativeMenuCar|undefined,currentTransmission=0,currentPaint=0,paintCount=1,closed=false,previewCanvas:HTMLCanvasElement|undefined,previewError=false,previewRender:((angle:number)=>void)|undefined,animation=0,lastAnimation=0,rotationStarted=performance.now();

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=5,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=8,colour='#eee',weight=400,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const fittedLabel=(value:string,x:number,y:number,maxWidth:number,size=6.5,colour='#eee',weight=600,align:CanvasTextAlign='left')=>{
  let drawSize=size;
  while(drawSize>4.2){
   ctx.font=`${weight} ${Math.max(9,drawSize*sy())}px system-ui,Segoe UI,sans-serif`;
   if(ctx.measureText(value).width<=maxWidth*sx())break;
   drawSize-=.25;
  }
  label(value,x,y,drawSize,colour,weight,align);
 };
 const wrappedLines=(value:string,maxWidth:number,size:number,maxLines:number)=>{
  ctx.font=`450 ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;
  const words=value.replace(/\s+/g,' ').trim().split(' ').filter(Boolean),lines:string[]=[];let line='';
  for(const word of words){
   const next=line?line+' '+word:word;
   if(ctx.measureText(next).width<=maxWidth*sx()){line=next;continue;}
   if(line)lines.push(line);line=word;if(lines.length===maxLines-1)break;
  }
  if(line&&lines.length<maxLines)lines.push(line);
  if(words.length&&lines.length===maxLines){
   let last=lines[maxLines-1];
   while(last.length>1&&ctx.measureText(last+'…').width>maxWidth*sx())last=last.slice(0,-1);
   if(last!==lines[maxLines-1])lines[maxLines-1]=last+'…';
  }
  return lines;
 };
 const fit=(value:string,max:number)=>value.length<=max?value:value.slice(0,Math.max(1,max-1))+'…';
 const over=(type:ModernCarMenuAction['type'])=>hover.type===type;
 const button=(bounds:{x:number;y:number;w:number;h:number},caption:string,type:ModernCarMenuAction['type'],size=6.4)=>{
  const active=over(type);rect(bounds.x,bounds.y,bounds.w,bounds.h,active?'#5b6330':'#232323',active?'#b4c35a':'#555',4,active?1.5:1);
  label(caption,bounds.x+bounds.w/2,bounds.y+bounds.h/2+.2,size,active?'#fff':'#e8e8e8',600,'center');
 };
 const updateDropdownStart=()=>{
  const maxStart=Math.max(0,cars.length-dropdownRows);
  dropdownStart=Math.max(0,Math.min(maxStart,selected-Math.floor(dropdownRows/2)));
 };
 const drawDropdown=()=>{
  const visible=cars.slice(dropdownStart,dropdownStart+dropdownRows),height=Math.max(1,visible.length)*dropdownRowHeight+4;
  rect(selector.x,selector.y+selector.h+2,selector.w,height,'#111','#666',4);
  visible.forEach((car,row)=>{
   const index=dropdownStart+row,y=selector.y+selector.h+4+row*dropdownRowHeight,isOver=hover.type==='car'&&hover.index===index;
   if(index===selected||isOver)rect(selector.x+2,y-1,selector.w-4,dropdownRowHeight,isOver?'#646d34':'#5b6330',isOver?'#c1d064':'#879044',3,isOver?1.5:1);
   fittedLabel(car.name??car.id,selector.x+6,y+dropdownRowHeight/2-1,selector.w-14,6.2,index===selected||isOver?'#fff':'#ddd',index===selected||isOver?650:450);
  });
 };
 const drawInfo=()=>{
  if(!current)return;
  rect(infoRect.x,infoRect.y,infoRect.w,infoRect.h,'#111','#3b3b3b',6);
  const left=239,right=305;
  label('CAR INFO',left,56,8,'#aaa',700);
  fittedLabel(current.name??current.id,left,69,right-left,6.2,'#eee',650);
  const rows=[
   ['GEARS',String(current.gears)],
   ['MAX RPM',String(current.maxRPM)],
   ['MASS',String(current.mass)+' kg'],
   ['IDLE RPM',String(current.idleRPM)],
   ['PAINT',String(currentPaint+1)],
  ] as const;
  rows.forEach(([key,value],index)=>{
   const y=84+index*10.5;
   label(key,left,y,4.5,'#777',600);
   label(value,right,y,5.5,'#ddd',600,'right');
  });
 };
 const drawGraph=()=>{
  if(!current)return;
  rect(graphRect.x,graphRect.y,graphRect.w,graphRect.h,'#111','#3b3b3b',5);
  label('ACCELERATION',graphRect.x+6,graphRect.y+7,5,'#aaa',700);
  const simulation=Uint8Array.from(current.rawSimulation.match(/../g)??[],value=>Number.parseInt(value,16));
  if(!simulation.length)return;
  const graph=originalCarAccelerationGraph(current,simulation).points;
  const gx=graphRect.x+18,gy=graphRect.y+14,gw=graphRect.w-24,gh=graphRect.h-20;

  ctx.save();
  ctx.lineWidth=Math.max(.5,.55*Math.min(sx(),sy()));
  for(let i=0;i<=8;i++){
   const x=(gx+gw*i/8)*sx();
   ctx.strokeStyle=i%4===0?'#565656':'#333';
   ctx.beginPath();ctx.moveTo(x,gy*sy());ctx.lineTo(x,(gy+gh)*sy());ctx.stroke();
  }
  for(let i=0;i<=6;i++){
   const y=(gy+gh*i/6)*sy();
   ctx.strokeStyle=i%2===0?'#565656':'#333';
   ctx.beginPath();ctx.moveTo(gx*sx(),y);ctx.lineTo((gx+gw)*sx(),y);ctx.stroke();
  }

  ctx.strokeStyle='#8b8b8b';ctx.lineWidth=Math.max(1,Math.min(sx(),sy()));
  ctx.beginPath();ctx.rect(gx*sx(),gy*sy(),gw*sx(),gh*sy());ctx.stroke();

  ctx.strokeStyle='#d8d66d';ctx.lineWidth=Math.max(1.2,1.2*Math.min(sx(),sy()));ctx.beginPath();
  graph.forEach((point,index)=>{
   const nx=Math.max(0,Math.min(1,(point.x-28)/38)),ny=Math.max(0,Math.min(1,(181-point.y)/64));
   const px=(gx+nx*gw)*sx(),py=(gy+gh-ny*gh)*sy();
   if(index===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  });ctx.stroke();ctx.restore();

  for(const [text,value] of [['0',0],['20',.5],['40',1]] as const)
   label(text,gx+gw*value,gy+gh+4,3.6,'#8a8a8a',500,'center');
  for(const [text,value] of [['150',0],['100',1/3],['50',2/3],['0',1]] as const)
   label(text,gx-3,gy+gh*value,3.5,'#8a8a8a',500,'right');
 };
 const drawDescription=()=>{
  if(!current)return;
  rect(descriptionRect.x,descriptionRect.y,descriptionRect.w,descriptionRect.h,'#111','#3b3b3b',5);
  label('ABOUT THIS CAR',descriptionRect.x+6,descriptionRect.y+8,5,'#aaa',700);
  const description=(current.description??'').trim()||'No description available.';
  const lines=wrappedLines(description,descriptionRect.w-12,4.2,4);
  lines.forEach((line,index)=>label(line,descriptionRect.x+6,descriptionRect.y+18+index*7,4.2,index===0?'#ddd':'#aaa',450));
 };
 const drawPreview=()=>{
  rect(7,44,220,153,'#111','#3b3b3b',6);
  ctx.save();ctx.beginPath();ctx.roundRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy(),4*Math.min(sx(),sy()));ctx.clip();
  ctx.fillStyle='#0a0b0a';ctx.fillRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  if(previewCanvas){
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(previewCanvas,previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  }else if(previewError)label('PREVIEW UNAVAILABLE',previewRect.x+previewRect.w/2,previewRect.y+previewRect.h/2,5,'#a77',600,'center');
  else label('LOADING CAR…',previewRect.x+previewRect.w/2,previewRect.y+previewRect.h/2,5,'#777',600,'center');
  ctx.restore();
 };
 const render=()=>{
  if(closed)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);
  rect(7,6,306,30,'#111','#3b3b3b',6);label('CAR SELECT',15,21,9,'#aeb56e',700);
  rect(selector.x,selector.y,selector.w,selector.h,over('selector')?'#2f341c':'#191919',dropdownOpen||over('selector')?'#b4c35a':'#555',4,dropdownOpen||over('selector')?1.5:1);
  fittedLabel(cars[selected]?.name??cars[selected]?.id??'CAR',selector.x+6,selector.y+selector.h/2,selector.w-18,6.5,'#f2f2f2',600);
  label(dropdownOpen?'▴':'▾',selector.x+selector.w-8,selector.y+selector.h/2,7,'#aaa',700,'center');
  button(importButton,'IMPORT','import');
  drawPreview();drawInfo();drawGraph();drawDescription();
  button(transmissionButton,currentTransmission?'AUTOMATIC':'MANUAL','transmission',5.2);
  button(colourButton,'COLOUR','colour',5.6);
  button(doneButton,'DONE','done',7);
  if(dropdownOpen)drawDropdown();
  ctx.restore();
 };

 const animate=(now:number)=>{
  if(closed)return;
  if(previewRender&&now-lastAnimation>=33){
   lastAnimation=now;
   const angle=Math.floor(((now-rotationStarted)*1024/12000))&1023;
   try{previewRender(angle);render();}catch(reason){previewRender=undefined;previewError=true;console.error('[Modern Car Select] Rotation failed:',reason);render();}
  }
  animation=requestAnimationFrame(animate);
 };
 animation=requestAnimationFrame(animate);
 render();

 return {
  setCars(next,nextSelected,open){cars=next;selected=Math.max(0,Math.min(Math.max(0,cars.length-1),nextSelected));dropdownOpen=open;updateDropdownStart();},
  async draw(car,transmission,paint){
   current=car;currentTransmission=transmission;currentPaint=paint;previewCanvas=undefined;previewRender=undefined;previewError=false;rotationStarted=performance.now();render();
   try{
    const preview=await options.preview(car,paint);
    if(preview){previewCanvas=preview.canvas;previewRender=preview.render;paintCount=Math.max(1,preview.paintCount|0);preview.render(0);}
    else{previewError=true;paintCount=1;}
   }catch(reason){
    previewError=true;paintCount=1;console.error('[Modern Car Select] High-res preview failed:',reason);
   }
   render();return {paintCount};
  },
  actionAt(event){
   if(event.clientX<0||event.clientY<0)return {type:'none'};
   const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
   const inside=(b:{x:number;y:number;w:number;h:number})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
   if(dropdownOpen){
    const top=selector.y+selector.h+3,bottom=top+Math.min(dropdownRows,cars.length)*dropdownRowHeight;
    if(x>=selector.x&&x<=selector.x+selector.w&&y>=top&&y<bottom){
     const row=Math.floor((y-top)/dropdownRowHeight),index=dropdownStart+row;if(index<cars.length)return {type:'car',index};
    }
   }
   if(inside(selector))return {type:'selector'};
   if(inside(importButton))return {type:'import'};
   if(inside(transmissionButton))return {type:'transmission'};
   if(inside(colourButton))return {type:'colour'};
   if(inside(doneButton))return {type:'done'};
   return {type:'none'};
  },
  hoverAt(event){const next=this.actionAt(event);if(JSON.stringify(next)!==JSON.stringify(hover)){hover=next;render();}},
  clearHover(){hover={type:'none'};render();},
  scrollDropdown(delta){
   if(!dropdownOpen||cars.length<=dropdownRows)return false;
   const maxStart=Math.max(0,cars.length-dropdownRows);dropdownStart=Math.max(0,Math.min(maxStart,dropdownStart+(delta>0?1:-1)));render();return true;
  },
  render,
  close(){closed=true;cancelAnimationFrame(animation);previewRender=undefined;}
 };
}
