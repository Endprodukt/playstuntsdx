import type {NativeMenuCar,NativeCarMenuHost} from './native-car-runtime.ts';

export type ModernCarMenuAction=
 |{type:'selector'}
 |{type:'car';index:number}
 |{type:'import'}
 |{type:'transmission'}
 |{type:'colour'}
 |{type:'done'}
 |{type:'none'};

export interface ModernCarMenuPresentation{
 setCars(cars:readonly NativeMenuCar[],selected:number,open:boolean):void;
 draw(car:NativeMenuCar,transmission:number,paint:number):Promise<{paintCount:number}>;
 actionAt(event:{clientX:number;clientY:number}):ModernCarMenuAction;
 hoverAt(event:{clientX:number;clientY:number}):void;
 clearHover():void;
 scrollDropdown(delta:number):boolean;
 render():void;
 close():void;
}

export interface ModernCarMenuHost extends NativeCarMenuHost{
 importCar?:()=>Promise<{id:string}|null>;
 refreshCars?:()=>Promise<readonly NativeMenuCar[]>;
 takeModernAction?:()=>ModernCarMenuAction|undefined;
}

const keyUp=0x4800,keyDown=0x5000;
const idAt=(configuration:readonly number[],offset:number)=>String.fromCharCode(...configuration.slice(offset,offset+4));

export async function runModernCarMenu(host:ModernCarMenuHost,display:ModernCarMenuPresentation){
 const initial=host.configuration.slice(),offset=host.opponent?7:0,paintOffset=offset+4,transmissionOffset=offset+5;
 let cars=[...host.cars].slice(0,32).sort((a,b)=>a.id.localeCompare(b.id)),open=false;
 let selected=Math.max(0,cars.findIndex(car=>car.id===idAt(host.configuration,offset)));
 let paint=host.configuration[paintOffset]??0,transmission=host.configuration[transmissionOffset]??0,paintCount=1;

 const sync=async(resetPaint=false)=>{
  if(!cars.length)return;
  selected=Math.max(0,Math.min(cars.length-1,selected));
  if(resetPaint)paint=0;
  display.setCars(cars,selected,open);
  const state=await display.draw(cars[selected],transmission,paint);
  paintCount=Math.max(1,state.paintCount|0);
  if(paint>=paintCount){paint=0;await display.draw(cars[selected],transmission,paint);}
  host.configuration[paintOffset]=paint;host.configuration[transmissionOffset]=transmission;
 };

 if(!cars.length)return;
 await sync();
 try{
  for(;;){
   const input=await host.input(),current=host.takeModernAction?.()??{type:'none'} as ModernCarMenuAction;
   if(current.type==='selector'){open=!open;display.setCars(cars,selected,open);display.render();continue;}
   if(current.type==='car'){selected=current.index;open=false;await sync(true);continue;}
   if(current.type==='transmission'){transmission=transmission?0:1;await sync();continue;}
   if(current.type==='colour'){paint=(paint+1)%paintCount;await sync();continue;}
   if(current.type==='import'&&host.importCar){
    const imported=await host.importCar();
    if(imported){
     cars=[...(await host.refreshCars?.()??host.cars)].slice(0,32).sort((a,b)=>a.id.localeCompare(b.id));
     selected=Math.max(0,cars.findIndex(car=>car.id===imported.id));open=false;await sync(true);
    }
    continue;
   }
   if(current.type==='done'){
    host.configuration.splice(offset,4,...Array.from(cars[selected].id.slice(0,4),c=>c.charCodeAt(0)));
    return;
   }

   if(input.key===27){host.configuration.splice(0,host.configuration.length,...initial);return;}
   if(input.key===keyUp||input.key===keyDown){
    if(open){selected=(selected+(input.key===keyDown?1:-1)+cars.length)%cars.length;display.setCars(cars,selected,true);display.render();}
    else{selected=(selected+(input.key===keyDown?1:-1)+cars.length)%cars.length;await sync(true);}
    continue;
   }
   if(input.key===13||input.key===32){
    if(open){open=false;await sync(true);}else{open=true;display.setCars(cars,selected,true);display.render();}
   }
  }
 }finally{display.close();}
}
