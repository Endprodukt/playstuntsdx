import {createNativeDialogRuntime,type NativeDialogHost} from './native-dialog-runtime.ts';
import {drawOriginalOptionsBackground} from './options-screen-raster.ts';
import {originalOptionsFlow} from './options-menu-flow.ts';
import {originalOptionAction,type OriginalOptionSettings} from './options-actions.ts';
import {enhancedTexturesEnabled,setEnhancedTexturesEnabled} from './enhanced-textures.ts';
import {desktopInputDevice,setDesktopInputDevice,type DesktopInputDevice} from './desktop-wheel-input.ts';

type DesktopSoundDevice='off'|'pc-speaker'|'tandy'|'adlib'|'sound-blaster'|'mt32';
type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
const soundKey='playstunts-dx-sound-device';
const graphicsKey='playstunts-dx-enhanced-graphics';
const audioUpdateKey='playstunts-dx-audio-update';
const soundDevices:ReadonlyArray<{id:DesktopSoundDevice;label:string}>=[
 {id:'off',label:'SOUND OFF'},
 {id:'pc-speaker',label:'PC SPEAKER'},
 {id:'tandy',label:'TANDY / PCJR'},
 {id:'adlib',label:'ADLIB'},
 {id:'sound-blaster',label:'SOUND BLASTER'},
 {id:'mt32',label:'ROLAND MT-32'},
];
const inputDevices:ReadonlyArray<DesktopInputDevice>=['keyboard','joystick','mouse','wheel'];
const bytes=(text:string)=>Array.from(text,character=>character.charCodeAt(0)).concat(0);
const soundDialog=bytes('PLAYSTUNTS DX SOUND]'+soundDevices.map(device=>`[${device.label}]`).join(''));
const missingMt32Dialog=bytes('ROLAND MT-32 ROMS NOT FOUND]PUT THE CONTROL AND PCM ROMS]IN THE MT32 FOLDER][OK]');
const exitGameDialog=bytes('EXIT GAME?][NO][YES]');

function enabledSetting(key:string,defaultValue=true){
 const saved=window.localStorage.getItem(key)?.trim().toLowerCase();
 if(saved===undefined||saved===null||saved==='')return defaultValue;
 return !['0','false','no','off'].includes(saved);
}
function desktopEnhancedGraphicsButton(){
 if(typeof document==='undefined')return null;
 return document.querySelector<HTMLButtonElement>('.desktop-game-shell .game-toolbar button[aria-pressed]');
}
function desktopEnhancedGraphicsEnabled(toggle:HTMLButtonElement){
 const saved=window.localStorage.getItem(graphicsKey)?.trim().toLowerCase();
 if(saved!==undefined&&saved!==null&&saved!=='')return !['0','false','no','off'].includes(saved);
 return toggle.getAttribute('aria-pressed')==='true';
}
function desktopSoundDevice():DesktopSoundDevice|null{
 if(typeof window==='undefined'||typeof document==='undefined'||!document.querySelector('.desktop-game-shell'))return null;
 const saved=window.localStorage.getItem(soundKey);
 return soundDevices.some(device=>device.id===saved)?saved as DesktopSoundDevice:'sound-blaster';
}
function desktopSoundLabel(device:DesktopSoundDevice){return soundDevices.find(candidate=>candidate.id===device)?.label??'SOUND BLASTER';}
async function desktopMt32Ready(){
 const tauri=(window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__;
 if(!tauri?.core)return true;
 try{await tauri.core.invoke<void>('check_mt32_roms');return true;}catch{return false;}
}
function selectDesktopSound(device:DesktopSoundDevice){
 window.localStorage.setItem(soundKey,device);
 window.setTimeout(()=>window.location.reload(),0);
}
function choice(text:string){return [91,...Array.from(text,character=>character.charCodeAt(0)),93];}
function optionsWithDxChoices(original:ReadonlyArray<number>,enhanced:boolean,textures:boolean,sound:DesktopSoundDevice,audioUpdate:boolean){
 const result:number[]=[];let originalChoice=0;
 for(let i=0;i<original.length;i++){
  const value=original[i]&255;
  if(value===91){
   if(originalChoice===3)result.push(...choice(`SOUND DEVICE: ${desktopSoundLabel(sound)}`));
   if(originalChoice===5){
    result.push(...choice(`ENHANCED GRAPHICS: ${enhanced?'ON':'OFF'}`));
    result.push(...choice(`ENHANCED TEXTURES: ${textures?'ON':'OFF'}`));
    result.push(...choice(`AUDIO UPDATE: ${audioUpdate?'ON':'OFF'}`));
    result.push(...choice('EXIT GAME'));
    while(i+1<original.length&&(original[i+1]&255)!==93)i++;
    if(i+1<original.length)i++;
    originalChoice++;
    continue;
   }
   originalChoice++;
  }
  result.push(value);
 }
 return result;
}
function inputDeviceWithWheel(original:ReadonlyArray<number>){
 const result=Array.from(original,value=>value&255),end=result.indexOf(0),insertAt=end<0?result.length:end;
 result.splice(insertAt,0,...choice('Wheel'));
 if(end<0)result.push(0);
 return result;
}

export interface NativeOptionsHost extends NativeDialogHost {
 settings:OriginalOptionSettings;
 audio(operation:'pause-audio'|'resume-audio'|'toggle-music'|'toggle-sound'):Promise<number>;
 calibrateJoystick():Promise<void>;
 replayPath:string;
 loadReplay(selection:{path:string;name:string}):Promise<void>;
}
export interface NativeOptionsPresentation {
 dialogs:ReturnType<typeof createNativeDialogRuntime>;
 background():void;
 capture():{restore():void;close():void};
}
export async function runNativeOptions(host:NativeOptionsHost,display?:NativeOptionsPresentation):Promise<'menu'|'replay'|'exit'>{
 const dialogs=display?.dialogs??createNativeDialogRuntime(host),flow=originalOptionsFlow(host.settings);
 if(display)display.background();else drawOriginalOptionsBackground(host.pixels,host.font,host.resources);host.present();
 let step=flow.next(),selection:{path:string;name:string}|undefined;
 while(!step.done){
  const request=step.value;let result=0;
  if(request.type==='options'){
   const toggle=desktopEnhancedGraphicsButton(),sound=desktopSoundDevice();
   if(!toggle||!sound)result=await dialogs.dialog('emop',2,0,4);
   else{
    const enhanced=desktopEnhancedGraphicsEnabled(toggle),textures=enhancedTexturesEnabled(),audioUpdate=enabledSetting(audioUpdateKey,true);
    host.resources.edxo=optionsWithDxChoices(host.resources.emop,enhanced,textures,sound,audioUpdate);
    const selected=await dialogs.dialog('edxo',2,0,4);
    if(selected===3){
     host.resources.edxs=soundDialog;
     const current=soundDevices.findIndex(device=>device.id===sound);
     const soundSelection=await dialogs.dialog('edxs',2,current<0?4:current,1);
     if(soundSelection>=0&&soundSelection<soundDevices.length){
      const requested=soundDevices[soundSelection].id;
      if(requested==='mt32'&&!await desktopMt32Ready()){
       host.resources.edxr=missingMt32Dialog;
       await dialogs.dialog('edxr',2,0,1);
      }else if(requested!==sound)selectDesktopSound(requested);
     }
     result=-2;
    }else if(selected===4)result=3;
    else if(selected===5)result=4;
    else if(selected===6){
     const next=!enhanced;
     window.localStorage.setItem(graphicsKey,String(next));
     if((toggle.getAttribute('aria-pressed')==='true')!==next)toggle.click();
     await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
     result=-2;
    }else if(selected===7){
     setEnhancedTexturesEnabled(!textures);
     result=-2;
    }else if(selected===8){
     window.localStorage.setItem(audioUpdateKey,String(!audioUpdate));
     window.setTimeout(()=>window.location.reload(),120);
     result=-2;
    }else if(selected===9)result=5;
    else if(selected===10)result=6;
    else result=selected;
   }
  }
  else if(request.type==='input-device'){
   if(!desktopSoundDevice())result=await dialogs.dialog('emid',2,request.selected,1);
   else{
    host.resources.edxi=inputDeviceWithWheel(host.resources.emid);
    const selected=await dialogs.dialog('edxi',2,desktopInputDevice()==='wheel'?3:request.selected,1);
    if(selected===3){
     setDesktopInputDevice('wheel');host.settings.mouse=false;host.settings.joystick=true;
    }else if(selected>=0&&selected<=2)setDesktopInputDevice(inputDevices[selected]);
    result=selected;
   }
  }
  else if(request.type==='select-replay'){
   selection=await dialogs.file(host.replayPath,'.rpl',String.fromCharCode(...host.resources.erep).split('\0')[0],path=>{host.replayPath=path;});
   if(selection){host.replayPath=selection.path;result=1;}
  }else if(request.type==='load-replay'){
   if(!selection)throw Error('Original replay dispatch requires a selected file');
   await host.loadReplay(selection);
  }else{
   const name=request.type==='configure-input'?request.device:request.type;
   if(name==='joystick'){await host.calibrateJoystick();step=flow.next(0);continue;}
   if(name==='exit-dos'&&desktopSoundDevice())host.resources.edos=exitGameDialog;
   const action=originalOptionAction(name,host.settings);let effect=action.next(),saved:Uint8Array|undefined,retained:ReturnType<NativeOptionsPresentation['capture']>|undefined;
   try{while(!effect.done){let reply=0;const value=effect.value;
    if(value.type==='save'){if(display){retained?.close();retained=display.capture();}else saved=host.pixels.slice();}
    else if(value.type==='restore'){if(retained){retained.restore();retained.close();retained=undefined;}else {if(!saved)throw Error('Original options restore requires a saved screen');host.pixels.set(saved);}host.present();}
    else if(value.type==='dialog')reply=await dialogs.dialog(value.resource,value.mode,value.selected,value.border);
    else if(value.type==='exit')return 'exit';
    else reply=await host.audio(value.type);
    effect=action.next(reply);
   }}finally{retained?.close();}
  }
  step=flow.next(result);
 }
 return step.value?'replay':'menu';
}
