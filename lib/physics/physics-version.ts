export type PhysicsVersion='mindscape-1990'|'broderbund-1991';

export const PHYSICS_VERSIONS:readonly {id:PhysicsVersion;label:string;shortLabel:string}[]=[
 {id:'broderbund-1991',label:'Stunts 1.1 · Broderbund · Feb 1991',shortLabel:'BB 1.1 · Feb 1991'},
 {id:'mindscape-1990',label:'4D Sports Driving 1.1 · Mindscape · Dec 1990',shortLabel:'MS 1.1 · Dec 1990'},
];

const STORAGE_KEY='playstunts-dx-physics-version';
let runtimeOverride:PhysicsVersion|undefined;

export function physicsVersion():PhysicsVersion{
 if(runtimeOverride)return runtimeOverride;
 if(typeof window==='undefined')return 'mindscape-1990';
 try{
  const saved=window.localStorage.getItem(STORAGE_KEY);
  return saved==='broderbund-1991'||saved==='mindscape-1990'?saved:'mindscape-1990';
 }catch{return 'mindscape-1990';}
}
export function physicsVersionLabel(short=true){
 const row=PHYSICS_VERSIONS.find(entry=>entry.id===physicsVersion())!;
 return short?row.shortLabel:row.label;
}
export function setPhysicsVersion(version:PhysicsVersion){
 if(typeof window!=='undefined')try{window.localStorage.setItem(STORAGE_KEY,version);}catch{}
 return version;
}
/** Headless tools/tests can select a version without localStorage. */
export function setPhysicsVersionRuntimeOverride(version:PhysicsVersion|undefined){runtimeOverride=version;}
