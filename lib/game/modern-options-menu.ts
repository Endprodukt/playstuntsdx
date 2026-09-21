import type {NativeMenuInput} from './native-dialog-runtime.ts';
import type {OriginalOptionSettings} from './options-actions.ts';
import {desktopInputDevice,setDesktopInputDevice,type DesktopInputDevice} from './desktop-wheel-input.ts';
import {reloadDesktopForceFeedbackConfig} from './desktop-force-feedback.ts';
import {ENHANCED_RENDER_SCALES,enhancedRenderScale,setEnhancedRenderScale} from './enhanced-resolution-settings.ts';
import {enhancedBackgroundEnabled,enhancedCockpitEnabled,setEnhancedBackgroundEnabled,setEnhancedCockpitEnabled} from './enhanced-textures.ts';
import {enhancedFovWidth,setEnhancedFovWidth} from './enhanced-view-settings.ts';
import {
 enhancedChaseCameraPosition,resetEnhancedChaseCameraPositions,setEnhancedChaseCameraPosition,
 type EnhancedChaseCameraPresetLevel,type EnhancedChaseCameraSetting,
} from './enhanced-chase-camera-settings.ts';
import {opponentAiMode,setOpponentAiMode} from './enhanced-opponent-settings.ts';

type Tab='gameplay'|'video'|'sound'|'controls';
type FocusZone='tabs'|'rows'|'footer';
type FooterAction='back'|'exit'|'done';
type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
type NativeConfigFile={content:string;path:string;created:boolean};
type DesktopSoundDevice='off'|'pc-speaker'|'tandy'|'adlib'|'sound-blaster'|'mt32';
type FfbNumericRowId=
 |'ffb-strength'|'ffb-physics-strength'|'ffb-physics-limit'|'ffb-max-force'
 |'ffb-centering-base'|'ffb-centering-speed'|'ffb-slide-slip'|'ffb-slide-spin'
 |'ffb-grass-strength'|'ffb-grass-frequency-min'|'ffb-grass-frequency-max'
 |'ffb-ramp-min-pitch'|'ffb-ramp-max-pitch'|'ffb-ramp-min-strength'|'ffb-ramp-max-strength'|'ffb-ramp-duration'
 |'ffb-landing-min-fall'|'ffb-landing-max-fall'|'ffb-landing-min-strength'|'ffb-landing-max-strength'|'ffb-landing-duration'
 |'ffb-shift-strength'|'ffb-shift-duration'
 |'ffb-engine-min-strength'|'ffb-engine-max-strength'|'ffb-engine-frequency-min'|'ffb-engine-frequency-max'
 |'ffb-crash-min-strength'|'ffb-crash-max-strength'|'ffb-crash-speed-max'|'ffb-crash-rebound'|'ffb-crash-main-duration'|'ffb-crash-total-duration';

type RowId=
 |'opponent-ai'|'music'|'sound-effects'|'sound-device'|'open-map'|'menu-style'|'track-editor'|'audio-update'
 |'dx-graphics'|'resolution'|'background'|'cockpit'|'fov'|'fps'|'original-detail'
 |'input-device'|'deadzone'|'linearity'|'show-f8'|'ffb-enabled'|'ffb-details'|FfbNumericRowId
 |'close-distance'|'close-height'|'standard-distance'|'standard-height'|'far-distance'|'far-height'|'reset-camera';

interface OptionRow {id:RowId;label:string;value:string;disabled?:boolean;actionOnly?:boolean;numeric?:boolean;group?:string}
interface PointerAction {type:'tab'|'row'|'minus'|'plus'|'value'|'footer'|'confirm';index:number}

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
const originalGraphicsKey='playstunts-dx-original-graphics-level';
const ffbEnabledKey='playstunts-dx-force-feedback-enabled';
const ffbStrengthKey='playstunts-dx-force-feedback-strength';

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
type FfbField={id:FfbNumericRowId;label:string;section:string;key:string;min:number;max:number;step:number;decimals:number;unit:string;group:string;help:string};
type FfbState={enabled:boolean;values:Record<FfbNumericRowId,number>};
const ffbFields:ReadonlyArray<FfbField>=[
 {id:'ffb-strength',label:'Overall Strength',section:'ForceFeedback',key:'Strength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FORCE FEEDBACK',help:'Master output multiplier. 50% is the normal base output; 100% doubles it.'},
 {id:'ffb-physics-strength',label:'Physics Strength',section:'General',key:'PhysicsStrength',min:0,max:300,step:5,decimals:0,unit:'%',group:'FFB · GENERAL',help:'Scales steering, slide and surface forces before the final force limit is applied.'},
 {id:'ffb-physics-limit',label:'Physics Limit',section:'General',key:'PhysicsLimit',min:10,max:100,step:1,decimals:0,unit:'%',group:'FFB · GENERAL',help:'Caps the combined continuous physics force before short bump and impact effects are added.'},
 {id:'ffb-max-force',label:'Maximum Force',section:'General',key:'MaxForce',min:10,max:100,step:1,decimals:0,unit:'%',group:'FFB · GENERAL',help:'Final safety ceiling for every force-feedback effect combined.'},
 {id:'ffb-centering-base',label:'Centering Base',section:'Centering',key:'BaseForce',min:0,max:100,step:.5,decimals:1,unit:'%',group:'FFB · CENTERING',help:'Baseline steering-centering force, including at very low speed.'},
 {id:'ffb-centering-speed',label:'Centering Speed',section:'Centering',key:'SpeedForce',min:0,max:100,step:.5,decimals:1,unit:'%',group:'FFB · CENTERING',help:'Additional centering force that grows with vehicle speed.'},
 {id:'ffb-slide-slip',label:'Slide Slip Force',section:'Slide',key:'SlipForce',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · SLIDE',help:'Counter-steer force generated by tyre slip while the car is sliding.'},
 {id:'ffb-slide-spin',label:'Slide Spin Force',section:'Slide',key:'SpinForce',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · SLIDE',help:'Counter-steer contribution from the car spin/yaw state.'},
 {id:'ffb-grass-strength',label:'Grass Strength',section:'Grass',key:'Strength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · GRASS',help:'Strength of the surface rumble while wheels are running over grass.'},
 {id:'ffb-grass-frequency-min',label:'Grass Freq Min',section:'Grass',key:'FrequencyMin',min:1,max:30,step:1,decimals:0,unit:'Hz',group:'FFB · GRASS',help:'Lowest grass-rumble frequency used near low speed.'},
 {id:'ffb-grass-frequency-max',label:'Grass Freq Max',section:'Grass',key:'FrequencyMax',min:1,max:40,step:1,decimals:0,unit:'Hz',group:'FFB · GRASS',help:'Highest grass-rumble frequency reached as speed increases.'},
 {id:'ffb-ramp-min-pitch',label:'Ramp Pitch Min',section:'Ramp',key:'MinPitchDelta',min:0,max:128,step:1,decimals:0,unit:'',group:'FFB · RAMPS',help:'Smallest grounded chassis pitch change that can trigger a ramp bump.'},
 {id:'ffb-ramp-max-pitch',label:'Ramp Pitch Max',section:'Ramp',key:'MaxPitchDelta',min:1,max:256,step:1,decimals:0,unit:'',group:'FFB · RAMPS',help:'Pitch change that reaches the configured maximum ramp-bump strength.'},
 {id:'ffb-ramp-min-strength',label:'Ramp Strength Min',section:'Ramp',key:'MinStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · RAMPS',help:'Minimum force of a detected ramp or slope-edge bump.'},
 {id:'ffb-ramp-max-strength',label:'Ramp Strength Max',section:'Ramp',key:'MaxStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · RAMPS',help:'Maximum force of a detected ramp or slope-edge bump.'},
 {id:'ffb-ramp-duration',label:'Ramp Duration',section:'Ramp',key:'DurationMs',min:30,max:250,step:10,decimals:0,unit:'ms',group:'FFB · RAMPS',help:'Length of the short force pulse produced at ramp and slope transitions.'},
 {id:'ffb-landing-min-fall',label:'Landing Fall Min',section:'Landing',key:'MinFallSpeed',min:0,max:1000,step:10,decimals:0,unit:'',group:'FFB · LANDING',help:'Minimum downward speed required before a landing impact produces feedback.'},
 {id:'ffb-landing-max-fall',label:'Landing Fall Max',section:'Landing',key:'MaxFallSpeed',min:1,max:2000,step:10,decimals:0,unit:'',group:'FFB · LANDING',help:'Downward speed at which landing feedback reaches its configured maximum strength.'},
 {id:'ffb-landing-min-strength',label:'Landing Strength Min',section:'Landing',key:'MinStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · LANDING',help:'Minimum force of a qualifying landing impact.'},
 {id:'ffb-landing-max-strength',label:'Landing Strength Max',section:'Landing',key:'MaxStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · LANDING',help:'Maximum force of a hard landing impact.'},
 {id:'ffb-landing-duration',label:'Landing Duration',section:'Landing',key:'DurationMs',min:30,max:300,step:10,decimals:0,unit:'ms',group:'FFB · LANDING',help:'Length of the landing-impact force pulse.'},
 {id:'ffb-shift-strength',label:'Gear Shift Strength',section:'GearShift',key:'Strength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · GEAR SHIFT',help:'Strength of the short tactile kick when a gear change is detected.'},
 {id:'ffb-shift-duration',label:'Gear Shift Duration',section:'GearShift',key:'DurationMs',min:30,max:250,step:10,decimals:0,unit:'ms',group:'FFB · GEAR SHIFT',help:'Length of the gear-shift feedback pulse.'},
 {id:'ffb-engine-min-strength',label:'Engine Strength Min',section:'Engine',key:'MinStrength',min:0,max:30,step:.1,decimals:1,unit:'%',group:'FFB · ENGINE',help:'Engine vibration strength near idle.'},
 {id:'ffb-engine-max-strength',label:'Engine Strength Max',section:'Engine',key:'MaxStrength',min:0,max:30,step:.1,decimals:1,unit:'%',group:'FFB · ENGINE',help:'Engine vibration strength near maximum RPM.'},
 {id:'ffb-engine-frequency-min',label:'Engine Freq Min',section:'Engine',key:'FrequencyMin',min:1,max:10,step:1,decimals:0,unit:'Hz',group:'FFB · ENGINE',help:'Engine vibration frequency near idle.'},
 {id:'ffb-engine-frequency-max',label:'Engine Freq Max',section:'Engine',key:'FrequencyMax',min:2,max:12,step:1,decimals:0,unit:'Hz',group:'FFB · ENGINE',help:'Engine vibration frequency near maximum RPM.'},
 {id:'ffb-crash-min-strength',label:'Crash Strength Min',section:'Crash',key:'MinStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · CRASH',help:'Minimum strength of an accepted crash impact.'},
 {id:'ffb-crash-max-strength',label:'Crash Strength Max',section:'Crash',key:'MaxStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · CRASH',help:'Maximum strength of a high-speed crash impact.'},
 {id:'ffb-crash-speed-max',label:'Crash Max @ Speed',section:'Crash',key:'SpeedForMaxMph',min:10,max:200,step:5,decimals:0,unit:'mph',group:'FFB · CRASH',help:'Vehicle speed at which a crash reaches the configured maximum impact strength.'},
 {id:'ffb-crash-rebound',label:'Crash Rebound',section:'Crash',key:'ReboundStrength',min:0,max:100,step:1,decimals:0,unit:'%',group:'FFB · CRASH',help:'Strength of the opposite-direction rebound after the main crash hit.'},
 {id:'ffb-crash-main-duration',label:'Crash Hit Duration',section:'Crash',key:'MainDurationMs',min:30,max:300,step:10,decimals:0,unit:'ms',group:'FFB · CRASH',help:'Duration of the main crash-force pulse.'},
 {id:'ffb-crash-total-duration',label:'Crash Total Duration',section:'Crash',key:'TotalDurationMs',min:60,max:500,step:10,decimals:0,unit:'ms',group:'FFB · CRASH',help:'Total crash effect time including the rebound phase.'},
];
const ffbDefaults:Record<FfbNumericRowId,number>={
 'ffb-strength':50,'ffb-physics-strength':180,'ffb-physics-limit':90,'ffb-max-force':98,
 'ffb-centering-base':5.5,'ffb-centering-speed':24.5,'ffb-slide-slip':34,'ffb-slide-spin':20,
 'ffb-grass-strength':13,'ffb-grass-frequency-min':15,'ffb-grass-frequency-max':33,
 'ffb-ramp-min-pitch':2,'ffb-ramp-max-pitch':24,'ffb-ramp-min-strength':16,'ffb-ramp-max-strength':48,'ffb-ramp-duration':90,
 'ffb-landing-min-fall':190,'ffb-landing-max-fall':593,'ffb-landing-min-strength':28,'ffb-landing-max-strength':90,'ffb-landing-duration':120,
 'ffb-shift-strength':15,'ffb-shift-duration':110,
 'ffb-engine-min-strength':.8,'ffb-engine-max-strength':2,'ffb-engine-frequency-min':3,'ffb-engine-frequency-max':6,
 'ffb-crash-min-strength':72,'ffb-crash-max-strength':100,'ffb-crash-speed-max':70,'ffb-crash-rebound':32,'ffb-crash-main-duration':150,'ffb-crash-total-duration':240,
};
const ffbFieldById=new Map<FfbNumericRowId,FfbField>(ffbFields.map(field=>[field.id,field]));
const tabOrder:readonly Tab[]=['gameplay','video','sound','controls'];
const tabLabels:Record<Tab,string>={gameplay:'GAMEPLAY',video:'VIDEO',sound:'SOUND',controls:'CONTROLS'};
const footerLabels:Record<FooterAction,string>={back:'BACK',exit:'EXIT GAME',done:'DONE'};
const optionHelp:Partial<Record<RowId,string>>={
 'opponent-ai':'Original keeps the exact classic opponent logic. Enhanced enables DX look-ahead, racing lines, passing, defending and recovery with driver-specific personalities.',
 'music':'Turns the original Stunts music on or off.',
 'sound-effects':'Turns game sound effects on or off. Per-car engine sounds are configured in Car Select or the F8 panel.',
 'sound-device':'Selects the emulated sound hardware. A changed device is used on the next game start.',
 'open-map':'Automatically opens the race map whenever a race or restart begins.',
 'menu-style':'Switches between the modern PlayStunts DX menus and the original Stunts menu style.',
 'track-editor':'Chooses the modern Bliss track editor or the original Stunts editor.',
 'audio-update':'Uses the newer PlayStunts DX audio update path. Disable mainly for compatibility or troubleshooting.',
 'dx-graphics':'Enables the enhanced PlayStunts DX 3D renderer instead of the original Stunts race renderer.',
 'resolution':'Sets the internal DX render resolution. Higher values sharpen 3D edges but require more GPU performance.',
 'background':'Uses high-resolution panorama and background artwork where an enhanced asset is available.',
 'cockpit':'Uses the high-resolution cockpit artwork while driving with the enhanced renderer.',
 'fov':'Widens the enhanced 3D view horizontally. Original keeps the classic 4:3 field of view.',
 'fps':'Shows or hides the frame-rate counter while DX Graphics is active.',
 'original-detail':'The original Stunts graphics-detail setting. Higher levels draw more legacy scene detail; it is separate from DX internal resolution.',
 'input-device':'Selects the device used for driving: keyboard, joystick, mouse or wheel.',
 'deadzone':'Wheel only. Ignores small steering movement around the calibrated centre to prevent unwanted drift or jitter.',
 'linearity':'Wheel only. Higher values make steering less sensitive around centre while preserving full steering lock.',
 'show-f8':'Shows or hides the Options [F8] button. The F8 shortcut itself remains available.',
 'ffb-enabled':'Master force-feedback switch. Available when Driving Input Device is set to Wheel.',
 'ffb-details':'Opens the detailed force-feedback tuning list. Available when Driving Input Device is set to Wheel.',
 'close-distance':'Distance of the Close enhanced chase camera behind the car.',
 'close-height':'Height of the Close enhanced chase camera above the car.',
 'standard-distance':'Distance of the Standard enhanced chase camera behind the car.',
 'standard-height':'Height of the Standard enhanced chase camera above the car.',
 'far-distance':'Distance of the Far enhanced chase camera behind the car.',
 'far-height':'Height of the Far enhanced chase camera above the car.',
 'reset-camera':'Restores all Close, Standard and Far chase-camera distances and heights to their defaults.',
};
const tabHelp:Record<Tab,string>={
 gameplay:'General game and menu behaviour.',
 video:'Rendering, display quality and enhanced chase-camera settings.',
 sound:'Music, sound effects, emulated sound hardware and DX audio behaviour.',
 controls:'Driving input and wheel-response settings.',
};
const rowRegionBottom=101;
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
function configValue(content:string,section:string,key:string){
 let current='';
 for(const raw of content.replace(/^\uFEFF/,'').split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith(';')||line.startsWith('#'))continue;
  const heading=line.match(/^\[([^\]]+)\]$/);if(heading){current=heading[1].trim();continue;}
  if(current.toLowerCase()!==section.toLowerCase())continue;
  const at=line.indexOf('=');if(at<0)continue;
  if(line.slice(0,at).trim().toLowerCase()===key.toLowerCase())return line.slice(at+1).trim();
 }
 return undefined;
}
function numericConfig(content:string,field:FfbField){
 const raw=Number(configValue(content,field.section,field.key)),fallback=ffbDefaults[field.id];
 return Number.isFinite(raw)?clamp(raw,field.min,field.max):fallback;
}
async function loadFfbSettings():Promise<FfbState>{
 let content='';
 const core=tauriCore();
 if(core){try{content=(await core.invoke<NativeConfigFile>('native_config')).content;}catch(reason){console.warn('[Modern Options] FFB config load failed:',reason);}}
 const rawEnabled=configValue(content,'ForceFeedback','Enabled');
 const enabled=rawEnabled===undefined?storedEnabled(ffbEnabledKey,false):!['0','false','no','off'].includes(rawEnabled.toLowerCase());
 const values={} as Record<FfbNumericRowId,number>;
 for(const field of ffbFields)values[field.id]=numericConfig(content,field);
 if(!content){
  const saved=Number(window.localStorage.getItem(ffbStrengthKey));
  if(Number.isFinite(saved))values['ffb-strength']=clamp(saved,0,100);
 }
 setBool(ffbEnabledKey,enabled);window.localStorage.setItem(ffbStrengthKey,String(values['ffb-strength']));
 return {enabled,values};
}
function formatFfbValue(field:FfbField,value:number){
 const number=field.decimals?value.toFixed(field.decimals):String(Math.round(value));
 return field.unit==='%'?number+'%':field.unit?number+' '+field.unit:number;
}
function constrainedFfbValue(state:FfbState,field:FfbField,value:number){
 let min=field.min,max=field.max;const v=state.values;
 switch(field.id){
  case 'ffb-grass-frequency-min':max=v['ffb-grass-frequency-max'];break;
  case 'ffb-grass-frequency-max':min=v['ffb-grass-frequency-min'];break;
  case 'ffb-ramp-min-pitch':max=v['ffb-ramp-max-pitch']-1;break;
  case 'ffb-ramp-max-pitch':min=v['ffb-ramp-min-pitch']+1;break;
  case 'ffb-ramp-min-strength':max=v['ffb-ramp-max-strength'];break;
  case 'ffb-ramp-max-strength':min=v['ffb-ramp-min-strength'];break;
  case 'ffb-landing-min-fall':max=v['ffb-landing-max-fall']-1;break;
  case 'ffb-landing-max-fall':min=v['ffb-landing-min-fall']+1;break;
  case 'ffb-landing-min-strength':max=v['ffb-landing-max-strength'];break;
  case 'ffb-landing-max-strength':min=v['ffb-landing-min-strength'];break;
  case 'ffb-engine-min-strength':max=v['ffb-engine-max-strength'];break;
  case 'ffb-engine-max-strength':min=v['ffb-engine-min-strength'];break;
  case 'ffb-engine-frequency-min':max=v['ffb-engine-frequency-max'];break;
  case 'ffb-engine-frequency-max':min=v['ffb-engine-frequency-min'];break;
  case 'ffb-crash-min-strength':max=v['ffb-crash-max-strength'];break;
  case 'ffb-crash-max-strength':min=v['ffb-crash-min-strength'];break;
  case 'ffb-crash-main-duration':max=v['ffb-crash-total-duration']-20;break;
  case 'ffb-crash-total-duration':min=v['ffb-crash-main-duration']+20;break;
 }
 const stepped=Math.round(value/field.step)*field.step,factor=10**field.decimals;
 return Math.round(clamp(stepped,min,max)*factor)/factor;
}
async function persistFfbEnabled(state:FfbState,value:boolean){
 state.enabled=value;setBool(ffbEnabledKey,value);await persistConfig('ForceFeedback','Enabled',String(value));await reloadDesktopForceFeedbackConfig();
}
async function persistFfbValue(state:FfbState,field:FfbField,value:number){
 const next=constrainedFfbValue(state,field,value);state.values[field.id]=next;
 if(field.id==='ffb-strength')window.localStorage.setItem(ffbStrengthKey,String(next));
 await persistConfig(field.section,field.key,String(next));await reloadDesktopForceFeedbackConfig();
}

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
 tab:()=>Tab;zone:()=>FocusZone;row:()=>number;footer:()=>number;details:()=>boolean;confirm:()=>boolean;confirmChoice:()=>number;
}){
 const ctx=canvas.getContext('2d')!,sx=()=>canvas.width/320,sy=()=>canvas.height/200;
 const tabBounds=tabOrder.map((_,i)=>({x:8,y:49+i*31,w:66,h:25}));
 const content={x:80,y:44,w:233,h:127},footerBounds=[
  {x:81,y:176,w:112,h:18},{x:198,y:176,w:115,h:18},
 ];
 const footerOrder=()=>state.details()?(['back','done'] as const):(['exit','done'] as const);
 const currentRowHeight=()=>state.details()?9.5:13.5;
 const currentSectionHeight=()=>state.details()?5.8:8;
 let hover:PointerAction|undefined;

 const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='#3b3b3b',radius=5,lineWidth=1)=>{
  const X=x*sx(),Y=y*sy(),W=w*sx(),H=h*sy(),R=Math.max(2,Math.min(radius*sx(),radius*sy()));
  ctx.beginPath();ctx.roundRect(X,Y,W,H,R);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(lineWidth,Math.min(sx(),sy()));ctx.stroke();
 };
 const label=(value:string,x:number,y:number,size=7,colour='#eee',weight=500,align:CanvasTextAlign='left')=>{
  ctx.fillStyle=colour;ctx.font=`${weight} ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x*sx(),y*sy());
 };
 const wrapped=(value:string,maxWidth:number,size:number,maxLines=2)=>{
  ctx.font=`500 ${Math.max(9,size*sy())}px system-ui,Segoe UI,sans-serif`;
  const words=value.split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
  for(const word of words){
   const next=line?line+' '+word:word;
   if(ctx.measureText(next).width<=maxWidth*sx()){line=next;continue;}
   if(line)lines.push(line);line=word;if(lines.length===maxLines-1)break;
  }
  if(line&&lines.length<maxLines)lines.push(line);
  if(lines.length===maxLines){let last=lines[maxLines-1];while(last.length>1&&ctx.measureText(last+'…').width>maxWidth*sx())last=last.slice(0,-1);if(last!==lines[maxLines-1])lines[maxLines-1]=last+'…';}
  return lines;
 };
 const focused=(type:PointerAction['type'],index:number)=>{
  const rowType=type==='row'||type==='minus'||type==='plus'||type==='value';
  const zone=state.zone(),keyboard=(type==='tab'&&zone==='tabs')||(rowType&&zone==='rows')||(type==='footer'&&zone==='footer');
  const selected=type==='tab'?tabOrder.indexOf(state.tab()):rowType?state.row():type==='footer'?state.footer():-1;
  const hovered=rowType
   ?(hover?.index===index&&['row','minus','plus','value'].includes(hover.type))
   :hover?.type===type&&hover.index===index;
  return (keyboard&&selected===index)||hovered;
 };
 const rows=()=>getRows();
 const layoutFrom=(start:number)=>{
  const all=rows(),items:Array<{index:number;y:number}>=[],sections:Array<{label:string;y:number}>=[];
  const rowHeight=currentRowHeight(),sectionHeight=currentSectionHeight();
  let y=content.y+18,activeGroup:string|undefined;
  for(let index=start;index<all.length;index++){
   const item=all[index],group=item.group;
   if(group&&group!==activeGroup){
    if(y+sectionHeight+rowHeight>content.y+rowRegionBottom)break;
    sections.push({label:group,y:y+sectionHeight/2});y+=sectionHeight;activeGroup=group;
   }else if(!group)activeGroup=undefined;
   if(y+rowHeight>content.y+rowRegionBottom)break;
   items.push({index,y:y+rowHeight/2});y+=rowHeight;
  }
  return {start,items,sections};
 };
 const visibleLayout=()=>{
  const selected=Math.max(0,Math.min(Math.max(0,rows().length-1),state.row()));
  let start=Math.max(0,selected-2),layout=layoutFrom(start);
  while(start<selected&&!layout.items.some(item=>item.index===selected)){start++;layout=layoutFrom(start);}
  return layout;
 };
 const render=()=>{
  const all=rows(),layout=visibleLayout(),rowHeight=currentRowHeight(),details=state.details();
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#090909';ctx.fillRect(0,0,canvas.width,canvas.height);
  rect(7,6,306,30,'#111','#3b3b3b',6);label('OPTIONS',15,20,9,'#aeb56e',750);label('PlayStunts DX',306,20,5.5,'#777',500,'right');
  tabOrder.forEach((tab,index)=>{const b=tabBounds[index],active=tab===state.tab(),over=focused('tab',index);rect(b.x,b.y,b.w,b.h,active?'#343a20':over?'#292d1d':'#171717',active||over?'#aeba5a':'#444',5,active||over?1.4:1);label(tabLabels[tab],b.x+b.w/2,b.y+b.h/2,5.5,active?'#fff':over?'#eee':'#aaa',active?700:600,'center');});
  rect(content.x,content.y,content.w,content.h,'#111','#3b3b3b',6);
  const activeTab=state.tab();label(details?'FORCE FEEDBACK DETAILS':tabLabels[activeTab],content.x+8,content.y+10,details?5.2:6,'#888',700);
  layout.sections.forEach(section=>{
   label(section.label,content.x+10,section.y,details?3.15:3.8,'#777',750);
   ctx.strokeStyle='#2f2f2f';ctx.lineWidth=Math.max(.5,.5*Math.min(sx(),sy()));ctx.beginPath();ctx.moveTo((content.x+(details?48:52))*sx(),section.y*sy());ctx.lineTo((content.x+content.w-10)*sx(),section.y*sy());ctx.stroke();
  });
  layout.items.forEach(item=>{
   const row=all[item.index],index=item.index,y=item.y,selected=focused('row',index),disabled=!!row.disabled;
   if(selected)rect(content.x+5,y-rowHeight/2+.25,content.w-10,rowHeight-.5,'#31371f','#9eaa54',4,1.2);
   label(row.label,content.x+10,y,details?4.25:5.4,disabled?'#555':selected?'#fff':'#ccc',selected?650:500);
   const valueColour=disabled?'#555':row.actionOnly?'#aeb56e':selected?'#fff':'#aeb56e';
   if(row.numeric&&!disabled){
    const minusX=content.x+content.w-61,valueX=content.x+content.w-34,plusX=content.x+content.w-9;
    const minusHover=hover?.type==='minus'&&hover.index===index,plusHover=hover?.type==='plus'&&hover.index===index,valueHover=hover?.type==='value'&&hover.index===index;
    rect(minusX-5.5,y-4.1,11,8.2,minusHover?'#4a522b':'#1d1d1d',minusHover?'#bac85e':'#4a4a4a',2.5,minusHover?1.2:.8);
    rect(plusX-5.5,y-4.1,11,8.2,plusHover?'#4a522b':'#1d1d1d',plusHover?'#bac85e':'#4a4a4a',2.5,plusHover?1.2:.8);
    if(valueHover)rect(valueX-18,y-4.1,36,8.2,'#252918','#70783e',2.5,.8);
    label('−',minusX,y,details?4.6:5.2,minusHover?'#fff':'#bbb',700,'center');
    label(row.value,valueX,y,details?4.15:5.0,valueHover?'#fff':valueColour,650,'center');
    label('+',plusX,y,details?4.6:5.2,plusHover?'#fff':'#bbb',700,'center');
   }else label(row.value,content.x+content.w-10,y,details?4.15:5.3,valueColour,650,'right');
  });
  const hoveredRow=hover&&['row','minus','plus','value'].includes(hover.type)?hover.index:undefined,helpIndex=hoveredRow??(state.zone()==='rows'?state.row():undefined);
  const help=helpIndex!==undefined&&all[helpIndex]?(optionHelp[all[helpIndex].id]??ffbFieldById.get(all[helpIndex].id as FfbNumericRowId)?.help??tabHelp[state.tab()]):tabHelp[state.tab()];
  rect(content.x+5,content.y+102,content.w-10,18,'#0d0d0d','#292929',3,.6);
  wrapped(help,content.w-18,3.9,2).forEach((line,index)=>label(line,content.x+9,content.y+107+index*6,3.9,index===0?'#aaa':'#818181',500));
  footerOrder().forEach((action,index)=>{const b=footerBounds[index],over=focused('footer',index);rect(b.x,b.y,b.w,b.h,over?'#3a4022':'#202020',over?'#b4c35a':'#555',4,over?1.5:1);label(footerLabels[action],b.x+b.w/2,b.y+b.h/2,5.1,over?'#fff':'#ddd',650,'center');});
  label(details?'↑↓ SELECT   ←→ CHANGE   ENTER: EDIT   ESC: BACK':'↑↓ SELECT   ←→ CHANGE   ENTER: APPLY   TAB: CATEGORY',83,168,3.8,'#6f6f6f',500);
  if(state.confirm()){
   ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,canvas.width,canvas.height);rect(82,65,156,70,'#141414','#777',7,1.4);label('EXIT GAME?',160,82,8,'#eee',750,'center');label('Unsaved race progress will be lost.',160,98,4.4,'#888',500,'center');
   const choices=[{x:101,y:108,w:53,h:19,label:'CANCEL'},{x:166,y:108,w:53,h:19,label:'EXIT'}];
   choices.forEach((b,index)=>{const active=hover?.type==='confirm'?hover.index===index:state.confirmChoice()===index;rect(b.x,b.y,b.w,b.h,active?'#454d28':'#242424',active?'#bdca66':'#555',4,active?1.5:1);label(b.label,b.x+b.w/2,b.y+b.h/2,5.5,active?'#fff':'#ccc',650,'center');});
  }
  ctx.restore();
 };
 const actionAt=(event:{clientX:number;clientY:number}):PointerAction|undefined=>{
  const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*320/r.width,y=(event.clientY-r.top)*200/r.height;
  const inside=(b:{x:number;y:number;w:number;h:number})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
  if(state.confirm()){
   const choices=[{x:101,y:108,w:53,h:19},{x:166,y:108,w:53,h:19}],choice=choices.findIndex(inside);
   return choice>=0?{type:'confirm',index:choice}:undefined;
  }
  const tab=tabBounds.findIndex(inside);if(tab>=0)return {type:'tab',index:tab};
  const foot=footerBounds.findIndex(inside);if(foot>=0)return {type:'footer',index:foot};
  if(x>=content.x+5&&x<=content.x+content.w-5&&y>=content.y+13&&y<content.y+rowRegionBottom){
   const rowHeight=currentRowHeight(),hit=visibleLayout().items.find(item=>y>=item.y-rowHeight/2&&y<item.y+rowHeight/2);
   if(hit){
    const row=rows()[hit.index];
    if(row?.numeric&&!row.disabled){
     const minusX=content.x+content.w-61,valueX=content.x+content.w-34,plusX=content.x+content.w-9;
     if(x>=minusX-7&&x<=minusX+7)return {type:'minus',index:hit.index};
     if(x>=plusX-7&&x<=plusX+7)return {type:'plus',index:hit.index};
     if(x>=valueX-20&&x<=valueX+20)return {type:'value',index:hit.index};
    }
    return {type:'row',index:hit.index};
   }
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
 const ffb=await loadFfbSettings();
 let tab:Tab='gameplay',zone:FocusZone='rows',row=0,footer=1,ffbDetails=false,confirm=false,confirmChoice=0;
 const currentRows=():OptionRow[]=>{
  const camera=(level:EnhancedChaseCameraPresetLevel,kind:EnhancedChaseCameraSetting,label:string):OptionRow=>({id:(level===1?(kind==='distance'?'close-distance':'close-height'):level===2?(kind==='distance'?'standard-distance':'standard-height'):(kind==='distance'?'far-distance':'far-height')) as RowId,label,value:String(enhancedChaseCameraPosition(level)[kind]),numeric:true,group:'DX / MODERN'});
  if(ffbDetails)return ffbFields.map(field=>({id:field.id,label:field.label,value:formatFfbValue(field,ffb.values[field.id]),numeric:true,group:field.group}));
  if(tab==='gameplay'){
   return [
    {id:'opponent-ai',label:'Opponent AI',value:opponentAiMode()==='enhanced'?'Enhanced':'Original',group:'DX / MODERN'},
    {id:'open-map',label:'Open Map on Race Start',value:boolLabel(storedEnabled(mapKey,false))},
    {id:'menu-style',label:'Menu Style',value:storedEnabled(enhancedMenuKey,true)?'Modern':'Vanilla'},
    {id:'track-editor',label:'Track Editor',value:storedEnabled(trackEditorKey,true)?'Modern':'Vanilla'},
   ];
  }
  if(tab==='sound'){
   const audio=host.audioState(),sound=storedSoundDevice();
   return [
    {id:'music',label:'Music',value:boolLabel(audio.musicEnabled),group:'ORIGINAL STUNTS'},
    {id:'sound-effects',label:'Sound Effects',value:boolLabel(audio.soundEnabled),group:'ORIGINAL STUNTS'},
    {id:'sound-device',label:'Sound Device',value:soundDevices.find(item=>item.id===sound)?.label??'Sound Blaster',group:'ORIGINAL STUNTS'},
    {id:'audio-update',label:'Audio Update',value:boolLabel(storedEnabled(audioUpdateKey,true)),group:'DX / MODERN'},
   ];
  }
  if(tab==='video'){
   const dx=graphicsEnabled(),fov=enhancedFovWidth();
   return [
    {id:'dx-graphics',label:'DX Graphics',value:boolLabel(dx),group:'DX / MODERN'},
    {id:'resolution',label:'Internal Resolution',value:enhancedRenderScale()===1?'Original':`${enhancedRenderScale()}×`,disabled:!dx,numeric:true,group:'DX / MODERN'},
    {id:'background',label:'High-Res Background',value:boolLabel(enhancedBackgroundEnabled()),disabled:!dx,group:'DX / MODERN'},
    {id:'cockpit',label:'High-Res Cockpit',value:boolLabel(enhancedCockpitEnabled()),disabled:!dx,group:'DX / MODERN'},
    {id:'fov',label:'Field of View',value:fov===0?'Original':fov===100?'Full':`${fov}%`,disabled:!dx,numeric:true,group:'DX / MODERN'},
    {id:'fps',label:'FPS Counter',value:boolLabel(storedEnabled(fpsKey,true)),disabled:!dx,group:'DX / MODERN'},
    camera(1,'distance','Chase Close · Distance'),camera(1,'height','Chase Close · Height'),
    camera(2,'distance','Chase Standard · Distance'),camera(2,'height','Chase Standard · Height'),
    camera(3,'distance','Chase Far · Distance'),camera(3,'height','Chase Far · Height'),
    {id:'reset-camera',label:'Chase Camera Presets',value:'Reset',actionOnly:true,group:'DX / MODERN'},
    {id:'original-detail',label:'Original Detail Level',value:`Level ${clamp(host.settings.graphics,0,3)+1}`,numeric:true,group:'ORIGINAL STUNTS'},
   ];
  }
  const input=desktopInputDevice(),wheel=input==='wheel';
  return [
   {id:'input-device',label:'Driving Input Device',value:inputDevices.find(item=>item.id===input)?.label??'Keyboard',group:'INPUT'},
   {id:'deadzone',label:'Steering Deadzone',value:`${storedDeadzone()}%`,disabled:!wheel,numeric:true,group:'INPUT'},
   {id:'linearity',label:'Steering Linearity',value:storedLinearity().toFixed(2),disabled:!wheel,numeric:true,group:'INPUT'},
   {id:'show-f8',label:'Show F8 Button',value:boolLabel(storedEnabled(f8Key,true)),group:'INTERFACE'},
   {id:'ffb-enabled',label:'Force Feedback',value:boolLabel(ffb.enabled),disabled:!wheel,group:'FORCE FEEDBACK'},
   {id:'ffb-details',label:'Force Feedback Details',value:'Open…',disabled:!wheel,actionOnly:true,group:'FORCE FEEDBACK'},
  ];
 };
 const clampRow=()=>{const rows=currentRows();row=Math.max(0,Math.min(Math.max(0,rows.length-1),row));};
 const presentation=createPresentation(host.canvas,currentRows,{tab:()=>tab,zone:()=>zone,row:()=>row,footer:()=>footer,details:()=>ffbDetails,confirm:()=>confirm,confirmChoice:()=>confirmChoice});
 const setTab=(index:number)=>{ffbDetails=false;tab=tabOrder[(index+tabOrder.length)%tabOrder.length]!;row=0;zone='rows';footer=1;clampRow();presentation.render();};
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
  if(item.id==='ffb-enabled'){await persistFfbEnabled(ffb,!ffb.enabled);presentation.render();return;}
  if(item.id==='ffb-details'){if(activate){ffbDetails=true;row=0;zone='rows';footer=1;}presentation.render();return;}
  const ffbField=ffbFieldById.get(item.id as FfbNumericRowId);
  if(ffbField){await persistFfbValue(ffb,ffbField,ffb.values[ffbField.id]+(direction<0?-ffbField.step:ffbField.step));presentation.render();return;}
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
   case 'opponent-ai':{
    const next=opponentAiMode()==='enhanced'?'original':'enhanced';setOpponentAiMode(next);await persistConfig('Gameplay','OpponentAI',next);break;
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
   case 'original-detail':{
    host.settings.graphics=cycleIndex(4,clamp(host.settings.graphics,0,3),direction);window.localStorage.setItem(originalGraphicsKey,String(host.settings.graphics));break;
   }
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
 const numericInfo=(id:RowId)=>{
  const field=ffbFieldById.get(id as FfbNumericRowId);
  if(field)return {value:ffb.values[field.id],min:field.min,max:field.max,step:field.step,decimals:field.decimals,unit:field.unit};
  if(id==='deadzone')return {value:storedDeadzone(),min:0,max:15,step:1,decimals:0,unit:'%'};
  if(id==='linearity')return {value:storedLinearity(),min:1,max:2,step:.05,decimals:2,unit:''};
  if(id==='fov')return {value:enhancedFovWidth(),min:0,max:100,step:5,decimals:0,unit:'%'};
  if(id==='original-detail')return {value:clamp(host.settings.graphics,0,3)+1,min:1,max:4,step:1,decimals:0,unit:''};
  if(id==='resolution')return {value:enhancedRenderScale(),min:Math.min(...ENHANCED_RENDER_SCALES),max:Math.max(...ENHANCED_RENDER_SCALES),step:1,decimals:0,unit:'×'};
  const cameraMap:Partial<Record<RowId,[EnhancedChaseCameraPresetLevel,EnhancedChaseCameraSetting]>>={
   'close-distance':[1,'distance'],'close-height':[1,'height'],'standard-distance':[2,'distance'],'standard-height':[2,'height'],'far-distance':[3,'distance'],'far-height':[3,'height'],
  };
  const camera=cameraMap[id];
  if(camera){const [level,kind]=camera;return {value:enhancedChaseCameraPosition(level)[kind],min:kind==='distance'?80:20,max:kind==='distance'?1000:500,step:kind==='distance'?10:5,decimals:0,unit:''};}
  return undefined;
 };
 const setNumericValue=async(id:RowId,value:number)=>{
  const field=ffbFieldById.get(id as FfbNumericRowId);
  if(field){await persistFfbValue(ffb,field,value);return;}
  if(id==='deadzone'){await setDeadzone(value);return;}
  if(id==='linearity'){await setLinearity(value);return;}
  if(id==='fov'){setEnhancedFovWidth(clamp(value,0,100));return;}
  if(id==='original-detail'){host.settings.graphics=clamp(Math.round(value)-1,0,3);window.localStorage.setItem(originalGraphicsKey,String(host.settings.graphics));return;}
  if(id==='resolution'){
   const next=ENHANCED_RENDER_SCALES.reduce((best,candidate)=>Math.abs(candidate-value)<Math.abs(best-value)?candidate:best,ENHANCED_RENDER_SCALES[0]!);
   await setRenderScale(next);return;
  }
  const cameraMap:Partial<Record<RowId,[EnhancedChaseCameraPresetLevel,EnhancedChaseCameraSetting]>>={
   'close-distance':[1,'distance'],'close-height':[1,'height'],'standard-distance':[2,'distance'],'standard-height':[2,'height'],'far-distance':[3,'distance'],'far-height':[3,'height'],
  };
  const camera=cameraMap[id];if(camera)setEnhancedChaseCameraPosition(camera[0],camera[1],value);
 };
 const editNumeric=async(index:number)=>{
  const item=currentRows()[index];if(!item?.numeric||item.disabled)return;
  const info=numericInfo(item.id);if(!info)return;
  const entered=window.prompt(`${item.label}\nEnter a value from ${info.min} to ${info.max}${info.unit?' '+info.unit:''}:`,String(info.value));
  if(entered===null)return;
  const parsed=Number(entered.trim().replace(',','.'));
  if(!Number.isFinite(parsed)){window.alert('Please enter a valid number.');return;}
  await setNumericValue(item.id,parsed);presentation.render();
 };
 const activateFooter=async(index:number):Promise<'menu'|'replay'|'exit'|undefined>=>{
  const action=(ffbDetails?(['back','done'] as const):(['exit','done'] as const))[index];
  if(action==='done')return 'menu';
  if(action==='back'){ffbDetails=false;row=Math.max(0,currentRows().findIndex(item=>item.id==='ffb-details'));zone='rows';footer=1;presentation.render();return;}
  confirm=true;confirmChoice=0;presentation.render();return;
 };
 const pointerActions:PointerAction[]=[];
 let adjustmentChain=Promise.resolve(),lastTouchIndex=-1,lastTouchAt=0;
 const queueAdjustment=(index:number,direction:number)=>{
  adjustmentChain=adjustmentChain.then(async()=>{row=index;zone='rows';clampRow();await changeRow(direction);}).catch(reason=>console.warn('[Modern Options] value adjustment failed:',reason));
 };
 const pointerDown=(event:PointerEvent)=>{const action=presentation.actionAt(event);if(!action)return;event.preventDefault();event.stopImmediatePropagation();pointerActions.push(action);};
 const pointerUp=(event:PointerEvent)=>{
  if(event.pointerType!=='touch')return;
  const action=presentation.actionAt(event);if(action?.type!=='value')return;
  const now=performance.now();
  if(action.index===lastTouchIndex&&now-lastTouchAt<350){event.preventDefault();lastTouchIndex=-1;lastTouchAt=0;void editNumeric(action.index);}
  else{lastTouchIndex=action.index;lastTouchAt=now;}
 };
 const doubleClick=(event:MouseEvent)=>{const action=presentation.actionAt(event);if(action?.type==='value'){event.preventDefault();event.stopImmediatePropagation();void editNumeric(action.index);}};
 const pointerMove=(event:PointerEvent)=>presentation.hoverAt(event);
 const pointerLeave=()=>presentation.clearHover();
 const wheel=(event:WheelEvent)=>{
  if(confirm||event.deltaY===0)return;
  const action=presentation.actionAt(event);
  event.preventDefault();event.stopImmediatePropagation();
  if(action?.type==='value'){queueAdjustment(action.index,event.deltaY>0?-1:1);return;}
  zone='rows';const rows=currentRows();row=Math.max(0,Math.min(rows.length-1,row+(event.deltaY>0?1:-1)));presentation.render();
 };
 host.canvas.addEventListener('pointerdown',pointerDown,true);host.canvas.addEventListener('pointerup',pointerUp,true);host.canvas.addEventListener('dblclick',doubleClick,true);host.canvas.addEventListener('pointermove',pointerMove,true);host.canvas.addEventListener('pointerleave',pointerLeave,true);host.canvas.addEventListener('wheel',wheel,{capture:true,passive:false});

 presentation.render();
 try{
  for(;;){
   const input=await host.input(),pointer=pointerActions.shift();
   if(confirm){
    if(pointer?.type==='confirm'){confirmChoice=pointer.index;presentation.render();if(pointer.index===1)return 'exit';confirm=false;presentation.render();continue;}
    if(pointer)continue;
    if(input.key===27){confirm=false;presentation.render();continue;}
    if(input.key===0x4b00||input.key===0x4d00||input.key===0x4800||input.key===0x5000){confirmChoice^=1;presentation.render();continue;}
    if(input.key===13||input.key===32){if(confirmChoice===1)return 'exit';confirm=false;presentation.render();continue;}
    continue;
   }
   if(pointer){
    if(pointer.type==='tab'){setTab(pointer.index);continue;}
    if(pointer.type==='minus'||pointer.type==='plus'){zone='rows';row=pointer.index;clampRow();await changeRow(pointer.type==='minus'?-1:1);continue;}
    if(pointer.type==='value'){zone='rows';row=pointer.index;clampRow();presentation.render();continue;}
    if(pointer.type==='row'){zone='rows';row=pointer.index;clampRow();const item=currentRows()[row];if(!item?.numeric)await changeRow(1,true);else presentation.render();continue;}
    zone='footer';footer=pointer.index;presentation.render();const result=await activateFooter(footer);if(result)return result;continue;
   }
   const key=input.key??0;
   if(key===27){if(ffbDetails){ffbDetails=false;row=Math.max(0,currentRows().findIndex(item=>item.id==='ffb-details'));zone='rows';presentation.render();continue;}return 'menu';}
   if(key===9){setTab(tabOrder.indexOf(tab)+1);continue;}
   if(zone==='tabs'){
    if(key===0x4b00||key===0x4800){setTab(tabOrder.indexOf(tab)-1);zone='tabs';presentation.render();continue;}
    if(key===0x4d00||key===0x5000){setTab(tabOrder.indexOf(tab)+1);zone='tabs';presentation.render();continue;}
    if(key===13||key===32){zone='rows';presentation.render();continue;}
   }else if(zone==='rows'){
    const rows=currentRows();
    if(key===0x4800){if(row===0)zone='tabs';else row--;presentation.render();continue;}
    if(key===0x5000){if(row>=rows.length-1){zone='footer';footer=1;}else row++;presentation.render();continue;}
    if(key===0x4b00){await changeRow(-1);continue;}
    if(key===0x4d00){await changeRow(1);continue;}
    if(key===13||key===32){const item=currentRows()[row];if(item?.numeric)await editNumeric(row);else await changeRow(1,true);continue;}
   }else{
    if(key===0x4800){zone='rows';row=currentRows().length-1;clampRow();presentation.render();continue;}
    if(key===0x4b00){footer=(footer+1)%2;presentation.render();continue;}
    if(key===0x4d00){footer=(footer+1)%2;presentation.render();continue;}
    if(key===13||key===32){const result=await activateFooter(footer);if(result)return result;continue;}
   }
  }
 }finally{
  host.canvas.removeEventListener('pointerdown',pointerDown,true);host.canvas.removeEventListener('pointerup',pointerUp,true);host.canvas.removeEventListener('dblclick',doubleClick,true);host.canvas.removeEventListener('pointermove',pointerMove,true);host.canvas.removeEventListener('pointerleave',pointerLeave,true);host.canvas.removeEventListener('wheel',wheel,true);
 }
}
