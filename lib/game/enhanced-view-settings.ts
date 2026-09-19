export const ENHANCED_FOV_KEY='playstunts-dx-enhanced-fov-width';
export const ENHANCED_FOV_EVENT='playstunts-dx-enhanced-fov-changed';

function desktopDx(){
 return typeof window!=='undefined'&&typeof document!=='undefined'&&!!document.querySelector('.desktop-game-shell');
}

export function enhancedFovWidth(){
 if(!desktopDx())return 0;
 const saved=Number(window.localStorage.getItem(ENHANCED_FOV_KEY)??'0');
 return Number.isFinite(saved)?Math.max(0,Math.min(100,saved)):0;
}

export function setEnhancedFovWidth(value:number){
 if(!desktopDx())return;
 const next=Math.max(0,Math.min(100,Math.round(value)));
 window.localStorage.setItem(ENHANCED_FOV_KEY,String(next));
 window.dispatchEvent(new Event(ENHANCED_FOV_EVENT));
}

/** Visual target aspect for the enhanced race renderer. The original DOS
 * presentation is corrected to 4:3 on desktop; the slider interpolates from
 * that baseline to the current window aspect without altering vertical FOV. */
export function enhancedRaceAspect(){
 const base=4/3,screen=typeof window==='undefined'||!window.innerHeight?base:window.innerWidth/window.innerHeight;
 const target=Math.max(base,screen),amount=enhancedFovWidth()/100;
 return base+(target-base)*amount;
}
