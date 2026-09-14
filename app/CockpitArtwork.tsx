'use client';
import {useEffect,useState,type CSSProperties,type ReactNode,type SyntheticEvent} from 'react';
import cockpitIndex from '@/public/game/cockpit/index.json';
import {ENHANCED_TEXTURES_EVENT,enhancedTextureUrl,enhancedTexturesEnabled} from '@/lib/game/enhanced-textures';
type Sprite={file:string;width:number;height:number;x:number;y:number;source:string};
/** Shared original base artwork only. Instruments, masks and special dashboard
 * animations remain car-specific children; their presence in the asset manifest
 * does not imply that their original drawing behavior has been implemented.
 */
export default function CockpitArtwork({car,wheel,children}:{car:keyof typeof cockpitIndex;wheel:number;children:ReactNode}){
 const [enhancedTextures,setEnhancedTextures]=useState(true);
 useEffect(()=>{
  const sync=()=>setEnhancedTextures(enhancedTexturesEnabled());
  sync();window.addEventListener(ENHANCED_TEXTURES_EVENT,sync);
  return()=>window.removeEventListener(ENHANCED_TEXTURES_EVENT,sync);
 },[]);
 const layout=cockpitIndex[car],frames:Record<string,Sprite>=layout.frames;
 const height=200-layout.dashboardTop;
 const position=(frame:Sprite,top=0,totalHeight=200):CSSProperties=>({left:`${frame.x/320*100}%`,top:`${(frame.y-top)/totalHeight*100}%`,width:`${frame.width/320*100}%`,height:`${frame.height/totalHeight*100}%`});
 const source=(original:string)=>enhancedTextures?enhancedTextureUrl(original):original;
 const fallback=(original:string)=>(event:SyntheticEvent<HTMLImageElement>)=>{
  const image=event.currentTarget;
  if(new URL(image.src).pathname!==original)image.src=original;
 };
 const loaded=(event:SyntheticEvent<HTMLImageElement>)=>{
  event.currentTarget.style.imageRendering=new URL(event.currentTarget.src).pathname.startsWith('/game/hires/')?'auto':'pixelated';
 };
 const path=(file:string)=>`/game/cockpit/${car}/${file}`;
 return <>
  {frames.roof&&<img className="cockpit-roof" src={source(path(frames.roof.file))} onError={fallback(path(frames.roof.file))} onLoad={loaded} alt="" aria-hidden="true" style={position(frames.roof)}/>}
  <div className="cockpit-art" aria-hidden="true" style={{height:`${height/200*100}%`}}>
   <div className="cockpit-layers">
    <img className="cockpit-base" src={source(path('dashboard.png'))} onError={fallback(path('dashboard.png'))} onLoad={loaded} alt=""/>
    {[0,1,2].map(index=>{
     const frame=frames[`whl${index+1}`];
     if(!frame)throw Error(`Original ${car} wheel frame is missing`);
     const original=path(frame.file);
     return <img key={index} className="cockpit-wheel" src={source(original)} onError={fallback(original)} onLoad={loaded} alt="" style={{...position(frame,layout.dashboardTop,height),visibility:index===wheel?'visible':'hidden'}}/>;
    })}
    {children}
   </div>
  </div>
 </>;
}
