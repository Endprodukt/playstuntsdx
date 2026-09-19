export interface RaceSpawn {
 x:number;
 y?:number;
 z:number;
 heading:number;
}

export const RACE_TELEPORT_EVENT='playstunts-dx-race-teleport';

export function requestRaceTeleport(spawn:RaceSpawn){
 if(typeof window==='undefined')return;
 window.dispatchEvent(new CustomEvent<RaceSpawn>(RACE_TELEPORT_EVENT,{detail:spawn}));
}

export function normalizeRaceHeading(value:number){
 return ((Math.round(value)%1024)+1024)%1024;
}
