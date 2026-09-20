export const ENHANCED_RENDER_SCALE_KEY='playstunts-dx-enhanced-render-scale';
export const ENHANCED_RENDER_SCALE_EVENT='playstunts-dx-enhanced-render-scale-changed';
export const ENHANCED_RENDER_SCALES=[1,2,4,6,8,10,12,14,16,18,20] as const;
export type EnhancedRenderScale=(typeof ENHANCED_RENDER_SCALES)[number];

const DEFAULT_ENHANCED_RENDER_SCALE:EnhancedRenderScale=4;

export function normalizeEnhancedRenderScale(value:number):EnhancedRenderScale{
 if(!Number.isFinite(value))return DEFAULT_ENHANCED_RENDER_SCALE;
 const rounded=Math.round(value);
 return (ENHANCED_RENDER_SCALES as readonly number[]).includes(rounded)
  ? rounded as EnhancedRenderScale
  : DEFAULT_ENHANCED_RENDER_SCALE;
}

export function enhancedRenderScale():EnhancedRenderScale{
 if(typeof window==='undefined')return DEFAULT_ENHANCED_RENDER_SCALE;
 const saved=Number(window.localStorage.getItem(ENHANCED_RENDER_SCALE_KEY)??DEFAULT_ENHANCED_RENDER_SCALE);
 return normalizeEnhancedRenderScale(saved);
}

export function setEnhancedRenderScale(value:number):EnhancedRenderScale{
 const next=normalizeEnhancedRenderScale(value);
 if(typeof window!=='undefined'){
  window.localStorage.setItem(ENHANCED_RENDER_SCALE_KEY,String(next));
  window.dispatchEvent(new Event(ENHANCED_RENDER_SCALE_EVENT));
 }
 return next;
}

export function enhancedRenderResolution(scale:EnhancedRenderScale=enhancedRenderScale()){
 return {width:320*scale,height:200*scale};
}
