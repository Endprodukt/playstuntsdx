import {
  DESKTOP_CONTROL_DEFINITIONS,
  desktopControlBindings,
  desktopControlChord,
  desktopControlKeyboardTarget,
  formatDesktopControlChord,
  resetDesktopControlAction,
  resetDesktopControlBindings,
  setDesktopControlButton,
  setDesktopControlCapture,
  setDesktopControlKeyboard,
  updateDesktopControlDevices,
  type DesktopControlAction,
} from '../lib/game/desktop-control-bindings';
import {
  enhancedChaseCameraPosition,
  resetEnhancedChaseCameraPositions,
  setEnhancedChaseCameraPosition,
  type EnhancedChaseCameraPresetLevel,
} from '../lib/game/enhanced-chase-camera-settings';

type NativeJoystick={id:string;name:string;axes:number[];buttons:number[]};
type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
type Capture={kind:'keyboard'|'button';action:DesktopControlAction};

const buttonStyle='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:5px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:left;min-height:30px;';
const inputStyle='border:1px solid #555;background:#101010;color:#eee;border-radius:4px;padding:5px 7px;width:84px;font:12px/1.2 system-ui,Segoe UI,sans-serif;';
const reserved=new Set(['F8','F10','F11']);

function nativeCore(){return (window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__?.core;}
function snapshot(devices:readonly NativeJoystick[]){return new Map(devices.map(device=>[device.id,[...device.buttons]] as const));}
function controllerLabel(binding:{deviceId:string;deviceName?:string;button:number}|undefined){return binding?`${binding.deviceName||binding.deviceId} · B${binding.button}`:'—';}
function browserGamepads():NativeJoystick[]{
 if(typeof navigator.getGamepads!=='function')return [];
 return Array.from(navigator.getGamepads()).filter((pad):pad is Gamepad=>!!pad?.connected).map(pad=>({
  id:`web:${pad.index}:${pad.id}`,
  name:pad.id||`Gamepad ${pad.index}`,
  axes:[...pad.axes],
  buttons:pad.buttons.map(button=>button.value),
 }));
}

/** Adds complete original Stunts key/button remapping to the existing F8 panel. */
export function installDesktopControlBindings(){
 const core=nativeCore();
 let disposed=false,polling=false,section:HTMLDivElement|undefined,capture:Capture|undefined;
 let devices:NativeJoystick[]=[],captureBefore=new Map<string,number[]>(),buttonBefore=new Map<string,number[]>(),notice='';
 let frame=0;

 const finishCapture=()=>{capture=undefined;setDesktopControlCapture(false);render();};
 const startCapture=(next:Capture)=>{
  capture=next;notice=next.kind==='keyboard'?'Press a keyboard key or chord. Backspace/Delete clears it.':'Press a joystick / wheel / gamepad button. Backspace/Delete clears it.';
  captureBefore=snapshot(devices);setDesktopControlCapture(true);render();
 };
 const dispatchChaseView=()=>{
  const canvas=document.querySelector<HTMLCanvasElement>('.desktop-game-shell canvas');
  if(!canvas)return;
  canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'v',code:'KeyV',bubbles:true,cancelable:true}));
  canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'v',code:'KeyV',bubbles:true,cancelable:true}));
 };
 const panelVisible=()=>{
  const panel=section?.parentElement;
  return !!panel&&panel.style.display!=='none';
 };

 function render(){
  if(!section)return;
  section.replaceChildren();
  const heading=document.createElement('div');heading.textContent='Controls / Key Bindings';heading.style.cssText='font-size:15px;font-weight:700;margin-bottom:4px;';
  const intro=document.createElement('div');intro.textContent='Original Stunts controls and PlayStunts DX race actions. Click a field, then press a key/chord or a button on any joystick, wheel or gamepad.';intro.style.cssText='color:#aaa;font-size:12px;margin-bottom:10px;';
  const status=document.createElement('div');status.textContent=capture?notice:'Bindings and enhanced chase camera positions are stored in config.ini. F8, F10 and F11 remain reserved for PlayStunts DX.';status.style.cssText=`padding:7px 9px;border-radius:4px;margin-bottom:10px;font-size:12px;${capture?'background:#3a3218;color:#ffe7a2;':'background:#101010;color:#999;'}`;
  section.append(heading,intro,status);

  const bindings=desktopControlBindings();let group='';
  for(const definition of DESKTOP_CONTROL_DEFINITIONS){
   if(definition.group!==group){group=definition.group;const title=document.createElement('div');title.textContent=group;title.style.cssText='margin:12px 0 5px;font-weight:700;color:#ddd;border-bottom:1px solid #333;padding-bottom:3px;';section.append(title);}
   const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:minmax(145px,1.2fr) minmax(120px,1fr) minmax(150px,1.15fr) 54px;gap:6px;align-items:center;margin:4px 0;';
   const label=document.createElement('div');label.textContent=definition.label;label.title=definition.help;label.style.cssText='font-size:12px;color:#ddd;';
   const keyboard=document.createElement('button');keyboard.type='button';keyboard.style.cssText=buttonStyle;keyboard.title='Click, then press a keyboard key or chord';keyboard.textContent=capture?.action===definition.id&&capture.kind==='keyboard'?'Press key…':(bindings[definition.id].keys.map(formatDesktopControlChord).join(' / ')||'—');keyboard.addEventListener('click',()=>startCapture({kind:'keyboard',action:definition.id}));
   const controller=document.createElement('button');controller.type='button';controller.style.cssText=buttonStyle;controller.title='Click, then press a button on a joystick, wheel or gamepad';controller.textContent=capture?.action===definition.id&&capture.kind==='button'?'Press button…':controllerLabel(bindings[definition.id].button);controller.addEventListener('click',()=>startCapture({kind:'button',action:definition.id}));
   const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';reset.style.cssText=buttonStyle+'text-align:center;';reset.title='Restore this action to its default keyboard binding and clear its controller button';reset.addEventListener('click',()=>{resetDesktopControlAction(definition.id);notice='Default binding restored.';finishCapture();});
   row.append(label,keyboard,controller,reset);section.append(row);
  }
  const footer=document.createElement('div');footer.style.cssText='display:flex;gap:8px;align-items:center;margin-top:12px;';
  const resetAll=document.createElement('button');resetAll.type='button';resetAll.textContent='Reset all controls';resetAll.style.cssText=buttonStyle+'padding:7px 10px;';resetAll.addEventListener('click',()=>{resetDesktopControlBindings();notice='Default controls restored.';finishCapture();});
  const columns=document.createElement('span');columns.textContent='Keyboard · Controller';columns.style.cssText='margin-left:auto;color:#777;font-size:11px;';footer.append(resetAll,columns);section.append(footer);

  const cameraTitle=document.createElement('div');cameraTitle.textContent='Enhanced Chase Camera';cameraTitle.style.cssText='margin:16px 0 5px;font-weight:700;color:#ddd;border-bottom:1px solid #333;padding-bottom:3px;';section.append(cameraTitle);
  const cameraHelp=document.createElement('div');cameraHelp.textContent='Change View cycles Cockpit → Close → Standard → Far → Cockpit. Distance is the camera arm behind the car; Height is the camera position above it.';cameraHelp.style.cssText='color:#999;font-size:11px;margin-bottom:8px;';section.append(cameraHelp);
  const header=document.createElement('div');header.style.cssText='display:grid;grid-template-columns:minmax(145px,1.2fr) 100px 100px;gap:8px;color:#888;font-size:11px;margin-bottom:3px;';header.innerHTML='<span>View</span><span>Distance</span><span>Height</span>';section.append(header);
  const labels:Record<EnhancedChaseCameraPresetLevel,string>={1:'Close',2:'Standard',3:'Far'};
  for(const level of [1,2,3] as const){
   const values=enhancedChaseCameraPosition(level),row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:minmax(145px,1.2fr) 100px 100px;gap:8px;align-items:center;margin:4px 0;';
   const label=document.createElement('div');label.textContent=labels[level];label.style.cssText='font-size:12px;color:#ddd;';
   const distance=document.createElement('input');distance.type='number';distance.min='80';distance.max='1000';distance.step='1';distance.value=String(values.distance);distance.style.cssText=inputStyle;
   const height=document.createElement('input');height.type='number';height.min='20';height.max='500';height.step='1';height.value=String(values.height);height.style.cssText=inputStyle;
   distance.addEventListener('change',()=>{setEnhancedChaseCameraPosition(level,'distance',Number(distance.value));distance.value=String(enhancedChaseCameraPosition(level).distance);notice=`${labels[level]} distance saved.`;status.textContent=notice;});
   height.addEventListener('change',()=>{setEnhancedChaseCameraPosition(level,'height',Number(height.value));height.value=String(enhancedChaseCameraPosition(level).height);notice=`${labels[level]} height saved.`;status.textContent=notice;});
   row.append(label,distance,height);section.append(row);
  }
  const resetCamera=document.createElement('button');resetCamera.type='button';resetCamera.textContent='Reset chase camera positions';resetCamera.style.cssText=buttonStyle+'margin-top:8px;padding:7px 10px;';resetCamera.addEventListener('click',()=>{resetEnhancedChaseCameraPositions();notice='Chase camera positions restored.';render();});section.append(resetCamera);
 }

 const keyboardCapture=(event:KeyboardEvent)=>{
  if(!capture||event.repeat)return;
  event.preventDefault();event.stopImmediatePropagation();
  const plainDelete=(event.code==='Backspace'||event.code==='Delete')&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.metaKey;
  if(plainDelete){
   if(capture.kind==='keyboard'){setDesktopControlKeyboard(capture.action,undefined);notice='Keyboard binding cleared.';}
   else {setDesktopControlButton(capture.action,undefined);notice='Controller binding cleared.';}
   finishCapture();return;
  }
  if(capture.kind==='button'){
   if(event.code==='Escape'){notice='Controller capture cancelled.';finishCapture();}
   return;
  }
  if(reserved.has(event.code)||(event.altKey&&event.code==='Enter')){notice=`${event.key||event.code} is reserved by PlayStunts DX.`;render();return;}
  const chord=desktopControlChord(event);if(!chord)return;
  setDesktopControlKeyboard(capture.action,chord);notice=`Assigned ${formatDesktopControlChord(chord)}.`;finishCapture();
 };
 window.addEventListener('keydown',keyboardCapture,true);

 const forwardChaseView=(event:KeyboardEvent)=>{
  if(!event.isTrusted||event.repeat||capture||panelVisible())return;
  if(desktopControlKeyboardTarget(event)?.action!=='enhanced-chase-view')return;
  event.preventDefault();event.stopImmediatePropagation();dispatchChaseView();
 };
 window.addEventListener('keydown',forwardChaseView,true);

 // Buttons in the F8 panel can retain DOM focus after the panel is hidden.
 // If that happens, a trusted Escape would never reach the game canvas. Route
 // it back to the original input adapter instead of requiring a mouse click.
 const forwardEscape=(event:KeyboardEvent)=>{
  if(event.code!=='Escape'||!event.isTrusted||capture)return;
  const panel=section?.parentElement;
  if(panel&&panel.style.display!=='none')return;
  if(event.target instanceof HTMLCanvasElement)return;
  const canvas=document.querySelector<HTMLCanvasElement>('.desktop-game-shell canvas');
  if(!canvas)return;
  canvas.focus({preventScroll:true});
  canvas.dispatchEvent(new KeyboardEvent(event.type,{
   key:'Escape',code:'Escape',bubbles:true,cancelable:true,repeat:event.repeat,
   ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey,
  }));
  event.preventDefault();event.stopImmediatePropagation();
 };
 window.addEventListener('keydown',forwardEscape,true);
 window.addEventListener('keyup',forwardEscape,true);

 function detectButtonCapture(next:readonly NativeJoystick[]){
  if(!capture||capture.kind!=='button'){captureBefore=snapshot(next);return;}
  for(const device of next){
   const before=captureBefore.get(device.id)??[];
   for(let index=0;index<device.buttons.length;index++){
    if((device.buttons[index]??0)>.55&&(before[index]??0)<=.55){
     setDesktopControlButton(capture.action,{deviceId:device.id,deviceName:device.name,button:index});notice=`Assigned ${device.name} button ${index}.`;finishCapture();captureBefore=snapshot(next);return;
    }
   }
  }
  captureBefore=snapshot(next);
 }
 function detectChaseButton(next:readonly NativeJoystick[]){
  const binding=desktopControlBindings()['enhanced-chase-view'].button;
  if(!capture&&!panelVisible()&&binding){
   const device=next.find(candidate=>candidate.id===binding.deviceId),previous=buttonBefore.get(binding.deviceId)?.[binding.button]??0,current=device?.buttons[binding.button]??0;
   if(current>.55&&previous<=.55)dispatchChaseView();
  }
  buttonBefore=snapshot(next);
 }

 async function pollDevices(){
  if(disposed||polling)return;polling=true;
  try{
   const native=core?await core.invoke<NativeJoystick[]>('native_joysticks'):[];if(disposed)return;
   const browser=browserGamepads();
   const nativeIds=new Set(native.map(device=>device.id));
   const next=[...native,...browser.filter(device=>!nativeIds.has(device.id))];
   devices=next;
   // While capture is armed this updates the runtime baseline in suspended mode.
   // The button used for assignment therefore cannot leak through to the game.
   updateDesktopControlDevices(next);detectChaseButton(next);detectButtonCapture(next);
  }catch(reason){if(!disposed)console.warn('[Controls] Control-button scan failed:',reason);}
  finally{polling=false;}
 }
 void pollDevices();const timer=window.setInterval(()=>void pollDevices(),24);

 const mount=()=>{
  if(disposed||section)return;
  const toggle=Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('Wheel Setup [F8]')||button.textContent?.includes('Controls [F8]'));
  const panel=toggle?.parentElement?.querySelector<HTMLDivElement>('div');
  if(!panel){frame=requestAnimationFrame(mount);return;}
  section=document.createElement('div');section.style.cssText='margin-top:12px;padding:12px;background:#181818;border:1px solid #444;border-radius:6px;';panel.append(section);render();
 };
 frame=requestAnimationFrame(mount);

 return()=>{
  disposed=true;window.clearInterval(timer);cancelAnimationFrame(frame);
  window.removeEventListener('keydown',keyboardCapture,true);
  window.removeEventListener('keydown',forwardChaseView,true);
  window.removeEventListener('keydown',forwardEscape,true);
  window.removeEventListener('keyup',forwardEscape,true);
  setDesktopControlCapture(false);updateDesktopControlDevices([]);section?.remove();
 };
}
