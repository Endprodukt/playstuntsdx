// Automatic scenery generation ported from Bliss 2.6.1 Menu_Scenery.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {cloneBlissTrack} from './bliss-track.ts';

export type BlissSceneryPlacement='everywhere'|'by-road'|'on-water';
export interface BlissSceneryRule {
 name:string;
 baseCode:number;
 percent:number;
 placement:BlissSceneryPlacement;
}
export interface BlissSceneryGeneratorConfig {
 eraseExisting:boolean;
 rules:readonly BlissSceneryRule[];
 random?:()=>number;
}
export interface BlissSceneryAvailability {openfield:number;water:number;byRoad:number}

export const BLISS_SCENERY_GROUPS=Object.freeze([
 {name:'Pine tree',baseCode:0x99,ship:false},
 {name:'Cactus',baseCode:0x98,ship:false},
 {name:'Palm tree',baseCode:0x97,ship:false},
 {name:'Tennis court',baseCode:0x9a,ship:false},
 {name:'Office building',baseCode:0xa3,ship:false},
 {name:'Barn',baseCode:0x9f,ship:false},
 {name:'Gas station',baseCode:0x9b,ship:false},
 {name:'Windmill',baseCode:0xa7,ship:false},
 {name:"Joe's diner",baseCode:0xaf,ship:false},
 {name:'Ship',baseCode:0xab,ship:true},
] as const);

const index=(x:number,y:number)=>y*30+x;
const isScenery=(code:number)=>code>=0x97&&code<=0xb2;
const isRoadCode=(code:number)=>(code>0&&code<0x97)||code>=0xfd;
const randomIndex=(length:number,random:()=>number)=>Math.max(0,Math.min(length-1,Math.floor(random()*length)));

function sourceForAvailability(source:BlissTrack,eraseExisting:boolean){
 const result=cloneBlissTrack(source);
 if(eraseExisting)for(let i=0;i<900;i++)if(isScenery(result.track[i]))result.track[i]=0;
 return result;
}

/** Bliss classifies every free cell once before generation:
 *  -1 unavailable, 1 open field, 2 water, 10..13 by-road with orientation. */
function blissSceneryMap(source:BlissTrack,eraseExisting:boolean){
 const track=sourceForAvailability(source,eraseExisting),map=new Int16Array(900);
 map.fill(-1);
 let openfield=0,water=0,byRoad=0;
 const neighbour=[[0,1],[0,-1],[1,0],[-1,0]] as const; // source order: S,N,E,W
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){
  const at=index(x,y),land=track.terrain[at],code=track.track[at];
  if(land>=1&&land<=5){
   if(code===0){map[at]=2;water++;}
   continue;
  }
  if(land>=7)continue;
  if(code!==0)continue;
  let direction=-1;
  for(let n=0;n<4;n++){
   const nx=x+neighbour[n][0],ny=y+neighbour[n][1];
   if(nx<0||nx>=30||ny<0||ny>=30)continue;
   if(isRoadCode(track.track[index(nx,ny)])){direction=n;break;}
  }
  if(direction>=0){map[at]=10+direction;byRoad++;}
  else{map[at]=1;openfield++;}
 }
 return {track,map,availability:{openfield,water,byRoad} satisfies BlissSceneryAvailability};
}

export function blissSceneryAvailability(source:BlissTrack,eraseExisting=false){
 return blissSceneryMap(source,eraseExisting).availability;
}

/** FreeBASIC rounds floating -> integer assignment. Menu_Scenery then subtracts
 * one before its inclusive For 1 To amount loop. Keep that exact quirk. */
export function blissSceneryTargetCount(available:number,percent:number){
 return Math.max(0,Math.round(available*Math.max(0,Math.min(100,percent))/100)-1);
}

/** Exact defaults and ordering from Bliss 2.6.1 Menu_Scenery. */
export function blissSceneryDefaults(landscape:number):BlissSceneryRule[]{
 const percent=Array(10).fill(0) as number[];
 switch(Math.max(0,Math.min(4,landscape))){
  case 0: percent[1]=20;percent[6]=5;break; // Desert
  case 1: percent[2]=20;percent[4]=7;percent[6]=6;percent[8]=3;percent[9]=10;break; // Tropical
  case 2: percent[0]=20;percent[4]=5;percent[5]=8;break; // Alpine
  case 3: percent[0]=15;percent[4]=15;percent[6]=7;percent[8]=9;percent[9]=10;percent[3]=2;break; // City
  case 4: percent[0]=15;percent[3]=5;percent[5]=7;percent[6]=3;percent[7]=8;percent[9]=5;break; // Country
 }
 return BLISS_SCENERY_GROUPS.map((group,i)=>({
  name:group.name,baseCode:group.baseCode,percent:percent[i],
  placement:i<3?'everywhere':group.ship?'on-water':'by-road',
 }));
}

const chooseAndRemove=(cells:number[],random:()=>number)=>{
 if(!cells.length)return -1;
 const which=randomIndex(cells.length,random),at=cells[which];
 cells[which]=cells[cells.length-1];cells.pop();return at;
};

export function generateBlissScenery(source:BlissTrack,config:BlissSceneryGeneratorConfig){
 const random=config.random??Math.random;
 const {track:result,map,availability}=blissSceneryMap(source,config.eraseExisting);

 const cellsFor=(from:number,to:number)=>{
  const cells:number[]=[];
  for(let i=0;i<900;i++)if(map[i]>=from&&map[i]<=to)cells.push(i);
  return cells;
 };

 // Bliss does road/water first, then open field. Percentages are percentages
 // of the initially available cells, not literal object counts.
 for(let round=1;round<=2;round++){
  for(let i=0;i<config.rules.length&&i<10;i++){
   const rule=config.rules[i];
   let from:number,to:number,available:number;
   if(rule.placement==='everywhere'){from=1;to=1;available=availability.openfield;}
   else if(i===9||rule.placement==='on-water'){from=2;to=2;available=availability.water;}
   else{from=10;to=13;available=availability.byRoad;}
   if((from===1&&round!==2)||(from!==1&&round!==1))continue;

   const amount=blissSceneryTargetCount(available,rule.percent);
   const candidates=cellsFor(from,to);
   for(let placed=0;placed<amount&&candidates.length;placed++){
    const at=chooseAndRemove(candidates,random);if(at<0)break;
    const orientation=map[at]-10;
    let code=rule.baseCode;
    // The first four scenery types have no rotations. Ships always randomise.
    // Road-side directional scenery uses the source's baseCode + map direction.
    if(i===9)code+=Math.floor(random()*4);
    else if(i>=4&&from===10)code+=Math.max(0,orientation);
    else if(i>=4)code+=Math.floor(random()*4);
    result.track[at]=code;map[at]=-1;
   }
  }
 }
 return result;
}
