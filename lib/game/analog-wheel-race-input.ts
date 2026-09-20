import {encodeAnalogDrivingInput,type AnalogPedalInput} from '../physics/engine.ts';

type AnalogWheelFrame=AnalogPedalInput&{steeringAngle:number};
const frames=new Map<number,AnalogWheelFrame>();
let lastCapture=-1;

function frameNumber(memory:Uint8Array,d:number,offset:number){
 const view=new DataView(memory.buffer,memory.byteOffset,memory.byteLength);
 return view.getUint16(d+0xa034,true)+view.getUint16(d+offset,true);
}

/** Reset the DX-only live wheel sidecar when a new unrelated race/replay starts. */
export function resetAnalogWheelRaceInput(){
 frames.clear();lastCapture=-1;
}

/** Keep calibrated wheel values beside the original one-byte replay input.
 * The original byte still owns buttons/gears and stays replay-compatible; the
 * live DX path additionally gets proportional pedals and absolute steering. */
export function recordAnalogWheelRaceInput(memory:Uint8Array,d:number,input:AnalogWheelFrame){
 const frame=frameNumber(memory,d,0x73b2);
 if(lastCapture>=0&&frame<lastCapture)frames.clear();
 lastCapture=frame;
 frames.set(frame,{
  throttle:Math.max(0,Math.min(1,input.throttle)),
  brake:Math.max(0,Math.min(1,input.brake)),
  steeringAngle:Math.max(-240,Math.min(240,Math.round(input.steeringAngle))),
 });
}

export function forgetAnalogWheelRaceInput(memory:Uint8Array,d:number){
 frames.delete(frameNumber(memory,d,0x73b2));
}

/** Enrich the original recorded input for the matching simulation frame only.
 * If there is no live DX wheel sample (e.g. an imported original replay), the
 * byte is returned unchanged and the original digital physics stay exact. */
export function analogWheelRaceInput(input:number,memory:Uint8Array,d:number){
 const wheel=frames.get(frameNumber(memory,d,0x8c26));
 return wheel?encodeAnalogDrivingInput(input,wheel,wheel.steeringAngle):input;
}
