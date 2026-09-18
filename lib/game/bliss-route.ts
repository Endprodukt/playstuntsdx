// Native PlayStunts DX port of Bliss 2.6.1 track-flow analysis.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {blissCellIndex} from './bliss-track.ts';
import {blissElementData,type BlissElementData} from './bliss-element-data.ts';
import {blissParentElement} from './bliss-edit.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';
import {detectBlissTerrainError,findBlissStart} from './bliss-validation.ts';

export interface BlissPoint {x:number;y:number}
export interface BlissTrackVector extends BlissPoint {bearing:number;origin:number;error:number}
export interface BlissTrackError extends BlissPoint {error:number;section:number}
export interface BlissSection {
 initial:BlissPoint;final:BlissPoint|null;
 solving:boolean;origin:number;bearing:number;
 parent:[number,number];child:[number,number];
 length:number;finishes:boolean;cycle:boolean;wrongway:boolean;errors:boolean;error:number;
}
export interface BlissPath {sections:number[];error:number;finishes:boolean}
export interface BlissRouteAnalysis {
 sections:BlissSection[];paths:BlissPath[];errors:BlissTrackError[];
 tooComplex:boolean;
}

const point=(x:number,y:number):BlissPoint=>({x,y});
const same=(a:BlissPoint|null,b:BlissPoint|null)=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
const inside=(x:number,y:number)=>x>=0&&x<30&&y>=0&&y<30;
const opposite=(direction:number)=>direction^2;
const bitDirection=(value:number)=>value===1?0:value===2?1:value===4?2:value===8?3:-1;
const terrainAt=(source:BlissTrack,x:number,y:number)=>source.terrain[blissCellIndex(x,y)];
const trackAt=(source:BlissTrack,x:number,y:number)=>source.track[blissCellIndex(x,y)];

function owner(source:BlissTrack,x:number,y:number,definitions:BlissTransformations){
 const parent=blissParentElement(source,x,y,definitions);
 return {...parent,data:blissElementData[parent.code],shape:definitions.track[parent.code]};
}

function chooseExit(mask:number,bearing:number,detour:boolean){
 const single=bitDirection(mask);if(single>=0)return single;
 const choices=[0,1,2,3].filter(direction=>(mask&(1<<direction))!==0);
 if(!choices.length)return bearing;
 const straight=choices.includes(bearing)?bearing:choices[0];
 if(!detour)return straight;
 return choices.find(direction=>direction!==straight)??straight;
}

/** Port of Bliss GetNext. Coordinates are zero based in the DX port. */
export function getNextBlissVector(
 source:BlissTrack,
 slot:BlissTrackVector,
 detour=false,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
):BlissTrackVector{
 const currentOwner=owner(source,slot.x,slot.y,definitions),curel=currentOwner.code;
 const current=elements[curel],shape=currentOwner.shape,bearing=slot.bearing,entry=opposite(bearing);
 let x=slot.x,y=slot.y,error=0;
 const lateral=!!current.cisalt[bearing];

 if(bearing===0){x+=lateral?1:0;y-=1;}
 else if(bearing===1){y+=lateral?1:0;x+=shape.width;}
 else if(bearing===2){x+=lateral?1:0;y+=shape.height;}
 else {y+=lateral?1:0;x-=1;}

 const elevated=current.ctype[bearing]===2;
 const ramp=elevated&&shape.width===1&&shape.height===1&&current.ctype[entry]===1;
 const bridge=elevated&&!ramp;
 if(detour&&elevated){
  if(bearing===0)y--;else if(bearing===1)x++;else if(bearing===2)y++;else x--;
 }
 if(!inside(x,y))return {x,y,bearing,origin:entry,error:80};

 const nextOwner=owner(source,x,y,definitions);x=nextOwner.x;y=nextOwner.y;
 if(!inside(x,y))return {x,y,bearing,origin:entry,error:80};
 const newel=nextOwner.code,next=elements[newel],nextShape=nextOwner.shape;

 if(next.ctype[entry]===0){
  if((ramp||bridge)&&!detour)return getNextBlissVector(source,slot,true,definitions,elements);
  if(ramp)return {x,y,bearing,origin:entry,error:73};
  if(current.ctype[bearing]===2)return {x,y,bearing,origin:entry,error:74};
  return {x,y,bearing,origin:entry,error:81};
 }
 if(next.ctype[entry]!==current.ctype[bearing])error=70;

 if(ramp&&detour){
  const forbidden=[9,8,7,10][bearing];
  if(terrainAt(source,slot.x,slot.y)===forbidden)error=21;
  else if(terrainAt(source,slot.x,slot.y)===0&&terrainAt(source,x,y)===6)error=21;
 }else if(bridge&&detour){
  if(terrainAt(source,slot.x,slot.y)!==6||terrainAt(source,x,y)===6)error=21;
 }

 if(bearing===0||bearing===2){
  if(x-(next.cisalt[entry]?1:0)!==slot.x-(current.cisalt[bearing]?1:0))error=81;
 }else if(y-(next.cisalt[entry]?1:0)!==slot.y-(current.cisalt[bearing]?1:0))error=81;

 if(slot.origin!==entry||current.entity===116||current.entity===104){
  if(nextShape.width===1&&nextShape.height===1&&next.ctype[entry]===1&&next.ctype[bearing]===2){
   const beyond=bearing===0?[x,y-1]:bearing===1?[x+1,y]:bearing===2?[x,y+1]:[x-1,y];
   if(inside(beyond[0],beyond[1])){
    const after=owner(source,beyond[0],beyond[1],definitions);
    if(elements[after.code].ctype[entry]!==2)error=71;
   }
  }
 }

 const mask=next.cto[entry];
 if(mask===0)error=4;
 const newBearing=chooseExit(mask,bearing,detour);
 return {x,y,bearing:newBearing,origin:entry,error};
}

const newSection=(initial:BlissPoint,bearing:number,origin:number):BlissSection=>({
 initial:{...initial},final:null,solving:false,origin,bearing,parent:[0,0],child:[0,0],
 length:0,finishes:false,cycle:false,wrongway:false,errors:false,error:0,
});

/** Port of GenerateSections/SolveSection/SolvePath. Section index 0 is intentionally unused. */
export function analyzeBlissRoute(
 source:BlissTrack,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
 maxPaths=1000,
):BlissRouteAnalysis{
 const start=findBlissStart(source);
 if(start.error)return {sections:[],paths:[],errors:[],tooComplex:false};
 const sections:BlissSection[]=[newSection(point(0,0),0,0),newSection(point(start.x,start.y),start.bearing,start.origin)];
 const errors:BlissTrackError[]=[];
 let tooComplex=false;

 const solveSection=(sn:number)=>{
  const section=sections[sn];section.error=0;section.errors=false;section.solving=true;section.length=0;section.finishes=false;section.cycle=false;section.final=null;section.wrongway=false;
  let vector:BlissTrackVector={x:section.initial.x,y:section.initial.y,bearing:section.bearing,origin:section.origin,error:0};
  for(let guard=0;guard<10000;guard++){
   const old={...vector};section.length++;vector=getNextBlissVector(source,vector,false,definitions,elements);
   if(vector.error)errors.push({x:old.x,y:old.y,error:vector.error,section:sn});
   if(vector.error>=70&&vector.error<=79){
    if(section.error<40)section.error=vector.error;section.errors=true;section.solving=false;section.final=point(old.x,old.y);section.child=[0,0];return;
   }
   if(vector.error>=80&&vector.error<=89){
    if(section.error===0)section.error=vector.error;section.errors=true;section.solving=false;section.final=point(old.x,old.y);section.child=[0,0];return;
   }
   if(vector.error>=20&&vector.error<=39){if(section.error===0)section.error=vector.error;section.errors=true;}

   if(same(vector,sections[1].initial)){
    section.final=point(vector.x,vector.y);section.child=[0,0];section.finishes=true;section.solving=false;return;
   }

   const data=elements[trackAt(source,vector.x,vector.y)];
   const connectorCount=data.ctype.filter(Boolean).length;
   if(connectorCount!==3)continue;
   section.final=point(vector.x,vector.y);

   for(let i=1;i<sections.length;i++){
    const previous=sections[i];if(!same(vector,previous.initial))continue;
    if((1<<previous.bearing)!==data.cto[opposite(vector.bearing)]){
     section.child=[0,0];section.wrongway=true;section.errors=true;if(section.error<40)section.error=72;
     errors.push({x:vector.x,y:vector.y,error:72,section:sn});
    }else if(previous.solving){
     section.child=[0,0];section.cycle=true;if(section.error<40)section.error=82;
     errors.push({x:vector.x,y:vector.y,error:82,section:sn});
    }else{
     section.child=[i,0];previous.parent[1]=sn;
     section.finishes=previous.finishes;section.cycle=previous.cycle;section.wrongway=previous.wrongway;
     if(section.error<40)section.error=previous.error;
    }
    section.solving=false;return;
   }

   const exitMask=data.cto[opposite(vector.bearing)],one=bitDirection(exitMask);
   if(one>=0){
    if(sections.length>254){tooComplex=true;section.solving=false;return;}
    const daughter=sections.length;sections.push(newSection(point(vector.x,vector.y),one,vector.origin));solveSection(daughter);
    const child=sections[daughter];section.finishes=child.finishes;section.cycle=child.cycle;section.wrongway=child.wrongway;if(section.error===0)section.error=child.error;
    section.child=[daughter,0];child.parent=[sn,0];section.solving=false;return;
   }

   const daughters:number[]=[];
   for(let offset=0;offset<4;offset++){
    const direction=(vector.bearing+offset)&3;
    if(direction===opposite(vector.bearing)||data.ctype[direction]===0)continue;
    if(sections.length>254){tooComplex=true;section.solving=false;return;}
    const daughter=sections.length;sections.push(newSection(point(vector.x,vector.y),direction,vector.origin));daughters.push(daughter);solveSection(daughter);
    if(daughters.length===2)break;
   }
   if(daughters.length<2){section.child=[daughters[0]??0,0];section.solving=false;return;}
   const a=sections[daughters[0]],b=sections[daughters[1]];
   section.finishes=a.finishes||b.finishes;section.cycle=a.cycle&&b.cycle;
   if(section.error===0){section.error=a.error;if(section.error===0||b.error===4)section.error=b.error;}
   section.wrongway=a.wrongway&&b.wrongway;section.child=[daughters[0],daughters[1]];
   a.parent=[sn,0];b.parent=[sn,0];section.solving=false;return;
  }
  section.solving=false;section.error=section.error||82;section.cycle=true;
 };

 solveSection(1);
 if(tooComplex)return {sections,paths:[],errors,tooComplex:true};

 const paths:BlissPath[]=[{sections:[1],error:0,finishes:false}];
 const solvePath=(index:number)=>{
  const route=paths[index],thisSection=route.sections[route.sections.length-1],section=sections[thisSection];
  if(section.errors){
   if(section.error>=40){route.error=section.error;return;}
   if(route.error===0)route.error=section.error;
  }
  if(same(section.final,sections[1].initial)){route.finishes=true;return;}
  const [c1,c2]=section.child;
  if(!c2){
   if(!c1)return;
   if(route.sections.includes(c1)){route.error=82;return;}
   route.sections.push(c1);solvePath(index);return;
  }
  if(paths.length>=maxPaths){tooComplex=true;return;}
  const other:BlissPath={sections:[...route.sections,c2],error:route.error,finishes:route.finishes};paths.push(other);
  route.sections.push(c1);
  solvePath(paths.length-1);solvePath(index);
 };
 solvePath(0);
 return {sections,paths,errors,tooComplex:tooComplex||paths.length>=maxPaths};
}

export interface BlissTrackCheck {
 ok:boolean;error:number;point?:BlissPoint;path?:number;
 reason:'ok'|'terrain'|'start'|'complex'|'flow'|'warning'|'open';
 analysis?:BlissRouteAnalysis;
}

/** Non-UI equivalent of Bliss CheckTrack. */
export function checkBlissTrack(source:BlissTrack):BlissTrackCheck{
 const terrain=detectBlissTerrainError(source);
 if(terrain&&terrain.code>=40&&terrain.code<=49)return {ok:false,error:terrain.code,point:{x:terrain.x,y:terrain.y},reason:'terrain'};
 const start=findBlissStart(source);
 if(start.error)return {ok:false,error:start.error,point:{x:start.x,y:start.y},reason:'start'};
 const analysis=analyzeBlissRoute(source);
 if(analysis.tooComplex)return {ok:false,error:90,reason:'complex',analysis};
 for(let i=0;i<analysis.paths.length;i++){const e=analysis.paths[i].error;if(e>=70&&e<=79)return {ok:false,error:e,path:i,reason:'flow',analysis};}
 for(let i=0;i<analysis.paths.length;i++){const e=analysis.paths[i].error;if(e>=20&&e<=29)return {ok:false,error:e,path:i,reason:'warning',analysis};}
 const winner=analysis.paths.findIndex(path=>path.finishes);
 if(winner>=0)return {ok:true,error:0,path:winner,reason:'ok',analysis};
 return {ok:false,error:82,reason:'open',analysis};
}
