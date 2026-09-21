import {opponentDecision,type OpponentDecisionState,type OpponentRouteTarget} from '../opponent-decision.ts';
import {enhancedOpponentDecision,type EnhancedOpponentContext} from '../enhanced-opponent-decision.ts';
import {stepEngine,type EngineState,type EngineTuning} from './engine.ts';
import type {Vector} from '../math.ts';
/** BB1.1 opponent decisions followed by the independent BB1.1 drivetrain. */
export function opponentPowertrain(state:OpponentDecisionState,engine:EngineState,tuning:EngineTuning,playerPosition:Vector,playerCrash:number,mode:number,path:ArrayLike<number>,lookup:(entry:number,point:number)=>OpponentRouteTarget&{last:number},speedProfile:number,enhanced?:EnhancedOpponentContext){
 const decision=enhanced?enhancedOpponentDecision({...state,speed:engine.speed,roadSpeed:engine.roadSpeed,rearContact:engine.rearContact},playerPosition,playerCrash,mode,path,lookup,enhanced):opponentDecision({...state,speed:engine.speed,roadSpeed:engine.roadSpeed,rearContact:engine.rearContact},playerPosition,playerCrash,mode,path,lookup);
 const updatedEngine=stepEngine({...engine,roadSpeed:decision.roadSpeed},tuning,decision.command,20,speedProfile);
 return {decision,engine:updatedEngine};
}
