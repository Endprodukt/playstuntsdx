export type EnhancedChaseCameraPresetLevel=1|2|3;
export type EnhancedChaseCameraSetting='distance'|'height';

export const ENHANCED_CHASE_CAMERA_DEFAULTS={
 1:{distance:132,height:27},
 2:{distance:223,height:79},
 3:{distance:440,height:150},
} as const;

const keys={
 1:{distance:'playstunts-dx-chase-close-distance',height:'playstunts-dx-chase-close-height'},
 2:{distance:'playstunts-dx-chase-standard-distance',height:'playstunts-dx-chase-standard-height'},
 3:{distance:'playstunts-dx-chase-far-distance',height:'playstunts-dx-chase-far-height'},
} as const;

const limits={distance:[80,1000] as const,height:[20,500] as const};

function clampedNumber(value:string|null,fallback:number,kind:EnhancedChaseCameraSetting){
 const parsed=value===null?NaN:Number(value),[minimum,maximum]=limits[kind];
 return Number.isFinite(parsed)?Math.max(minimum,Math.min(maximum,parsed)):fallback;
}

export function enhancedChaseCameraPosition(level:EnhancedChaseCameraPresetLevel){
 const fallback=ENHANCED_CHASE_CAMERA_DEFAULTS[level];
 if(typeof window==='undefined')return {...fallback};
 return {
  distance:clampedNumber(window.localStorage.getItem(keys[level].distance),fallback.distance,'distance'),
  height:clampedNumber(window.localStorage.getItem(keys[level].height),fallback.height,'height'),
 };
}

export function setEnhancedChaseCameraPosition(level:EnhancedChaseCameraPresetLevel,kind:EnhancedChaseCameraSetting,value:number){
 if(typeof window==='undefined')return;
 const [minimum,maximum]=limits[kind],next=Math.max(minimum,Math.min(maximum,Math.round(value)));
 window.localStorage.setItem(keys[level][kind],String(next));
}

export function resetEnhancedChaseCameraPositions(){
 if(typeof window==='undefined')return;
 for(const level of [1,2,3] as const){
  window.localStorage.setItem(keys[level].distance,String(ENHANCED_CHASE_CAMERA_DEFAULTS[level].distance));
  window.localStorage.setItem(keys[level].height,String(ENHANCED_CHASE_CAMERA_DEFAULTS[level].height));
 }
}
