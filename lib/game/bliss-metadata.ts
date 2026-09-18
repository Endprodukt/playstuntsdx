// Stunts Metadata Format support as used by Bliss 2.6.1.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';

export const BLISS_TRANSPARENT_COLOUR=0xF81F;
export interface BlissMetadataColours {
 border:Uint16Array;
 background:Uint16Array;
}
export interface BlissMetadata {
 title:string;author:string;comment:string;championship:string;
 year:number;month:number;day:number;
 tool:string;toolVersion:number;editingTime:number;
 colours?:BlissMetadataColours;
}
export type BlissMetadataFormat='binary'|'text';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const emptyMetadata=():BlissMetadata=>({title:'',author:'',comment:'',championship:'',year:0,month:0,day:0,tool:'',toolVersion:0,editingTime:-1});
const ascii=(bytes:Uint8Array)=>String.fromCharCode(...bytes);
const writeU16=(target:number[],value:number)=>{target.push(value&255,(value>>>8)&255);};
const writeI16=writeU16;
const writeU32=(target:number[],value:number)=>{target.push(value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255);};
const pushBytes=(target:number[],bytes:ArrayLike<number>)=>{for(let i=0;i<bytes.length;i++)target.push(bytes[i]);};

function versionFromText(value:string){
 const parts=value.trim().split('.').slice(0,3).map(part=>Number.parseInt(part,10)||0);
 return (parts[0]??0)*10000+(parts[1]??0)*100+(parts[2]??0);
}
function versionToText(value:number){
 const major=Math.floor(value/10000),minor=Math.floor((value%10000)/100),patch=value%100;
 return patch?major+'.'+minor+'.'+patch:minor?major+'.'+minor:String(major);
}
function parseDate(value:string,meta:BlissMetadata){
 const parts=value.trim().split('-');meta.year=Math.min(3000,Math.max(1900,Number.parseInt(parts[0]??'',10)||1900));
 meta.month=Math.min(12,Math.max(0,Number.parseInt(parts[1]??'',10)||0));
 meta.day=Math.min(31,Math.max(0,Number.parseInt(parts[2]??'',10)||0));
}

export function decodeBlissMetadata(bytes:Uint8Array):{format:BlissMetadataFormat;metadata:BlissMetadata}|null{
 if(bytes.length<6)return null;
 const meta=emptyMetadata();
 if(ascii(bytes.subarray(0,4))==='smdf'){
  if(bytes.length<8)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=8;
  while(at+6<=bytes.length){
   const key=ascii(bytes.subarray(at,at+4)),length=view.getInt16(at+4,true);at+=6;
   if(length<=0||at+length>bytes.length)break;
   const field=bytes.subarray(at,at+length);at+=length;
   if(key==='Titl')meta.title=decoder.decode(field);
   else if(key==='Autr')meta.author=decoder.decode(field);
   else if(key==='Comm')meta.comment=decoder.decode(field);
   else if(key==='Chmp')meta.championship=decoder.decode(field);
   else if(key==='Date'&&length===4){const v=new DataView(field.buffer,field.byteOffset,field.byteLength);meta.year=v.getInt16(0,true);meta.month=field[2];meta.day=field[3];}
   else if(key==='Tool'&&length>4){const nameLength=length-4,v=new DataView(field.buffer,field.byteOffset,field.byteLength);meta.tool=decoder.decode(field.subarray(0,nameLength));meta.toolVersion=v.getUint32(nameLength,true);}
   else if(key==='Etim'&&length===4){meta.editingTime=new DataView(field.buffer,field.byteOffset,field.byteLength).getInt32(0,true);}
   else if(key==='Colr'){
    const border=new Uint16Array(900),background=new Uint16Array(900);border.fill(BLISS_TRANSPARENT_COLOUR);background.fill(BLISS_TRANSPARENT_COLOUR);const v=new DataView(field.buffer,field.byteOffset,field.byteLength);let p=0,cell=0;
    while(p+5<=field.length&&cell<900){const count=field[p++],b=v.getUint16(p,true),g=v.getUint16(p+2,true);p+=4;for(let i=0;i<count&&cell<900;i++,cell++){border[cell]=b;background[cell]=g;}}
    meta.colours={border,background};
   }
  }
  return {format:'binary',metadata:meta};
 }
 const text=decoder.decode(bytes).replace(/^\uFEFF/,'');
 if(!/^\[smdf\](?:\r\n|\n\r|\r|\n)/i.test(text))return null;
 for(const raw of text.split(/\r\n|\n\r|\r|\n/)){
  const equals=raw.indexOf('=');if(equals<0)continue;
  const key=raw.slice(0,equals).trim().toLowerCase(),value=raw.slice(equals+1).trimStart();
  if(key==='title'||key==='titl')meta.title=value.slice(0,64);
  else if(key==='author'||key==='autr')meta.author=value.slice(0,64);
  else if(key==='comment'||key==='comm')meta.comment=value.slice(0,64);
  else if(key==='tour_info'||key==='chmp')meta.championship=value.slice(0,64);
  else if(key==='creation_date'||key==='date')parseDate(value,meta);
  else if(key==='tool')meta.tool=value.slice(0,64);
  else if(key==='tool_version')meta.toolVersion=versionFromText(value);
  else if(key==='editing_time'||key==='etim')meta.editingTime=Number.parseInt(value,10)||0;
 }
 return {format:'text',metadata:meta};
}

function binaryField(target:number[],key:string,data:Uint8Array){
 pushBytes(target,encoder.encode(key));writeI16(target,data.length);pushBytes(target,data);
}
export function encodeBlissMetadata(metadata:BlissMetadata,format:BlissMetadataFormat='binary',defaults:{tool?:string;toolVersion?:number}={}){
 const tool=metadata.tool||defaults.tool||'PlayStunts DX',toolVersion=metadata.toolVersion||defaults.toolVersion||100;
 if(format==='text'){
  const lines=['[smdf]'];
  if(metadata.title)lines.push('title='+metadata.title);
  if(metadata.author)lines.push('author='+metadata.author);
  if(metadata.comment)lines.push('comment='+metadata.comment);
  if(metadata.championship)lines.push('tour_info='+metadata.championship);
  if(metadata.year)lines.push('creation_date='+metadata.year+'-'+metadata.month+'-'+metadata.day);
  lines.push('tool='+tool,'tool_version='+versionToText(toolVersion));
  if(metadata.editingTime>=0)lines.push('editing_time='+Math.trunc(metadata.editingTime));
  return encoder.encode(lines.join('\r\n')+'\r\n');
 }
 const output:number[]=[];pushBytes(output,encoder.encode('smdf'));writeU32(output,0);
 if(metadata.title)binaryField(output,'Titl',encoder.encode(metadata.title));
 if(metadata.author)binaryField(output,'Autr',encoder.encode(metadata.author));
 if(metadata.comment)binaryField(output,'Comm',encoder.encode(metadata.comment));
 if(metadata.championship)binaryField(output,'Chmp',encoder.encode(metadata.championship));
 if(metadata.year){
  const data:number[]=[];writeI16(data,metadata.year);data.push(metadata.month&255,metadata.day&255);binaryField(output,'Date',Uint8Array.from(data));
 }
 {
  const name=encoder.encode(tool),data:number[]=[];pushBytes(data,name);writeU32(data,toolVersion);binaryField(output,'Tool',Uint8Array.from(data));
 }
 if(metadata.editingTime>=0){const data:number[]=[];writeU32(data,Math.trunc(metadata.editingTime)>>>0);binaryField(output,'Etim',Uint8Array.from(data));}
 if(metadata.colours){
  if(metadata.colours.border.length!==900||metadata.colours.background.length!==900)throw Error('Bliss metadata colour layers must contain 900 cells');
  let any=false;for(let i=0;i<900;i++)if(metadata.colours.border[i]!==BLISS_TRANSPARENT_COLOUR||metadata.colours.background[i]!==BLISS_TRANSPARENT_COLOUR){any=true;break;}
  if(any){
   const data:number[]=[];let at=0;
   while(at<900){
    const border=metadata.colours.border[at],background=metadata.colours.background[at];let count=1;
    while(at+count<900&&count<255&&metadata.colours.border[at+count]===border&&metadata.colours.background[at+count]===background)count++;
    data.push(count);writeU16(data,border);writeU16(data,background);at+=count;
   }
   binaryField(output,'Colr',Uint8Array.from(data));
  }
 }
 return Uint8Array.from(output);
}

export function blissTrackMetadata(source:BlissTrack){return source.overlay.length?decodeBlissMetadata(source.overlay):null;}
export function setBlissTrackMetadata(source:BlissTrack,metadata:BlissMetadata|null,format:BlissMetadataFormat='binary'){
 source.overlay=metadata?encodeBlissMetadata(metadata,format):new Uint8Array();
}
