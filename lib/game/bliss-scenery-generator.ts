// Automatic scenery generation ported from Bliss 2.6.1 Menu_Scenery.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {cloneBlissTrack} from './bliss-track.ts';

export type BlissSceneryPlacement='everywhere'|'by-road'|'on-water';
export interface BlissSceneryRule {
 name:string;
 baseCode:number;
 percent:number;
 count?:number;
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

/** FreeBASIC's implicit floating -> integer conversion uses round-to-even.
 * This matters in Bliss because Menu_Scenery stores percentage calculations
 * directly into Short/UByte variables. */
export function blissRoundToEven(value:number){
 if(!Number.isFinite(value))return 0;
 const low=Math.floor(value),high=Math.ceil(value);
 const dl=value-low,dh=high-value;
 if(dl<dh)return low;
 if(dh<dl)return high;
 return (low&1)===0?low:high;
}

function sourceForAvailability(source:BlissTrack,eraseExisting:boolean){
 const result=cloneBlissTrack(source);
 if(eraseExisting)for(let i=0;i<900;i++)if(isScenery(result.track[i]))result.track[i]=0;
 return result;
}

/** Bliss classifies every free cell once before generation:
 *  -1 unavailable, 1 open field, 2 water, 10..13 by-road with orientation.
 * Neighbour order is exactly S, N, E, W from Menu_Scenery. */
function blissSceneryMap(source:BlissTrack,eraseExisting:boolean){
 const track=sourceForAvailability(source,eraseExisting),map=new Int16Array(900);
 map.fill(-1);
 let openfield=0,water=0,byRoad=0;
 const neighbour=[[0,1],[0,-1],[1,0],[-1,0]] as const;
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
   const neighbourCode=nx>=0&&nx<30&&ny>=0&&ny<30?track.track[index(nx,ny)]:0;
   if(isRoadCode(neighbourCode)){direction=n;break;}
  }
  if(direction>=0){map[at]=10+direction;byRoad++;}
  else{map[at]=1;openfield++;}
 }
 return {track,map,availability:{openfield,water,byRoad} satisfies BlissSceneryAvailability};
}

export function blissSceneryAvailability(source:BlissTrack,eraseExisting=false){
 return blissSceneryMap(source,eraseExisting).availability;
}

/** Bliss scenery count conversion.
 * The generated-object count is the rounded percentage of eligible cells.
 * The generation loop is 1..amount inclusive, so subtracting one here would
 * make every request one object too small (1 -> 0, 2 -> 1).
 */
export function blissSceneryTargetCount(available:number,percent:number){
 const p=Math.max(0,Math.min(100,percent));
 return Math.max(0,blissRoundToEven(available*p/100));
}

/** Exact defaults and ordering from Bliss 2.6.1 Menu_Scenery. */
export function blissSceneryDefaults(landscape:number):BlissSceneryRule[]{
 const percent=Array(10).fill(0) as number[];
 switch(Math.max(0,Math.min(4,landscape))){
  case 0: percent[1]=20;percent[6]=5;break;
  case 1: percent[2]=20;percent[4]=7;percent[6]=6;percent[8]=3;percent[9]=10;break;
  case 2: percent[0]=20;percent[4]=5;percent[5]=8;break;
  case 3: percent[0]=15;percent[4]=15;percent[6]=7;percent[8]=9;percent[9]=10;percent[3]=2;break;
  case 4: percent[0]=15;percent[3]=5;percent[5]=7;percent[6]=3;percent[7]=8;percent[9]=5;break;
 }
 return BLISS_SCENERY_GROUPS.map((group,i)=>({
  name:group.name,baseCode:group.baseCode,percent:percent[i],
  placement:i<3?'everywhere':group.ship?'on-water':'by-road',
 }));
}

function placeVariant(result:BlissTrack,at:number,rule:BlissSceneryRule,ruleIndex:number,from:number,mapValue:number,random:()=>number){
 let code=rule.baseCode;
 if(ruleIndex===9)code+=Math.floor(random()*4);
 else if(ruleIndex>=4&&from===10)code+=Math.max(0,mapValue-10);
 else if(ruleIndex>=4)code+=Math.floor(random()*4);
 result.track[at]=code;
}

/** Line-for-line behavioural port of Bliss' generation loop.
 * The apparently odd fallback behaviour for "Everywhere" is intentional:
 * Bliss may also place scenery on by-road/water cells while it keeps looking
 * for the primary open-field cell for the same loop iteration. */
export function generateBlissScenery(source:BlissTrack,config:BlissSceneryGeneratorConfig){
 const random=config.random??Math.random;
 const {track:result,map,availability}=blissSceneryMap(source,config.eraseExisting);

 for(let round=1;round<=2;round++){
  for(let i=0;i<config.rules.length&&i<10;i++){
   const rule=config.rules[i];
   let from:number,to:number,available:number;
   if(rule.placement==='everywhere'){from=1;to=1;available=availability.openfield;}
   else if(i===9||rule.placement==='on-water'){from=2;to=2;available=availability.water;}
   else{from=10;to=13;available=availability.byRoad;}

   if((from===1&&round!==2)||(from!==1&&round!==1))continue;
   const amount=rule.count===undefined?blissSceneryTargetCount(available,rule.percent):Math.max(0,Math.min(available,Math.trunc(rule.count)));

   if(rule.count!==undefined){
    const candidates:number[]=[];
    for(let at=0;at<map.length;at++)if(map[at]>=from&&map[at]<=to)candidates.push(at);
    for(let j=0;j<amount&&candidates.length;j++){
     const pick=Math.floor(random()*candidates.length),at=candidates.splice(pick,1)[0],value=map[at];
     placeVariant(result,at,rule,i,from,value,random);map[at]=-1;
    }
    continue;
   }

   for(let j=1;j<=amount;j++){
    // Legacy Bliss percentage mode. Keep its original fallback quirks for
    // compatibility, but exact-count callers bypass them entirely.
    let guard=0;
    for(;;){
     if(++guard>250000)break;
     const x=Math.floor(random()*30),y=Math.floor(random()*30),at=index(x,y),value=map[at];
     if(value>=from&&value<=to){
      placeVariant(result,at,rule,i,from,value,random);
      map[at]=-1;
      break;
     }
     if(from===1&&value>=10){
      // Exact Bliss quirk: place, but do not consume the cell and do not end
      // this iteration. Another random cell is still sought for open field.
      let code=rule.baseCode;
      if(i>=4)code+=Math.floor(random()*4);
      result.track[at]=code;
     }else if(i===9&&from===1&&value===2){
      result.track[at]=rule.baseCode+Math.floor(random()*4);
     }
    }
   }
  }
 }
 return result;
}
