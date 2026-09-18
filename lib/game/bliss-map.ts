// Native PlayStunts DX port of Bliss 2.6.1 editor behaviour/data.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import {BLISS_TRACK_SIZE,blissCellIndex,type BlissTrack} from './bliss-track.ts';
import type {BlissTransformations} from './bliss-transformations.ts';

export const BLISS_MAP_TILE=22;
export const BLISS_MAP_SIZE=BLISS_TRACK_SIZE*BLISS_MAP_TILE;
export interface BlissMapSprite {atlasX:number;atlasY:number;x:number;y:number;kind:'terrain'|'guide'|'track'}

const icon=(atlasX:number,atlasY:number,x:number,y:number,kind:BlissMapSprite['kind']):BlissMapSprite=>({atlasX,atlasY,x:x*BLISS_MAP_TILE,y:y*BLISS_MAP_TILE,kind});
const trackAt=(source:BlissTrack,x:number,y:number)=>source.track[blissCellIndex(x,y)];

/**
 * Port of Bliss DrawSpot/DrawTrack for the normal, error-overlay-free map.
 * It emits atlas tile draws instead of touching FreeBasic's screen buffer.
 */
export function blissMapPlan(source:BlissTrack,definitions:BlissTransformations):BlissMapSprite[]{
 const draws:BlissMapSprite[]=[];
 for(let y=0;y<BLISS_TRACK_SIZE;y++)for(let x=0;x<BLISS_TRACK_SIZE;x++){
  const i=blissCellIndex(x,y),terrain=source.terrain[i],track=source.track[i];
  const terrainDef=definitions.terrain[terrain];
  if(terrainDef)draws.push(icon(terrainDef.x+2,terrainDef.y+1,x,y,'terrain'));
  else draws.push(icon(0,12,x,y,'terrain'));

  if((terrain===7||terrain===9)&&[4,14,24].includes(track))draws.push(icon(6,15,x,y,'guide'));
  else if((terrain===8||terrain===10)&&[5,15,25].includes(track))draws.push(icon(7,15,x,y,'guide'));

  if(track>=182&&track<=252)continue;
  if(track<182){
   if(track===0x42){
    const north=y===0||trackAt(source,x,y-1)!==0x42,south=y===29||trackAt(source,x,y+1)!==0x42;
    if(north&&south)draws.push(icon(definitions.track[track].x,definitions.track[track].y,x,y,'track'));
    else if(!north&&!south)draws.push(icon(8,17,x,y,'track'));
    else if(!north)draws.push(icon(9,17,x,y,'track'));
    else draws.push(icon(7,17,x,y,'track'));
   }else if(track===0x43){
    const west=x===0||trackAt(source,x-1,y)!==0x43,east=x===29||trackAt(source,x+1,y)!==0x43;
    if(west&&east)draws.push(icon(definitions.track[track].x,definitions.track[track].y,x,y,'track'));
    else if(!west&&!east)draws.push(icon(8,16,x,y,'track'));
    else if(!west)draws.push(icon(9,16,x,y,'track'));
    else draws.push(icon(7,16,x,y,'track'));
   }else{
    const def=definitions.track[track];if(def)draws.push(icon(def.x,def.y,x,y,'track'));
   }
   continue;
  }
  if(track===253&&x>0&&y>0){const parent=trackAt(source,x-1,y-1),def=definitions.track[parent];if(def?.width===2&&def.height===2)draws.push(icon(def.x+1,def.y+1,x,y,'track'));continue;}
  if(track===254&&y>0){const parent=trackAt(source,x,y-1),def=definitions.track[parent];if(def?.height===2)draws.push(icon(def.x,def.y+1,x,y,'track'));continue;}
  if(track===255&&x>0){const parent=trackAt(source,x-1,y),def=definitions.track[parent];if(def?.width===2)draws.push(icon(def.x+1,def.y,x,y,'track'));}
 }
 return draws;
}

/** Draw a full 660x660 Bliss-style map from a 22px tile atlas. */
export function drawBlissMap(context:CanvasRenderingContext2D,atlas:CanvasImageSource,source:BlissTrack,definitions:BlissTransformations){
 context.clearRect(0,0,BLISS_MAP_SIZE,BLISS_MAP_SIZE);
 for(const sprite of blissMapPlan(source,definitions))context.drawImage(atlas,sprite.atlasX*BLISS_MAP_TILE,sprite.atlasY*BLISS_MAP_TILE,BLISS_MAP_TILE,BLISS_MAP_TILE,sprite.x,sprite.y,BLISS_MAP_TILE,BLISS_MAP_TILE);
}
