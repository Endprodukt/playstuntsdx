/** Supplied main dispatcher 2ab8..2b2c / 2c55..2c89. Submenus share the
 * live 24-byte configuration; race entry receives its own snapshot (DS:9b44).
 * Intro and race execution belong to the caller, as in the original program.
 */
export interface NativeMenuServices {
 configuration:number[];
 main():Promise<number|{selection:number;idleExpired:number}>;
 car():Promise<void>;
 opponent():Promise<void>;
 track():Promise<void|'drive'>;
 editor?():Promise<void|'drive'>;
 replay?():Promise<boolean>;
 options():Promise<'menu'|'replay'|'exit'>;
}
export type NativeMenuTransition={type:'intro'|'exit'}|{type:'drive'|'replay'|'demo';configuration:number[]};
export async function runNativeMenuCoordinator(host:NativeMenuServices):Promise<NativeMenuTransition>{
 for(;;){
  const main=await host.main(),selection=typeof main==='number'?main:main.selection;
  if(selection===-2)return {type:'exit'};
  if(selection===-3){if(host.editor&&await host.editor()==='drive')return {type:'drive',configuration:host.configuration.slice(0,24)};continue;}
  if(selection===-4){if(host.replay&&await host.replay())return {type:'replay',configuration:host.configuration.slice(0,24)};continue;}
  if(selection===-1)return {type:'intro'};
  if(selection===0)return {type:typeof main!=='number'&&main.idleExpired?'demo':'drive',configuration:host.configuration.slice(0,24)};
  if(selection===1)await host.car();
  else if(selection===2)await host.opponent();
  else if(selection===3){if(await host.track()==='drive')return {type:'drive',configuration:host.configuration.slice(0,24)};}
  else if(selection===4){
   const result=await host.options();
   if(result==='exit')return {type:'exit'};
   if(result==='replay')return {type:'replay',configuration:host.configuration.slice(0,24)};
  }
 }
}
