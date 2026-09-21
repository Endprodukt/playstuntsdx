#!/usr/bin/env node
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {basename,dirname,extname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const OLD_REPLAY_HEADER_BYTES=24;
export const NEW_REPLAY_HEADER_BYTES=26;
export const TRACK_BYTES=0x70a;
export const OLD_INPUT_OFFSET=OLD_REPLAY_HEADER_BYTES+TRACK_BYTES; // 0x722
export const NEW_INPUT_OFFSET=NEW_REPLAY_HEADER_BYTES+TRACK_BYTES; // 0x724
export const OLD_REPLAY_FREQUENCY_HZ=20;

const printableId=bytes=>Array.from(bytes,value=>value>=32&&value<=126?String.fromCharCode(value):'.').join('');
const nulString=bytes=>String.fromCharCode(...bytes).replace(/\0.*$/,'');
const csvCell=value=>{
 const text=String(value??'');
 return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
};
const writeCsv=async(path,rows)=>writeFile(path,rows.map(row=>row.map(csvCell).join(',')).join('\n')+'\n','utf8');

export function detectReplayLayout(bytes,name='replay.rpl'){
 if(bytes.length<OLD_INPUT_OFFSET)throw Error(`${name}: shorter than the minimum Stunts replay header + track block`);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=NEW_INPUT_OFFSET){
  const frequencyHz=view.getUint16(22,true),frameCount=view.getUint16(24,true),required=NEW_INPUT_OFFSET+frameCount;
  if(required===bytes.length)return {format:'new',headerBytes:NEW_REPLAY_HEADER_BYTES,inputOffset:NEW_INPUT_OFFSET,frequencyHz,frameCount};
 }
 const frameCount=view.getUint16(22,true),required=OLD_INPUT_OFFSET+frameCount;
 if(required===bytes.length)return {format:'old',headerBytes:OLD_REPLAY_HEADER_BYTES,inputOffset:OLD_INPUT_OFFSET,frequencyHz:OLD_REPLAY_FREQUENCY_HZ,frameCount};
 const newFrequency=bytes.length>=NEW_REPLAY_HEADER_BYTES?view.getUint16(22,true):null;
 const newCount=bytes.length>=NEW_REPLAY_HEADER_BYTES?view.getUint16(24,true):null;
 throw Error(`${name}: size does not match either known Stunts replay format (old count=${frameCount}, new frequency=${newFrequency}, new count=${newCount}, file=${bytes.length} bytes)`);
}

export function decodeReplayInput(raw){
 raw&=255;
 const drive=raw&3,steering=(raw>>2)&3;
 return {
  raw,
  throttle:drive===1?1:0,
  brake:drive===2?1:0,
  driveConflict:drive===3?1:0,
  steer:steering===1?'right':steering===2?'left':steering===3?'both':'center',
  steerValue:steering===1?1:steering===2?-1:0,
  shiftUp:(raw&0x10)?1:0,
  shiftDown:(raw&0x20)?1:0,
  ignoredMask:raw&0xc0,
 };
}

export function decodeReplayBytes(bytes,name='replay.rpl'){
 const layout=detectReplayLayout(bytes,name);
 const header=bytes.subarray(0,layout.headerBytes);
 const trackBlock=bytes.subarray(layout.headerBytes,layout.inputOffset);
 const track=trackBlock.subarray(0,901),terrain=trackBlock.subarray(901,1802);
 const inputs=bytes.subarray(layout.inputOffset,layout.inputOffset+layout.frameCount);
 const carId=printableId(header.subarray(0,4)),opponentSelected=header[6],opponentCarId=opponentSelected?printableId(header.subarray(7,11)):'';
 const frames=Array.from(inputs,(raw,frame)=>({frame,timeSeconds:frame/layout.frequencyHz,...decodeReplayInput(raw)}));
 const counts={throttle:0,brake:0,coast:0,left:0,right:0,center:0,both:0,shiftUp:0,shiftDown:0,driveConflict:0,ignoredBitFrames:0};
 const rawHistogram={};
 for(const frame of frames){
  if(frame.throttle)counts.throttle++;else if(frame.brake)counts.brake++;else counts.coast++;
  counts[frame.steer]++;
  counts.shiftUp+=frame.shiftUp;counts.shiftDown+=frame.shiftDown;counts.driveConflict+=frame.driveConflict;
  if(frame.ignoredMask)counts.ignoredBitFrames++;
  const key=`0x${frame.raw.toString(16).padStart(2,'0').toUpperCase()}`;rawHistogram[key]=(rawHistogram[key]??0)+1;
 }
 const tileHistogram=values=>Object.fromEntries([...values.slice(0,900).reduce((map,value)=>(map.set(value,(map.get(value)??0)+1),map),new Map())].sort((a,b)=>a[0]-b[0]).map(([id,count])=>[String(id),count]));
 return {
  name,format:layout.format,frequencyHz:layout.frequencyHz,
  header:{
   hex:Buffer.from(header).toString('hex'),
   carId,
   playerColor:header[4],
   playerTransmission:header[5]===1?'automatic':'manual',
   opponentSelected,
   opponentCarId,
   opponentColor:header[11],
   opponentTransmission:header[12]===1?'automatic':'manual',
   trackName:nulString(header.subarray(13,22)),
  },
  frameCount:layout.frameCount,
  recordedInputSeconds:layout.frameCount/layout.frequencyHz,
  track:{grid:Array.from(track.subarray(0,900)),horizon:track[900],histogram:tileHistogram(track)},
  terrain:{grid:Array.from(terrain.subarray(0,900)),trailing:terrain[900],histogram:tileHistogram(terrain)},
  frames,counts,rawHistogram,
 };
}

const gridRows=(values,label)=>{
 const rows=[['row',...Array.from({length:30},(_,i)=>`c${i}`)]];
 for(let row=0;row<30;row++)rows.push([row,...values.slice(row*30,row*30+30)]);
 rows.push([`${label}_byte`,values[900]]);
 return rows;
};
const frameRows=frames=>[
 ['frame','time_s','raw_hex','raw_dec','throttle','brake','drive_conflict','steer','steer_value','shift_up','shift_down','ignored_mask_hex'],
 ...frames.map(frame=>[frame.frame,frame.timeSeconds.toFixed(3),`0x${frame.raw.toString(16).padStart(2,'0').toUpperCase()}`,frame.raw,frame.throttle,frame.brake,frame.driveConflict,frame.steer,frame.steerValue,frame.shiftUp,frame.shiftDown,`0x${frame.ignoredMask.toString(16).padStart(2,'0').toUpperCase()}`]),
];

export async function analyzeReplayFile(path,outputRoot){
 const bytes=new Uint8Array(await readFile(path)),decoded=decodeReplayBytes(bytes,basename(path));
 const stem=basename(path,extname(path)),folder=join(outputRoot,stem);await mkdir(folder,{recursive:true});
 const summary={
  file:decoded.name,sizeBytes:bytes.length,format:decoded.format,frequencyHz:decoded.frequencyHz,header:decoded.header,
  frameCount:decoded.frameCount,recordedInputSeconds:decoded.recordedInputSeconds,counts:decoded.counts,rawHistogram:decoded.rawHistogram,
  track:{horizon:decoded.track.horizon,histogram:decoded.track.histogram},terrain:{trailing:decoded.terrain.trailing,histogram:decoded.terrain.histogram}
 };
 await Promise.all([
  writeFile(join(folder,'summary.json'),JSON.stringify(summary,null,2)+'\n','utf8'),
  writeCsv(join(folder,'frames.csv'),frameRows(decoded.frames)),
  writeCsv(join(folder,'track.csv'),gridRows(decoded.track.grid.concat(decoded.track.horizon),'horizon')),
  writeCsv(join(folder,'terrain.csv'),gridRows(decoded.terrain.grid.concat(decoded.terrain.trailing),'trailing')),
 ]);
 return summary;
}

export async function analyzeReplayDirectory(inputRoot,outputRoot){
 await mkdir(inputRoot,{recursive:true});await mkdir(outputRoot,{recursive:true});
 const entries=await readdir(inputRoot,{withFileTypes:true}),files=entries.filter(entry=>entry.isFile()&&/\.rpl$/i.test(entry.name)).map(entry=>join(inputRoot,entry.name)).sort((a,b)=>a.localeCompare(b));
 if(!files.length)return {inputRoot,outputRoot,replays:[]};
 const replays=[];for(const path of files)replays.push(await analyzeReplayFile(path,outputRoot));
 const manifest={generatedAt:new Date().toISOString(),inputRoot,outputRoot,replays};
 await writeFile(join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');return manifest;
}

async function main(){
 const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const inputRoot=process.argv[2]?resolve(process.argv[2]):join(repoRoot,'training','replays','input');
 const outputRoot=process.argv[3]?resolve(process.argv[3]):join(repoRoot,'training','replays','output');
 const result=await analyzeReplayDirectory(inputRoot,outputRoot);
 if(!result.replays.length){console.log(`No .RPL files found in ${inputRoot}`);console.log('Copy one or more replay files there and run this command again.');return;}
 console.log(`Analyzed ${result.replays.length} replay(s).`);
 for(const replay of result.replays){
  console.log(`${replay.file}: ${replay.format} format, ${replay.frequencyHz} Hz, ${replay.frameCount} frames (${replay.recordedInputSeconds.toFixed(2)} s), track ${replay.header.trackName}, car ${replay.header.carId}${replay.header.opponentSelected?`, opponent ${replay.header.opponentSelected} / ${replay.header.opponentCarId}`:''}`);
  console.log(`  throttle ${replay.counts.throttle}, brake ${replay.counts.brake}, left ${replay.counts.left}, right ${replay.counts.right}, shifts +${replay.counts.shiftUp}/-${replay.counts.shiftDown}`);
 }
 console.log(`Output: ${outputRoot}`);
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
}
