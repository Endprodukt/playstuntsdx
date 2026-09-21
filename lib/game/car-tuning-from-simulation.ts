import type {EngineTuning} from '../physics/engine.ts';
import type {GripTuning} from '../physics/grip.ts';

/** Decode the physics fields stored at the start of an original 776-byte SIMD
 * car record. This is the same data the DOS resource loader has already copied
 * into live race memory, so community CARxxxx.RES files do not need a second
 * entry in the prepared JSON car catalogue merely to run a replay. */
export function decodeOriginalCarTuning(simulation:Uint8Array):EngineTuning&GripTuning{
 if(simulation.length<192)throw Error('Original car SIMD record is too short for physics tuning');
 const view=new DataView(simulation.buffer,simulation.byteOffset,simulation.byteLength),word=(at:number)=>view.getUint16(at,true);
 return {
  gears:simulation[0]!,
  mass:word(2),
  braking:word(4),
  idleRPM:word(6),
  downshiftRPM:word(8),
  upshiftRPM:word(10),
  maxRPM:word(12),
  gearRatios:Array.from({length:7},(_,index)=>word(14+index*2)),
  gearKnobPoints:Array.from({length:7},(_,index)=>[view.getInt16(28+index*4,true),view.getInt16(30+index*4,true)]),
  aeroResistance:word(56),
  idleTorque:simulation[58]!,
  torqueCurve:Array.from(simulation.subarray(59,163)),
  grip:word(164),
  surfaceGrip:Array.from({length:6},(_,index)=>word(180+index*2)),
 };
}
