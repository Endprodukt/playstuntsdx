export const DESKTOP_CONTROL_BINDINGS_KEY='playstunts-dx-control-bindings-v1';

export type DesktopControlAction=
 |'accelerate'|'brake'|'steer-left'|'steer-right'|'shift-up'|'shift-down'
 |'game-menu'|'camera-cycle'|'camera-1'|'camera-2'|'camera-3'|'camera-4'
 |'follow-opponent'|'dashboard'
 |'replay-camera-up'|'replay-camera-down'|'replay-camera-left'|'replay-camera-right'
 |'replay-zoom-in'|'replay-zoom-out'|'terrain-editor';

export type DesktopControllerBinding={deviceId:string;deviceName?:string;button:number};
export type DesktopActionBinding={keys:string[];button?:DesktopControllerBinding};
export type DesktopControlBindings=Record<DesktopControlAction,DesktopActionBinding>;
export type DesktopControlDefinition={
 id:DesktopControlAction;
 group:'Driving & menus'|'Race'|'Replay & editor';
 label:string;
 help:string;
 targetScans:readonly number[];
 primaryScan:number;
 defaultKeys:readonly string[];
};

/**
 * These are the actual original Stunts keyboard functions used by the rebuilt
 * game. Arrow, Space and Enter bindings intentionally keep their original
 * context-sensitive behaviour in menus and replay controls as well as driving.
 * DX-only shortcuts such as F8/F10/F11 are not part of this table.
 */
export const DESKTOP_CONTROL_DEFINITIONS:readonly DesktopControlDefinition[]=[
 {id:'accelerate',group:'Driving & menus',label:'Accelerate / Up',help:'Accelerate; also moves up in original menus and replay controls.',targetScans:[72],primaryScan:72,defaultKeys:['ArrowUp']},
 {id:'brake',group:'Driving & menus',label:'Brake / Down',help:'Brake; also moves down in original menus and replay controls.',targetScans:[80],primaryScan:80,defaultKeys:['ArrowDown']},
 {id:'steer-left',group:'Driving & menus',label:'Steer / Left',help:'Steer left; also moves left in original menus and replay controls.',targetScans:[75],primaryScan:75,defaultKeys:['ArrowLeft']},
 {id:'steer-right',group:'Driving & menus',label:'Steer / Right',help:'Steer right; also moves right in original menus and replay controls.',targetScans:[77],primaryScan:77,defaultKeys:['ArrowRight']},
 {id:'shift-up',group:'Driving & menus',label:'Shift Up / Space action',help:'Original shift-up action. Space and A are the original aliases.',targetScans:[57],primaryScan:57,defaultKeys:['Space','KeyA']},
 {id:'shift-down',group:'Driving & menus',label:'Shift Down / Enter action',help:'Original shift-down/confirm action. Enter and Z are the original aliases.',targetScans:[28],primaryScan:28,defaultKeys:['Enter','KeyZ']},
 {id:'game-menu',group:'Driving & menus',label:'Game Menu / Back',help:'Open the in-game menu or back out of the current original screen.',targetScans:[1],primaryScan:1,defaultKeys:['Escape']},

 {id:'camera-cycle',group:'Race',label:'Cycle Camera',help:'Cycle the original race camera.',targetScans:[46],primaryScan:46,defaultKeys:['KeyC']},
 {id:'camera-1',group:'Race',label:'Camera 1',help:'Select original camera F1.',targetScans:[59],primaryScan:59,defaultKeys:['F1']},
 {id:'camera-2',group:'Race',label:'Camera 2',help:'Select original camera F2.',targetScans:[60],primaryScan:60,defaultKeys:['F2']},
 {id:'camera-3',group:'Race',label:'Camera 3',help:'Select original camera F3.',targetScans:[61],primaryScan:61,defaultKeys:['F3']},
 {id:'camera-4',group:'Race',label:'Camera 4',help:'Select original camera F4.',targetScans:[62],primaryScan:62,defaultKeys:['F4']},
 {id:'follow-opponent',group:'Race',label:'Follow Opponent',help:'Original T follow-opponent command.',targetScans:[20],primaryScan:20,defaultKeys:['KeyT']},
 {id:'dashboard',group:'Race',label:'Toggle Dashboard',help:'Original D dashboard toggle.',targetScans:[32],primaryScan:32,defaultKeys:['KeyD']},

 {id:'replay-camera-up',group:'Replay & editor',label:'Replay Camera Up',help:'Original Ctrl+Up free replay-camera movement.',targetScans:[29,72],primaryScan:72,defaultKeys:['Ctrl+ArrowUp']},
 {id:'replay-camera-down',group:'Replay & editor',label:'Replay Camera Down',help:'Original Ctrl+Down free replay-camera movement.',targetScans:[29,80],primaryScan:80,defaultKeys:['Ctrl+ArrowDown']},
 {id:'replay-camera-left',group:'Replay & editor',label:'Replay Camera Left',help:'Original Ctrl+Left free replay-camera movement.',targetScans:[29,75],primaryScan:75,defaultKeys:['Ctrl+ArrowLeft']},
 {id:'replay-camera-right',group:'Replay & editor',label:'Replay Camera Right',help:'Original Ctrl+Right free replay-camera movement.',targetScans:[29,77],primaryScan:77,defaultKeys:['Ctrl+ArrowRight']},
 {id:'replay-zoom-in',group:'Replay & editor',label:'Replay Zoom In',help:'Original + replay-camera zoom.',targetScans:[78],primaryScan:78,defaultKeys:['NumpadAdd','Shift+Equal']},
 {id:'replay-zoom-out',group:'Replay & editor',label:'Replay Zoom Out',help:'Original - replay-camera zoom.',targetScans:[74],primaryScan:74,defaultKeys:['NumpadSubtract','Minus']},
 {id:'terrain-editor',group:'Replay & editor',label:'Terrain Editor',help:'Original Shift+F1 terrain-editor shortcut.',targetScans:[42,59],primaryScan:59,defaultKeys:['Shift+F1']},
];

const definitionById=new Map(DESKTOP_CONTROL_DEFINITIONS.map(definition=>[definition.id,definition] as const));
const modifierCodes=new Set(['ControlLeft','ControlRight','ShiftLeft','ShiftRight','AltLeft','AltRight','MetaLeft','MetaRight']);
type ControllerDevice={id:string;name?:string;buttons:readonly number[]};
let deviceStates=new Map<string,ControllerDevice>();
let queuedButtonActions:DesktopControlAction[]=[];
let captureSuspended=false;
let cachedRaw:string|undefined,cachedBindings:DesktopControlBindings|undefined;

function desktopActive(){
 if(typeof window==='undefined')return false;
 const tauri=(window as typeof window&{__TAURI__?:unknown}).__TAURI__;
 return !!tauri||(typeof document!=='undefined'&&!!document.querySelector('.desktop-game-shell'));
}

function defaultBindings():DesktopControlBindings{
 return Object.fromEntries(DESKTOP_CONTROL_DEFINITIONS.map(definition=>[
  definition.id,{keys:[...definition.defaultKeys]},
 ])) as DesktopControlBindings;
}

function validButton(value:unknown):DesktopControllerBinding|undefined{
 if(!value||typeof value!=='object')return undefined;
 const entry=value as Partial<DesktopControllerBinding>;
 if(typeof entry.deviceId!=='string'||!entry.deviceId||!Number.isInteger(entry.button)||Number(entry.button)<0)return undefined;
 return {deviceId:entry.deviceId,deviceName:typeof entry.deviceName==='string'?entry.deviceName:undefined,button:Number(entry.button)};
}

function readBindings():DesktopControlBindings{
 if(typeof window==='undefined')return defaultBindings();
 const raw=window.localStorage.getItem(DESKTOP_CONTROL_BINDINGS_KEY)??'';
 if(cachedBindings&&raw===cachedRaw)return cachedBindings;
 const result=defaultBindings();
 if(raw){
  try{
   const parsed=JSON.parse(raw) as Record<string,unknown>;
   for(const definition of DESKTOP_CONTROL_DEFINITIONS){
    const candidate=parsed[definition.id];
    if(!candidate||typeof candidate!=='object')continue;
    const entry=candidate as {keys?:unknown;button?:unknown};
    if(Array.isArray(entry.keys))result[definition.id].keys=entry.keys.filter((value):value is string=>typeof value==='string'&&value.length>0);
    result[definition.id].button=validButton(entry.button);
   }
  }catch{/* Invalid user JSON falls back to the original controls. */}
 }
 cachedRaw=raw;cachedBindings=result;return result;
}

function saveBindings(bindings:DesktopControlBindings){
 if(typeof window==='undefined')return;
 const serialized=JSON.stringify(bindings);
 cachedRaw=serialized;cachedBindings=bindings;
 window.localStorage.setItem(DESKTOP_CONTROL_BINDINGS_KEY,serialized);
}

export function desktopControlBindings():DesktopControlBindings{
 const source=readBindings();
 return Object.fromEntries(DESKTOP_CONTROL_DEFINITIONS.map(({id})=>[
  id,{keys:[...source[id].keys],button:source[id].button?{...source[id].button}:undefined},
 ])) as DesktopControlBindings;
}

export function resetDesktopControlBindings(){
 if(typeof window==='undefined')return;
 cachedRaw=undefined;cachedBindings=undefined;
 window.localStorage.removeItem(DESKTOP_CONTROL_BINDINGS_KEY);
}

export function setDesktopControlKeyboard(action:DesktopControlAction,chord:string|undefined){
 const next=desktopControlBindings();
 if(chord){
  // One physical key/chord owns one semantic action. Remove an older assignment
  // first so a rebind never fires two original Stunts commands at once.
  for(const definition of DESKTOP_CONTROL_DEFINITIONS)next[definition.id].keys=next[definition.id].keys.filter(value=>value!==chord);
  next[action].keys=[chord];
 }else next[action].keys=[];
 saveBindings(next);
}

export function setDesktopControlButton(action:DesktopControlAction,button:DesktopControllerBinding|undefined){
 const next=desktopControlBindings();
 if(button){
  for(const definition of DESKTOP_CONTROL_DEFINITIONS){
   const current=next[definition.id].button;
   if(current?.deviceId===button.deviceId&&current.button===button.button)next[definition.id].button=undefined;
  }
  next[action].button={...button};
 }else next[action].button=undefined;
 saveBindings(next);
}

export function resetDesktopControlAction(action:DesktopControlAction){
 const next=desktopControlBindings(),definition=definitionById.get(action)!;
 next[action]={keys:[...definition.defaultKeys]};
 saveBindings(next);
}

export function desktopControlChord(event:Pick<KeyboardEvent,'code'|'ctrlKey'|'shiftKey'|'altKey'|'metaKey'>){
 if(!event.code||modifierCodes.has(event.code))return undefined;
 const parts:string[]=[];
 if(event.ctrlKey)parts.push('Ctrl');
 if(event.altKey)parts.push('Alt');
 if(event.shiftKey)parts.push('Shift');
 if(event.metaKey)parts.push('Meta');
 parts.push(event.code);
 return parts.join('+');
}

export function formatDesktopControlChord(chord:string){
 const names:Record<string,string>={
  Space:'Space',Enter:'Enter',Escape:'Esc',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',
  Equal:'=',Minus:'-',NumpadAdd:'Numpad +',NumpadSubtract:'Numpad −',
 };
 return chord.split('+').map(part=>part.startsWith('Key')&&part.length===4?part.slice(3):part.startsWith('Digit')?part.slice(5):(names[part]??part)).join('+');
}

export type DesktopControlKeyboardTarget={action:DesktopControlAction;targetScans:readonly number[];primaryScan:number};
export function desktopControlKeyboardTarget(event:Pick<KeyboardEvent,'code'|'ctrlKey'|'shiftKey'|'altKey'|'metaKey'>):DesktopControlKeyboardTarget|undefined{
 if(!desktopActive())return undefined;
 const chord=desktopControlChord(event);if(!chord)return undefined;
 const bindings=readBindings();
 for(const definition of DESKTOP_CONTROL_DEFINITIONS)if(bindings[definition.id].keys.includes(chord))return {action:definition.id,targetScans:definition.targetScans,primaryScan:definition.primaryScan};
 return undefined;
}

/** Suppress an original default key after that action has been rebound. */
export function desktopControlSuppressDefault(event:Pick<KeyboardEvent,'code'|'ctrlKey'|'shiftKey'|'altKey'|'metaKey'>){
 if(!desktopActive())return false;
 const chord=desktopControlChord(event);if(!chord)return false;
 const bindings=readBindings();
 return DESKTOP_CONTROL_DEFINITIONS.some(definition=>definition.defaultKeys.includes(chord)&&!bindings[definition.id].keys.includes(chord));
}

export function desktopControlActionTarget(action:DesktopControlAction){return definitionById.get(action);}

export function setDesktopControlCapture(active:boolean){captureSuspended=active;queuedButtonActions=[];}

export function updateDesktopControlDevices(devices:readonly ControllerDevice[]){
 const before=deviceStates,next=new Map(devices.map(device=>[device.id,{id:device.id,name:device.name,buttons:[...device.buttons]}] as const));
 deviceStates=next;
 if(captureSuspended||!desktopActive()){queuedButtonActions=[];return;}
 const bindings=readBindings();
 for(const definition of DESKTOP_CONTROL_DEFINITIONS){
  const binding=bindings[definition.id].button;if(!binding)continue;
  const previous=before.get(binding.deviceId)?.buttons[binding.button]??0,current=next.get(binding.deviceId)?.buttons[binding.button]??0;
  if(current>.55&&previous<=.55)queuedButtonActions.push(definition.id);
 }
}

export function desktopControlButtonScanHeld(scan:number){
 if(captureSuspended||!desktopActive())return false;
 const bindings=readBindings();
 for(const definition of DESKTOP_CONTROL_DEFINITIONS){
  const binding=bindings[definition.id].button;if(!binding||!definition.targetScans.includes(scan))continue;
  if((deviceStates.get(binding.deviceId)?.buttons[binding.button]??0)>.55)return true;
 }
 return false;
}

export function takeDesktopControlButtonAction():DesktopControlAction|undefined{
 if(captureSuspended)return undefined;
 return queuedButtonActions.shift();
}
