'use client';
import {lazy,Suspense,type ComponentProps} from 'react';

type RuntimeOpeningSequence=typeof import('./OpeningSequenceRuntime').default;
type OpeningSequenceProps=ComponentProps<RuntimeOpeningSequence>;

const importRuntimeOpeningSequence=()=>import('./OpeningSequenceRuntime');
let runtimeOpeningSequencePromise:ReturnType<typeof importRuntimeOpeningSequence>|undefined;
const loadRuntimeOpeningSequence=()=>runtimeOpeningSequencePromise??=importRuntimeOpeningSequence();
export const preloadOpeningSequenceRuntime=()=>loadRuntimeOpeningSequence();
const RuntimeOpeningSequence=lazy(loadRuntimeOpeningSequence);

function LoadingArtwork({embedded=false}:{embedded?:boolean}){
 return <section className={embedded?'launcher-game-session':undefined} aria-busy="true">
  <div className={embedded?'launcher-screen':undefined}>
   <canvas width={1280} height={800} aria-label="Loading Stunts" style={{width:embedded?'100%':'min(100%, calc((100dvh - 220px) * 4 / 3))',height:'auto',aspectRatio:'4 / 3',margin:'0 auto',display:'block',background:'#000',imageRendering:'auto'}}/>
   <div className="launcher-screen-idle stunts-game-idle">
    <img className="stunts-idle-art" src="/game/menu.png" alt=""/>
    <div className="stunts-idle-shade"/>
    <button className="launcher-play" disabled>LOADING STUNTS…</button>
   </div>
  </div>
 </section>;
}

/** Keep the initial artwork stable while the complete game/runtime bundle is
 * loaded on demand. The actual DX opening component is unchanged and therefore
 * retains custom cars, controls, audio, high-res artwork and renderer hooks. */
export default function OpeningSequence(props:OpeningSequenceProps){
 return <Suspense fallback={<LoadingArtwork embedded={props.embedded}/>}><RuntimeOpeningSequence {...props}/></Suspense>;
}
