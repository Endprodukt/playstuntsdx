import type {NativeDemoData} from './native-demo-runtime.ts';
import {engineSoundForCar,engineSoundPresetInfo,loadSoundModSettings} from './sound-mod-settings.ts';
import {parseVce,vceResource} from './vce-format.ts';

type Core={invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>};

function tauriCore(){
 return (window as typeof window&{__TAURI__?:{core?:Core}}).__TAURI__?.core;
}

export async function loadConfiguredEngineSoundOverrides(data:NativeDemoData){
 const settings=loadSoundModSettings();
 if(!settings.enabled||data.soundDevice)return undefined;
 const core=tauriCore();if(!core)return undefined;

 const cache=new Map<string,Uint8Array>();
 const overrides:Record<string,Uint8Array>={};

 for(const car of data.cars){
  const preset=engineSoundForCar(car.id,settings);
  if(preset==='original')continue;
  const info=engineSoundPresetInfo(preset),file=info.adlibFile;
  if(!file)continue;

  let instrument=cache.get(file);
  if(!instrument){
   const runtimePath='sound-mods/zapper/ADENG1/'+file;
   const bytes=Uint8Array.from(await core.invoke<number[]>('read_runtime_file',{path:runtimePath}));
   const parsed=parseVce(bytes),engi=vceResource(parsed,'ENGI');
   if(!engi||engi.bytes.length<100)throw Error(`Sound preset ${info.label} has no valid 100-byte ENGI resource`);
   instrument=engi.bytes.slice(0,100);cache.set(file,instrument);
  }
  overrides[car.id.toUpperCase()]=instrument;
  console.info(`[Sound Mod] ${car.id} -> ${info.label} (${file})`);
 }
 return Object.keys(overrides).length?overrides:undefined;
}
