import {cockpitMarker} from './cockpit-marker';
import {cockpitWheel} from './cockpit-wheel';
import {ENHANCED_TEXTURES_EVENT,enhancedCockpitEnabled,loadEnhancedTextureUrl} from './enhanced-textures';
import {composeCockpitPanel,type CockpitPanelLayer} from './cockpit-panel';

type SpriteFrame={file:string;x:number;y:number;width:number;height:number};
type CockpitLayout={dashboardTop:number;frames:Record<string,SpriteFrame>};
type AnchoredLayer=CockpitPanelLayer&{anchorX:number;anchorY:number};
type PanelData={
 palette:number[];
 layers:Record<string,CockpitPanelLayer>;
 gear:{base:CockpitPanelLayer;mask:AnchoredLayer;art:AnchoredLayer};
 marker:{points:number[][];mask:AnchoredLayer;art:AnchoredLayer};
};
type LoadedImage={image:HTMLImageElement;enhanced:boolean};
type MaskedSprite={canvas:HTMLCanvasElement;enhanced:boolean};
type DynamicSurface={canvas:HTMLCanvasElement;context:CanvasRenderingContext2D;image:ImageData};
type SnapshotSurface={canvas:HTMLCanvasElement;context:CanvasRenderingContext2D};
type LoadedCarAssets={layout:CockpitLayout;panel:PanelData;images:Map<string,LoadedImage>};
type CarAssets=LoadedCarAssets&{masked:Map<string,MaskedSprite>;dynamic?:DynamicSurface;replaySnapshot?:SnapshotSurface};
type DrawState={car:string;pixels:Uint8Array;steering:number;knobX:number;knobY:number;showGear:boolean};
type ReplayBarArt={keys:string[];resources:Record<string,number[]>};
type ReplayFrame={x:number;y:number;width:number;height:number;pixels:number[]};
type ReplayRect={x:number;y:number;width:number;height:number};
type ReplayOverlay={background:ReplayFrame;rects:ReplayRect[]};

const indexPromise=fetch('/game/cockpit/index.json').then(async response=>{
 if(!response.ok)throw Error('Cockpit index could not load');
 return response.json() as Promise<Record<string,CockpitLayout>>;
});

let replayOverlay:ReplayOverlay|undefined;
void fetch('/game/replay-bar-art.json').then(async response=>{
 if(!response.ok)return;
 const art=await response.json() as ReplayBarArt;
 const word=(bytes:number[],at:number)=>(bytes[at]??0)|((bytes[at+1]??0)<<8),signed=(value:number)=>value<<16>>16;
 const frames=art.keys.map(key=>{
  const bytes=art.resources[key];if(!bytes||bytes.length<16)return undefined;
  const width=word(bytes,0),height=word(bytes,2),x=signed(word(bytes,8)),y=signed(word(bytes,10));
  if(width<=0||height<=0||bytes.length<16+width*height)return undefined;
  return {x,y,width,height,pixels:bytes.slice(16,16+width*height)};
 }).filter((frame):frame is ReplayFrame=>!!frame);
 if(!frames.length)return;
 const rects:ReplayRect[]=[],seen=new Set<string>();
 const add=(x:number,y:number,width:number,height:number,padding=0)=>{
  const left=Math.max(0,x-padding),top=Math.max(0,y-padding),right=Math.min(320,x+width+padding),bottom=Math.min(200,y+height+padding);
  if(right<=left||bottom<=top)return;
  const key=`${left}/${top}/${right}/${bottom}`;if(seen.has(key))return;seen.add(key);
  rects.push({x:left,y:top,width:right-left,height:bottom-top});
 };
 for(const frame of frames)add(frame.x,frame.y,frame.width,frame.height,1);
 add(152,176,120,9,1);add(150,185,120,15,1);
 replayOverlay={background:frames[0],rects};
}).catch(()=>{});

function replayControlsVisible(data:ReplayOverlay,pixels:Uint8Array){
 const frame=data.background;if(pixels.length<64000)return false;
 let checked=0,matched=0;
 const step=Math.max(1,Math.floor(Math.sqrt(frame.width*frame.height/128)));
 for(let y=0;y<frame.height;y+=step)for(let x=0;x<frame.width;x+=step){
  const px=frame.x+x,py=frame.y+y;if(px<0||px>=320||py<0||py>=200)continue;
  checked++;if(pixels[py*320+px]===frame.pixels[y*frame.width+x])matched++;
 }
 return checked>=16&&matched/checked>=0.6;
}

function image(url:string){
 return new Promise<HTMLImageElement>((resolve,reject)=>{
  const result=new Image();
  result.decoding='async';
  result.onload=()=>resolve(result);
  result.onerror=()=>reject(Error(`Cockpit image could not load: ${url}`));
  result.src=url;
 });
}

async function preferredImage(original:string):Promise<LoadedImage>{
 try{
  const enhanced=await loadEnhancedTextureUrl(original);
  return {image:await image(enhanced),enhanced:true};
 }catch{return {image:await image(original),enhanced:false};}
}

const sharedLoads=new Map<string,Promise<LoadedCarAssets|undefined>>();
const sharedReady=new Map<string,LoadedCarAssets|undefined>();

function loadCar(car:string){
 let pending=sharedLoads.get(car);
 if(pending)return pending;
 pending=(async()=>{
  try{
   const index=await indexPromise,layout=index[car];if(!layout)return undefined;
   const response=await fetch(`/game/cockpit/${car}/panel.json`);if(!response.ok)return undefined;
   const panel=await response.json() as PanelData;
   const files=new Set<string>(['dashboard.png','dash.png','ins2.png','gbox.png','gnob.png','gnab.png','dot.png','dota.png','ins1.png','inm1.png','ins3.png','inm3.png']);
   for(const frame of Object.values(layout.frames))files.add(frame.file);
   const entries=await Promise.all([...files].map(async file=>{
    try{return [file,await preferredImage(`/game/cockpit/${car}/${file}`)] as const;}
    catch{return undefined;}
   }));
   const images=new Map<string,LoadedImage>();for(const entry of entries)if(entry)images.set(entry[0],entry[1]);
   return {layout,panel,images};
  }catch{return undefined;}
 })().then(value=>{sharedReady.set(car,value);return value;});
 sharedLoads.set(car,pending);return pending;
}

function warmEnhancedCockpits(){
 if(!enhancedCockpitEnabled())return;
 void indexPromise.then(index=>{for(const car of Object.keys(index))void loadCar(car);}).catch(()=>{});
}

function composeMaskedSprite(art:LoadedImage,mask:LoadedImage):MaskedSprite{
 const canvas=document.createElement('canvas');
 canvas.width=art.image.naturalWidth;canvas.height=art.image.naturalHeight;
 const context=canvas.getContext('2d')!;
 context.drawImage(art.image,0,0,canvas.width,canvas.height);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 const maskCanvas=document.createElement('canvas');maskCanvas.width=canvas.width;maskCanvas.height=canvas.height;
 const maskContext=maskCanvas.getContext('2d')!;maskContext.imageSmoothingEnabled=true;maskContext.drawImage(mask.image,0,0,canvas.width,canvas.height);
 const maskPixels=maskContext.getImageData(0,0,canvas.width,canvas.height).data;
 for(let at=0;at<pixels.data.length;at+=4){
  const preserve=(maskPixels[at]+maskPixels[at+1]+maskPixels[at+2])/3;
  pixels.data[at+3]=Math.round(pixels.data[at+3]*(255-preserve)/255);
 }
 context.putImageData(pixels,0,0);
 return {canvas,enhanced:art.enhanced||mask.enhanced};
}

warmEnhancedCockpits();

export function createEnhancedCockpitOverlay(){
 let enabled=enhancedCockpitEnabled(),closed=false;
 const sync=()=>{enabled=enhancedCockpitEnabled();if(enabled)warmEnhancedCockpits();};
 window.addEventListener(ENHANCED_TEXTURES_EVENT,sync);

 const ready=new Map<string,CarAssets|undefined>();
 const materialize=(loaded:LoadedCarAssets|undefined):CarAssets|undefined=>loaded?{...loaded,masked:new Map<string,MaskedSprite>()}:undefined;
 const ensure=(car:string)=>{
  if(ready.has(car))return ready.get(car);
  if(sharedReady.has(car)){
   const assets=materialize(sharedReady.get(car));ready.set(car,assets);return assets;
  }
  void loadCar(car).then(value=>{if(!closed)ready.set(car,materialize(value));});
  return undefined;
 };

 return {
  draw(context:CanvasRenderingContext2D,width:number,height:number,state:DrawState,offsetX=0){
   if(!enabled||closed)return false;
   const assets=ensure(state.car);if(!assets)return false;
   const {layout,panel,images}=assets,sx=width/320,sy=height/200;
   const activeReplay=replayOverlay&&replayControlsVisible(replayOverlay,state.pixels)?replayOverlay:undefined;
   let replaySnapshot:HTMLCanvasElement|undefined;
   if(activeReplay){
    if(!assets.replaySnapshot||assets.replaySnapshot.canvas.width!==width||assets.replaySnapshot.canvas.height!==height){
     const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;assets.replaySnapshot={canvas,context:canvas.getContext('2d')!};
    }
    replaySnapshot=assets.replaySnapshot.canvas;
    assets.replaySnapshot.context.setTransform(1,0,0,1,0,0);assets.replaySnapshot.context.clearRect(0,0,width,height);assets.replaySnapshot.context.drawImage(context.canvas,offsetX,0,width,height,0,0,width,height);
   }
   const draw=(source:CanvasImageSource,enhanced:boolean,x:number,y:number,w:number,h:number)=>{
    const sourceWidth='naturalWidth' in source?(source as HTMLImageElement).naturalWidth:(source as HTMLCanvasElement).width;
    const sourceHeight='naturalHeight' in source?(source as HTMLImageElement).naturalHeight:(source as HTMLCanvasElement).height;
    const scaleX=w?sourceWidth/w:1,scaleY=h?sourceHeight/h:1;
    const exactPixelScale=Math.abs(scaleX-scaleY)<1e-6&&scaleX>=1&&Math.abs(scaleX-Math.round(scaleX))<1e-6;
    context.imageSmoothingEnabled=enhanced&&!exactPixelScale;
    if(context.imageSmoothingEnabled)context.imageSmoothingQuality='high';
    context.drawImage(source,offsetX+x*sx,y*sy,w*sx,h*sy);
   };
   const drawFile=(file:string,x:number,y:number,w:number,h:number)=>{const entry=images.get(file);if(entry)draw(entry.image,entry.enhanced,x,y,w,h);};
   const masked=(artFile:string,maskFile:string)=>{
    const key=`${artFile}|${maskFile}`,cached=assets.masked.get(key);if(cached)return cached;
    const art=images.get(artFile),mask=images.get(maskFile);if(!art||!mask)return undefined;
    const sprite=composeMaskedSprite(art,mask);assets.masked.set(key,sprite);return sprite;
   };

   const roof=layout.frames.roof;if(roof)drawFile(roof.file,roof.x,roof.y,roof.width,roof.height);
   drawFile('dashboard.png',0,layout.dashboardTop,320,200-layout.dashboardTop);

   // dashboard.png is the fully composed reference dashboard and already
   // contains the gearbox base. The original renderer restores the clean
   // background when no shift animation is active, then redraws gbox/gnob only
   // while shifting. dash.png is that clean backing artwork.
   const gear=panel.gear,dash=images.get('dash.png');
   if(gear?.base&&dash){
    const logicalHeight=200-layout.dashboardTop;
    const sourceScaleX=dash.image.naturalWidth/320,sourceScaleY=dash.image.naturalHeight/logicalHeight;
    // Restore slightly beyond the animated gearbox rectangle. A hard crop at
    // x=gear.base.x can expose a one-pixel seam when a 4x nearest-neighbour
    // cockpit is scaled to the current viewport. The original renderer restores
    // a backing rectangle, so a small overlap is both safe and more faithful.
    const bleed=2;
    const left=Math.max(0,gear.base.x-bleed),top=Math.max(layout.dashboardTop,gear.base.y-bleed);
    const right=Math.min(320,gear.base.x+gear.base.width+bleed),bottom=Math.min(200,gear.base.y+gear.base.height+bleed);
    const sx0=left*sourceScaleX,sy0=(top-layout.dashboardTop)*sourceScaleY;
    const sw=(right-left)*sourceScaleX,sh=(bottom-top)*sourceScaleY;
    const dashScaleX=dash.image.naturalWidth/320,dashScaleY=dash.image.naturalHeight/logicalHeight,exactDashScale=Math.abs(dashScaleX-dashScaleY)<1e-6&&dashScaleX>=1&&Math.abs(dashScaleX-Math.round(dashScaleX))<1e-6;context.imageSmoothingEnabled=dash.enhanced&&!exactDashScale;if(context.imageSmoothingEnabled)context.imageSmoothingQuality='high';
    context.drawImage(dash.image,sx0,sy0,sw,sh,offsetX+left*sx,top*sy,(right-left)*sx,(bottom-top)*sy);
   }

   const wheel=cockpitWheel(state.steering),wheelFrame=layout.frames[`whl${wheel.frame+1}`];
   if(wheelFrame)drawFile(wheelFrame.file,wheelFrame.x,wheelFrame.y,wheelFrame.width,wheelFrame.height);

   const base=panel.layers.ins2;
   if(base){
    drawFile('ins2.png',base.x,base.y,base.width,base.height);
    let expected=new Uint8Array(base.pixels);
    if(wheel.frame!==1){
     const suffix=wheel.frame===0?'1':'3',mask=panel.layers[`inm${suffix}`],art=panel.layers[`ins${suffix}`];
     if(mask&&art)expected=composeCockpitPanel(expected,base.width,base.height,mask,art);
    }
    if(!assets.dynamic||assets.dynamic.canvas.width!==base.width||assets.dynamic.canvas.height!==base.height){
     const canvas=document.createElement('canvas');canvas.width=base.width;canvas.height=base.height;
     const dynamicContext=canvas.getContext('2d')!;assets.dynamic={canvas,context:dynamicContext,image:dynamicContext.createImageData(base.width,base.height)};
    }
    const dynamic=assets.dynamic;dynamic.image.data.fill(0);
    for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
     const logicalX=base.x+x,logicalY=base.y+y;if(logicalX<0||logicalX>=320||logicalY<0||logicalY>=200)continue;
     const current=state.pixels[logicalY*320+logicalX],at=y*base.width+x;
     if(current===expected[at])continue;
     const color=current*3,out=at*4;dynamic.image.data[out]=panel.palette[color];dynamic.image.data[out+1]=panel.palette[color+1];dynamic.image.data[out+2]=panel.palette[color+2];dynamic.image.data[out+3]=255;
    }
    dynamic.context.putImageData(dynamic.image,0,0);draw(dynamic.canvas,false,base.x,base.y,base.width,base.height);

    if(wheel.frame!==1){
     const suffix=wheel.frame===0?'1':'3',layer=panel.layers[`ins${suffix}`],sprite=masked(`ins${suffix}.png`,`inm${suffix}.png`);
     if(layer&&sprite)draw(sprite.canvas,sprite.enhanced,base.x+layer.x,base.y+layer.y,layer.width,layer.height);
    }
   }

   if(state.showGear&&gear?.base){
    drawFile('gbox.png',gear.base.x,gear.base.y,gear.base.width,gear.base.height);
    const sprite=masked('gnob.png','gnab.png');
    if(sprite)draw(sprite.canvas,sprite.enhanced,gear.base.x+state.knobX-gear.art.anchorX,gear.base.y+state.knobY-gear.art.anchorY,gear.art.width,gear.art.height);
   }

   const marker=panel.marker;
   if(marker?.points?.length){
    const sprite=masked('dot.png','dota.png');
    if(sprite){const position=cockpitMarker(marker.points,wheel.scaled);draw(sprite.canvas,sprite.enhanced,position.x-marker.art.anchorX,position.y-marker.art.anchorY,marker.art.width,marker.art.height);}
   }

   if(activeReplay&&replaySnapshot){
    context.imageSmoothingEnabled=false;
    for(const rect of activeReplay.rects){
     const x=rect.x*sx,y=rect.y*sy,w=rect.width*sx,h=rect.height*sy;
     context.drawImage(replaySnapshot,x,y,w,h,offsetX+x,y,w,h);
    }
   }
   return true;
  },
  close(){closed=true;window.removeEventListener(ENHANCED_TEXTURES_EVENT,sync);ready.clear();},
 };
}
