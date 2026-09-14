import {createOriginalMainMenu,type MainMenuPresentation} from './main-menu-runtime.ts';
import type {NativeMenuInput} from './native-dialog-runtime.ts';
import {desktopInputDevice,getDesktopWheelInput} from './desktop-wheel-input.ts';
export interface NativeMainMenuHost extends MainMenuPresentation {
 counter():number;
 input():Promise<NativeMenuInput>;
}

const wheelMenuSelection=()=>{
 if(desktopInputDevice()!=='wheel')return undefined;
 const wheel=getDesktopWheelInput();
 if(!wheel.configured||!wheel.connected)return undefined;
 const steering=Math.max(-1,Math.min(1,wheel.steering));
 if(steering<=-.7)return 2;
 if(steering<=-.3)return 1;
 if(steering<.3)return 0;
 if(steering<.7)return 3;
 return 4;
};

const wheelThrottlePressed=()=>{
 if(desktopInputDevice()!=='wheel')return false;
 const wheel=getDesktopWheelInput();
 return wheel.configured&&wheel.connected&&wheel.throttle>.12;
};

/** Present and flash before waiting for input, matching 3795..3820. */
export async function runNativeMainMenuSelection(host:NativeMainMenuHost){
 const menu=createOriginalMainMenu(host);let time=host.counter(),throttleHeld=wheelThrottlePressed();
 for(;;){
  const now=host.counter(),delta=(now-time)&65535;time=now;
  menu.frame(delta);
  const input=await host.input(),selection=wheelMenuSelection(),throttle=wheelThrottlePressed(),throttlePress=throttle&&!throttleHeld;
  throttleHeld=throttle;
  // In Wheel mode the steering position owns horizontal menu selection.
  // A fresh throttle press confirms the currently selected sign. Suppress the
  // old repeated joystick direction keys so wheel/pedal input remains direct.
  const key=throttlePress?13:selection!==undefined&&(input.key===0x4b00||input.key===0x4d00||input.key===0x4800)?0:input.key;
  const result=menu.accept({delta,key,x:input.x,y:input.y,mouseEnabled:input.mouseActive,selection});
  if(result.result!==undefined)return {selection:result.result,idleExpired:result.state.idleExpired};
 }
}

/** Selection-only adapter for callers that do not enter a race. */
export async function runNativeMainMenu(host:NativeMainMenuHost){return (await runNativeMainMenuSelection(host)).selection;}
