import {
  DESKTOP_CONTROL_DEFINITIONS,
  desktopControlBindings,
  desktopControlChord,
  formatDesktopControlChord,
  resetDesktopControlAction,
  resetDesktopControlBindings,
  setDesktopControlButton,
  setDesktopControlCapture,
  setDesktopControlKeyboard,
  updateDesktopControlDevices,
  type DesktopControlAction,
} from '../lib/game/desktop-control-bindings';

type NativeJoystick={id:string;name:string;axes:number[];buttons:number[]};
type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
type Capture={kind:'keyboard'|'button';action:DesktopControlAction};

const buttonStyle='border:1px solid #555;background:#252525;color:#eee;border-radius:4px;padding:5px 8px;cursor:pointer;font:12px/1.2 system-ui,Segoe UI,sans-serif;text-align:left;min-height:30px;';
const reserved=new Set(['F8','F10','F11']);

function nativeCore(){return (window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__?.core;}
function snapshot(devices:readonly NativeJoystick[]){return new Map(devices.map(device=>[device.id,[...device.buttons]] as const));}
function controllerLabel(binding:{deviceId:string;deviceName?:string;button:number}|undefined){return binding?`${binding.deviceName||binding.deviceId} · B${binding.button}`:'—';}

/** Adds complete original Stunts key/button remapping to the existing F8 panel. */
export function installDesktopControlBindings(){
 const core=nativeCore();
 let disposed=false,polling=false,section:HTMLDivElement|undefined,capture:Capture|undefined;
 let devices:NativeJoystick[]=[],captureBefore=new Map<string,number[]>(),notice='';
 let frame=0;

 const finishCapture=()=>{capture=undefined;setDesktopControlCapture(false);render();};
 const startCapture=(next:Capture)=>{
  capture=next;notice=next.kind==='keyboard'?'Press a keyboard key or chord.':'Press a joystick / wheel button.';
  captureBefore=snapshot(devices);setDesktopControlCapture(true);render();
 };

 function render(){
  if(!section)return;
  section.replaceChildren();
  const heading=document.createElement('div');heading.textContent='Controls / Key Bindings';heading.style.cssText='font-size:15px;font-weight:700;margin-bottom:4px;';
  const intro=document.createElement('div');intro.textContent='Original Stunts controls. Click a field, then press a key/chord or a button on any Windows joystick/wheel. Arrow, Space and Enter mappings are reused by the original menus and replay controls.';intro.style.cssText='color:#aaa;font-size:12px;margin-bottom:10px;';
  const status=document.createElement('div');status.textContent=capture?notice:'Bindings are stored in config.ini. F8, F10 and F11 remain reserved for PlayStunts DX.';status.style.cssText=`padding:7px 9px;border-radius:4px;margin-bottom:10px;font-size:12px;${capture?'background:#3a3218;color:#ffe7a2;':'background:#101010;color:#999;'}`;
  section.append(heading,intro,status);

  const bindings=desktopControlBindings();let group='';
  for(const definition of DESKTOP_CONTROL_DEFINITIONS){
   if(definition.group!==group){group=definition.group;const title=document.createElement('div');title.textContent=group;title.style.cssText='margin:12px 0 5px;font-weight:700;color:#ddd;border-bottom:1px solid #333;padding-bottom:3px;';section.append(title);}
   const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:minmax(145px,1.2fr) minmax(120px,1fr) minmax(150px,1.15fr) 54px;gap:6px;align-items:center;margin:4px 0;';
   const label=document.createElement('div');label.textContent=definition.label;label.title=definition.help;label.style.cssText='font-size:12px;color:#ddd;';
   const keyboard=document.createElement('button');keyboard.type='button';keyboard.style.cssText=buttonStyle;keyboard.title='Click, then press a keyboard key or chord';keyboard.textContent=capture?.action===definition.id&&capture.kind==='keyboard'?'Press key…':(bindings[definition.id].keys.map(formatDesktopControlChord).join(' / ')||'—');keyboard.addEventListener('click',()=>startCapture({kind:'keyboard',action:definition.id}));
   const controller=document.createElement('button');controller.type='button';controller.style.cssText=buttonStyle;controller.title='Click, then press a button on a joystick or wheel';controller.textContent=capture?.action===definition.id&&capture.kind==='button'?'Press button…':controllerLabel(bindings[definition.id].button);controller.addEventListener('click',()=>startCapture({kind:'button',action:definition.id}));
   const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';reset.style.cssText=buttonStyle+'text-align:center;';reset.title='Restore this action to the original keyboard default and clear its controller button';reset.addEventListener('click',()=>{resetDesktopControlAction(definition.id);notice='';finishCapture();});
   row.append(label,keyboard,controller,reset);section.append(row);
  }
  const footer=document.createElement('div');footer.style.cssText='display:flex;gap:8px;align-items:center;margin-top:12px;';
  const resetAll=document.createElement('button');resetAll.type='button';resetAll.textContent='Reset all controls';resetAll.style.cssText=buttonStyle+'padding:7px 10px;';resetAll.addEventListener('click',()=>{resetDesktopControlBindings();notice='Original Stunts controls restored.';finishCapture();});
  const columns=document.createElement('span');columns.textContent='Keyboard · Controller';columns.style.cssText='margin-left:auto;color:#777;font-size:11px;';footer.append(resetAll,columns);section.append(footer);
 }

 const keyboardCapture=(event:KeyboardEvent)=>{
  if(!capture||capture.kind!=='keyboard'||event.repeat)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(reserved.has(event.code)||(event.altKey&&event.code==='Enter')){notice=`${event.key||event.code} is reserved by PlayStunts DX.`;render();return;}
  if((event.code==='Backspace'||event.code==='Delete')&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.metaKey){setDesktopControlKeyboard(capture.action,undefined);notice='Keyboard binding cleared.';finishCapture();return;}
  const chord=desktopControlChord(event);if(!chord)return;
  setDesktopControlKeyboard(capture.action,chord);notice=`Assigned ${formatDesktopControlChord(chord)}.`;finishCapture();
 };
 window.addEventListener('keydown',keyboardCapture,true);

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

 async function pollDevices(){
  if(disposed||polling||!core)return;polling=true;
  try{
   const next=await core.invoke<NativeJoystick[]>('native_joysticks');if(disposed)return;
   devices=next;
   // While capture is armed this updates the runtime baseline in suspended mode.
   // The button used for assignment therefore cannot leak through to the game.
   updateDesktopControlDevices(next);detectButtonCapture(next);
  }catch(reason){if(!disposed)console.warn('[Controls] Control-button scan failed:',reason);}
  finally{polling=false;}
 }
 void pollDevices();const timer=window.setInterval(()=>void pollDevices(),24);

 const mount=()=>{
  if(disposed||section)return;
  const toggle=Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('Wheel Setup [F8]'));
  const panel=toggle?.parentElement?.querySelector<HTMLDivElement>('div');
  if(!panel){frame=requestAnimationFrame(mount);return;}
  section=document.createElement('div');section.style.cssText='margin-top:12px;padding:12px;background:#181818;border:1px solid #444;border-radius:6px;';panel.append(section);render();
 };
 frame=requestAnimationFrame(mount);

 return()=>{
  disposed=true;window.clearInterval(timer);cancelAnimationFrame(frame);window.removeEventListener('keydown',keyboardCapture,true);setDesktopControlCapture(false);updateDesktopControlDevices([]);section?.remove();
 };
}