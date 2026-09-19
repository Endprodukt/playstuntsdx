import type {Assets} from '../lib/game/types';
import {ENGINE_SOUND_PRESETS,loadSoundModSettings,saveSoundModSettings,type EngineSoundPreset} from '../lib/game/sound-mod-settings';
const fpsStorageKey='playstunts-dx-fps-visible';
const steeringDeadzoneStorageKey='playstunts-dx-steering-deadzone-percent';
const optionsButtonStorageKey='playstunts-dx-show-options-button';
const openMapOnRaceStartStorageKey='playstunts-dx-open-map-on-race-start';
const defaultSteeringDeadzonePercent=4;
const maxSteeringDeadzonePercent=15;

type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
type NativeConfigFile={content:string};

function tauriCore(){return (window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__?.core;}
function clampSteeringDeadzone(value:number){return Math.max(0,Math.min(maxSteeringDeadzonePercent,Math.round(value)));}
function storedSteeringDeadzone(){
 const stored=window.localStorage.getItem(steeringDeadzoneStorageKey);if(stored===null)return defaultSteeringDeadzonePercent;
 const saved=Number(stored);
 return Number.isFinite(saved)?clampSteeringDeadzone(saved):defaultSteeringDeadzonePercent;
}
function saveSteeringDeadzone(value:number){window.localStorage.setItem(steeringDeadzoneStorageKey,String(clampSteeringDeadzone(value)));}
function storedOptionsButtonVisible(){
 const saved=window.localStorage.getItem(optionsButtonStorageKey);
 return saved===null||!['0','false','no','off'].includes(saved.trim().toLowerCase());
}
function saveOptionsButtonVisible(visible:boolean){window.localStorage.setItem(optionsButtonStorageKey,String(visible));}
function storedOpenMapOnRaceStart(){
 const saved=window.localStorage.getItem(openMapOnRaceStartStorageKey);
 return saved!==null&&['1','true','yes','on'].includes(saved.trim().toLowerCase());
}
function saveOpenMapOnRaceStart(visible:boolean){window.localStorage.setItem(openMapOnRaceStartStorageKey,String(visible));}
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
async function loadNativeGeneralSettings(){
 const core=tauriCore();if(!core)return;
 try{
  const file=await core.invoke<NativeConfigFile>('native_config');
  const value=Number(configValue(file.content,'Controls','SteeringDeadzone'));
  if(Number.isFinite(value))saveSteeringDeadzone(value);
  const showButton=configValue(file.content,'Display','ShowOptionsButton')?.trim().toLowerCase();
  if(showButton)saveOptionsButtonVisible(!['0','false','no','off'].includes(showButton));
  const openMap=configValue(file.content,'Display','OpenMapOnRaceStart')?.trim().toLowerCase();
  if(openMap)saveOpenMapOnRaceStart(['1','true','yes','on'].includes(openMap));
 }catch(reason){console.warn('[Options] General config load failed:',reason);}
}
async function persistSteeringDeadzone(value:number){
 const deadzone=clampSteeringDeadzone(value);saveSteeringDeadzone(deadzone);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Controls',key:'SteeringDeadzone',value:String(deadzone)});}
 catch(reason){console.warn('[Options] Steering deadzone config save failed:',reason);}
}
async function persistOptionsButtonVisible(visible:boolean){
 saveOptionsButtonVisible(visible);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Display',key:'ShowOptionsButton',value:String(visible)});}
 catch(reason){console.warn('[Options] F8 button visibility save failed:',reason);}
}
async function persistOpenMapOnRaceStart(open:boolean){
 saveOpenMapOnRaceStart(open);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Display',key:'OpenMapOnRaceStart',value:String(open)});}
 catch(reason){console.warn('[Options] map auto-open save failed:',reason);}
}

function storedFpsVisible(){
 const saved=window.localStorage.getItem(fpsStorageKey);
 return saved===null||!['0','false','no','off'].includes(saved.trim().toLowerCase());
}

function saveFpsVisible(visible:boolean){
 window.localStorage.setItem(fpsStorageKey,String(visible));
}

function gameCanvas(){return document.querySelector<HTMLCanvasElement>('.desktop-game-shell canvas');}
function graphicsEnabled(){return document.querySelector<HTMLButtonElement>('.desktop-game-shell .game-toolbar button[aria-pressed]')?.getAttribute('aria-pressed')==='true';}

function dispatchFpsShortcut(){
 const canvas=gameCanvas();
 if(!canvas)return false;
 canvas.focus({preventScroll:true});
 canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'f',code:'KeyF',bubbles:true,cancelable:true}));
 canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'f',code:'KeyF',bubbles:true,cancelable:true}));
 return true;
}

/** Turns the old wheel-only F8 popup into a general Options panel without
 * changing the wheel calibration internals. The FPS preference reuses the
 * existing F shortcut so there remains only one renderer-side toggle path. */
export function installDesktopOptionsOverlay(assets?:Assets){
 let disposed=false,frame=0,section:HTMLDivElement|undefined,fpsStateApplied=false;
 void loadNativeGeneralSettings().then(()=>{renderSteeringDeadzone();renderOptionsButtonState();});

 const applyStoredFps=()=>{
  if(fpsStateApplied||!graphicsEnabled()||!gameCanvas())return;
  if(storedFpsVisible()){fpsStateApplied=true;return;}
  if(dispatchFpsShortcut())fpsStateApplied=true;
 };

 const renderFpsState=()=>{
  const button=section?.querySelector<HTMLButtonElement>('button[data-fps-toggle]');
  if(!button)return;
  const visible=storedFpsVisible();
  button.textContent=visible?'On':'Off';
  button.setAttribute('aria-pressed',String(visible));
 };
 const renderSteeringDeadzone=()=>{
  const slider=section?.querySelector<HTMLInputElement>('input[data-steering-deadzone]');
  const value=section?.querySelector<HTMLOutputElement>('output[data-steering-deadzone-value]');
  const deadzone=storedSteeringDeadzone();
  if(slider)slider.value=String(deadzone);
  if(value)value.value=`${deadzone}%`;
 };
 const renderOptionsButtonState=()=>{
  const button=section?.querySelector<HTMLButtonElement>('button[data-options-button-toggle]');
  if(!button)return;
  const visible=storedOptionsButtonVisible();
  button.textContent=visible?'On':'Off';
  button.setAttribute('aria-pressed',String(visible));
 };
 const renderOpenMapState=()=>{
  const button=section?.querySelector<HTMLButtonElement>('button[data-open-map-toggle]');
  if(!button)return;
  const open=storedOpenMapOnRaceStart();
  button.textContent=open?'On':'Off';
  button.setAttribute('aria-pressed',String(open));
 };
 const renderSoundModState=()=>{
  if(!section)return;
  const settings=loadSoundModSettings();
  const enabled=section.querySelector<HTMLButtonElement>('button[data-sound-mod-toggle]');
  const preset=section.querySelector<HTMLSelectElement>('select[data-sound-mod-default]');
  if(enabled){enabled.textContent=settings.enabled?'On':'Off';enabled.setAttribute('aria-pressed',String(settings.enabled));}
  if(preset)preset.value=settings.defaultPreset;
 };

 const mount=()=>{
  if(disposed)return;
  const controlsHeading=Array.from(document.querySelectorAll<HTMLDivElement>('div')).find(element=>element.textContent==='Controls / Key Bindings');
  const controlsSection=controlsHeading?.parentElement as HTMLDivElement|undefined;
  const panel=controlsSection?.parentElement as HTMLDivElement|undefined;
  const root=panel?.parentElement as HTMLDivElement|undefined;
  const toggle=root?.querySelector<HTMLButtonElement>(':scope > button');
  if(!panel||!toggle||!controlsSection){frame=requestAnimationFrame(mount);return;}

  toggle.textContent='Options [F8]';
  const title=panel.firstElementChild as HTMLElement|null;
  if(title?.textContent?.includes('PlayStunts DX'))title.textContent='PlayStunts DX — Options';

  section=document.createElement('div');
  section.style.cssText='margin-top:12px;padding:12px;background:#181818;border:1px solid #444;border-radius:6px;';
  const heading=document.createElement('div');heading.textContent='General';heading.style.cssText='font-size:15px;font-weight:700;margin-bottom:8px;';
  const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;';
  const label=document.createElement('div');label.textContent='FPS Counter';label.style.cssText='font-size:12px;color:#ddd;';
  const fps=document.createElement('button');fps.type='button';fps.dataset.fpsToggle='1';fps.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  fps.addEventListener('click',()=>{
   const next=!storedFpsVisible();saveFpsVisible(next);
   if(graphicsEnabled()&&dispatchFpsShortcut())fpsStateApplied=true;else fpsStateApplied=false;
   renderFpsState();
  });
  row.append(label,fps);

  const mapRow=document.createElement('div');mapRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;margin-top:9px;';
  const mapLabel=document.createElement('div');mapLabel.textContent='Open Map on Race Start';mapLabel.title='Automatically opens the Race Map at the start of each race/restart. You can still close it with F9 or M.';mapLabel.style.cssText='font-size:12px;color:#ddd;';
  const mapToggle=document.createElement('button');mapToggle.type='button';mapToggle.dataset.openMapToggle='1';mapToggle.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  mapToggle.addEventListener('click',()=>{const next=!storedOpenMapOnRaceStart();void persistOpenMapOnRaceStart(next);renderOpenMapState();});
  mapRow.append(mapLabel,mapToggle);

  const buttonRow=document.createElement('div');buttonRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;margin-top:9px;';
  const buttonLabel=document.createElement('div');buttonLabel.textContent='Show F8 Button';buttonLabel.title='Shows or hides the Options [F8] button in the top-right corner. The F8 keyboard shortcut always remains active.';buttonLabel.style.cssText='font-size:12px;color:#ddd;';
  const buttonToggle=document.createElement('button');buttonToggle.type='button';buttonToggle.dataset.optionsButtonToggle='1';buttonToggle.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  buttonToggle.addEventListener('click',()=>{const next=!storedOptionsButtonVisible();void persistOptionsButtonVisible(next);renderOptionsButtonState();});
  buttonRow.append(buttonLabel,buttonToggle);

  const soundSection=document.createElement('div');soundSection.style.cssText='margin-top:12px;padding-top:10px;border-top:1px solid #333;';
  const soundHeading=document.createElement('div');soundHeading.textContent='Sound Mods';soundHeading.style.cssText='font-size:13px;font-weight:700;margin-bottom:8px;';
  const soundEnabledRow=document.createElement('div');soundEnabledRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;';
  const soundEnabledLabel=document.createElement('div');soundEnabledLabel.textContent='Custom Engine Sounds';soundEnabledLabel.style.cssText='font-size:12px;color:#ddd;';
  const soundEnabled=document.createElement('button');soundEnabled.type='button';soundEnabled.dataset.soundModToggle='1';soundEnabled.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  soundEnabled.addEventListener('click',()=>{const settings=loadSoundModSettings();settings.enabled=!settings.enabled;saveSoundModSettings(settings);renderSoundModState();});
  soundEnabledRow.append(soundEnabledLabel,soundEnabled);

  const soundDefaultRow=document.createElement('div');soundDefaultRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1fr);gap:8px;align-items:center;margin-top:8px;';
  const soundDefaultLabel=document.createElement('div');soundDefaultLabel.textContent='Default Car Sound';soundDefaultLabel.style.cssText='font-size:12px;color:#ddd;';
  const soundDefault=document.createElement('select');soundDefault.dataset.soundModDefault='1';soundDefault.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;font:12px/1.2 system-ui,Segoe UI,sans-serif;';
  for(const preset of ENGINE_SOUND_PRESETS){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.label;soundDefault.append(option);}
  soundDefault.addEventListener('change',()=>{const settings=loadSoundModSettings();settings.defaultPreset=soundDefault.value as EngineSoundPreset;saveSoundModSettings(settings);renderSoundModState();});
  soundDefaultRow.append(soundDefaultLabel,soundDefault);

  const perCarRow=document.createElement('div');perCarRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1fr);gap:8px;align-items:center;margin-top:8px;';
  const perCarLabel=document.createElement('div');perCarLabel.textContent='Per-Car Sounds';perCarLabel.style.cssText='font-size:12px;color:#ddd;';
  const perCarButton=document.createElement('button');perCarButton.type='button';perCarButton.textContent='Configure…';perCarButton.disabled=!assets;perCarButton.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;';
  perCarButton.addEventListener('click',()=>{
   if(!assets)return;
   const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.76);display:grid;place-items:center;padding:24px;';
   const box=document.createElement('div');box.style.cssText='width:min(720px,92vw);max-height:82vh;background:#161616;border:1px solid #555;border-radius:8px;padding:16px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;box-shadow:0 20px 70px #000;';
   const heading=document.createElement('strong');heading.textContent='Per-Car Engine Sounds';heading.style.cssText='font-size:15px;color:#eee;';
   const list=document.createElement('div');list.style.cssText='overflow:auto;display:grid;gap:6px;padding-right:4px;';
   const settings=loadSoundModSettings();
   for(const car of assets.cars){
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1fr);gap:8px;align-items:center;';
    const label=document.createElement('div');label.textContent=car.name+' ('+car.id+')';label.style.cssText='font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const select=document.createElement('select');select.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;font:12px system-ui,Segoe UI,sans-serif;';
    const inherit=document.createElement('option');inherit.value='';inherit.textContent='Use default';select.append(inherit);
    for(const preset of ENGINE_SOUND_PRESETS){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.label;select.append(option);}
    select.value=settings.perCar[car.id.toUpperCase()]??'';
    select.addEventListener('change',()=>{const next=loadSoundModSettings();if(select.value)next.perCar[car.id.toUpperCase()]=select.value as EngineSoundPreset;else delete next.perCar[car.id.toUpperCase()];saveSoundModSettings(next);});
    row.append(label,select);list.append(row);
   }
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;';
   const close=document.createElement('button');close.type='button';close.textContent='Done';close.style.cssText='border:1px solid #777;background:#303030;color:#eee;border-radius:4px;padding:7px 14px;cursor:pointer;';
   const finish=()=>shade.remove();close.addEventListener('click',finish);shade.addEventListener('pointerdown',event=>{if(event.target===shade)finish();});shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();finish();}});
   actions.append(close);box.append(heading,list,actions);shade.append(box);document.body.append(shade);requestAnimationFrame(()=>shade.focus());
  });
  perCarRow.append(perCarLabel,perCarButton);
  soundSection.append(soundHeading,soundEnabledRow,soundDefaultRow,perCarRow);

  const deadzoneRow=document.createElement('div');deadzoneRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1.5fr) 48px;gap:8px;align-items:center;margin-top:9px;';
  const deadzoneLabel=document.createElement('div');deadzoneLabel.textContent='Steering Deadzone';deadzoneLabel.title='Wheel only. Small steering movements around the calibrated center are ignored.';deadzoneLabel.style.cssText='font-size:12px;color:#ddd;';
  const deadzone=document.createElement('input');deadzone.type='range';deadzone.min='0';deadzone.max=String(maxSteeringDeadzonePercent);deadzone.step='1';deadzone.dataset.steeringDeadzone='1';deadzone.style.cssText='width:100%;';
  const deadzoneValue=document.createElement('output');deadzoneValue.dataset.steeringDeadzoneValue='1';deadzoneValue.style.cssText='font:12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eee;text-align:right;';
  deadzone.addEventListener('input',()=>{saveSteeringDeadzone(Number(deadzone.value));renderSteeringDeadzone();});
  deadzone.addEventListener('change',()=>void persistSteeringDeadzone(Number(deadzone.value)));
  deadzoneRow.append(deadzoneLabel,deadzone,deadzoneValue);

  section.append(heading,row,mapRow,buttonRow,deadzoneRow,soundSection);panel.insertBefore(section,controlsSection);renderFpsState();renderOpenMapState();renderOptionsButtonState();renderSteeringDeadzone();renderSoundModState();applyStoredFps();
 };
 frame=requestAnimationFrame(mount);

 const onTrustedF=(event:KeyboardEvent)=>{
  if(disposed||event.code!=='KeyF'||event.repeat||!event.isTrusted||!graphicsEnabled())return;
  const canvas=gameCanvas();if(!canvas||event.target!==canvas)return;
  saveFpsVisible(!storedFpsVisible());fpsStateApplied=true;renderFpsState();
 };
 window.addEventListener('keydown',onTrustedF,true);

 const graphicsObserver=new MutationObserver(()=>requestAnimationFrame(applyStoredFps));
 const observeGraphics=()=>{
  if(disposed)return;
  const toggle=document.querySelector<HTMLButtonElement>('.desktop-game-shell .game-toolbar button[aria-pressed]');
  if(!toggle){requestAnimationFrame(observeGraphics);return;}
  graphicsObserver.observe(toggle,{attributes:true,attributeFilter:['aria-pressed']});applyStoredFps();
 };
 requestAnimationFrame(observeGraphics);

 return()=>{disposed=true;cancelAnimationFrame(frame);graphicsObserver.disconnect();window.removeEventListener('keydown',onTrustedF,true);section?.remove();};
}
