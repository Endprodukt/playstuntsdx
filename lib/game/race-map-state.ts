export const RACE_MAP_FRAME_EVENT='playstunts-dx-race-map-frame';
export const RACE_MAP_CLEAR_EVENT='playstunts-dx-race-map-clear';

export interface RaceMapFrame {
 track:ReadonlyArray<number>;
 x:number;
 z:number;
 heading:number;
}

export function publishRaceMapFrame(track:ReadonlyArray<number>,memory:Uint8Array,dataSegment=0x2d1a0){
 const view=new DataView(memory.buffer,memory.byteOffset,memory.byteLength);
 const base=dataSegment+0x8c38;
 const x=view.getInt32(base,true)/64;
 const z=view.getInt32(base+8,true)/64;
 const heading=view.getInt16(dataSegment+0x8c50,true);
 window.dispatchEvent(new CustomEvent<RaceMapFrame>(RACE_MAP_FRAME_EVENT,{detail:{track,x,z,heading}}));
}

export function clearRaceMapFrame(){
 window.dispatchEvent(new Event(RACE_MAP_CLEAR_EVENT));
}
