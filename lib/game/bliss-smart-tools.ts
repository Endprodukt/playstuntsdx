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


export interface BlissClosedCircuitSelection {x1:number;y1:number;x2:number;y2:number}

/** Port of Bliss BuildClosedCircuit. Returns false when the selected brush cannot generate a circuit. */
export function buildBlissClosedCircuit(source:BlissTrack,selection:BlissClosedCircuitSelection,currentBrush:number,definitions:BlissTransformations=blissTransformations,elements:readonly BlissElementData[]=blissElementData){
 let {x1,y1,x2,y2}=selection;if(x1>x2)[x1,x2]=[x2,x1];if(y1>y2)[y1,y2]=[y2,y1];
 if([x1,y1,x2,y2].some(v=>!Number.isInteger(v)||v<0||v>=30))throw Error('Bliss circuit selection lies outside the 30x30 track');
 const brush=elements[currentBrush];if(!brush)return false;
 let corner=0,straight=0;
 if(brush.material>=1&&brush.material<=3){
  const material=brush.material,tile=source.track[y1*30+x1],tileData=elements[tile],tileShape=definitions.track[tile];
  const nw=(d:BlissElementData)=>d.ctype[0]===0&&d.ctype[1]!==0&&d.ctype[2]!==0&&d.ctype[3]===0;
  if(x2-x1>1&&y2-y1>1&&nw(tileData)){
   for(let code=1;code<=190;code++)if(definitions.track[code].height===3-tileShape.height&&nw(elements[code])&&elements[code].material===material){corner=code;break;}
  }
  if(!corner)for(let code=1;code<=190;code++)if(definitions.track[code].height===1&&nw(elements[code])&&elements[code].material===material){corner=code;break;}
  for(let code=1;code<=190;code++)if(elements[code].entity===115&&elements[code].material===material&&elements[code].ctype[0]!==0){straight=code;break;}
 }else if(brush.entity===101){
  straight=currentBrush;if(elements[straight].ctype[0]===0)straight=definitions.track[straight].clockwise;corner=0x69;
 }else if(brush.entity===97){
  straight=0x30;corner=0x34;
 }else if(brush.entity===81){
  if(brush.ctype[0]===2||brush.ctype[1]===2||brush.ctype[2]===2){straight=0x67;corner=0x69;}else{straight=0x30;corner=0x34;}
 }else if(brush.entity===98){
  straight=0x6d;corner=0;
 }else if(currentBrush>=0x97&&currentBrush<=0xb2){
  for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)placeBlissTrackElement(source,x,y,currentBrush,definitions);
  return true;
 }else return false;
 if(!straight)return false;
 if(x1===x2){for(let y=y1;y<=y2;y++)placeBlissTrackElement(source,x1,y,straight,definitions);return true;}
 if(y1===y2){straight=definitions.track[straight].clockwise;for(let x=x1;x<=x2;x++)placeBlissTrackElement(source,x,y1,straight,definitions);return true;}
 if(!corner&&brush.entity!==98)return false;
 placeBlissTrackElement(source,x1,y1,corner,definitions);corner=definitions.track[corner].clockwise;
 placeBlissTrackElement(source,x2-definitions.track[corner].width+1,y1,corner,definitions);corner=definitions.track[corner].clockwise;
 placeBlissTrackElement(source,x2-definitions.track[corner].width+1,y2-definitions.track[corner].height+1,corner,definitions);corner=definitions.track[corner].clockwise;
 placeBlissTrackElement(source,x1,y2-definitions.track[corner].height+1,corner,definitions);
 const marginW=definitions.track[corner].width,marginH=definitions.track[corner].height;
 for(let y=y1+marginH;y<=y2-marginH;y++)placeBlissTrackElement(source,x1,y,straight,definitions);
 straight=definitions.track[straight].clockwise;
 for(let x=x1+marginW;x<=x2-marginW;x++)placeBlissTrackElement(source,x,y1,straight,definitions);
 straight=definitions.track[straight].clockwise;
 for(let y=y1+marginH;y<=y2-marginH;y++)placeBlissTrackElement(source,x2,y,straight,definitions);
 straight=definitions.track[straight].clockwise;
 for(let x=x1+marginW;x<=x2-marginW;x++)placeBlissTrackElement(source,x,y2,straight,definitions);
 return true;
}
