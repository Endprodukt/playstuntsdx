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

export const ENGINE_SOUND_PRESETS:readonly {id:EngineSoundPreset;label:string;source:string}[]=[
 {id:'original',label:'Original Stunts',source:'original'},
 {id:'type-i',label:'Zapper Type I',source:'zapper'},
 {id:'type-ii',label:'Zapper Type II',source:'zapper'},
 {id:'v6',label:'Zapper V6',source:'zapper'},
 {id:'type-iv',label:'Zapper Type IV',source:'zapper'},
 {id:'i4',label:'Zapper I4',source:'zapper'},
 {id:'v10',label:'Zapper V10',source:'zapper'},
 {id:'sprint',label:'Mario Andretti Sprint',source:'zapper'},
 {id:'prototype',label:'Mario Andretti Prototype',source:'zapper'},
 {id:'indy',label:'Mario Andretti Indy',source:'zapper'},
];

export interface SoundModSettings{
 enabled:boolean;
 defaultPreset:EngineSoundPreset;
 perCar:Record<string,EngineSoundPreset>;
}

export const SOUND_MOD_SETTINGS_KEY='playstunts-dx-sound-mod-settings-v1';

export function loadSoundModSettings():SoundModSettings{
 const fallback:SoundModSettings={enabled:false,defaultPreset:'original',perCar:{}};
 try{
  const parsed=JSON.parse(localStorage.getItem(SOUND_MOD_SETTINGS_KEY)??'null') as Partial<SoundModSettings>|null;
  if(!parsed)return fallback;
  const valid=new Set(ENGINE_SOUND_PRESETS.map(item=>item.id));
  const perCar:Record<string,EngineSoundPreset>={};
  if(parsed.perCar&&typeof parsed.perCar==='object')for(const [car,preset] of Object.entries(parsed.perCar))if(valid.has(preset as EngineSoundPreset))perCar[car.toUpperCase()]=preset as EngineSoundPreset;
  return {
   enabled:parsed.enabled===true,
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
 if(!settings.enabled)return 'original';
 return settings.perCar[car.toUpperCase()]??settings.defaultPreset;
}
