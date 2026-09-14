import {cockpitMarker} from './cockpit-marker';
import {cockpitWheel} from './cockpit-wheel';
import {ENHANCED_TEXTURES_EVENT,enhancedTextureUrl,enhancedTexturesEnabled} from './enhanced-textures';
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
type CarAssets={layout:CockpitLayout;panel:PanelData;images:Map<string,LoadedImage>};
type DrawState={car:string;pixels:Uint8Array;steering:number;knobX:number;knobY:number};

const indexPromise=fetch('/game/cockpit/index.json').then(async response=>{
 if(!response.ok)throw Error('Cockpit index could not load');
 return response.json() as Promise<Record<string,CockpitLayout>>;
});

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
 const enhanced=enhancedTextureUrl(original);
 try{return {image:await image(enhanced),enhanced:true};}
 catch{return {image:await image(original),enhanced:false};}
}

function maskedSprite(art:LoadedImage,mask:LoadedImage){
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

/** High-resolution cockpit presentation layered over the original native race.
 * The native framebuffer remains authoritative for live gauge pixels; only the
 * authored cockpit artwork is replaced. Missing hires files fall back per-file.
 */
export function createEnhancedCockpitOverlay(){
 let enabled=enhancedTexturesEnabled(),closed=false;
 const cache=new Map<string,Promise<CarAssets|undefined>>();
 const sync=()=>{enabled=enhancedTexturesEnabled();};
 window.addEventListener(ENHANCED_TEXTURES_EVENT,sync);

 const load=(car:string)=>{
  let pending=cache.get(car);
  if(pending)return pending;
  pending=(async()=>{
   try{
    const index=await indexPromise,layout=index[car];if(!layout)return undefined;
    const response=await fetch(`/game/cockpit/${car}/panel.json`);if(!response.ok)return undefined;
    const panel=await response.json() as PanelData;
    const files=new Set<string>(['dashboard.png','ins2.png','gbox.png','gnob.png','gnab.png','dot.png','dota.png','ins1.png','inm1.png','ins3.png','inm3.png']);
    for(const frame of Object.values(layout.frames))files.add(frame.file);
    const entries=await Promise.all([...files].map(async file=>{
     try{return [file,await preferredImage(`/game/cockpit/${car}/${file}`)] as const;}
     catch{return undefined;}
    }));
    const images=new Map<string,LoadedImage>();for(const entry of entries)if(entry)images.set(entry[0],entry[1]);
    return {layout,panel,images};
   }catch{return undefined;}
  })();
  cache.set(car,pending);return pending;
 };

 const ready=new Map<string,CarAssets|undefined>();
 const ensure=(car:string)=>{
  if(ready.has(car))return ready.get(car);
  void load(car).then(value=>{if(!closed)ready.set(car,value);});
  return undefined;
 };

 return {
  draw(context:CanvasRenderingContext2D,width:number,height:number,state:DrawState){
   if(!enabled||closed)return false;
   const assets=ensure(state.car);if(!assets)return false;
   const {layout,panel,images}=assets,sx=width/320,sy=height/200;
   const draw=(source:CanvasImageSource,enhanced:boolean,x:number,y:number,w:number,h:number)=>{
    context.imageSmoothingEnabled=enhanced;
    context.drawImage(source,x*sx,y*sy,w*sx,h*sy);
   };
   const drawFile=(file:string,x:number,y:number,w:number,h:number)=>{const entry=images.get(file);if(entry)draw(entry.image,entry.enhanced,x,y,w,h);};

   const roof=layout.frames.roof;if(roof)drawFile(roof.file,roof.x,roof.y,roof.width,roof.height);
   drawFile('dashboard.png',0,layout.dashboardTop,320,200-layout.dashboardTop);

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
    const dynamic=document.createElement('canvas');dynamic.width=base.width;dynamic.height=base.height;
    const dynamicContext=dynamic.getContext('2d')!,dynamicImage=dynamicContext.createImageData(base.width,base.height);
    for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
     const logicalX=base.x+x,logicalY=base.y+y;if(logicalX<0||logicalX>=320||logicalY<0||logicalY>=200)continue;
     const current=state.pixels[logicalY*320+logicalX],at=y*base.width+x;
     if(current===expected[at])continue;
     const color=current*3,out=at*4;dynamicImage.data[out]=panel.palette[color];dynamicImage.data[out+1]=panel.palette[color+1];dynamicImage.data[out+2]=panel.palette[color+2];dynamicImage.data[out+3]=255;
    }
    dynamicContext.putImageData(dynamicImage,0,0);draw(dynamic,false,base.x,base.y,base.width,base.height);

    if(wheel.frame!==1){
     const suffix=wheel.frame===0?'1':'3',layer=panel.layers[`ins${suffix}`],art=images.get(`ins${suffix}.png`),mask=images.get(`inm${suffix}.png`);
     if(layer&&art&&mask){const sprite=maskedSprite(art,mask);draw(sprite.canvas,sprite.enhanced,base.x+layer.x,base.y+layer.y,layer.width,layer.height);}
    }
   }

   const gear=panel.gear;
   if(gear?.base){
    drawFile('gbox.png',gear.base.x,gear.base.y,gear.base.width,gear.base.height);
    const art=images.get('gnob.png'),mask=images.get('gnab.png');
    if(art&&mask){const sprite=maskedSprite(art,mask);draw(sprite.canvas,sprite.enhanced,gear.base.x+state.knobX-gear.art.anchorX,gear.base.y+state.knobY-gear.art.anchorY,gear.art.width,gear.art.height);}
   }

   const marker=panel.marker;
   if(marker?.points?.length){
    const art=images.get('dot.png'),mask=images.get('dota.png');
    if(art&&mask){const position=cockpitMarker(marker.points,wheel.scaled),sprite=maskedSprite(art,mask);draw(sprite.canvas,sprite.enhanced,position.x-marker.art.anchorX,position.y-marker.art.anchorY,marker.art.width,marker.art.height);}
   }
   return true;
  },
  close(){closed=true;window.removeEventListener(ENHANCED_TEXTURES_EVENT,sync);cache.clear();ready.clear();},
 };
}
