import {ORIGINAL_PIT_DIVISOR,PC_PIT_INPUT_HZ} from './timer-interrupt.ts';
import type {createNativeMusic} from './native-music.ts';
import {nativeMusicScores,type NativeMusicScore} from './native-music-score.ts';
import {cancelAndHoldAudioParam} from './audio-param-automation.ts';

const REMIX_ROOT='/audio/remixed';
const SCHEDULE_LEAD=.015;
const SWITCH_FADE=.012;
const secondsPerIrq=ORIGINAL_PIT_DIVISOR/PC_PIT_INPUT_HZ;
const remixPaths:Record<NativeMusicScore,string>={
 titl:`${REMIX_ROOT}/titl.mp3`,
 slct:`${REMIX_ROOT}/slct.mp3`,
 vict:`${REMIX_ROOT}/vict.mp3`,
 over:`${REMIX_ROOT}/over.mp3`,
};

export const remixedMusicTiming:Record<NativeMusicScore,{cueOffset:number;loopDuration:number}>={
 titl:{cueOffset:.05,loopDuration:2394*secondsPerIrq},
 slct:{cueOffset:.85,loopDuration:4788*secondsPerIrq},
 vict:{cueOffset:.55,loopDuration:2580*secondsPerIrq},
 over:{cueOffset:.5,loopDuration:3032*secondsPerIrq},
};

type OriginalMusic=Awaited<ReturnType<typeof createNativeMusic>>;
export type SynchronizedRemixedMusic=ReturnType<typeof createSynchronizedRemixedMusic>;

let encodedMusic:Promise<Record<NativeMusicScore,ArrayBuffer>>|undefined;
export function preloadRemixedMusicFiles(){
 encodedMusic??=Promise.all(nativeMusicScores.map(async name=>{
  const response=await fetch(remixPaths[name],{cache:'force-cache'});
  if(!response.ok)throw Error(`Remixed score failed to load: ${name}`);
  return [name,await response.arrayBuffer()] as const;
 })).then(entries=>Object.fromEntries(entries) as Record<NativeMusicScore,ArrayBuffer>).catch(error=>{encodedMusic=undefined;throw error;});
 return encodedMusic;
}

export async function decodeRemixedMusic(context:AudioContext){
 const encoded=await preloadRemixedMusicFiles();
 const entries=await Promise.all(nativeMusicScores.map(async name=>[name,await context.decodeAudioData(encoded[name].slice(0))] as const));
 return Object.fromEntries(entries) as Record<NativeMusicScore,AudioBuffer>;
}

export function createSynchronizedRemixedMusic(context:AudioContext,original:OriginalMusic,buffers:Record<NativeMusicScore,AudioBuffer>,initiallyEnabled=false){
 const gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
 let enabled=initiallyEnabled,closed=false,paused=false,current:NativeMusicScore|undefined,source:AudioBufferSourceNode|undefined;
 let position=0,startedAt=0,generation=0;
 const level=(value:number,at=context.currentTime,fade=0)=>{
  if(closed)return;const parameter=gain.gain;
  cancelAndHoldAudioParam(parameter,at);
  if(fade>0)parameter.linearRampToValueAtTime(value,at+fade);else parameter.setValueAtTime(value,at);
 };
 const release=()=>{if(!source)return;source.onended=null;try{source.stop();}catch{}source.disconnect();source.buffer=null;source=undefined;};
 const offsetAt=(at=context.currentTime)=>{
  if(!current)return 0;
  const duration=remixedMusicTiming[current].loopDuration;
  return ((position+(source?Math.max(0,at-startedAt):0))%duration+duration)%duration;
 };
 const begin=(name:NativeMusicScore,offset:number,at:number)=>{
  release();const buffer=buffers[name],timing=remixedMusicTiming[name],next=context.createBufferSource();
  if(timing.cueOffset+timing.loopDuration>buffer.duration)throw Error(`Remixed score is shorter than the original loop: ${name}`);
  next.buffer=buffer;next.loop=true;next.loopStart=timing.cueOffset;next.loopEnd=timing.cueOffset+timing.loopDuration;next.connect(gain);source=next;
  position=((offset%timing.loopDuration)+timing.loopDuration)%timing.loopDuration;startedAt=at;next.start(at,timing.cueOffset+position);
 };
 const stop=()=>{generation++;release();current=undefined;position=0;original.stop();};
 const control=(operation:Parameters<OriginalMusic['control']>[0])=>{
  const at=context.currentTime;
  if(operation==='pause-audio'&&current&&!paused){position=offsetAt(at);release();paused=true;level(0,at,SWITCH_FADE);}
  const result=original.control(operation);
  if(operation==='resume-audio'&&current&&paused){
   paused=false;
   if(original.settings.musicEnabled){const start=at+SCHEDULE_LEAD;begin(current,position,start);level(enabled?1:0,start);original.setOutputMuted(enabled,start);}
  }
  else if(operation==='toggle-music'){
   generation++;release();position=0;paused=original.settings.paused;level(0,at,SWITCH_FADE);
   if(original.settings.musicEnabled&&current){
    original.setOutputMuted(enabled);original.play(current);
    if(!paused){const start=at+SCHEDULE_LEAD;begin(current,0,start);level(enabled?1:0,start);original.setOutputMuted(enabled,start);}
   }else original.setOutputMuted(enabled,at,SWITCH_FADE);
  }
  return result;
 };
 const setEnabled=(next:boolean)=>{
  if(closed||enabled===next)return;enabled=next;const at=context.currentTime;
  original.setOutputMuted(enabled,at,SWITCH_FADE);level(enabled&&!!current&&!paused&&original.settings.musicEnabled?1:0,at,SWITCH_FADE);
 };
 original.setOutputMuted(enabled);
 return {
  control,setEnabled,setOutputMuted:original.setOutputMuted,fadeTicks:original.fadeTicks,get enabled(){return enabled;},get settings(){return original.settings;},
  play(name:NativeMusicScore){
   if(closed)return;generation++;release();current=name;position=0;paused=original.settings.paused;
   original.setOutputMuted(enabled);original.play(name);if(!original.settings.musicEnabled){level(0);return;}
   const start=context.currentTime+SCHEDULE_LEAD;if(!paused)begin(name,0,start);level(enabled&&!paused?1:0,start);original.setOutputMuted(enabled,start);
  },
  async fadeOut(waitTicks:(ticks:number)=>Promise<void>){
   if(closed)return;const owner=++generation,at=context.currentTime;
   if(enabled&&source){const ticksPerSecond=PC_PIT_INPUT_HZ/ORIGINAL_PIT_DIVISOR;level(0,at,original.fadeTicks/ticksPerSecond);}
   await original.fadeOut(waitTicks);if(closed||owner!==generation)return;release();current=undefined;position=0;
  },
  stop,
  close(){if(closed)return;closed=true;generation++;release();gain.disconnect();original.close();},
 };
}
