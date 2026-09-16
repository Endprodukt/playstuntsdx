'use client';
import {useEffect,useState,type CSSProperties,type ImgHTMLAttributes,type ReactNode} from 'react';
import cockpitIndex from '@/public/game/cockpit/index.json';
import {ENHANCED_TEXTURES_EVENT,enhancedTexturesEnabled,loadEnhancedTextureUrl} from '@/lib/game/enhanced-textures';
type Sprite={file:string;width:number;height:number;x:number;y:number;source:string};
type TextureProps=Omit<ImgHTMLAttributes<HTMLImageElement>,'src'>&{original:string;enhanced:boolean};

function TextureImage({original,enhanced,onLoad,...props}:TextureProps){
 const [src,setSrc]=useState(original);
 useEffect(()=>{
  let active=true;
  if(!enhanced){setSrc(original);return()=>{active=false;};}
  loadEnhancedTextureUrl(original).then(url=>{if(active)setSrc(url);}).catch(()=>{if(active)setSrc(original);});
  return()=>{active=false;};
 },[original,enhanced]);
 return <img {...props} src={src} onLoad={event=>{
  event.currentTarget.style.imageRendering=enhanced&&src!==original?'auto':'pixelated';
  onLoad?.(event);
 }}/>;
}

/** Shared original base artwork only. Instruments, masks and special dashboard
 * animations remain car-specific children; their presence in the asset manifest
 * does not imply that their original drawing behavior has been implemented.
 */
export default function CockpitArtwork({car,wheel,children}:{car:keyof typeof cockpitIndex;wheel:number;children:ReactNode}){
 const [enhancedTextures,setEnhancedTextures]=useState(false);
 useEffect(()=>{
  const sync=()=>setEnhancedTextures(enhancedTexturesEnabled());
  sync();window.addEventListener(ENHANCED_TEXTURES_EVENT,sync);
  return()=>window.removeEventListener(ENHANCED_TEXTURES_EVENT,sync);
 },[]);
 const layout=cockpitIndex[car],frames:Record<string,Sprite>=layout.frames;
 const height=200-layout.dashboardTop;
 const position=(frame:Sprite,top=0,totalHeight=200):CSSProperties=>({left:`${frame.x/320*100}%`,top:`${(frame.y-top)/totalHeight*100}%`,width:`${frame.width/320*100}%`,height:`${frame.height/totalHeight*100}%`});
 const path=(file:string)=>`/game/cockpit/${car}/${file}`;
 return <>
  {frames.roof&&<TextureImage original={path(frames.roof.file)} enhanced={enhancedTextures} className="cockpit-roof" alt="" aria-hidden="true" style={position(frames.roof)}/>}
  <div className="cockpit-art" aria-hidden="true" style={{height:`${height/200*100}%`}}>
   <div className="cockpit-layers">
    <TextureImage original={path('dashboard.png')} enhanced={enhancedTextures} className="cockpit-base" alt=""/>
    {[0,1,2].map(index=>{
     const frame=frames[`whl${index+1}`];
     if(!frame)throw Error(`Original ${car} wheel frame is missing`);
     return <TextureImage key={index} original={path(frame.file)} enhanced={enhancedTextures} className="cockpit-wheel" alt="" style={{...position(frame,layout.dashboardTop,height),visibility:index===wheel?'visible':'hidden'}}/>;
    })}
    {children}
   </div>
  </div>
 </>;
}