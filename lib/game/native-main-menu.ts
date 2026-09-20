import {createOriginalMainMenu,type MainMenuPresentation} from './main-menu-runtime.ts';
import type {NativeMenuInput} from './native-dialog-runtime.ts';
import {confirmBrowserOpeningExit} from './browser-opening-exit.ts';
import {originalOpeningExitDecision} from './opening-exit-flow.ts';
export interface NativeMainMenuHost extends MainMenuPresentation {
 counter():number;
 input():Promise<NativeMenuInput&{keyboardKey?:number}>;
 release?():Promise<void>;
}

type TauriCore={invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>};
const desktopCanvas=()=>typeof document==='undefined'?null:document.querySelector<HTMLCanvasElement>('.desktop-game-shell canvas[aria-label="Native Stunts opening, menus, races and track editor"]');
async function confirmDesktopExit(){
 const canvas=desktopCanvas();
 if(!canvas)return false;
 const answer=await confirmBrowserOpeningExit(canvas,new AbortController().signal);
 if(originalOpeningExitDecision(27,answer)!=='exit')return true;
 const core=(window as typeof window&{__TAURI__?:{core?:TauriCore}}).__TAURI__?.core;
 if(core)await core.invoke<void>('exit_game');else window.close();
 return true;
}

/** Present and flash before waiting for input, matching 3795..3820. */
export async function runNativeMainMenuSelection(host:NativeMainMenuHost){
 const menu=createOriginalMainMenu(host);let time=host.counter();
 for(;;){
  const now=host.counter(),delta=(now-time)&65535;time=now;
  menu.frame(delta);
  const input=await host.input();
  if(input.key===27&&await confirmDesktopExit()){
   // The confirmation dialog uses its own input adapter on the same canvas.
   // Drain the opening menu adapter too, otherwise the click on "No" survives
   // the dialog and can immediately activate the menu item underneath it.
   await host.release?.();
   time=host.counter();
   continue;
  }
  // Wheel analogue axes are deliberately ignored in menus. Digital hat/button
  // navigation is already supplied by the shared menu input adapter.
  const result=menu.accept({delta,key:input.key,x:input.x,y:input.y,mouseEnabled:input.mouseActive});
  if(result.result!==undefined)return {selection:result.result,idleExpired:result.state.idleExpired};
 }
}

/** Selection-only adapter for callers that do not enter a race. */
export async function runNativeMainMenu(host:NativeMainMenuHost){return (await runNativeMainMenuSelection(host)).selection;}
