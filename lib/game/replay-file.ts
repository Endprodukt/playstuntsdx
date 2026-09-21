import {decodeTrackFile,encodeTrackFile} from './track-file.ts';

export type OriginalReplayFormat='old24'|'new26';
export interface OriginalReplayLayout {
 format:OriginalReplayFormat;
 headerBytes:24|26;
 inputOffset:number;
 frequencyHz:number;
 frameCount:number;
}

/** Detect the two replay layouts seen in original/community Stunts recordings.
 * old24: 24-byte header/configuration, track at 0x18, inputs at 0x722; word22=count.
 * new26: the same 24-byte configuration followed by a separate count word;
 *        word22=playback frequency, track at 0x1a, inputs at 0x724.
 */
export function detectOriginalReplayLayout(bytes:Uint8Array):OriginalReplayLayout{
 if(bytes.length<0x722)throw Error('Original replay file is shorter than its header and track');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const oldCount=view.getUint16(22,true),oldRequired=0x722+oldCount;
 if(bytes.length>=0x724){
  const frequency=view.getUint16(22,true),count=view.getUint16(24,true),required=0x724+count;
  // Real 26-byte recordings use a simulation frequency here (normally20).
  // Exact-size matches are strongest; plausible frequencies also permit a
  // retained trailing block for inspection without confusing ordinary old files.
  if(required===bytes.length||((frequency===10||frequency===20)&&required<=bytes.length&&oldRequired>bytes.length)){
   return {format:'new26',headerBytes:26,inputOffset:0x724,frequencyHz:frequency,frameCount:count};
  }
 }
 if(oldRequired<=bytes.length)return {format:'old24',headerBytes:24,inputOffset:0x722,frequencyHz:20,frameCount:oldCount};
 if(bytes.length>=0x724){
  const frequency=view.getUint16(22,true),count=view.getUint16(24,true),required=0x724+count;
  if((frequency===10||frequency===20)&&required<=bytes.length)return {format:'new26',headerBytes:26,inputOffset:0x724,frequencyHz:frequency,frameCount:count};
 }
 throw Error('Original replay file is shorter than its declared input history');
}

/** Supplied/community replay loader. The returned header is always the 24-byte
 * race configuration block expected by native memory; layout metadata tells the
 * caller where the embedded track and input stream came from.
 */
export function decodeOriginalReplayFile(bytes:Uint8Array){
 const layout=detectOriginalReplayLayout(bytes);
 const header=bytes.slice(0,24);
 const trackStart=layout.headerBytes,trackEnd=trackStart+0x70a;
 if(trackEnd!==layout.inputOffset)throw Error('Original replay layout has an invalid track boundary');
 const required=layout.inputOffset+layout.frameCount;
 if(bytes.length<required)throw Error('Original replay file is shorter than its declared input history');
 return {
  format:layout.format,
  frequencyHz:layout.frequencyHz,
  header,
  track:decodeTrackFile(bytes.slice(trackStart,trackEnd)),
  inputs:bytes.slice(layout.inputOffset,required),
  trailing:bytes.slice(required),
 };
}

export function encodeOriginalReplayFile(replay:ReturnType<typeof decodeOriginalReplayFile>){
 if(replay.header.length!==24)throw Error('Original replay header must contain24 bytes');
 if(replay.inputs.length>65535)throw Error('Original replay frame count exceeds a word');
 if(replay.format==='new26'){
  const output=new Uint8Array(0x724+replay.inputs.length);
  output.set(replay.header);
  const view=new DataView(output.buffer);
  view.setUint16(22,replay.frequencyHz||20,true);
  view.setUint16(24,replay.inputs.length,true);
  output.set(encodeTrackFile(replay.track),26);
  output.set(replay.inputs,0x724);
  return output;
 }
 const output=new Uint8Array(0x722+replay.inputs.length);
 output.set(replay.header);
 new DataView(output.buffer).setUint16(22,replay.inputs.length,true);
 output.set(encodeTrackFile(replay.track),24);
 output.set(replay.inputs,0x722);
 return output;
}
