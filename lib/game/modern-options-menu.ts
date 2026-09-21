import type {NativeMenuInput} from './native-dialog-runtime.ts';
import type {OriginalOptionSettings} from './options-actions.ts';
import {desktopInputDevice,setDesktopInputDevice,type DesktopInputDevice} from './desktop-wheel-input.ts';
import {ENHANCED_RENDER_SCALES,enhancedRenderScale,setEnhancedRenderScale} from './enhanced-resolution-settings.ts';
import {enhancedBackgroundEnabled,enhancedCockpitEnabled,setEnhancedBackgroundEnabled,setEnhancedCockpitEnabled} from './enhanced-textures.ts';
import {enhancedFovWidth,setEnhancedFovWidth} from './enhanced-view-settings.ts';
import {
 enhancedChaseCameraPosition,resetEnhancedChaseCameraPositions,setEnhancedChaseCameraPosition,
 type EnhancedChaseCameraPresetLevel,type EnhancedChaseCameraSetting,
} from './enhanced-chase-camera-settings.ts';

type Tab='gameplay'|'video'|'controls';
type FocusZone='tabs'|'rows'|'footer';
type FooterAction='replay'|'exit'|'done';
type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
type DesktopSoundDevice='off'|'pc-speaker'|'tandy'|'adlib'|'sound-blaster'|'mt32';

type RowId=
 |'music'|'sound-effects'|'sound-device'|'open-map'|'menu-style'|'track-editor'|'audio-update'
 |'dx-graphics'|'resolution'|'background'|'cockpit'|'fov'|'fps'|'original-detail'
 |'input-device'|'deadzone'|'linearity'|'show-f8'
 |'close-distance'|'close-height'|'standard-distance'|'standard-height'|'far-distance'|'far-height'|'reset-camera';

interface OptionRow {id:RowId;label:string;value:string;disabled?:boolean;actionOnly?:boolean}
interface PointerAction {type:'tab'|'row'|'footer';index:number}

export interface ModernOptionsMenuHost {
 canvas:HTMLCanvasElement;
 input():Promise<NativeMenuInput>;
 settings:OriginalOptionSettings;
 audio(operation:'toggle-music'|'toggle-sound'):Promise<number>;
 audioState():{musicEnabled:boolean;soundEnabled:boolean};
 selectReplay():Promise<boolean>;
 calibrateJoystick?():Promise<void>;
}

const graphicsKey='playstunts-dx-enhanced-graphics';
const soundKey='playstunts-dx-sound-device';
const audioUpdateKey='playstunts-dx-audio-update';
const enhancedMenuKey='playstunts-dx-enhanced-menu';
const trackEditorKey='playstunts-dx-modern-track-editor';
const fpsKey='playstunts-dx-fps-visible';
const mapKey='playstunts-dx-open-map-on-race-start';
const f8Key='playstunts-dx-show-options-button';
const deadzoneKey='playstunts-dx-steering-deadzone-percent';
const linearityKey='playstunts-dx-steering-linearity';
const musicKey='playstunts-dx-music-enabled';
const effectsKey='playstunts-dx-sound-effects-enabled';

const soundDevices:ReadonlyArray<{id:DesktopSoundDevice;label:string}>=[
 {id:'off',label:'Off'},
 {id:'pc-speaker',label:'PC Speaker'},
 {id:'tandy',label:'Tandy / PCjr'},
 {id:'adlib',label:'AdLib'},
 {id:'sound-blaster',label:'Sound Blaster'},
 {id:'mt32',label:'Roland MT-32'},
];
const inputDevices:ReadonlyArray<{id:DesktopInputDevice;label:string}>=[
 {id:'keyboard',label:'Keyboard'},
 {id:'joystick',label:'Joystick'},
 {id:'mouse',label:'Mouse'},
 {id:'wheel',label:'Wheel'},
];
const tabOrder:readonly Tab[]=['gameplay','video','controls'];
const tabLabels:Record<Tab,string>={gameplay:'GAMEPLAY',video:'VIDEO',controls:'CONTROLS'};
const footerLabels:Record<FooterAction,string>={replay:'LOAD REPLAY',exit:'EXIT GAME',done:'DONE'};
const footerOrder:readonly FooterAction[]=['replay','exit','done'];
const visibleRows=7;
const truthy=(value:string|null,defaultValue=false)=>value===null?defaultValue:!['0','false','no','off'].includes(value.trim().toLowerCase());
const boolLabel=(value:boolean)=>value?'On':'Off';
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const tauriCore=()=> (window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__?.core;
const graphicsToggle=()=>document.querySelector<HTMLButtonElement>('.desktop-game-shell .game-toolbar button[aria-pressed]');
const graphicsEnabled=()=>truthy(window.localStorage.getItem(graphicsKey),graphicsToggle()?.getAttribute('aria-pressed')==='true');
const storedDeadzone=()=>clamp(Math.round(Number(window.localStorage.getItem(deadzoneKey)??'4')||0),0,15);
const storedLinearity=()=>clamp(Math.round((Number(window.localStorage.getItem(linearityKey)??'1.4')||1.4)*20)/20,1,2);
const storedSoundDevice=()=>{
 const saved=window.localStorage.getItem(soundKey) as DesktopSoundDevice|null;
 return soundDevices.some(item=>item.id===saved)?saved!:'sound-blaster';
};
const storedEnabled=(key:string,defaultValue=true)=>truthy(window.localStorage.getItem(key),defaultValue);
const persistConfig=async(section:string,key:string,value:string)=>{
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section,key,value});}
 catch(reason){console.warn('[Modern Options] config save failed:',section,key,reason);}
};
const setBool=(key:string,value:boolean)=>window.localStorage.setItem(key,String(value));
const cycleIndex=(length:number,current:number,direction:number)=>(current+(direction<0?-1:1)+length)%length;

async function setGraphics(value:boolean){
 setBool(graphicsKey,value);
 const toggle=graphicsToggle();
 if(toggle&&(toggle.getAttribute('aria-pressed')==='true')!==value)toggle.click();
 await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
}
async function setRenderScale(value:number){
 const next=setEnhancedRenderScale(value);
 await persistConfig('Display','InternalResolutionScale',String(next));
}
async function setDeadzone(value:number){
 const next=clamp(Math.round(value),0,15);window.localStorage.setItem(deadzoneKey,String(next));
 await persistConfig('Controls','SteeringDeadzone',String(next));
}
async function setLinearity(value:number){
 const next=clamp(Math.round(value*20)/20,1,2);window.localStorage.setItem(linearityKey,String(next));
 await persistConfig('Controls','SteeringLinearity',next.toFixed(2));
}
async function setOpenMap(value:boolean){
 setBool(mapKey,value);await persistConfig('Display','OpenMapOnRaceStart',String(value));
}
async function setF8Visible(value:boolean){
 setBool(f8Key,value);await persistConfig('Display','ShowOptionsButton',String(value));
 const toggle=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent?.trim()==='Options [F8]');
 if(toggle)toggle.style.display=value?'':'none';
}
function dispatchFps(){
 const canvas=document.querySelector<HTMLCanvasElement>('.desktop-game-shell canvas');if(!canvas)return;
 canvas.focus({preventScroll:true});
 canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'f',code:'KeyF',bubbles:true,cancelable:true}));
 canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'f',code:'KeyF',bubbles:true,cancelable:true}));
}
async function mt32Ready(){
 const core=tauriCore();if(!core)return true;
 try{await core.invoke<void>('check_mt32_roms');return true;}catch{return false;}
}

function createPresentation(canvas:HTMLCanvasElement,getRows:()=>OptionRow[],state:{
 tab:()=>Tab;zone:()=>FocusZone;row:()=>number;footer:()=>number;confirm:()=>boolean;confirmChoice:()=>number;
}){
 const ctx=canvas.getContext('2d')!,sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const tabBounds=tabOrder.map((_,i)=>({x:8,y:49+i*31,w:66,h:25}));
 const content={x:80,y:44,w:233,h:127},footerBounds=[
  {x:81,y:176,w:73,h:18},{x:159,y:176,w:73,h:18},{x:237,y:176,w:76,h:18},
 ];
 let hover:PointerAction|undefined;

 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=5,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=7,colour='#eee',weight=500,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const focused=(type:PointerAction['type'],index:number)=>{
  const zone=state.zone(),keyboard=(type==='tab'&&zone==='tabs')||(type==='row'&&zone==='rows')||(type==='footer'&&zone==='footer');
  const selected=type==='tab'?tabOrder.indexOf(state.tab()):type==='row'?state.row():state.footer();
  return (keyboard&&selected===index)||(hover?.type===type&&hover.index===index);
 };
 const rows=()=>getRows();
 const rowStart=()=>{
  const all=rows(),selected=state.row();
  return Math.max(0,Math.min(Math.max(0,all.length-visibleRows),selected-Math.floor(visibleRows/2)));
 };
 const render=()=>{
  const all=rows(),start=rowStart(),visible=all.slice(start,start+visibleRows);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);
  rect(7,6,306,30,'#111','#3b3b3b',6);label('OPTIONS',15,20,9,'#aeb56e',750);label('PlayStunts DX',306,20,5.5,'#777',500,'right');
  tabOrder.forEach((tab,index)=>{const b=tabBounds[index],active=tab===state.tab(),over=focused('tab',index);rect(b.x,b.y,b.w,b.h,active?'#343a20':over?'#292d1d':'#171717',active||over?'#aeba5a':'#444',5,active||over?1.4:1);label(tabLabels[tab],b.x+b.w/2,b.y+b.h/2,5.5,active?'#fff':over?'#eee':'#aaa',active?700:600,'center');});
  rect(content.x,content.y,content.w,content.h,'#111','#3b3b3b',6);
  const activeTab=state.tab();label(tabLabels[activeTab],content.x+8,content.y+10,6,'#888',700);
  visible.forEach((row,visibleIndex)=>{
   const index=start+visibleIndex,y=content.y+20+visibleIndex*14.5,selected=focused('row',index),disabled=!!row.disabled;
   if(selected)rect(content.x+5,y-6.5,content.w-10,13,'#31371f','#9eaa54',4,1.2);
   label(row.label,content.x+10,y,5.4,disabled?'#555':selected?'#fff':'#ccc',selected?650:500);
   const valueColour=disabled?'#555':row.actionOnly?'#aeb56e':selected?'#fff':'#aeb56e';
   label(row.value,content.x+content.w-10,y,5.3,valueColour,650,'right');
  });
  if(start>0)label('▲',content.x+content.w-9,content.y+8,4.5,'#666',600,'center');
  if(start+visibleRows<all.length)label('▼',content.x+content.w-9,content.y+content.h-7,4.5,'#666',600,'center');
  footerOrder.forEach((action,index)=>{const b=footerBounds[index],over=focused('footer',index);rect(b.x,b.y,b.w,b.h,over?'#3a4022':'#202020',over?'#b4c35a':'#555',4,over?1.5:1);label(footerLabels[action],b.x+b.w/2,b.y+b.h/2,5.1,over?'#fff':'#ddd',650,'center');});
  label('↑↓ SELECT   ←→ CHANGE   ENTER APPLY   TAB CATEGORY',83,168,3.8,'#6f6f6f',500);
  if(state.confirm()){
   ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,canvas.width,canvas.height);rect(82,65,156,70,'#141414','#777',7,1.4);label('EXIT GAME?',160,82,8,'#eee',750,'center');label('Unsaved race progress will be lost.',160,98,4.4,'#888',500,'center');
   const choices=[{x:101,y:108,w:53,h:19,label:'CANCEL'},{x:166,y:108,w:53,h:19,label:'EXIT'}];
   choices.forEach((b,index)=>{const active=state.confirmChoice()===index;rect(b.x,b.y,b.w,b.h,active?'#454d28':'#242424',active?'#bdca66':'#555',4,active?1.5:1);label(b.label,b.x+b.w/2,b.y+b.h/2,5.5,active?'#fff':'#ccc',650,'center');});
  }
  ctx.restore();
 };
 const actionAt=(event:{clientX:number;clientY:number}):PointerAction|undefined=>{
  const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
  const inside=(b:{x:number;y:number;w:number;h:number})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
  const tab=tabBounds.findIndex(inside);if(tab>=0)return {type:'tab',index:tab};
  const foot=footerBounds.findIndex(inside);if(foot>=0)return {type:'footer',index:foot};
  if(x>=content.x+5&&x<=content.x+content.w-5&&y>=content.y+13&&y<=content.y+content.h-4){
   const start=rowStart(),index=start+Math.floor((y-(content.y+13))/14.5);
   if(index>=0&&index<rows().length)return {type:'row',index};
  }
  return undefined;
 };
 return {
  render,
  actionAt,
  hoverAt(event:{clientX:number;clientY:number}){const next=actionAt(event),changed=JSON.stringify(next)!==JSON.stringify(hover);hover=next;if(changed)render();},
  clearHover(){if(hover){hover=undefined;render();}},
 };
}

export async function runModernOptionsMenu(host:ModernOptionsMenuHost):Promise<'menu'|'replay'|'exit'>{
 let tab:Tab='gameplay',zone:FocusZone='rows',row=0,footer=2,confirm=false,confirmChoice=0;
 const currentRows=():OptionRow[]=>{
  if(tab==='gameplay'){
   const audio=host.audioState(),sound=storedSoundDevice();
   return [
    {id:'music',label:'Music',value:boolLabel(audio.musicEnabled)},
    {id:'sound-effects',label:'Sound Effects',value:boolLabel(audio.soundEnabled)},
    {id:'sound-device',label:'Sound Device',value:soundDevices.find(item=>item.id===sound)?.label??'Sound Blaster'},
    {id:'open-map',label:'Open Map on Race Start',value:boolLabel(storedEnabled(mapKey,false))},
    {id:'menu-style',label:'Menu Style',value:storedEnabled(enhancedMenuKey,true)?'Modern':'Vanilla'},
    {id:'track-editor',label:'Track Editor',value:storedEnabled(trackEditorKey,true)?'Modern':'Vanilla'},
    {id:'audio-update',label:'Audio Update',value:boolLabel(storedEnabled(audioUpdateKey,true))},
   ];
  }
  if(tab==='video'){
   const dx=graphicsEnabled(),fov=enhancedFovWidth();
   return [
    {id:'dx-graphics',label:'DX Graphics',value:boolLabel(dx)},
    {id:'resolution',label:'Internal Resolution',value:enhancedRenderScale()===1?'Original':`${enhancedRenderScale()}×`,disabled:!dx},
    {id:'background',label:'High-Res Background',value:boolLabel(enhancedBackgroundEnabled()),disabled:!dx},
    {id:'cockpit',label:'High-Res Cockpit',value:boolLabel(enhancedCockpitEnabled()),disabled:!dx},
    {id:'fov',label:'Field of View',value:fov===0?'Original':fov===100?'Full':`${fov}%`,disabled:!dx},
    {id:'fps',label:'FPS Counter',value:boolLabel(storedEnabled(fpsKey,true)),disabled:!dx},
    {id:'original-detail',label:'Original Graphics Detail',value:`Level ${clamp(host.settings.graphics,0,3)+1}`},
   ];
  }
  const input=desktopInputDevice();
  const camera=(level:EnhancedChaseCameraPresetLevel,kind:EnhancedChaseCameraSetting,label:string):OptionRow=>({id:(level===1?(kind==='distance'?'close-distance':'close-height'):level===2?(kind==='distance'?'standard-distance':'standard-height'):(kind==='distance'?'far-distance':'far-height')) as RowId,label,value:String(enhancedChaseCameraPosition(level)[kind])});
  const result:OptionRow[]=[
   {id:'input-device',label:'Driving Input Device',value:inputDevices.find(item=>item.id===input)?.label??'Keyboard'},
   {id:'deadzone',label:'Steering Deadzone',value:`${storedDeadzone()}%`,disabled:input!=='wheel'},
   {id:'linearity',label:'Steering Linearity',value:storedLinearity().toFixed(2),disabled:input!=='wheel'},
   {id:'show-f8',label:'Show F8 Button',value:boolLabel(storedEnabled(f8Key,true))},
   camera(1,'distance','Chase Close · Distance'),camera(1,'height','Chase Close · Height'),
   camera(2,'distance','Chase Standard · Distance'),camera(2,'height','Chase Standard · Height'),
   camera(3,'distance','Chase Far · Distance'),camera(3,'height','Chase Far · Height'),
   {id:'reset-camera',label:'Chase Camera Presets',value:'Reset',actionOnly:true},
  ];
  return result;
 };
 const clampRow=()=>{const rows=currentRows();row=Math.max(0,Math.min(Math.max(0,rows.length-1),row));};
 const presentation=createPresentation(host.canvas,currentRows,{tab:()=>tab,zone:()=>zone,row:()=>row,footer:()=>footer,confirm:()=>confirm,confirmChoice:()=>confirmChoice});
 const pointerActions:PointerAction[]=[];
 const pointerDown=(event:PointerEvent)=>{const action=presentation.actionAt(event);if(!action)return;event.preventDefault();event.stopImmediatePropagation();pointerActions.push(action);};
 const pointerMove=(event:PointerEvent)=>presentation.hoverAt(event);
 const pointerLeave=()=>presentation.clearHover();
 host.canvas.addEventListener('pointerdown',pointerDown,true);host.canvas.addEventListener('pointermove',pointerMove,true);host.canvas.addEventListener('pointerleave',pointerLeave,true);

 const setTab=(index:number)=>{tab=tabOrder[(index+tabOrder.length)%tabOrder.length]!;row=0;zone='rows';clampRow();presentation.render();};
 const setInputDevice=(device:DesktopInputDevice)=>{
  setDesktopInputDevice(device);
  host.settings.mouse=device==='mouse';
  host.settings.joystick=device==='joystick'||device==='wheel';
 };
 const alterCamera=(id:RowId,direction:number)=>{
  const map:Partial<Record<RowId,[EnhancedChaseCameraPresetLevel,EnhancedChaseCameraSetting]>>={
   'close-distance':[1,'distance'],'close-height':[1,'height'],
   'standard-distance':[2,'distance'],'standard-height':[2,'height'],
   'far-distance':[3,'distance'],'far-height':[3,'height'],
  };
  const entry=map[id];if(!entry)return;
  const [level,kind]=entry,current=enhancedChaseCameraPosition(level)[kind],step=kind==='distance'?10:5;
  setEnhancedChaseCameraPosition(level,kind,current+(direction<0?-step:step));
 };
 const changeRow=async(direction:number,activate=false)=>{
  const item=currentRows()[row];if(!item||item.disabled)return;
  switch(item.id){
   case 'music':{
    const enabled=!!(await host.audio('toggle-music'));setBool(musicKey,enabled);break;
   }
   case 'sound-effects':{
    const enabled=!!(await host.audio('toggle-sound'));setBool(effectsKey,enabled);break;
   }
   case 'sound-device':{
    const current=storedSoundDevice(),index=soundDevices.findIndex(entry=>entry.id===current),next=soundDevices[cycleIndex(soundDevices.length,Math.max(0,index),direction)]!.id;
    if(next==='mt32'&&!await mt32Ready()){window.alert('Roland MT-32 ROMs were not found in the MT32 folder.');break;}
    window.localStorage.setItem(soundKey,next);break;
   }
   case 'open-map':await setOpenMap(!storedEnabled(mapKey,false));break;
   case 'menu-style':setBool(enhancedMenuKey,!storedEnabled(enhancedMenuKey,true));break;
   case 'track-editor':setBool(trackEditorKey,!storedEnabled(trackEditorKey,true));break;
   case 'audio-update':setBool(audioUpdateKey,!storedEnabled(audioUpdateKey,true));break;
   case 'dx-graphics':await setGraphics(!graphicsEnabled());break;
   case 'resolution':{
    const current=ENHANCED_RENDER_SCALES.indexOf(enhancedRenderScale()),next=ENHANCED_RENDER_SCALES[cycleIndex(ENHANCED_RENDER_SCALES.length,Math.max(0,current),direction)]!;
    await setRenderScale(next);break;
   }
   case 'background':setEnhancedBackgroundEnabled(!enhancedBackgroundEnabled());break;
   case 'cockpit':setEnhancedCockpitEnabled(!enhancedCockpitEnabled());break;
   case 'fov':setEnhancedFovWidth(clamp(enhancedFovWidth()+(direction<0?-5:5),0,100));break;
   case 'fps':{
    const next=!storedEnabled(fpsKey,true);setBool(fpsKey,next);if(graphicsEnabled())dispatchFps();break;
   }
   case 'original-detail':host.settings.graphics=cycleIndex(4,clamp(host.settings.graphics,0,3),direction);break;
   case 'input-device':{
    const current=desktopInputDevice(),index=inputDevices.findIndex(entry=>entry.id===current),next=inputDevices[cycleIndex(inputDevices.length,Math.max(0,index),direction)]!.id;setInputDevice(next);break;
   }
   case 'deadzone':await setDeadzone(storedDeadzone()+(direction<0?-1:1));break;
   case 'linearity':await setLinearity(storedLinearity()+(direction<0?-.05:.05));break;
   case 'show-f8':await setF8Visible(!storedEnabled(f8Key,true));break;
   case 'close-distance':case 'close-height':case 'standard-distance':case 'standard-height':case 'far-distance':case 'far-height':alterCamera(item.id,direction);break;
   case 'reset-camera':if(activate){resetEnhancedChaseCameraPositions();}break;
  }
  presentation.render();
 };
 const activateFooter=async(index:number):Promise<'menu'|'replay'|'exit'|undefined>=>{
  const action=footerOrder[index];
  if(action==='done')return 'menu';
  if(action==='replay'){if(await host.selectReplay())return 'replay';presentation.render();return;}
  confirm=true;confirmChoice=0;presentation.render();return;
 };

 presentation.render();
 try{
  for(;;){
   const input=await host.input(),pointer=pointerActions.shift();
   if(confirm){
    if(pointer?.type==='footer'||pointer?.type==='row'||pointer?.type==='tab')continue;
    if(input.key===27){confirm=false;presentation.render();continue;}
    if(input.key===0x4b00||input.key===0x4d00||input.key===0x4800||input.key===0x5000){confirmChoice^=1;presentation.render();continue;}
    if(input.key===13||input.key===32){if(confirmChoice===1)return 'exit';confirm=false;presentation.render();continue;}
    continue;
   }
   if(pointer){
    if(pointer.type==='tab'){setTab(pointer.index);continue;}
    if(pointer.type==='row'){zone='rows';row=pointer.index;clampRow();await changeRow(1,true);continue;}
    zone='footer';footer=pointer.index;presentation.render();const result=await activateFooter(footer);if(result)return result;continue;
   }
   const key=input.key??0;
   if(key===27)return 'menu';
   if(key===9){setTab(tabOrder.indexOf(tab)+1);continue;}
   if(zone==='tabs'){
    if(key===0x4b00||key===0x4800){setTab(tabOrder.indexOf(tab)-1);zone='tabs';presentation.render();continue;}
    if(key===0x4d00||key===0x5000){setTab(tabOrder.indexOf(tab)+1);zone='tabs';presentation.render();continue;}
    if(key===13||key===32){zone='rows';presentation.render();continue;}
   }else if(zone==='rows'){
    const rows=currentRows();
    if(key===0x4800){if(row===0)zone='tabs';else row--;presentation.render();continue;}
    if(key===0x5000){if(row>=rows.length-1){zone='footer';footer=2;}else row++;presentation.render();continue;}
    if(key===0x4b00){await changeRow(-1);continue;}
    if(key===0x4d00){await changeRow(1);continue;}
    if(key===13||key===32){await changeRow(1,true);continue;}
   }else{
    if(key===0x4800){zone='rows';row=currentRows().length-1;clampRow();presentation.render();continue;}
    if(key===0x4b00){footer=(footer+footerOrder.length-1)%footerOrder.length;presentation.render();continue;}
    if(key===0x4d00){footer=(footer+1)%footerOrder.length;presentation.render();continue;}
    if(key===13||key===32){const result=await activateFooter(footer);if(result)return result;continue;}
   }
  }
 }finally{
  host.canvas.removeEventListener('pointerdown',pointerDown,true);host.canvas.removeEventListener('pointermove',pointerMove,true);host.canvas.removeEventListener('pointerleave',pointerLeave,true);
 }
}
