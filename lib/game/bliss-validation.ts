// Native PlayStunts DX port of Bliss 2.6.1 compatibility/terrain checks.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import {BLISS_TRACK_SIZE,blissCellIndex,type BlissTrack} from './bliss-track.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';

export interface BlissIssue {code:number;x:number;y:number}
export interface BlissStart {x:number;y:number;bearing:number;origin:number;error?:60|61|62}

const cell=(source:BlissTrack,x:number,y:number)=>({track:source.track[blissCellIndex(x,y)],terrain:source.terrain[blissCellIndex(x,y)]});
const inSet=(value:number,allowed:readonly number[])=>allowed.includes(value);

/** Port of Bliss FindStart. Coordinates are zero based in the DX port. */
export function findBlissStart(source:BlissTrack):BlissStart{
 const starts=[1,0xb3,0xb4,0xb5,0x86,0x87,0x88,0x89,0x93,0x94,0x95,0x96];
 let found:{x:number;y:number;code:number}|undefined,count=0;
 for(let y=0;y<BLISS_TRACK_SIZE;y++)for(let x=0;x<BLISS_TRACK_SIZE;x++){
  const code=cell(source,x,y).track;if(starts.includes(code)){found={x,y,code};count++;}
 }
 if(!found)return {x:0,y:0,bearing:0,origin:0,error:60};
 if(count>1)return {x:found.x,y:found.y,bearing:0,origin:0,error:61};
 const bearing=inSet(found.code,[1,0x86,0x93])?0:inSet(found.code,[0xb5,0x89,0x96])?3:inSet(found.code,[0xb3,0x87,0x94])?2:1;
 const result:BlissStart={x:found.x,y:found.y,bearing,origin:bearing^2};
 if(cell(source,found.x,found.y).terrain>6)result.error=62;
 return result;
}

/** Port of Bliss DetectNotStunts. code retains Bliss' original 1..8 reason. */
export function detectBlissNonStunts(source:BlissTrack,definitions:BlissTransformations=blissTransformations):BlissIssue|null{
 for(let y=0;y<30;y++)for(let x=0;x<30;x++)if(cell(source,x,y).terrain>18)return {code:1,x,y};
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=cell(source,x,y).track;
  if(code>=0xb6&&code<=0xfc)return {code:2,x,y};
  if(code===2||code===3)return {code:3,x,y};
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=cell(source,x,y).track,shape=definitions.track[code];
  if(shape.width===2&&(x===29||cell(source,x+1,y).track!==255))return {code:4,x,y};
  if(shape.height===2){
   if(y===29||cell(source,x,y+1).track!==254)return {code:4,x,y};
   if(shape.width===2&&(x===29||cell(source,x+1,y+1).track!==253))return {code:4,x,y};
  }
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=cell(source,x,y).track;
  if(code===253&&(x===0||y===0||definitions.track[cell(source,x-1,y-1).track].height<2||definitions.track[cell(source,x-1,y-1).track].width<2))return {code:5,x,y};
  if(code===254&&(y===0||definitions.track[cell(source,x,y-1).track].height<2))return {code:5,x,y};
  if(code===255&&(x===0||definitions.track[cell(source,x-1,y).track].width<2))return {code:5,x,y};
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y);if(c.terrain>=11&&c.track!==0)return {code:6,x,y};}
 const mountainAllowed:Record<number,readonly number[]>={
  7:[0,4,14,0x18,0x3b,0x27,0x62],
  8:[0,5,15,0x19,0x38,0x24,0x5f],
  9:[0,4,14,0x18,0x3a,0x26,0x61],
  10:[0,5,15,0x19,0x39,0x25,0x60],
 };
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y),allowed=mountainAllowed[c.terrain];if(allowed&&!inSet(c.track,allowed))return {code:7,x,y};}
 const waterAllowed=[0,0x68,0x23,0x67,0x22,0x69,0x6a,0x6b,0x6c,0xab,0xae,0xac,0xad,0xfd,0xfe,0xff];
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y);if(c.terrain>=1&&c.terrain<=5&&!inSet(c.track,waterAllowed))return {code:8,x,y};}
 return null;
}

const TERRAIN_VERTICES:readonly (readonly [number,number,number,number])[]=[
 [0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],
 [1,1,1,1],[1,1,0,0],[1,0,1,0],[0,0,1,1],[0,1,0,1],
 [1,0,0,0],[0,0,1,0],[0,0,0,1],[0,1,0,0],
 [1,1,1,0],[1,0,1,1],[0,1,1,1],[1,1,0,1],
];

/** Port of Bliss DetectTerrainErrors. Error codes: 40, 41, 50 and 51. */
export function detectBlissTerrainError(source:BlissTrack):BlissIssue|null{
 for(let y=0;y<30;y++)for(let x=0;x<30;x++)if(cell(source,x,y).terrain>18)return {code:40,x,y};
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const here=TERRAIN_VERTICES[cell(source,x,y).terrain]??TERRAIN_VERTICES[0];
  if(x<29){
   const right=TERRAIN_VERTICES[cell(source,x+1,y).terrain]??TERRAIN_VERTICES[0];
   if(here[1]!==right[0]||here[3]!==right[2])return {code:41,x:x+1,y};
  }
  if(y<29){
   const below=TERRAIN_VERTICES[cell(source,x,y+1).terrain]??TERRAIN_VERTICES[0];
   if(here[2]!==below[0]||here[3]!==below[1])return {code:41,x,y:y+1};
  }
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y);if(c.terrain>=11&&c.track!==0)return {code:50,x,y};}
 const allowed:Record<number,readonly number[]>={
  7:[0,4,14,0x18,0x3b,0x27,0x62],
  8:[0,5,15,0x19,0x38,0x24,0x5f],
  9:[0,4,14,0x18,0x3a,0x26,0x61],
  10:[0,5,15,0x19,0x39,0x25,0x60],
 };
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y),legal=allowed[c.terrain];if(legal&&!inSet(c.track,legal))return {code:51,x,y};}
 return null;
}


/** Collect every Bliss compatibility warning instead of stopping at the first.
 * This is used by the WAR overlay; DetectNotStunts remains the fast first-error API. */
export function listBlissCompatibilityIssues(source:BlissTrack,definitions:BlissTransformations=blissTransformations):BlissIssue[]{
 const issues:BlissIssue[]=[];
 for(let y=0;y<30;y++)for(let x=0;x<30;x++)if(cell(source,x,y).terrain>18)issues.push({code:1,x,y});
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=cell(source,x,y).track;
  if(code>=0xb6&&code<=0xfc)issues.push({code:2,x,y});
  if(code===2||code===3)issues.push({code:3,x,y});
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=cell(source,x,y).track,shape=definitions.track[code];
  if(shape.width===2&&(x===29||cell(source,x+1,y).track!==255))issues.push({code:4,x,y});
  if(shape.height===2){
   if(y===29||cell(source,x,y+1).track!==254)issues.push({code:4,x,y});
   if(shape.width===2&&(x===29||y===29||cell(source,x+1,y+1).track!==253))issues.push({code:4,x,y});
  }
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const code=cell(source,x,y).track;
  if(code===253&&(x===0||y===0||definitions.track[cell(source,x-1,y-1).track].height<2||definitions.track[cell(source,x-1,y-1).track].width<2))issues.push({code:5,x,y});
  if(code===254&&(y===0||definitions.track[cell(source,x,y-1).track].height<2))issues.push({code:5,x,y});
  if(code===255&&(x===0||definitions.track[cell(source,x-1,y).track].width<2))issues.push({code:5,x,y});
 }
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y);if(c.terrain>=11&&c.track!==0)issues.push({code:6,x,y});}
 const mountainAllowed:Record<number,readonly number[]>={
  7:[0,4,14,0x18,0x3b,0x27,0x62],8:[0,5,15,0x19,0x38,0x24,0x5f],
  9:[0,4,14,0x18,0x3a,0x26,0x61],10:[0,5,15,0x19,0x39,0x25,0x60],
 };
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y),allowed=mountainAllowed[c.terrain];if(allowed&&!inSet(c.track,allowed))issues.push({code:7,x,y});}
 const waterAllowed=[0,0x68,0x23,0x67,0x22,0x69,0x6a,0x6b,0x6c,0xab,0xae,0xac,0xad,0xfd,0xfe,0xff];
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const c=cell(source,x,y);if(c.terrain>=1&&c.terrain<=5&&!inSet(c.track,waterAllowed))issues.push({code:8,x,y});}
 return issues;
}
