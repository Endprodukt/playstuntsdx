import type {NativeTrackMenuHost,NativeMenuTrack} from './native-track-runtime.ts';

export type ModernTrackMenuAction=
 |{type:'selector'}
 |{type:'track';index:number}
 |{type:'import'}
 |{type:'edit'}
 |{type:'done'}
 |{type:'back'}
 |{type:'none'};

export type ModernTrackMenuFocus={type:'selector'|'import'|'edit'|'done'};

export interface ModernTrackMenuPresentation {
 draw(track:NativeMenuTrack,score:ReadonlyArray<number>|null):void|Promise<void>;
 setTracks(names:readonly string[],selected:number,open:boolean):void;
 setFocus(focus:ModernTrackMenuFocus):void;
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
const keyUp=0x4800,keyDown=0x5000,keyLeft=0x4b00,keyRight=0x4d00;

export async function runModernTrackMenu(host:ModernTrackMenuHost,display:ModernTrackMenuPresentation){
 let names=sortNames((await host.enumerate('','.trk')).map(stripExtension));
 const includeCurrent=()=>{if(!names.some(name=>name.toLowerCase()===host.track.name.toLowerCase()))names.push(host.track.name);sortNames(names);};
 includeCurrent();
 let selected=Math.max(0,names.findIndex(name=>name.toLowerCase()===host.track.name.toLowerCase())),open=false,typePrefix='',typeDeadline=0;
 let focus:ModernTrackMenuFocus={type:'selector'};

 const applyFocus=(next:ModernTrackMenuFocus)=>{focus=next;display.setFocus(focus);};
 const sync=async()=>{
  includeCurrent();
  selected=Math.max(0,names.findIndex(name=>name.toLowerCase()===host.track.name.toLowerCase()));
  display.setTracks(names,selected,open);display.setFocus(focus);
  const scores=await host.readScores(host.track.name,host.track.path);
  await display.draw(host.track,scores?.slice(0,52)??null);
 };

 const load=async(index:number)=>{
  const name=names[index];if(!name)return;
  const raw=await host.loadTrack({path:'',name});
  if(raw.length<1802)throw Error('Stunts track requires at least 1802 bytes');
  host.track.raw=raw;host.track.name=name;host.track.path='';
  host.configuration.splice(13,9,...Array.from({length:9},(_,i)=>name.charCodeAt(i)||0));
  open=false;focus={type:'selector'};await sync();
 };

 const activate=async(action:ModernTrackMenuAction):Promise<'done'|'drive'|undefined>=>{
  if(action.type==='selector'){
   focus={type:'selector'};open=!open;display.setTracks(names,selected,open);display.setFocus(focus);display.render();return;
  }
  if(action.type==='track'){selected=action.index;await load(selected);return;}
  if(action.type==='done'){focus={type:'done'};display.setFocus(focus);return 'done';}
  if(action.type==='back'){
   if(open){open=false;focus={type:'selector'};display.setTracks(names,selected,false);display.setFocus(focus);display.render();return;}
   return 'done';
  }
  if(action.type==='edit'){
   focus={type:'edit'};display.setFocus(focus);
   if(await host.editTrack(host.track)==='drive')return 'drive';
   names=sortNames((await host.enumerate('','.trk')).map(stripExtension));open=false;await sync();return;
  }
  if(action.type==='import'&&host.importTrack){
   focus={type:'import'};display.setFocus(focus);
   const imported=await host.importTrack();
   if(imported){
    host.track.name=imported.name;host.track.path=imported.path;host.track.raw=imported.raw;
    host.configuration.splice(13,9,...Array.from({length:9},(_,i)=>imported.name.charCodeAt(i)||0));
    names=sortNames((await host.enumerate('','.trk')).map(stripExtension));
    if(!names.some(name=>name.toLowerCase()===imported.name.toLowerCase())){names.push(imported.name);sortNames(names);}
    open=false;focus={type:'selector'};await sync();
   }
  }
 };

 const moveFocus=(key:number):ModernTrackMenuFocus=>{
  if(key===keyLeft){
   if(focus.type==='selector')return {type:'edit'};
   if(focus.type==='import')return {type:'selector'};
   if(focus.type==='edit')return {type:'import'};
   return {type:'selector'};
  }
  if(key===keyRight){
   if(focus.type==='selector')return {type:'import'};
   if(focus.type==='import')return {type:'edit'};
   if(focus.type==='edit')return {type:'selector'};
   return {type:'selector'};
  }
  if(key===keyUp)return focus.type==='done'?{type:'edit'}:{type:'done'};
  if(key===keyDown)return focus.type==='done'?{type:'selector'}:{type:'done'};
  return focus;
 };

 await sync();
 try{
  for(;;){
   const input=await host.input(),action=host.takeModernAction?.();
   if(action){
    const result=await activate(action);
    if(result==='done')return;
    if(result==='drive')return 'drive' as const;
    continue;
   }

   const key=input.key??0,textKey=input.textKey??0;
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

   if(key===27){
    if(open){open=false;focus={type:'selector'};display.setTracks(names,selected,false);display.setFocus(focus);display.render();}
    else return;
    continue;
   }

   if(open){
    if(key===keyUp||key===keyDown){
     if(names.length){selected=(selected+(key===keyDown?1:-1)+names.length)%names.length;display.setTracks(names,selected,true);display.render();}
     continue;
    }
    if(key===keyLeft||key===keyRight){
     open=false;display.setTracks(names,selected,false);applyFocus(key===keyRight?{type:'import'}:{type:'edit'});continue;
    }
    if(key===13||key===32){await load(selected);continue;}
   }

   if(focus.type==='selector'&&(key===keyUp||key===keyDown)){
    if(names.length){
     open=true;selected=(selected+(key===keyDown?1:-1)+names.length)%names.length;
     display.setTracks(names,selected,true);display.setFocus(focus);display.render();
    }
    continue;
   }

   if(key===keyLeft||key===keyRight||key===keyUp||key===keyDown){
    applyFocus(moveFocus(key));continue;
   }

   if(key===13||key===32){
    const result=await activate(focus);
    if(result==='done')return;
    if(result==='drive')return 'drive' as const;
   }
  }
 }finally{display.close();}
}
