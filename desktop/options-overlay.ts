const fpsStorageKey='playstunts-dx-fps-visible';
const steeringDeadzoneStorageKey='playstunts-dx-steering-deadzone-percent';
const defaultSteeringDeadzonePercent=4;
const maxSteeringDeadzonePercent=15;

type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
type NativeConfigFile={content:string};

function tauriCore(){return (window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__?.core;}
function clampSteeringDeadzone(value:number){return Math.max(0,Math.min(maxSteeringDeadzonePercent,Math.round(value)));}
function storedSteeringDeadzone(){
 const saved=Number(window.localStorage.getItem(steeringDeadzoneStorageKey));
 return Number.isFinite(saved)?clampSteeringDeadzone(saved):defaultSteeringDeadzonePercent;
}
function saveSteeringDeadzone(value:number){window.localStorage.setItem(steeringDeadzoneStorageKey,String(clampSteeringDeadzone(value)));}
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
async function loadNativeSteeringDeadzone(){
 const core=tauriCore();if(!core)return;
 try{
  const file=await core.invoke<NativeConfigFile>('native_config');
  const value=Number(configValue(file.content,'Controls','SteeringDeadzone'));
  if(Number.isFinite(value))saveSteeringDeadzone(value);
 }catch(reason){console.warn('[Options] Steering deadzone config load failed:',reason);}
}
async function persistSteeringDeadzone(value:number){
 const deadzone=clampSteeringDeadzone(value);saveSteeringDeadzone(deadzone);
 const core=tauriCore();if(!core)return;
 try{await core.invoke<void>('native_config_set',{section:'Controls',key:'SteeringDeadzone',value:String(deadzone)});}
 catch(reason){console.warn('[Options] Steering deadzone config save failed:',reason);}
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
export function installDesktopOptionsOverlay(){
 let disposed=false,frame=0,section:HTMLDivElement|undefined,fpsStateApplied=false;
 void loadNativeSteeringDeadzone().then(()=>renderSteeringDeadzone());

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

  const deadzoneRow=document.createElement('div');deadzoneRow.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) minmax(150px,1.5fr) 48px;gap:8px;align-items:center;margin-top:9px;';
  const deadzoneLabel=document.createElement('div');deadzoneLabel.textContent='Steering Deadzone';deadzoneLabel.title='Wheel only. Small steering movements around the calibrated center are ignored.';deadzoneLabel.style.cssText='font-size:12px;color:#ddd;';
  const deadzone=document.createElement('input');deadzone.type='range';deadzone.min='0';deadzone.max=String(maxSteeringDeadzonePercent);deadzone.step='1';deadzone.dataset.steeringDeadzone='1';deadzone.style.cssText='width:100%;';
  const deadzoneValue=document.createElement('output');deadzoneValue.dataset.steeringDeadzoneValue='1';deadzoneValue.style.cssText='font:12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eee;text-align:right;';
  deadzone.addEventListener('input',()=>{saveSteeringDeadzone(Number(deadzone.value));renderSteeringDeadzone();});
  deadzone.addEventListener('change',()=>void persistSteeringDeadzone(Number(deadzone.value)));
  deadzoneRow.append(deadzoneLabel,deadzone,deadzoneValue);

  section.append(heading,row,deadzoneRow);panel.insertBefore(section,controlsSection);renderFpsState();renderSteeringDeadzone();applyStoredFps();
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
