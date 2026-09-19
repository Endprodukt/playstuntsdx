export type EngineSoundPreset=
 |'original'
 |'type-i'
 |'type-ii'
 |'v6'
 |'type-iv'
 |'i4'
 |'v10'
 |'sprint'
 |'prototype'
 |'indy';

export const ENGINE_SOUND_PRESETS:readonly {id:EngineSoundPreset;label:string;source:string;adlibFile?:string}[]=[
 {id:'original',label:'Original Stunts',source:'original',adlibFile:'ADENG1or.VCE'},
 {id:'type-i',label:'Zapper Type I',source:'zapper',adlibFile:'adeng1t1.vce'},
 {id:'type-ii',label:'Zapper Type II',source:'zapper',adlibFile:'adeng1t2.vce'},
 {id:'v6',label:'Zapper Type III (V6)',source:'zapper',adlibFile:'ADENG1T3.VCE'},
 {id:'type-iv',label:'Zapper Type IV',source:'zapper',adlibFile:'ADENG1T4.VCE'},
 {id:'i4',label:'Zapper Type V (I4)',source:'zapper',adlibFile:'ADENG1T5.VCE'},
 {id:'v10',label:'Zapper Type VI (V10)',source:'zapper',adlibFile:'ADENG1T6.VCE'},
 {id:'sprint',label:'Mario Andretti Sprint',source:'zapper',adlibFile:'ADENG1_M/ADspnt.VCE'},
 {id:'prototype',label:'Mario Andretti Prototype',source:'zapper',adlibFile:'ADENG1_M/ADprto.VCE'},
 {id:'indy',label:'Mario Andretti Indy',source:'zapper',adlibFile:'ADENG1_M/ADindy.VCE'},
];

export interface SoundModSettings{
 defaultPreset:EngineSoundPreset;
 perCar:Record<string,EngineSoundPreset>;
}

export const SOUND_MOD_SETTINGS_KEY='playstunts-dx-sound-mod-settings-v1';

export function loadSoundModSettings():SoundModSettings{
 const fallback:SoundModSettings={defaultPreset:'original',perCar:{}};
 try{
  const parsed=JSON.parse(localStorage.getItem(SOUND_MOD_SETTINGS_KEY)??'null') as Partial<SoundModSettings>|null;
  if(!parsed)return fallback;
  const valid=new Set(ENGINE_SOUND_PRESETS.map(item=>item.id));
  const perCar:Record<string,EngineSoundPreset>={};
  if(parsed.perCar&&typeof parsed.perCar==='object')for(const [car,preset] of Object.entries(parsed.perCar))if(valid.has(preset as EngineSoundPreset))perCar[car.toUpperCase()]=preset as EngineSoundPreset;
  return {
   defaultPreset:valid.has(parsed.defaultPreset as EngineSoundPreset)?parsed.defaultPreset as EngineSoundPreset:'original',
   perCar,
  };
 }catch{return fallback;}
}

export function saveSoundModSettings(settings:SoundModSettings){
 localStorage.setItem(SOUND_MOD_SETTINGS_KEY,JSON.stringify(settings));
 window.dispatchEvent(new CustomEvent('playstunts-dx-sound-mod-settings-changed',{detail:settings}));
}

export function engineSoundForCar(car:string,settings=loadSoundModSettings()):EngineSoundPreset{
 return settings.perCar[car.toUpperCase()]??settings.defaultPreset;
}


export function engineSoundPresetInfo(id:EngineSoundPreset){
 return ENGINE_SOUND_PRESETS.find(preset=>preset.id===id)??ENGINE_SOUND_PRESETS[0];
}
