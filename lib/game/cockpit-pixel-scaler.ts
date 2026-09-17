import type {CockpitPixelScalerMode} from './cockpit-pixel-scaler-settings';
import {xbrz4xCanvas} from './vendor-xbrz4x';

declare global{
 interface Window{hqx?:(image:HTMLCanvasElement,scale:number)=>HTMLCanvasElement;}
}

let hqxPromise:Promise<void>|undefined;

function ensureHqx(){
 if(typeof window==='undefined'||window.hqx)return Promise.resolve();
 if(hqxPromise)return hqxPromise;
 hqxPromise=new Promise<void>((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-playstunts-hqx]');
  if(existing){
   if(window.hqx){resolve();return;}
   existing.addEventListener('load',()=>resolve(),{once:true});
   existing.addEventListener('error',()=>reject(Error('HQx scaler could not load')),{once:true});
   return;
  }
  const script=document.createElement('script');
  script.src='/vendor/hqx.js';
  script.async=true;
  script.dataset.playstuntsHqx='1';
  script.onload=()=>resolve();
  script.onerror=()=>reject(Error('HQx scaler could not load'));
  document.head.append(script);
 }).catch(error=>{hqxPromise=undefined;throw error;});
 return hqxPromise;
}

function sourceCanvas(image:HTMLImageElement){
 const canvas=document.createElement('canvas');
 canvas.width=image.naturalWidth||image.width;
 canvas.height=image.naturalHeight||image.height;
 const context=canvas.getContext('2d');
 if(!context)return canvas;
 context.imageSmoothingEnabled=false;
 context.drawImage(image,0,0,canvas.width,canvas.height);
 return canvas;
}

export function scaleCockpitCanvas(source:HTMLCanvasElement,mode:CockpitPixelScalerMode):HTMLCanvasElement{
 if(mode==='off')return source;
 if(mode==='xbrz4x')return xbrz4xCanvas(source);
 if(!window.hqx){void ensureHqx().catch(()=>{});return source;}
 const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
 const context=copy.getContext('2d');if(!context)return source;
 context.imageSmoothingEnabled=false;context.drawImage(source,0,0);
 return window.hqx(copy,4);
}

export async function scaleCockpitImage(image:HTMLImageElement,mode:CockpitPixelScalerMode):Promise<HTMLImageElement|HTMLCanvasElement>{
 if(mode==='off')return image;
 const source=sourceCanvas(image);
 if(mode==='xbrz4x')return xbrz4xCanvas(source);
 await ensureHqx();
 if(!window.hqx)return image;
 return scaleCockpitCanvas(source,mode);
}

export function warmCockpitPixelScaler(mode:CockpitPixelScalerMode){
 if(mode==='hqx4x')void ensureHqx().catch(()=>{});
}
