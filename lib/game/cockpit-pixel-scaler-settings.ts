export type CockpitPixelScalerMode='off'|'xbrz4x'|'hqx4x';

export const COCKPIT_PIXEL_SCALER_KEY='playstunts-dx-cockpit-pixel-scaler';
export const COCKPIT_PIXEL_SCALER_EVENT='playstunts-dx-cockpit-pixel-scaler-changed';

export const COCKPIT_PIXEL_SCALER_OPTIONS:ReadonlyArray<{value:CockpitPixelScalerMode;label:string}>=[
 {value:'off',label:'Off'},
 {value:'xbrz4x',label:'xBRZ 4x'},
 {value:'hqx4x',label:'HQx 4x'},
];

export function cockpitPixelScalerMode():CockpitPixelScalerMode{
 if(typeof window==='undefined')return'off';
 const saved=window.localStorage.getItem(COCKPIT_PIXEL_SCALER_KEY);
 return saved==='xbrz4x'||saved==='hqx4x'?saved:'off';
}

export function setCockpitPixelScalerMode(mode:CockpitPixelScalerMode){
 if(typeof window==='undefined')return;
 window.localStorage.setItem(COCKPIT_PIXEL_SCALER_KEY,mode);
 window.dispatchEvent(new CustomEvent(COCKPIT_PIXEL_SCALER_EVENT,{detail:mode}));
}
