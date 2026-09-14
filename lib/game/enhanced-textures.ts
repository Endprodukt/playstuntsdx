export const ENHANCED_TEXTURES_KEY='playstunts-dx-enhanced-textures';
export const ENHANCED_TEXTURES_EVENT='playstunts-dx-enhanced-textures-changed';

/** Enhanced textures are opt-out in PlayStunts DX. Missing overrides always
 * fall back to the original extracted asset, so an empty hires folder is safe.
 */
export function enhancedTexturesEnabled(){
 if(typeof window==='undefined')return true;
 const saved=window.localStorage.getItem(ENHANCED_TEXTURES_KEY);
 return saved!=='off'&&saved!=='0'&&saved!=='false';
}

export function setEnhancedTexturesEnabled(enabled:boolean){
 if(typeof window==='undefined')return;
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
