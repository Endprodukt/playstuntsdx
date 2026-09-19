import {desktopInputDevice,getDesktopWheelInput} from './desktop-wheel-input.ts';
import {forgetAnalogWheelRaceInput,recordAnalogWheelRaceInput} from './analog-wheel-race-input.ts';

export interface NativeRaceInputHost {
 memory():Uint8Array;pauseAudio():void;crash(cause:1,car:0):void;
 mouse():{x:number;y:number;buttons:number};joystickSteering():number;
 controls():number;keyDown(scan:number):number;
}
/** Map a calibrated desktop wheel onto Stunts' existing steering range.
 * A physical wheel remains absolute and speed-independent: centre is always
 * centre and full lock is still full lock. A very mild progressive curve only
 * softens tiny movements around centre, avoiding the twitchiness of a naked
 * 1:1 mapping without adding smoothing, lag or gamepad-style steering assists. */
export function originalWheelSteeringTarget(memory:Uint8Array,d:number,value:number){
 const normalized=Math.max(-1,Math.min(1,value));
 const magnitude=Math.abs(normalized);
 if(magnitude<1e-4)return 0;
 const fullLock=memory[d+0x306c+31];
 const shaped=Math.pow(magnitude,1.25);
 return Math.round(Math.sign(normalized)*shaped*fullLock);
}
/** Original14414..14599. Null ends this capture call; a returned word goes
 * to the existing14599 recording tail. Forced capture records a zero byte. */
export function selectOriginalRaceInput(host:NativeRaceInputHost,d:number,forced:number){
 if(forced&65535)return 0;
 let m=host.memory(),view=new DataView(m.buffer,m.byteOffset,m.byteLength);
 if(m[d+0xa3c2]===2){
  const count=view.getUint16(d+0x73b2,true);
  if(view.getUint16(d+0x8fd8,true)>count)view.setUint16(d+0x73b2,(count+1)&65535,true);
  else if(!m[d+0x8ff4]){m[d+0x9aca]=1;host.pauseAudio();host.memory()[d+0x8ff4]=1;}
  return null;
 }
 if(m[d+0x8ff4]||m[d+0x8eac]||m[d+0xa3c2]===1)return 0;
 if(!m[d+0xa42a]&&!m[d+0x7fee]&&view.getUint16(d+0x8c26,true)>80)host.crash(1,0);
 m=host.memory();let input:number;
 const wheel=desktopInputDevice()==='wheel'?getDesktopWheelInput():undefined;
 const wheelActive=!!wheel?.configured&&wheel.connected;
 if(m[d+0x12c]||m[d+0x4602]||wheelActive){
  let target:number;
  if(m[d+0x12c]&&!wheelActive){
   const sample=host.mouse();m=host.memory();view=new DataView(m.buffer,m.byteOffset,m.byteLength);
   view.setUint16(d+0xa77c,sample.x&65535,true);view.setUint16(d+0xa7de,sample.y&65535,true);view.setUint16(d+0x893a,sample.buttons&65535,true);
   target=Math.trunc((((sample.x&65535)-160)<<16>>16)/2)<<24>>24;
   target=Math.abs(target)<16?0:target>0?target-16:target+16;
   m[d+0x5424]=target;input=sample.buttons&1?2:sample.buttons&2?1:0;
  }else{
   m=host.memory();
   if(wheelActive)target=originalWheelSteeringTarget(m,d,wheel.steering);
   else{
    target=host.joystickSteering()<<24>>24;
    if(target>0)target=m[d+0x306c+target];else if(target<0)target=-m[d+0x306c-target];
   }
   m[d+0x5424]=target;
   const controls=host.controls()&0x33;
   if(wheelActive){
    // Wheel calibration is already continuous 0..1. Keep a tiny deadzone for
    // pedal jitter, then record that amount beside the original one-byte input.
    // Brake wins if both pedals are pressed, matching the old binary semantics.
    const throttle=Math.max(0,Math.min(1,wheel.throttle)),brake=Math.max(0,Math.min(1,wheel.brake));
    const brakeActive=brake>.01,throttleActive=throttle>.01;
    if(brakeActive||throttleActive){
     input=(controls&0x30)|(brakeActive?2:1);
     recordAnalogWheelRaceInput(m,d,{throttle:brakeActive?0:throttle,brake:brakeActive?brake:0});
    }else{
     // Keep an explicit zero-valued analog frame. This preserves the distinction
     // between a released wheel pedal and the original keyboard/digital path.
     input=controls&0x30;
     recordAnalogWheelRaceInput(m,d,{throttle:0,brake:0});
    }
   }else input=controls;
  }
  m=host.memory();target=m[d+0x5424];
  view=new DataView(m.buffer,m.byteOffset,m.byteLength);const index=view.getUint16(d+0x73b2,true)&63;
  m[d+0x88e4+index]=target;m[d+0x893c+index]=1;
 }else input=host.controls()&65535;
 if(host.keyDown(30))input|=16;if(host.keyDown(44))input|=32;
 return input;
}
