export const ENHANCED_TEXTURES_KEY='playstunts-dx-enhanced-textures';
export const ENHANCED_BACKGROUND_KEY='playstunts-dx-enhanced-background';
export const ENHANCED_COCKPIT_KEY='playstunts-dx-enhanced-cockpit';
export const ENHANCED_TEXTURES_EVENT='playstunts-dx-enhanced-textures-changed';

let upgradedRaceModule:Promise<unknown>|undefined;
const desktopTextureUrls=new Map<string,string>();

declare global {
 interface Window {
  __PLAYSTUNTS_DX_HIRES_URL__?:(relative:string)=>string;
 }
}

function isDesktopDx(){
 return typeof window!=='undefined'&&typeof document!=='undefined'&&!!document.querySelector('.desktop-game-shell');
}

function preloadUpgradedRaceModule(){
 upgradedRaceModule??=import('./upgraded-race-scene').catch(()=>undefined);
}

/** Enhanced textures are opt-out in PlayStunts DX. Missing overrides always
 * fall back to the original extracted asset, so an empty hires folder is safe.
 * The public browser build keeps its existing original-asset behavior.
 */
function storedTextureFlag(key:string){
 const explicit=window.localStorage.getItem(key);
 const saved=explicit??window.localStorage.getItem(ENHANCED_TEXTURES_KEY);
 return saved!=='off'&&saved!=='0'&&saved!=='false';
}

export function enhancedBackgroundEnabled(){
 if(!isDesktopDx())return false;
 const enabled=storedTextureFlag(ENHANCED_BACKGROUND_KEY);
 if(enabled)preloadUpgradedRaceModule();
 return enabled;
}

export function enhancedCockpitEnabled(){
 if(!isDesktopDx())return false;
 const enabled=storedTextureFlag(ENHANCED_COCKPIT_KEY);
 if(enabled)preloadUpgradedRaceModule();
 return enabled;
}

/** Legacy aggregate retained for callers outside the split settings UI. */
export function enhancedTexturesEnabled(){
 return enhancedBackgroundEnabled()||enhancedCockpitEnabled();
}

function setTextureFlag(key:string,enabled:boolean){
 if(!isDesktopDx())return;
 window.localStorage.setItem(key,enabled?'on':'off');
 if(enabled)preloadUpgradedRaceModule();
 window.dispatchEvent(new Event(ENHANCED_TEXTURES_EVENT));
}

export function setEnhancedBackgroundEnabled(enabled:boolean){setTextureFlag(ENHANCED_BACKGROUND_KEY,enabled);}
export function setEnhancedCockpitEnabled(enabled:boolean){setTextureFlag(ENHANCED_COCKPIT_KEY,enabled);}

/** Legacy setter keeps both split controls in sync for older callers. */
export function setEnhancedTexturesEnabled(enabled:boolean){
 if(!isDesktopDx())return;
 window.localStorage.setItem(ENHANCED_TEXTURES_KEY,enabled?'on':'off');
 window.localStorage.setItem(ENHANCED_BACKGROUND_KEY,enabled?'on':'off');
 window.localStorage.setItem(ENHANCED_COCKPIT_KEY,enabled?'on':'off');
 if(enabled)preloadUpgradedRaceModule();
 window.dispatchEvent(new Event(ENHANCED_TEXTURES_EVENT));
}

/** Return a file URL for an editable texture beside the executable. */
export function hiresTextureUrl(relative:string){
 const clean=relative.replace(/^[\\/]+/,'').split(/[\\/]+/).filter(part=>part&&part!=='.'&&part!=='..').join('/');
 if(typeof window!=='undefined'){
  const external=window.__PLAYSTUNTS_DX_HIRES_URL__?.(clean);
  if(external)return external;
 }
 return `/game/hires/${clean}`;
}

/** Mirror /game/... beneath /game/hires/... while preserving the complete
 * relative path and filename. Example:
 * /game/cockpit/COUN/dashboard.png -> /game/hires/cockpit/COUN/dashboard.png
 */
export function enhancedTextureUrl(original:string){
 const prefix='/game/';
 return original.startsWith(prefix)?`/game/hires/${original.slice(prefix.length)}`:original;
}

/** Resolve a /game/... texture straight to the external hires directory.
 * This avoids depending on a global HTMLImageElement.src interception.
 */
export function enhancedTextureImageUrl(original:string){
 const enhanced=enhancedTextureUrl(original),prefix='/game/hires/';
 return enhanced.startsWith(prefix)?hiresTextureUrl(enhanced.slice(prefix.length)):enhanced;
}

/** Desktop runtime assets are served from the editable hires directory beside
 * the executable. Resolve /game/hires/... through Tauri before fetching it so
 * cockpit images do not depend on the HTML fetch interception path.
 */
export async function loadEnhancedTexturePath(url:string){
 if(!isDesktopDx())return url;
 const cached=desktopTextureUrls.get(url);
 if(cached)return cached;
 const prefix='/game/hires/';
 const resolved=url.startsWith(prefix)?hiresTextureUrl(url.slice(prefix.length)):url;
 const response=await fetch(resolved);
 if(!response.ok)throw Error(`High-resolution texture could not load: ${url}`);
 const objectUrl=URL.createObjectURL(await response.blob());
 desktopTextureUrls.set(url,objectUrl);
 return objectUrl;
}

export function loadEnhancedTextureUrl(original:string){
 return loadEnhancedTexturePath(enhancedTextureUrl(original));
}
