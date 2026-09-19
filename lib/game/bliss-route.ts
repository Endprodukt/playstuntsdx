// Native PlayStunts DX port of Bliss 2.6.1 track-flow analysis.
// The control flow follows bliss.bas: FindStart -> GenerateSections ->
// SolveSection -> SolvePath -> PathLength.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {blissCellIndex} from './bliss-track.ts';
import {blissElementData,type BlissElementData} from './bliss-element-data.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';
import {detectBlissNonStunts,detectBlissTerrainError,findBlissStart} from './bliss-validation.ts';

export interface BlissPoint {x:number;y:number}
export interface BlissTrackVector extends BlissPoint {bearing:number;origin:number;error:number}
export interface BlissTrackError extends BlissPoint {error:number;section:number}
export interface BlissSection {
 initial:BlissPoint;final:BlissPoint|null;
 solving:boolean;origin:number;bearing:number;
 parent:[number,number];child:[number,number];
 finishes:boolean;cycle:boolean;wrongway:boolean;errors:boolean;error:number;
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

function parentCoordinates(source:BlissTrack,x:number,y:number){
 const filler=trackAt(source,x,y);
 if(filler===255)x--;
 else if(filler===254)y--;
 else if(filler===253){x--;y--;}
 return {x,y};
}

function exitBearing(mask:number,bearing:number,detour:boolean){
 // In FreeBASIC newslot is zero-initialised. For cto=0 Bliss sets error 4
 // but leaves bearing untouched by the Select Case, so it is always North (0).
 if(mask===0)return 0;
 switch(mask){
  case 1:return 0;case 2:return 1;case 4:return 2;case 8:return 3;
  case 3:return bearing===1?(detour?0:1):(detour?1:0);
  case 6:return bearing===2?(detour?1:2):(detour?2:1);
  case 9:return bearing===3?(detour?0:3):(detour?3:0);
  case 12:return bearing===3?(detour?2:3):(detour?3:2);
  default:return bearing;
 }
}

export function getNextBlissVector(
 source:BlissTrack,
 slot:BlissTrackVector,
 detour=false,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
):BlissTrackVector{
 const curel=trackAt(source,slot.x,slot.y),current=elements[curel],shape=definitions.track[curel];
 const bearing=slot.bearing,entry=opposite(bearing);
 let x=slot.x,y=slot.y,error=0,isRamp=false,isBridge=false;
 const alt=current.cisalt[bearing]!==0;

 if(bearing===0){if(alt)x++;y--;}
 else if(bearing===1){if(alt)y++;x+=shape.width;}
 else if(bearing===2){if(alt)x++;y+=shape.height;}
 else{if(alt)y++;x--;}

 if(current.ctype[bearing]===2){
  isRamp=shape.width===1&&shape.height===1&&current.ctype[entry]===1;
  isBridge=!isRamp;
  if(detour){if(bearing===0)y--;else if(bearing===1)x++;else if(bearing===2)y++;else x--;}
 }
 if(!inside(x,y))return {x,y,bearing,origin:entry,error:80};

 ({x,y}=parentCoordinates(source,x,y));
 if(!inside(x,y))return {x,y,bearing,origin:entry,error:80};
 const newel=trackAt(source,x,y),next=elements[newel],nextShape=definitions.track[newel];

 if(next.ctype[entry]===0){
  if((isRamp||isBridge)&&!detour)return getNextBlissVector(source,slot,true,definitions,elements);
  if(isRamp)return {x,y,bearing,origin:entry,error:73};
  if(current.ctype[bearing]===2)return {x,y,bearing,origin:entry,error:74};
  return {x,y,bearing,origin:entry,error:81};
 }else if(next.ctype[entry]!==current.ctype[bearing])error=70;

 if(isRamp&&detour){
  const forbidden=[9,8,7,10][bearing];
  if(terrainAt(source,slot.x,slot.y)===forbidden)error=21;
  else if(terrainAt(source,slot.x,slot.y)===0&&terrainAt(source,x,y)===6)error=21;
 }else if(isBridge&&detour){
  if(terrainAt(source,slot.x,slot.y)!==6||terrainAt(source,x,y)===6)error=21;
 }

 // FreeBASIC booleans are -1 for true. The original code subtracts
 // (cisalt <> 0), which therefore ADDS one for an offset connector.
 // Using JavaScript's 1 for true here mirrored the offset and broke route
 // analysis for many curves/splits.
 const bool=(value:boolean)=>value?-1:0;
 if(bearing===0||bearing===2){
  if(x-bool(next.cisalt[entry]!==0)!==slot.x-bool(current.cisalt[bearing]!==0))error=81;
 }else if(y-bool(next.cisalt[entry]!==0)!==slot.y-bool(current.cisalt[bearing]!==0))error=81;

 if(slot.origin!==entry||current.entity===116||current.entity===104){
  if(nextShape.width===1&&nextShape.height===1&&next.ctype[entry]===1&&next.ctype[bearing]===2){
   const bx=bearing===1?x+1:bearing===3?x-1:x;
   const by=bearing===0?y-1:bearing===2?y+1:y;
   if(inside(bx,by)){
    const parent=parentCoordinates(source,bx,by);
    if(inside(parent.x,parent.y)&&elements[trackAt(source,parent.x,parent.y)].ctype[entry]!==2)error=71;
   }
  }
 }

 const mask=next.cto[entry];
 if(mask===0)error=4;
 return {x,y,bearing:exitBearing(mask,bearing,detour),origin:entry,error};
}

const newSection=(initial:BlissPoint,bearing:number,origin:number):BlissSection=>({
 initial:{...initial},final:null,solving:false,origin,bearing,parent:[0,0],child:[0,0],
 finishes:false,cycle:false,wrongway:false,errors:false,error:0,
});

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

 const solveSection=(sn:number):void=>{
  const section=sections[sn];
  section.error=0;section.errors=false;section.solving=true;section.finishes=false;section.cycle=false;section.final=null;section.wrongway=false;
  let vector:BlissTrackVector={x:section.initial.x,y:section.initial.y,bearing:section.bearing,origin:section.origin,error:0};

  for(let guard=0;guard<10000;guard++){
   const old={...vector};
   vector=getNextBlissVector(source,vector,false,definitions,elements);
   if(vector.error)errors.push({x:old.x,y:old.y,error:vector.error,section:sn});

   if(vector.error>=70&&vector.error<=79){
    if(section.error<40)section.error=vector.error;
    section.errors=true;section.solving=false;section.final=point(old.x,old.y);section.child=[0,0];return;
   }
   if(vector.error>=80&&vector.error<=89){
    if(section.error===0)section.error=vector.error;
    section.errors=true;section.solving=false;section.final=point(old.x,old.y);section.child=[0,0];return;
   }
   if(vector.error>=20&&vector.error<=39){
    if(section.error===0)section.error=vector.error;section.errors=true;
   }

   if(same(vector,sections[1].initial)){
    section.final=point(vector.x,vector.y);section.child=[0,0];section.finishes=true;section.solving=false;return;
   }

   const code=trackAt(source,vector.x,vector.y),data=elements[code];
   if(data.ctype.filter(Boolean).length!==3)continue;
   section.final=point(vector.x,vector.y);

   for(let i=1;i<sections.length;i++){
    const previous=sections[i];if(!same(vector,previous.initial))continue;
    if((1<<previous.bearing)!==data.cto[opposite(vector.bearing)]){
     section.child=[0,0];section.wrongway=true;section.errors=true;
     if(section.error<40)section.error=72;
     errors.push({x:vector.x,y:vector.y,error:72,section:sn});
    }else if(previous.solving){
     section.child=[0,0];section.cycle=true;
     if(section.error<40)section.error=82;
     errors.push({x:vector.x,y:vector.y,error:82,section:sn});
    }else{
     section.child=[i,0];previous.parent[1]=sn;
     section.finishes=previous.finishes;section.cycle=previous.cycle;section.wrongway=previous.wrongway;
     if(section.error<40)section.error=previous.error;
    }
    section.solving=false;return;
   }

   const destination=data.cto[opposite(vector.bearing)],single=bitDirection(destination);
   if(single>=0){
    sections.push(newSection(point(vector.x,vector.y),single,vector.origin));
    if(sections.length-1>254){tooComplex=true;section.solving=false;return;}
    const daughter=sections.length-1;solveSection(daughter);
    const child=sections[daughter];
    section.finishes=child.finishes;section.cycle=child.cycle;section.wrongway=child.wrongway;
    if(section.error===0)section.error=child.error;
    section.child=[daughter,0];child.parent=[sn,0];section.solving=false;return;
   }

   const daughters:number[]=[];
   for(let i=vector.bearing;i<=vector.bearing+3;i++){
    const direction=i%4;
    if(direction===opposite(vector.bearing)||data.ctype[direction]===0)continue;
    sections.push(newSection(point(vector.x,vector.y),direction,vector.origin));
    if(sections.length-1>254){tooComplex=true;section.solving=false;return;}
    const daughter=sections.length-1;daughters.push(daughter);solveSection(daughter);
   }
   if(daughters.length<2){
    section.child=[daughters[0]??0,0];section.solving=false;return;
   }
   const first=sections[daughters[0]],second=sections[daughters[1]];
   section.finishes=first.finishes||second.finishes;
   section.cycle=first.cycle&&second.cycle;
   if(section.error===0){section.error=first.error;if(section.error===0||second.error===4)section.error=second.error;}
   section.wrongway=first.wrongway&&second.wrongway;
   section.child=[daughters[0],daughters[1]];
   first.parent=[sn,0];second.parent=[sn,0];
   section.solving=false;return;
  }

  section.solving=false;section.cycle=true;section.errors=true;section.error=82;
 };

 solveSection(1);
 if(tooComplex)return {sections,paths:[],errors,tooComplex:true};

 const paths:BlissPath[]=[{sections:[1],error:0,finishes:false}];
 const solvePath=(pn:number):void=>{
  const path=paths[pn],thisSection=path.sections[path.sections.length-1],section=sections[thisSection];
  if(section.errors){
   if(section.error>=40){path.error=section.error;return;}
   if(path.error===0)path.error=section.error;
  }
  if(same(section.final,sections[1].initial)){path.finishes=true;return;}
  const [c1,c2]=section.child;
  if(c2===0){
   if(c1===0)return;
   if(path.sections.includes(c1)){path.error=82;return;}
   path.sections.push(c1);solvePath(pn);return;
  }
  if(paths.length===maxPaths){tooComplex=true;return;}
  paths.push({sections:[...path.sections,c2],error:path.error,finishes:path.finishes});
  path.sections.push(c1);
  solvePath(paths.length-1);solvePath(pn);
 };
 solvePath(0);
 return {sections,paths,errors,tooComplex:tooComplex||paths.length>=maxPaths};
}

export function blissPathLength(
 source:BlissTrack,
 analysis:BlissRouteAnalysis,
 pathIndex:number,
 weighted=false,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
){
 const path=analysis.paths[pathIndex];if(!path)return 0;
 let length=0;
 for(const sectionNumber of path.sections){
  const section=analysis.sections[sectionNumber];if(!section||!section.final)continue;
  let vector:BlissTrackVector={x:section.initial.x,y:section.initial.y,bearing:section.bearing,origin:0,error:0};
  let justStarted=analysis.sections.length===2&&analysis.sections[1].finishes;
  for(let guard=0;guard<10000&&(!same(vector,section.final)||justStarted);guard++){
   vector=getNextBlissVector(source,vector,false,definitions,elements);justStarted=false;
   if(!inside(vector.x,vector.y))break;
   const code=trackAt(source,vector.x,vector.y);
   if(weighted)length+=elements[code].length;
   else{const shape=definitions.track[code];length+=(shape.width>1||shape.height>1)?2:1;}
  }
 }
 return length+(weighted?10:1);
}

export const BLISS_RACER_WEIGHT=7.2955;
const blissRoundToEven=(value:number)=>{
 const low=Math.floor(value),high=Math.ceil(value),dl=value-low,dh=high-value;
 if(dl<dh)return low;if(dh<dl)return high;return (low&1)===0?low:high;
};
export function blissEstimatedTimeCentiseconds(tokens:number,carHandicap=1,racerWeight=BLISS_RACER_WEIGHT){
 return Math.max(0,blissRoundToEven(tokens*racerWeight*carHandicap));
}
export function blissTimey(centiseconds:number){
 // Timey takes a Long in Bliss, so a floating expression is converted with
 // the same FreeBASIC round-to-even rule before formatting.
 let value=Math.max(0,blissRoundToEven(centiseconds));
 const c=value%100;value=Math.floor(value/100);
 const s=value%60;value=Math.floor(value/60);
 const m=value%60;const h=Math.floor(value/60);
 const cc=String(c).padStart(2,'0'),ss=String(s).padStart(2,'0');
 return h?String(h)+':'+String(m).padStart(2,'0')+':'+ss+'.'+cc:String(m)+':'+ss+'.'+cc;
}


export interface BlissAnalysisPathSummary {
 index:number;tiles:number;tokens:number;finishes:boolean;error:number;
 safe:boolean;wrongWay:boolean;cyclic:boolean;opponentPath:boolean;fastest:boolean;
}
export interface BlissAnalysisSummary {
 totalPaths:number;winningPaths:number;safePaths:number;cycles:number;
 shortestWinning:number|null;shortestSafe:number|null;
 briefestWinning:number|null;briefestSafe:number|null;
 flowFatal:boolean;terrainCrash:boolean;terrainFatal:boolean;terrainWarning:boolean;
 compatibility:ReturnType<typeof detectBlissNonStunts>;
 prognosis:
  |'terrain-crash'|'terrain-fatal'|'flow-fatal'|'terrain-warning'
  |'non-stunts'|'ok'|'no-winning-path';
 paths:BlissAnalysisPathSummary[];
}

/** Exact statistics/prognosis calculated by Bliss 2.6.1 Menu_Analysis page 0/1. */
export function summarizeBlissTrackAnalysis(
 source:BlissTrack,
 analysis:BlissRouteAnalysis,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
):BlissAnalysisSummary{
 const terrain=detectBlissTerrainError(source);
 const terrainCrash=terrain?.code===40;
 const terrainFatal=!!terrain&&terrain.code>=41&&terrain.code<=49;
 const terrainWarning=!!terrain&&terrain.code>=50&&terrain.code<=59;
 const compatibility=detectBlissNonStunts(source,definitions);

 let winningPaths=0,safePaths=0,cycles=0,flowFatal=false;
 let shortestWinning=10000,shortestSafe=10000,briefestWinning=100000,briefestSafe=1000000;
 const interim:{index:number;tiles:number;tokens:number;finishes:boolean;error:number;safe:boolean;wrongWay:boolean;cyclic:boolean}[]=[];

 for(let i=0;i<analysis.paths.length;i++){
  const path=analysis.paths[i],tiles=blissPathLength(source,analysis,i,false,definitions,elements),tokens=blissPathLength(source,analysis,i,true,definitions,elements);
  if(path.finishes){
   winningPaths++;
   if(tiles<shortestWinning)shortestWinning=tiles;
   if(tokens<briefestWinning)briefestWinning=tokens;
   if(path.error===0){
    safePaths++;
    if(tiles<shortestSafe)shortestSafe=tiles;
    if(tokens<briefestSafe)briefestSafe=tokens;
   }
  }
  if(path.error===82)cycles++;
  else if(path.error>=70&&path.error<=79)flowFatal=true;
  const lastSection=analysis.sections[path.sections[path.sections.length-1]];
  interim.push({
   index:i,tiles,tokens,finishes:path.finishes,error:path.error,safe:path.finishes&&path.error===0,
   wrongWay:!path.finishes&&path.error===72,
   cyclic:!path.finishes&&! (path.error===72) && !!lastSection?.cycle,
  });
 }

 const sw=winningPaths?shortestWinning:null,ss=safePaths?shortestSafe:null,bw=winningPaths?briefestWinning:null,bs=safePaths?briefestSafe:null;
 const prognosis:BlissAnalysisSummary['prognosis']=terrainCrash?'terrain-crash':
  terrainFatal?'terrain-fatal':
  winningPaths?(flowFatal?'flow-fatal':terrainWarning?'terrain-warning':compatibility?'non-stunts':'ok'):
  'no-winning-path';

 return {
  totalPaths:analysis.paths.length,winningPaths,safePaths,cycles,
  shortestWinning:sw,shortestSafe:ss,briefestWinning:bw,briefestSafe:bs,
  flowFatal,terrainCrash,terrainFatal,terrainWarning,compatibility,prognosis,
  paths:interim.map(row=>({...row,opponentPath:sw!==null&&row.finishes&&row.tiles===sw,fastest:bw!==null&&row.finishes&&row.tokens===bw})),
 };
}


export interface BlissPathTraceStep {
 x:number;y:number;width:number;height:number;code:number;section:number;bearing:number;
}
export interface BlissPathTrace {
 steps:BlissPathTraceStep[];
 cursor:BlissPoint;
 stoppedOnError:boolean;
}

/** Behavioural port of Bliss FollowPath without drawing/sleep side effects.
 * The UI can replay these steps to reproduce Bliss' cyan path animation. */
export function traceBlissPath(
 source:BlissTrack,
 analysis:BlissRouteAnalysis,
 pathIndex:number,
 stopError=0,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
):BlissPathTrace{
 const path=analysis.paths[pathIndex];
 if(!path||!path.sections.length)return {steps:[],cursor:{x:0,y:0},stoppedOnError:false};
 const first=analysis.sections[path.sections[0]];
 if(first?.final&&same(first.final,first.initial)&&!first.finishes)return {steps:[],cursor:{...first.initial},stoppedOnError:false};

 const steps:BlissPathTraceStep[]=[];
 let justStarted=true,last:BlissPoint={...first.initial};

 for(const sectionNumber of path.sections){
  const section=analysis.sections[sectionNumber];if(!section||!section.final)continue;
  let slot:BlissTrackVector={x:section.initial.x,y:section.initial.y,bearing:section.bearing,origin:0,error:0};

  for(let guard=0;guard<10000;guard++){
   if(same(slot,section.final)&&!justStarted){last={x:slot.x,y:slot.y};break;}
   if(!inside(slot.x,slot.y)){last={x:slot.x,y:slot.y};break;}

   const code=trackAt(source,slot.x,slot.y),shape=definitions.track[code];
   steps.push({x:slot.x,y:slot.y,width:shape?.width??1,height:shape?.height??1,code,section:sectionNumber,bearing:slot.bearing});

   const old={...slot};
   slot=getNextBlissVector(source,slot,false,definitions,elements);
   if(stopError&&slot.error===stopError){
    return {steps,cursor:{x:old.x,y:old.y},stoppedOnError:true};
   }
   last={x:slot.x,y:slot.y};justStarted=false;
  }
 }
 return {steps,cursor:last,stoppedOnError:false};
}

export interface BlissTrackCheck {
 ok:boolean;error:number;point?:BlissPoint;path?:number;
 reason:'ok'|'terrain'|'start'|'complex'|'flow'|'warning'|'open';
 analysis?:BlissRouteAnalysis;
}

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
