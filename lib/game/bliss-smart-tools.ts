// Bliss 2.6.1 context-aware track tools.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {blissElementData,type BlissElementData} from './bliss-element-data.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';
import {blissParentElement,placeBlissTrackElement} from './bliss-edit.ts';

const parentCode=(source:BlissTrack,x:number,y:number,definitions:BlissTransformations)=>blissParentElement(source,x,y,definitions).code;

/** Port of Bliss LinkTiles. Returns the inserted code, or null if no link fits. */
export function linkBlissTiles(source:BlissTrack,x:number,y:number,definitions:BlissTransformations=blissTransformations,elements:readonly BlissElementData[]=blissElementData){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=30||y<0||y>=30)throw Error(`Track coordinates out of range: ${x},${y}`);
 const connector=[0,0,0,0];let connectors=0;
 if(y>0){connector[0]=elements[parentCode(source,x,y-1,definitions)].ctype[2];if(connector[0])connectors++;}
 if(x<29){connector[1]=elements[parentCode(source,x+1,y,definitions)].ctype[3];if(connector[1])connectors++;}
 if(y<29){connector[2]=elements[parentCode(source,x,y+1,definitions)].ctype[0];if(connector[2])connectors++;}
 if(x>0){connector[3]=elements[parentCode(source,x-1,y,definitions)].ctype[1];if(connector[3])connectors++;}
 if(connectors<2)return null;
 const current=parentCode(source,x,y,definitions);
 for(let i=current+1;i<=current+256;i++){
  const code=i&255,shape=definitions.track[code],candidate=elements[code];
  if(shape.width!==1||shape.height!==1)continue;
  if(candidate.ctype[0]===connector[0]&&candidate.ctype[1]===connector[1]&&candidate.ctype[2]===connector[2]&&candidate.ctype[3]===connector[3]){
   placeBlissTrackElement(source,x,y,code,definitions);return code;
  }
 }
 return null;
}
