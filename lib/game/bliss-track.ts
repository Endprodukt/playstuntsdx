// Native PlayStunts DX port of Bliss 2.6.1 editor behaviour/data.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import {decodeTrackFile,encodeTrackFile} from './track-file.ts';

export const BLISS_TRACK_SIZE=30;
export const BLISS_TRACK_CELLS=BLISS_TRACK_SIZE*BLISS_TRACK_SIZE;
export const BLISS_DEFAULT_LANDSCAPE=4;
export const BLISS_DEFAULT_FORMAT=152;

/** Canonical editor coordinates: x/y are zero based, with y=0 at the top. */
export interface BlissTrack {
 track:Uint8Array;
 terrain:Uint8Array;
 landscape:number;
 format:number;
 /** Opaque bytes after the 1802-byte Stunts payload (Bliss combined metadata). */
 overlay:Uint8Array;
}

function byte(value:number,name:string){
 if(!Number.isInteger(value)||value<0||value>255)throw Error(`${name} must be a byte`);
 return value;
}

export function blissCellIndex(x:number,y:number){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=BLISS_TRACK_SIZE||y<0||y>=BLISS_TRACK_SIZE)throw Error(`Track coordinates out of range: ${x},${y}`);
 return y*BLISS_TRACK_SIZE+x;
}

export function createBlissTrack(landscape=BLISS_DEFAULT_LANDSCAPE,format=BLISS_DEFAULT_FORMAT):BlissTrack{
 return {track:new Uint8Array(BLISS_TRACK_CELLS),terrain:new Uint8Array(BLISS_TRACK_CELLS),landscape:byte(landscape,'Landscape'),format:byte(format,'Format'),overlay:new Uint8Array()};
}

export function cloneBlissTrack(source:BlissTrack):BlissTrack{
 return {track:source.track.slice(),terrain:source.terrain.slice(),landscape:source.landscape,format:source.format,overlay:source.overlay.slice()};
}

/**
 * Convert the original 1802-byte Stunts format to Bliss' editor-oriented grid.
 * Stunts stores track rows bottom-to-top, while terrain rows are top-to-bottom.
 */
export function decodeBlissTrack(bytes:Uint8Array):BlissTrack{
 if(bytes.length<1802)throw Error('Track file must contain at least 1802 bytes');
 const source=decodeTrackFile(bytes.subarray(0,1802));
 const track=new Uint8Array(BLISS_TRACK_CELLS),terrain=new Uint8Array(BLISS_TRACK_CELLS);
 for(let y=0;y<BLISS_TRACK_SIZE;y++)for(let x=0;x<BLISS_TRACK_SIZE;x++){
  track[blissCellIndex(x,y)]=source.track[(BLISS_TRACK_SIZE-1-y)*BLISS_TRACK_SIZE+x];
  terrain[blissCellIndex(x,y)]=source.terrain[y*BLISS_TRACK_SIZE+x];
 }
 return {track,terrain,landscape:source.track[BLISS_TRACK_CELLS],format:source.terrain[BLISS_TRACK_CELLS],overlay:bytes.slice(1802)};
}

/** Convert the canonical Bliss grid back to the exact original Stunts layout. */
export function encodeBlissTrack(source:BlissTrack):Uint8Array{
 if(source.track.length!==BLISS_TRACK_CELLS||source.terrain.length!==BLISS_TRACK_CELLS)throw Error('Bliss track layers must contain exactly 900 cells');
 const track=Array<number>(BLISS_TRACK_CELLS+1),terrain=Array<number>(BLISS_TRACK_CELLS+1);
 for(let y=0;y<BLISS_TRACK_SIZE;y++)for(let x=0;x<BLISS_TRACK_SIZE;x++){
  track[(BLISS_TRACK_SIZE-1-y)*BLISS_TRACK_SIZE+x]=source.track[blissCellIndex(x,y)];
  terrain[y*BLISS_TRACK_SIZE+x]=source.terrain[blissCellIndex(x,y)];
 }
 track[BLISS_TRACK_CELLS]=byte(source.landscape,'Landscape');
 terrain[BLISS_TRACK_CELLS]=byte(source.format,'Format');
 const payload=encodeTrackFile({track,terrain});
 if(!source.overlay.length)return payload;
 const result=new Uint8Array(payload.length+source.overlay.length);result.set(payload);result.set(source.overlay,payload.length);return result;
}

/** Bliss' original 32-bit track hash, excluding the trailing format byte. */
export function blissTrackHash(source:BlissTrack){
 const bytes=encodeBlissTrack(source),payload=bytes.subarray(0,1801);
 let hash=0>>>0;
 for(let i=0;i<payload.length;i++){
  const value=payload[i];
  if(value){hash=(hash^(value+11))>>>0;hash=(hash^(121*(i+1)))>>>0;}
  else hash=(Math.imul(hash,31)+3)>>>0;
 }
 return hash>>>0;
}
