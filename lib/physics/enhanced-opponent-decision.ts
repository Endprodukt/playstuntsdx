import {i16,vecTransform,type Vector} from './math.ts';
import {opponentDecision,type OpponentDecisionState,type OpponentRouteTarget} from './opponent-decision.ts';
import {opponentEngineCommand} from './opponent-engine-command.ts';
import {opponentPose} from './opponent-pose.ts';
import {opponentRouteDistance} from './opponent-route-distance.ts';
import {stepOpponentRoute,stepOpponentRouteNear,type OpponentRouteState} from './opponent-route-step.ts';
import {opponentTargetAngle} from './opponent-target-angle.ts';
import type {EnhancedOpponentProfile} from './enhanced-opponent-profile.ts';

export interface EnhancedOpponentContext {
 profile:EnhancedOpponentProfile;
 playerSpeed:number;
 grassWheels:number;
}
type PreviewTarget=OpponentRouteTarget&{last:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const mix=(a:number,b:number,t:number)=>Math.trunc(a+(b-a)*t);
const mixVector=(a:Vector,b:Vector,t:number)=>a.map((value,index)=>mix(value,b[index],t)) as Vector;
const signedAngle=(value:number)=>i16(value);

function previewTargets(route:OpponentRouteState,current:OpponentRouteTarget,path:ArrayLike<number>,lookup:(entry:number,point:number)=>PreviewTarget,count:number){
 const out:PreviewTarget[]=[{...current,last:0}];
 let routeIndex=route.routeIndex&65535,point=route.point&255;
 for(let i=0;i<count;i++){
  const entry=path[routeIndex];if(entry===undefined||(entry&65535)===0)break;
  const target=lookup(entry&65535,point);out.push(target);point=(point+1)&255;
  if(target.last&255){
   routeIndex=(routeIndex+1)&65535;point=0;
   const next=path[routeIndex];if(next===undefined||(next&65535)===0)routeIndex=0;
  }
 }
 return out;
}
function heading(a:Vector,b:Vector){return Math.atan2(b[0]-a[0],b[2]-a[2]);}
function angleDelta(a:number,b:number){let value=b-a;while(value>Math.PI)value-=Math.PI*2;while(value<-Math.PI)value+=Math.PI*2;return value;}
function curveInfo(targets:PreviewTarget[]){
 let severity=0;
 for(let i=1;i<targets.length-1;i++){
  const delta=angleDelta(heading(targets[i-1].midpoint,targets[i].midpoint),heading(targets[i].midpoint,targets[i+1].midpoint));
  const amount=clamp(Math.abs(delta)/(Math.PI*.55),0,1);if(amount>severity)severity=amount;
 }
 return {severity};
}
function localX(point:Vector,position:Vector,matrix:number[]){
 return vecTransform(point.map((value,index)=>i16(value-position[index])) as Vector,matrix)[0];
}
function endpointForLocalSide(target:OpponentRouteTarget,position:Vector,matrix:number[],side:-1|1){
 const first=localX(target.first,position,matrix),second=localX(target.second,position,matrix);
 return side<0?(first<=second?target.first:target.second):(first>=second?target.first:target.second);
}
function curveInsideEndpoint(targets:PreviewTarget[],index:number):Vector|undefined{
 if(targets.length<3)return undefined;
 const at=clamp(index,1,targets.length-2),a=targets[at-1].midpoint,b=targets[at].midpoint,c=targets[at+1].midpoint;
 const tangent:[number,number]=[c[0]-a[0],c[2]-a[2]],turn=(b[0]-a[0])*(c[2]-b[2])-(b[2]-a[2])*(c[0]-b[0]);
 if(Math.abs(turn)<8)return undefined;
 const first=targets[at].first,e:[number,number]=[first[0]-b[0],first[2]-b[2]],side=tangent[0]*e[1]-tangent[1]*e[0];
 return Math.sign(side)===Math.sign(turn)?targets[at].first:targets[at].second;
}
function routeMistake(profile:EnhancedOpponentProfile,route:OpponentRouteState){
 const hash=((Math.imul((route.routeIndex+1)&65535,1103515245)+Math.imul((route.point+17)&255,12345)+profile.id*97)>>>0)%1000/1000;
 if(hash>=profile.mistakeRate*.35)return 0;
 return (((hash*997)|0)&1?1:-1)*(0.12+profile.mistakeRate*.55);
}
function enhancedSteeringStep(current:number,requested:number,profile:EnhancedOpponentProfile,recovering:boolean){
 current=i16(current);const target=clamp(i16(requested),-65,65);
 const rate=Math.round(7+profile.reaction*7+profile.risk*2+(recovering?4:0)),difference=Math.abs(i16(target-current));
 return difference>rate?i16(current+Math.sign(target-current)*rate):target;
}
function recoveryTarget(targets:PreviewTarget[],position:Vector,matrix:number[]){
 let best=targets[Math.min(2,targets.length-1)]?.midpoint??targets[0].midpoint,bestScore=Number.POSITIVE_INFINITY;
 for(let i=1;i<targets.length;i++){
  const target=targets[i].midpoint,local=vecTransform(target.map((value,index)=>i16(value-position[index])) as Vector,matrix);
  const angle=Math.abs(signedAngle(opponentTargetAngle(target,position,matrix).angle));
  if(local[2]<60&&i<targets.length-1)continue;
  const score=angle*3+Math.abs(local[0])*.45-Math.min(700,Math.max(0,local[2]))*.10+i*2;
  if(score<bestScore){bestScore=score;best=target;}
 }
 return best;
}
function plannedSpeedByte(targets:PreviewTarget[],profile:EnhancedOpponentProfile,curveSeverity:number,recovering:boolean,overtaking:boolean){
 const horizon=Math.min(targets.length,Math.max(2,Math.round(3+profile.reaction*profile.lookAhead)));
 const values=targets.slice(0,horizon).map(target=>target.side&255).filter(value=>value>0);
 const current=values[0]??64,future=values.length?Math.min(...values):current,anticipation=.35+profile.reaction*.60;
 let target=current*(1-anticipation)+future*anticipation;
 const vertical=targets.slice(0,horizon).reduce((max,item)=>Math.max(max,Math.abs((item.midpoint[1]===-1?targets[0].midpoint[1]:item.midpoint[1])-(targets[0].midpoint[1]===-1?0:targets[0].midpoint[1]))),0);
 const speedScale=(1-curveSeverity)*profile.straightSpeed+curveSeverity*profile.cornerSpeed;
 target*=speedScale;
 if(curveSeverity>.08)target/=profile.brakingMargin;
 target*=1+profile.risk*curveSeverity*.08;
 if(vertical>36)target*=.72+profile.stuntConfidence*.30;
 if(overtaking)target*=1+profile.aggression*.05;
 if(recovering)target=Math.min(target,48+profile.recoverySkill*34);
 return clamp(Math.round(target),24,255);
}

export function enhancedOpponentDecision(state:OpponentDecisionState,playerPosition:Vector,playerCrash:number,mode:number,path:ArrayLike<number>,lookup:(entry:number,point:number)=>PreviewTarget,context:EnhancedOpponentContext){
 if((mode&255)===2)return opponentDecision(state,playerPosition,playerCrash,mode,path,lookup);
 const profile=context.profile;
 let route={...state.route},routeTarget={...state.routeTarget},targetAlternate=state.targetAlternate;
 const retainAlternate=()=>{if(targetAlternate!==undefined&&routeTarget.alternate!==undefined)targetAlternate=routeTarget.alternate;};
 let avoidance=0,steering=state.steering;
 let contactEntryRegisters:[number,number]|undefined=state.contactCaller?[state.contactCaller.incomingSI&65535,state.contactCaller.incomingDI&65535]:undefined;
 const active=(state.crash&255)&&!(state.roadSpeed&65535)?0:1;
 let plannedByte=routeTarget.side&255;
 if(!(state.crash&255)){
  const pose=opponentPose(state.position,playerPosition,state.rotation);
  if(contactEntryRegisters)contactEntryRegisters[0]=opponentRouteDistance(routeTarget.midpoint,pose.position).distance&65535;
  const near=stepOpponentRouteNear(route,routeTarget.midpoint,pose.position,path,lookup);
  route=near.state;if(near.lookup){routeTarget=near.lookup;retainAlternate();}
  const targets=previewTargets(route,routeTarget,path,lookup,Math.max(8,profile.lookAhead+5)),curve=curveInfo(targets);
  const routeDistance=opponentRouteDistance(routeTarget.midpoint,pose.position).distance;
  const recovering=context.grassWheels>=2||(context.grassWheels>=1&&routeDistance>320)||routeDistance>900;
  const playerLocal=pose.player.map((value,index)=>i16(value-pose.position[index])) as Vector,localPlayer=vecTransform(playerLocal,pose.matrix),absPlayerX=Math.abs(localPlayer[0]);
  const speedAdvantage=(state.speed&65535)-(context.playerSpeed&65535);
  const passingRange=460+Math.round(profile.reaction*260+profile.aggression*180);
  const overtaking=!recovering&&!(playerCrash&255)&&localPlayer[2]>-50&&localPlayer[2]<passingRange&&absPlayerX<250&&(speedAdvantage>Math.round((1-profile.overtakeThreshold)*900)||profile.aggression>.84);
  const defending=!recovering&&!overtaking&&!(playerCrash&255)&&localPlayer[2]<-24&&localPlayer[2]>-430&&absPlayerX<230&&profile.defensiveDriving>.35;
  const targetIndex=Math.min(targets.length-1,Math.max(1,Math.round(2+profile.lookAhead*(.45+.35*profile.reaction))));
  const selected=targets[targetIndex]??routeTarget;
  let target=[...selected.midpoint] as Vector;
  if(recovering){target=recoveryTarget(targets,pose.position,pose.matrix);}
  else if(overtaking||defending){
   let desired: -1|1;
   if(overtaking)desired=absPlayerX>22?(localPlayer[0]>0?-1:1):(profile.preferredSide||((profile.id&1)?-1:1)) as -1|1;
   else desired=absPlayerX>18?(localPlayer[0]>0?1:-1):(profile.preferredSide||1) as -1|1;
   const amount=overtaking ? .62+profile.aggression*.24 : .28+profile.defensiveDriving*.30;
   target=mixVector(selected.midpoint,endpointForLocalSide(selected,pose.position,pose.matrix,desired),clamp(amount,0,.88));
   avoidance=desired<0?2:1;
  }else{
   const inside=curveInsideEndpoint(targets,targetIndex);
   if(inside){
    const amount=clamp(.12+curve.severity*.58*profile.linePrecision,0,.68);
    target=mixVector(selected.midpoint,inside,amount);
   }
   const mistake=routeMistake(profile,route);
   if(mistake){
    const desired=(mistake<0?-1:1) as -1|1;
    target=mixVector(target,endpointForLocalSide(selected,pose.position,pose.matrix,desired),Math.abs(mistake));
   }
  }
  const angle=opponentTargetAngle(target,pose.position,pose.matrix).angle;
  const turned=stepOpponentRoute(route,angle,state.sliding,path,lookup);route=turned.state;if(turned.lookup){routeTarget=turned.lookup;retainAlternate();}
  if(contactEntryRegisters&&state.contactCaller)contactEntryRegisters[1]=(turned.lookup?state.contactCaller.pathOffset:state.contactCaller.frameOffset-26)&65535;
  steering=enhancedSteeringStep(state.steering,(state.frontContact&255)?angle:0,profile,recovering);
  plannedByte=plannedSpeedByte(targets,profile,curve.severity,recovering,overtaking);
 }
 const engine=opponentEngineCommand(state.rearContact,state.crash,state.wheelAngle,state.roadSpeed,state.speed,plannedByte,mode,state.demandedGrip,state.surfaceGrip);
 const {midpoint,first,second,side}=routeTarget;
 return {...(contactEntryRegisters?{contactEntryRegisters}:{}),...(targetAlternate===undefined?{}:{targetAlternate}),route,routeTarget:{midpoint,first,second,side},avoidance,active,steering,...engine};
}
