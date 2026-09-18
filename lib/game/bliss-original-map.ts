// Full 30x30 Bliss-style map using the original Stunts editor artwork.
// This deliberately reuses artwork extracted from the user's own game data;
// Bliss' biggfx.tga is not redistributed.
import type {BlissTrack} from './bliss-track.ts';
import {blissCellIndex} from './bliss-track.ts';
import {drawEditorClippedRaster} from './editor-clipped-raster.ts';

export const BLISS_ORIGINAL_MAP_TILE=16;
export const BLISS_ORIGINAL_MAP_SIZE=30*BLISS_ORIGINAL_MAP_TILE;

export interface BlissOriginalMapImage {width:number;height:number;pixels:ArrayLike<number>}
export interface BlissOriginalMapResources {
 art:readonly {small:string;large:string}[];
 terrainNames:readonly string[];
 images:Record<string,BlissOriginalMapImage>;
}

/** Render all 900 terrain cells first, then the original editor's AND/OR track artwork. */
export function renderBlissOriginalMap(source:BlissTrack,resources:BlissOriginalMapResources){
 const pixels=new Uint8Array(BLISS_ORIGINAL_MAP_SIZE*BLISS_ORIGINAL_MAP_SIZE);
 const clip={left:0,right:BLISS_ORIGINAL_MAP_SIZE,top:0,bottom:BLISS_ORIGINAL_MAP_SIZE};
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const terrain=source.terrain[blissCellIndex(x,y)],name=resources.terrainNames[terrain],image=name?resources.images[name]:undefined;
  if(image)drawEditorClippedRaster(pixels,BLISS_ORIGINAL_MAP_SIZE,image,x*16,y*16,'copy',clip);
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=source.track[blissCellIndex(x,y)];
  // Multi-cell continuation bytes are already represented by the parent's
  // 32px artwork and must not be drawn independently.
  if(code===0||code>=253)continue;
  const art=resources.art[code];if(!art)continue;
  const mask=resources.images[art.large],image=resources.images[art.small];
  if(mask)drawEditorClippedRaster(pixels,BLISS_ORIGINAL_MAP_SIZE,mask,x*16,y*16,'and',clip);
  if(image)drawEditorClippedRaster(pixels,BLISS_ORIGINAL_MAP_SIZE,image,x*16,y*16,'or',clip);
 }
 return pixels;
}

function indexedImageData(indexed:Uint8Array,width:number,height:number,palette:ReadonlyArray<number>){
 const rgba=new Uint8ClampedArray(indexed.length*4);
 for(let i=0;i<indexed.length;i++){
  const p=indexed[i]*3;rgba[i*4]=palette[p]??0;rgba[i*4+1]=palette[p+1]??0;rgba[i*4+2]=palette[p+2]??0;rgba[i*4+3]=255;
 }
 return new ImageData(rgba,width,height);
}

export function blissOriginalMapImageData(source:BlissTrack,resources:BlissOriginalMapResources,palette:ReadonlyArray<number>){
 return indexedImageData(renderBlissOriginalMap(source,resources),BLISS_ORIGINAL_MAP_SIZE,BLISS_ORIGINAL_MAP_SIZE,palette);
}

/** Palette thumbnail built from the same original Stunts artwork as the map. */
export function blissOriginalPaletteImageData(code:number,terrain:boolean,resources:BlissOriginalMapResources,palette:ReadonlyArray<number>){
 if(terrain){
  const pixels=new Uint8Array(16*16),name=resources.terrainNames[code],image=name?resources.images[name]:undefined;
  if(image)drawEditorClippedRaster(pixels,16,image,0,0,'copy',{left:0,right:16,top:0,bottom:16});
  return indexedImageData(pixels,16,16,palette);
 }
 const size=32,pixels=new Uint8Array(size*size),clip={left:0,right:size,top:0,bottom:size};
 const groundName=resources.terrainNames[0],ground=groundName?resources.images[groundName]:undefined;
 if(ground)for(let y=0;y<2;y++)for(let x=0;x<2;x++)drawEditorClippedRaster(pixels,size,ground,x*16,y*16,'copy',clip);
 if(code!==0&&code<253){
  const art=resources.art[code],mask=art?resources.images[art.large]:undefined,image=art?resources.images[art.small]:undefined;
  if(mask)drawEditorClippedRaster(pixels,size,mask,0,0,'and',clip);
  if(image)drawEditorClippedRaster(pixels,size,image,0,0,'or',clip);
 }
 return indexedImageData(pixels,size,size,palette);
}
