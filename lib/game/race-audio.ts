import {impactAudioRuntime} from './impact-audio-runtime.ts';
import {stopEngineRuntime} from './engine-runtime-stop.ts';
import {resetAudio} from './audio-reset.ts';
import type {RaceAudioRequest} from './produce-race-audio.ts';
import {startCrashRuntime} from './crash-runtime.ts';
import {setEffectsEnabled} from './effect-mute.ts';
import {exitRaceAudio} from './race-audio-exit.ts';
import type {DrivingAudioExitState} from './driving-audio-exit.ts';
import {startEngineRuntime,type EngineRuntimeStartState} from './engine-runtime-start.ts';
import {stepCarAudioInterrupt} from './engine-interrupt.ts';
import {updateDrivingSoundRuntime} from './driving-sound-runtime.ts';
import {updateSkidRuntime} from './skid-runtime.ts';
import {updateCarAudioTarget} from './car-audio-target.ts';
import type {LoadedEffectResource} from './effect-runtime.ts';
import type {Vector} from '../physics/math.ts';
import {adlibInstrument} from './adlib.ts';
export type RaceAudioState=Omit<EngineRuntimeStartState,'car'>&{cars:Uint8Array[];markers:Uint8Array;busy:number[];carCounter:number;soundFlags:number[]};
/** Car-handle operations over one original driver, timer pool and voice pool.
 * The caller owns allocation and the original ordering of game requests.
 */
export function createRaceAudio(before:RaceAudioState,resources:LoadedEffectResource[],enabled=true,master=127,engineOverrides:ReadonlyMap<number,Uint8Array>=new Map()){
 let state=structuredClone(before);
 const runtimeResources=[...resources];
 const carAt=(handle:number)=>{const car=state.cars[handle];if(!car)throw Error('Missing original car audio handle');return car;};
 const instrumentAt=(car:Uint8Array,handle?:number)=>{
  if(handle!==undefined){const overridden=engineOverrides.get(handle);if(overridden?.length>=100)return overridden;}
  const v=new DataView(car.buffer,car.byteOffset,car.byteLength),offset=v.getUint16(0x24,true),segment=v.getUint16(0x26,true);
  const resource=runtimeResources.find(r=>r.instrumentOffset===offset&&r.instrumentSegment===segment);
  if(!resource)throw Error('Missing original car engine instrument');return resource.instrument;
 };
 const apply=(handle:number,next:Omit<EngineRuntimeStartState,'command'>&{command?:Uint8Array;writes:number[][]})=>{
  const cars=state.cars.slice();cars[handle]=next.car;
  const {car:_,writes,...shared}=next;
  state={...state,...shared,cars,soundFlags:state.soundFlags};return writes;
 };
 return {
  setEnabled(value:boolean,savedVolumes:Uint8Array){
   const next=setEffectsEnabled({...state,enabled:enabled?1:0,savedVolumes},value,(offset,segment)=>{
    const resource=runtimeResources.find(r=>r.instrumentOffset===offset&&r.instrumentSegment===segment);
    if(!resource)throw Error('Missing original mute instrument');return resource.instrument;
   });
   const {writes,savedVolumes:restored,enabled:nextEnabled,...audio}=next;
   state={...state,...audio};enabled=nextEnabled===1;return {writes,savedVolumes:restored,enabled:nextEnabled};
  },
  start(handle:number){const car=carAt(handle);return apply(handle,startEngineRuntime({...state,car},instrumentAt(car,handle)));},
  patchEngineInstrument(handle:number){
   const car=carAt(handle),instrument=instrumentAt(car,handle),writes:number[][]=[];
   // The engine start stores the allocated hardware voice index directly in
   // the car record at +0x12. Use that instead of guessing from voice.owner.
   const carView=new DataView(car.buffer,car.byteOffset,car.byteLength),voiceIndex=carView.getUint16(0x12,true);
   const voice=state.voices[voiceIndex];
   if(!voice)return writes;
   const logicalChannel=voice[0x2c],channel=logicalChannel-1;
   if(channel>=0&&channel<=8)writes.push(...adlibInstrument(Array.from(instrument),channel,state.timers[handle]));
   return writes;
  },
  impacts(handle:number,flags:number,active:boolean){return apply(handle,impactAudioRuntime({...state,car:carAt(handle)},flags,active,runtimeResources,enabled,master));},
  crash(handle:number){return apply(handle,startCrashRuntime({...state,car:carAt(handle)},runtimeResources,enabled,master));},
  skid(handle:number,variant:1|2|'stop'){return apply(handle,updateSkidRuntime({...state,car:carAt(handle)},variant,runtimeResources,enabled,master));},
  driveSounds(handle:number,flags:number){
   const next=updateDrivingSoundRuntime({...state,car:carAt(handle),soundFlags:state.soundFlags[handle]??0},flags,runtimeResources,enabled,master);
   const previousFlags=state.soundFlags.slice();previousFlags[handle]=next.soundFlags;
   const writes=apply(handle,next);state.soundFlags=previousFlags;return writes;
  },
  update(handle:number,rpm:number,previous:Vector,current:Vector,interval:number){
   const car=carAt(handle),instrument=instrumentAt(car,handle),cars=state.cars.slice();
   cars[handle]=updateCarAudioTarget(car,rpm,previous,current,interval,instrument[14],instrument[15]);state={...state,cars};
  },
  tick(){
   const next=stepCarAudioInterrupt({...state,car:carAt(0)},runtimeResources,enabled,master,(handle)=>engineOverrides.get(handle));
   state={...state,...next};return next.writes;
  },
  exit(queue:DrivingAudioExitState){
   const {audio,queue:nextQueue}=exitRaceAudio({...state,paused:0},queue,runtimeResources,enabled,master);
   const {writes,...next}=audio;state=next;return {writes,queue:nextQueue};
  },
  /** Execute already-decoded producer requests once, preserving their order.
   * The supplied final flags are indexed by original car handle and come from
   * the producer memory, so replay exit does not recompute transitions.
   */
  dispatchRequests(requests:readonly RaceAudioRequest[],soundFlags:readonly number[]){
   const writes:number[][]=[];
   for(const request of requests){
    if(request.kind==='reset'){
     const {writes:resetWrites,...next}=resetAudio({...state,paused:0});state={...state,...next};writes.push(...resetWrites);continue;
    }
    if(request.handle===undefined)throw Error('Missing original audio request handle');
    const handle=request.handle,car=carAt(handle);
    if(request.kind==='engine-start')writes.push(...apply(handle,startEngineRuntime({...state,car},instrumentAt(car,handle))));
    else if(request.kind==='engine-stop')writes.push(...apply(handle,stopEngineRuntime({...state,car})));
    else writes.push(...apply(handle,updateSkidRuntime({...state,car},request.kind==='skid-start'?1:request.kind==='skid2-start'?2:'stop',runtimeResources,enabled,master)));
   }
   state.soundFlags=[...soundFlags];return writes;
  },
  snapshot(){return structuredClone(state);},
 };
}
