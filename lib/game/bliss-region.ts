// Native PlayStunts DX port of Bliss 2.6.1 editor behaviour/data.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import {BLISS_TRACK_SIZE,blissCellIndex,type BlissTrack} from './bliss-track.ts';
import {blissTransformations,type BlissTransformations,type BlissTransformOperation} from './bliss-transformations.ts';

export interface BlissRegion {
 width:number;
 height:number;
 track:Uint8Array;
 terrain:Uint8Array;
}

const regionIndex=(region:BlissRegion,x:number,y:number)=>{
 if(x<0||y<0||x>=region.width||y>=region.height)throw Error(`Region coordinates out of range: ${x},${y}`);
 return y*region.width+x;
};
const validRect=(x:number,y:number,width:number,height:number)=>{
 if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||x<0||y<0||x+width>BLISS_TRACK_SIZE||y+height>BLISS_TRACK_SIZE)throw Error('Bliss selection lies outside the 30x30 track');
};

export function captureBlissRegion(source:BlissTrack,x:number,y:number,width:number,height:number):BlissRegion{
 validRect(x,y,width,height);
 const track=new Uint8Array(width*height),terrain=new Uint8Array(width*height);
 for(let ry=0;ry<height;ry++)for(let rx=0;rx<width;rx++){
  const sourceIndex=blissCellIndex(x+rx,y+ry),target=ry*width+rx;
  track[target]=source.track[sourceIndex];terrain[target]=source.terrain[sourceIndex];
 }
 return {width,height,track,terrain};
}

export function cloneBlissRegion(region:BlissRegion):BlissRegion{
 return {width:region.width,height:region.height,track:region.track.slice(),terrain:region.terrain.slice()};
}

/** Equivalent to Bliss PutTrack for the track/terrain layers. */
export function pasteBlissRegion(source:BlissTrack,x:number,y:number,region:BlissRegion,options:{track?:boolean;terrain?:boolean}={}){
 validRect(x,y,region.width,region.height);
 const affectTrack=options.track!==false,affectTerrain=options.terrain!==false;
 for(let ry=0;ry<region.height;ry++)for(let rx=0;rx<region.width;rx++){
  const target=blissCellIndex(x+rx,y+ry),from=regionIndex(region,rx,ry);
  if(affectTrack)source.track[target]=region.track[from];
  if(affectTerrain)source.terrain[target]=region.terrain[from];
 }
}

function codeTransform(code:number,operation:BlissTransformOperation,definitions:BlissTransformations,terrain=false){
 const def=(terrain?definitions.terrain:definitions.track)[code];
 if(!def)return 0;
 return def[operation];
}
function setTrack(region:BlissRegion,x:number,y:number,value:number){if(x>=0&&y>=0&&x<region.width&&y<region.height)region.track[y*region.width+x]=value;}
function trackAt(region:BlissRegion,x:number,y:number){return region.track[y*region.width+x];}

function fixHorizontalFillers(region:BlissRegion){
 for(let y=0;y<region.height;y++)for(let x=0;x<region.width-1;x++){
  const code=trackAt(region,x,y);
  if(code===255||code===253){const a=regionIndex(region,x,y),b=regionIndex(region,x+1,y),v=region.track[a];region.track[a]=region.track[b];region.track[b]=v;x++;}
 }
}
function fixVerticalFillers(region:BlissRegion){
 for(let x=0;x<region.width;x++)for(let y=0;y<region.height-1;y++){
  const code=trackAt(region,x,y);
  if(code===254||code===253){const a=regionIndex(region,x,y),b=regionIndex(region,x,y+1),v=region.track[a];region.track[a]=region.track[b];region.track[b]=v;y++;}
 }
}

export function hflipBlissRegion(source:BlissRegion,definitions:BlissTransformations=blissTransformations):BlissRegion{
 const result:BlissRegion={width:source.width,height:source.height,track:new Uint8Array(source.track.length),terrain:new Uint8Array(source.terrain.length)};
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const from=regionIndex(source,x,y),to=regionIndex(result,source.width-1-x,y);
  result.track[to]=codeTransform(source.track[from],'hflip',definitions);
  result.terrain[to]=codeTransform(source.terrain[from],'hflip',definitions,true);
 }
 fixHorizontalFillers(result);return result;
}

export function vflipBlissRegion(source:BlissRegion,definitions:BlissTransformations=blissTransformations):BlissRegion{
 const result:BlissRegion={width:source.width,height:source.height,track:new Uint8Array(source.track.length),terrain:new Uint8Array(source.terrain.length)};
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const from=regionIndex(source,x,y),to=regionIndex(result,x,source.height-1-y);
  result.track[to]=codeTransform(source.track[from],'vflip',definitions);
  result.terrain[to]=codeTransform(source.terrain[from],'vflip',definitions,true);
 }
 fixVerticalFillers(result);return result;
}

/** Port of Bliss CRotate: clockwise 90 degrees. */
export function rotateBlissRegionClockwise(source:BlissRegion,definitions:BlissTransformations=blissTransformations):BlissRegion{
 const result:BlissRegion={width:source.height,height:source.width,track:new Uint8Array(source.track.length),terrain:new Uint8Array(source.terrain.length)};
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const from=regionIndex(source,x,y),tx=source.height-1-y,ty=x,to=regionIndex(result,tx,ty);
  result.track[to]=codeTransform(source.track[from],'clockwise',definitions);
  result.terrain[to]=codeTransform(source.terrain[from],'clockwise',definitions,true);
 }
 // Bliss rebuilds continuation cells after rotation because 253/254/255
 // intentionally rotate to zero in xlation.dat.
 for(let y=0;y<result.height;y++)for(let x=0;x<result.width;x++){
  const code=trackAt(result,x,y),shape=definitions.track[code];
  if(shape.width===2&&shape.height===2){
   if(x>0){setTrack(result,x-1,y,code);if(y+1<result.height)setTrack(result,x-1,y+1,254);}
   if(y+1<result.height)setTrack(result,x,y+1,253);
   setTrack(result,x,y,255);
  }else if(shape.width===2){
   if(x>0)setTrack(result,x-1,y,code);
   setTrack(result,x,y,255);
  }else if(shape.height===2){
   if(y+1<result.height)setTrack(result,x,y+1,254);
  }
 }
 return result;
}

/** Port of Bliss CCRotate: counter-clockwise 90 degrees. */
export function rotateBlissRegionCounterClockwise(source:BlissRegion,definitions:BlissTransformations=blissTransformations):BlissRegion{
 const result:BlissRegion={width:source.height,height:source.width,track:new Uint8Array(source.track.length),terrain:new Uint8Array(source.terrain.length)};
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const from=regionIndex(source,x,y),tx=y,ty=source.width-1-x,to=regionIndex(result,tx,ty);
  result.track[to]=codeTransform(source.track[from],'counterClockwise',definitions);
  result.terrain[to]=codeTransform(source.terrain[from],'counterClockwise',definitions,true);
 }
 for(let y=0;y<result.height;y++)for(let x=0;x<result.width;x++){
  const code=trackAt(result,x,y),shape=definitions.track[code];
  if(shape.width===2&&shape.height===2){
   if(y>0){setTrack(result,x,y-1,code);if(x+1<result.width)setTrack(result,x+1,y-1,255);}
   if(x+1<result.width)setTrack(result,x+1,y,253);
   setTrack(result,x,y,254);
  }else if(shape.width===2){
   if(x+1<result.width)setTrack(result,x+1,y,255);
  }else if(shape.height===2){
   if(y>0)setTrack(result,x,y-1,code);
   setTrack(result,x,y,254);
  }
 }
 return result;
}

export function cutBlissRegion(source:BlissTrack,x:number,y:number,width:number,height:number,options:{track?:boolean;terrain?:boolean}={}){
 const result=captureBlissRegion(source,x,y,width,height);
 const affectTrack=options.track!==false,affectTerrain=options.terrain!==false;
 for(let ry=0;ry<height;ry++)for(let rx=0;rx<width;rx++){
  const index=blissCellIndex(x+rx,y+ry);
  if(affectTrack)source.track[index]=0;
  if(affectTerrain)source.terrain[index]=0;
 }
 return result;
}
