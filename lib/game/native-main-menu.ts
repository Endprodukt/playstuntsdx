import {createOriginalMainMenu,type MainMenuPresentation} from './main-menu-runtime.ts';
import type {NativeMenuInput} from './native-dialog-runtime.ts';
import {desktopInputDevice,getDesktopWheelInput} from './desktop-wheel-input.ts';
export interface NativeMainMenuHost extends MainMenuPresentation {
 counter():number;
 input():Promise<NativeMenuInput&{keyboardKey?:number}>;
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
 const menu=createOriginalMainMenu(host);let time=host.counter(),throttleHeld=wheelThrottlePressed(),lastWheelSelection=wheelMenuSelection(),wheelOwns=lastWheelSelection!==undefined;
 for(;;){
  const now=host.counter(),delta=(now-time)&65535;time=now;
  menu.frame(delta);
  const input=await host.input(),selection=wheelMenuSelection(),throttle=wheelThrottlePressed(),throttlePress=throttle&&!throttleHeld;
  const wheelChanged=selection!==lastWheelSelection;
  throttleHeld=throttle;lastWheelSelection=selection;
  // Wheel, keyboard and mouse are all valid main-menu inputs. The most recent
  // device owns selection until another device is used, so a centred wheel no
  // longer snaps the menu back while the user navigates with keys or the mouse.
  if(input.keyboardKey||input.mouseActive)wheelOwns=false;
  if(wheelChanged||throttlePress)wheelOwns=selection!==undefined;
  const syntheticWheelDirection=selection!==undefined&&!input.keyboardKey&&(input.key===0x4b00||input.key===0x4d00||input.key===0x4800||input.key===0x5000);
  const key=throttlePress?13:syntheticWheelDirection?0:input.key;
  const result=menu.accept({delta,key,x:input.x,y:input.y,mouseEnabled:input.mouseActive,selection:wheelOwns?selection:undefined});
  if(result.result!==undefined)return {selection:result.result,idleExpired:result.state.idleExpired};
 }
}

/** Selection-only adapter for callers that do not enter a race. */
export async function runNativeMainMenu(host:NativeMainMenuHost){return (await runNativeMainMenuSelection(host)).selection;}
