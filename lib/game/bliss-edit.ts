// Native PlayStunts DX port of Bliss 2.6.1 editor behaviour/data.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import {BLISS_TRACK_SIZE,blissCellIndex,type BlissTrack} from './bliss-track.ts';
import type {BlissTransformations} from './bliss-transformations.ts';

export interface BlissEditOptions {allowErrors?:boolean}
const inside=(x:number,y:number)=>x>=0&&x<BLISS_TRACK_SIZE&&y>=0&&y<BLISS_TRACK_SIZE;
const codeAt=(source:BlissTrack,x:number,y:number)=>source.track[blissCellIndex(x,y)];
const setCode=(source:BlissTrack,x:number,y:number,value:number)=>{if(inside(x,y))source.track[blissCellIndex(x,y)]=value;};

/** Resolve Bliss continuation bytes 253/254/255 to their owning multi-cell element. */
export function blissParentElement(source:BlissTrack,x:number,y:number,definitions:BlissTransformations){
 const code=codeAt(source,x,y);
 if(code===255&&x>0){const parent=codeAt(source,x-1,y);if(definitions.track[parent].width===2)return {x:x-1,y,code:parent};}
 if(code===254&&y>0){const parent=codeAt(source,x,y-1);if(definitions.track[parent].height===2)return {x,y:y-1,code:parent};}
 if(code===253&&x>0&&y>0){const parent=codeAt(source,x-1,y-1),shape=definitions.track[parent];if(shape.width===2&&shape.height===2)return {x:x-1,y:y-1,code:parent};}
 return {x,y,code};
}

/** Port of Bliss ClearTrack without drawing side effects. */
export function clearBlissTrackElement(source:BlissTrack,x:number,y:number,definitions:BlissTransformations,options:BlissEditOptions={}){
 if(!inside(x,y))return false;
 const allowErrors=!!options.allowErrors;
 const parent=allowErrors?{x,y,code:codeAt(source,x,y)}:blissParentElement(source,x,y,definitions);
 const element=parent.code,shape=definitions.track[element];
 setCode(source,parent.x,parent.y,0);
 if(!allowErrors){
  if(shape.width>1){setCode(source,parent.x+1,parent.y,0);if(shape.height>1)setCode(source,parent.x+1,parent.y+1,0);}
  if(shape.height>1)setCode(source,parent.x,parent.y+1,0);
  if(codeAt(source,x,y)!==0)setCode(source,x,y,0);
 }
 return element!==0;
}

/** Port of Bliss SetTrack, including 2x1/1x2/2x2 continuation bytes. */
export function placeBlissTrackElement(source:BlissTrack,x:number,y:number,code:number,definitions:BlissTransformations,options:BlissEditOptions={}){
 if(!inside(x,y)||code<0||code>255)throw Error(`Invalid Bliss placement ${code} at ${x},${y}`);
 const allowErrors=!!options.allowErrors,shape=definitions.track[code];
 if(!shape)throw Error(`Unknown Bliss track element ${code}`);
 if(!allowErrors&&((x===BLISS_TRACK_SIZE-1&&shape.width>1)||(y===BLISS_TRACK_SIZE-1&&shape.height>1)))return false;
 if(!allowErrors){
  clearBlissTrackElement(source,x,y,definitions,options);
  if(shape.width>1){clearBlissTrackElement(source,x+1,y,definitions,options);if(shape.height>1)clearBlissTrackElement(source,x+1,y+1,definitions,options);}
  if(shape.height>1)clearBlissTrackElement(source,x,y+1,definitions,options);
 }
 setCode(source,x,y,code);
 if(shape.width>1){setCode(source,x+1,y,255);if(shape.height>1)setCode(source,x+1,y+1,253);}
 if(shape.height>1)setCode(source,x,y+1,254);
 return true;
}

/** Port of Bliss Flood. x/y address the terrain vertex between four cells (0..30). */
export function floodBlissTerrain(source:BlissTrack,x:number,y:number){
 const update=(cx:number,cy:number,fn:(value:number)=>number)=>{if(inside(cx,cy)){const i=blissCellIndex(cx,cy);source.terrain[i]=fn(source.terrain[i]);}};
 if(x<30&&y<30)update(x,y,v=>v===0?5:v>=2&&v<=4?1:v);
 if(x>0&&y>0)update(x-1,y-1,v=>v===0?3:[2,4,5].includes(v)?1:v);
 if(x>0&&y<30)update(x-1,y,v=>v===0?4:[2,3,5].includes(v)?1:v);
 if(x<30&&y>0)update(x,y-1,v=>v===0?2:v>=3&&v<=5?1:v);
}

/** Port of Bliss Dry. x/y address the terrain vertex between four cells (0..30). */
export function dryBlissTerrain(source:BlissTrack,x:number,y:number){
 const update=(cx:number,cy:number,fn:(value:number)=>number)=>{if(inside(cx,cy)){const i=blissCellIndex(cx,cy);source.terrain[i]=fn(source.terrain[i]);}};
 if(x<30&&y<30)update(x,y,v=>v===1?3:[2,4,5].includes(v)?0:v);
 if(x>0&&y>0)update(x-1,y-1,v=>v===1?5:v>=2&&v<=4?0:v);
 if(x>0&&y<30)update(x-1,y,v=>v===1?2:v>=3&&v<=5?0:v);
 if(x<30&&y>0)update(x,y-1,v=>v===1?4:[2,3,5].includes(v)?0:v);
}
