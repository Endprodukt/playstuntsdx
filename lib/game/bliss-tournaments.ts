// Bliss tournament protocol parser.
// The protocol is documented in the Bliss 2.5.8/2.6 manuals and uses simple
// property=value configuration files.
export interface BlissTournamentRace {
 tournament:string;
 trackTitle:string;
 trackAuthor:string;
 trackFile:string;
 deadline:string;
 scoreboard:string;
 properties:Record<string,string>;
}
export interface BlissScoreboardEntry {
 number:string;
 name:string;
 lapTime:string;
 lapLength:string;
 car:string;
 carId:string;
 handicap:string;
 style:string;
 verified:boolean;
 properties:Record<string,string>;
}

const decoder=new TextDecoder();

export function parseBlissProperties(source:string|Uint8Array){
 const text=typeof source==='string'?source:decoder.decode(source);
 const properties:Record<string,string>={};
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r\n|\n\r|\r|\n/)){
  const line=raw.trim();if(!line||line.startsWith('#')||line.startsWith(';'))continue;
  const equals=line.indexOf('=');if(equals<0)continue;
  const key=line.slice(0,equals).trim().toLowerCase(),value=line.slice(equals+1).trim();
  if(key)properties[key]=value;
 }
 return properties;
}

export function parseBlissTournamentConfig(source:string|Uint8Array):BlissTournamentRace{
 const p=parseBlissProperties(source);
 return {
  tournament:p.tour??'',
  trackTitle:p.tracktitle??'',
  trackAuthor:p.trackauthor??'',
  trackFile:p.trackfile??'',
  deadline:p.deadline??'',
  scoreboard:p.scoreboard??'',
  properties:p,
 };
}

export function parseBlissScoreboard(source:string|Uint8Array):BlissScoreboardEntry[]{
 const text=typeof source==='string'?source:decoder.decode(source),entries:BlissScoreboardEntry[]=[];
 let number='',properties:Record<string,string>|null=null;
 const push=()=>{
  if(!properties)return;
  if((properties.competing??'').toLowerCase()==='no'){properties=null;return;}
  entries.push({
   number,
   name:properties.name??'',
   lapTime:properties.laptime??'',
   lapLength:properties.lap??'',
   car:properties.car??'',
   carId:properties.carid??'',
   handicap:properties.handicap??'',
   style:properties.style??'',
   verified:(properties.status??'').toLowerCase()==='verified',
   properties,
  });properties=null;
 };
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r\n|\n\r|\r|\n/)){
  const line=raw.trim();if(!line)continue;
  const section=line.match(/^\[([^\]]*)\]$/);
  if(section){push();number=section[1]??'';properties={};continue;}
  if(!properties)continue;
  const equals=line.indexOf('=');if(equals<0)continue;
  properties[line.slice(0,equals).trim().toLowerCase()]=line.slice(equals+1).trim();
 }
 push();return entries;
}

export function blissTournamentUrl(base:string,relative:string){
 const root=base.endsWith('/')?base:base+'/';
 return new URL(relative,root).toString();
}
