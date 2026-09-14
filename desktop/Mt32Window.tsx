import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Mt32Panel} from '../app/work/native-mt32-check/panel';
import {mt32PanelTune,mt32PanelTuneTenths} from '../lib/game/mt32-panel-parameters';
import {
  MT32_CHANNEL,createRemoteMt32Device,emptyMt32Snapshot,
  type Mt32Command,type Mt32Snapshot,
} from './mt32-channel';
import '../app/work/native-mt32-check/panel.css';
import './mt32-window.css';

type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};

export default function Mt32Window(){
 const [snapshot,setSnapshot]=useState<Mt32Snapshot>(emptyMt32Snapshot);
 const snapshotRef=useRef(snapshot),channelRef=useRef<BroadcastChannel|null>(null);
 const [controls,setControls]=useState({reverb:true,amount:100,swap:false,tune:64});
 snapshotRef.current=snapshot;

 const send=useCallback((command:Mt32Command)=>channelRef.current?.postMessage({kind:'command',command}),[]);
 const device=useMemo(()=>createRemoteMt32Device(()=>snapshotRef.current,send),[send]);

 useEffect(()=>{
  const channel=new BroadcastChannel(MT32_CHANNEL);channelRef.current=channel;
  channel.onmessage=event=>{
   const message=event.data as {kind?:string;state?:Mt32Snapshot};
   if(message.kind==='state'&&message.state)setSnapshot(message.state);
  };
  channel.postMessage({kind:'command',command:{type:'request'} satisfies Mt32Command});
  const retry=window.setInterval(()=>channel.postMessage({kind:'command',command:{type:'request'}}),1000);
  return()=>{window.clearInterval(retry);channel.close();channelRef.current=null;};
 },[]);

 useEffect(()=>{
  const values=snapshot.settings;
  setControls({
   reverb:values.length?!!values[0]:true,
   amount:values.length?Math.round((values[3]??1)*100):100,
   swap:values.length?!!values[1]:false,
   tune:snapshot.tune,
  });
 },[snapshot.settings,snapshot.tune]);

 useEffect(()=>{
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key!=='F10'||event.repeat)return;
   event.preventDefault();event.stopImmediatePropagation();
   const tauri=(window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__;
   void tauri?.core?.invoke<boolean>('toggle_mt32_panel');
  };
  window.addEventListener('keydown',onKeyDown,true);return()=>window.removeEventListener('keydown',onKeyDown,true);
 },[]);

 const change=(key:'reverb'|'amount'|'swap',value:number)=>{
  if(!snapshot.powered)return;
  device.set(key==='reverb'?0:key==='amount'?3:1,key==='amount'?value/100:value);
  setControls(previous=>({...previous,[key]:key==='amount'?value:!!value}));
 };
 const tune=(value:number)=>{
  if(!snapshot.powered)return;
  device.panelWrite(mt32PanelTune(value));setControls(previous=>({...previous,tune:value}));
 };

 return <main className="mt32-desktop-window">
  <Mt32Panel device={snapshot.powered?device:undefined} lcd={snapshot.display.text} midiLight={snapshot.display.midi} powered={snapshot.powered}/>
  <div className="mt32-effects-viewport"><div className="mt32-controls mt32-external-controls mt32-sound-controls" aria-label="Roland sound controls">
   <div className="mt32-sound-control mt32-power"><span>POWER</span><button className="mt32-sound-button" disabled={!snapshot.host} aria-label={snapshot.powered||snapshot.starting?'Power off':'Power on'} aria-pressed={snapshot.powered} onClick={()=>send({type:'power'})}><i/>{snapshot.starting?'…':snapshot.powered?'ON':'OFF'}</button></div>
   <div className="mt32-sound-control"><span>REVERB</span><button className="mt32-sound-button" disabled={!snapshot.powered} aria-label="Reverb" aria-pressed={controls.reverb} onClick={()=>change('reverb',Number(!controls.reverb))}><i/>{controls.reverb?'ON':'OFF'}</button></div>
   <label className="mt32-sound-control mt32-sound-slider"><span>REVERB AMOUNT</span><div><input aria-label="Reverb amount" type="range" min="0" max="200" step="1" value={controls.amount} disabled={!snapshot.powered||!controls.reverb} onChange={event=>change('amount',Number(event.target.value))}/><output>{controls.amount}%</output></div></label>
   <div className="mt32-sound-control"><span>SWAP L/R</span><button className="mt32-sound-button" disabled={!snapshot.powered} aria-label="Swap left and right" aria-pressed={controls.swap} onClick={()=>change('swap',Number(!controls.swap))}><i/>{controls.swap?'ON':'OFF'}</button></div>
   <label className="mt32-sound-control mt32-sound-slider"><span>MASTER TUNE</span><div><input aria-label="Master tuning" type="range" min="0" max="127" step="1" value={controls.tune} disabled={!snapshot.powered} onChange={event=>tune(Number(event.target.value))}/><output>{(mt32PanelTuneTenths[controls.tune]/10).toFixed(1)}<small> Hz</small></output></div></label>
  </div></div>
  <p className="mt32-window-status" role="status">{!snapshot.host?'Waiting for PlayStunts DX…':snapshot.starting?'Powering on Roland MT-32…':snapshot.powered?'Connected to the MT-32 used by the game · F10 closes this window':'MT-32 is powered off · F10 closes this window'}</p>
 </main>;
}
