/** Broderbund Stunts 1.1 (12 Feb 1991) engine/gearbox path.
 * Kept separate from the Mindscape Dec-1990 implementation. Digital arithmetic
 * follows Restunts' BB1.1 update_car_speed reconstruction; DX analog pedals are
 * an input extension layered on that drivetrain.
 */
import { i16,u16 } from '../math.ts';
import {opponentEngineForce} from '../opponent-engine-force.ts';
import {updateForceFeedbackEngine} from '../force-feedback.ts';
export interface EngineState {speed:number;roadSpeed:number;lastSpeed:number;speedDiff:number;rpm:number;lastRPM:number;gear:number;ratio:number;ratioHigh:number;gravity:number;rearContact:number;allContact:number;automatic:number;shifting:number;shiftTimer:number;limiter:number;knobX:number;knobY:number;targetX:number;targetY:number;accelerating:number;braking:number}
export interface EngineTuning {gears:number;mass:number;braking:number;idleRPM:number;downshiftRPM:number;upshiftRPM:number;maxRPM:number;gearRatios:number[];gearKnobPoints:number[][];idleTorque:number;torqueCurve:number[];aeroResistance:number}
export interface AnalogPedalInput {throttle:number;brake:number}
const ANALOG_INPUT_FLAG=0x40000000;
const ANALOG_STEERING_BASE=0x100000000;
const ANALOG_STEERING_OFFSET=241;
/** DX-only transient encoding. The low 32 bits retain the original controls plus
 * proportional pedal travel. An optional value above bit31 carries the live
 * absolute wheel angle without changing any original Stunts control bits. */
export function encodeAnalogDrivingInput(input:number,pedals:AnalogPedalInput,steeringAngle?:number){
 const throttle=Math.round(Math.max(0,Math.min(1,pedals.throttle))*255);
 const brake=Math.round(Math.max(0,Math.min(1,pedals.brake))*255);
 const low=((input&255)|(throttle<<8)|(brake<<16)|ANALOG_INPUT_FLAG)>>>0;
 if(steeringAngle===undefined)return low;
 const angle=Math.max(-240,Math.min(240,Math.round(steeringAngle)));
 return low+(angle+ANALOG_STEERING_OFFSET)*ANALOG_STEERING_BASE;
}
export function analogSteeringAngle(input:number){
 const encoded=Math.trunc(input/ANALOG_STEERING_BASE);
 return encoded?Math.max(-240,Math.min(240,encoded-ANALOG_STEERING_OFFSET)):undefined;
}
function analogPedals(input:number):AnalogPedalInput|undefined{
 if((input&ANALOG_INPUT_FLAG)===0)return undefined;
 return {throttle:((input>>>8)&255)/255,brake:((input>>>16)&255)/255};
}
export function rpmFromSpeed(rpm:number,speed:number,ratio:number,shifting:number,idle:number){return Math.max(shifting?u16(rpm):Math.floor(u16(speed)*u16(ratio)/65536),u16(idle))}
/** Original 0xa419-0xa42a uses unsigned long division, truncates to a
 * signed word, then divides by two toward zero. Negative force must retain
 * this wraparound behavior; ordinary signed division changes loop motion. */
export function engineForceDelta(force:number,mass:number){return i16(Math.trunc(i16(Math.floor((Math.imul(i16(force),25)>>>0)/(mass&65535)))/2));}
export function stepEngine(before:EngineState,t:EngineTuning,input:number,fps:10|20=20,opponentSpeedByte?:number,onContactScratch?:(words:[number,number])=>void):EngineState{
 const s={...before};const knobStep=fps===20?6:12;s.limiter=(s.limiter? s.limiter-1:0)&255;s.speedDiff=i16(s.roadSpeed-s.lastSpeed);s.lastSpeed=s.roadSpeed;s.lastRPM=s.rpm;
 const pedals=analogPedals(input);
 let shift=0;
 if(!s.automatic&&!s.shifting){if(input&16)shift=1;else if(input&32)shift=-1}
 else if(s.gear&&!s.shifting&&s.rearContact){if(s.rpm>t.upshiftRPM)shift=1;else if(s.rpm<t.downshiftRPM)shift=-1}
 if((shift===1&&s.gear!==t.gears)||(shift===-1&&s.gear>1)){s.gear+=shift;s.shifting=1;s.shiftTimer=fps+(fps>>1);[s.targetX,s.targetY]=t.gearKnobPoints[s.gear]}
 const approach=(a:number,b:number)=>i16(a+Math.sign(b-a)*Math.min(Math.abs(i16(b-a)),knobStep));
 if(s.shifting){if(s.knobX===s.targetX){if(s.knobY===s.targetY){s.shifting=0;s.ratio=t.gearRatios[s.gear];s.ratioHigh=s.ratio>>>8}else s.knobY=approach(s.knobY,s.targetY)}else if(s.knobY===t.gearKnobPoints[0][1])s.knobX=approach(s.knobX,s.targetX);else s.knobY=approach(s.knobY,t.gearKnobPoints[0][1])}else if(s.shiftTimer)s.shiftTimer--;
 let speed=u16(s.speed);let delta=i16(s.gravity-((t.aeroResistance*(speed>>>10)*(speed>>>10))>>9));
 if(s.rpm>t.maxRPM){s.rpm=t.maxRPM-1;delta=i16(delta-t.braking)}
 else if(!pedals){
  // Original digital path stays byte-for-byte equivalent for keyboard,
  // joystick, imported replays and opponents.
  if((input&3)===2){s.accelerating=0;s.limiter=0;s.braking=1;delta=i16(delta-t.braking*(opponentSpeedByte===undefined?1:2))}
  else if((input&3)!==1){s.accelerating=0;s.braking=0}
  else {s.braking=0;s.accelerating=1;
   if(s.shifting){s.limiter=0;s.rpm=i16(s.rpm-(fps===10?80:40))}
   else if(!s.rearContact){if(s.rpm<t.maxRPM&&speed<64000)delta=i16(delta+768)}
   else {let torque=(s.gear<=1&&s.rpm<2600)?t.idleTorque:t.torqueCurve[s.rpm>>>7];if(torque===undefined)throw Error('RPM outside original torque table');if(s.limiter&&s.rpm<5000)torque=(t.idleTorque+torque)>>1;delta=i16(delta+((s.ratioHigh*torque&65535)>>>4));delta=engineForceDelta(delta,t.mass);if(opponentSpeedByte!==undefined)delta=opponentEngineForce(delta,opponentSpeedByte);if(delta>296)s.limiter=5}
  }
 }else if((input&3)===2){
  s.accelerating=0;s.limiter=0;s.braking=pedals.brake>0?1:0;
  delta=i16(delta-Math.round(t.braking*(opponentSpeedByte===undefined?1:2)*pedals.brake));
 }else {
  // Wheel-only analog drivetrain. Keyboard/joystick/replays never enter here.
  const throttle=Math.max(0,Math.min(1,pedals.throttle));
  s.braking=0;s.accelerating=throttle>0?1:0;
  if(s.shifting){
   s.limiter=0;s.rpm=i16(s.rpm-(fps===10?80:40));
  }else if(!s.rearContact){
   if(throttle>0&&s.rpm<t.maxRPM&&speed<64000)delta=i16(delta+Math.round(768*Math.pow(throttle,1.35)));
  }else {
   const baseDelta=delta;
   const rpmRange=Math.max(1,t.maxRPM-t.idleRPM);
   const overrun=Math.max(0,Math.min(1,(s.rpm-t.idleRPM)/rpmRange));
   const engineBrake=Math.round(t.braking*.22*overrun);
   const coastDelta=i16(baseDelta-engineBrake);
   if(throttle<=0){
    delta=coastDelta;
   }else {
    let torque=(s.gear<=1&&s.rpm<2600)?t.idleTorque:t.torqueCurve[s.rpm>>>7];if(torque===undefined)throw Error('RPM outside original torque table');if(s.limiter&&s.rpm<5000)torque=(t.idleTorque+torque)>>1;
    let powered=engineForceDelta(i16(baseDelta+((s.ratioHigh*torque&65535)>>>4)),t.mass);if(opponentSpeedByte!==undefined)powered=opponentEngineForce(powered,opponentSpeedByte);
    // Small pedal movements first cancel driveline drag; only larger pedal travel
    // progressively reaches positive drive torque. This creates a usable partial-
    // throttle equilibrium instead of making every non-zero pedal position an
    // endlessly accelerating digital gas button.
    const drive=Math.pow(throttle,1.55);
    delta=i16(Math.trunc(coastDelta+(powered-coastDelta)*drive));
    if(delta>296)s.limiter=5;
   }
  }
 }
 if(fps===10)delta=i16(delta*2);
 if(delta<0&&-delta>speed)speed=0;else {const high=speed>=32768;speed=u16(speed+delta);if(delta>=0&&high&&(speed<32768||speed>62720))speed=62720}
 if(s.rearContact){let difference=i16(s.roadSpeed-speed);if(difference<0)difference=i16(-difference);if(difference>5120){s.speed=(s.speed+s.roadSpeed)>>>1;s.roadSpeed=s.speed;s.limiter=5}else{s.speed=speed;s.roadSpeed=speed}}else s.speed=speed;
 // Original A517/A51A leaves these arguments in the later contact locals.
 onContactScratch?.([i16(s.rpm),i16(s.speed)]);
 s.rpm=i16(rpmFromSpeed(s.rpm,s.speed,s.ratio,s.shifting,t.idleRPM));
 if(s.allContact&&s.lastRPM>s.rpm){if(i16(s.lastRPM-s.rpm)>2000){if(i16(t.idleTorque*s.ratioHigh)>12000)s.limiter=30}else if(i16(s.rpm-s.lastRPM)>2000){s.limiter=10;s.roadSpeed=u16(s.roadSpeed-1280)}}
 if(opponentSpeedByte===undefined)updateForceFeedbackEngine(s.rpm,s.gear,!!s.shifting,t.idleRPM,t.maxRPM);
 return s;
}
