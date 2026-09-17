export const MT32_CHANNEL='playstunts-dx-mt32-panel';

export type Mt32Sound={group:string;name:string};
export type Mt32Snapshot={
 host:boolean;powered:boolean;starting:boolean;
 display:{text:string;midi:boolean};
 settings:number[];tune:number;resetGeneration:number;unitID:number;
 memory:Record<string,number[]>;patchNames:string[];sounds:Mt32Sound[];
};

export type Mt32Command=
 | {type:'request'}
 | {type:'power'}
 | {type:'reset-controllers'}
 | {type:'set-unit';value:number}
 | {type:'panel-write';writes:number[][]}
 | {type:'write';writes:number[][]}
 | {type:'main-display'}
 | {type:'set';id:number;value:number};

export interface Mt32PanelDevice {
 resetGeneration():number;
 resetControllers():void;
 unitID():number;
 setUnitID(value:number):void;
 panelWrite(writes:number[][]):void;
 sound(group:number,number:number):Mt32Sound;
 patchName(part:number):string;
 read(address:number,length:number):Uint8Array;
 write(writes:number[][]):void;
 mainDisplay():void;
 settings():number[];
 set(id:number,value:number):void;
}

export interface Mt32HostDevice extends Mt32PanelDevice {
 display():{text:string;midi:boolean};
}

export const emptyMt32Snapshot=():Mt32Snapshot=>({
 host:false,powered:false,starting:false,display:{text:'',midi:false},settings:[],tune:64,
 resetGeneration:0,unitID:16,memory:{},patchNames:Array(8).fill(''),sounds:[],
});

export function createMt32SoundCatalog(device:Mt32HostDevice|undefined){
 if(!device)return [];
 const sounds:Mt32Sound[]=[];
 for(let group=0;group<4;group++)for(let number=0;number<128;number++){
  try{sounds[group*128+number]=device.sound(group,number);}catch{sounds[group*128+number]={group:'',name:''};}
 }
 return sounds;
}

export function createMt32Snapshot(device:Mt32HostDevice|undefined,starting:boolean,sounds:Mt32Sound[]):Mt32Snapshot{
 if(!device)return {...emptyMt32Snapshot(),host:true,starting,sounds};
 const memory:Record<string,number[]>={};
 const capture=(address:number,length:number)=>{try{memory[String(address)]=Array.from(device.read(address,length));}catch{memory[String(address)]=Array(length).fill(0);}};
 const system=0x10*16384,patch=3*16384;
 capture(system,1);capture(system+22,1);
 for(let part=0;part<9;part++){capture(patch+part*16,2);capture(patch+part*16+8,1);}
 const patchNames=Array.from({length:8},(_,part)=>{try{return device.patchName(part);}catch{return '';}});
 let settings:number[]=[];try{settings=device.settings();}catch{}
 let display={text:'',midi:false};try{display=device.display();}catch{}
 let resetGeneration=0;try{resetGeneration=device.resetGeneration();}catch{}
 let unitID=16;try{unitID=device.unitID();}catch{}
 return {host:true,powered:true,starting,display,settings,tune:memory[String(system)]?.[0]??64,resetGeneration,unitID,memory,patchNames,sounds};
}

export function createRemoteMt32Device(current:()=>Mt32Snapshot,send:(command:Mt32Command)=>void):Mt32PanelDevice{
 return {
  resetGeneration:()=>current().resetGeneration,
  resetControllers:()=>send({type:'reset-controllers'}),
  unitID:()=>current().unitID,
  setUnitID:value=>send({type:'set-unit',value}),
  panelWrite:writes=>send({type:'panel-write',writes}),
  sound:(group,number)=>current().sounds[group*128+number]??{group:'',name:''},
  patchName:part=>current().patchNames[part]??'',
  read:(address,length)=>{
   const bytes=current().memory[String(address)]??[];
   const result=new Uint8Array(length);result.set(bytes.slice(0,length));return result;
  },
  write:writes=>send({type:'write',writes}),
  mainDisplay:()=>send({type:'main-display'}),
  settings:()=>current().settings,
  set:(id,value)=>send({type:'set',id,value}),
 };
}
