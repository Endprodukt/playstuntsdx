import {opponentPowertrain} from './opponent-powertrain.ts';
import {stepGrip,type GripState,type GripTuning} from './grip.ts';
/** BB1.1 opponent decisions, engine, then BB1.1 opponent-mode grip. */
export function opponentGripStep(args:Parameters<typeof opponentPowertrain>,grip:GripState,tuning:GripTuning,onContactScratch?:(words:[number,number])=>void){
 const power=opponentPowertrain(...args);
 const updated=stepGrip({...grip,soundFlags:power.decision.active,speed:power.engine.speed,roadSpeed:power.engine.roadSpeed,allContact:power.engine.allContact,steeringAngle:power.decision.steering,wheelAngle:power.decision.wheelAngle},tuning,false,0,onContactScratch);
 return {...power,engineRoadSpeed:power.engine.roadSpeed,engine:{...power.engine,speed:updated.speed,roadSpeed:updated.roadSpeed},grip:updated};
}
