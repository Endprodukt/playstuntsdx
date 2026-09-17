import {createBrowserNativeMenus as createCoreBrowserNativeMenus} from './browser-native-menus-core.ts';
import {createEnhancedCockpitOverlay} from './enhanced-cockpit-overlay.ts';

export type {BrowserGraphicsSwitch,BrowserNativeMenuOptions} from './browser-native-menus-core.ts';

/** Keep the original menu/race implementation intact, but layer editable hires
 * cockpit artwork over the normal 2D race as well. Previously the cockpit
 * overlay only lived inside the optional upgraded 3D renderer, which made the
 * High-Res Textures switch ineffective unless Graphics Update was also on. */
export async function createBrowserNativeMenus(...args:Parameters<typeof createCoreBrowserNativeMenus>):Promise<Awaited<ReturnType<typeof createCoreBrowserNativeMenus>>>{
 const options=args[0];
 const menus=await createCoreBrowserNativeMenus(...args);
 const coreAllocated=menus.allocatedRacePresentation.bind(menus);

 menus.allocatedRacePresentation=(async(...presentationArgs:Parameters<typeof coreAllocated>)=>{
  const [runtime,,alternate]=presentationArgs;
  const presentation=await coreAllocated(...presentationArgs);
  const cockpit=createEnhancedCockpitOverlay();
  const corePresentWorld=presentation.presentWorld.bind(presentation);
  const coreControl=presentation.control.bind(presentation);
  const coreClose=presentation.close.bind(presentation);
  const graphics=options.graphics;
  const originalNotice=graphics?.notice;
  const wrappedNotice=graphics?(message:string)=>{
   if(message.startsWith('Loading upgraded driving graphics'))holdEnhancedFrame=true;
   else if(message.startsWith('Upgraded driving graphics')||message.startsWith('Upgraded graphics are unavailable'))holdEnhancedFrame=false;
   originalNotice?.(message);
  }:undefined;
  let holdEnhancedFrame=!!graphics?.enabled;

  if(graphics&&wrappedNotice)graphics.notice=wrappedNotice;

  const held=document.createElement('canvas');
  held.width=options.canvas.width;held.height=options.canvas.height;
  const heldContext=held.getContext('2d');
  const retainCurrentFrame=()=>{
   if(!graphics?.enabled||!holdEnhancedFrame||!heldContext)return false;
   if(held.width!==options.canvas.width||held.height!==options.canvas.height){held.width=options.canvas.width;held.height=options.canvas.height;}
   heldContext.setTransform(1,0,0,1,0,0);heldContext.drawImage(options.canvas,0,0);return true;
  };
  const restoreHeldFrame=(retained:boolean)=>{
   if(!retained||!holdEnhancedFrame)return;
   const context=options.canvas.getContext('2d');if(!context)return;
   context.setTransform(1,0,0,1,0,0);context.drawImage(held,0,0,options.canvas.width,options.canvas.height);
  };

  const presentWorld=()=>{
   const retained=retainCurrentFrame();
   corePresentWorld();
   restoreHeldFrame(retained);
   // The core async upgraded-scene loader invokes graphics.refresh when ready.
   // Keep that callback on this wrapper so the old frame is held until the
   // first enhanced frame has actually replaced it.
   if(graphics)graphics.refresh=presentWorld;

   // Alternate CGA/Tandy/Hercules presentations use different frame layouts.
   // The upgraded 3D renderer already owns its cockpit overlay when enabled.
   if(alternate||graphics?.enabled)return;

   const live=runtime.session.state.memory,d=0x2d1a0;
   if(live[d+0x12f]!==0)return;

   const carIndex=live[d+0xa9f0]&&live[d+0x8fc8]?1:0;
   const carAt=carIndex?0x8fc9:0x8fc2;
   const car=String.fromCharCode(...live.subarray(d+carAt,d+carAt+4));
   const state=carIndex?runtime.session.state.opponent.car:runtime.session.state.player.driving.car;
   const context=options.canvas.getContext('2d');
   if(!context)return;

   cockpit.draw(context,options.canvas.width,options.canvas.height,{
    car,
    pixels:runtime.pixels,
    steering:state.grip.steeringAngle,
    knobX:state.engine.knobX,
    knobY:state.engine.knobY,
   });
  };

  presentation.control=((...controlArgs:Parameters<typeof coreControl>)=>{
   const retained=retainCurrentFrame();
   const result=coreControl(...controlArgs);
   restoreHeldFrame(retained);
   return result;
  }) as typeof presentation.control;
  presentation.present=presentWorld;
  presentation.presentWorld=presentWorld;
  presentation.close=()=>{
   cockpit.close();
   if(graphics&&graphics.notice===wrappedNotice)graphics.notice=originalNotice;
   coreClose();
  };
  if(graphics)graphics.refresh=presentWorld;
  return presentation;
 }) as typeof menus.allocatedRacePresentation;

 return menus;
}
