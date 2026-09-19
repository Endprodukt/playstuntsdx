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


export function isZakStuntsTournament(url:string){
 try{
  const host=new URL(url).hostname.toLowerCase();
  return host==='zak.stunts.hu'||host.endsWith('.zak.stunts.hu');
 }catch{return false;}
}

export function parseZakStuntsCurrentRace(source:string|Uint8Array):BlissTournamentRace{
 const html=typeof source==='string'?source:decoder.decode(source);
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 const id=/Currently racing on\s+(ZCT\d+)/i.exec(text)?.[1]?.toUpperCase()??'';
 if(!id)throw Error('ZakStunts did not publish a current ZCT race');
 const title=/Currently racing on\s+ZCT\d+\s+(.+?)\s+Designed by\s+/i.exec(text)?.[1]?.trim()??id;
 const author=/Designed by\s+(.+?)\s+Race ends in\s+/i.exec(text)?.[1]?.trim()??'';
 const deadline=/Race ends in\s+(.+?)(?:\s+Download track|\s+View map)/i.exec(text)?.[1]?.trim()??'';
 return {
  tournament:'ZakStunts',
  trackTitle:title,
  trackAuthor:author,
  trackFile:`tracks/${id}.trk`,
  deadline,
  scoreboard:`tracks/${id}`,
  properties:{source:'zakstunts',race:id},
 };
}

export function parseZakStuntsScoreboard(source:string|Uint8Array):BlissScoreboardEntry[]{
 const html=typeof source==='string'?source:decoder.decode(source);
 if(typeof DOMParser==='undefined')return [];
 const doc=new DOMParser().parseFromString(html,'text/html'),rows=Array.from(doc.querySelectorAll('table tr'));
 const entries:BlissScoreboardEntry[]=[];
 let inMain=false;
 for(const row of rows){
  const cells=Array.from(row.querySelectorAll('th,td')).map(cell=>(cell.textContent??'').replace(/\s+/g,' ').trim());
  if(!cells.length)continue;
  const joined=cells.join(' | ');
  if(/\bPos\b/i.test(joined)&&/\bName\b/i.test(joined)&&/\bTime\b/i.test(joined)&&/\bCar\b/i.test(joined)){inMain=true;continue;}
  if(!inMain)continue;
  const pos=cells[0]??'';
  if(!/^\d+$/.test(pos))continue;
  const time=(cells.find(value=>/^\d+:\d{2}\.\d{2}/.test(value))??'').replace(/\s*\([^)]*\)\s*$/,'');
  const name=cells[1]??'';
  const carIndex=cells.findIndex((value,index)=>index>1&&/^[A-Za-z].+/.test(value)&&index>=5);
  const car=carIndex>=0?cells[carIndex]:'';
  entries.push({number:pos,name,lapTime:time,lapLength:'',car,carId:'',handicap:'',style:'',verified:false,properties:{}});
 }
 return entries;
}
