import {blissElementData} from './bliss-element-data.ts';
import type {BlissPathTrace,BlissPathTraceStep} from './bliss-route.ts';
import {normalizeRaceHeading} from './race-spawn.ts';

export interface BlissRoadSnapResult {x:number;z:number;heading:number;distance:number;snapped:boolean}

const center=(step:BlissPathTraceStep)=>({
 x:(step.x+step.width*.5)*1024,
 z:(30-step.y-step.height*.5)*1024,
});

function closestOnSegment(x:number,z:number,ax:number,az:number,bx:number,bz:number){
 const dx=bx-ax,dz=bz-az,length2=dx*dx+dz*dz;
 if(!length2)return {x:ax,z:az,t:0,distance:Math.hypot(x-ax,z-az)};
 const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length2));
 const px=ax+dx*t,pz=az+dz*t;
 return {x:px,z:pz,t,distance:Math.hypot(x-px,z-pz)};
}

function addCandidate(
 best:BlissRoadSnapResult|undefined,
 x:number,z:number,ax:number,az:number,bx:number,bz:number,
 reverse=false,
){
 const hit=closestOnSegment(x,z,ax,az,bx,bz),dx=reverse?ax-bx:bx-ax,dz=reverse?az-bz:bz-az;
 const candidate:BlissRoadSnapResult={x:hit.x,z:hit.z,heading:normalizeRaceHeading(-Math.atan2(dx,dz)*512/Math.PI),distance:hit.distance,snapped:true};
 return !best||candidate.distance<best.distance?candidate:best;
}

function curvedStepCandidate(x:number,z:number,step:BlissPathTraceStep,previous:{x:number;z:number}|undefined,next:{x:number;z:number}|undefined){
 const data=blissElementData[step.code],connections=data?data.ctype.map((value,index)=>value?index:-1).filter(index=>index>=0):[];
 if(connections.length!==2||step.width!==step.height)return undefined;
 const a=connections[0],b=connections[1];
 if(((a-b+4)%4)===2)return undefined; // opposite connectors are straight
 const x0=step.x*1024,x1=(step.x+step.width)*1024,zNorth=(30-step.y)*1024,zSouth=(30-step.y-step.height)*1024;
 const edges=[
  {x:(x0+x1)/2,z:zNorth},
  {x:x1,z:(zNorth+zSouth)/2},
  {x:(x0+x1)/2,z:zSouth},
  {x:x0,z:(zNorth+zSouth)/2},
 ];
 let cx=0,cz=0;
 const key=[a,b].sort((l,r)=>l-r).join(',');
 if(key==='0,1'){cx=x1;cz=zNorth;}
 else if(key==='1,2'){cx=x1;cz=zSouth;}
 else if(key==='2,3'){cx=x0;cz=zSouth;}
 else if(key==='0,3'){cx=x0;cz=zNorth;}
 else return undefined;
 const d=(edge:{x:number;z:number},point:{x:number;z:number})=>Math.hypot(edge.x-point.x,edge.z-point.z);
 let entry=a,exit=b;
 if(previous){entry=d(edges[a],previous)<=d(edges[b],previous)?a:b;exit=entry===a?b:a;}
 else if(next){exit=d(edges[a],next)<=d(edges[b],next)?a:b;entry=exit===a?b:a;}
 const p0=edges[entry],p1=edges[exit],start=Math.atan2(p0.z-cz,p0.x-cx),end0=Math.atan2(p1.z-cz,p1.x-cx);
 let delta=end0-start;
 while(delta<=-Math.PI)delta+=Math.PI*2;
 while(delta>Math.PI)delta-=Math.PI*2;
 // Adjacent connectors must follow the quarter-circle, never the 270° arc.
 if(Math.abs(delta)>Math.PI/2+.01)delta+=delta<0?Math.PI*2:-Math.PI*2;
 const radius=step.width===2?1536:512,samples=Math.max(16,step.width*16);
 let best:BlissRoadSnapResult|undefined;
 for(let i=0;i<samples;i++){
  const t0=i/samples,t1=(i+1)/samples;
  const q0={x:cx+Math.cos(start+delta*t0)*radius,z:cz+Math.sin(start+delta*t0)*radius};
  const q1={x:cx+Math.cos(start+delta*t1)*radius,z:cz+Math.sin(start+delta*t1)*radius};
  best=addCandidate(best,x,z,q0.x,q0.z,q1.x,q1.z,false);
 }
 return best;
}

/** Snap a world point to Bliss' road centreline. Curves use their actual
 * quarter-circle geometry; other path transitions use trace-centre segments. */
export function snapToBlissRoad(
 x:number,z:number,traces:readonly BlissPathTrace[],fallbackHeading:number,alreadySnapped=false,
){
 let best:BlissRoadSnapResult|undefined;
 for(const trace of traces){
  const points=trace.steps.map(center);
  for(let i=0;i<trace.steps.length;i++){
   const step=trace.steps[i],previous=points[i-1],current=points[i],next=points[i+1];
   const curve=curvedStepCandidate(x,z,step,previous,next);
   if(curve&&(!best||curve.distance<best.distance))best=curve;
   if(next&&!curve)best=addCandidate(best,x,z,current.x,current.z,next.x,next.z,false);
  }
 }
 const threshold=alreadySnapped?950:620;
 return best&&best.distance<=threshold?best:{x,z,heading:best?.heading??normalizeRaceHeading(fallbackHeading),distance:best?.distance??Infinity,snapped:false};
}
