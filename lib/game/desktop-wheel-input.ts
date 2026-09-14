export type DesktopInputDevice='keyboard'|'joystick'|'mouse'|'wheel';
export type DesktopWheelInputState={
 configured:boolean;
 connected:boolean;
 steering:number;
 throttle:number;
 brake:number;
};

const inputDeviceKey='playstunts-dx-input-device';
const neutralWheelInput:DesktopWheelInputState={configured:false,connected:false,steering:0,throttle:0,brake:0};
let wheelInput:DesktopWheelInputState={...neutralWheelInput};

export function desktopShellActive(){
 if(typeof window==='undefined')return false;
 const tauri=(window as typeof window&{__TAURI__?:unknown}).__TAURI__;
 return !!tauri||(typeof document!=='undefined'&&!!document.querySelector('.desktop-game-shell'));
}

export function desktopInputDevice():DesktopInputDevice{
 if(typeof window==='undefined'||!desktopShellActive())return 'keyboard';
 const saved=window.localStorage.getItem(inputDeviceKey);
 return saved==='wheel'||saved==='joystick'||saved==='mouse'||saved==='keyboard'?saved:'keyboard';
}

export function setDesktopInputDevice(device:DesktopInputDevice){
 if(typeof window==='undefined')return;
 window.localStorage.setItem(inputDeviceKey,device);
}

export function setDesktopWheelInput(state:DesktopWheelInputState){
 wheelInput={...state};
}

export function getDesktopWheelInput():DesktopWheelInputState{
 return wheelInput;
}

export function clearDesktopWheelInput(){
 wheelInput={...neutralWheelInput};
}
