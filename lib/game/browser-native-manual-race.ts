import {advanceOriginalHardwareClock} from './hardware-clock-memory.ts';
import {createBrowserMt32RaceAudio} from './browser-mt32-race-audio.ts';
import type {Mt32StereoOutput} from './mt32-audio-stream.ts';
import {prepareBrowserNativeManualDisplay,type NativeBrowserDisplayMode} from './browser-native-display-race.ts';
import type {NativeSelectedReplay} from './native-allocated-race-preparation.ts';
import {createNativeManualRaceRuntime,reopenNativeManualRaceRuntime,createNativeReplayRaceRuntime} from './native-manual-race-runtime.ts';
import {createBrowserRaceAudio} from './browser-race-audio.ts';
import {createBrowserPcSpeakerRaceAudio} from './browser-pc-speaker-race-audio.ts';
import {createBrowserTandyRaceAudio} from './browser-tandy-race-audio.ts';
import {runBrowserAllocatedRaceLoop} from './browser-allocated-race-loop.ts';
import {loadConfiguredEngineSoundOverrides} from './browser-engine-sound-mod.ts';
import {SOUND_MOD_SETTINGS_KEY} from './sound-mod-settings.ts';
import type {createBrowserNativeMenus} from './browser-native-menus.ts';
import type {NativeDemoData,NativeDemoMenuState} from './native-demo-runtime.ts';
import type {RaceSpawn} from './race-spawn.ts';
import type {ReplayLoadingController} from './replay-loading-overlay.ts';
type Menus=Awaited<ReturnType<typeof createBrowserNativeMenus>>;

function confirmBackToEditorDialog(){
 return new Promise<boolean>(resolve=>{
  const shade=document.createElement('div');shade.tabIndex=-1;
  shade.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.16);';
  const box=document.createElement('div');
  box.style.cssText='position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);min-width:330px;background:#171717;border:1px solid #666;border-radius:7px;box-shadow:0 18px 55px rgba(0,0,0,.75);padding:16px 18px 14px;color:#eee;font:13px/1.35 system-ui,Segoe UI,sans-serif;';
  const title=document.createElement('div');title.textContent='Back to Editor?';title.style.cssText='font-size:16px;font-weight:650;margin-bottom:6px;color:#f2f2f2;';
  const text=document.createElement('div');text.textContent='Return to the Track Editor and leave this test run?';text.style.cssText='color:#bdbdbd;margin-bottom:14px;';
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:8px;';
  const make=(label:string,value:boolean)=>{
   const b=document.createElement('button');b.type='button';b.textContent=label;
   b.style.cssText='min-width:76px;border:1px solid #555;background:#232323;color:#eee;border-radius:4px;padding:7px 12px;cursor:pointer;font:12px/1.1 system-ui,Segoe UI,sans-serif;';
   const active=()=>{b.style.background='#4e5b2b';b.style.borderColor='#9fb454';b.style.color='#fff';};
   const inactive=()=>{b.style.background='#232323';b.style.borderColor='#555';b.style.color='#eee';};
   b.addEventListener('pointerenter',()=>{for(const candidate of [yes,no])inactiveButton(candidate);active();});
   b.addEventListener('focus',()=>{for(const candidate of [yes,no])inactiveButton(candidate);active();});
   b.addEventListener('click',()=>finish(value));return b;
  };
  const inactiveButton=(b:HTMLButtonElement)=>{b.style.background='#232323';b.style.borderColor='#555';b.style.color='#eee';};
  const yes=make('Yes',true),no=make('No',false);yes.style.background='#4e5b2b';yes.style.borderColor='#9fb454';yes.style.color='#fff';
  const finish=(value:boolean)=>{window.removeEventListener('keydown',onKey,true);shade.remove();resolve(value);};
  const onKey=(event:KeyboardEvent)=>{
   if(event.code==='Escape'){event.preventDefault();event.stopPropagation();finish(false);return;}
   if(event.code==='Enter'){event.preventDefault();event.stopPropagation();finish(document.activeElement!==no);return;}
   if(event.code==='ArrowLeft'||event.code==='ArrowRight'){event.preventDefault();event.stopPropagation();(document.activeElement===yes?no:yes).focus();}
  };
  actions.append(yes,no);box.append(title,text,actions);shade.append(box);document.body.append(shade);
  window.addEventListener('keydown',onKey,true);requestAnimationFrame(()=>yes.focus());
 });
}
/** Original manual race/results repetition, retaining one recording bank,
 * saved menu state and browser OPL stream until the player returns to menus. */
export async function runBrowserNativeManualRace(options:{context:AudioContext;data:NativeDemoData;menus:Menus;menu:NativeDemoMenuState&{mouse?:boolean;joystick?:boolean};spawn?:RaceSpawn;editorTest?:boolean;signal:AbortSignal;displayMode?:NativeBrowserDisplayMode;hercules?:boolean;mt32Output?:Mt32StereoOutput;replay?:NativeSelectedReplay;replayLoading?:ReplayLoadingController;stopMusic():void;onStage?:(stage:'loading'|'race'|'results'|'seeking')=>void;onFrame?:(frame:number,mode:number,clock:number,blocked:number)=>void}){
 if(options.data.soundDevice?.kind==='mt32'&&!options.mt32Output)throw Error('Roland race requires an initialized synthesizer output');
 const editorButtonStyles=new WeakMap<HTMLButtonElement,{background:string;borderColor:string;color:string}>();
 const editorButtonHover=(event:PointerEvent)=>{
  const button=(event.target as Element|null)?.closest?.('button');if(!(button instanceof HTMLButtonElement))return;
  if(button.textContent?.trim().toUpperCase()!=='BACK TO EDITOR')return;
  if(event.type==='pointerover'){
   if(!editorButtonStyles.has(button))editorButtonStyles.set(button,{background:button.style.background,borderColor:button.style.borderColor,color:button.style.color});
   button.style.background='#30371d';button.style.borderColor='#d6e16a';button.style.color='#fff';
  }else{
   const original=editorButtonStyles.get(button);if(!original)return;
   button.style.background=original.background;button.style.borderColor=original.borderColor;button.style.color=original.color;
  }
 };
 if(options.editorTest){document.addEventListener('pointerover',editorButtonHover,true);document.addEventListener('pointerout',editorButtonHover,true);}
 let rolandAudio:ReturnType<typeof createBrowserMt32RaceAudio>|undefined;
 const {context,menus,signal}=options;let pcAudio:ReturnType<typeof createBrowserPcSpeakerRaceAudio>|undefined;
 const deviceData=options.data.soundDevice?.kind==='pc-speaker'?{...options.data,soundDevice:{kind:'pc-speaker' as const,port61:()=>pcAudio?.port61??0}}:options.data.soundDevice?.kind==='tandy'?{...options.data,soundDevice:{...options.data.soundDevice,port61:()=>pcAudio?.port61??0}}:options.data;
 let engineSoundOverrides=await loadConfiguredEngineSoundOverrides(deviceData);
 let data=engineSoundOverrides?{...deviceData,engineSoundOverrides}:deviceData;
 const loading=options.replayLoading;
 const aborted=()=>{if(signal.aborted)throw new DOMException('Native race closed','AbortError');loading?.throwIfCancelled();};
 const progress=(stage:number,detail?:string)=>{loading?.throwIfCancelled();if(detail){loading?.update('Loading race resource',detail);return;}if(loading)loading.update(stage===3?'Loading cockpit, track and scenery':stage===4?'Loading opponent route':'Loading race resources',`Original resource stage ${stage}`);const name=({2:'SDTITL.PVS',3:'TEDIT.PRE',4:'OPP1.PRE'} as Record<number,string>)[stage];if(!name||!data.catalog.exists(name))throw Error('Original disk-presence resource missing for stage '+stage);};
 let presentation:Awaited<ReturnType<Menus['allocatedRacePresentation']>>|undefined,audio:Awaited<ReturnType<typeof createBrowserRaceAudio>>|undefined;
 let onSoundSettingsChanged:()=>void=()=>{},soundSettingsTimer=0;
 aborted();options.onStage?.(options.replay?'seeking':'loading');menus.setInputActive(true);const waiting=options.replay?data.base.slice():data.base;if(options.replay)new DataView(waiting.buffer).setUint16(0x2d1a0+0x8a10,150,true);if(!loading)menus.showRaceWaiting(waiting);
 try{
  if(options.replay)loading?.update('Loading car resources','Resolving replay cars and track resources');
  let runtime=options.replay?await createNativeReplayRaceRuntime(data,options.menu,options.replay,{resetMouse:menus.resetRaceMouse,async key(){aborted();const key=await menus.raceEntryKey();aborted();return key;},replayProgress(frame,target){loading?.update('Fast-forwarding replay',`${frame.toLocaleString()} / ${target.toLocaleString()} frames${target?` · ${Math.floor(frame*100/target)}%`:''}`);}},progress):await createNativeManualRaceRuntime(data,options.menu,{resetMouse:menus.resetRaceMouse},progress);if(options.spawn&&!options.replay)runtime.session.teleportPlayer(options.spawn);aborted();
  let soundUpdateSerial=0;
  onSoundSettingsChanged=()=>{
   const serial=++soundUpdateSerial;
   void loadConfiguredEngineSoundOverrides(deviceData).then(next=>{
    if(serial!==soundUpdateSerial)return;
    engineSoundOverrides=next;
    data=next?{...deviceData,engineSoundOverrides:next}:deviceData;
    const writes=runtime.updateEngineSoundOverrides(next);
    if(writes.length)audio?.write(writes);
    console.info('[Sound Mod] Live settings applied',{presets:Object.keys(next??{}),writes:writes.length});
   }).catch(reason=>console.error('[Sound Mod] Live settings update failed',reason));
  };
  window.addEventListener('playstunts-dx-sound-mod-settings-changed',onSoundSettingsChanged);
  let lastSoundSettings=localStorage.getItem(SOUND_MOD_SETTINGS_KEY)??'';
  soundSettingsTimer=window.setInterval(()=>{
   const current=localStorage.getItem(SOUND_MOD_SETTINGS_KEY)??'';
   if(current===lastSoundSettings)return;
   lastSoundSettings=current;onSoundSettingsChanged();
  },100);
  audio=data.soundDevice?.kind==='mt32'?(rolandAudio=createBrowserMt32RaceAudio(context,options.mt32Output!,[],()=>runtime.tick(presentation!.devices))):data.soundDevice?.kind==='tandy'?(pcAudio=createBrowserTandyRaceAudio(context,runtime.initialWrites,()=>runtime.tick(presentation!.devices))):data.soundDevice?.kind==='pc-speaker'?(pcAudio=createBrowserPcSpeakerRaceAudio(context,runtime.initialWrites,()=>runtime.tick(presentation!.devices))):await createBrowserRaceAudio(context,runtime.initialWrites,()=>runtime.tick(presentation!.devices));aborted();
  rolandAudio?.prepare(runtime.initialWrites);
  const pump=()=>{aborted();audio!.pump();},showWaiting=()=>presentation?presentation.waiting():menus.showRaceWaiting(runtime.session.state.memory);
  const preparePresentation=async()=>{loading?.update('Preparing replay graphics','Creating the race presentation');const alternate=options.displayMode?await prepareBrowserNativeManualDisplay(data,options.displayMode,()=>runtime.session.state.memory,options.hercules):undefined;aborted();if(alternate)runtime.useDisplay(alternate.display);return menus.allocatedRacePresentation(runtime,pump,alternate);};
  presentation=await preparePresentation();loading?.update('Replay ready','Starting playback');
  for(;;){
   options.onStage?.('race');
   runtime=await runBrowserAllocatedRaceLoop(runtime,menus,presentation,audio,{signal,showWaiting,onFrame:options.onFrame,editorTest:options.editorTest,confirmBackToEditor:confirmBackToEditorDialog,
    async loadReplay(before){
     const loaded=await menus.loadAllocatedRaceReplay(data,before,{showWaiting,progress,writeAudio:audio!.write},presentation);aborted();
     if(!loaded)return;runtime=loaded;presentation=await preparePresentation();return {runtime,presentation};
    },
   });
   aborted();if(!runtime.session.state.memory[0x2d1a0+0x8018])break;
   rolandAudio?.suspend(()=>{advanceOriginalHardwareClock(runtime.session.state.memory,0x2d1a0);});options.onStage?.('results');const action=await menus.allocatedRaceResults(data,runtime,progress,options.displayMode);options.stopMusic();aborted();
   if(action!==0&&action!==1)break;
   options.onStage?.(action===0?'seeking':'loading');showWaiting();
   runtime=await reopenNativeManualRaceRuntime(data,runtime.session.state.memory,action===0?'replay':'fresh',{resetMouse:menus.resetRaceMouse,async key(){aborted();return menus.raceEntryKey();}},progress);aborted();
   if(rolandAudio)rolandAudio.prepare(runtime.initialWrites);else audio.write(runtime.initialWrites);
   const previous=presentation;presentation=await preparePresentation();previous.close();rolandAudio?.resume();
  }
  return runtime.releaseMenuState();
 }finally{
  if(options.editorTest){document.removeEventListener('pointerover',editorButtonHover,true);document.removeEventListener('pointerout',editorButtonHover,true);}
  window.removeEventListener('playstunts-dx-sound-mod-settings-changed',onSoundSettingsChanged);if(soundSettingsTimer)window.clearInterval(soundSettingsTimer);presentation?.close();audio?.close();options.stopMusic();menus.setInputActive(false);
 }
}
