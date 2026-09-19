import type {NativeDemoData} from './native-demo-runtime.ts';
import {engineSoundForCar,engineSoundPresetInfo,loadSoundModSettings} from './sound-mod-settings.ts';
import {parseVce,vceResource} from './vce-format.ts';

type Core={invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>};

function tauriCore(){
 return (window as typeof window&{__TAURI__?:{core?:Core}}).__TAURI__?.core;
}

function asBytes(value:unknown){
 if(value instanceof Uint8Array)return value;
 if(value instanceof ArrayBuffer)return new Uint8Array(value);
 if(Array.isArray(value))return Uint8Array.from(value as number[]);
 if(value&&typeof value==='object'&&'buffer' in value){
  const buffer=(value as {buffer?:unknown}).buffer;
  if(buffer instanceof ArrayBuffer)return new Uint8Array(buffer);
 }
 throw Error('Runtime VCE response is not binary data');
}

export async function loadConfiguredEngineSoundOverrides(data:NativeDemoData){
 const settings=loadSoundModSettings();
 if(!settings.enabled||data.soundDevice)return undefined;
 const core=tauriCore();if(!core)return undefined;

 try{
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
    const raw=await core.invoke<unknown>('read_runtime_file',{path:runtimePath});
    const bytes=asBytes(raw);
    const parsed=parseVce(bytes),engi=vceResource(parsed,'ENGI');
    if(!engi||engi.bytes.length<100)throw Error(`Sound preset ${info.label} has no valid 100-byte ENGI resource`);
    instrument=engi.bytes.slice(0,100);cache.set(file,instrument);
   }
   overrides[car.id.toUpperCase()]=instrument;
   console.info(`[Sound Mod] ${car.id} -> ${info.label} (${file})`,{
    controller16:instrument[0x16],controller17:instrument[0x17],controller18:instrument[0x18],
    pitchDivisor:instrument[14],pitchBase:instrument[15],
   });
  }
  return Object.keys(overrides).length?overrides:undefined;
 }catch(reason){
  console.error('[Sound Mod] Could not load configured engine sounds; using original sounds.',reason);
  return undefined;
 }
}
