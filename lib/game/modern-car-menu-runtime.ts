import type {NativeMenuCar,NativeCarMenuHost} from './native-car-runtime.ts';
import {rememberCurrentPlayerCar} from './current-player-car.ts';
import {ENGINE_SOUND_PRESETS,engineSoundForCar,loadSoundModSettings,saveSoundModSettings} from './sound-mod-settings.ts';

export type ModernCarMenuAction=
 |{type:'selector'}
 |{type:'car';index:number}
 |{type:'import'}
 |{type:'sound';direction?:-1|1;index?:number}
 |{type:'autorotate';enabled:boolean}
 |{type:'transmission'}
 |{type:'colour';index?:number}
 |{type:'done'}
 |{type:'none'};

export type ModernCarMenuFocus={type:'selector'|'import'|'sound'|'transmission'|'colour'|'done'};

export interface ModernCarMenuPresentation{
 setCars(cars:readonly NativeMenuCar[],selected:number,open:boolean):void;
 setFocus(focus:ModernCarMenuFocus):void;
 setSoundOpen(open:boolean):void;
 setAutoRotate(enabled:boolean):void;
 draw(car:NativeMenuCar,transmission:number,paint:number):Promise<{paintCount:number}>;
 actionAt(event:{clientX:number;clientY:number}):ModernCarMenuAction;
 hoverAt(event:{clientX:number;clientY:number}):void;
 clearHover():void;
 scrollDropdown(delta:number):boolean;
 wheelAction(delta:number):ModernCarMenuAction|undefined;
 render():void;
 close():void;
}

export interface ModernCarMenuHost extends NativeCarMenuHost{
 importCar?:()=>Promise<{id:string}|null>;
 refreshCars?:()=>Promise<readonly NativeMenuCar[]>;
 takeModernAction?:()=>ModernCarMenuAction|undefined;
}

const keyUp=0x4800,keyDown=0x5000,keyLeft=0x4b00,keyRight=0x4d00;
const idAt=(configuration:readonly number[],offset:number)=>String.fromCharCode(...configuration.slice(offset,offset+4));

export async function runModernCarMenu(host:ModernCarMenuHost,display:ModernCarMenuPresentation){
 const initial=host.configuration.slice(),offset=host.opponent?7:0,paintOffset=offset+4,transmissionOffset=offset+5;
 let cars=[...host.cars].sort((a,b)=>(a.name??a.id).localeCompare(b.name??b.id)),open=false;
 let selected=Math.max(0,cars.findIndex(car=>car.id===idAt(host.configuration,offset)));
 let paint=host.configuration[paintOffset]??0,transmission=host.configuration[transmissionOffset]??0,paintCount=1,typePrefix='',typeDeadline=0,soundOpen=false;
 let focus:ModernCarMenuFocus={type:'selector'};

 const setSoundOpen=(open:boolean)=>{soundOpen=open;display.setSoundOpen(open);};
 const applyFocus=(next:ModernCarMenuFocus)=>{focus=next;if(next.type!=='sound'&&soundOpen)setSoundOpen(false);display.setFocus(focus);};
 const sync=async(resetPaint=false)=>{
  if(!cars.length)return;
  selected=Math.max(0,Math.min(cars.length-1,selected));
  if(resetPaint)paint=0;
  display.setCars(cars,selected,open);display.setFocus(focus);
  const state=await display.draw(cars[selected],transmission,paint);
  paintCount=Math.max(1,state.paintCount|0);
  if(paint>=paintCount){paint=0;await display.draw(cars[selected],transmission,paint);}
  host.configuration[paintOffset]=paint;host.configuration[transmissionOffset]=transmission;
 };

 const activate=async(action:ModernCarMenuAction):Promise<'done'|undefined>=>{
  if(action.type!=='sound'&&soundOpen)setSoundOpen(false);
  if(action.type==='selector'){
   if(soundOpen)setSoundOpen(false);focus={type:'selector'};open=!open;display.setCars(cars,selected,open);display.setFocus(focus);display.render();return;
  }
  if(action.type==='car'){
   if(soundOpen)setSoundOpen(false);selected=action.index;open=false;focus={type:'selector'};await sync(true);return;
  }
  if(action.type==='sound'){
   focus={type:'sound'};
   const car=cars[selected],settings=loadSoundModSettings(),current=engineSoundForCar(car.id,settings),currentIndex=Math.max(0,ENGINE_SOUND_PRESETS.findIndex(preset=>preset.id===current));
   if(action.index!==undefined){
    const next=ENGINE_SOUND_PRESETS[Math.max(0,Math.min(ENGINE_SOUND_PRESETS.length-1,action.index))]!;
    settings.perCar[car.id.toUpperCase()]=next.id;saveSoundModSettings(settings);setSoundOpen(false);display.setFocus(focus);display.render();return;
   }
   if(action.direction!==undefined){
    const next=ENGINE_SOUND_PRESETS[(currentIndex+(action.direction<0?-1:1)+ENGINE_SOUND_PRESETS.length)%ENGINE_SOUND_PRESETS.length]!;
    settings.perCar[car.id.toUpperCase()]=next.id;saveSoundModSettings(settings);display.setFocus(focus);display.render();return;
   }
   setSoundOpen(!soundOpen);display.setFocus(focus);display.render();return;
  }
  if(action.type==='autorotate'){
   display.setAutoRotate(action.enabled);display.render();return;
  }
  if(action.type==='transmission'){
   focus={type:'transmission'};transmission=transmission?0:1;await sync();return;
  }
  if(action.type==='colour'){
   focus={type:'colour'};paint=action.index===undefined?(paint+1)%paintCount:Math.max(0,Math.min(paintCount-1,action.index));await sync();return;
  }
  if(action.type==='import'&&host.importCar){
   focus={type:'import'};display.setFocus(focus);
   const imported=await host.importCar();
   if(imported){
    cars=[...(await host.refreshCars?.()??host.cars)].sort((a,b)=>(a.name??a.id).localeCompare(b.name??b.id));
    selected=Math.max(0,cars.findIndex(car=>car.id===imported.id));open=false;focus={type:'selector'};await sync(true);
   }
   return;
  }
  if(action.type==='done'){
   focus={type:'done'};display.setFocus(focus);
   host.configuration.splice(offset,4,...Array.from(cars[selected].id.slice(0,4),c=>c.charCodeAt(0)));
   if(!host.opponent)rememberCurrentPlayerCar(cars[selected].id);
   return 'done';
  }
 };

 const moveFocus=(key:number):ModernCarMenuFocus=>{
  if(key===keyLeft){
   if(focus.type==='selector')return {type:'import'};
   return {type:'selector'};
  }
  if(key===keyRight){
   if(focus.type==='selector')return {type:'import'};
   return {type:'selector'};
  }
  if(key===keyUp){
   if(focus.type==='selector')return {type:'done'};
   if(focus.type==='import')return {type:'selector'};
   if(focus.type==='sound')return {type:'import'};
   if(focus.type==='transmission')return {type:'sound'};
   if(focus.type==='colour')return {type:'transmission'};
   return {type:'colour'};
  }
  if(key===keyDown){
   if(focus.type==='selector'||focus.type==='import')return {type:'sound'};
   if(focus.type==='sound')return {type:'transmission'};
   if(focus.type==='transmission')return {type:'colour'};
   if(focus.type==='colour')return {type:'done'};
   return {type:'selector'};
  }
  return focus;
 };

 if(!cars.length)return;
 if(!host.opponent)rememberCurrentPlayerCar(cars[selected].id);
 await sync();
 try{
  for(;;){
   const input=await host.input(),current=host.takeModernAction?.();
   if(current){
    const result=await activate(current);
    if(result==='done')return;
    continue;
   }

   const key=input.key??0,textKey=input.textKey??0;
   if(open&&textKey>=32&&textKey<127){
    const ch=String.fromCharCode(textKey).toLocaleUpperCase(),now=performance.now();
    const labels=cars.map(car=>(car.name??car.id).toLocaleUpperCase());
    const sameSingle=typePrefix.length===1&&typePrefix===ch&&now<=typeDeadline;
    let prefix=now<=typeDeadline&&!sameSingle?typePrefix+ch:ch;
    let index=-1;
    if(sameSingle){
     for(let step=1;step<=cars.length;step++){const i=(selected+step)%cars.length;if(labels[i].startsWith(ch)){index=i;break;}}
    }else index=labels.findIndex(label=>label.startsWith(prefix));
    if(index<0&&prefix.length>1){prefix=ch;index=labels.findIndex(label=>label.startsWith(prefix));}
    if(index>=0){selected=index;typePrefix=prefix;typeDeadline=now+750;display.setCars(cars,selected,true);display.render();}
    continue;
   }

   if(key===27){
    if(soundOpen){setSoundOpen(false);display.render();}
    else if(open){open=false;focus={type:'selector'};display.setCars(cars,selected,false);display.setFocus(focus);display.render();}
    else{host.configuration.splice(0,host.configuration.length,...initial);return;}
    continue;
   }

   if(open){
    if(key===keyUp||key===keyDown){
     selected=(selected+(key===keyDown?1:-1)+cars.length)%cars.length;display.setCars(cars,selected,true);display.render();continue;
    }
    if(key===keyLeft||key===keyRight){
     open=false;display.setCars(cars,selected,false);
     if(key===keyRight)applyFocus({type:'import'});else applyFocus({type:'selector'});
     continue;
    }
    if(key===13||key===32){
     open=false;focus={type:'selector'};await sync(true);continue;
    }
   }

   if(focus.type==='selector'&&(key===keyUp||key===keyDown)){
    selected=(selected+(key===keyDown?1:-1)+cars.length)%cars.length;await sync(true);continue;
   }

   if((key===keyLeft||key===keyRight)&&focus.type==='sound'){
    await activate({type:'sound',direction:key===keyLeft?-1:1});continue;
   }
   if(key===keyLeft||key===keyRight||key===keyUp||key===keyDown){
    applyFocus(moveFocus(key));continue;
   }

   if(key===13||key===32){
    const result=await activate(focus);
    if(result==='done')return;
   }
  }
 }finally{display.close();}
}
