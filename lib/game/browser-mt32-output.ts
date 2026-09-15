import {createMt32WasmOutput,type Mt32Wasm} from './mt32-wasm-output.ts';
let loading:Promise<void>|undefined;
const bridgeVersion='20260910-queue-recovery';
type TauriGlobal={core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}};
async function loadRom(kind:'control'|'pcm',browserName:string,signal?:AbortSignal){
 const aborted=()=>{if(signal?.aborted)throw new DOMException('Roland audio closed','AbortError');};
 aborted();
 const tauri=(window as typeof window&{__TAURI__?:TauriGlobal}).__TAURI__;
 if(tauri?.core){
  const bytes=await tauri.core.invoke<number[]>('read_mt32_rom',{kind});
  aborted();
  return Uint8Array.from(bytes);
 }
 const response=await fetch('/game/mt32-local/'+browserName,{signal});
 if(!response.ok)throw Error('Roland ROM failed to load: '+browserName);
 return new Uint8Array(await response.arrayBuffer());
}
/** Load the local synthesizer independently of score or race ownership. */
export async function loadBrowserMt32Output(signal?:AbortSignal){
 const host=window as Window & {stuntsCreateMunt?:()=>Promise<Mt32Wasm>;stuntsMuntVersion?:string};
 const aborted=()=>{if(signal?.aborted)throw new DOMException('Roland audio closed','AbortError');};
 aborted();
 if(!host.stuntsCreateMunt||host.stuntsMuntVersion!==bridgeVersion){
  loading??=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.type='module';script.src='/mt32-local/bootstrap.mjs?v='+bridgeVersion;script.onload=()=>resolve();script.onerror=()=>{script.remove();loading=undefined;reject(Error('Roland synthesizer failed to load'));};document.head.appendChild(script);});
  await loading;
 }
 aborted();if(!host.stuntsCreateMunt||host.stuntsMuntVersion!==bridgeVersion)throw Error('Roland synthesizer is unavailable');
 const roms=await Promise.all([
  loadRom('control','ctrl_mt32_1_07.rom',signal),
  loadRom('pcm','pcm_mt32.rom',signal),
 ]);
 aborted();const module=await host.stuntsCreateMunt();
 try{aborted();return createMt32WasmOutput(module,roms[0],roms[1]);}catch(error){module._stunts_mt32_close();throw error;}
}
