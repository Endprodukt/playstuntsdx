import {createBlissTrack} from './bliss-track.ts';
import {dryBlissTerrain,floodBlissTerrain,raiseBlissTerrain} from './bliss-edit.ts';

export interface BlissTerrainPreset {name:string;terrain:number[];format:number}

const blank=()=>createBlissTrack(4,152);
const everyVertex=(fn:(x:number,y:number)=>boolean,paint:(x:number,y:number)=>void)=>{
 for(let y=0;y<=30;y++)for(let x=0;x<=30;x++)if(fn(x,y))paint(x,y);
};
const water=(track:ReturnType<typeof blank>,fn:(x:number,y:number)=>boolean)=>everyVertex(fn,(x,y)=>floodBlissTerrain(track,x,y));
const dry=(track:ReturnType<typeof blank>,fn:(x:number,y:number)=>boolean)=>everyVertex(fn,(x,y)=>dryBlissTerrain(track,x,y));
const hill=(track:ReturnType<typeof blank>,fn:(x:number,y:number)=>boolean)=>everyVertex(fn,(x,y)=>raiseBlissTerrain(track,x,y));
const circle=(cx:number,cy:number,r:number)=>(x:number,y:number)=>(x-cx)**2+(y-cy)**2<=r*r;
const terrain=(name:string,make:(track:ReturnType<typeof blank>)=>void):BlissTerrainPreset=>{
 const track=blank();make(track);return {name,terrain:Array.from(track.terrain),format:track.format};
};

/** Bliss offers 28 choices in its Select Terrain dialog. The first eight
 * entries below are format-compatible canonical choices: the three empty
 * terrains and the five original Stunts terrain presets supplied by the game.
 * The remaining named templates recreate the Bliss preset catalogue with the
 * same editing primitives (Flood/Dry/Raise), so every generated map has valid
 * terrain borders instead of raw hard-edged tile fills. */
export function blissTerrainPresets(stunts:readonly {terrain:number[]}[]=[]):BlissTerrainPreset[]{
 const result:BlissTerrainPreset[]=[
  terrain('Empty (grass)',()=>{}),
  terrain('Empty (water)',track=>track.terrain.fill(1)),
  terrain('Empty (mountain)',track=>track.terrain.fill(6)),
 ];
 for(let i=0;i<5;i++){
  const source=stunts[i]?.terrain;
  result.push({name:'Stunts Terrain '+(i+1),terrain:source?source.slice(0,900):Array(900).fill(0),format:source?.[900]??152});
 }
 result.push(
  terrain('River fork',track=>water(track,(x,y)=>Math.abs(x-15)<=1||y<15&&(Math.abs(x-(7+y*.55))<=1||Math.abs(x-(23-y*.55))<=1))),
  terrain('The sierras',track=>{hill(track,(x,y)=>Math.abs(y-(7+x*.42))<=2);hill(track,(x,y)=>Math.abs(y-(24-x*.32))<=2);}),
  terrain('Large islands',track=>{track.terrain.fill(1);dry(track,(x,y)=>circle(9,10,5)(x,y)||circle(22,19,6)(x,y)||circle(20,6,3)(x,y));}),
  terrain('By the coast',track=>water(track,(x,y)=>x<7+3*Math.sin(y/4))),
  terrain('Rings',track=>{hill(track,(x,y)=>{const d=Math.hypot(x-15,y-15);return d>9&&d<12;});water(track,(x,y)=>{const d=Math.hypot(x-15,y-15);return d>4&&d<7;});}),
  terrain('Four simple hills',track=>hill(track,(x,y)=>circle(8,8,4)(x,y)||circle(22,8,4)(x,y)||circle(8,22,4)(x,y)||circle(22,22,4)(x,y))),
  terrain('Small islands',track=>{track.terrain.fill(1);dry(track,(x,y)=>[[6,6],[15,7],[24,6],[8,17],[20,16],[14,25],[25,24]].some(([cx,cy])=>circle(cx,cy,2.5)(x,y)));}),
  terrain('Follow the canal',track=>water(track,(x,y)=>Math.abs(x-(15+7*Math.sin(y/5)))<=1.2)),
  terrain('Triple border',track=>{water(track,(x,y)=>x<3||y<3||x>27||y>27);hill(track,(x,y)=>x>=6&&x<=24&&y>=6&&y<=24&&(x<9||y<9||x>21||y>21));}),
  terrain('The canyon',track=>{hill(track,(x,y)=>x<9+2*Math.sin(y/5)||x>21+2*Math.sin(y/5));water(track,(x,y)=>Math.abs(x-(15+2*Math.sin(y/4)))<1);}),
  terrain('Enclosed canal',track=>water(track,(x,y)=>x>=5&&x<=25&&y>=5&&y<=25&&(x<=7||x>=23||y<=7||y>=23))),
  terrain('Squares',track=>{water(track,(x,y)=>x>=5&&x<=12&&y>=5&&y<=12||x>=18&&x<=25&&y>=18&&y<=25);hill(track,(x,y)=>x>=18&&x<=25&&y>=5&&y<=12||x>=5&&x<=12&&y>=18&&y<=25);}),
  terrain('Lakes and hills',track=>{water(track,(x,y)=>circle(8,9,5)(x,y)||circle(22,21,4)(x,y));hill(track,(x,y)=>circle(22,8,4)(x,y)||circle(9,22,3)(x,y));}),
  terrain('Symmetry',track=>{water(track,(x,y)=>circle(8,15,4)(x,y)||circle(22,15,4)(x,y));hill(track,(x,y)=>circle(15,7,4)(x,y)||circle(15,23,4)(x,y));}),
  terrain('The great lagoon',track=>{water(track,(x,y)=>((x-11)/9)**2+((y-12)/7)**2<=1||circle(7,19,4)(x,y));hill(track,(x,y)=>circle(2,2,3)(x,y)||circle(27,27,3)(x,y)||circle(25,5,2)(x,y));}),
  terrain('Spiral',track=>{water(track,(x,y)=>{const dx=x-15,dy=y-15,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx)+Math.PI;return r>2&&r<13&&Math.abs(((a*2.1-r+60)%6)-3)<1.2;});}),
  terrain('Hill Valley',track=>hill(track,(x,y)=>x<7+Math.abs(y-15)*.25||x>23-Math.abs(y-15)*.25)),
  terrain('Whimsical',track=>{water(track,(x,y)=>circle(6,7,4)(x,y)||circle(23,22,5)(x,y)||Math.abs(y-(15+3*Math.sin(x/3)))<1);hill(track,(x,y)=>circle(22,6,3)(x,y)||circle(8,23,3)(x,y));}),
  terrain('The fortress',track=>hill(track,(x,y)=>x>=5&&x<=25&&y>=5&&y<=25&&(x<=8||x>=22||y<=8||y>=22))),
  terrain('Saw land',track=>hill(track,(x,y)=>Math.abs(y-(5+((x%8)*2.2)))<=1.8||Math.abs(y-(25-((x%8)*2.2)))<=1.8)),
 );
 return result.slice(0,28);
}
