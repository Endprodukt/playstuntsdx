export const ENHANCED_TEXTURES_KEY='playstunts-dx-enhanced-textures';
export const ENHANCED_TEXTURES_EVENT='playstunts-dx-enhanced-textures-changed';

function isDesktopDx(){
 return typeof window!=='undefined'&&typeof document!=='undefined'&&!!document.querySelector('.desktop-game-shell');
}

/** Enhanced textures are opt-out in PlayStunts DX. Missing overrides always
 * fall back to the original extracted asset, so an empty hires folder is safe.
 * The public browser build keeps its existing original-asset behavior.
 */
export function enhancedTexturesEnabled(){
 if(!isDesktopDx())return false;
 const saved=window.localStorage.getItem(ENHANCED_TEXTURES_KEY);
 return saved!=='off'&&saved!=='0'&&saved!=='false';
}

export function setEnhancedTexturesEnabled(enabled:boolean){
 if(!isDesktopDx())return;
 window.localStorage.setItem(ENHANCED_TEXTURES_KEY,enabled?'on':'off');
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
