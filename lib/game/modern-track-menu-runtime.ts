import type {NativeTrackMenuHost,NativeMenuTrack} from './native-track-runtime.ts';

export type ModernTrackMenuAction=
 |{type:'selector'}
 |{type:'track';index:number}
 |{type:'import'}
 |{type:'edit'}
 |{type:'done'}
 |{type:'none'};

export interface ModernTrackMenuPresentation {
 draw(track:NativeMenuTrack,score:ReadonlyArray<number>|null):void|Promise<void>;
 setTracks(names:readonly string[],selected:number,open:boolean):void;
 hit(x:number,y:number):ModernTrackMenuAction;
 render():void;
 close():void;
}

export interface ModernTrackMenuHost extends NativeTrackMenuHost {
 importTrack?:()=>Promise<{name:string;path:string;raw:number[]}|null>;
 takeModernAction?:()=>ModernTrackMenuAction|undefined;
}

const stripExtension=(name:string)=>name.replace(/\.trk$/i,'');
const sortNames=(names:string[])=>names.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));
const keyUp=0x4800,keyDown=0x5000;

export async function runModernTrackMenu(host:ModernTrackMenuHost,display:ModernTrackMenuPresentation){
 let names=sortNames((await host.enumerate('','.trk')).map(stripExtension));
 const includeCurrent=()=>{if(!names.some(name=>name.toLowerCase()===host.track.name.toLowerCase()))names.push(host.track.name);sortNames(names);};
 includeCurrent();
 let selected=Math.max(0,names.findIndex(name=>name.toLowerCase()===host.track.name.toLowerCase())),open=false,typePrefix='',typeDeadline=0;

 const sync=async()=>{
  includeCurrent();
  selected=Math.max(0,names.findIndex(name=>name.toLowerCase()===host.track.name.toLowerCase()));
  display.setTracks(names,selected,open);
  const scores=await host.readScores(host.track.name,host.track.path);
  await display.draw(host.track,scores?.slice(0,52)??null);
 };

 const load=async(index:number)=>{
  const name=names[index];if(!name)return;
  const raw=await host.loadTrack({path:'',name});
  if(raw.length<1802)throw Error('Stunts track requires at least 1802 bytes');
  host.track.raw=raw;host.track.name=name;host.track.path='';
  host.configuration.splice(13,9,...Array.from({length:9},(_,i)=>name.charCodeAt(i)||0));
  open=false;await sync();
 };

 await sync();
 try{
  for(;;){
   const input=await host.input(),action=host.takeModernAction?.();
   if(action){
    if(action.type==='selector'){open=!open;display.setTracks(names,selected,open);display.render();}
    else if(action.type==='track'){selected=action.index;await load(selected);}
    else if(action.type==='done')return;
    else if(action.type==='edit'){
     if(await host.editTrack(host.track)==='drive')return 'drive' as const;
     names=sortNames((await host.enumerate('','.trk')).map(stripExtension));open=false;await sync();
    }else if(action.type==='import'&&host.importTrack){
     const imported=await host.importTrack();
     if(imported){
      host.track.name=imported.name;host.track.path=imported.path;host.track.raw=imported.raw;
      host.configuration.splice(13,9,...Array.from({length:9},(_,i)=>imported.name.charCodeAt(i)||0));
      names=sortNames((await host.enumerate('','.trk')).map(stripExtension));
      if(!names.some(name=>name.toLowerCase()===imported.name.toLowerCase())){names.push(imported.name);sortNames(names);}
      open=false;await sync();
     }
    }
    continue;
   }
   const textKey=input.textKey??0;
   if(open&&textKey>=32&&textKey<127){
    const ch=String.fromCharCode(textKey).toLocaleUpperCase(),now=performance.now(),labels=names.map(name=>name.toLocaleUpperCase());
    const sameSingle=typePrefix.length===1&&typePrefix===ch&&now<=typeDeadline;
    let prefix=now<=typeDeadline&&!sameSingle?typePrefix+ch:ch;
    let index=-1;
    if(sameSingle){
     for(let step=1;step<=names.length;step++){const i=(selected+step)%names.length;if(labels[i].startsWith(ch)){index=i;break;}}
    }else index=labels.findIndex(label=>label.startsWith(prefix));
    if(index<0&&prefix.length>1){prefix=ch;index=labels.findIndex(label=>label.startsWith(prefix));}
    if(index>=0){selected=index;typePrefix=prefix;typeDeadline=now+750;display.setTracks(names,selected,true);display.render();}
    continue;
   }
   if(input.key===27){if(open){open=false;display.setTracks(names,selected,false);display.render();}else return;continue;}
   if(input.key===keyUp||input.key===keyDown){
    if(names.length){
     open=true;
     selected=(selected+(input.key===keyDown?1:-1)+names.length)%names.length;
     display.setTracks(names,selected,true);display.render();
    }
    continue;
   }
   if(input.key===13||input.key===32){
    if(open)await load(selected);else{open=true;display.setTracks(names,selected,true);display.render();}
    continue;
   }
  }
 }finally{display.close();}
}
