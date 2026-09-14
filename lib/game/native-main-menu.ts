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
 if(steering<=-.65)return 2;
 if(steering<=-.25)return 1;
 if(steering<.25)return 0;
 if(steering<.65)return 3;
 return 4;
};

/** Present and flash before waiting for input, matching 3795..3820. */
export async function runNativeMainMenuSelection(host:NativeMainMenuHost){
 const menu=createOriginalMainMenu(host);let time=host.counter();
 for(;;){
  const now=host.counter(),delta=(now-time)&65535;time=now;
  menu.frame(delta);
  const input=await host.input(),selection=wheelMenuSelection();
  // In Wheel mode the steering position owns horizontal menu selection.
  // Suppress the old repeated joystick left/right keys so the highlight follows
  // the wheel directly instead of stepping through signs like a keyboard.
  const key=selection!==undefined&&(input.key===0x4b00||input.key===0x4d00)?0:input.key;
  const result=menu.accept({delta,key,x:input.x,y:input.y,mouseEnabled:input.mouseActive,selection});
  if(result.result!==undefined)return {selection:result.result,idleExpired:result.state.idleExpired};
 }
}

/** Selection-only adapter for callers that do not enter a race. */
export async function runNativeMainMenu(host:NativeMainMenuHost){return (await runNativeMainMenuSelection(host)).selection;}
