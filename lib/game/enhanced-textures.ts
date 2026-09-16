export const ENHANCED_TEXTURES_KEY='playstunts-dx-enhanced-textures';
export const ENHANCED_TEXTURES_EVENT='playstunts-dx-enhanced-textures-changed';

let upgradedRaceModule:Promise<unknown>|undefined;
const desktopTextureUrls=new Map<string,string>();

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
export function enhancedTexturesEnabled(){
 if(!isDesktopDx())return false;
 const saved=window.localStorage.getItem(ENHANCED_TEXTURES_KEY);
 const enabled=saved!=='off'&&saved!=='0'&&saved!=='false';
 // Warm the dynamically loaded driving presentation while the user is still
 // in the menu. When a race starts the current menu frame can remain on screen
 // until the upgraded renderer is ready instead of exposing a native frame.
 if(enabled)preloadUpgradedRaceModule();
 return enabled;
}

export function setEnhancedTexturesEnabled(enabled:boolean){
 if(!isDesktopDx())return;
 window.localStorage.setItem(ENHANCED_TEXTURES_KEY,enabled?'on':'off');
 if(enabled)preloadUpgradedRaceModule();
 window.dispatchEvent(new Event(ENHANCED_TEXTURES_EVENT));
}

/** Mirror /game/... beneath /game/hires/... while preserving the complete
 * relative path and filename. Example:
 * /game/cockpit/COUN/dashboard.png -> /game/hires/cockpit/COUN/dashboard.png
 */
export function enhancedTextureUrl(original:string){
 const prefix='/game/';
 return original.startsWith(prefix)?`/game/hires/${original.slice(prefix.length)}`:original;
}

/** Desktop runtime assets are served through the Tauri fetch bridge rather
 * than as normal web URLs. Convert a successfully fetched texture to a blob URL
 * so <img> elements can use High Res files from the portable Runtime folder.
 */
export async function loadEnhancedTexturePath(url:string){
 if(!isDesktopDx())return url;
 const cached=desktopTextureUrls.get(url);
 if(cached)return cached;
 const response=await fetch(url);
 if(!response.ok)throw Error(`High-resolution texture could not load: ${url}`);
 const objectUrl=URL.createObjectURL(await response.blob());
 desktopTextureUrls.set(url,objectUrl);
 return objectUrl;
}

export function loadEnhancedTextureUrl(original:string){
 return loadEnhancedTexturePath(enhancedTextureUrl(original));
}