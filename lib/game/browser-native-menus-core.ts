import {bundledTrackReplays} from './bundled-track-replays.ts';
import showroomMaterials from '../../public/game/track-materials.json';
import {createUpgradedCarMenu} from './upgraded-car-menu';
import {createOriginalCarMenuModel} from './car-menu-model.ts';
import type {createUpgradedRaceScene} from './upgraded-race-scene';
export interface BrowserGraphicsSwitch {enabled:boolean;chaseCamera?:0|1|2|3;selectOriginalCamera?:()=>void;refresh?:()=>void;notice?:(message:string)=>void;performanceFrame?:(at:number)=>void;resetPerformance?:()=>void;setPerformancePaused?:(paused:boolean)=>void;}
import {focusBrowserGameCanvas} from './browser-game-focus.ts';
import {createBrowserHerculesPresenter} from './browser-hercules-presenter.ts';
import {prepareBrowserNativeMainMenu} from './browser-native-display-race.ts';
import {createNativeDisplayOptionsPresentation} from './native-display-options-presentation.ts';
import {prepareBrowserNativeMenuDisplay} from './browser-native-display-race.ts';
import {createNativeDisplayTrackPresentation} from './native-display-track-presentation.ts';
import {prepareBrowserNativeTrackDisplay} from './browser-native-display-race.ts';
import {createNativeDisplayCarPresentation} from './native-display-car-presentation.ts';
import {prepareBrowserNativeCarDisplay,prepareBrowserNativeOpponentDisplay} from './browser-native-display-race.ts';
import {loadBrowserOriginalResourceCatalog} from './native-resource-catalog.ts';
import {createNativeDisplayResultsPresentation} from './native-display-results-presentation.ts';
import {prepareBrowserNativeResultsDisplay,type NativeBrowserDisplayMode} from './browser-native-display-race.ts';
import {drawOriginalRaceWaitingDisplay} from './race-waiting-display.ts';
import {editNativeDisplaySaveName} from './native-display-save-name.ts';
import {editNativeDisplayPath} from './native-display-path-entry.ts';
import {drawOriginalDialogDisplay} from './dialog-display.ts';
import {restoreOriginalDisplayWindow} from './select-display-window.ts';
import {createNativeDisplayDialogRuntime} from './native-display-dialog-runtime.ts';
import {captureNativeDisplayDialogBackground} from './native-display-dialog-background.ts';
import type {prepareBrowserNativeManualDisplay} from './browser-native-display-race.ts';
import {runAllocatedRaceResults} from './native-allocated-race-results.ts';
import {drawOriginalRaceWaiting} from './race-waiting-dialog.ts';
import {loadAllocatedReplay,type AllocatedReplayLoadServices} from './allocated-replay-load.ts';
import type {NativeDemoData} from './native-demo-runtime.ts';
import {selectAllocatedMouseControl,selectAllocatedGraphicsLevel} from './allocated-mouse-selection.ts';
import {drawOriginalFont,measureOriginalFont} from './font-raster.ts';
import {originalElapsedInputTicks} from './elapsed-input-ticks.ts';
import type {createNativeManualRaceRuntime} from './native-manual-race-runtime.ts';
import {createNativeReplayBar,type NativeReplayBarArt} from './native-replay-bar.ts';
import {saveNativeReplay} from './native-replay-save.ts';
import type {createNativeRaceSession} from './native-race-session.ts';
import {runNativeMenuCoordinator} from './native-menu-coordinator.ts';
import {runNativeMainMenuSelection} from './native-main-menu.ts';
import {restoreOriginalMainMenuPixels} from './main-menu-raster.ts';
import {originalMainMenuBounds} from './main-menu-hit.ts';
import {ENHANCED_TEXTURES_EVENT,enhancedBackgroundEnabled} from './enhanced-textures.ts';
import {ENHANCED_FOV_EVENT,enhancedRaceAspect} from './enhanced-view-settings.ts';
import {runNativeCarMenu,type NativeCarMenuHost,type NativeMenuCar} from './native-car-runtime.ts';
import {carIdFromConfiguration,rememberCurrentPlayerCar} from './current-player-car.ts';
import {createEnhancedCarMenuPresentation} from './enhanced-car-menu-presentation.ts';
import {runModernCarMenu,type ModernCarMenuAction,type ModernCarMenuHost} from './modern-car-menu-runtime.ts';
import {runNativeOpponentMenu,type NativeOpponentHost} from './native-opponent-runtime.ts';
import {enhancedMenuEnabled,modernTrackEditorEnabled,runNativeOptions,type NativeOptionsHost} from './native-options-runtime.ts';
import {enhancedRenderResolution} from './enhanced-resolution-settings.ts';
import {createEnhancedTrackMenuPresentation} from './enhanced-track-menu-presentation.ts';
import {runModernTrackMenu,type ModernTrackMenuAction,type ModernTrackMenuHost} from './modern-track-menu-runtime.ts';
import {runModernOptionsMenu} from './modern-options-menu.ts';
import {runNativeTrackMenu,type NativeTrackMenuHost} from './native-track-runtime.ts';
import {runNativeEditor,type NativeEditorHost} from './native-editor-runtime.ts';
import {createBrowserMenuInput} from './browser-menu-input.ts';
import {raceGraphicsTransition} from './race-graphics-transition.ts';
import {createNativeFileStore,openNativeFilePersistence,nativeFileKey} from './native-file-store.ts';
import {createNativeEditorFileWrites} from './native-editor-file-writes.ts';
import {editNativeSaveName} from './native-save-name.ts';
import {editNativePath} from './native-path-entry.ts';
import {expandEditorArt} from './editor-art-expand.ts';
import {drawOriginalDialog} from './dialog-raster.ts';
import {createOriginalJoystickCalibration} from './joystick-calibration.ts';
import {decodeOriginalReplayFile} from './replay-file.ts';
import type {createNativeMusic} from './native-music.ts';
import type {NativeDialogHost} from './native-dialog-runtime.ts';
import {createNativeDialogRuntime} from './native-dialog-runtime.ts';
import {runNativeRaceResults,type NativeRaceResultsState,type NativeRaceResultsHost,type NativeEvaluationResources} from './native-race-results.ts';
import type {NativeHighScorePreparationHost} from './native-high-score-preparation.ts';
import type {Assets} from './types.ts';
import {blissOriginalSceneryPreview} from './bliss-scenery-preview.ts';
import {clearRaceMapFrame,publishRaceMapFrame} from './race-map-state.ts';
import {RACE_TELEPORT_EVENT,type RaceSpawn} from './race-spawn.ts';
const HIRES_MAIN_MENU='/game/hires/main-menu.png';
type TextResources={resources:NativeDialogHost['resources']};
type ScreenResources=NativeEditorHost['screenResources'];
type RouteResources=NativeEditorHost['routeResources'];
export interface BrowserNativeMenuOptions {
 graphics?:BrowserGraphicsSwitch;canvas:HTMLCanvasElement;assets:Assets;music:Awaited<ReturnType<typeof createNativeMusic>>;
 settings?:NativeOptionsHost['settings'];signal?:AbortSignal;audioContext?:AudioContext;displayMode?:NativeBrowserDisplayMode;hercules?:boolean;configuration?:number[];track?:NativeTrackMenuHost['track'];onScreen?:(screen:string)=>void;
}
/** Browser services for the native menus. The caller handles intro/race/exit
 * transitions; all submenus use the same live configuration and file overlay. */
export async function createBrowserNativeMenus(options:BrowserNativeMenuOptions){
 const json=async<T>(name:string):Promise<T>=>{const r=await fetch('/game/'+name+'.json');if(!r.ok)throw Error('Original menu resource could not load: '+name);return r.json() as Promise<T>;};
 const binary=async(name:string)=>{const r=await fetch('/game/'+name);if(!r.ok)throw Error('Original menu resource could not load: '+name);return new Uint8Array(await r.arrayBuffer());};
 const [misc,mainText,trackText,materials,font,smallFont,baseline,ground,panoramas,opponentArt,carArt,objects,records,errorKeys,scores]=await Promise.all([
  json<TextResources>('misc-dialog-text'),json<TextResources>('main-dialog-text'),json<TextResources>('track-menu-text'),json<{palette:number[]}>('track-materials'),binary('fontdef.fnt'),binary('fontn.fnt'),binary('native-render-resources.bin'),json<{resources:NativeTrackMenuHost['groundModels']}>('overview-ground-models'),json<NativeTrackMenuHost['panoramas']>('menu-panorama-art'),json<{resources:NativeOpponentHost['art'];descriptions:NativeOpponentHost['descriptions']}>('opponent-menu-art'),json<{resources:NativeCarMenuHost['art'];descriptions:NativeCarMenuHost['descriptions']}>('car-menu-art'),json<ScreenResources['objects']>('track-objects'),json<RouteResources['records']>('route-records'),json<{keys:string[]}>('editor-error-keys'),json<Record<string,{file:string}>>('high-scores/manifest'),
 ]);

 const mainMenuArt=await binary('main-menu-art.bin');
 const highResMainMenu=new Image();let highResMainMenuReady=false,enhancedTextures=enhancedBackgroundEnabled();
 const syncEnhancedTextures=()=>{enhancedTextures=enhancedBackgroundEnabled();options.graphics?.refresh?.();};
 window.addEventListener(ENHANCED_TEXTURES_EVENT,syncEnhancedTextures);
 const syncEnhancedFov=()=>options.graphics?.refresh?.();window.addEventListener(ENHANCED_FOV_EVENT,syncEnhancedFov);
 highResMainMenu.decoding='async';
 highResMainMenu.onload=()=>{highResMainMenuReady=true;options.graphics?.refresh?.();};
 highResMainMenu.onerror=()=>{highResMainMenuReady=false;};
 highResMainMenu.src=HIRES_MAIN_MENU;
 const original=bundledTrackReplays(options.assets.tracks,binary);
 for(const [name,entry] of Object.entries(scores))original.set(nativeFileKey('',name,'.hig'),()=>binary('high-scores/'+entry.file));
 const desktopTauri=!!(window as typeof window&{__TAURI__?:unknown}).__TAURI__;
 // On desktop, physical files in Custom Tracks are the canonical track source.
 // Keep .TRK writes only for the current session so deleting a Custom Tracks
 // file cannot be resurrected by the legacy IndexedDB overlay on the next run.
 const files=await createNativeFileStore(original,await openNativeFilePersistence(),desktopTauri?{volatileExtensions:['.TRK']}:{});
 const drivingSettings={...(options.settings??{mouse:false,joystick:false,graphics:2})};
 const storedOriginalGraphics=Number(window.localStorage.getItem('playstunts-dx-original-graphics-level'));if(Number.isFinite(storedOriginalGraphics)&&storedOriginalGraphics>=0&&storedOriginalGraphics<=3)drivingSettings.graphics=Math.round(storedOriginalGraphics);
 let activeRace:Awaited<ReturnType<typeof createNativeManualRaceRuntime>>|undefined,racePoll:(()=>void|Promise<void>)|undefined;
 const presentHercules=options.hercules?createBrowserHerculesPresenter(options.canvas):undefined;
 const {canvas,music}=options,nativeCanvasWidth=canvas.width,nativeCanvasHeight=canvas.height,context=canvas.getContext('2d')!,surface=document.createElement('canvas');surface.width=320;surface.height=200;
 const resetRaceCanvas=()=>{canvas.removeAttribute('data-enhanced-widescreen');canvas.style.removeProperty('--dx-race-aspect');if(canvas.width!==nativeCanvasWidth)canvas.width=nativeCanvasWidth;if(canvas.height!==nativeCanvasHeight)canvas.height=nativeCanvasHeight;};
 const drawing=surface.getContext('2d')!,image=drawing.createImageData(320,200),pixels=new Uint8Array(65536),input=createBrowserMenuInput(canvas,{joystickEnabled:()=>activeRace?!!activeRace.session.state.memory[0x2d1a0+0x4602]:drivingSettings.joystick,drivingBindings:()=>activeRace?activeRace.session.state.memory.subarray(0x2d1a0+0x430a,0x2d1a0+0x4314):[57,28,71,72,73,77,81,80,79,75],onPoll:()=>{if(options.signal?.aborted)throw new DOMException('Native menu closed','AbortError');return racePoll?.();}}),palette=materials.palette;
 const readReplayInput=async(memory:()=>Uint8Array,delta?:number|(()=>number))=>{
  const key=await input.readMemory(memory,0x2d1a0,delta),m=memory(),view=new DataView(m.buffer,m.byteOffset,m.byteLength),at=0x2d1a0+0x9ad4;
  view.setUint16(at,view.getUint16(at,true)|input.replayActivationButtons(),true);
  return key;
 };
 const configuration=options.configuration??[67,79,85,78,0,1,0,255,0,0,0,0,0,68,69,70,65,85,76,84,0,0,1,0];
 rememberCurrentPlayerCar(carIdFromConfiguration(configuration));
 const track=options.track??{name:'DEFAULT',path:'',raw:[...options.assets.tracks.find(t=>t.name==='DEFAULT')!.raw]};
 let entryPolls=0,selectedReplay:{bytes:Uint8Array;name:string;path:string}|undefined,pendingRaceSpawn:RaceSpawn|undefined,editorViewMode:'2d'|'3d'='2d',editor3DCamera:import('./bliss-editor-3d.ts').BlissEditor3DCameraState|undefined;
 // Original1AD1C forwards its literal1 to the complete device poll.
 // Fast-forward simulation is not gated to one browser frame per step.
 const fastForwardKey=async()=>{if((entryPolls++&15)===0)await input.nextFrame();return input.readImmediate(1).key;};
 let screen='main',outline:[number,number]|undefined,replay:ReturnType<typeof decodeOriginalReplayFile>|undefined;
 const show=(name:string)=>{
  screen=name;
  if(name!=='race'){
   // Widescreen FOV belongs exclusively to the enhanced race renderer.
   // Every native 320x200 menu/result/evaluation screen must return to the
   // normal 4:3 desktop presentation before it is painted.
   resetRaceCanvas();
   canvas.style.cursor='';
   if(options.graphics?.enabled)options.graphics.notice?.('Upgraded graphics selected · experimental');
  }
  options.onScreen?.(name);
 };
 let lastNativeDisplay:Awaited<ReturnType<typeof prepareBrowserNativeMenuDisplay>>|undefined;
 const paint=(displayPalette=palette,nativeDisplay?:Awaited<ReturnType<typeof prepareBrowserNativeMenuDisplay>>,scanoutOwner?:{memory():Uint8Array;d:number})=>{
  if(options.graphics)options.graphics.refresh=screen==='main'?()=>paint(displayPalette,nativeDisplay,scanoutOwner):undefined;
  if(nativeDisplay)lastNativeDisplay=nativeDisplay;
  if(presentHercules){const owner=scanoutOwner??lastNativeDisplay?.owner;if(!owner)throw Error('Native Hercules display owner is missing');presentHercules(owner);return;}
  context.setTransform(1,0,0,1,0,0);context.imageSmoothingEnabled=false;
  if(screen==='main'&&!options.displayMode)restoreOriginalMainMenuPixels(pixels,mainMenuArt,outline);
  for(let i=0;i<64000;i++){const c=pixels[i];image.data[i*4]=displayPalette[c*3];image.data[i*4+1]=displayPalette[c*3+1];image.data[i*4+2]=displayPalette[c*3+2];image.data[i*4+3]=255;}drawing.putImageData(image,0,0);
  if(screen==='main'&&!options.displayMode&&enhancedTextures&&highResMainMenuReady){
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(highResMainMenu,0,0,canvas.width,canvas.height);
   if(outline){const [selection,color]=outline,[left,top,right,bottom]=originalMainMenuBounds[selection],sx=canvas.width/320,sy=canvas.height/200,c=color*3;context.fillStyle=`rgb(${displayPalette[c]} ${displayPalette[c+1]} ${displayPalette[c+2]})`;context.fillRect(left*sx,top*sy,(right-left+1)*sx,sy);context.fillRect(left*sx,bottom*sy,(right-left+1)*sx,sy);context.fillRect(left*sx,top*sy,sx,(bottom-top+1)*sy);context.fillRect(right*sx,top*sy,sx,(bottom-top+1)*sy);}
  }else context.drawImage(surface,0,0,canvas.width,canvas.height);
 };
 const present=()=>paint();
 const host={pixels,font,smallFont,resources:{...misc.resources,...mainText.resources},present,input:input.read,release:input.release,gameCounter:input.gameCounter,counter:input.counter,waitTicks:input.waitTicks,enumerate:async(path:string,extension:string)=>files.enumerate(path,extension),editPath:(path:string,length:number,timeout:number,field:{x:number;y:number})=>editNativePath({pixels,font,present,counters:input.counters,keyboard:input.keyboard},path,length,timeout,field)};
 const trackHost={...host,resources:{...host.resources,...trackText.resources}};
 // Normal source mouse polling writes DS:893A, not the adjacent editor row
 // word DS:A38C. Keep that word from the captured initialized source image.
 let editorResourcesPromise:Promise<{editor:NativeEditorHost;art:Array<ScreenResources['art'][number]&{labelResource:string}>;terrainNames:{names:ScreenResources['terrainNames']};presets:NativeEditorHost['presets']}>|undefined;
 const loadEditorResources=()=>editorResourcesPromise??=Promise.all([
  json<Array<ScreenResources['art'][number]&{labelResource:string}>>('editor-tile-art'),
  json<{bytes:number[]}>('editor-palette-memory'),
  json<{names:ScreenResources['terrainNames']}>('editor-terrain-art'),
  json<{resources:Record<string,{bytes:number[]}>}>('editor-art'),
  json<RouteResources['metadataVectors']>('route-vectors'),
  json<RouteResources['sampleVectors']>('route-sample-vectors'),
  json<NativeEditorHost['presets']>('editor-terrain-presets'),
 ]).then(([art,paletteMemory,terrainNames,packedArt,metadataVectors,sampleVectors,presets])=>{
  const editor:NativeEditorHost={...trackHost,track,mainFrameBP:0xeefe,retainedMouseButtons:()=>baseline[0x2d1a0+0xa38c]|baseline[0x2d1a0+0xa38d]<<8,screenResources:{font,text:trackHost.resources,objects,art,labelKeys:art.map(a=>a.labelResource),pages:Array.from({length:11},(_,i)=>paletteMemory.bytes.slice(i*36)),terrainNames:terrainNames.names,images:Object.fromEntries(Object.entries(packedArt.resources).filter(([name])=>name!=='!cg0').map(([name,r])=>[name,expandEditorArt(r.bytes)]))},routeResources:{objects,records,metadataVectors,sampleVectors},presets,errorKeys:errorKeys.keys,saveName:state=>editNativeSaveName(trackHost,state,'Track'),exists:async(path,name)=>files.exists(path,name,'.trk'),...createNativeEditorFileWrites(files),readTrack:(path,name)=>files.read(path,name,'.trk')};
  return {editor,art,terrainNames,presets};
 });
 const car=async(config:number[],opponent:number)=>{
  show('car');focusBrowserGameCanvas(canvas);
  let carAssetRevision=0;
  const bank=async(id:string)=>{
   const response=await fetch('/game/car-models/'+id.toLowerCase()+'.bin?v='+carAssetRevision);
   if(!response.ok)throw Error('Car model could not load: '+id);
   return new Uint8Array(await response.arrayBuffer());
  };
  const carHost:NativeCarMenuHost={...host,configuration:config,opponent,opponentArt:opponent?opponentArt.resources['opp'+opponent]:undefined,baseline,cars:options.assets.cars as unknown as NativeCarMenuHost['cars'],art:carArt.resources,descriptions:carArt.descriptions,bank};
  if(enhancedMenuEnabled()){
   const actions:ModernCarMenuAction[]=[];
   let modernShowroom:ReturnType<typeof createUpgradedCarMenu>|undefined;
   const modernPreview=async(car:NativeMenuCar,paint:number)=>{
    const bankBytes=await bank(car.id),target=new Uint8Array(65536);
    let modelMemory:Uint8Array|undefined;
    const model=createOriginalCarMenuModel(baseline,bankBytes,carArt.resources.stop,(memory)=>{modelMemory=memory;});
    const paintCount=Math.max(1,model.paintCount|0),safePaint=Math.max(0,Math.min(paint,paintCount-1));
    model.render(target,0,safePaint);
    if(!modelMemory)return null;
    modernShowroom??=createUpgradedCarMenu(palette,showroomMaterials.indices);
    // The original showroom projection is authored for the 320x200 Stunts
    // viewport. Keep that 1.6:1 render aspect here; rendering it into a wider
    // target stretches the car before the menu compositor ever sees it.
    // Use the same full 320x200-based internal resolution as the race renderer.
    // The menu crops/composites this render afterwards; it must not lower the
    // 3D resolution merely because the preview rectangle itself is smaller.
    const snapshot=document.createElement('canvas');
    const initial=enhancedRenderResolution();snapshot.width=initial.width;snapshot.height=initial.height;
    const snapshotContext=snapshot.getContext('2d');if(!snapshotContext)return null;
    const memory=modelMemory;
    const renderAngle=(angle:number,pitch=0,zoom=1)=>{
     const internal=enhancedRenderResolution();
     if(snapshot.width!==internal.width)snapshot.width=internal.width;
     if(snapshot.height!==internal.height)snapshot.height=internal.height;
     new DataView(memory.buffer,memory.byteOffset,memory.byteLength).setInt16(0x2d1a0+0xb00e,angle&1023,true);
     const rendered=modernShowroom!.draw(memory,internal.width,internal.height,{pitch,zoom});
     snapshotContext.clearRect(0,0,snapshot.width,snapshot.height);snapshotContext.drawImage(rendered,0,0);
    };
    renderAngle(0);
    return {canvas:snapshot,paintCount,render:renderAngle};
   };
   const modern=createEnhancedCarMenuPresentation({canvas,palette,preview:modernPreview});
   const pickZip=()=>new Promise<File|null>(resolve=>{
    const picker=document.createElement('input');picker.type='file';picker.accept='.zip,application/zip';picker.style.display='none';
    const finish=(file:File|null)=>{picker.remove();resolve(file);};
    picker.addEventListener('change',()=>finish(picker.files?.[0]??null),{once:true});
    picker.addEventListener('cancel',()=>finish(null),{once:true});
    document.body.appendChild(picker);picker.click();
   });
   const refreshCars=async()=>{
    const stamp=Date.now();
    const [assetsResponse,artResponse]=await Promise.all([fetch('/game/assets.json?v='+stamp),fetch('/game/car-menu-art.json?v='+stamp)]);
    if(!assetsResponse.ok||!artResponse.ok)throw Error('Refreshed custom car assets could not be loaded.');
    const nextAssets=await assetsResponse.json() as Assets;
    const nextArt=await artResponse.json() as {resources:NativeCarMenuHost['art'];descriptions:NativeCarMenuHost['descriptions']};
    options.assets.cars.splice(0,options.assets.cars.length,...nextAssets.cars);
    for(const key of Object.keys(options.assets.shapes))delete options.assets.shapes[key];
    Object.assign(options.assets.shapes,nextAssets.shapes);
    Object.assign(carArt.resources,nextArt.resources);Object.assign(carArt.descriptions,nextArt.descriptions);
    carAssetRevision++;return options.assets.cars as unknown as readonly NativeMenuCar[];
   };
   const modernHost:ModernCarMenuHost={...carHost,
    takeModernAction:()=>actions.shift(),
    refreshCars,
    async importCar(){
     const selected=await pickZip();if(!selected)return null;
     const before=new Set(options.assets.cars.map(item=>item.id));
     const core=(window as typeof window&{__TAURI__?:{core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}}}).__TAURI__?.core;
     if(!core){window.alert('Custom car import is available in the desktop build.');return null;}
     const bytes=new Uint8Array(await selected.arrayBuffer());
     try{await core.invoke<void>('import_custom_car_package',{filename:selected.name,data:Array.from(bytes)});}
     catch(reason){window.alert('Custom car import failed: '+(reason instanceof Error?reason.message:String(reason)));return null;}
     const cars=await refreshCars(),added=cars.find(item=>!before.has(item.id));
     if(!added){window.alert('The ZIP was imported, but no new valid Stunts car was found.');return null;}
     return {id:added.id};
    }
   };
   let rotating=false,lastRotateX=0,lastRotateY=0;
   const pointerDown=(event:PointerEvent)=>{
    if(event.button!==0)return;
    if(modern.inPreview(event)){
     event.preventDefault();event.stopImmediatePropagation();rotating=true;lastRotateX=event.clientX;lastRotateY=event.clientY;modern.beginRotate();canvas.setPointerCapture(event.pointerId);return;
    }
    const action=modern.actionAt(event);if(action.type==='none')return;
    event.preventDefault();event.stopImmediatePropagation();actions.push(action);
   };
   const pointerMove=(event:PointerEvent)=>{
    if(rotating){event.preventDefault();event.stopImmediatePropagation();const dx=event.clientX-lastRotateX,dy=event.clientY-lastRotateY;lastRotateX=event.clientX;lastRotateY=event.clientY;modern.rotateBy(dx,dy);return;}
    modern.hoverAt(event);
   };
   const pointerUp=(event:PointerEvent)=>{
    if(!rotating)return;event.preventDefault();event.stopImmediatePropagation();rotating=false;modern.endRotate();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);modern.hoverAt(event);
   };
   const pointerLeave=()=>{if(!rotating)modern.clearHover();};
   const wheel=(event:WheelEvent)=>{
    if(modern.inPreview(event)){event.preventDefault();event.stopImmediatePropagation();modern.zoomBy(event.deltaY);return;}
    const action=modern.wheelAction(event.deltaY);
    if(action){event.preventDefault();event.stopImmediatePropagation();actions.push(action);return;}
    if(modern.scrollDropdown(event.deltaY)){event.preventDefault();event.stopImmediatePropagation();}
   };
   canvas.addEventListener('pointerdown',pointerDown,true);canvas.addEventListener('pointermove',pointerMove,true);canvas.addEventListener('pointerup',pointerUp,true);canvas.addEventListener('pointercancel',pointerUp,true);canvas.addEventListener('pointerleave',pointerLeave,true);canvas.addEventListener('wheel',wheel,{capture:true,passive:false});
   try{return await runModernCarMenu(modernHost,modern);}finally{
    canvas.removeEventListener('pointerdown',pointerDown,true);canvas.removeEventListener('pointermove',pointerMove,true);canvas.removeEventListener('pointerup',pointerUp,true);canvas.removeEventListener('pointercancel',pointerUp,true);canvas.removeEventListener('pointerleave',pointerLeave,true);canvas.removeEventListener('wheel',wheel,true);
    modernShowroom?.close();modernShowroom=undefined;
   }
  }
  if(!options.displayMode){
   const preview=document.createElement('canvas');preview.width=canvas.width;preview.height=canvas.height;const previewContext=preview.getContext('2d')!;
   const base=document.createElement('canvas');base.width=320;base.height=200;const baseContext=base.getContext('2d')!,baseImage=baseContext.createImageData(320,200);
   let modelMemory:Uint8Array|undefined,showroom:ReturnType<typeof createUpgradedCarMenu>|undefined,failed=false;
   const presentCar=()=>{paint();if(options.graphics){options.graphics.refresh=presentCar;if(options.graphics.enabled&&modelMemory&&!failed){try{showroom??=createUpgradedCarMenu(palette,showroomMaterials.indices);previewContext.setTransform(1,0,0,1,0,0);previewContext.imageSmoothingEnabled=false;previewContext.drawImage(base,0,0,preview.width,preview.height);const internal=enhancedRenderResolution();previewContext.drawImage(showroom.draw(modelMemory,internal.width,internal.height),0,0,preview.width,preview.height);if(showroom.lastBuildMilliseconds!==undefined)canvas.dataset.upgradedCarBuildMs=showroom.lastBuildMilliseconds.toFixed(1);}catch{failed=true;showroom?.close();showroom=undefined;options.graphics.notice?.('Upgraded car preview unavailable; original graphics remain active.');return;}context.save();context.beginPath();context.rect(0,0,canvas.width,95*canvas.height/200);context.clip();context.drawImage(preview,0,0);context.restore();}}};
   carHost.captureModel=(memory,background)=>{
    for(let i=0;i<64000;i++){const c=background[i]*3;baseImage.data.set([palette[c],palette[c+1],palette[c+2],255],i*4);}baseContext.putImageData(baseImage,0,0);
    modelMemory=memory;
   };
   carHost.present=presentCar;
   try{return await runNativeCarMenu(carHost);}finally{showroom?.close();delete canvas.dataset.upgradedCarBuildMs;if(options.graphics?.refresh===presentCar)options.graphics.refresh=undefined;}
  }
  const display=await prepareBrowserNativeCarDisplay({catalog:await loadBrowserOriginalResourceCatalog()},options.displayMode,options.hercules);
  try{const portrait=opponent?await display.portrait(opponent):()=>{};carHost.present=()=>{pixels.set(display.pixels());paint(display.palette,display);};await runNativeCarMenu(carHost,createNativeDisplayCarPresentation(display,carHost,portrait));}
  finally{display.release();}
 };
 const opponent=async(config:number[])=>{
  show('opponent');focusBrowserGameCanvas(canvas);const opponentHost:NativeOpponentHost={...host,configuration:config,art:opponentArt.resources,descriptions:opponentArt.descriptions,selectCar:async(...args)=>{await car(...args);show('opponent');}};
  if(!options.displayMode)return runNativeOpponentMenu(opponentHost);
  const display=await prepareBrowserNativeOpponentDisplay({catalog:await loadBrowserOriginalResourceCatalog()},options.displayMode,opponentHost,options.hercules);
  opponentHost.present=()=>{pixels.set(display.pixels());paint(display.palette,display);};
  await runNativeOpponentMenu(opponentHost,display.presentation);
 };
 const editTrack=async()=>{
  show('editor');
  const loaded=await loadEditorResources();
  if(!modernTrackEditorEnabled()){
   focusBrowserGameCanvas(canvas);
   await runNativeEditor(loaded.editor);
   return;
  }
  input.setActive(false);
  try{
   const {runBrowserBlissEditor}=await import('./browser-bliss-editor.ts');
   const {editor,art,terrainNames,presets}=loaded;
   const sceneryPreviews=panoramas.slice(0,5).map((entry,index)=>blissOriginalSceneryPreview(baseline,index,entry.resources,palette));
   const tauriCore=(window as typeof window&{__TAURI__?:{core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}}}).__TAURI__?.core;
   const customTracks=tauriCore?{
    customTrackExists:(name:string)=>tauriCore.invoke<boolean>('custom_track_exists',{name}),
    readCustomTrack:(name:string)=>tauriCore.invoke<number[]>('read_custom_track',{name}).then(bytes=>Uint8Array.from(bytes)),
    persistCustomTrack:(name:string,bytes:Uint8Array)=>tauriCore.invoke<string>('write_custom_track',{name,data:Array.from(bytes)}),
    persistTrackShot:(filename:string,bytes:Uint8Array)=>tauriCore.invoke<string>('write_track_shot',{filename,data:Array.from(bytes)}),
    fetchUrl:(url:string)=>tauriCore.invoke<number[]>('bliss_http_get',{url}).then(bytes=>Uint8Array.from(bytes)),
   }:{};
   const mediaState=Array.from(document.querySelectorAll<HTMLMediaElement>('audio,video')).map(media=>({media,wasPaused:media.paused,currentTime:media.currentTime}));
   const activeCustomMedia=mediaState.filter(state=>!state.wasPaused&&!state.media.ended&&state.media.currentSrc);
   const hasCustomMusic=activeCustomMedia.length>0;
   const audioContext=options.audioContext;
   const contextWasRunning=audioContext?.state==='running';
   // Never let the original SLCT score continue underneath an external MP3.
   // The editor will explicitly restart it only when no custom media owns music.
   music.stop();
   let editorMusicMuted=false,nativeEditorMusicPlaying=false;
   const setEditorMusicMuted=(muted:boolean)=>{
    editorMusicMuted=muted;
    if(muted){
     nativeEditorMusicPlaying=false;music.stop();
     for(const {media} of activeCustomMedia)if(!media.paused)media.pause();
     if(audioContext?.state==='running')void audioContext.suspend().catch(()=>{});
     return;
    }
    if(audioContext&&audioContext.state!=='running')void audioContext.resume().catch(()=>{});
    if(hasCustomMusic){
     music.stop();
     for(const {media} of activeCustomMedia)if(media.paused)void media.play().catch(()=>{});
    }else if(!nativeEditorMusicPlaying){
     nativeEditorMusicPlaying=true;music.play('slct');
    }
   };
   try{
    const testRequest=await runBrowserBlissEditor({
     canvas,track,palette,assets:options.assets,
     resources:{art,terrainNames:terrainNames.names,images:editor.screenResources.images},
     sceneryPreviews,
     writeTrack:editor.writeTrack,clearScores:editor.clearScores,exists:editor.exists,presets,
     analysisCars:options.assets.cars.map(car=>({id:car.id,name:car.name})),
     testCarId:String.fromCharCode(...configuration.slice(0,4)),
     initialViewMode:editorViewMode,initial3DCamera:editor3DCamera,onViewModeChange:mode=>{editorViewMode=mode;},on3DCameraChange:state=>{editor3DCamera=state;},
     setEditorMusicMuted,
     enumerateTracks:()=>host.enumerate('','.trk'),readTrack:editor.readTrack,...customTracks,
    });
    if(testRequest){
     pendingRaceSpawn=testRequest.spawn;
     if(testRequest.carId)configuration.splice(0,4,...Array.from(testRequest.carId.slice(0,4),char=>char.charCodeAt(0)));
     return 'drive' as const;
    }
   }finally{
    if(audioContext&&contextWasRunning&&audioContext.state!=='running')void audioContext.resume().catch(()=>{});
    for(const state of mediaState){
     if(!state.wasPaused&&state.media.paused)void state.media.play().catch(()=>{});
     else if(state.wasPaused&&!state.media.paused)state.media.pause();
    }
    // Return to the same menu-music family that owned audio before the editor.
    if(hasCustomMusic)music.stop();else music.play('slct');
   }
  }finally{input.setActive(true);await input.release();}
 };
 const selectTrack=async()=>{
  show('track');focusBrowserGameCanvas(canvas);
  const menuHost:NativeTrackMenuHost={...trackHost,track,configuration,baseline,groundModels:ground.resources,panoramas,loadTrack:async({path,name})=>Array.from(await files.read(path,name,'.trk')),readScores:async(name,path)=>files.exists(path,name,'.hig')?Array.from(await files.read(path,name,'.hig')):null,editTrack:async()=>{const result=await editTrack();if(result==='drive')return 'drive';show('track');}};
  if(!options.displayMode){
   if(!enhancedMenuEnabled())return runNativeTrackMenu(menuHost);
   const [{decodeBlissTrack},{createBlissEditor3DView}]=await Promise.all([import('./bliss-track.ts'),import('./bliss-editor-3d.ts')]);
   // Modern Track Select always owns the interactive 3D preview. Keep the
   // overview slightly high in frame so the control strip does not crowd it.
   const overviewTarget=[15360,-3000,-15360] as [number,number,number],overviewDistance=42000,overviewAzimuth=0,overviewElevation=.78;
   const overviewCamera={
    position:[
     overviewTarget[0]+Math.sin(overviewAzimuth)*Math.cos(overviewElevation)*overviewDistance,
     overviewTarget[1]+Math.sin(overviewElevation)*overviewDistance,
     overviewTarget[2]+Math.cos(overviewAzimuth)*Math.cos(overviewElevation)*overviewDistance,
    ] as [number,number,number],
    target:overviewTarget,
    fov:50
   };

   const enhanced=createEnhancedTrackMenuPresentation({canvas,assets:options.assets,decodeTrack:decodeBlissTrack,createPreview:createBlissEditor3DView,originalCamera:overviewCamera,previewEnabled:true});
   let active=true,drag:'orbit'|'pan'|null=null,lastX=0,lastY=0;
   const modernActions:ModernTrackMenuAction[]=[];
   const presentEnhanced=()=>{if(!active){paint();return;}enhanced.render();if(options.graphics)options.graphics.refresh=presentEnhanced;};
   menuHost.present=presentEnhanced;
   menuHost.setOverviewActive=(value)=>{active=value;enhanced.active(value);if(!value)paint();};

   const pointerDown=(event:PointerEvent)=>{
    if(enhanced.inPreview(event)&&(event.button===0||event.button===2)){
     event.preventDefault();event.stopImmediatePropagation();drag=event.button===0?'orbit':'pan';lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);return;
    }
    if(event.button!==0)return;
    event.preventDefault();event.stopImmediatePropagation();
    const action=enhanced.actionAt(event);
    if(action.type!=='none')modernActions.push(action);
   };
   const pointerMove=(event:PointerEvent)=>{
    if(!drag){enhanced.hoverAt(event);return;}
    event.preventDefault();event.stopImmediatePropagation();const dx=event.clientX-lastX,dy=event.clientY-lastY;lastX=event.clientX;lastY=event.clientY;
    if(drag==='orbit')enhanced.orbit(dx,dy);else enhanced.pan(dx,dy);
   };
   const pointerUp=(event:PointerEvent)=>{if(drag){event.preventDefault();event.stopImmediatePropagation();}drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);enhanced.hoverAt(event);};
   const pointerLeave=()=>{if(!drag)enhanced.clearHover();};
   const wheel=(event:WheelEvent)=>{
    if(enhanced.inPreview(event)){event.preventDefault();enhanced.dolly(event.deltaY,event.clientX,event.clientY);return;}
    const action=enhanced.wheelAction(event.deltaY);
    if(action){event.preventDefault();event.stopImmediatePropagation();modernActions.push(action);return;}
    if(enhanced.scrollDropdown(event.deltaY)){event.preventDefault();event.stopImmediatePropagation();}
   };
   canvas.addEventListener('pointerdown',pointerDown,true);canvas.addEventListener('pointermove',pointerMove,true);canvas.addEventListener('pointerup',pointerUp,true);canvas.addEventListener('pointercancel',pointerUp,true);canvas.addEventListener('pointerleave',pointerLeave,true);canvas.addEventListener('wheel',wheel,{capture:true,passive:false});

   const pickTrackFile=()=>new Promise<File|null>(resolve=>{
    const picker=document.createElement('input');picker.type='file';picker.accept='.trk,application/octet-stream';picker.style.display='none';
    const finish=(file:File|null)=>{picker.remove();resolve(file);};
    picker.addEventListener('change',()=>finish(picker.files?.[0]??null),{once:true});
    picker.addEventListener('cancel',()=>finish(null),{once:true});
    document.body.appendChild(picker);picker.click();
   });
   const modernHost:ModernTrackMenuHost={...menuHost,takeModernAction:()=>modernActions.shift(),async importTrack(){
    const selected=await pickTrackFile();if(!selected)return null;
    const data=new Uint8Array(await selected.arrayBuffer());
    if(data.length<1802||data.length>13802){window.alert(`Track files must contain 1802 to 13802 bytes. This file contains ${data.length}.`);return null;}
    const stem=selected.name.replace(/\.trk$/i,'').trim().toUpperCase();
    let name=stem;
    if(!/^[A-Z0-9_-]{1,8}$/.test(name)){
     const suggested=(stem.replace(/[^A-Z0-9_-]/g,'_').slice(0,8)||'TRACK');
     const entered=window.prompt('Track name (1-8 letters, numbers, _ or -):',suggested);
     if(entered===null)return null;name=entered.trim().toUpperCase();
     if(!/^[A-Z0-9_-]{1,8}$/.test(name)){window.alert('Track name must be 1-8 letters, numbers, _ or -.');return null;}
    }
    const tauri=(window as typeof window&{__TAURI__?:{core?:{invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}}}).__TAURI__?.core;
    if(tauri){
     const exists=await tauri.invoke<boolean>('custom_track_exists',{name});
     if(exists&&!window.confirm(`${name}.TRK already exists in Custom Tracks. Replace it?`))return null;
     await tauri.invoke<string>('write_custom_track',{name,data:Array.from(data)});
    }
    const gameBytes=data.slice(0,1802);
    await files.write('',name,'.trk',gameBytes);
    return {name,path:'',raw:Array.from(gameBytes)};
   }};
   pixels.fill(0);
   try{return await runModernTrackMenu(modernHost,enhanced);}finally{
    canvas.removeEventListener('pointerdown',pointerDown,true);canvas.removeEventListener('pointermove',pointerMove,true);canvas.removeEventListener('pointerup',pointerUp,true);canvas.removeEventListener('pointercancel',pointerUp,true);canvas.removeEventListener('pointerleave',pointerLeave,true);canvas.removeEventListener('wheel',wheel,true);
    if(options.graphics?.refresh===presentEnhanced)options.graphics.refresh=undefined;
   }
  }
  const display=await prepareBrowserNativeTrackDisplay({catalog:await loadBrowserOriginalResourceCatalog()},options.displayMode,options.hercules),{owner}=display;
  const present=()=>{pixels.set(display.pixels());paint(display.palette,display);};menuHost.present=present;
  const dialogs=createNativeDisplayDialogRuntime({...menuHost,memory:owner.memory,d:owner.d,mode:owner.mode,drawing:owner.drawing,capture:retain=>captureNativeDisplayDialogBackground(owner,retain),present},0xe800,{enumerate:host.enumerate,editPath:(path,length,timeout,field)=>editNativeDisplayPath({memory:owner.memory,d:owner.d,mode:owner.mode,drawing:owner.drawing,present,counters:input.counters,keyboard:input.keyboard},path,length,timeout,field,0xe800)});
  return await runNativeTrackMenu(menuHost,false,createNativeDisplayTrackPresentation(display,menuHost,dialogs.file));
 };
 const readSelectedReplay=async({path,name}:{path:string;name:string})=>{const bytes=await files.read(path,name,'.rpl');selectedReplay={bytes:bytes.slice(),name,path};replay=decodeOriginalReplayFile(bytes);configuration.splice(0,24,...replay.header);track.raw=Array.from(bytes.slice(24,0x722));track.name=String.fromCharCode(...configuration.slice(13,22)).split('\0')[0];};
 const settings:NativeOptionsHost={...host,settings:drivingSettings,get replayPath(){return track.path;},set replayPath(path:string){track.path=path;},audio:async operation=>music.control(operation),loadReplay:async({path,name})=>{const waiting=baseline.slice();new DataView(waiting.buffer).setUint16(0x2d1a0+0x8a10,150,true);drawOriginalRaceWaiting(pixels,font,host.resources.ewai,waiting,0x2d1a0);show('race');present();await readSelectedReplay({path,name});},calibrateJoystick:async()=>{
  const saved=pixels.slice();settings.settings.joystick=true;settings.settings.mouse=false;
  const content=drawOriginalDialog(pixels,font,host.resources.ejoy,0,{text:15,border:4,disabled:1},undefined,3),calibration=createOriginalJoystickCalibration(content.fields,r=>{for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)pixels[(y*320+x)&65535]=r.color;},{grid:4,indicator:15});
  for(;;){const sample=await input.read();calibration.step(sample.joystickDirection);present();if(sample.key||sample.joystickButtons){settings.settings.joystick=calibration.finish();break;}}
  pixels.set(saved);present();
 }};
 const applyStoredAudioPreference=(key:string,current:boolean,operation:'toggle-music'|'toggle-sound')=>{
  const saved=window.localStorage.getItem(key);if(saved===null)return;
  const desired=!['0','false','no','off'].includes(saved.trim().toLowerCase());
  if(desired!==current)music.control(operation);
 };
 applyStoredAudioPreference('playstunts-dx-music-enabled',music.settings.musicEnabled,'toggle-music');
 applyStoredAudioPreference('playstunts-dx-sound-effects-enabled',music.settings.soundEnabled,'toggle-sound');
 const selectMain=async()=>{
  show('main');if(!options.displayMode)return runNativeMainMenuSelection({counter:input.counter,input:input.read,release:input.release,redraw:()=>{outline=undefined;present();},selectScreen:()=>{},outline:(selection,color)=>{outline=[selection,color];present();}});
  const display=await prepareBrowserNativeMainMenu({catalog:await loadBrowserOriginalResourceCatalog()},options.displayMode,options.hercules),nativePresent=()=>{pixels.set(display.pixels());paint(display.palette,display);};
  return runNativeMainMenuSelection({counter:input.counter,input:input.read,release:input.release,redraw(){display.redraw();nativePresent();},selectScreen(){},outline(selection,color){display.outline(selection,color);nativePresent();}});
 };
 const selectOptions=async()=>{
  show('options');focusBrowserGameCanvas(canvas);
  if(enhancedMenuEnabled()){
   const modernDialogs=createNativeDialogRuntime(settings);
   return runModernOptionsMenu({
    canvas,input:input.read,settings:drivingSettings,
    audio:async operation=>music.control(operation),
    audioState:()=>({musicEnabled:music.settings.musicEnabled,soundEnabled:music.settings.soundEnabled}),
    calibrateJoystick:settings.calibrateJoystick,
    async selectReplay(){
     const selection=await modernDialogs.file(settings.replayPath,'.rpl',String.fromCharCode(...host.resources.erep).split('\0')[0],path=>{settings.replayPath=path;});
     if(!selection)return false;
     settings.replayPath=selection.path;await settings.loadReplay(selection);return true;
    },
   });
  }
  if(!options.displayMode)return runNativeOptions(settings);
  const display=await prepareBrowserNativeMenuDisplay({catalog:await loadBrowserOriginalResourceCatalog()},options.displayMode,options.hercules),{owner}=display,{d,mode,drawing}=owner,present=()=>{pixels.set(display.pixels());paint(display.palette,display);},word=(at:number)=>{const m=owner.memory();return m[d+at]|m[d+at+1]<<8;};
  const nativeDialogs=createNativeDisplayDialogRuntime({...settings,memory:owner.memory,d,mode,drawing,capture:retain=>captureNativeDisplayDialogBackground(owner,retain),present},0xe800,{enumerate:host.enumerate,editPath:(path,length,timeout,field)=>editNativeDisplayPath({memory:owner.memory,d,mode,drawing,present,counters:input.counters,keyboard:input.keyboard},path,length,timeout,field,0xe800)}),dialogs={file:nativeDialogs.file,dialog(resource:string,mode:number,selected=0,border=4,disabled?:ReadonlyArray<number>){return nativeDialogs.dialog(resource,mode,selected,border===4?word(0x4ec2):border===1?word(0x4ec0):border,disabled);}};
  const nativeHost:NativeOptionsHost={...settings,present,get replayPath(){return track.path;},set replayPath(path:string){track.path=path;},loadReplay:async selection=>{const high={cga:0x5e0,tandy:0x620,ega:0x45c}[mode];new DataView(owner.memory().buffer).setUint16(d+0x8a10+high,150,true);drawOriginalRaceWaitingDisplay(owner.memory(),d,mode,drawing,host.resources.ewai,0xe800);present();await readSelectedReplay(selection);},calibrateJoystick:async()=>{
   const restore=captureNativeDisplayDialogBackground(owner,false);drivingSettings.joystick=true;drivingSettings.mouse=false;
   try{const content=drawOriginalDialogDisplay(owner.memory(),d,mode,drawing,host.resources.ejoy,0,{text:word(0x4e8a),border:word(0x4ec2),disabled:word(0x4ec0)},0xe800,undefined,3),calibration=createOriginalJoystickCalibration(content.fields,r=>drawing.rectangle(r.x,r.y,r.width,r.height,r.color),{grid:word(0x4ec2),indicator:word(0x4e8a)});
    for(;;){const sample=await input.read();calibration.step(sample.joystickDirection);present();if(sample.key||sample.joystickButtons){drivingSettings.joystick=calibration.finish();break;}}
   }finally{restore();present();}
  }};
  return runNativeOptions(nativeHost,createNativeDisplayOptionsPresentation(owner,nativeHost,dialogs));
 };
 if(options.displayMode)lastNativeDisplay=await prepareBrowserNativeMenuDisplay({catalog:await loadBrowserOriginalResourceCatalog()},options.displayMode,options.hercules);
 return {configuration,track,elapsedSinceInputPoll:input.elapsedSinceInputPoll,selectOptions,selectCar:car,selectOpponent:opponent,selectTrack,setInputActive:input.setActive,settings:drivingSettings,get replay(){return replay;},get selectedReplay(){return selectedReplay;},consumeRaceSpawn(){const spawn=pendingRaceSpawn;pendingRaceSpawn=undefined;return spawn;},reopenTrackEditor:editTrack,raceEntryKey:fastForwardKey,fadeMusic:()=>music.fadeOut(input.waitTicks),close:()=>{window.removeEventListener(ENHANCED_TEXTURES_EVENT,syncEnhancedTextures);window.removeEventListener(ENHANCED_FOV_EVENT,syncEnhancedFov);input.close();files.close();},
  /** Use the live allocated game banks and retained framebuffer. */
  async allocatedRacePresentation(runtime:Awaited<ReturnType<typeof createNativeManualRaceRuntime>>,onPoll:()=>void|Promise<void>,alternate?:Awaited<ReturnType<typeof prepareBrowserNativeManualDisplay>>){
   let upgraded:ReturnType<typeof createUpgradedRaceScene>|undefined,loading=false,closed=false,failed=false,drawRecoveryPending=false;
   const graphics=options.graphics;let lastGraphicsEnabled=graphics?.enabled??false;if(graphics){runtime.enableGraphicsCapture();graphics.resetPerformance?.();}
   const presentWorld=()=>{
    publishRaceMapFrame(runtime.raw,runtime.session.state.memory);
    if(!graphics){display();return;}
    if(graphics.enabled!==lastGraphicsEnabled){
     // A deliberate off/on cycle is also an explicit retry request after a
     // renderer failure. Do not force the player to leave the race to recover.
     if(graphics.enabled){failed=false;drawRecoveryPending=false;if(!upgraded)loading=false;}
     lastGraphicsEnabled=graphics.enabled;
    }
    if(!graphics.enabled)resetRaceCanvas();
    graphics.refresh=presentWorld;
    const transition=raceGraphicsTransition(graphics.enabled,!!upgraded,failed);
    if(transition==='original'){display();return;}
    // Keep the last presented frame while a requested DX scene is prepared.
    // Painting the native world here exposes a one-frame original-graphics flash.
    if(transition==='hold'){
     if(!loading){loading=true;graphics.notice?.('Loading upgraded driving graphics…');void import('./upgraded-race-scene').then(({createUpgradedRaceScene})=>{if(closed)return;upgraded=createUpgradedRaceScene(options.assets,baseline,runtime,()=>graphics.chaseCamera??0,()=>graphics.selectOriginalCamera?.());loading=false;graphics.refresh?.();}).catch(reason=>{loading=false;failed=true;console.error('[DX Graphics] Failed to create upgraded race renderer:',reason);graphics.notice?.('Upgraded graphics are unavailable. Toggle DX Graphics off/on to retry.');graphics.refresh?.();});}
     return;
    }
    const scene=upgraded;if(!scene)return;
    try{const shown=scene.draw(canvas);if(shown){drawRecoveryPending=false;graphics.performanceFrame?.(performance.now());}graphics.notice?.(shown?'Upgraded driving graphics · experimental':'Waiting for upgraded graphics context…');}catch(reason){
     console.error('[DX Graphics] Upgraded race render failed:',reason);
     scene.close();upgraded=undefined;loading=false;
     if(!drawRecoveryPending){
      // Give a one-off runtime failure one clean renderer rebuild. If the new
      // renderer fails before it produces a good frame, fall back instead of
      // entering an endless recreate/fail loop.
      drawRecoveryPending=true;failed=false;graphics.notice?.('Restarting upgraded graphics after a render error…');graphics.refresh?.();
     }else{
      failed=true;display();graphics.notice?.('Upgraded graphics are unavailable. Toggle DX Graphics off/on to retry.');
     }
    }
   };
   const gameText=await json<TextResources>('race-dialog-text');
   const onTeleport=(event:Event)=>{const spawn=(event as CustomEvent<RaceSpawn>).detail;if(!spawn)return;runtime.session.teleportPlayer(spawn);graphics?.refresh?.();};
   window.addEventListener(RACE_TELEPORT_EVENT,onTeleport as EventListener);
   activeRace=runtime;racePoll=onPoll;
   const memory=()=>runtime.session.state.memory;
   const display=()=>{pixels.set(runtime.pixels);show('race');paint(alternate?.palette,undefined,alternate?.owner);};
   const alternateDialogPresent=()=>{if(!alternate){paint();return;}pixels.set(alternate.display.pixels());show('race');paint(alternate.palette,undefined,alternate.owner);};
   const control=(mode:number,start:number,current:number)=>{runtime.controlReplay(mode,start,current);if(mode===1)presentWorld();};
   let dialogRefresh:(()=>void)|undefined,activeDialogBounds:readonly number[]|null=null;
   const presentRaceDialog=(bounds:readonly number[]|null,presentSource:()=>void=()=>paint())=>{
    activeDialogBounds=bounds;
    if(!bounds){dialogRefresh=undefined;graphics?.setPerformancePaused?.(false);presentWorld();return;}
    graphics?.setPerformancePaused?.(true);
    const redraw=()=>{
     // If enhanced graphics are switched off while a race dialog is open,
     // restore the desktop canvas to its normal 4:3 presentation before the
     // native 320x200 frame is painted. Otherwise the previous widescreen FOV
     // CSS remains active for this refresh and stretches the replay/menu frame.
     if(graphics&&!graphics.enabled)resetRaceCanvas();
     // Keep the source menu opaque, including black pixels which may also
     // match the source background. Only its rectangle covers the 3D scene.
     presentSource();
     if(graphics?.enabled&&upgraded&&!failed){
      try{if(upgraded.draw(canvas)){
       const [left,right,top,bottom]=bounds,sy=canvas.height/200;
       const displayAspect=enhancedRaceAspect(),wideFactor=Math.max(1,displayAspect/(4/3));
       const nativeWidth=canvas.width/wideFactor,nativeX=(canvas.width-nativeWidth)/2,sx=nativeWidth/320;
       context.imageSmoothingEnabled=false;
       context.drawImage(surface,left,top,right-left,bottom-top,nativeX+left*sx,top*sy,(right-left)*sx,(bottom-top)*sy);
      }}catch{failed=true;paint();}
     }
     dialogRefresh=redraw;if(graphics)graphics.refresh=redraw;
    };
   redraw();
   };
   const displayDialogs=(resources:Record<string,ReadonlyArray<number>>)=>{
    if(!alternate){
     const presentDialog=(bounds:readonly number[]|null)=>presentRaceDialog(bounds),editPath:NativeDialogHost['editPath']=(path,length,timeout,field)=>editNativePath({pixels,font,present:()=>activeDialogBounds?presentDialog(activeDialogBounds):paint(),counters:()=>input.counters(),keyboard:()=>input.keyboard()},path,length,timeout,field),dialogHost={...host,resources,presentDialog,editPath};
     const dialog=createNativeDialogRuntime(dialogHost);
     return {file:(...args:Parameters<typeof dialog.file>)=>dialog.file(...args),dialog:(...args:Parameters<typeof dialog.dialog>)=>dialog.dialog(...args),saveName:(state:{name:string;path:string},title:string)=>editNativeSaveName(dialogHost,state,title)};
    }
    const owner=alternate.owner,presentDialog=(bounds:readonly number[]|null)=>presentRaceDialog(bounds,alternateDialogPresent),editPath:NativeDialogHost['editPath']=(path,length,timeout,field)=>editNativeDisplayPath({memory:owner.memory,d:owner.d,mode:owner.mode,drawing:owner.drawing,present:()=>activeDialogBounds?presentDialog(activeDialogBounds):alternateDialogPresent(),counters:()=>input.counters(),keyboard:()=>input.keyboard()},path,length,timeout,field,0xe800),dialogHost={...host,memory:owner.memory,d:owner.d,mode:owner.mode,drawing:owner.drawing,resources,capture:(retain:boolean)=>captureNativeDisplayDialogBackground(owner,retain),present:alternateDialogPresent,presentDialog,editPath};
    const dialog=createNativeDisplayDialogRuntime(dialogHost,0xe800,{enumerate:(...args)=>host.enumerate(...args),editPath});
    return {file:(...args:Parameters<typeof dialog.file>)=>dialog.file(...args),dialog(resource:string,mode:number,selected=0,border=4,disabled?:ReadonlyArray<number>){const m=owner.memory(),originalBorder=m[owner.d+0x4ec2]|(m[owner.d+0x4ec3]<<8);return dialog.dialog(resource,mode,selected,border===4?originalBorder:border===1?(m[owner.d+0x4ec0]|(m[owner.d+0x4ec1]<<8)):border,disabled);},saveName:(state:{name:string;path:string},title:string)=>editNativeDisplaySaveName(dialogHost,state,title,0xe800)};
   };
   const dialogs=displayDialogs(gameText.resources),setupDialogs=displayDialogs(host.resources);
   const saveResources={...host.resources,...Object.fromEntries(['esav','efex','eser'].map(key=>[key,trackText.resources[key]]))},saveDialogs=displayDialogs(saveResources);
   const saveName=(state:{name:string;path:string},title:string)=>saveDialogs.saveName(state,title);
   const dialog=async(resource:string,mode:number,selected:number,border:number,disabled?:ReadonlyArray<number>)=>{pixels.set(runtime.pixels);return dialogs.dialog(resource,mode,selected,border,disabled);};
   let waitingField:{x:number;y:number}|undefined;
   const opponent={
    async show(resource:string,mode:number,x:number,y:number,border:number){
     pixels.set(runtime.pixels);if(alternate){const owner=alternate.owner,m=owner.memory(),d=owner.d,word=(at:number)=>m[d+at]|(m[d+at+1]<<8);restoreOriginalDisplayWindow(m,d,owner.mode);const content=drawOriginalDialogDisplay(m,d,owner.mode,owner.drawing,gameText.resources[resource],0,{text:word(0x4e8a),border:border===4?word(0x4ec2):border,disabled:0},0xe800,undefined,mode,{x,y});waitingField=content.fields[0];presentRaceDialog(content.layout.bounds,alternateDialogPresent);return;}
     const content=drawOriginalDialog(pixels,font,gameText.resources[resource],0,{text:memory()[0x2d1a0+0x4e8a],border,disabled:0},undefined,mode,{x,y});waitingField=content.fields[0];presentRaceDialog(content.layout.bounds);
    },
    drawTime(text:string){if(!waitingField)throw Error('Original opponent timer field is missing');if(alternate){const owner=alternate.owner,m=owner.memory(),d=owner.d,v=new DataView(m.buffer),fontAt=v.getUint16(d+0x4dd2,true)*16,bytes=Array.from(text,c=>c.charCodeAt(0)),x=Math.trunc((320-measureOriginalFont(m.subarray(fontAt,fontAt+65536),bytes))/2);m.set([...bytes,0],d+0xe800);owner.drawing.text(0xe800,x,waitingField.y,true);presentRaceDialog(activeDialogBounds,alternateDialogPresent);return;}const x=Math.trunc((320-measureOriginalFont(font,Array.from(text,c=>c.charCodeAt(0))))/2);drawOriginalFont(pixels,font,text,x,waitingField.y,memory()[0x2d1a0+0x4e8a],Array.from({length:256},(_,i)=>(i*320)&65535),0);presentRaceDialog(activeDialogBounds);},
    key:fastForwardKey
   };

   focusBrowserGameCanvas(canvas);
   const waiting=()=>{if(!alternate){drawOriginalRaceWaiting(pixels,font,host.resources.ewai,memory(),0x2d1a0);show('race');present();}else{const owner=alternate.owner,m=owner.memory(),v=new DataView(m.buffer),live=memory(),source=new DataView(live.buffer),at={cga:0x8ff0,tandy:0x9030,ega:0x8e6c}[owner.mode];v.setInt16(owner.d+at,source.getInt16(0x2d1a0+0x8a10,true),true);restoreOriginalDisplayWindow(m,owner.d,owner.mode);drawOriginalRaceWaitingDisplay(m,owner.d,owner.mode,owner.drawing,host.resources.ewai,0xe800);live[0x2d1a0+0x131]=0;display();}canvas.style.cursor='none';};
   return {control,present:presentWorld,presentWorld,dialog,opponent,waiting,saveName,saveDialog:saveDialogs.dialog,file:setupDialogs.file,setupDialog:async(resource:string,mode:number,selected:number,border:number)=>{pixels.set(runtime.pixels);return setupDialogs.dialog(resource,mode,selected,border);},read:()=>readReplayInput(memory,()=>originalElapsedInputTicks(memory(),0x2d1a0)),input:(delta:number)=>readReplayInput(memory,delta),ctrlHeld:input.ctrlHeld,waitTicks:input.waitTicks,
    changeGraphics:(writeAudio:(writes:number[][])=>void)=>selectAllocatedGraphicsLevel({memory,audio:operation=>writeAudio(runtime.dialogAudio(operation)),dialog:async(...args)=>{pixels.set(runtime.pixels);return setupDialogs.dialog(...args);},hideCursor(){canvas.style.cursor='none';}},0x2d1a0),
    selectMouse:(writeAudio:(writes:number[][])=>void)=>selectAllocatedMouseControl({memory,audio:operation=>writeAudio(runtime.dialogAudio(operation)),dialog:async(...args)=>{pixels.set(runtime.pixels);return setupDialogs.dialog(...args);},hideCursor(){canvas.style.cursor='none';}},0x2d1a0),
    hideCursor(){canvas.style.cursor='none';},
    counter:()=>originalElapsedInputTicks(memory(),0x2d1a0)&65535,nextFrame:input.nextFrame,key:input.takeKey,mouseButtons:()=>input.mouse().buttons,joystickButtons:input.joystickButtons,releaseInput:input.release,resetMouse:input.resetMouse,
    devices:{mouse:input.mouse,controls:input.controls,keyDown:input.keyDown,joystickSteering:input.joystickSteering},
    close(){closed=true;window.removeEventListener(RACE_TELEPORT_EVENT,onTeleport as EventListener);clearRaceMapFrame();upgraded?.close();graphics?.setPerformancePaused?.(false);graphics?.resetPerformance?.();if(graphics&&(graphics.refresh===presentWorld||graphics.refresh===dialogRefresh))graphics.refresh=undefined;if(activeRace===runtime){const m=memory();drivingSettings.graphics=m[0x2d1a0+0x134];drivingSettings.mouse=!!m[0x2d1a0+0x12c];drivingSettings.joystick=!!m[0x2d1a0+0x4602];activeRace=undefined;racePoll=undefined;}}
   };
  },
  async replayPresentation(session:ReturnType<typeof createNativeRaceSession>,background:Uint8Array,replayFont:Uint8Array){
   if(background.length<64000)throw Error('Replay presentation requires the retained game framebuffer');
   const [art,packed]=await Promise.all([json<NativeReplayBarArt>('replay-bar-art'),binary('sdgame.pvs')]);
   session.restoreReplayBank(packed);const memory=()=>session.state.memory;
   const display=()=>{pixels.set(background.subarray(0,Math.min(background.length,pixels.length)));show('replay');present();};
   const control=createNativeReplayBar({memory,pixels:()=>background,font:replayFont,art,present:display},0x2d1a0);
   focusBrowserGameCanvas(canvas);
   return {control,present:display,read:()=>readReplayInput(memory),input:(delta:number)=>readReplayInput(memory,delta),ctrlHeld:input.ctrlHeld,waitTicks:input.waitTicks};
  },
  resetRaceMouse:input.resetMouse,
  async showTrackValidationError(error:number){
   const resource=errorKeys.keys[error];
   if(!resource||!trackText.resources[resource])throw Error('Original track validation message is unavailable');
   show('race');focusBrowserGameCanvas(canvas);
   await createNativeDialogRuntime(trackHost).dialog(resource,1,0,1);
  },
  showRaceWaiting(memory:Uint8Array){show('race');canvas.style.cursor='none';if(lastNativeDisplay){const {owner}=lastNativeDisplay,high={cga:0x5e0,tandy:0x620,ega:0x45c}[owner.mode],y=new DataView(memory.buffer,memory.byteOffset,memory.byteLength).getUint16(0x2d1a0+0x8a10,true);new DataView(owner.memory().buffer).setUint16(owner.d+0x8a10+high,y,true);restoreOriginalDisplayWindow(owner.memory(),owner.d,owner.mode);drawOriginalRaceWaitingDisplay(owner.memory(),owner.d,owner.mode,owner.drawing,host.resources.ewai,0xe800);pixels.set(lastNativeDisplay.pixels());paint(lastNativeDisplay.palette);return;}drawOriginalRaceWaiting(pixels,font,host.resources.ewai,memory,0x2d1a0);present();},
  async loadAllocatedRaceReplay(data:NativeDemoData,runtime:Awaited<ReturnType<typeof createNativeManualRaceRuntime>>,services:Pick<AllocatedReplayLoadServices,'showWaiting'|'progress'|'writeAudio'>,displayOverride?:{file(path:string,extension:string,title:string,onPathChange?:(path:string)=>void):Promise<{path:string;name:string}|undefined>;present():void}){
   const d=0x2d1a0,dialogs=displayOverride??createNativeDialogRuntime(host);let selected:{path:string;name:string}|undefined;
   const readString=(memory:Uint8Array,at:number)=>{let value='';for(let i=0;i<65536;i++){const byte=memory[d+((at+i)&65535)];if(!byte)return value;value+=String.fromCharCode(byte);}throw Error('Unterminated original replay filename');};
   const writeString=(memory:Uint8Array,at:number,value:string)=>memory.set(Uint8Array.from([...value].map(char=>char.charCodeAt(0)&255).concat(0)),d+at);
   return loadAllocatedReplay(data,runtime,{...services,
    async selectReplay(memory){
     if(displayOverride)displayOverride.present();else{pixels.set(runtime.pixels);show('replay');present();}
     selected=await dialogs.file(readString(memory(),0x98),'.rpl',String.fromCharCode(...host.resources.erep).split('\0')[0],path=>writeString(memory(),0x98,path));
     if(!selected)return 0;writeString(memory(),0x98,selected.path);writeString(memory(),0xea,selected.name);return 1;
    },
    async readReplay(){if(!selected)throw Error('Original replay load requires a selected file');return files.read(selected.path,selected.name,'.rpl');},
   });
  },
  async saveReplay(session:ReturnType<typeof createNativeRaceSession>,state:{name:string;path:string},pauseAudio:()=>void,displayOverride?:{saveName(state:{name:string;path:string},title:string):Promise<{name:string;path:string}|null>;saveDialog(resource:string,mode:number,selected:number,border:number):Promise<number>;present():void}){
   // These three MAIN resources were extracted with the editor's save flow.
   // Do not merge TEDIT emen or GAME econ into the shared file-dialog scope.
   const saveHost={...host,resources:{...host.resources,...Object.fromEntries(['esav','efex','eser'].map(key=>[key,trackText.resources[key]]))}},dialogs=createNativeDialogRuntime(saveHost);
   let destination={...state};if(displayOverride)displayOverride.present();else show('replay');focusBrowserGameCanvas(canvas);
   return saveNativeReplay({pauseAudio,
    editName:async()=>!!await (displayOverride?displayOverride.saveName(state,String.fromCharCode(...host.resources.erep).split('\0')[0]):editNativeSaveName(saveHost,state,String.fromCharCode(...host.resources.erep).split('\0')[0])),
    buildPath:()=>{destination={...state};},
    exists:()=>Promise.resolve(files.exists(destination.path,destination.name,'.rpl')),
    dialog:(resource,mode,selected)=>{const m=session.state.memory;return (displayOverride?.saveDialog??dialogs.dialog)(resource,mode,selected,new DataView(m.buffer,m.byteOffset,m.byteLength).getUint16(0x2d1a0+0x4ec0,true));},
    write:()=>session.saveReplay(async bytes=>{try{await files.write(destination.path,destination.name,'.rpl',bytes);return 0;}catch{return 1;}}),
   });
  },
  /** Replay dialogs share the browser's original font, input and surface,
   * while GAME resources remain separate from MISC file-dialog resources. */
  async replayMenu(session:ReturnType<typeof createNativeRaceSession>,services:Omit<Parameters<typeof session.replayMenu>[0],'dialog'>,background:Uint8Array,displayOverride?:{dialog(resource:string,mode:number,selected:number,border:number,disabled?:ReadonlyArray<number>):Promise<number>;present():void}){
   if(displayOverride){displayOverride.present();focusBrowserGameCanvas(canvas);await session.replayMenu({...services,dialog:displayOverride.dialog});return;}
   const gameText=await json<TextResources>('race-dialog-text');
   const dialogs=createNativeDialogRuntime({...host,resources:gameText.resources});
   if(background.length<64000)throw Error('Replay presentation requires the retained game framebuffer');
   pixels.set(background.subarray(0,Math.min(background.length,pixels.length)));show('replay');present();focusBrowserGameCanvas(canvas);
   await session.replayMenu({...services,selectControl:(...args)=>{services.selectControl(...args);if(args[0]===1){pixels.set(background.subarray(0,Math.min(background.length,pixels.length)));present();}},dialog:(...args)=>dialogs.dialog(...args)});
  },
  async allocatedRaceResults(data:NativeDemoData,runtime:Awaited<ReturnType<typeof createNativeManualRaceRuntime>>,progress:(stage:number)=>void,displayMode?:NativeBrowserDisplayMode):Promise<number>{
   const alternate=displayMode?await prepareBrowserNativeResultsDisplay(data,displayMode,options.hercules):undefined;
   const resultPresent=()=>{if(!alternate){present();return;}pixels.set(alternate.pixels());show('results');paint(alternate.palette,undefined,alternate.owner);};
   const dialogs=alternate?createNativeDisplayDialogRuntime({...host,memory:alternate.owner.memory,d:alternate.owner.d,mode:alternate.owner.mode,drawing:alternate.owner.drawing,capture:retain=>captureNativeDisplayDialogBackground(alternate.owner,retain),present:resultPresent},0xe800):createNativeDialogRuntime(host);
   const parts=(filename:string)=>{const value=filename.replaceAll('/','\\'),end=Math.max(value.lastIndexOf('\\'),/^[A-Za-z]:/.test(value)?1:-1);return {path:value.slice(0,end+1),name:value.slice(end+1)};};
   try{return await runAllocatedRaceResults(data,runtime,{progress,
    async readFile(filename){const {path,name}=parts(filename);try{return files.exists(path,name,'')?await files.read(path,name,''):null;}catch{return null;}},
    async writeFile(filename,bytes){const {path,name}=parts(filename);try{await files.write(path,name,'',bytes);return 0;}catch{return 1;}},
    insertTrackDisk:()=>{const m=runtime.session.state.memory;return dialogs.dialog('eihd',1,1,alternate?new DataView(alternate.owner.memory().buffer).getUint16(alternate.owner.d+0x4ec2,true):new DataView(m.buffer,m.byteOffset,m.byteLength).getUint16(0x2d1a0+0x4ec2,true));},
    present:(state,services)=>this.results(state,services,alternate),
   });}finally{alternate?.release();}
  },
  async results(state:NativeRaceResultsState,services:{randomWord():number;randomByte():number;files?:NativeHighScorePreparationHost;selectEvaluation?:NativeRaceResultsHost['selectEvaluation'];prepareScores?:NativeRaceResultsHost['prepareScores']},alternate?:Awaited<ReturnType<typeof prepareBrowserNativeResultsDisplay>>){
   const scoreText=await json<TextResources>('high-score-text'),resultHost={...host,resources:{...host.resources,...scoreText.resources}},dialogs=createNativeDialogRuntime(resultHost);
   const read=async(extension:string)=>{try{return files.exists(state.trackPath,state.trackName,extension)?await files.read(state.trackPath,state.trackName,extension):null;}catch{return null;}};
   const scoreFiles:NativeHighScorePreparationHost=services.files??{readSavedTrack:()=>read('.trk'),insertTrackDisk:()=>dialogs.dialog('eihd',1,1,4),readScores:()=>read('.hig'),writeScores:async bytes=>{try{await files.write(state.trackPath,state.trackName,'.hig',bytes);return true;}catch{return false;}}};
   const results:NativeRaceResultsHost={...resultHost,playResultMusic:name=>music.play(name),smallFont,counter:input.counter,files:scoreFiles,evaluation:opponent=>json<NativeEvaluationResources>('opponent-evaluation/'+opponent),randomWord:services.randomWord,randomByte:services.randomByte,selectEvaluation:services.selectEvaluation,prepareScores:services.prepareScores};
   show('results');focusBrowserGameCanvas(canvas);
   if(!alternate)return runNativeRaceResults(results,state);
   const owner=alternate.owner,displayHost={...results,present:()=>{pixels.set(alternate.pixels());paint(alternate.palette,undefined,alternate.owner);},editPath:(path:string,length:number,timeout:number,field:{x:number;y:number})=>editNativeDisplayPath({memory:owner.memory,d:owner.d,mode:owner.mode,drawing:owner.drawing,present:()=>{pixels.set(alternate.pixels());paint(alternate.palette,undefined,alternate.owner);},counters:input.counters,keyboard:input.keyboard},path,length,timeout,field,0xe800)};
   return runNativeRaceResults(displayHost,state,createNativeDisplayResultsPresentation(alternate,displayHost,state));
  },
  async run(){focusBrowserGameCanvas(canvas);return runNativeMenuCoordinator({configuration,main:selectMain,car:()=>car(configuration,0),opponent:()=>opponent(configuration),track:selectTrack,options:selectOptions});}};
}
