import {encodeAnalogDrivingInput,type AnalogPedalInput} from '../physics/engine.ts';

const frames=new Map<number,AnalogPedalInput>();
let lastCapture=-1;

function frameNumber(memory:Uint8Array,d:number,offset:number){
 const view=new DataView(memory.buffer,memory.byteOffset,memory.byteLength);
 return view.getUint16(d+0xa034,true)+view.getUint16(d+offset,true);
}

/** Reset the DX-only live pedal sidecar when a new unrelated race/replay starts. */
export function resetAnalogWheelRaceInput(){
 frames.clear();lastCapture=-1;
}

/** Keep the calibrated pedal amount beside the original one-byte replay input.
 * The original input byte still owns buttons/gears and remains replay-compatible;
 * live/retained DX races can additionally use the proportional pedal amount. */
export function recordAnalogWheelRaceInput(memory:Uint8Array,d:number,pedals:AnalogPedalInput){
 const frame=frameNumber(memory,d,0x73b2);
 if(lastCapture>=0&&frame<lastCapture)frames.clear();
 lastCapture=frame;
 frames.set(frame,{throttle:Math.max(0,Math.min(1,pedals.throttle)),brake:Math.max(0,Math.min(1,pedals.brake))});
}

export function forgetAnalogWheelRaceInput(memory:Uint8Array,d:number){
 frames.delete(frameNumber(memory,d,0x73b2));
}

/** Enrich the original recorded input for the matching simulation frame only.
 * If there is no live DX pedal sample (e.g. an imported original replay), the
 * byte is returned unchanged and the original digital physics stay exact. */
export function analogWheelRaceInput(input:number,memory:Uint8Array,d:number){
 const pedals=frames.get(frameNumber(memory,d,0x8c26));
 return pedals?encodeAnalogDrivingInput(input,pedals):input;
}
