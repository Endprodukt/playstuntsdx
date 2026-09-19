import {createOriginalCarMenuModel} from './car-menu-model.ts';
import {createUpgradedCarMenu} from './upgraded-car-menu.ts';
import type {NativeMenuCar} from './native-car-runtime.ts';
import type {ModernCarMenuAction,ModernCarMenuPresentation} from './modern-car-menu-runtime.ts';

const selector={x:101,y:10,w:109,h:22},importButton={x:214,y:10,w:47,h:22},doneButton={x:232,y:174,w:81,h:23};
const transmissionButton={x:232,y:137,w:81,h:16},colourButton={x:232,y:155,w:81,h:16};
const previewRect={x:8,y:45,w:218,h:147},infoRect={x:232,y:44,w:81,h:89};
const dropdownRowHeight=15,dropdownRows=8;

export function createEnhancedCarMenuPresentation(options:{
 canvas:HTMLCanvasElement;
 palette:number[];
 materialIndices:number[];
 baseline:Uint8Array;
 stopArt:ReadonlyArray<number>;
 bank:(id:string)=>Promise<Uint8Array>;
}):ModernCarMenuPresentation{
 const {canvas}=options,ctx=canvas.getContext('2d')!;
 const dummy=new Uint8Array(65536);let showroom:ReturnType<typeof createUpgradedCarMenu>|undefined,previewError='';
 let cars:readonly NativeMenuCar[]=[],selected=0,dropdownOpen=false,dropdownStart=0,hover:ModernCarMenuAction={type:'none'};
 let current:NativeMenuCar|undefined,currentTransmission=0,currentPaint=0,paintCount=1,renderer:ReturnType<typeof createOriginalCarMenuModel>|undefined;
 let modelMemory:Uint8Array|undefined,signature='',closed=false;

 const sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=5,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=8,colour='#eee',weight=400,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
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
   label(fit(car.name??car.id,15),selector.x+6,y+dropdownRowHeight/2-1,6.2,index===selected||isOver?'#fff':'#ddd',index===selected||isOver?650:450);
  });
 };
 const drawInfo=()=>{
  if(!current)return;
  rect(infoRect.x,infoRect.y,infoRect.w,infoRect.h,'#111','#3b3b3b',6);
  label('CAR INFO',239,56,8,'#aaa',700);
  label('NAME',239,69,5,'#777',600);
  label(fit(current.name??current.id,13),239,78,7,'#eee',650);
  label('GEARS',239,91,4.5,'#777',600);label(String(current.gears),278,91,5.5,'#ddd',600);
  label('MAX RPM',239,101,4.5,'#777',600);label(String(current.maxRPM),278,101,5.5,'#ddd',600);
  label('MASS',239,111,4.5,'#777',600);label(String(current.mass),278,111,5.5,'#ddd',600);
  const description=(current.description??'').trim();
  if(description)label(fit(description,18),239,123,4.2,'#999',450);
 };
 const drawPreview=()=>{
  rect(7,44,220,153,'#111','#3b3b3b',6);
  ctx.save();ctx.beginPath();ctx.roundRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy(),4*Math.min(sx(),sy()));ctx.clip();
  ctx.fillStyle='#0a0b0a';ctx.fillRect(previewRect.x*sx(),previewRect.y*sy(),previewRect.w*sx(),previewRect.h*sy());
  if(previewError)label('PREVIEW UNAVAILABLE',previewRect.x+previewRect.w/2,previewRect.y+previewRect.h/2,6,'#a77',600,'center');
  else if(renderer&&modelMemory){
   try{
    showroom??=createUpgradedCarMenu(options.palette,options.materialIndices);
    const rendered=showroom.draw(modelMemory,Math.max(2,Math.round(previewRect.w*sx()*2)),Math.max(2,Math.round(previewRect.h*sy()*2)));
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const insetX=4*sx(),insetY=2*sy();
    ctx.drawImage(rendered,previewRect.x*sx()-insetX,previewRect.y*sy()-insetY,previewRect.w*sx()+insetX*2,previewRect.h*sy()+insetY*2);
   }catch(reason){
    previewError=reason instanceof Error?reason.message:String(reason);
    console.error('[Modern Car Select] Preview failed:',reason);
    showroom?.close();showroom=undefined;
   }
  }else label('LOADING CAR…',previewRect.x+previewRect.w/2,previewRect.y+previewRect.h/2,7,'#777',600,'center');
  ctx.restore();
 };
 const render=()=>{
  if(closed)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);
  rect(7,6,306,30,'#111','#3b3b3b',6);label('CAR SELECT',15,21,9,'#aeb56e',700);
  rect(selector.x,selector.y,selector.w,selector.h,over('selector')?'#2f341c':'#191919',dropdownOpen||over('selector')?'#b4c35a':'#555',4,dropdownOpen||over('selector')?1.5:1);
  label(fit(cars[selected]?.name??cars[selected]?.id??'CAR',15),selector.x+6,selector.y+selector.h/2,6.5,'#f2f2f2',600);
  label(dropdownOpen?'▴':'▾',selector.x+selector.w-8,selector.y+selector.h/2,7,'#aaa',700,'center');
  button(importButton,'IMPORT','import');
  drawPreview();drawInfo();
  button(transmissionButton,currentTransmission?'AUTOMATIC':'MANUAL','transmission',5.2);
  button(colourButton,'COLOUR','colour',5.6);
  button(doneButton,'DONE','done',7);
  if(dropdownOpen)drawDropdown();
  ctx.restore();
 };

 render();

 return {
  setCars(next,nextSelected,open){cars=next;selected=Math.max(0,Math.min(Math.max(0,cars.length-1),nextSelected));dropdownOpen=open;updateDropdownStart();},
  async draw(car,transmission,paint){
   current=car;currentTransmission=transmission;currentPaint=paint;
   const nextSignature=car.id;
   if(signature!==nextSignature){
    signature=nextSignature;renderer=undefined;modelMemory=undefined;previewError='';showroom?.close();showroom=undefined;
    try{
     const bank=await options.bank(car.id);
     renderer=createOriginalCarMenuModel(options.baseline,bank,options.stopArt,(memory)=>{modelMemory=memory;});
     paintCount=Math.max(1,renderer.paintCount|0);
     currentPaint=Math.max(0,Math.min(paint,paintCount-1));
     renderer.render(dummy,0,currentPaint);
    }catch(reason){
     previewError=reason instanceof Error?reason.message:String(reason);
     console.error('[Modern Car Select] Model setup failed for',car.id,reason);
     paintCount=1;
    }
   }else currentPaint=Math.max(0,Math.min(paint,paintCount-1));
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
  close(){closed=true;showroom?.close();showroom=undefined;renderer=undefined;modelMemory=undefined;}
 };
}
