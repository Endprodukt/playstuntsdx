import type {Assets} from '../lib/game/types';
import {enhancedBackgroundEnabled,enhancedCockpitEnabled,setEnhancedBackgroundEnabled,setEnhancedCockpitEnabled} from '../lib/game/enhanced-textures';
import {enhancedFovWidth,setEnhancedFovWidth} from '../lib/game/enhanced-view-settings';
import {ENHANCED_RENDER_SCALES,enhancedRenderScale,setEnhancedRenderScale} from '../lib/game/enhanced-resolution-settings';
const fpsStorageKey='playstunts-dx-fps-visible';
const graphicsStorageKey='playstunts-dx-enhanced-graphics';
const steeringDeadzoneStorageKey='playstunts-dx-steering-deadzone-percent';
const steeringLinearityStorageKey='playstunts-dx-steering-linearity';
const optionsButtonStorageKey='playstunts-dx-show-options-button';
const openMapOnRaceStartStorageKey='playstunts-dx-open-map-on-race-start';
const defaultSteeringDeadzonePercent=4;
const maxSteeringDeadzonePercent=15;
const defaultSteeringLinearity=1.4;
const minSteeringLinearity=1;
const maxSteeringLinearity=2;

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
function clampSteeringLinearity(value:number){return Math.max(minSteeringLinearity,Math.min(maxSteeringLinearity,Math.round(value*20)/20));}
function storedSteeringLinearity(){
 const stored=window.localStorage.getItem(steeringLinearityStorageKey);if(stored===null)return defaultSteeringLinearity;
 const saved=Number(stored);
 return Number.isFinite(saved)?clampSteeringLinearity(saved):defaultSteeringLinearity;
}
function saveSteeringLinearity(value:number){window.localStorage.setItem(steeringLinearityStorageKey,String(clampSteeringLinearity(value)));}
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
  const linearity=Number(configValue(file.content,'Controls','SteeringLinearity'));
  if(Number.isFinite(linearity))saveSteeringLinearity(linearity);
  const showButton=configValue(file.content,'Display','ShowOptionsButton')?.trim().toLowerCase();
  if(showButton)saveOptionsButtonVisible(!['0','false','no','off'].includes(showButton));
  const openMap=configValue(file.content,'Display','OpenMapOnRaceStart')?.trim().toLowerCase();
  if(openMap)saveOpenMapOnRaceStart(['1','true','yes','on'].includes(openMap));
  const renderScale=Number(configValue(file.content,'Display','InternalResolutionScale'));
  if(Number.isFinite(renderScale))setEnhancedRenderScale(renderScale);
 }catch(reason){console.warn('[Options] General config load failed:',reason);}
}
async function persistSteeringDeadzone(value:number){
 const deadzone=clampSteeringDeadzone(value);saveSteeringDeadzone(deadzone);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Controls',key:'SteeringDeadzone',value:String(deadzone)});}
 catch(reason){console.warn('[Options] Steering deadzone config save failed:',reason);}
}
async function persistSteeringLinearity(value:number){
 const linearity=clampSteeringLinearity(value);saveSteeringLinearity(linearity);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Controls',key:'SteeringLinearity',value:linearity.toFixed(2)});}
 catch(reason){console.warn('[Options] Steering linearity config save failed:',reason);}
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
async function persistEnhancedRenderScale(value:number){
 const scale=setEnhancedRenderScale(value);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Display',key:'InternalResolutionScale',value:String(scale)});}
 catch(reason){console.warn('[Options] internal resolution save failed:',reason);}
}

function storedFpsVisible(){
 const saved=window.localStorage.getItem(fpsStorageKey);
 return saved===null||!['0','false','no','off'].includes(saved.trim().toLowerCase());
}

function saveFpsVisible(visible:boolean){
 window.localStorage.setItem(fpsStorageKey,String(visible));
}

function gameCanvas(){return document.querySelector<HTMLCanvasElement>('.desktop-game-shell canvas');}
function graphicsToggle(){return document.querySelector<HTMLButtonElement>('.desktop-game-shell .game-toolbar button[aria-pressed]');}
function graphicsEnabled(){return graphicsToggle()?.getAttribute('aria-pressed')==='true';}

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
export function installDesktopOptionsOverlay(_assets?:Assets){
 let disposed=false,frame=0,section:HTMLDivElement|undefined,fpsStateApplied=false;
 void loadNativeGeneralSettings().then(()=>{renderSteeringDeadzone();renderSteeringLinearity();renderOptionsButtonState();});

 const applyStoredFps=()=>{
  if(fpsStateApplied||!graphicsEnabled()||!gameCanvas())return;
  if(storedFpsVisible()){fpsStateApplied=true;return;}
  if(dispatchFpsShortcut())fpsStateApplied=true;
 };

 const renderGraphicsState=()=>{
  const button=section?.querySelector<HTMLButtonElement>('button[data-graphics-toggle]');
  if(!button)return;
  const enabled=graphicsEnabled();
  button.textContent=enabled?'On':'Off';
  button.setAttribute('aria-pressed',String(enabled));
 };
 const renderTextureState=()=>{
  const background=section?.querySelector<HTMLButtonElement>('button[data-background-toggle]');
  const cockpit=section?.querySelector<HTMLButtonElement>('button[data-cockpit-toggle]');
  if(background){const enabled=enhancedBackgroundEnabled();background.textContent=enabled?'On':'Off';background.setAttribute('aria-pressed',String(enabled));}
  if(cockpit){const enabled=enhancedCockpitEnabled();cockpit.textContent=enabled?'On':'Off';cockpit.setAttribute('aria-pressed',String(enabled));}
 };
 const renderResolutionState=()=>{
  const select=section?.querySelector<HTMLSelectElement>('select[data-render-scale]');
  const row=section?.querySelector<HTMLElement>('[data-render-scale-row]');
  const enabled=graphicsEnabled();
  if(select){
   select.value=String(enhancedRenderScale());
   select.disabled=!enabled;
   select.style.opacity=enabled?'1':'0.45';
   select.style.cursor=enabled?'pointer':'not-allowed';
   select.title=enabled?'Internal render resolution used by DX Graphics.':'Enable DX Graphics to change the internal resolution.';
  }
  if(row)row.style.opacity=enabled?'1':'0.55';
 };
 const renderFovState=()=>{
  const slider=section?.querySelector<HTMLInputElement>('input[data-fov-width]');
  const value=section?.querySelector<HTMLOutputElement>('output[data-fov-width-value]');
  const amount=enhancedFovWidth();
  if(slider)slider.value=String(amount);
  if(value)value.value=amount===0?'Original':amount===100?'Full':amount+'%';
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
 const renderSteeringLinearity=()=>{
  const slider=section?.querySelector<HTMLInputElement>('input[data-steering-linearity]');
  const value=section?.querySelector<HTMLOutputElement>('output[data-steering-linearity-value]');
  const linearity=storedSteeringLinearity();
  if(slider)slider.value=String(linearity);
  if(value)value.value=linearity.toFixed(2);
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

  const videoSection=document.createElement('div');videoSection.style.cssText='margin-top:12px;padding-top:10px;border-top:1px solid #333;';
  const videoHeading=document.createElement('div');videoHeading.textContent='Video';videoHeading.style.cssText='font-size:13px;font-weight:700;margin-bottom:8px;';

  const graphicsRow=document.createElement('div');graphicsRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;';
  const graphicsLabel=document.createElement('div');graphicsLabel.textContent='DX Graphics';graphicsLabel.title='Switches live between the original Stunts renderer and the enhanced DX renderer.';graphicsLabel.style.cssText='font-size:12px;color:#ddd;';
  const graphicsButton=document.createElement('button');graphicsButton.type='button';graphicsButton.dataset.graphicsToggle='1';graphicsButton.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  graphicsButton.addEventListener('click',()=>{
   const toggle=graphicsToggle();if(!toggle)return;
   toggle.click();
   window.localStorage.setItem(graphicsStorageKey,String(toggle.getAttribute('aria-pressed')==='true'));
   renderGraphicsState();renderResolutionState();applyStoredFps();
  });
  graphicsRow.append(graphicsLabel,graphicsButton);

  const resolutionRow=document.createElement('div');resolutionRow.dataset.renderScaleRow='1';resolutionRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1fr);gap:8px;align-items:center;margin-top:9px;';
  const resolutionLabel=document.createElement('div');resolutionLabel.textContent='Internal Resolution';resolutionLabel.title='Internal render resolution used by DX Graphics. Original is 320×200; higher values increase sharpness and GPU load. Disabled when DX Graphics is off.';resolutionLabel.style.cssText='font-size:12px;color:#ddd;';
  const resolution=document.createElement('select');resolution.dataset.renderScale='1';resolution.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;font:12px/1.2 system-ui,Segoe UI,sans-serif;';
  for(const scale of ENHANCED_RENDER_SCALES){const option=document.createElement('option');option.value=String(scale);option.textContent=scale===1?'Original (1× · 320×200)':`${scale}× · ${320*scale}×${200*scale}`;resolution.append(option);}
  resolution.addEventListener('change',()=>{void persistEnhancedRenderScale(Number(resolution.value));renderResolutionState();});
  resolutionRow.append(resolutionLabel,resolution);

  const backgroundRow=document.createElement('div');backgroundRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;margin-top:9px;';
  const backgroundLabel=document.createElement('div');backgroundLabel.textContent='High-Res Background';backgroundLabel.title='Uses enhanced panorama/background artwork where available.';backgroundLabel.style.cssText='font-size:12px;color:#ddd;';
  const backgroundButton=document.createElement('button');backgroundButton.type='button';backgroundButton.dataset.backgroundToggle='1';backgroundButton.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  backgroundButton.addEventListener('click',()=>{setEnhancedBackgroundEnabled(!enhancedBackgroundEnabled());renderTextureState();});
  backgroundRow.append(backgroundLabel,backgroundButton);

  const cockpitRow=document.createElement('div');cockpitRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;margin-top:9px;';
  const cockpitLabel=document.createElement('div');cockpitLabel.textContent='High-Res Cockpit';cockpitLabel.title='Uses editable high-resolution cockpit artwork without changing the enhanced 3D renderer or background.';cockpitLabel.style.cssText='font-size:12px;color:#ddd;';
  const cockpitButton=document.createElement('button');cockpitButton.type='button';cockpitButton.dataset.cockpitToggle='1';cockpitButton.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  cockpitButton.addEventListener('click',()=>{setEnhancedCockpitEnabled(!enhancedCockpitEnabled());renderTextureState();});
  cockpitRow.append(cockpitLabel,cockpitButton);

  const fovRow=document.createElement('div');fovRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1.5fr) 62px;gap:8px;align-items:center;margin-top:9px;';
  const fovLabel=document.createElement('div');fovLabel.textContent='Field of View';fovLabel.title='0% keeps the original 4:3 view. 100% expands the enhanced 3D renderer to the full current window width without changing vertical FOV.';fovLabel.style.cssText='font-size:12px;color:#ddd;';
  const fov=document.createElement('input');fov.type='range';fov.min='0';fov.max='100';fov.step='1';fov.dataset.fovWidth='1';fov.style.cssText='width:100%;';
  const fovValue=document.createElement('output');fovValue.dataset.fovWidthValue='1';fovValue.style.cssText='font:11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eee;text-align:right;';
  fov.addEventListener('input',()=>{setEnhancedFovWidth(Number(fov.value));renderFovState();});
  fovRow.append(fovLabel,fov,fovValue);

  const fpsRow=document.createElement('div');fpsRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 84px;gap:8px;align-items:center;margin-top:9px;';
  const fpsLabel=document.createElement('div');fpsLabel.textContent='FPS Counter';fpsLabel.style.cssText='font-size:12px;color:#ddd;';
  const fps=document.createElement('button');fps.type='button';fps.dataset.fpsToggle='1';fps.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  fps.addEventListener('click',()=>{
   const next=!storedFpsVisible();saveFpsVisible(next);
   if(graphicsEnabled()&&dispatchFpsShortcut())fpsStateApplied=true;else fpsStateApplied=false;
   renderFpsState();
  });
  fpsRow.append(fpsLabel,fps);
  videoSection.append(videoHeading,graphicsRow,resolutionRow,backgroundRow,cockpitRow,fovRow,fpsRow);

  const deadzoneRow=document.createElement('div');deadzoneRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1.5fr) 48px;gap:8px;align-items:center;margin-top:9px;';
  const deadzoneLabel=document.createElement('div');deadzoneLabel.textContent='Steering Deadzone';deadzoneLabel.title='Wheel only. Small steering movements around the calibrated center are ignored.';deadzoneLabel.style.cssText='font-size:12px;color:#ddd;';
  const deadzone=document.createElement('input');deadzone.type='range';deadzone.min='0';deadzone.max=String(maxSteeringDeadzonePercent);deadzone.step='1';deadzone.dataset.steeringDeadzone='1';deadzone.style.cssText='width:100%;';
  const deadzoneValue=document.createElement('output');deadzoneValue.dataset.steeringDeadzoneValue='1';deadzoneValue.style.cssText='font:12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eee;text-align:right;';
  deadzone.addEventListener('input',()=>{saveSteeringDeadzone(Number(deadzone.value));renderSteeringDeadzone();});
  deadzone.addEventListener('change',()=>void persistSteeringDeadzone(Number(deadzone.value)));
  deadzoneRow.append(deadzoneLabel,deadzone,deadzoneValue);

  const linearityRow=document.createElement('div');linearityRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1.5fr) 48px;gap:8px;align-items:center;margin-top:9px;';
  const linearityLabel=document.createElement('div');linearityLabel.textContent='Steering Linearity';linearityLabel.title='Wheel only. 1.00 is direct linear steering. Higher values reduce sensitivity around center while keeping full lock unchanged.';linearityLabel.style.cssText='font-size:12px;color:#ddd;';
  const linearity=document.createElement('input');linearity.type='range';linearity.min=String(minSteeringLinearity);linearity.max=String(maxSteeringLinearity);linearity.step='0.05';linearity.dataset.steeringLinearity='1';linearity.style.cssText='width:100%;';
  const linearityValue=document.createElement('output');linearityValue.dataset.steeringLinearityValue='1';linearityValue.style.cssText='font:12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eee;text-align:right;';
  linearity.addEventListener('input',()=>{saveSteeringLinearity(Number(linearity.value));renderSteeringLinearity();});
  linearity.addEventListener('change',()=>void persistSteeringLinearity(Number(linearity.value)));
  linearityRow.append(linearityLabel,linearity,linearityValue);

  section.append(heading,mapRow,buttonRow,deadzoneRow,linearityRow,videoSection);panel.insertBefore(section,controlsSection);renderGraphicsState();renderResolutionState();renderTextureState();renderFovState();renderFpsState();renderOpenMapState();renderOptionsButtonState();renderSteeringDeadzone();renderSteeringLinearity();applyStoredFps();
 };
 frame=requestAnimationFrame(mount);

 const onTrustedF=(event:KeyboardEvent)=>{
  if(disposed||event.code!=='KeyF'||event.repeat||!event.isTrusted||!graphicsEnabled())return;
  const canvas=gameCanvas();if(!canvas||event.target!==canvas)return;
  saveFpsVisible(!storedFpsVisible());fpsStateApplied=true;renderFpsState();
 };
 window.addEventListener('keydown',onTrustedF,true);

 const graphicsObserver=new MutationObserver(()=>requestAnimationFrame(()=>{renderGraphicsState();renderResolutionState();applyStoredFps();}));
 const observeGraphics=()=>{
  if(disposed)return;
  const toggle=document.querySelector<HTMLButtonElement>('.desktop-game-shell .game-toolbar button[aria-pressed]');
  if(!toggle){requestAnimationFrame(observeGraphics);return;}
  graphicsObserver.observe(toggle,{attributes:true,attributeFilter:['aria-pressed']});applyStoredFps();
 };
 requestAnimationFrame(observeGraphics);

 return()=>{disposed=true;cancelAnimationFrame(frame);graphicsObserver.disconnect();window.removeEventListener('keydown',onTrustedF,true);section?.remove();};
}
