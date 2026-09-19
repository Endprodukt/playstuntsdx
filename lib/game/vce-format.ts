export interface VceResource{
 name:string;
 offset:number;
 bytes:Uint8Array;
}

export interface VceFile{
 declaredSize:number;
 resources:readonly VceResource[];
 byName:ReadonlyMap<string,VceResource>;
}

/** Kris' Music System voice container used by Stunts engine/effect files.
 * Layout observed in ADENG1/PCENG1/TDENG1:
 * u32 declared file size, u16 resource count, count*4 ASCII names,
 * count cumulative u32 payload offsets, then resource data.
 */
export function parseVce(bytes:Uint8Array):VceFile{
 if(bytes.length<10)throw Error('VCE file is too small');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const declaredSize=view.getUint32(0,true),count=view.getUint16(4,true);
 if(!count||count>256)throw Error('VCE resource count is invalid');
 const namesAt=6,offsetsAt=namesAt+count*4,payloadAt=offsetsAt+count*4;
 if(payloadAt>bytes.length)throw Error('VCE header exceeds file size');
 const names=Array.from({length:count},(_,index)=>{
  let name='';
  for(let i=0;i<4;i++){const value=bytes[namesAt+index*4+i];if(value)name+=String.fromCharCode(value);}
  return name.toUpperCase();
 });
 // VCE stores exactly one cumulative payload offset per named resource.
 // The final resource simply runs to end-of-file.
 const offsets=Array.from({length:count},(_,index)=>view.getUint32(offsetsAt+index*4,true));
 for(let i=0;i<count;i++){
  if(offsets[i]>bytes.length-payloadAt)throw Error('VCE resource offset is outside payload');
  if(i&&offsets[i]<offsets[i-1])throw Error('VCE resource offsets are not ordered');
 }
 const resources=names.map((name,index)=>{
  const start=payloadAt+offsets[index],end=index+1<count?payloadAt+offsets[index+1]:bytes.length;
  if(end<start||end>bytes.length)throw Error('VCE resource range is invalid');
  return {name,offset:start,bytes:bytes.slice(start,end)};
 });
 return {declaredSize,resources,byName:new Map(resources.map(resource=>[resource.name,resource]))};
}

export function vceResource(file:VceFile,name:string){
 return file.byName.get(name.toUpperCase());
}
