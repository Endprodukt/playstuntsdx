// Automatic scenery generation modelled after Bliss' documented generator.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {cloneBlissTrack} from './bliss-track.ts';
import {blissElementData} from './bliss-element-data.ts';
import {blissParentElement} from './bliss-edit.ts';
import {transformBlissTrackCode,blissTransformations} from './bliss-transformations.ts';

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

export const BLISS_SCENERY_GROUPS=Object.freeze([
 {name:'Palm tree',baseCode:151,ship:false},
 {name:'Cactus',baseCode:152,ship:false},
 {name:'Pine tree',baseCode:153,ship:false},
 {name:'Tennis court',baseCode:154,ship:false},
 {name:'Gas station',baseCode:155,ship:false},
 {name:'Barn',baseCode:159,ship:false},
 {name:'Office building',baseCode:163,ship:false},
 {name:'Windmill',baseCode:167,ship:false},
 {name:'Ship',baseCode:171,ship:true},
 {name:"Joe's diner",baseCode:175,ship:false},
] as const);

const water=(terrain:number)=>terrain>=1&&terrain<=5;
const scenery=(code:number)=>code>=151&&code<=178;
const inside=(x:number,y:number)=>x>=0&&x<30&&y>=0&&y<30;
const index=(x:number,y:number)=>y*30+x;

function roadAt(track:BlissTrack,x:number,y:number){
 if(!inside(x,y))return false;
 const code=blissParentElement(track,x,y,blissTransformations).code;
 if(!code||scenery(code)||code>=253)return false;
 return blissElementData[code]?.ctype.some(Boolean)??false;
}

function adjacentRoadDirection(track:BlissTrack,x:number,y:number){
 // 0=N, 1=E, 2=S, 3=W. Bliss faces by-road scenery toward the road.
 const candidates:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[
  [0,-1,0],[1,0,1],[0,1,2],[-1,0,3],
 ];
 return candidates.find(([dx,dy])=>roadAt(track,x+dx,y+dy))?.[2]??-1;
}

function orient(code:number,quarterTurns:number){
 let out=code;
 for(let i=0;i<(quarterTurns&3);i++)out=transformBlissTrackCode(out,'clockwise');
 return out;
}

function randomOrientation(code:number,random:()=>number){
 let out=code;
 const turns=Math.floor(random()*4)&3;
 for(let i=0;i<turns;i++)out=transformBlissTrackCode(out,'clockwise');
 return out;
}

/** Landscape-tuned starting values. Bliss' manual documents that defaults are
 * adapted to the selected background but does not publish the numeric table.
 * These values preserve that UI behaviour while all placement semantics below
 * follow the documented Bliss rules. */
export function blissSceneryDefaults(landscape:number):BlissSceneryRule[]{
 const percentages=[
  // palm,cactus,pine,tennis,gas,barn,office,windmill,ship,diner
  [18,22,0,2,4,3,2,3,3,4],   // desert
  [24,2,4,2,4,3,2,2,8,4],    // tropical
  [1,0,25,2,3,5,1,5,2,3],    // alpine
  [2,0,3,5,8,2,16,2,2,8],    // city
  [3,1,8,3,5,12,2,10,2,6],   // country
 ][Math.max(0,Math.min(4,landscape))]!;
 return BLISS_SCENERY_GROUPS.map((group,i)=>({
  name:group.name,baseCode:group.baseCode,percent:percentages[i]!,
  placement:group.ship?'on-water':(['Gas station',"Joe's diner"].includes(group.name)?'by-road':'everywhere'),
 }));
}

export function generateBlissScenery(source:BlissTrack,config:BlissSceneryGeneratorConfig){
 const result=cloneBlissTrack(source),random=config.random??Math.random;
 if(config.eraseExisting)for(let i=0;i<900;i++)if(scenery(result.track[i]))result.track[i]=0;

 const free=(x:number,y:number)=>result.track[index(x,y)]===0;
 const place=(x:number,y:number,rule:BlissSceneryRule,direction=-1)=>{
  if(!free(x,y))return false;
  let code=direction>=0?orient(rule.baseCode,direction):randomOrientation(rule.baseCode,random);
  result.track[index(x,y)]=code;return true;
 };

 // Bliss explicitly generates all "By the road" scenery first so the later
 // passes cannot occupy those prime cells.
 for(const rule of config.rules.filter(rule=>rule.placement==='by-road')){
  const chance=Math.max(0,Math.min(100,rule.percent))/100;
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   if(!free(x,y)||water(result.terrain[index(x,y)]))continue;
   const direction=adjacentRoadDirection(result,x,y);
   if(direction>=0&&random()<chance)place(x,y,rule,direction);
  }
 }

 // Then fill remaining land/water space according to the requested rates.
 for(const rule of config.rules.filter(rule=>rule.placement!=='by-road')){
  const chance=Math.max(0,Math.min(100,rule.percent))/100;
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   if(!free(x,y))continue;
   const isWater=water(result.terrain[index(x,y)]);
   if(rule.placement==='on-water'&&!isWater)continue;
   if(rule.placement==='everywhere'&&rule.baseCode!==171&&isWater)continue;
   if(random()<chance)place(x,y,rule);
  }
 }
 return result;
}
