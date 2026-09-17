import {COCKPIT_PIXEL_SCALER_OPTIONS,cockpitPixelScalerMode,setCockpitPixelScalerMode,type CockpitPixelScalerMode} from '../lib/game/cockpit-pixel-scaler-settings';

const fpsStorageKey='playstunts-dx-fps-visible';

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
  const rows=document.createElement('div');rows.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 120px;gap:8px;align-items:center;';
  const label=document.createElement('div');label.textContent='FPS Counter';label.style.cssText='font-size:12px;color:#ddd;';
  const fps=document.createElement('button');fps.type='button';fps.dataset.fpsToggle='1';fps.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:center;';
  fps.addEventListener('click',()=>{
   const next=!storedFpsVisible();saveFpsVisible(next);
   if(graphicsEnabled()&&dispatchFpsShortcut())fpsStateApplied=true;else fpsStateApplied=false;
   renderFpsState();
  });
  const scalerLabel=document.createElement('div');scalerLabel.textContent='Cockpit Pixel Scaler';scalerLabel.style.cssText='font-size:12px;color:#ddd;';
  const scaler=document.createElement('select');scaler.style.cssText='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:6px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;';
  for(const option of COCKPIT_PIXEL_SCALER_OPTIONS){
   const element=document.createElement('option');element.value=option.value;element.textContent=option.label;scaler.append(element);
  }
  scaler.value=cockpitPixelScalerMode();
  scaler.addEventListener('change',()=>setCockpitPixelScalerMode(scaler.value as CockpitPixelScalerMode));
  rows.append(label,fps,scalerLabel,scaler);
  section.append(heading,rows);panel.insertBefore(section,controlsSection);renderFpsState();applyStoredFps();
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
