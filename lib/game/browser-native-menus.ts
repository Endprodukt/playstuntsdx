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
  const coreClose=presentation.close.bind(presentation);

  const presentWorld=()=>{
   corePresentWorld();

   // Alternate CGA/Tandy/Hercules presentations use different frame layouts.
   // The upgraded 3D renderer already owns its cockpit overlay when enabled.
   if(alternate||options.graphics?.enabled)return;

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

  presentation.present=presentWorld;
  presentation.presentWorld=presentWorld;
  presentation.close=()=>{cockpit.close();coreClose();};
  return presentation;
 }) as typeof menus.allocatedRacePresentation;

 return menus;
}
