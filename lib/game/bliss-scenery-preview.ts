import {installOriginalMenuPanorama} from './menu-panorama.ts';
import {renderOriginalHorizonBackground} from './render-horizon-background.ts';

export interface BlissOriginalSceneryPreview {
 width:number;
 height:number;
 rgba:Uint8ClampedArray;
}

/** Build the small background selector preview from the original Stunts
 * panorama bank. No enhanced/high-resolution artwork is involved. */
export function blissOriginalSceneryPreview(
 baseline:Uint8Array,
 landscape:number,
 resources:Record<string,ReadonlyArray<number>>,
 palette:ReadonlyArray<number>,
):BlissOriginalSceneryPreview{
 const memory=baseline.slice(),d=0x2d1a0,target=new Uint8Array(320*120);
 installOriginalMenuPanorama(memory,d,landscape,resources);
 const view=new DataView(memory.buffer,memory.byteOffset,memory.byteLength);
 const imageAt=(offset:number,segment:number)=>{
  const at=segment*16+offset,width=view.getUint16(at,true),height=view.getUint16(at+2,true);
  return {width,height,pixels:memory.subarray(at+16,at+16+width*height)};
 };
 // Bliss only needs a recognisable low-res landscape strip. Use the original
 // panorama renderer at its native 320px horizontal resolution and crop to a
 // compact 120px-high selector image.
 const full=new Uint8Array(320*200);
 renderOriginalHorizonBackground(full,memory,d,[0,320,0,200],0,108,imageAt,320);
 target.set(full.subarray(40*320,160*320));
 const rgba=new Uint8ClampedArray(target.length*4);
 for(let i=0;i<target.length;i++){
  const p=target[i]*3;rgba[i*4]=palette[p]??0;rgba[i*4+1]=palette[p+1]??0;rgba[i*4+2]=palette[p+2]??0;rgba[i*4+3]=255;
 }
 return {width:320,height:120,rgba};
}
