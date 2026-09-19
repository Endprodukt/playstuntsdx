import {BlissEditorCore} from './bliss-editor-core.ts';
import {blissElementData,blissPalettePages} from './bliss-element-data.ts';
import {blissOriginalMapImageData,blissOriginalPaletteImageData,type BlissOriginalMapResources,BLISS_ORIGINAL_MAP_SIZE} from './bliss-original-map.ts';
import {createBlissTrack,encodeBlissTrack} from './bliss-track.ts';
import {blissParentElement} from './bliss-edit.ts';
import {blissTrackHash} from './bliss-track.ts';
import {changeBlissMaterial,findBlissElementByName,smartSelectBliss} from './bliss-shortcuts.ts';
import {blissTrackTransforms,blissTransformations,transformBlissTerrainCode,transformBlissTrackCode,type BlissTransformOperation} from './bliss-transformations.ts';
import {setBlissEditorActive} from './bliss-editor-presence.ts';
import {blissTerrainPresets,type BlissTerrainPreset} from './bliss-terrain-presets.ts';
import {BLISS_TRANSPARENT_COLOUR,setBlissTrackMetadata,type BlissMetadata} from './bliss-metadata.ts';
import {blissRoundToEven,blissSceneryAvailability,blissSceneryDefaults,type BlissSceneryPlacement,type BlissSceneryRule} from './bliss-scenery-generator.ts';
import {blissTournamentUrl,isZakStuntsTournament,parseBlissScoreboard,parseBlissTournamentConfig,parseZakStuntsCurrentRace,parseZakStuntsScoreboard,type BlissTournamentRace} from './bliss-tournaments.ts';
import {blissEstimatedTimeCentiseconds,blissTimey,summarizeBlissTrackAnalysis,traceBlissPath,type BlissRouteAnalysis} from './bliss-route.ts';
import {BLISS_PLAYER_CARD_ICON,BLISS_OPPONENT_CARD_ICON} from './bliss-card-icons.ts';
import type {Assets} from './types.ts';
import type {BlissEditor3DView,BlissEditor3DCameraState} from './bliss-editor-3d.ts';
import {normalizeRaceHeading,type RaceSpawn} from './race-spawn.ts';
import {snapToBlissRoad} from './bliss-road-snap.ts';

export interface BrowserBlissEditorTestRequest {spawn:RaceSpawn;carId:string}

export interface BrowserBlissEditorHost {
 canvas:HTMLCanvasElement;
 assets:Assets;
 track:{name:string;path:string;raw:number[]};
 palette:ReadonlyArray<number>;
 resources:BlissOriginalMapResources;
 sceneryPreviews?:readonly {width:number;height:number;rgba:Uint8ClampedArray}[];
 writeTrack(path:string,name:string,bytes:Uint8Array):Promise<number>;
 clearScores(path:string,name:string):Promise<void>;
 exists(path:string,name:string):Promise<boolean>;
 customTrackExists?(name:string):Promise<boolean>;
 readCustomTrack?(name:string):Promise<Uint8Array>;
 persistCustomTrack?(name:string,bytes:Uint8Array):Promise<string>;
 persistTrackShot?(filename:string,bytes:Uint8Array):Promise<string>;
 fetchUrl?(url:string):Promise<Uint8Array>;
 enumerateTracks?():Promise<string[]>;
 readTrack?(path:string,name:string):Promise<Uint8Array>;
 analysisCars?:readonly {id:string;name:string}[];
 testCarId?:string;
 initialViewMode?:'2d'|'3d';
 initial3DCamera?:BlissEditor3DCameraState;
 onViewModeChange?(mode:'2d'|'3d'):void;
 on3DCameraChange?(state:BlissEditor3DCameraState):void;
 presets?:readonly {terrain:number[]}[];
 setEditorMusicMuted?(muted:boolean):void;
}

type EditorArea='grid'|'palette';

const button=(label:string,action:()=>void)=>{
 const element=document.createElement('button');element.type='button';element.textContent=label;
 element.style.cssText='border:1px solid #555;background:#232323;color:#eee;border-radius:4px;padding:7px 9px;cursor:pointer;font:12px/1.1 system-ui,Segoe UI,sans-serif;';
 element.addEventListener('click',action);return element;
};
const panel=(title:string)=>{
 const root=document.createElement('section');root.style.cssText='min-width:0;background:#111;border:1px solid #3b3b3b;border-radius:6px;padding:10px;overflow:hidden;';
 const heading=document.createElement('strong');heading.textContent=title;heading.style.cssText='display:block;margin-bottom:8px;color:#eee;font:600 12px/1.2 system-ui,Segoe UI,sans-serif;';
 root.append(heading);return root;
};
const setActive=(element:HTMLButtonElement,active:boolean)=>{element.style.background=active?'#5b6330':'#232323';element.style.borderColor=active?'#b4c35a':'#555';};

const OPTION_HELP=[
 ['F1 – F12','Select palette page (2×F1 for help)'],
 ['Ctrl-Q','Toggle debug mode'],
 ['Ctrl-E','Allow/disallow conflict generation'],
 ['Ctrl-D','Toggle conflict-warning display'],
 ['Ctrl-G','Display/hide grid'],
 ['Ctrl-R','Redraw track'],
 ['Ctrl-S','Save track'],
 ['Ctrl-Shift-S','Take a track-shot'],
 ['Ctrl-T','Toggle terrain affected by paste'],
 ['Ctrl-K','Toggle track affected by paste'],
 ['Ctrl-O','Toggle colouring mode'],
 ['Ctrl','Select by dragging with left mouse button'],
 ['Ctrl-W','Select/Deselect the whole grid'],
 ['Ctrl-C','Copy selection'],
 ['Ctrl-X','Cut selection'],
 ['Ctrl-V','Paste clipboard'],
 ['F','Flip horizontally'],
 ['Shift-F','Flip vertically'],
 ['R','Rotate clockwise'],
 ['Shift-R','Rotate counter-clockwise'],
 ['Ctrl-Z','Undo'],
 ['Ctrl-Y','Redo'],
 ['U','Link tiles at pointer/keyboard cursor'],
 ['C','Check track for errors'],
 ['Arrows','Move keyboard cursor'],
 ['Tab','Switch between the grid and the palette'],
 ['Enter','Paste current element/Create closed-circuit'],
 ['Del','Delete at keyboard cursor or selection'],
 ['P','Pick element at keyboard cursor position'],
 ['\\','In manual mode, select element by hex typing'],
] as const;
const TILE_HELP=[
 ['Space','Find element by name'],['A','Banked road'],['B','Boulevard (highway)'],['D','Split (detour)'],['E','Elevated road'],
 ['G','Spin (cork up/down)'],['H','Chicane'],['I','Pipe'],['J','Ramp (jump)'],['K','Crossroad'],['L','Loop'],
 ['M','Change material'],['N','Scenery'],['O','Start/Finish line'],['Q','Corner'],['S','Straightway'],
 ['T','Tunnel and slalom'],['V','Transitions'],['W','Corkscrew'],['X, Y, Z','Side, bottom and corner fillers'],
] as const;


type EditorBindingAction={
 id:string;
 group:'Editing & navigation'|'Track piece shortcuts'|'Mouse'|'3D camera';
 description:string;
 defaultBinding:string|null;
 smartKey?:string;
 context?:'3d';
};
const EDITOR_BINDING_ACTIONS:readonly EditorBindingAction[]=[
 {id:'exit',group:'Editing & navigation',description:'Exit editor / cancel paste',defaultBinding:'Escape'},
 {id:'palette1',group:'Editing & navigation',description:'Palette page 1 / Help when already on page 1',defaultBinding:'F1'},
 {id:'palette2',group:'Editing & navigation',description:'Palette page 2',defaultBinding:'F2'},
 {id:'palette3',group:'Editing & navigation',description:'Palette page 3',defaultBinding:'F3'},
 {id:'palette4',group:'Editing & navigation',description:'Palette page 4',defaultBinding:'F4'},
 {id:'palette5',group:'Editing & navigation',description:'Palette page 5',defaultBinding:'F5'},
 {id:'palette6',group:'Editing & navigation',description:'Palette page 6',defaultBinding:'F6'},
 {id:'palette7',group:'Editing & navigation',description:'Palette page 7',defaultBinding:'F7'},
 {id:'palette8',group:'Editing & navigation',description:'Palette page 8',defaultBinding:'F8'},
 {id:'palette9',group:'Editing & navigation',description:'Palette page 9',defaultBinding:'F9'},
 {id:'palette10',group:'Editing & navigation',description:'Palette page 10',defaultBinding:'F10'},
 {id:'palette11',group:'Editing & navigation',description:'Palette page 11',defaultBinding:'F11'},
 {id:'palette12',group:'Editing & navigation',description:'Palette page 12',defaultBinding:'F12'},
 {id:'moveUp',group:'Editing & navigation',description:'Move cursor up',defaultBinding:'ArrowUp'},
 {id:'moveDown',group:'Editing & navigation',description:'Move cursor down',defaultBinding:'ArrowDown'},
 {id:'moveLeft',group:'Editing & navigation',description:'Move cursor left',defaultBinding:'ArrowLeft'},
 {id:'moveRight',group:'Editing & navigation',description:'Move cursor right',defaultBinding:'ArrowRight'},
 {id:'toggleView',group:'Editing & navigation',description:'Switch 2D / 3D view',defaultBinding:null},
 {id:'toggleDebug',group:'Editing & navigation',description:'Toggle debug mode',defaultBinding:'Ctrl+KeyQ'},
 {id:'toggleManual',group:'Editing & navigation',description:'Allow/disallow conflict generation',defaultBinding:'Ctrl+KeyE'},
 {id:'toggleWarnings',group:'Editing & navigation',description:'Toggle conflict-warning display',defaultBinding:'Ctrl+KeyD'},
 {id:'toggleGrid',group:'Editing & navigation',description:'Display/hide grid',defaultBinding:'Ctrl+KeyG'},
 {id:'redraw',group:'Editing & navigation',description:'Redraw track',defaultBinding:'Ctrl+KeyR'},
 {id:'save',group:'Editing & navigation',description:'Save track',defaultBinding:'Ctrl+KeyS'},
 {id:'trackShot',group:'Editing & navigation',description:'Take a track-shot',defaultBinding:'Ctrl+Shift+KeyS'},
 {id:'toggleTerrain',group:'Editing & navigation',description:'Toggle terrain affected by paste',defaultBinding:'Ctrl+KeyT'},
 {id:'toggleTrack',group:'Editing & navigation',description:'Toggle track affected by paste',defaultBinding:'Ctrl+KeyK'},
 {id:'toggleColour',group:'Editing & navigation',description:'Toggle colouring mode',defaultBinding:'Ctrl+KeyO'},
 {id:'selectAll',group:'Editing & navigation',description:'Select/Deselect the whole grid',defaultBinding:'Ctrl+KeyW'},
 {id:'copy',group:'Editing & navigation',description:'Copy selection',defaultBinding:'Ctrl+KeyC'},
 {id:'cut',group:'Editing & navigation',description:'Cut selection',defaultBinding:'Ctrl+KeyX'},
 {id:'paste',group:'Editing & navigation',description:'Paste clipboard',defaultBinding:'Ctrl+KeyV'},
 {id:'flipHorizontal',group:'Editing & navigation',description:'Flip horizontally',defaultBinding:'KeyF'},
 {id:'flipVertical',group:'Editing & navigation',description:'Flip vertically',defaultBinding:'Shift+KeyF'},
 {id:'rotateClockwise',group:'Editing & navigation',description:'Rotate clockwise',defaultBinding:'KeyR'},
 {id:'rotateCounter',group:'Editing & navigation',description:'Rotate counter-clockwise',defaultBinding:'Shift+KeyR'},
 {id:'undo',group:'Editing & navigation',description:'Undo',defaultBinding:'Ctrl+KeyZ'},
 {id:'redo',group:'Editing & navigation',description:'Redo',defaultBinding:'Ctrl+KeyY'},
 {id:'link',group:'Editing & navigation',description:'Link tiles at cursor',defaultBinding:'KeyU'},
 {id:'check',group:'Editing & navigation',description:'Check track for errors',defaultBinding:'KeyC'},
 {id:'switchArea',group:'Editing & navigation',description:'Switch between grid and palette',defaultBinding:'Tab'},
 {id:'insert',group:'Editing & navigation',description:'Paste current element/Create closed-circuit',defaultBinding:'Enter'},
 {id:'delete',group:'Editing & navigation',description:'Delete at cursor or selection',defaultBinding:'Delete'},
 {id:'pick',group:'Editing & navigation',description:'Pick element at cursor',defaultBinding:'KeyP'},
 {id:'manualHex',group:'Editing & navigation',description:'In manual mode, select element by hex typing',defaultBinding:'Backslash'},
 {id:'find',group:'Track piece shortcuts',description:'Find element by name',defaultBinding:'Space'},
 {id:'smartA',group:'Track piece shortcuts',description:'Banked road',defaultBinding:'KeyA',smartKey:'A'},
 {id:'smartB',group:'Track piece shortcuts',description:'Boulevard (highway)',defaultBinding:'KeyB',smartKey:'B'},
 {id:'smartD',group:'Track piece shortcuts',description:'Split (detour)',defaultBinding:'KeyD',smartKey:'D'},
 {id:'smartE',group:'Track piece shortcuts',description:'Elevated road',defaultBinding:'KeyE',smartKey:'E'},
 {id:'smartG',group:'Track piece shortcuts',description:'Spin (cork up/down)',defaultBinding:'KeyG',smartKey:'G'},
 {id:'smartH',group:'Track piece shortcuts',description:'Chicane',defaultBinding:'KeyH',smartKey:'H'},
 {id:'smartI',group:'Track piece shortcuts',description:'Pipe',defaultBinding:'KeyI',smartKey:'I'},
 {id:'smartJ',group:'Track piece shortcuts',description:'Ramp (jump)',defaultBinding:'KeyJ',smartKey:'J'},
 {id:'smartK',group:'Track piece shortcuts',description:'Crossroad',defaultBinding:'KeyK',smartKey:'K'},
 {id:'smartL',group:'Track piece shortcuts',description:'Loop',defaultBinding:'KeyL',smartKey:'L'},
 {id:'material',group:'Track piece shortcuts',description:'Change material',defaultBinding:'KeyM'},
 {id:'fillerSide',group:'Track piece shortcuts',description:'Side filler',defaultBinding:'KeyX'},
 {id:'fillerBottom',group:'Track piece shortcuts',description:'Bottom filler',defaultBinding:'KeyY'},
 {id:'fillerCorner',group:'Track piece shortcuts',description:'Corner filler',defaultBinding:'KeyZ'},
 {id:'smartN',group:'Track piece shortcuts',description:'Scenery',defaultBinding:'KeyN',smartKey:'N'},
 {id:'smartO',group:'Track piece shortcuts',description:'Start/Finish line',defaultBinding:'KeyO',smartKey:'O'},
 {id:'smartQ',group:'Track piece shortcuts',description:'Corner',defaultBinding:'KeyQ',smartKey:'Q'},
 {id:'smartS',group:'Track piece shortcuts',description:'Straightway',defaultBinding:'KeyS',smartKey:'S'},
 {id:'smartT',group:'Track piece shortcuts',description:'Tunnel and slalom',defaultBinding:'KeyT',smartKey:'T'},
 {id:'smartV',group:'Track piece shortcuts',description:'Transitions',defaultBinding:'KeyV',smartKey:'V'},
 {id:'smartW',group:'Track piece shortcuts',description:'Corkscrew',defaultBinding:'KeyW',smartKey:'W'},
 {id:'orbit3D',group:'3D camera',description:'Orbit camera (drag)',defaultBinding:'Ctrl+Mouse0',context:'3d'},
 {id:'pan3D',group:'3D camera',description:'Move / pan camera (drag)',defaultBinding:'Ctrl+Mouse2',context:'3d'},
 {id:'dollyIn3D',group:'3D camera',description:'3D zoom in',defaultBinding:'WheelUp',context:'3d'},
 {id:'dollyOut3D',group:'3D camera',description:'3D zoom out',defaultBinding:'WheelDown',context:'3d'},
 {id:'paint',group:'Mouse',description:'Place / paint',defaultBinding:'Mouse0'},
 {id:'erase',group:'Mouse',description:'Delete / erase',defaultBinding:'Mouse2'},
 {id:'mousePick',group:'Mouse',description:'Pick element / colour dialog',defaultBinding:'Mouse1'},
 {id:'selectDrag',group:'Mouse',description:'Select by dragging',defaultBinding:'Ctrl+Mouse0'},
 {id:'zoomIn',group:'Mouse',description:'Zoom in',defaultBinding:'WheelUp'},
 {id:'zoomOut',group:'Mouse',description:'Zoom out',defaultBinding:'WheelDown'},
 {id:'scrollUp',group:'Mouse',description:'Scroll up',defaultBinding:null},
 {id:'scrollDown',group:'Mouse',description:'Scroll down',defaultBinding:null},
];
const EDITOR_BINDING_DEFAULTS=Object.fromEntries(EDITOR_BINDING_ACTIONS.map(action=>[action.id,action.defaultBinding])) as Record<string,string|null>;

type HoverHelp={name:string;shortcut?:string;description:string};
const QUICK_TOOL_HELP:readonly HoverHelp[]=[
 {name:'New Track',description:'Create a new track design.'},
 {name:'Save Track',description:'Save the current track into Custom Tracks.'},
 {name:'Load Track',description:'Load an existing track into the editor.'},
 {name:'Exit',shortcut:'Esc',description:'Leave the editor. Unsaved changes will be offered for saving.'},
 {name:'Select',shortcut:'Ctrl + drag',description:'Select a rectangular region, like holding Ctrl in Bliss.'},
 {name:'Copy',shortcut:'Ctrl+C',description:'Copy the selected track and terrain region to the clipboard.'},
 {name:'Cut',shortcut:'Ctrl+X',description:'Copy the selection and delete the enabled TRK/TER layers.'},
 {name:'Paste',shortcut:'Ctrl+V',description:'Start Bliss-style hovering paste; move it before placing.'},
 {name:'Flip horizontally',shortcut:'F',description:'Selection/paste: flip the block. With no selection the toolbar icon flips the whole track; F alone flips the current element.'},
 {name:'Flip vertically',shortcut:'Shift+F',description:'Selection/paste: flip the block. With no selection the toolbar icon flips the whole track; Shift+F alone flips the current element.'},
 {name:'Rotate clockwise',shortcut:'R',description:'Selection/paste: rotate the block. With no selection the toolbar icon rotates the whole track; R alone rotates the current element.'},
 {name:'Rotate counter-clockwise',shortcut:'Shift+R',description:'Selection/paste: rotate the block. With no selection the toolbar icon rotates the whole track; Shift+R alone rotates the current element.'},
 {name:'Track Information',description:'Edit the Bliss track title, author, comment and championship information. Creation date and editing time are kept automatically.'},
 {name:'Undo',shortcut:'Ctrl+Z',description:'Undo the previous edit stroke or operation.'},
 {name:'Redo',shortcut:'Ctrl+Y',description:'Redo the last undone edit.'},
 {name:'Help',shortcut:'F1 on palette 1',description:'Show Bliss option keys and tile shortcuts.'},
 {name:'Generate Scenery',description:'Open the Bliss automatic scenery generator and configure scenery percentages and placement rules.'},
 {name:'Track Analysis',description:'Analyse route sections, winning and safe paths, cycles, errors and path lengths.'},
 {name:'Tournaments',description:'Manage Bliss-compatible tournament sites, connect to tour.cfg, view scoreboards and retrieve the current track.'},
 {name:'Settings',description:'Configure track-shot format and editor display preferences.'},
];
const SWITCH_TOOL_HELP:Record<string,HoverHelp>={
 clip:{name:'CLIP',description:'Shows whether the clipboard contains a block. Click to clear it.'},
 warn:{name:'WAR',shortcut:'Ctrl+D',description:'Show or hide Bliss conflict/warning markings on the map.'},
 manual:{name:'MAN',shortcut:'Ctrl+E',description:'Manual editing: allow raw/conflicting tile combinations Bliss normally prevents.'},
 grid:{name:'GRID',shortcut:'Ctrl+G',description:'Show or completely hide the 30×30 map grid.'},
 colour:{name:'COL',shortcut:'Ctrl+O',description:'Colouring/annotation mode. Paint cell borders/backgrounds instead of editing the track.'},
 shot:{name:'TRK SHOT',shortcut:'Ctrl+Shift+S',description:'Export a picture of the complete map or the active selection as PNG, JPEG or BMP.'},
 trk:{name:'TRK',shortcut:'Ctrl+K',description:'Choose whether paste/delete operations affect the track layer.'},
 ter:{name:'TER',shortcut:'Ctrl+T',description:'Choose whether paste/delete operations affect the terrain layer.'},
 debug:{name:'DEB',shortcut:'Ctrl+Q',description:'Show raw track/terrain codes and Bliss debug information.'},
};

/** Native PlayStunts DX shell for the Bliss 2.6.1 port.
 * Track/terrain art comes from the user's Stunts data. Behaviour and shortcuts
 * intentionally follow Bliss so experienced Bliss users can work by muscle memory. */
export async function runBrowserBlissEditor(host:BrowserBlissEditorHost){
 let initialBytes=Uint8Array.from(host.track.raw);
 if(host.track.name&&host.customTrackExists&&host.readCustomTrack){
  try{if(await host.customTrackExists(host.track.name))initialBytes=await host.readCustomTrack(host.track.name);}catch{}
 }
 const core=BlissEditorCore.fromBytes(initialBytes);
 let editingSessionStarted=performance.now();
 let metadataEditingBase=Math.max(0,core.metadata()?.metadata.editingTime??0);
 const syncMetadataClock=()=>{
  const current=core.metadata(),now=new Date(),elapsed=metadataEditingBase+Math.max(0,Math.floor((performance.now()-editingSessionStarted)/1000));
  const metadata:BlissMetadata=current?{...current.metadata}:{
   title:'',author:'Anonymous',comment:'',championship:'',
   year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate(),
   tool:'PlayStunts DX',toolVersion:100,editingTime:elapsed,
  };
  if(!metadata.year){metadata.year=now.getFullYear();metadata.month=now.getMonth()+1;metadata.day=now.getDate();}
  metadata.tool='PlayStunts DX';metadata.toolVersion=100;metadata.editingTime=elapsed;
  setBlissTrackMetadata(core.track,metadata,current?.format??'binary');
 };
 let brush=4,terrainBrush=0,page=0,cellX=0,cellY=0,painting=false,activePaintAction:'paint'|'erase'|null=null,selecting=false,selectionAnchor:{x:number;y:number}|null=null,closed=false,zoom=1;
 let activeArea:EditorArea='grid',paletteCursor=0,lastPlaced:{x:number;y:number}|null=null;
 let viewMode:'2d'|'3d'=host.initialViewMode??'2d',editor3D:BlissEditor3DView|undefined,testSpawn:RaceSpawn|undefined,spawnTraceHash=-1,spawnTraces:ReturnType<typeof traceBlissPath>[]=[];
 let allowConflicts=false,showConflicts=true,showGrid=true,debugMode=false,affectTrack=true,affectTerrain=false,colouringMode=false;
 let selectionTool=false,pasteMode=false,manualHex='',manualHexDeadline=0,modalOpen=false,analysisCarIndex=-1,suppressMapCursor=false;
 let helpOverlay:HTMLDivElement|null=null;
 let borderColour=0xF800,backgroundColour=0xFFE0;
 const shortcutHelpStorageKey='playstunts-bliss-shortcuts-visible';
 const editorMusicStorageKey='playstunts-bliss-editor-music-enabled';
 const bindingStorageKey='playstunts-bliss-editor-bindings-v1';
 let editorBindings:Record<string,string|null>={...EDITOR_BINDING_DEFAULTS};
 let rebindingAction:string|null=null;
 const editorSettingsStorageKey='playstunts-bliss-editor-settings-v1';
 type TrackShotFormat='png'|'jpeg'|'bmp';
 type BlissEditorSettings={trackShotFormat:TrackShotFormat;jpegQuality:number;trackShotGrid:boolean;trackShotAnnotations:boolean;trackShotCarMarkers:boolean;sceneryPercentMode:boolean};
 let showShortcutReference=true;
 let editorMusicEnabled=localStorage.getItem(editorMusicStorageKey)!=='0';
 let editorSettings:BlissEditorSettings={trackShotFormat:'png',jpegQuality:.92,trackShotGrid:true,trackShotAnnotations:true,trackShotCarMarkers:true,sceneryPercentMode:false};
 try{
  showShortcutReference=localStorage.getItem(shortcutHelpStorageKey)!=='0';
  const savedBindings=JSON.parse(localStorage.getItem(bindingStorageKey)??'null') as Record<string,string|null>|null;
  if(savedBindings)for(const action of EDITOR_BINDING_ACTIONS)if(Object.prototype.hasOwnProperty.call(savedBindings,action.id))editorBindings[action.id]=typeof savedBindings[action.id]==='string'?savedBindings[action.id]:null;
  const saved=JSON.parse(localStorage.getItem(editorSettingsStorageKey)??'null') as Partial<BlissEditorSettings>|null;
  if(saved){
   if(saved.trackShotFormat==='png'||saved.trackShotFormat==='jpeg'||saved.trackShotFormat==='bmp')editorSettings.trackShotFormat=saved.trackShotFormat;
   if(typeof saved.jpegQuality==='number'&&Number.isFinite(saved.jpegQuality))editorSettings.jpegQuality=Math.max(.5,Math.min(1,saved.jpegQuality));
   if(typeof saved.trackShotGrid==='boolean')editorSettings.trackShotGrid=saved.trackShotGrid;
   if(typeof saved.trackShotAnnotations==='boolean')editorSettings.trackShotAnnotations=saved.trackShotAnnotations;
   if(typeof saved.trackShotCarMarkers==='boolean')editorSettings.trackShotCarMarkers=saved.trackShotCarMarkers;
   if(typeof saved.sceneryPercentMode==='boolean')editorSettings.sceneryPercentMode=saved.sceneryPercentMode;
  }
 }catch{}
 const persistEditorSettings=()=>{try{localStorage.setItem(editorSettingsStorageKey,JSON.stringify(editorSettings));}catch{}};
 const persistBindings=()=>{try{localStorage.setItem(bindingStorageKey,JSON.stringify(editorBindings));}catch{}};

 const overlay=document.createElement('div');overlay.tabIndex=-1;overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#090909;color:#ddd;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:12px;box-sizing:border-box;font-family:system-ui,Segoe UI,sans-serif;';
 const top=document.createElement('div');top.style.cssText='display:flex;align-items:center;gap:8px;min-width:0;';
 const title=document.createElement('strong');title.textContent='PlayStunts DX — Bliss Track Editor';title.style.cssText='font-size:14px;color:#fff;margin-right:auto;';
 const name=document.createElement('span');name.textContent=host.track.name+'.TRK';name.style.cssText='color:#aaa;font-size:12px;';
 const status=document.createElement('span');status.style.cssText='color:#c8c8c8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw;';
 const musicWrap=document.createElement('label');musicWrap.style.cssText='display:flex;align-items:center;gap:6px;margin-left:8px;color:#aaa;font-size:11px;white-space:nowrap;cursor:pointer;';
 const musicLabel=document.createElement('span');musicLabel.textContent='Music';
 const musicToggle=document.createElement('input');musicToggle.type='checkbox';musicToggle.checked=editorMusicEnabled;musicToggle.style.cssText='accent-color:#9ead52;cursor:pointer;';
 musicToggle.addEventListener('change',()=>{editorMusicEnabled=musicToggle.checked;try{localStorage.setItem(editorMusicStorageKey,editorMusicEnabled?'1':'0');}catch{}host.setEditorMusicMuted?.(!editorMusicEnabled);});
 musicWrap.append(musicLabel,musicToggle);
 top.append(title,name,status,musicWrap);
 host.setEditorMusicMuted?.(!editorMusicEnabled);

 const main=document.createElement('div');main.style.cssText='display:grid;grid-template-columns:minmax(360px,460px) minmax(0,1fr) minmax(220px,280px);gap:10px;min-height:0;';
 const palettePanel=panel('Track pieces');
 palettePanel.style.display='grid';palettePanel.style.gridTemplateRows='auto auto minmax(0,1fr) auto auto';palettePanel.style.gap='8px';
 const selectedPiece=document.createElement('div');selectedPiece.style.cssText='display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;align-items:center;min-height:126px;padding:8px;border:1px solid #353535;background:#0b0b0b;border-radius:5px;';
 const selectedPreview=document.createElement('canvas');selectedPreview.width=32;selectedPreview.height=32;selectedPreview.style.cssText='width:112px;height:112px;image-rendering:pixelated;display:block;background:#070707;border:1px solid #292929;';
 const selectedInfo=document.createElement('div');selectedInfo.style.cssText='min-width:0;';
 const selectedName=document.createElement('strong');selectedName.style.cssText='display:block;color:#fff;font-size:14px;line-height:1.25;margin-bottom:5px;';
 const selectedCode=document.createElement('span');selectedCode.style.cssText='display:block;color:#888;font-size:11px;';
 selectedInfo.append(selectedName,selectedCode);selectedPiece.append(selectedPreview,selectedInfo);
 const paletteGrid=document.createElement('div');paletteGrid.style.cssText='display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(6,52px);gap:3px;align-content:start;overflow:hidden;min-height:324px;padding:3px;background:#0b0b0b;border:1px solid #2f2f2f;';
 const pageBar=document.createElement('div');pageBar.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding-top:6px;border-top:1px solid #2d2d2d;';
 const landscapeNames=['Desert','Tropical','Alpine','City','Country'] as const;
 const sceneryBox=document.createElement('div');sceneryBox.style.cssText='border-top:1px solid #2d2d2d;padding-top:8px;';
 const sceneryTitle=document.createElement('div');sceneryTitle.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11px;color:#aaa;';
 const sceneryLabel=document.createElement('strong');sceneryLabel.textContent='Background / Scenery';sceneryLabel.style.color='#ddd';
 const sceneryCurrent=document.createElement('span');
 const sceneryPreview=document.createElement('canvas');sceneryPreview.width=320;sceneryPreview.height=120;sceneryPreview.style.cssText='display:block;width:100%;height:92px;border:1px solid #353535;background:#070707;margin-bottom:6px;image-rendering:pixelated;';
 sceneryTitle.append(sceneryLabel,sceneryCurrent);
 const sceneryButtons=document.createElement('div');sceneryButtons.style.cssText='display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;';
 const sceneryControls=landscapeNames.map((label,index)=>{
  const control=button(label,()=>{
   if(core.setLandscape(index)){changed('Scenery changed to '+label);}
   else{renderScenery();renderStatus();}
  });
  control.title='Use '+label+' as the track background scenery';
  control.style.cssText+='padding:6px 3px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  sceneryButtons.append(control);return control;
 });
 const renderScenery=()=>{
  const selected=Math.max(0,Math.min(4,core.track.landscape));
  sceneryCurrent.textContent=landscapeNames[selected];
  const preview=host.sceneryPreviews?.[selected],previewContext=sceneryPreview.getContext('2d',{alpha:false})!;
  if(preview){
   const image=new ImageData(new Uint8ClampedArray(preview.rgba),preview.width,preview.height);
   sceneryPreview.width=preview.width;sceneryPreview.height=preview.height;previewContext.putImageData(image,0,0);
  }else{
   sceneryPreview.width=320;sceneryPreview.height=120;previewContext.fillStyle='#070707';previewContext.fillRect(0,0,320,120);
  }
  sceneryControls.forEach((control,index)=>setActive(control,index===selected));
 };
 sceneryBox.append(sceneryTitle,sceneryPreview,sceneryButtons);
 palettePanel.append(selectedPiece,paletteGrid,pageBar,sceneryBox);

 const editorSnapTraces=()=>{
  const hash=blissTrackHash(core.track);
  if(hash===spawnTraceHash)return spawnTraces;
  spawnTraceHash=hash;spawnTraces=[];
  try{
   const analysis=analyzeBlissRoute(core.track);
   spawnTraces=analysis.paths.slice(0,128).map((_,index)=>traceBlissPath(core.track,analysis,index));
  }catch{}
  return spawnTraces;
 };
 const localRoadSnap=(x:number,z:number,fallback=0,alreadySnapped=false)=>{
  let best:{x:number;z:number;heading:number;distance:number}|undefined;
  const headingDistance=(a:number,b:number)=>Math.abs((((a-b)+512)&1023)-512);
  const chooseHeading=(forward:number)=>{
   const reverse=normalizeRaceHeading(forward+512),base=normalizeRaceHeading(fallback);
   return headingDistance(forward,base)<=headingDistance(reverse,base)?normalizeRaceHeading(forward):reverse;
  };
  const considerSegment=(ax:number,az:number,bx:number,bz:number)=>{
   const dx=bx-ax,dz=bz-az,length2=dx*dx+dz*dz;if(!length2)return;
   const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length2)),px=ax+dx*t,pz=az+dz*t,distance=Math.hypot(x-px,z-pz);
   const forward=normalizeRaceHeading(-Math.atan2(dx,dz)*512/Math.PI),candidate={x:px,z:pz,heading:chooseHeading(forward),distance};
   if(!best||distance<best.distance)best=candidate;
  };
  for(let yCell=0;yCell<30;yCell++)for(let xCell=0;xCell<30;xCell++){
   const code=core.track.track[yCell*30+xCell]??0;if(code===253||code===254||code===255)continue;
   const data=blissElementData[code],shape=blissTransformations.track[code];if(!data||!shape)continue;
   const connections=data.ctype.map((value,index)=>value?index:-1).filter(index=>index>=0);if(connections.length!==2)continue;
   const x0=xCell*1024,x1=(xCell+shape.width)*1024,zNorth=(30-yCell)*1024,zSouth=(30-yCell-shape.height)*1024;
   const edges=[{x:(x0+x1)/2,z:zNorth},{x:x1,z:(zNorth+zSouth)/2},{x:(x0+x1)/2,z:zSouth},{x:x0,z:(zNorth+zSouth)/2}];
   const a=connections[0],b=connections[1];
   if(((a-b+4)%4)===2){considerSegment(edges[a].x,edges[a].z,edges[b].x,edges[b].z);continue;}
   let cx=0,cz=0;const key=[a,b].sort((l,r)=>l-r).join(',');
   if(key==='0,1'){cx=x1;cz=zNorth;}else if(key==='1,2'){cx=x1;cz=zSouth;}else if(key==='2,3'){cx=x0;cz=zSouth;}else if(key==='0,3'){cx=x0;cz=zNorth;}else continue;
   const p0=edges[a],p1=edges[b],start=Math.atan2(p0.z-cz,p0.x-cx),end0=Math.atan2(p1.z-cz,p1.x-cx);let delta=end0-start;
   while(delta<=-Math.PI)delta+=Math.PI*2;while(delta>Math.PI)delta-=Math.PI*2;
   if(Math.abs(delta)>Math.PI/2+.01)delta+=delta<0?Math.PI*2:-Math.PI*2;
   const radius=shape.width===2?1536:512,samples=Math.max(16,shape.width*16);
   for(let i=0;i<samples;i++){
    const t0=i/samples,t1=(i+1)/samples,q0={x:cx+Math.cos(start+delta*t0)*radius,z:cz+Math.sin(start+delta*t0)*radius},q1={x:cx+Math.cos(start+delta*t1)*radius,z:cz+Math.sin(start+delta*t1)*radius};
    considerSegment(q0.x,q0.z,q1.x,q1.z);
   }
  }
  const threshold=alreadySnapped?950:620;
  return best&&best.distance<=threshold?{...best,snapped:true}:{x,z,heading:normalizeRaceHeading(fallback),distance:best?.distance??Infinity,snapped:false};
 };
 const roadSnap=(x:number,z:number,fallback=0,alreadySnapped=false)=>{
  const routed=snapToBlissRoad(x,z,editorSnapTraces(),fallback,alreadySnapped);
  if(routed.snapped)return routed;
  const local=localRoadSnap(x,z,fallback,alreadySnapped);
  if(local.snapped)return local;
  let best:{x:number;z:number;heading:number;distance:number}|undefined;
  for(let y=0;y<30;y++)for(let xCell=0;xCell<30;xCell++){
   const code=core.track.track[y*30+xCell]??0,data=blissElementData[code];
   if(!data||!data.ctype.some(Boolean))continue;
   const px=(xCell+.5)*1024,pz=(29-y+.5)*1024,distance=Math.hypot(x-px,z-pz);
   if(!best||distance<best.distance)best={x:px,z:pz,heading:routed.heading,distance};
  }
  const threshold=alreadySnapped?950:620;
  return best&&best.distance<=threshold?{...best,snapped:true}:{x,z,heading:routed.heading,distance:best?.distance??Infinity,snapped:false};
 };
 const suggestedSpawnHeading=(x:number,z:number)=>roadSnap(x,z,0,false).heading;
 const mapPanel=panel('30 × 30 track');
 mapPanel.style.display='grid';mapPanel.style.gridTemplateRows='auto auto minmax(0,1fr)';mapPanel.style.placeItems='stretch';
 const zoomBar=document.createElement('div');zoomBar.style.cssText='display:flex;justify-content:center;align-items:center;gap:5px;margin:-2px 0 8px;flex-wrap:wrap;';
 const viewSwitch=document.createElement('label');viewSwitch.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border:1px solid #4a4a5d;border-radius:999px;background:#171722;color:#bbb;font-size:11px;cursor:pointer;user-select:none;';
 const view2D=document.createElement('span');view2D.textContent='2D';view2D.style.fontWeight='700';
 const viewToggle=document.createElement('input');viewToggle.type='checkbox';viewToggle.setAttribute('aria-label','Switch between 2D and 3D editor view');viewToggle.style.cssText='position:absolute;opacity:0;pointer-events:none;';
 const viewTrack=document.createElement('span');viewTrack.style.cssText='position:relative;display:inline-block;width:34px;height:18px;border-radius:999px;background:#3b3b49;border:1px solid #5f5f72;box-sizing:border-box;';
 const viewKnob=document.createElement('span');viewKnob.style.cssText='position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#d8d66d;transition:transform .12s ease;';
 viewTrack.append(viewKnob);
 const view3D=document.createElement('span');view3D.textContent='3D';view3D.style.fontWeight='700';
 viewSwitch.append(view2D,viewToggle,viewTrack,view3D);
 viewToggle.addEventListener('change',()=>{void setViewMode(viewToggle.checked?'3d':'2d');});
 view2D.addEventListener('click',event=>{event.preventDefault();viewToggle.checked=false;void setViewMode('2d');});
 view3D.addEventListener('click',event=>{event.preventDefault();viewToggle.checked=true;void setViewMode('3d');});
 const refresh3DSpawnOverlay=()=>{if(viewMode==='3d'&&testSpawn)renderMap();};
 const zoomOut=button('−',()=>{if(viewMode==='3d'){editor3D?.dolly(120,map3D.getBoundingClientRect().left+map3D.clientWidth/2,map3D.getBoundingClientRect().top+map3D.clientHeight/2);sync3DZoomLabel();refresh3DSpawnOverlay();}else setZoom(zoom-.25);}),zoomReset=button('100%',()=>{if(viewMode==='3d')void reset3DView();else setZoom(1);}),zoomIn=button('+',()=>{if(viewMode==='3d'){editor3D?.dolly(-120,map3D.getBoundingClientRect().left+map3D.clientWidth/2,map3D.getBoundingClientRect().top+map3D.clientHeight/2);sync3DZoomLabel();refresh3DSpawnOverlay();}else setZoom(zoom+.25);}),zoomFit=button('Fit',()=>fitMap());
 zoomOut.title='Zoom out';zoomIn.title='Zoom in';zoomReset.title='Actual size';zoomFit.title='Fit map to editor';
 for(const control of [zoomOut,zoomReset,zoomIn,zoomFit])control.style.padding='4px 8px';
 const spawnTool=document.createElement('button');spawnTool.type='button';spawnTool.draggable=false;spawnTool.title='Drag onto the map to choose a test start';spawnTool.innerHTML='<svg viewBox="0 0 20 24" width="14" height="17" aria-hidden="true"><circle cx="10" cy="4" r="3" fill="#e6b94a"/><path d="M7 8h6l2 6-2 1-1-4v11H9v-7H7v7H4V11l-1 4-2-1 2-6z" fill="#e6b94a"/></svg>';
 spawnTool.style.cssText='border:1px solid #665a32;background:#262116;color:#eee;border-radius:4px;padding:3px 7px;cursor:grab;';
 const spawnLeft=button('↶',()=>{if(testSpawn){testSpawn.heading=normalizeRaceHeading(testSpawn.heading-32);renderMap();editor3D?.render();}});
 const spawnRight=button('↷',()=>{if(testSpawn){testSpawn.heading=normalizeRaceHeading(testSpawn.heading+32);renderMap();editor3D?.render();}});
 const cars=[...(host.analysisCars??[])].sort((a,b)=>a.name.localeCompare(b.name));
 const testCar=document.createElement('select');testCar.title='Car used by Test from here';testCar.setAttribute('aria-label','Test car');
 testCar.style.cssText='border:1px solid #555;background:#202020;color:#eee;border-radius:4px;padding:4px 7px;font:11px/1.1 system-ui,Segoe UI,sans-serif;max-width:150px;';
 for(const car of cars){const option=document.createElement('option');option.value=car.id;option.textContent=car.name||car.id;testCar.append(option);}
 if(cars.length){const requested=host.testCarId??cars[0].id;if(cars.some(car=>car.id===requested))testCar.value=requested;}
 const testCarLabel=document.createElement('label');testCarLabel.style.cssText='display:inline-flex;align-items:center;gap:4px;color:#aaa;font-size:10px;';testCarLabel.append(document.createTextNode('Test car'),testCar);
 const testHere=button('Test from here',()=>{if(testSpawn)finishTest(testSpawn);});
 for(const control of [spawnLeft,spawnRight,testHere])control.style.display='none';
 const refreshSpawnControls=()=>{const show=!!testSpawn;spawnLeft.style.display=spawnRight.style.display=testHere.style.display=show?'inline-block':'none';};
 const dragGhost=document.createElement('div');
 dragGhost.style.cssText='position:fixed;display:none;z-index:2147483646;pointer-events:none;width:30px;height:38px;transform:translate(-50%,-85%);filter:drop-shadow(0 2px 2px #000);';
 dragGhost.innerHTML='<svg viewBox="0 0 30 38" width="30" height="38"><path d="M15 1v13m0-13-5 6m5-6 5 6" fill="none" stroke="#ffca3a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="18" r="4" fill="#ffca3a"/><path d="M11 23h8l3 8-3 1-2-5v10h-4v-7h-3v7H6V27l-2 5-3-1 3-8z" fill="#ffca3a"/></svg>';
 const dragGhostGraphic=dragGhost.querySelector<SVGSVGElement>('svg')!;
 dragGhostGraphic.style.transformOrigin='50% 85%';dragGhostGraphic.style.transformBox='fill-box';
 const rotateDragGhost=(heading:number)=>{dragGhostGraphic.style.transform='rotate('+(heading*-360/1024)+'deg)';};
 document.body.appendChild(dragGhost);
 let spawnDragging=false,spawnPointerId=-1,dragSnapped=false,dragHeadingOffset=0,dragCandidate:RaceSpawn|undefined;
 const updateSpawnDrag=(event:PointerEvent)=>{
  if(!spawnDragging||event.pointerId!==spawnPointerId)return;
  dragGhost.style.display='block';
  const target=viewMode==='3d'?map3D:map,rect=target.getBoundingClientRect();
  let gx=event.clientX,gy=event.clientY,candidate:RaceSpawn|undefined,snapped=false;
  if(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom){
   let point:{x:number;z:number}|null=null;
   if(viewMode==='2d'){
    const px=(event.clientX-rect.left)/Math.max(1,rect.width),py=(event.clientY-rect.top)/Math.max(1,rect.height);
    point={x:px*30720,z:(1-py)*30720};
   }else if(editor3D)point=editor3D.worldAt(event.clientX,event.clientY);
   if(point){
    const result=roadSnap(point.x,point.z,testSpawn?.heading??0,dragSnapped);dragSnapped=result.snapped;snapped=result.snapped;
    const roadY=viewMode==='3d'&&editor3D?(editor3D.roadHeightAt(result.x,result.z)??0):testSpawn?.y??0;
    candidate={x:result.x,y:roadY,z:result.z,heading:normalizeRaceHeading(result.heading+dragHeadingOffset)};
    if(snapped){
     if(viewMode==='2d'){gx=rect.left+result.x/30720*rect.width;gy=rect.top+(1-result.z/30720)*rect.height;}
     else if(editor3D){const p=editor3D.projectWorld(result.x,result.z,candidate.y??0);if(p){gx=rect.left+p.x;gy=rect.top+p.y;}}
    }
   }
  }else dragSnapped=false;
  dragCandidate=candidate;dragGhost.style.left=gx+'px';dragGhost.style.top=gy+'px';
  if(viewMode==='3d'&&candidate&&editor3D){
   const a=editor3D.projectWorld(candidate.x,candidate.z,candidate.y??0);
   const angle=candidate.heading*Math.PI/512,fx=-Math.sin(angle),fz=Math.cos(angle);
   const b=editor3D.projectWorld(candidate.x+fx*512,candidate.z+fz*512,candidate.y??0);
   if(a&&b)dragGhostGraphic.style.transform='rotate('+(Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI)+'deg)';
   else rotateDragGhost(candidate.heading);
  }else rotateDragGhost(candidate?.heading??0);
  dragGhost.style.filter=snapped?'drop-shadow(0 0 5px #8fd85f)':'drop-shadow(0 2px 2px #000)';
 };
 const finishSpawnDrag=(event:PointerEvent)=>{
  if(!spawnDragging||event.pointerId!==spawnPointerId)return;
  updateSpawnDrag(event);spawnDragging=false;spawnTool.style.cursor='grab';spawnTool.releasePointerCapture?.(event.pointerId);dragGhost.style.display='none';
  if(dragCandidate)setSpawn(dragCandidate.x,dragCandidate.z,dragCandidate.heading,dragCandidate.y);
  dragCandidate=undefined;dragSnapped=false;dragHeadingOffset=0;
 };
 spawnTool.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();spawnDragging=true;spawnPointerId=event.pointerId;spawnTool.style.cursor='grabbing';spawnTool.setPointerCapture?.(event.pointerId);
  dragCandidate=undefined;dragSnapped=false;dragHeadingOffset=0;updateSpawnDrag(event);
 });
 spawnTool.addEventListener('pointermove',updateSpawnDrag);
 spawnTool.addEventListener('pointerup',finishSpawnDrag);
 spawnTool.addEventListener('pointercancel',event=>{if(event.pointerId===spawnPointerId){spawnDragging=false;dragCandidate=undefined;dragSnapped=false;dragGhost.style.display='none';spawnTool.style.cursor='grab';}});
 const rotateDraggingSpawn=(event:WheelEvent)=>{
  if(!spawnDragging)return;
  event.preventDefault();event.stopImmediatePropagation();
  const step=event.deltaY>0?32:-32;dragHeadingOffset=normalizeRaceHeading(dragHeadingOffset+step);
  if(dragCandidate)dragCandidate.heading=normalizeRaceHeading(dragCandidate.heading+step);
  rotateDragGhost(dragCandidate?.heading??dragHeadingOffset);
 };
 const rotatePlacedSpawn=(event:WheelEvent)=>{
  if(!testSpawn)return false;
  const target=viewMode==='3d'?map3D:map,rect=target.getBoundingClientRect();
  let mx=0,my=0;
  if(viewMode==='2d'){
   mx=rect.left+testSpawn.x/30720*rect.width;my=rect.top+(1-testSpawn.z/30720)*rect.height;
  }else if(editor3D){
   const p=editor3D.projectWorld(testSpawn.x,testSpawn.z,(testSpawn.y??0)+120);if(!p)return false;mx=rect.left+p.x;my=rect.top+p.y;
  }else return false;
  if(Math.hypot(event.clientX-mx,event.clientY-my)>34)return false;
  event.preventDefault();event.stopImmediatePropagation();
  testSpawn.heading=normalizeRaceHeading(testSpawn.heading+(event.deltaY>0?32:-32));renderMap();return true;
 };
 window.addEventListener('pointermove',updateSpawnDrag,true);
 window.addEventListener('pointerup',finishSpawnDrag,true);
 window.addEventListener('wheel',rotateDraggingSpawn,{capture:true,passive:false});
 zoomBar.append(viewSwitch,zoomOut,zoomReset,zoomIn,zoomFit,testCarLabel,spawnTool,spawnLeft,spawnRight,testHere);
 const mapWrap=document.createElement('div');mapWrap.style.cssText='min-height:0;min-width:0;display:grid;place-items:center;overflow:auto;background:#050505;border-radius:4px;position:relative;';
 const spawn3DMarker=document.createElement('div');
 spawn3DMarker.style.cssText='position:absolute;display:none;z-index:8;pointer-events:none;width:34px;height:46px;transform:translate(-50%,-82%);filter:drop-shadow(0 2px 3px #000);';
 spawn3DMarker.innerHTML='<svg viewBox="0 0 34 46" width="34" height="46"><path d="M17 1v17m0-17-6 7m6-7 6 7" fill="none" stroke="#ffca3a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="23" r="4.5" fill="#ffca3a"/><path d="M13 28h8l3 8-3 1-2-5v13h-4v-9h-3v9H8V32l-2 5-3-1 3-8z" fill="#ffca3a"/></svg>';
 const map=document.createElement('canvas');map.width=BLISS_ORIGINAL_MAP_SIZE;map.height=BLISS_ORIGINAL_MAP_SIZE;map.style.cssText='grid-area:1/1;display:block;image-rendering:pixelated;width:480px;height:480px;max-width:none;max-height:none;cursor:crosshair;box-shadow:0 0 0 1px #333;flex:none;';
 const map3D=document.createElement('canvas');map3D.style.cssText='grid-area:1/1;display:none;width:100%;height:100%;min-width:0;min-height:320px;align-self:stretch;justify-self:stretch;cursor:crosshair;background:#111;';
 const setSpawn=(x:number,z:number,heading=suggestedSpawnHeading(x,z),y?:number)=>{testSpawn={x:Math.max(0,Math.min(30719,x)),y,z:Math.max(0,Math.min(30719,z)),heading:normalizeRaceHeading(heading)};refreshSpawnControls();renderMap();if(viewMode==='3d')editor3D?.setHover({x:Math.max(0,Math.min(29,Math.floor(testSpawn.x/1024))),y:Math.max(0,Math.min(29,29-Math.floor(testSpawn.z/1024)))});};

 mapWrap.append(map,map3D,spawn3DMarker);mapPanel.append(zoomBar,mapWrap);

 const toolsPanel=panel('');
 toolsPanel.querySelector('strong')?.remove();
 toolsPanel.style.display='grid';toolsPanel.style.gridTemplateRows='auto auto auto minmax(0,1fr)';toolsPanel.style.gap='10px';toolsPanel.style.minHeight='0';
 const attachHoverHelp=(control:HTMLElement,help:HoverHelp)=>{
  const shortcut=help.shortcut?('Shortcut: '+help.shortcut+'\n'):'';
  // Use the browser's native hover tooltip instead of reserving permanent
  // editor space. The tooltip contains the name, shortcut and explanation.
  control.title=help.name+'\n'+shortcut+help.description;
  control.setAttribute('aria-label',help.name+(help.shortcut?' — '+help.shortcut:'')+'. '+help.description);
 };
 const quick=document.createElement('div');quick.style.cssText='display:grid;grid-template-columns:repeat(4,48px);gap:5px;justify-content:center;padding:7px;background:#141414;border:1px solid #303030;border-radius:7px;';
 const toolIcons:readonly string[]=[
  '<rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M8 8h8v8H8z" opacity=".18"/>',
  '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M5 16V5h11"/>',
  '<path d="m6 6 12 12M18 6 6 18"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  '<path d="M7 6h10v4H7zM6 10h12v9H6z"/><path d="M9 6V4h6v2"/>',
  '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>',
  '<path d="M7 9a6 6 0 1 1 1 8"/><path d="M7 5v4h4"/>',
  '<path d="M17 9a6 6 0 1 0-1 8"/><path d="M17 5v4h-4"/>',
  '<circle cx="12" cy="12" r="8"/><path d="M12 10v6M12 7.5h.01"/>',
  '<path d="M9 6 5 10l4 4"/><path d="M5.5 10H14a5 5 0 0 1 5 5v2"/>',
  '<path d="m15 6 4 4-4 4"/><path d="M18.5 10H10a5 5 0 0 0-5 5v2"/>',
  '<circle cx="12" cy="12" r="8"/><path d="M9.8 9.5a2.5 2.5 0 1 1 3.8 2.1c-1 .65-1.6 1.15-1.6 2.4M12 17h.01"/>',
  '<path d="M5 19c1-4 3-6 7-6s6 2 7 6"/><path d="M8 13c-1-2-1-4 0-6 2 1 3 2 4 4 1-2 2-3 4-4 1 2 1 4 0 6"/>',
  '<path d="M5 18V9M10 18V5M15 18v-7M20 18V7"/><path d="M4 18h17"/>',
  '<path d="M7 5h10v3a5 5 0 0 1-10 0z"/><path d="M9 19h6M12 13v6"/><path d="M7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4"/>',
  '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
 ] as const;
 const quickButton=(icon:number,titleText:string,action?:()=>void)=>{
  const help=QUICK_TOOL_HELP[icon]??{name:titleText,description:titleText};
  const control=button('',()=>action?.());
  control.style.cssText+='width:48px;height:48px;padding:0;display:grid;place-items:center;background:#1c1c1c;border-color:#3a3a3a;border-radius:7px;transition:background .12s,border-color .12s,transform .12s;';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','25');svg.setAttribute('height','25');svg.setAttribute('aria-hidden','true');
  svg.style.cssText='display:block;fill:none;stroke:#c9c9d0;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;';
  svg.innerHTML=toolIcons[icon-4]??'<circle cx="12" cy="12" r="7"/>';
  control.replaceChildren(svg);attachHoverHelp(control,help);
  if(action){
   control.addEventListener('mouseenter',()=>{control.style.background='#262626';control.style.borderColor='#555';});
   control.addEventListener('mouseleave',()=>{control.style.background='#1c1c1c';control.style.borderColor='#3a3a3a';});
  }else{control.setAttribute('aria-disabled','true');control.style.opacity='.35';control.style.cursor='help';}
  quick.append(control);return control;
 };
 // File operations live in the footer in PlayStunts DX to avoid duplicate
 // New/Save/Load/Exit controls. The remaining Bliss icons keep their original
 // sprite positions and order.
 quickButton(4,'Select — same as holding Ctrl',()=>{selectionTool=true;activeArea='grid';updateArea();status.textContent='Selection tool active — drag a region.';});
 quickButton(5,'Copy',()=>copySelection());
 quickButton(6,'Cut',()=>cutSelection());
 quickButton(7,'Paste',()=>startPaste());
 quickButton(8,'Flip whole track / selection horizontally',()=>toolbarFlip(false));
 quickButton(9,'Flip whole track / selection vertically',()=>toolbarFlip(true));
 quickButton(10,'Rotate whole track / selection clockwise',()=>toolbarRotate(false));
 quickButton(11,'Rotate whole track / selection counter-clockwise',()=>toolbarRotate(true));
 quickButton(12,'Track Information',()=>showTrackInformation());
 const undoTool=quickButton(13,'Undo',()=>{if(core.undo())changed('Undo');});
 const redoTool=quickButton(14,'Redo',()=>{if(core.redo())changed('Redo');});
 quickButton(15,'Help',()=>showHelp(0));
 quickButton(16,'Generate Scenery',()=>showSceneryGenerator());
 quickButton(17,'Track Analysis',()=>showTrackAnalysis());
 quickButton(18,'Tournaments',()=>showTournaments());
 quickButton(19,'Editor Settings',()=>showEditorSettings());

 const switches=document.createElement('div');switches.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:10px;';
 const switchButtons=new Map<string,HTMLButtonElement>();
 const addSwitch=(id:string,label:string,action:()=>void)=>{const b=button(label,action),help=SWITCH_TOOL_HELP[id]??{name:label,description:label};attachHoverHelp(b,help);switchButtons.set(id,b);switches.append(b);return b;};
 addSwitch('clip','CLIP',()=>{core.clearClipboard();pasteMode=false;renderMap();renderStatus();status.textContent='Clipboard cleared.';});
 addSwitch('warn','WAR',()=>{showConflicts=!showConflicts;renderMap();renderStatus();});
 addSwitch('manual','MAN',()=>{allowConflicts=!allowConflicts;renderStatus();});
 addSwitch('grid','GRID',()=>{showGrid=!showGrid;renderMap();renderStatus();});
 addSwitch('colour','COL',()=>toggleColouringMode());
 addSwitch('shot','TRK SHOT',()=>void takeTrackShot());
 addSwitch('trk','TRK',()=>{affectTrack=!affectTrack;renderMap();renderStatus();});
 addSwitch('ter','TER',()=>{affectTerrain=!affectTerrain;renderMap();renderStatus();});
 addSwitch('debug','DEB',()=>{debugMode=!debugMode;renderMap();renderStatus();});

 const shortcutReference=document.createElement('section');shortcutReference.style.cssText='min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;align-content:start;border-top:1px solid #343447;padding-top:9px;';
 const shortcutHeader=document.createElement('div');shortcutHeader.style.cssText='display:flex;align-items:center;align-self:start;gap:8px;margin-bottom:7px;';
 const shortcutTitle=document.createElement('strong');shortcutTitle.textContent='Shortcuts';shortcutTitle.style.cssText='font-size:11px;color:#eee;margin-right:auto;';
 const shortcutToggle=button('',()=>{showShortcutReference=!showShortcutReference;renderShortcutReference();try{localStorage.setItem(shortcutHelpStorageKey,showShortcutReference?'1':'0');}catch{}});
 shortcutToggle.style.cssText+='padding:4px 7px;font-size:10px;';
 const shortcutList=document.createElement('div');shortcutList.style.cssText='min-height:0;overflow:auto;padding-right:3px;scrollbar-gutter:stable;';
 const shortcutReset=button('Reset Shortcuts',()=>{editorBindings={...EDITOR_BINDING_DEFAULTS};persistBindings();rebindingAction=null;renderShortcutReference();status.textContent='Shortcuts reset to defaults.';status.style.color='#aee18a';});
 shortcutReset.style.cssText+='margin-top:8px;width:100%;padding:6px 8px;font-size:10px;';
 const bindingLabel=(binding:string|null)=>{
  if(!binding)return 'Unbound';
  const parts=binding.split('+'),tail=parts.pop()??'';
  const names:Record<string,string>={Mouse0:'Mouse Left',Mouse1:'Mouse Middle',Mouse2:'Mouse Right',Mouse3:'Mouse 4',Mouse4:'Mouse 5',WheelUp:'Wheel Up',WheelDown:'Wheel Down',Space:'Space',Backslash:'\\',Delete:'Del'};
  const key=names[tail]??(tail.startsWith('Key')?tail.slice(3):tail.startsWith('Digit')?tail.slice(5):tail);
  return [...parts,key].join(' + ');
 };
 const modifierPrefix=(event:{ctrlKey:boolean;shiftKey:boolean;altKey:boolean;metaKey:boolean})=>[event.ctrlKey?'Ctrl':'',event.shiftKey?'Shift':'',event.altKey?'Alt':'',event.metaKey?'Meta':''].filter(Boolean);
 const keyboardBinding=(event:KeyboardEvent)=>[...modifierPrefix(event),event.code].join('+');
 const pointerBinding=(event:PointerEvent)=>[...modifierPrefix(event),'Mouse'+event.button].join('+');
 const wheelBinding=(event:WheelEvent)=>[...modifierPrefix(event),event.deltaY<0?'WheelUp':'WheelDown'].join('+');
 const actionForBinding=(binding:string,context:'global'|'3d'='global')=>EDITOR_BINDING_ACTIONS.find(action=>(context==='3d'?action.context==='3d':action.context!=='3d')&&editorBindings[action.id]===binding);
 const defaultOwnsBinding=(binding:string)=>EDITOR_BINDING_ACTIONS.some(action=>action.context!=='3d'&&action.defaultBinding===binding);
 const assignBinding=(actionId:string,binding:string|null)=>{
  let displaced:EditorBindingAction|undefined;
  if(binding){const target=EDITOR_BINDING_ACTIONS.find(action=>action.id===actionId),other=EDITOR_BINDING_ACTIONS.find(action=>action.id!==actionId&&action.context===target?.context&&editorBindings[action.id]===binding);if(other){editorBindings[other.id]=null;displaced=other;}}
  editorBindings[actionId]=binding;persistBindings();renderShortcutReference();
  const action=EDITOR_BINDING_ACTIONS.find(entry=>entry.id===actionId);
  status.textContent=(binding?bindingLabel(binding):'Unbound')+' → '+(action?.description??actionId)+(displaced?' · removed from '+displaced.description:'');
  status.style.color=displaced?'#ffbd7a':'#aee18a';
 };
 const appendShortcutGroup=(titleText:EditorBindingAction['group'])=>{
  const rows=EDITOR_BINDING_ACTIONS.filter(action=>action.group===titleText);
  const heading=document.createElement('div');heading.textContent=titleText;heading.style.cssText='font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8f8fae;margin:5px 0 4px;';
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:minmax(76px,104px) minmax(0,1fr);gap:3px 7px;align-items:start;';
  for(const action of rows){
   const key=document.createElement('kbd');key.textContent=rebindingAction===action.id?'Press input…':bindingLabel(editorBindings[action.id]);key.style.cssText='display:inline-block;min-width:0;padding:3px 4px;border:1px solid '+(rebindingAction===action.id?'#b4c35a':'#48485d')+';border-bottom-color:#64647c;border-radius:3px;background:'+(rebindingAction===action.id?'#393c20':'#191927')+';color:#e3df78;font:600 9.5px/1.25 ui-monospace,Consolas,monospace;white-space:normal;overflow-wrap:anywhere;cursor:pointer;';
   key.title='Click to rebind. Right-click to unbind.';
   key.addEventListener('click',()=>{rebindingAction=action.id;renderShortcutReference();status.textContent='Press a key, mouse button or wheel direction for '+action.description+'. Escape cancels.';status.style.color='#d8d66d';});
   key.addEventListener('contextmenu',event=>{event.preventDefault();rebindingAction=null;assignBinding(action.id,null);});
   const text=document.createElement('span');text.textContent=action.description;text.style.cssText='color:#b7b7c9;font-size:10px;line-height:1.3;';
   grid.append(key,text);
  }
  shortcutList.append(heading,grid);
 };
 const renderShortcutReference=()=>{
  shortcutList.replaceChildren();
  if(showShortcutReference){appendShortcutGroup('Editing & navigation');appendShortcutGroup('Track piece shortcuts');appendShortcutGroup('Mouse');appendShortcutGroup('3D camera');}
  shortcutList.style.display=showShortcutReference?'block':'none';shortcutReset.style.display=showShortcutReference?'block':'none';
  shortcutReference.style.gridTemplateRows=showShortcutReference?'auto minmax(0,1fr) auto':'auto 0 0';
  shortcutToggle.textContent=showShortcutReference?'Hide':'Show';
  shortcutToggle.title=(showShortcutReference?'Hide':'Show')+' shortcut reference';
 };
 shortcutHeader.append(shortcutTitle,shortcutToggle);shortcutReference.append(shortcutHeader,shortcutList,shortcutReset);renderShortcutReference();
 toolsPanel.append(quick,switches,shortcutReference);

 main.append(palettePanel,mapPanel,toolsPanel);

 const footer=document.createElement('div');footer.style.cssText='display:flex;align-items:center;gap:7px;min-width:0;';
 const coords=document.createElement('span');coords.style.cssText='font-size:11px;color:#888;';
 const colourControls=document.createElement('div');colourControls.style.cssText='display:none;align-items:center;gap:5px;margin-right:auto;';
 const borderIndicator=button('Border',()=>showColourDialog());borderIndicator.style.cssText+='padding:4px 7px;font-size:10px;';
 const backgroundIndicator=button('Background',()=>showColourDialog());backgroundIndicator.style.cssText+='padding:4px 7px;font-size:10px;';
 colourControls.append(borderIndicator,backgroundIndicator);
 const footerSpacer=document.createElement('span');footerSpacer.style.marginRight='auto';
 const newTrackButton=button('New',()=>{void createNewTrack();});
 const loadTrackButton=button('Load',()=>{void loadTrack();});
 const save=button('Save',()=>{void saveTrack();});
 const saveAs=button('Save As',()=>{void saveTrack(true);});
 const done=button('Done',()=>{void finish();});
 newTrackButton.title='New\nCreate a new track from a terrain preset.';
 loadTrackButton.title='Load\nLoad an existing track.';
 save.title='Save\nSave the current track into Custom Tracks.';
 saveAs.title='Save As\nSave a copy under a new track name.';
 done.title='Done\nLeave the editor; unsaved changes will be offered for saving.';
 footer.append(coords,colourControls,footerSpacer,newTrackButton,loadTrackButton,save,saveAs,done);
 overlay.append(top,main,footer);setBlissEditorActive(true);document.body.append(overlay);

 const context=map.getContext('2d',{alpha:false})!;
 const colour565ToRgb=(value:number)=>{
  const r=Math.round(((value>>>11)&31)*255/31),g=Math.round(((value>>>5)&63)*255/63),b=Math.round((value&31)*255/31);return {r,g,b};
 };
 const colour565ToHex=(value:number)=>{
  if(value===BLISS_TRANSPARENT_COLOUR)return '#ff00ff';
  const {r,g,b}=colour565ToRgb(value);return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
 };
 const hexToColour565=(hex:string)=>{
  const value=Number.parseInt(hex.replace('#',''),16)||0,r=(value>>>16)&255,g=(value>>>8)&255,b=value&255;
  return ((Math.round(r*31/255)&31)<<11)|((Math.round(g*63/255)&63)<<5)|(Math.round(b*31/255)&31);
 };
 const metadataColours=()=>core.metadata()?.metadata.colours;
 const drawColouring=(target:CanvasRenderingContext2D)=>{
  const colours=metadataColours();if(!colours)return;
  target.save();
  for(let i=0;i<900;i++){
   const x=(i%30)*16,y=Math.floor(i/30)*16,bg=colours.background[i],border=colours.border[i];
   if(bg!==BLISS_TRANSPARENT_COLOUR){const {r,g,b}=colour565ToRgb(bg);target.fillStyle=`rgba(${r},${g},${b},.34)`;target.fillRect(x,y,16,16);}
   if(border!==BLISS_TRANSPARENT_COLOUR){const {r,g,b}=colour565ToRgb(border);target.strokeStyle=`rgb(${r} ${g} ${b})`;target.lineWidth=2;target.strokeRect(x+1,y+1,14,14);}
  }
  target.restore();
 };
 const renderColourControls=()=>{
  colourControls.style.display=colouringMode?'flex':'none';footerSpacer.style.display=colouringMode?'none':'inline';
  const paint=(control:HTMLButtonElement,label:string,value:number)=>{
   control.textContent=label+(value===BLISS_TRANSPARENT_COLOUR?' · clear':'');
   const css=value===BLISS_TRANSPARENT_COLOUR?'transparent':colour565ToHex(value);
   control.style.boxShadow=value===BLISS_TRANSPARENT_COLOUR?'none':`inset 0 -4px 0 ${css}`;
  };
  paint(borderIndicator,'Border',borderColour);paint(backgroundIndicator,'Background',backgroundColour);
 };
 const setZoom=(next:number)=>{
  zoom=Math.max(.5,Math.min(4,Math.round(next*4)/4));
  const size=Math.round(BLISS_ORIGINAL_MAP_SIZE*zoom);
  map.style.width=size+'px';map.style.height=size+'px';zoomReset.textContent=Math.round(zoom*100)+'%';
 };
 const fitMap=()=>{
  const width=Math.max(1,mapWrap.clientWidth-20),height=Math.max(1,mapWrap.clientHeight-20);
  setZoom(Math.min(4,width/BLISS_ORIGINAL_MAP_SIZE,height/BLISS_ORIGINAL_MAP_SIZE));
 };
 const sync3DZoomLabel=()=>{if(viewMode==='3d'&&editor3D)zoomReset.textContent=editor3D.zoomPercent()+'%';};
 const drawSelection=()=>{
  const selection=core.selection;if(!selection)return;
  context.save();context.strokeStyle='#f2d000';context.lineWidth=2;
  context.strokeRect(selection.x*16+1,selection.y*16+1,selection.width*16-2,selection.height*16-2);context.restore();
 };
 const drawDebug=()=>{
  if(!debugMode)return;
  context.save();context.font='5px monospace';context.textBaseline='top';
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   const index=y*30+x,t=core.track.track[index],l=core.track.terrain[index];
   context.fillStyle='rgba(0,0,0,.72)';context.fillRect(x*16,y*16,15,6);
   context.fillStyle='#fff';context.fillText(t.toString(16).padStart(2,'0').toUpperCase()+'/'+l.toString(16).padStart(2,'0').toUpperCase(),x*16+1,y*16+1);
  }
  context.restore();
 };
 const drawConflict=()=>{
  if(!showConflicts)return;
  const issues=core.warnings();if(!issues.length)return;
  context.save();context.strokeStyle='#ffe04a';context.lineWidth=2;
  for(const issue of issues)context.strokeRect(issue.x*16+1,issue.y*16+1,14,14);
  context.restore();
 };
 const drawCarMarkers=(track:typeof core.track,target:CanvasRenderingContext2D)=>{
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   const code=track.track[y*30+x];if(code!==2&&code!==3)continue;
   const marker=markerImages[code];if(marker?.complete&&marker.naturalWidth)target.drawImage(marker,x*16,y*16,16,16);
  }
 };
 const renderMap=()=>{
  context.putImageData(blissOriginalMapImageData(core.track,host.resources,host.palette,showGrid),0,0);
  drawCarMarkers(core.track,context);
  drawColouring(context);
  let brushPreviewShown=false;
  if(pasteMode){
   const preview=core.previewPaste(cellX,cellY,{track:affectTrack,terrain:affectTerrain});
   if(preview){
    const ghost=document.createElement('canvas');ghost.width=BLISS_ORIGINAL_MAP_SIZE;ghost.height=BLISS_ORIGINAL_MAP_SIZE;
    const ghostContext=ghost.getContext('2d',{alpha:false})!;
    ghostContext.putImageData(blissOriginalMapImageData(preview,host.resources,host.palette,showGrid),0,0);drawCarMarkers(preview,ghostContext);
    context.save();context.globalAlpha=.62;context.drawImage(ghost,0,0);context.globalAlpha=1;
    const size=core.clipboardSize();if(size){context.strokeStyle='#ffe34d';context.lineWidth=2;context.strokeRect(cellX*16+1,cellY*16+1,size.width*16-2,size.height*16-2);}
    context.restore();
   }
  }else if(!colouringMode&&!suppressMapCursor&&page<10&&!core.selection&&!selectionTool){
   const preview=core.previewPlace(cellX,cellY,brush,allowConflicts);
   if(preview){
    const shape=core.definitions.track[brush],width=Math.max(1,shape?.width??1),height=Math.max(1,shape?.height??1);
    const px=cellX*16,py=cellY*16,pw=Math.min(width,30-cellX)*16,ph=Math.min(height,30-cellY)*16;
    const ghost=document.createElement('canvas');ghost.width=BLISS_ORIGINAL_MAP_SIZE;ghost.height=BLISS_ORIGINAL_MAP_SIZE;
    const ghostContext=ghost.getContext('2d',{alpha:false})!;
    ghostContext.putImageData(blissOriginalMapImageData(preview,host.resources,host.palette,showGrid),0,0);drawCarMarkers(preview,ghostContext);
    context.save();context.globalAlpha=.78;context.drawImage(ghost,px,py,pw,ph,px,py,pw,ph);context.restore();
    brushPreviewShown=true;
   }
  }
  drawConflict();drawDebug();drawSelection();
  if(!suppressMapCursor&&!brushPreviewShown){
   context.save();context.strokeStyle=activeArea==='grid'?'#fff':'rgba(255,255,255,.55)';context.lineWidth=1;context.strokeRect(cellX*16+.5,cellY*16+.5,15,15);context.restore();
  }
  if(testSpawn){
   const x=testSpawn.x/30720*BLISS_ORIGINAL_MAP_SIZE,y=(1-testSpawn.z/30720)*BLISS_ORIGINAL_MAP_SIZE;
   context.save();context.translate(x,y);context.rotate(-testSpawn.heading*Math.PI/512);context.strokeStyle='#ffca3a';context.fillStyle='#ffca3a';context.lineWidth=2;
   context.beginPath();context.moveTo(0,-13);context.lineTo(0,7);context.stroke();
   context.beginPath();context.moveTo(0,-13);context.lineTo(-4,-7);context.lineTo(4,-7);context.closePath();context.fill();
   context.beginPath();context.arc(0,2,4,0,Math.PI*2);context.fill();context.restore();
  }
  if(viewMode==='3d'&&testSpawn&&editor3D){
   const markerY=(testSpawn.y??0)+120,projected=editor3D.projectWorld(testSpawn.x,testSpawn.z,markerY);
   const angle=testSpawn.heading*Math.PI/512,fx=-Math.sin(angle),fz=Math.cos(angle);
   const forward=editor3D.projectWorld(testSpawn.x+fx*512,testSpawn.z+fz*512,markerY);
   if(projected){
    spawn3DMarker.style.display='block';spawn3DMarker.style.left=projected.x+'px';spawn3DMarker.style.top=projected.y+'px';
    spawn3DMarker.style.rotate=forward?(Math.atan2(forward.x-projected.x,-(forward.y-projected.y))*180/Math.PI)+'deg':'0deg';
   }else spawn3DMarker.style.display='none';
  }else spawn3DMarker.style.display='none';
 };
 const updateArea=()=>{
  palettePanel.style.boxShadow=activeArea==='palette'?'0 0 0 2px #879341 inset':'none';
  mapPanel.style.boxShadow=activeArea==='grid'?'0 0 0 2px #879341 inset':'none';
  renderMap();renderPalette();renderScenery();renderStatus();
 };
 const renderStatus=()=>{
  const terrainPage=page>=10,activeCode=terrainPage?terrainBrush:brush;
  const label=colouringMode?'Colouring / annotation':terrainPage?('Terrain '+terrainBrush):(blissElementData[brush]?.id||('Element '+brush));
  const flags=[colouringMode?'COL':'',allowConflicts?'MAN':'',showGrid?'GRID':'',showConflicts?'WAR':'',affectTrack?'TRK':'',affectTerrain?'TER':'',debugMode?'DEB':'',pasteMode?'PASTE':'',selectionTool?'SELECT':''].filter(Boolean).join(' ');
  status.textContent=(core.modified?'Modified · ':'')+label+' ['+activeCode+']'+(flags?' · '+flags:'');
  status.style.color=core.modified?'#f2d36d':'#c8c8c8';
  const selection=core.selection;
  coords.textContent='Cell '+(cellX+1)+','+(cellY+1)+(selection?' · selection '+selection.width+'×'+selection.height:'')+' · '+(activeArea==='grid'?'GRID':'PALETTE');
  undoTool.disabled=!core.history.canUndo;redoTool.disabled=!core.history.canRedo;
  for(const [id,b] of switchButtons){
   const active=id==='clip'?!!core.clipboardSize():id==='warn'?showConflicts:id==='manual'?allowConflicts:id==='grid'?showGrid:id==='colour'?colouringMode:id==='trk'?affectTrack:id==='ter'?affectTerrain:id==='debug'?debugMode:false;
   setActive(b,active);
  }
  renderColourControls();
 };
 const changed=(message='')=>{
  spawnTraceHash=-1;spawnTraces=[];
  const bytes=encodeBlissTrack(core.track).subarray(0,1802);host.track.raw=Array.from(bytes);
  renderMap();renderPalette();renderScenery();renderStatus();if(viewMode==='3d')editor3D?.update(core.track);if(message)status.textContent=message+' · '+status.textContent;
 };
 const paletteLabels=['Paved','Dirt','Ice','Stunts','Banked','Splits','Highway','Elevated','Spins','Scenery','Terrain tiles','Terrain brush'] as const;
 const markerImages:{[key:number]:HTMLImageElement}={2:new Image(),3:new Image()};
 markerImages[2].src=BLISS_PLAYER_CARD_ICON;markerImages[3].src=BLISS_OPPONENT_CARD_ICON;

 const pageSlots=(index:number)=>blissPalettePages[index];
 type PaletteBlock={code:number;row:number;column:number;width:number;height:number};
 const paletteBlocks=(index:number):PaletteBlock[]=>{
  const slots=pageSlots(index),used=Array(36).fill(false),blocks:PaletteBlock[]=[];
  for(let row=0;row<6;row++)for(let column=0;column<6;column++){
   const slot=row*6+column;if(used[slot])continue;
   const code=slots[slot]??0;
   const selectable=index<10?(code>0&&code<253):index===11?(code===1||code===6):(code<=18);
   if(!selectable)continue;
   let width=1,height=1;
   if(index<10){
    const shape=blissTrackTransforms[code];width=Math.max(1,shape?.width??1);height=Math.max(1,shape?.height??1);
    if(column+width>6||row+height>6)width=height=1;
    else{
     let same=true;
     for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(slots[(row+y)*6+column+x]!==code)same=false;
     if(!same)width=height=1;
    }
   }else if(index===11){
    // Bliss' F12 palette is two 2×2 pictograms (water and mountain).
    if(column<=4&&row<=4&&slots[slot+1]===code&&slots[slot+6]===code&&slots[slot+7]===code){width=2;height=2;}
   }
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)used[(row+y)*6+column+x]=true;
   blocks.push({code,row,column,width,height});
  }
  return blocks;
 };
 const blockForCursor=(index:number,cursor:number)=>paletteBlocks(index).find(block=>{
  const row=Math.floor(cursor/6),column=cursor%6;
  return row>=block.row&&row<block.row+block.height&&column>=block.column&&column<block.column+block.width;
 });
 const terrainLabel=(code:number,pageIndex=page)=>{
  if(pageIndex===11)return code===1?'Water brush':code===6?'Mountain brush':('Terrain brush '+code);
  if(code===0)return 'Flat / grass';
  if(code===1)return 'Water';
  if(code===6)return 'Mountain';
  return 'Terrain tile '+code;
 };
 const drawPreview=(canvas:HTMLCanvasElement,code:number,terrain:boolean,size:number,width=1,height=1)=>{
  const image=blissOriginalPaletteImageData(code,terrain,host.resources,host.palette);
  const cropWidth=terrain?16:Math.max(16,Math.min(image.width,width*16)),cropHeight=terrain?16:Math.max(16,Math.min(image.height,height*16));
  canvas.width=cropWidth;canvas.height=cropHeight;
  const cx=canvas.getContext('2d',{alpha:false})!;
  cx.putImageData(image,0,0,0,0,cropWidth,cropHeight);
  const marker=!terrain?markerImages[code]:undefined;
  if(marker?.complete&&marker.naturalWidth)cx.drawImage(marker,0,0,cropWidth,cropHeight);
  canvas.style.width=Math.max(size,width*size)+'px';canvas.style.height=Math.max(size,height*size)+'px';
 };
 const drawSelectedPreview=(code:number,terrain:boolean,width=1,height=1)=>{
  const image=blissOriginalPaletteImageData(code,terrain,host.resources,host.palette);
  const cropWidth=terrain?16:Math.max(16,Math.min(image.width,width*16)),cropHeight=terrain?16:Math.max(16,Math.min(image.height,height*16));
  const source=document.createElement('canvas');source.width=cropWidth;source.height=cropHeight;
  const sx=source.getContext('2d',{alpha:false})!;sx.putImageData(image,0,0,0,0,cropWidth,cropHeight);
  const marker=!terrain?markerImages[code]:undefined;
  if(marker?.complete&&marker.naturalWidth)sx.drawImage(marker,0,0,cropWidth,cropHeight);
  selectedPreview.width=112;selectedPreview.height=112;
  const cx=selectedPreview.getContext('2d',{alpha:false})!;cx.imageSmoothingEnabled=false;cx.fillStyle='#070707';cx.fillRect(0,0,112,112);
  const available=104,scale=Math.min(available/cropWidth,available/cropHeight),drawWidth=Math.max(1,Math.round(cropWidth*scale)),drawHeight=Math.max(1,Math.round(cropHeight*scale));
  const x=Math.floor((112-drawWidth)/2),y=Math.floor((112-drawHeight)/2);
  cx.drawImage(source,0,0,cropWidth,cropHeight,x,y,drawWidth,drawHeight);
  selectedPreview.style.width='112px';selectedPreview.style.height='112px';
 };
 const drawPageIcon=(canvas:HTMLCanvasElement,index:number)=>{
  if(index===10){
   const codes=[0,1,6,11];canvas.width=32;canvas.height=32;const cx=canvas.getContext('2d',{alpha:false})!;
   codes.forEach((code,n)=>cx.putImageData(blissOriginalPaletteImageData(code,true,host.resources,host.palette),(n%2)*16,Math.floor(n/2)*16));
   canvas.style.width='38px';canvas.style.height='38px';return;
  }
  if(index===11){
   canvas.width=32;canvas.height=16;const cx=canvas.getContext('2d',{alpha:false})!;
   cx.putImageData(blissOriginalPaletteImageData(1,true,host.resources,host.palette),0,0);
   cx.putImageData(blissOriginalPaletteImageData(6,true,host.resources,host.palette),16,0);
   canvas.style.width='40px';canvas.style.height='20px';return;
  }
  const representative=pageSlots(index).find(code=>code>0&&code<253)??0;drawPreview(canvas,representative,false,38);
 };
 const renderPalette=()=>{
  const terrainPage=page>=10,currentCode=terrainPage?terrainBrush:brush,currentLabel=terrainPage?terrainLabel(terrainBrush):(blissElementData[brush]?.id||('Element '+brush));
  selectedName.textContent=manualHexDeadline?'?':currentLabel;
  selectedCode.textContent=manualHexDeadline?('Manual code: '+manualHex.padEnd(2,'_')):page===10
   ?('F11 · direct terrain tile · left click/Enter places, right click/Del clears')
   :page===11
    ?('F12 · brush mode · left adds, right removes · mouse only')
    :(('Track element ')+currentCode+' · F'+(page+1));
  const selectedShape=!terrainPage?blissTrackTransforms[currentCode]:undefined;
  drawSelectedPreview(currentCode,terrainPage,selectedShape?.width??1,selectedShape?.height??1);
  if(viewMode==='3d'&&editor3D)editor3D.setGhost({x:cellX,y:cellY},currentCode,terrainPage,core.track.terrain[cellY*30+cellX]);

  paletteGrid.replaceChildren();
  const blocks=paletteBlocks(page);
  if(!blockForCursor(page,paletteCursor)&&blocks.length)paletteCursor=blocks[0].row*6+blocks[0].column;
  for(const block of blocks){
   const {code,row,column,width,height}=block,label=terrainPage?terrainLabel(code):(blissElementData[code]?.id||('Element '+code));
   const entry=button('',()=>{
    paletteCursor=row*6+column;selectPaletteCode(code,terrainPage);activeArea='palette';updateArea();
   });
   entry.title=label;entry.setAttribute('aria-label',label);
   entry.style.cssText+='display:grid;place-items:center;padding:3px;overflow:hidden;min-width:0;min-height:0;';
   entry.style.gridColumn=(column+1)+' / span '+width;entry.style.gridRow=(row+1)+' / span '+height;
   const preview=document.createElement('canvas');preview.style.cssText='image-rendering:pixelated;display:block;max-width:100%;max-height:100%;object-fit:contain;';
   drawPreview(preview,code,terrainPage,44,width,height);entry.append(preview);
   const cursorRow=Math.floor(paletteCursor/6),cursorColumn=paletteCursor%6;
   const cursorHere=cursorRow>=row&&cursorRow<row+height&&cursorColumn>=column&&cursorColumn<column+width;
   setActive(entry,code===currentCode||activeArea==='palette'&&cursorHere);paletteGrid.append(entry);
  }

  pageBar.replaceChildren();
  for(let i=0;i<blissPalettePages.length;i++){
   const pageButton=button('',()=>{choosePage(i);});
   const shortcut='F'+(i+1);
   const pageHelp:HoverHelp=i===10
    ?{name:'Terrain tiles (F11)',shortcut:'F11',description:'Direct terrain editing. Pick any terrain tile and place/delete it like a track element.'}
    :i===11
     ?{name:'Terrain brush (F12)',shortcut:'F12',description:'Mouse-only Bliss brush. Pick Water or Mountain; left click floods/raises, right click dries/lowers, with edge repair.'}
     :{name:paletteLabels[i]??('Page '+(i+1)),shortcut,description:'Select palette page '+(i+1)+'.'};
   pageButton.title=pageHelp.name+' ('+pageHelp.shortcut+')';pageButton.setAttribute('aria-label',pageButton.title);attachHoverHelp(pageButton,pageHelp);
   pageButton.style.cssText+='display:grid;place-items:center;height:48px;padding:3px;overflow:hidden;';
   const icon=document.createElement('canvas');icon.style.cssText='image-rendering:pixelated;display:block;';
   drawPageIcon(icon,i);pageButton.append(icon);
   setActive(pageButton,page===i);pageBar.append(pageButton);
  }
 };
 const selectPaletteCode=(code:number,terrain=page>=10)=>{
  if(terrain)terrainBrush=code;else brush=code;
  renderPalette();renderMap();renderStatus();
 };
 async function reset3DView(){
  if(!editor3D)return;
  editor3D.resetView();editor3D.render();sync3DZoomLabel();refresh3DSpawnOverlay();
 }
  async function setViewMode(mode:'2d'|'3d'){
  viewMode=mode;host.onViewModeChange?.(mode);viewToggle.checked=mode==='3d';viewKnob.style.transform=mode==='3d'?'translateX(16px)':'translateX(0)';view2D.style.color=mode==='2d'?'#fff':'#777';view3D.style.color=mode==='3d'?'#fff':'#777';
  map.style.display=mode==='2d'?'block':'none';map3D.style.display=mode==='3d'?'block':'none';
  for(const control of [zoomOut,zoomReset,zoomIn])control.style.display='inline-block';
  zoomFit.style.display=mode==='2d'?'inline-block':'none';
  mapWrap.style.overflow=mode==='2d'?'auto':'hidden';
  if(mode==='3d'){
   if(!editor3D){const module=await import('./bliss-editor-3d.ts');editor3D=module.createBlissEditor3DView(map3D,host.assets,core.track,{initialCamera:host.initial3DCamera});}
   else editor3D.update(core.track);
   requestAnimationFrame(()=>{editor3D?.render();if(testSpawn)editor3D?.setHover({x:Math.max(0,Math.min(29,Math.floor(testSpawn.x/1024))),y:Math.max(0,Math.min(29,29-Math.floor(testSpawn.z/1024)))});sync3DZoomLabel();});
   status.textContent='3D view · Ctrl + Left drag orbit · Ctrl + Right drag move · Wheel / Ctrl+Wheel dolly';
   status.style.color='#aee18a';
  }else{editor3D?.setHover(null);editor3D?.setGhost(null,0,false,0);zoomReset.textContent=Math.round(zoom*100)+'%';renderMap();requestAnimationFrame(()=>fitMap());}
 }
 const mapCoordinates=(event:PointerEvent)=>{
  const rect=map.getBoundingClientRect(),px=(event.clientX-rect.left)*map.width/rect.width,py=(event.clientY-rect.top)*map.height/rect.height;
  return {x:Math.max(0,Math.min(29,Math.floor(px/16))),y:Math.max(0,Math.min(29,Math.floor(py/16))),vx:Math.max(0,Math.min(30,Math.round(px/16))),vy:Math.max(0,Math.min(30,Math.round(py/16)))};
 };
 const setSelectionFrom=(a:{x:number;y:number},b:{x:number;y:number})=>{
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),width=Math.abs(a.x-b.x)+1,height=Math.abs(a.y-b.y)+1;
  core.setSelection({x,y,width,height});renderMap();renderStatus();
 };
 const colourCell=(x:number,y:number,eraseColour=false)=>{
  const current=core.metadata(),now=new Date(),metadata:BlissMetadata=current?{...current.metadata}:{
   title:'',author:'Anonymous',comment:'',championship:'',year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate(),tool:'PlayStunts DX',toolVersion:100,editingTime:0,
  };
  const old=metadata.colours,border=old?new Uint16Array(old.border):new Uint16Array(900),background=old?new Uint16Array(old.background):new Uint16Array(900);
  if(!old){border.fill(BLISS_TRANSPARENT_COLOUR);background.fill(BLISS_TRANSPARENT_COLOUR);}
  const index=y*30+x;
  if(eraseColour){border[index]=BLISS_TRANSPARENT_COLOUR;background[index]=BLISS_TRANSPARENT_COLOUR;}
  else{border[index]=borderColour;background[index]=backgroundColour;}
  metadata.colours={border,background};metadata.tool='PlayStunts DX';metadata.toolVersion=100;
  core.setMetadata(metadata,'binary');renderMap();renderStatus();if(viewMode==='3d')editor3D?.update(core.track);
 };
 const apply=(event:PointerEvent,forceErase=false)=>{
  const p=mapCoordinates(event);cellX=p.x;cellY=p.y;activeArea='grid';
  if(colouringMode){colourCell(p.x,p.y,forceErase||event.button===2);return;}
  if(page===11){
   // Bliss F12 has no separate Flood/Dry/Raise/Lower tools: the selected
   // Water/Mountain brush plus the mouse button defines the operation.
   if(terrainBrush===1){if(forceErase||event.button===2)core.dry(p.vx,p.vy);else core.flood(p.vx,p.vy);}
   else if(terrainBrush===6){if(forceErase||event.button===2)core.lower(p.vx,p.vy);else core.raise(p.vx,p.vy);}
  }else if(page===10){
   // Bliss F11 edits terrain exactly like ordinary tiles.
   core.paintTerrain(p.x,p.y,(forceErase||event.button===2)?0:terrainBrush);
  }else if(forceErase||event.button===2)core.clear(p.x,p.y,allowConflicts);
  else if(core.place(p.x,p.y,brush,allowConflicts))lastPlaced={x:p.x,y:p.y};
  changed();
 };
 const pointerDown=(event:PointerEvent)=>{
  const binding=pointerBinding(event);let action=actionForBinding(binding);
  if(!action&&event.shiftKey){
   const base=[...modifierPrefix({ctrlKey:event.ctrlKey,shiftKey:false,altKey:event.altKey,metaKey:event.metaKey}),'Mouse'+event.button].join('+'),baseAction=actionForBinding(base);
   if(baseAction?.smartKey)action=baseAction;
  }
  if(!action){if(defaultOwnsBinding(binding)){event.preventDefault();event.stopPropagation();}return;}
  event.preventDefault();activeArea='grid';map.setPointerCapture(event.pointerId);
  const p=mapCoordinates(event);cellX=p.x;cellY=p.y;
  if(pasteMode&&(action.id==='paint'||action.id==='erase')){
   if(action.id==='paint')commitPaste();else{pasteMode=false;renderMap();renderStatus();}
   return;
  }
  if((action.id==='selectDrag'||(selectionTool&&action.id==='paint'))&&!colouringMode){selecting=true;selectionAnchor={x:p.x,y:p.y};setSelectionFrom(selectionAnchor,p);return;}
  if(action.id==='paint'||action.id==='erase'){
   painting=true;activePaintAction=action.id;core.beginStroke();apply(event,action.id==='erase');return;
  }
  executeBoundAction(action,event.shiftKey);
 };
 const pointerMove=(event:PointerEvent)=>{
  const p=mapCoordinates(event);if(p.x===cellX&&p.y===cellY)return;cellX=p.x;cellY=p.y;
  if(selecting&&selectionAnchor){setSelectionFrom(selectionAnchor,p);return;}
  if(pasteMode){renderMap();renderStatus();return;}
  if(painting&&activePaintAction)apply(event,activePaintAction==='erase');else{renderMap();renderStatus();}
 };
 const pointerUp=(event:PointerEvent)=>{
  if(painting)core.endStroke();
  painting=false;activePaintAction=null;
  if(selecting&&selectionTool)selectionTool=false;
  selecting=false;selectionAnchor=null;
  if(map.hasPointerCapture(event.pointerId))map.releasePointerCapture(event.pointerId);
  renderStatus();
 };
 const capturePointerBinding=(event:PointerEvent)=>{
  if(!rebindingAction)return;
  event.preventDefault();event.stopImmediatePropagation();
  const target=rebindingAction;rebindingAction=null;assignBinding(target,pointerBinding(event));
 };
 const captureWheelBinding=(event:WheelEvent)=>{
  if(!rebindingAction)return;
  event.preventDefault();event.stopImmediatePropagation();
  const target=rebindingAction;rebindingAction=null;assignBinding(target,wheelBinding(event));
 };
 const wheelInput=(event:WheelEvent)=>{
  const binding=wheelBinding(event),action=actionForBinding(binding);
  if(action){event.preventDefault();executeBoundAction(action,event.shiftKey);return;}
  if(event.shiftKey){
   const base=wheelBinding({ctrlKey:event.ctrlKey,shiftKey:false,altKey:event.altKey,metaKey:event.metaKey,deltaY:event.deltaY} as WheelEvent),baseAction=actionForBinding(base);
   if(baseAction?.smartKey){event.preventDefault();executeBoundAction(baseAction,true);return;}
  }
  if(defaultOwnsBinding(binding)){event.preventDefault();return;}
 };
 window.addEventListener('pointerdown',capturePointerBinding,true);
 window.addEventListener('wheel',captureWheelBinding,{capture:true,passive:false});
 map.addEventListener('pointerdown',pointerDown);map.addEventListener('pointermove',pointerMove);map.addEventListener('pointerup',pointerUp);map.addEventListener('pointercancel',pointerUp);map.addEventListener('contextmenu',event=>event.preventDefault());
 map.addEventListener('wheel',wheelInput,{passive:false});

 let view3DDrag:'orbit'|'pan'|null=null,view3DLastX=0,view3DLastY=0,view3DPaint:'paint'|'erase'|null=null,view3DLastPaintCell='';
 const update3DCell=(event:PointerEvent)=>{
  const cell=editor3D?.cellAt(event.clientX,event.clientY)??null;
  if(cell){
   cellX=cell.x;cellY=cell.y;activeArea='grid';editor3D?.setHover(cell);
   const terrainPage=page>=10,currentCode=terrainPage?terrainBrush:brush;
   editor3D?.setGhost(cell,currentCode,terrainPage,core.track.terrain[cell.y*30+cell.x]);renderStatus();
  }else{editor3D?.setHover(null);editor3D?.setGhost(null,0,false,0);}
  return cell;
 };
 map3D.addEventListener('pointerdown',event=>{
  if(viewMode!=='3d'||!editor3D)return;
  const cameraAction=actionForBinding(pointerBinding(event),'3d');
  if(cameraAction?.id==='orbit3D'||cameraAction?.id==='pan3D'){
   event.preventDefault();view3DDrag=cameraAction.id==='orbit3D'?'orbit':'pan';view3DLastX=event.clientX;view3DLastY=event.clientY;map3D.setPointerCapture(event.pointerId);return;
  }
  const cell=update3DCell(event);if(!cell)return;
  const action=actionForBinding(pointerBinding(event));if(!action)return;
  event.preventDefault();
  if(action.id==='paint'||action.id==='erase'){
   if(colouringMode){
    view3DPaint=action.id;view3DLastPaintCell=cell.x+','+cell.y;core.beginStroke();colourCell(cell.x,cell.y,action.id==='erase');return;
   }
   if(action.id==='paint')insertAtCursor();else deleteAtCursor();return;
  }
  if(action.id==='mousePick'||action.id==='pick'){
   if(colouringMode&&action.id==='mousePick'){showColourDialog();return;}
   pickAtCursor();editor3D.update(core.track);return;
  }
  executeBoundAction(action,event.shiftKey);
 });
 map3D.addEventListener('pointermove',event=>{
  if(viewMode!=='3d'||!editor3D)return;
  if(view3DDrag){
   const dx=event.clientX-view3DLastX,dy=event.clientY-view3DLastY;view3DLastX=event.clientX;view3DLastY=event.clientY;
   if(view3DDrag==='orbit')editor3D.orbit(dx,dy);else editor3D.pan(dx,dy);refresh3DSpawnOverlay();return;
  }
  const cell=update3DCell(event);
  if(view3DPaint&&cell){
   const key=cell.x+','+cell.y;
   if(key!==view3DLastPaintCell){view3DLastPaintCell=key;colourCell(cell.x,cell.y,view3DPaint==='erase');}
  }
 });
 const end3DDrag=(event:PointerEvent)=>{if(view3DPaint)core.endStroke();view3DPaint=null;view3DLastPaintCell='';view3DDrag=null;if(map3D.hasPointerCapture(event.pointerId))map3D.releasePointerCapture(event.pointerId);};
 map3D.addEventListener('pointerup',end3DDrag);map3D.addEventListener('pointercancel',end3DDrag);map3D.addEventListener('contextmenu',event=>event.preventDefault());
 const markerWheel=(event:WheelEvent)=>{if(spawnDragging)return;if(rotatePlacedSpawn(event))return;};
 map.addEventListener('wheel',markerWheel,{capture:true,passive:false});
 map3D.addEventListener('wheel',markerWheel,{capture:true,passive:false});
 map3D.addEventListener('wheel',event=>{
  if(viewMode!=='3d'||!editor3D)return;
  const binding=wheelBinding(event),plainBinding=event.ctrlKey?[event.deltaY<0?'WheelUp':'WheelDown'].join(''):binding;
  const cameraAction=actionForBinding(binding,'3d')??actionForBinding(plainBinding,'3d');
  if(cameraAction?.id==='dollyIn3D'){event.preventDefault();editor3D.dolly(-Math.max(40,Math.abs(event.deltaY)),event.clientX,event.clientY);sync3DZoomLabel();refresh3DSpawnOverlay();return;}
  if(cameraAction?.id==='dollyOut3D'){event.preventDefault();editor3D.dolly(Math.max(40,Math.abs(event.deltaY)),event.clientX,event.clientY);sync3DZoomLabel();refresh3DSpawnOverlay();return;}
  const action=actionForBinding(binding);
  if(action?.id==='zoomIn'||action?.id==='zoomOut'){event.preventDefault();editor3D.dolly(action.id==='zoomIn'?-120:120,event.clientX,event.clientY);sync3DZoomLabel();refresh3DSpawnOverlay();return;}
  if(action){event.preventDefault();executeBoundAction(action,event.shiftKey);}
 },{passive:false});

 const choosePage=(index:number)=>{
  page=Math.max(0,Math.min(11,index));paletteCursor=0;activeArea='palette';
  if(page===11&&terrainBrush!==1&&terrainBrush!==6)terrainBrush=1;
  renderPalette();renderStatus();updateArea();
 };
 const pickAtCursor=()=>{
  const code=core.track.track[cellY*30+cellX];
  if(code){const parent=blissParentElement(core.track,cellX,cellY,core.definitions);brush=parent.code;page=Math.min(9,Math.max(0,blissPalettePages.findIndex(values=>values.includes(brush))));renderPalette();renderStatus();return;}
  if(page>=10){terrainBrush=core.track.terrain[cellY*30+cellX];renderPalette();renderStatus();}
 };
 const copySelection=()=>{if(core.copySelection()){pasteMode=false;status.textContent='Selection copied';status.style.color='#aee18a';}else status.textContent='Select a region first.';};
 const cutSelection=()=>{if(core.cutSelection({track:affectTrack,terrain:affectTerrain})){pasteMode=false;core.setSelection(null);changed('Selection cut');}else status.textContent='Select a region first.';};
 const startPaste=()=>{
  if(!core.clipboardSize()){status.textContent='Clipboard is empty.';status.style.color='#ffbd7a';return;}
  pasteMode=true;core.setSelection(null);activeArea='grid';renderMap();renderStatus();status.textContent='Clipboard hovering — move it, transform if needed, then left-click or Enter.';
 };
 const commitPaste=()=>{
  if(!pasteMode)return false;
  if(core.paste(cellX,cellY,{track:affectTrack,terrain:affectTerrain})){pasteMode=false;changed('Clipboard pasted');return true;}
  status.textContent='Clipboard does not fit at this position.';status.style.color='#ffbd7a';return false;
 };
 const flip=(vertical:boolean)=>{
  if(pasteMode){const ok=vertical?core.vflipClipboard():core.hflipClipboard();if(ok){renderMap();renderStatus();}return;}

  try{
   if(core.selection){const ok=vertical?core.vflipSelection():core.hflipSelection();if(ok)changed(vertical?'Selection flipped vertically':'Selection flipped horizontally');return;}
   transformBrush(vertical?'vflip':'hflip',vertical?'Vertical flip':'Horizontal flip');
  }catch(error){status.textContent=String(error);status.style.color='#ff9b9b';}
 };
 const rotate=(counter:boolean)=>{
  if(pasteMode){const ok=counter?core.rotateClipboardCounterClockwise():core.rotateClipboardClockwise();if(ok){renderMap();renderStatus();}return;}
  try{
   if(core.selection){const ok=counter?core.rotateSelectionCounterClockwise():core.rotateSelectionClockwise();if(ok)changed(counter?'Selection rotated counter-clockwise':'Selection rotated clockwise');return;}
   transformBrush(counter?'counterClockwise':'clockwise',counter?'Rotate counter-clockwise':'Rotate clockwise');
  }catch{status.textContent='Bliss can only rotate a square selection in place.';status.style.color='#ffbd7a';}
 };
 const toolbarFlip=(vertical:boolean)=>{
  if(pasteMode||core.selection){flip(vertical);return;}
  core.setSelection({x:0,y:0,width:30,height:30});
  const ok=vertical?core.vflipSelection():core.hflipSelection();core.setSelection(null);
  if(ok)changed(vertical?'Whole track flipped vertically':'Whole track flipped horizontally');
 };
 const toolbarRotate=(counter:boolean)=>{
  if(pasteMode||core.selection){rotate(counter);return;}
  core.setSelection({x:0,y:0,width:30,height:30});
  const ok=counter?core.rotateSelectionCounterClockwise():core.rotateSelectionClockwise();core.setSelection(null);
  if(ok)changed(counter?'Whole track rotated counter-clockwise':'Whole track rotated clockwise');
 };
 const checkTrack=()=>{
  try{
   const result=core.check();status.textContent=result.ok?'Track OK — winning path found':'Track check: '+result.reason+' · error '+result.error;status.style.color=result.ok?'#aee18a':'#ffbd7a';
   if(result.point){cellX=result.point.x;cellY=result.point.y;renderMap();}
  }catch(error){
   status.textContent='Track check failed: '+String(error);status.style.color='#ff9b9b';
  }
 };
 const wholeSelection=()=>{const s=core.selection;if(s&&s.x===0&&s.y===0&&s.width===30&&s.height===30)core.setSelection(null);else core.setSelection({x:0,y:0,width:30,height:30});renderMap();renderStatus();};
 const deleteAtCursor=()=>{
  if(core.selection){if(core.deleteSelection({track:affectTrack,terrain:affectTerrain}))changed('Selection deleted');return;}
  if(page===10){if(core.paintTerrain(cellX,cellY,0))changed('Terrain deleted');}
  else if(page===11){status.textContent='Bliss F12 terrain brushes are mouse-only.';status.style.color='#ffbd7a';}
  else if(core.clear(cellX,cellY,allowConflicts))changed('Element deleted');
 };
 const insertAtCursor=()=>{
  if(pasteMode){commitPaste();return;}
  if(activeArea==='palette'){
   const code=pageSlots(page)[paletteCursor],valid=page<10?(code>0&&code<253):page===11?(code===1||code===6):(code<=18);
   if(valid)selectPaletteCode(code,page>=10);activeArea='grid';updateArea();return;
  }
  if(core.selection){if(core.buildClosedCircuit(brush))changed('Closed circuit created');else{status.textContent='This brush cannot create a closed circuit.';status.style.color='#ffbd7a';}return;}
  if(page===11){status.textContent='Bliss F12 terrain brushes are mouse-only.';status.style.color='#ffbd7a';return;}
  if(page===10){if(core.paintTerrain(cellX,cellY,terrainBrush))changed('Terrain placed');}
  else if(core.place(cellX,cellY,brush,allowConflicts)){lastPlaced={x:cellX,y:cellY};changed('Element placed');}
 };
 const smartSelect=(key:string,direction:1|-1)=>{
  const next=smartSelectBliss(core.track,brush,key,direction,lastPlaced,core.definitions);if(next!==brush){brush=next;renderPalette();renderMap();renderStatus();}
 };
 const changeMaterial=()=>{if(page>2)return;const next=changeBlissMaterial(brush);if(next!==brush){brush=next;renderPalette();renderMap();renderStatus();}};
 const findByName=async()=>{
  if(page===11){terrainBrush=terrainBrush===0||terrainBrush>5?1:6;renderPalette();renderStatus();return;}
  const query=await centeredPrompt('Find element','Enter part of a Bliss element name:','');if(query===null)return;
  const next=findBlissElementByName(query,brush);if(next!==brush){brush=next;renderPalette();renderStatus();}else{status.textContent='No matching element found.';status.style.color='#ffbd7a';}
 };
 const startManualHex=()=>{
  if(!allowConflicts){status.textContent='Manual editing (MAN / Ctrl+E) must be enabled first.';status.style.color='#ffbd7a';return;}
  manualHex='';manualHexDeadline=performance.now()+3000;renderPalette();
  status.textContent='?  Enter two hexadecimal digits (00–FF). Backspace/Delete restarts; timeout is 3 seconds.';status.style.color='#ffe77a';
 };
 const finishManualHex=(value:number)=>{
  manualHexDeadline=0;manualHex='';
  if(page>=10)terrainBrush=value;else brush=value;
  renderPalette();renderStatus();
 };
 const moveCursor=(dx:number,dy:number,extend:boolean)=>{
  const old={x:cellX,y:cellY};cellX=Math.max(0,Math.min(29,cellX+dx));cellY=Math.max(0,Math.min(29,cellY+dy));
  if(extend){if(!selectionAnchor)selectionAnchor=old;setSelectionFrom(selectionAnchor,{x:cellX,y:cellY});}
  else selectionAnchor=null;
  renderMap();renderStatus();
 };
 const movePalette=(dx:number,dy:number)=>{
  const blocks=paletteBlocks(page);if(!blocks.length)return;
  const current=blockForCursor(page,paletteCursor)??blocks[0];
  let row=dy>0?current.row+current.height-1:current.row,column=dx>0?current.column+current.width-1:current.column;
  for(let step=0;step<6;step++){
   row+=dy;column+=dx;if(row<0||row>5||column<0||column>5)break;
   const slot=row*6+column,block=blockForCursor(page,slot);
   if(block){paletteCursor=block.row*6+block.column;renderPalette();renderStatus();return;}
  }
 };

 const executeBoundAction=(action:EditorBindingAction,shiftHeld=false)=>{
  if(action.smartKey){smartSelect(action.smartKey,shiftHeld?-1:1);return true;}
  switch(action.id){
   case 'exit': if(pasteMode){pasteMode=false;renderMap();renderStatus();}else void finish();return true;
   case 'palette1': if(page===0)showHelp(0);else choosePage(0);return true;
   case 'palette2':case 'palette3':case 'palette4':case 'palette5':case 'palette6':case 'palette7':case 'palette8':case 'palette9':case 'palette10':case 'palette11':case 'palette12':
    choosePage(Number(action.id.slice(7))-1);return true;
   case 'moveUp': if(activeArea==='palette')movePalette(0,-1);else moveCursor(0,-1,shiftHeld);return true;
   case 'moveDown': if(activeArea==='palette')movePalette(0,1);else moveCursor(0,1,shiftHeld);return true;
   case 'moveLeft': if(activeArea==='palette')movePalette(-1,0);else moveCursor(-1,0,shiftHeld);return true;
   case 'moveRight': if(activeArea==='palette')movePalette(1,0);else moveCursor(1,0,shiftHeld);return true;
   case 'toggleView': void setViewMode(viewMode==='2d'?'3d':'2d');return true;
   case 'toggleDebug': debugMode=!debugMode;renderMap();renderStatus();return true;
   case 'toggleManual': allowConflicts=!allowConflicts;renderStatus();return true;
   case 'toggleWarnings': showConflicts=!showConflicts;renderMap();renderStatus();return true;
   case 'toggleGrid': showGrid=!showGrid;renderMap();renderStatus();return true;
   case 'redraw': renderMap();renderStatus();return true;
   case 'save': void saveTrack();return true;
   case 'trackShot': void takeTrackShot();return true;
   case 'toggleTerrain': affectTerrain=!affectTerrain;renderMap();renderStatus();return true;
   case 'toggleTrack': affectTrack=!affectTrack;renderMap();renderStatus();return true;
   case 'toggleColour': toggleColouringMode();return true;
   case 'selectAll': wholeSelection();return true;
   case 'copy': copySelection();return true;
   case 'cut': cutSelection();return true;
   case 'paste': startPaste();return true;
   case 'flipHorizontal': flip(false);return true;
   case 'flipVertical': flip(true);return true;
   case 'rotateClockwise': rotate(false);return true;
   case 'rotateCounter': rotate(true);return true;
   case 'undo': if(core.undo())changed('Undo');return true;
   case 'redo': if(core.redo())changed('Redo');return true;
   case 'link': {const linked=core.link(cellX,cellY);if(linked!==null){brush=linked;changed('Tiles linked');}else{status.textContent='No compatible tile link at cursor.';status.style.color='#ffbd7a';}return true;}
   case 'check': checkTrack();return true;
   case 'switchArea': activeArea=activeArea==='grid'?'palette':'grid';selectionAnchor=null;updateArea();return true;
   case 'insert': insertAtCursor();return true;
   case 'delete': deleteAtCursor();return true;
   case 'pick':case 'mousePick': if(colouringMode&&action.id==='mousePick')showColourDialog();else pickAtCursor();return true;
   case 'manualHex': startManualHex();return true;
   case 'find': void findByName();return true;
   case 'material': changeMaterial();return true;
   case 'fillerSide': brush=255;renderPalette();renderMap();renderStatus();return true;
   case 'fillerBottom': brush=254;renderPalette();renderMap();renderStatus();return true;
   case 'fillerCorner': brush=253;renderPalette();renderMap();renderStatus();return true;
   case 'zoomIn': setZoom(zoom+.25);return true;
   case 'zoomOut': setZoom(zoom-.25);return true;
   case 'scrollUp': mapWrap.scrollBy({top:-90,behavior:'auto'});return true;
   case 'scrollDown': mapWrap.scrollBy({top:90,behavior:'auto'});return true;
  }
  return false;
 };

 const keyDown=(event:KeyboardEvent)=>{
  if(event.defaultPrevented)return;
  const code=event.code,key=event.key;
  if(rebindingAction){
   event.preventDefault();event.stopImmediatePropagation();
   if(code==='Escape'){rebindingAction=null;renderShortcutReference();status.textContent='Shortcut change cancelled.';status.style.color='#aaa';return;}
   if(['ControlLeft','ControlRight','ShiftLeft','ShiftRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(code)){status.textContent='Press a key together with any modifiers you want to use.';return;}
   const target=rebindingAction;rebindingAction=null;assignBinding(target,keyboardBinding(event));return;
  }
  if(modalOpen)return;

  if(manualHexDeadline){
   event.preventDefault();event.stopImmediatePropagation();
   if(performance.now()>manualHexDeadline){manualHexDeadline=0;manualHex='';renderPalette();renderStatus();return;}
   if(code==='Backspace'||code==='Delete'){manualHex='';manualHexDeadline=performance.now()+3000;renderPalette();status.textContent='?  Enter two hexadecimal digits (00–FF).';return;}
   if(/^[0-9a-f]$/i.test(key)){
    manualHex+=key.toUpperCase();manualHexDeadline=performance.now()+3000;renderPalette();
    if(manualHex.length===2){finishManualHex(Number.parseInt(manualHex,16));}
    return;
   }
   manualHexDeadline=0;manualHex='';renderPalette();renderStatus();return;
  }

  const binding=keyboardBinding(event),boundAction=actionForBinding(binding);
  if(boundAction){event.preventDefault();event.stopImmediatePropagation();executeBoundAction(boundAction,event.shiftKey);return;}
  if(event.shiftKey){
   const base=[...modifierPrefix({ctrlKey:event.ctrlKey,shiftKey:false,altKey:event.altKey,metaKey:event.metaKey}),event.code].join('+'),baseAction=actionForBinding(base);
   if(baseAction?.smartKey){event.preventDefault();event.stopImmediatePropagation();executeBoundAction(baseAction,true);return;}
  }
  if(defaultOwnsBinding(binding)){event.preventDefault();event.stopImmediatePropagation();return;}

  if(/^F([1-9]|1[0-2])$/.test(code)){
   event.preventDefault();const n=Number(code.slice(1));
   if(n===1&&!event.shiftKey){if(page===0)showHelp(0);else choosePage(0);return;}
   choosePage(n-1);return;
  }

  if(event.ctrlKey){
   const upper=key.toUpperCase();
   if(upper==='Z'){event.preventDefault();if(core.undo())changed('Undo');return;}
   if(upper==='Y'){event.preventDefault();if(core.redo())changed('Redo');return;}
   if(upper==='C'){event.preventDefault();copySelection();return;}
   if(upper==='X'){event.preventDefault();cutSelection();return;}
   if(upper==='V'){event.preventDefault();startPaste();return;}
   if(upper==='W'){event.preventDefault();wholeSelection();return;}
   if(upper==='E'){event.preventDefault();allowConflicts=!allowConflicts;renderStatus();return;}
   if(upper==='D'){event.preventDefault();showConflicts=!showConflicts;renderMap();renderStatus();return;}
   if(upper==='G'){event.preventDefault();showGrid=!showGrid;renderMap();renderStatus();return;}
   if(upper==='Q'){event.preventDefault();debugMode=!debugMode;renderMap();renderStatus();return;}
   if(upper==='T'){event.preventDefault();affectTerrain=!affectTerrain;renderMap();renderStatus();return;}
   if(upper==='K'){event.preventDefault();affectTrack=!affectTrack;renderMap();renderStatus();return;}
   if(upper==='R'){event.preventDefault();renderMap();renderStatus();return;}
   if(upper==='S'){event.preventDefault();if(event.shiftKey)void takeTrackShot();else void saveTrack();return;}
   if(upper==='H'){event.preventDefault();status.textContent='Track hash: '+blissTrackHash(core.track).toString(16).toUpperCase().padStart(8,'0');status.style.color='#aee18a';return;}
   if(upper==='O'){event.preventDefault();toggleColouringMode();return;}
  }

  if(code==='Escape'){event.preventDefault();if(pasteMode){pasteMode=false;renderMap();renderStatus();return;}void finish();return;}
  if(code==='Tab'){event.preventDefault();activeArea=activeArea==='grid'?'palette':'grid';selectionAnchor=null;updateArea();return;}
  if(code==='ArrowUp'||code==='ArrowDown'||code==='ArrowLeft'||code==='ArrowRight'){
   event.preventDefault();const dx=code==='ArrowLeft'?-1:code==='ArrowRight'?1:0,dy=code==='ArrowUp'?-1:code==='ArrowDown'?1:0;
   if(activeArea==='palette')movePalette(dx,dy);else moveCursor(dx,dy,event.ctrlKey);return;
  }
  if(code==='Enter'){event.preventDefault();insertAtCursor();return;}
  if(code==='Delete'){event.preventDefault();deleteAtCursor();return;}
  if(code==='Space'){event.preventDefault();findByName();return;}
  if(code==='Backslash'){event.preventDefault();startManualHex();return;}
  if(code==='KeyP'){event.preventDefault();pickAtCursor();return;}
  if(code==='KeyU'){event.preventDefault();const linked=core.link(cellX,cellY);if(linked!==null){brush=linked;changed('Tiles linked');}else{status.textContent='No compatible tile link at cursor.';status.style.color='#ffbd7a';}return;}
  if(code==='KeyC'){event.preventDefault();checkTrack();return;}
  if(code==='KeyF'){event.preventDefault();flip(event.shiftKey);return;}
  if(code==='KeyR'){event.preventDefault();rotate(event.shiftKey);return;}
  if(code==='KeyM'){event.preventDefault();changeMaterial();return;}
  if(code==='KeyX'||code==='KeyY'||code==='KeyZ'){
   event.preventDefault();brush=code==='KeyX'?255:code==='KeyY'?254:253;renderPalette();renderStatus();return;
  }

  if(/^Key[A-W]$/.test(code)&&!['KeyC','KeyF','KeyM','KeyP','KeyR','KeyU'].includes(code)){
   const letter=key.length===1?key:code.slice(3);const entity=letter.toUpperCase();
   if(!['A','B','D','E','G','H','I','J','K','L','N','O','Q','S','T','V','W'].includes(entity))return;
   event.preventDefault();smartSelect(entity,event.shiftKey?-1:1);return;
  }
 };
 window.addEventListener('keydown',keyDown,true);

 function transformBrush(operation:BlissTransformOperation,label:string){
  const terrain=page>=10,before=terrain?terrainBrush:brush,next=terrain?transformBlissTerrainCode(before,operation):transformBlissTrackCode(before,operation);
  if(terrain)terrainBrush=next;else brush=next;renderPalette();renderMap();renderStatus();
  if(next===before){status.textContent=label+': this piece is symmetrical, so its orientation does not change.';status.style.color='#aaa';}
  else{status.textContent=label+' → '+next+' · '+(terrain?('Terrain '+next):(blissElementData[next]?.id||('Element '+next)));status.style.color='#aee18a';}
 }

 function toggleColouringMode(){
  colouringMode=!colouringMode;pasteMode=false;selectionTool=false;selecting=false;selectionAnchor=null;core.setSelection(null);activeArea='grid';
  renderMap();renderStatus();
  status.textContent=colouringMode?'Colouring mode · left paint · right erase · middle click or colour buttons to choose colours':'Track editing mode';
  status.style.color=colouringMode?'#aee18a':'#c8c8c8';
 }
 function showColourDialog(){
  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(500px,90vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:20px 22px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.4 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Colouring';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 15px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const form=document.createElement('div');form.style.cssText='display:grid;grid-template-columns:110px minmax(150px,1fr) auto auto;gap:10px;align-items:center;';
  const makeRow=(label:string,value:number,sameLabel:string)=>{
   const text=document.createElement('strong');text.textContent=label;
   const input=document.createElement('input');input.type='color';input.value=value===BLISS_TRANSPARENT_COLOUR?'#ffffff':colour565ToHex(value);input.style.cssText='width:100%;height:36px;background:#111;border:1px solid #555;';
   const clear=document.createElement('label');clear.style.cssText='display:flex;gap:5px;align-items:center;color:#bbb;white-space:nowrap;';const check=document.createElement('input');check.type='checkbox';check.checked=value===BLISS_TRANSPARENT_COLOUR;clear.append(check,document.createTextNode('Clear'));
   const same=button('Same as '+sameLabel,()=>{});
   same.style.cssText+='padding:6px 8px;font-size:10px;white-space:nowrap;';
   check.addEventListener('change',()=>{input.disabled=check.checked;});input.disabled=check.checked;form.append(text,input,clear,same);return {input,check,same};
  };
  const border=makeRow('Border',borderColour,'Background'),background=makeRow('Background',backgroundColour,'Border');
  border.same.onclick=()=>{border.input.value=background.input.value;border.check.checked=background.check.checked;border.input.disabled=border.check.checked;};
  background.same.onclick=()=>{background.input.value=border.input.value;background.check.checked=border.check.checked;background.input.disabled=background.check.checked;};
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px;';
  const close=()=>{modalOpen=false;shade.remove();overlay.focus();};
  const set=button('Set colours',()=>{borderColour=border.check.checked?BLISS_TRANSPARENT_COLOUR:hexToColour565(border.input.value);backgroundColour=background.check.checked?BLISS_TRANSPARENT_COLOUR:hexToColour565(background.input.value);close();renderColourControls();renderStatus();});
  const clear=button('Clear',()=>{borderColour=BLISS_TRANSPARENT_COLOUR;backgroundColour=BLISS_TRANSPARENT_COLOUR;close();renderColourControls();renderStatus();});
  const uncolour=button('Uncolour map',()=>{
   const current=core.metadata();if(current?.metadata.colours){const metadata={...current.metadata};metadata.colours=undefined;core.setMetadata(metadata,current.format);changed('Map colouration cleared');}
   close();
  });
  const cancel=button('Cancel',close);set.style.cssText+='background:#4e5b2b;border-color:#a9bd58;';actions.append(set,clear,uncolour,cancel);box.append(heading,form,actions);shade.append(box);document.body.append(shade);
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});requestAnimationFrame(()=>shade.focus());
 }

 function showEditorSettings(){
  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(560px,92vw);max-height:86vh;overflow:auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:20px 22px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.4 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Editor Settings';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 15px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const form=document.createElement('div');form.style.cssText='display:grid;grid-template-columns:minmax(160px,1fr) minmax(180px,1fr);gap:12px 16px;align-items:center;';
  const addLabel=(text:string)=>{const label=document.createElement('strong');label.textContent=text;label.style.color='#c8c8dc';form.append(label);return label;};

  addLabel('Track-shot format');
  const format=document.createElement('select');format.style.cssText='padding:7px 8px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:3px;';
  for(const [value,label] of [['png','PNG'],['jpeg','JPEG'],['bmp','BMP']] as const){const option=document.createElement('option');option.value=value;option.textContent=label;option.selected=editorSettings.trackShotFormat===value;format.append(option);}form.append(format);

  addLabel('JPEG quality');
  const qualityWrap=document.createElement('div');qualityWrap.style.cssText='display:flex;align-items:center;gap:8px;';
  const quality=document.createElement('input');quality.type='range';quality.min='50';quality.max='100';quality.step='1';quality.value=String(Math.round(editorSettings.jpegQuality*100));quality.style.flex='1';
  const qualityValue=document.createElement('span');qualityValue.textContent=quality.value+'%';qualityValue.style.cssText='min-width:40px;color:#d8d66d;text-align:right;';quality.addEventListener('input',()=>qualityValue.textContent=quality.value+'%');qualityWrap.append(quality,qualityValue);form.append(qualityWrap);

  const addCheckbox=(labelText:string,checked:boolean)=>{
   addLabel(labelText);const wrap=document.createElement('label');wrap.style.cssText='display:flex;align-items:center;gap:8px;color:#ddd;';const input=document.createElement('input');input.type='checkbox';input.checked=checked;wrap.append(input,document.createTextNode('Enabled'));form.append(wrap);return input;
  };
  const grid=addCheckbox('Grid in track shots',editorSettings.trackShotGrid);
  const annotations=addCheckbox('Annotations in track shots',editorSettings.trackShotAnnotations);
  const carMarkers=addCheckbox('Player/Opponent markers in track shots',editorSettings.trackShotCarMarkers);
  const shortcuts=addCheckbox('Shortcut reference on startup',showShortcutReference);

  const note=document.createElement('p');note.textContent='Track shots are saved to the “Track Shots” folder next to PlayStunts DX.exe.';note.style.cssText='grid-column:1/-1;color:#999;margin:4px 0 0;font-size:11px;';
  form.append(note);

  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:18px;';
  const close=()=>{modalOpen=false;shade.remove();overlay.focus();};
  const saveSettings=button('Save',()=>{
   editorSettings={trackShotFormat:format.value as TrackShotFormat,jpegQuality:Number(quality.value)/100,trackShotGrid:grid.checked,trackShotAnnotations:annotations.checked,trackShotCarMarkers:carMarkers.checked,sceneryPercentMode:editorSettings.sceneryPercentMode};
   showShortcutReference=shortcuts.checked;persistEditorSettings();try{localStorage.setItem(shortcutHelpStorageKey,showShortcutReference?'1':'0');}catch{}
   renderShortcutReference();close();status.textContent='Editor settings saved.';status.style.color='#aee18a';
  });
  const cancel=button('Cancel',close);saveSettings.style.cssText+='min-width:105px;background:#4e5b2b;border-color:#a9bd58;';cancel.style.minWidth='105px';actions.append(saveSettings,cancel);
  box.append(heading,form,actions);shade.append(box);document.body.append(shade);
  const syncQuality=()=>{const jpeg=format.value==='jpeg';quality.disabled=!jpeg;qualityValue.style.opacity=jpeg?'1':'.45';quality.style.opacity=jpeg?'1':'.45';};format.addEventListener('change',syncQuality);syncQuality();
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});requestAnimationFrame(()=>format.focus());
 }

 function showTextModal(titleText:string,rows:readonly string[]){
  const shade=document.createElement('div');shade.style.cssText='position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:30px;';
  const box=document.createElement('div');box.style.cssText='width:min(640px,90vw);max-height:85vh;overflow:auto;background:#1e1e34;border:2px solid #80809a;color:#ddd;padding:18px 22px;box-shadow:0 18px 60px #000;font:14px/1.45 ui-monospace,Consolas,monospace;';
  const heading=document.createElement('h2');heading.textContent=titleText;heading.style.cssText='text-align:center;font-size:16px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const body=document.createElement('div');for(const row of rows){const line=document.createElement('div');line.textContent=row;line.style.margin='3px 0';body.append(line);}
  const close=button('Back',()=>shade.remove());close.style.marginTop='14px';box.append(heading,body,close);shade.append(box);document.body.append(shade);
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)shade.remove();});
 }

 function centeredConfirm(titleText:string,messageText:string,okLabel='OK',cancelLabel='Cancel'):Promise<boolean>{
  modalOpen=true;
  return new Promise(resolve=>{
   const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
   const box=document.createElement('div');box.style.cssText='width:min(520px,90vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:22px 24px;box-shadow:0 22px 70px #000;text-align:center;border-radius:6px;font:14px/1.45 system-ui,Segoe UI,sans-serif;';
   const heading=document.createElement('h2');heading.textContent=titleText;heading.style.cssText='font-size:18px;margin:0 0 10px;color:#fff;';
   const message=document.createElement('p');message.textContent=messageText;message.style.cssText='margin:0 0 18px;color:#ccc;';
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;';
   const complete=(answer:boolean)=>{modalOpen=false;shade.remove();resolve(answer);};
   const ok=button(okLabel,()=>complete(true)),cancel=button(cancelLabel,()=>complete(false));ok.style.cssText+='min-width:105px;background:#4e5b2b;border-color:#a9bd58;';cancel.style.cssText+='min-width:105px;';
   actions.append(ok,cancel);box.append(heading,message,actions);shade.append(box);document.body.append(shade);
   shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();complete(false);}});
   shade.addEventListener('pointerdown',event=>{if(event.target===shade)complete(false);});
   requestAnimationFrame(()=>ok.focus());
  });
 }

 function centeredPrompt(titleText:string,messageText:string,initial=''):Promise<string|null>{
  modalOpen=true;
  return new Promise(resolve=>{
   const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
   const box=document.createElement('div');box.style.cssText='width:min(520px,90vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:22px 24px;box-shadow:0 22px 70px #000;border-radius:6px;font:14px/1.45 system-ui,Segoe UI,sans-serif;';
   const heading=document.createElement('h2');heading.textContent=titleText;heading.style.cssText='text-align:center;font-size:18px;margin:0 0 8px;color:#fff;';
   const message=document.createElement('p');message.textContent=messageText;message.style.cssText='text-align:center;margin:0 0 12px;color:#ccc;';
   const input=document.createElement('input');input.value=initial;input.style.cssText='box-sizing:border-box;width:100%;padding:9px 10px;margin-bottom:14px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:4px;font:14px ui-monospace,Consolas,monospace;';
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;';
   const complete=(answer:string|null)=>{modalOpen=false;shade.remove();resolve(answer);};
   const ok=button('OK',()=>complete(input.value)),cancel=button('Cancel',()=>complete(null));ok.style.cssText+='min-width:105px;background:#4e5b2b;border-color:#a9bd58;';cancel.style.cssText+='min-width:105px;';
   actions.append(ok,cancel);box.append(heading,message,input,actions);shade.append(box);document.body.append(shade);
   input.addEventListener('keydown',event=>{if(event.code==='Enter'){event.preventDefault();complete(input.value);}else if(event.code==='Escape'){event.preventDefault();complete(null);}});
   shade.addEventListener('pointerdown',event=>{if(event.target===shade)complete(null);});
   requestAnimationFrame(()=>{input.focus();input.select();});
  });
 }

 function centeredNotice(titleText:string,messageText:string):Promise<void>{
  modalOpen=true;
  return new Promise(resolve=>{
   const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
   const box=document.createElement('div');box.style.cssText='width:min(520px,90vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:22px 24px;box-shadow:0 22px 70px #000;text-align:center;border-radius:6px;font:14px/1.45 system-ui,Segoe UI,sans-serif;';
   const heading=document.createElement('h2');heading.textContent=titleText;heading.style.cssText='font-size:18px;margin:0 0 10px;color:#fff;';
   const message=document.createElement('p');message.textContent=messageText;message.style.cssText='margin:0 0 18px;color:#ccc;';
   const complete=()=>{modalOpen=false;shade.remove();resolve();},ok=button('OK',complete);ok.style.cssText+='min-width:105px;background:#4e5b2b;border-color:#a9bd58;';
   box.append(heading,message,ok);shade.append(box);document.body.append(shade);shade.addEventListener('keydown',event=>{if(event.code==='Escape'||event.code==='Enter'){event.preventDefault();complete();}});requestAnimationFrame(()=>ok.focus());
  });
 }

 function selectTerrainPreset(presets:readonly BlissTerrainPreset[]):Promise<BlissTerrainPreset|null>{
  modalOpen=true;
  return new Promise(resolve=>{
   let selected=0;
   const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
   const box=document.createElement('div');box.style.cssText='width:min(760px,92vw);height:min(610px,88vh);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:16px 18px;box-shadow:0 22px 70px #000;border-radius:6px;font:14px/1.35 ui-monospace,Consolas,monospace;';
   const heading=document.createElement('h2');heading.textContent='Select Terrain';heading.style.cssText='text-align:center;font-size:17px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
   const body=document.createElement('div');body.style.cssText='display:grid;grid-template-columns:190px minmax(0,1fr);gap:24px;min-height:0;align-items:start;';
   const previewWrap=document.createElement('div');previewWrap.style.cssText='display:grid;gap:8px;justify-items:center;padding-top:8px;';
   const preview=document.createElement('canvas');preview.width=480;preview.height=480;preview.style.cssText='width:170px;height:170px;image-rendering:pixelated;border:2px solid #aaa;background:#070707;';
   const previewName=document.createElement('strong');previewName.style.cssText='text-align:center;color:#dcdcf0;font-size:12px;';
   previewWrap.append(preview,previewName);
   const list=document.createElement('div');list.style.cssText='display:grid;align-content:start;overflow:auto;max-height:455px;padding:2px 6px 2px 0;';
   const controls:HTMLButtonElement[]=[];
   const redraw=()=>{
    controls.forEach((control,index)=>{control.style.background=index===selected?'#9a98dd':'transparent';control.style.color=index===selected?'#111':'#c8c8f0';});
    const preset=presets[selected],track=createBlissTrack(core.track.landscape,preset.format);for(let i=0;i<900;i++)track.terrain[i]=preset.terrain[i]??0;
    preview.getContext('2d',{alpha:false})!.putImageData(blissOriginalMapImageData(track,host.resources,host.palette,true),0,0);previewName.textContent=preset.name;
   };
   presets.forEach((preset,index)=>{
    const control=button(preset.name,()=>{selected=index;redraw();});control.style.cssText='border:0;border-radius:0;background:transparent;color:#c8c8f0;text-align:left;padding:2px 8px;font:14px/1.15 ui-monospace,Consolas,monospace;cursor:pointer;';
    control.addEventListener('dblclick',()=>complete(preset));controls.push(control);list.append(control);
   });
   body.append(previewWrap,list);
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;padding-top:14px;';
   const complete=(preset:BlissTerrainPreset|null)=>{modalOpen=false;shade.remove();resolve(preset);};
   const create=button('Create Track',()=>complete(presets[selected])),cancel=button('Cancel',()=>complete(null));create.style.cssText+='min-width:130px;background:#4e5b2b;border-color:#a9bd58;';cancel.style.cssText+='min-width:105px;';
   actions.append(create,cancel);box.append(heading,body,actions);shade.append(box);document.body.append(shade);
   shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();complete(null);}else if(event.code==='Enter'){event.preventDefault();complete(presets[selected]);}else if(event.code==='ArrowDown'){event.preventDefault();selected=Math.min(presets.length-1,selected+1);redraw();controls[selected]?.scrollIntoView({block:'nearest'});}else if(event.code==='ArrowUp'){event.preventDefault();selected=Math.max(0,selected-1);redraw();controls[selected]?.scrollIntoView({block:'nearest'});}});
   shade.addEventListener('pointerdown',event=>{if(event.target===shade)complete(null);});
   redraw();requestAnimationFrame(()=>shade.focus());
  });
 }

 function confirmExitChoice():Promise<'save'|'discard'|'cancel'>{
  modalOpen=true;
  return new Promise(resolve=>{
   const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
   const box=document.createElement('div');box.style.cssText='width:min(520px,90vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:22px 24px;box-shadow:0 22px 70px #000;text-align:center;border-radius:6px;font:14px/1.45 system-ui,Segoe UI,sans-serif;';
   const heading=document.createElement('h2');heading.textContent='Unsaved track';heading.style.cssText='font-size:18px;margin:0 0 10px;color:#fff;';
   const message=document.createElement('p');message.textContent='Save changes to '+(host.track.name||'UNTITLED')+'.TRK before leaving the Bliss editor?';message.style.cssText='margin:0 0 18px;color:#ccc;';
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;';
   const complete=(choice:'save'|'discard'|'cancel')=>{modalOpen=false;shade.remove();resolve(choice);};
   const saveChoice=button('Save',()=>complete('save')),discard=button("Don't Save",()=>complete('discard')),cancel=button('Cancel',()=>complete('cancel'));
   saveChoice.style.cssText+='min-width:105px;background:#4e5b2b;border-color:#a9bd58;';
   discard.style.cssText+='min-width:105px;';
   cancel.style.cssText+='min-width:105px;';
   actions.append(saveChoice,discard,cancel);box.append(heading,message,actions);shade.append(box);document.body.append(shade);
   shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();complete('cancel');}});
   shade.addEventListener('pointerdown',event=>{if(event.target===shade)complete('cancel');});
   requestAnimationFrame(()=>saveChoice.focus());
  });
 }

 async function loadTrack(){
  if(!host.enumerateTracks||!host.readTrack){status.textContent='Track loading is unavailable in this build.';status.style.color='#ffbd7a';return;}
  if(core.modified&&!await centeredConfirm('Load Track','Discard the current unsaved changes and load another track?','Discard and Load','Cancel'))return;
  let filenames:string[];
  try{filenames=(await host.enumerateTracks()).filter(value=>/\.trk$/i.test(value)).sort((a,b)=>a.localeCompare(b));}
  catch(error){status.textContent='Could not list tracks: '+String(error);status.style.color='#ff9b9b';return;}
  if(!filenames.length){status.textContent='No tracks found.';status.style.color='#ffbd7a';return;}
  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(560px,90vw);max-height:82vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #9090ad;padding:18px 20px;box-shadow:0 22px 70px #000;border-radius:6px;';
  const heading=document.createElement('h2');heading.textContent='Load Track';heading.style.cssText='text-align:center;font:17px ui-monospace,Consolas,monospace;margin:0 0 12px;color:#eee;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const list=document.createElement('div');list.style.cssText='display:grid;gap:4px;overflow:auto;min-height:120px;max-height:60vh;';
  const closeModal=()=>{modalOpen=false;shade.remove();};
  const close=button('Cancel',closeModal);
  const choose=async(filename:string)=>{
   const stem=filename.replace(/\.trk$/i,'');
   try{
    let bytes:Uint8Array;
    const physical=host.customTrackExists&&host.readCustomTrack&&await host.customTrackExists(stem);
    bytes=physical?await host.readCustomTrack!(stem):await host.readTrack!('',stem);
    if(bytes.length<1802||bytes.length>13802)throw Error('Track must contain 1802 to 13802 bytes');
    core.loadBytes(bytes);host.track.name=stem;host.track.path='';host.track.raw=Array.from(bytes.subarray(0,1802));name.textContent=stem+'.TRK';
    metadataEditingBase=Math.max(0,core.metadata()?.metadata.editingTime??0);editingSessionStarted=performance.now();
    cellX=0;cellY=0;lastPlaced=null;core.setSelection(null);closeModal();renderPalette();renderScenery();renderMap();renderStatus();status.textContent='Loaded '+stem+'.TRK';status.style.color='#aee18a';
   }catch(error){status.textContent='Could not load '+filename+': '+String(error);status.style.color='#ff9b9b';}
  };
  for(const filename of filenames){const entry=button(filename,()=>void choose(filename));entry.style.textAlign='left';entry.style.fontFamily='ui-monospace,Consolas,monospace';list.append(entry);}
  box.append(heading,list,close);shade.append(box);document.body.append(shade);
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)closeModal();});
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();closeModal();}});
  requestAnimationFrame(()=>shade.focus());
 }

 type TournamentSite={name:string;url:string};
 const tournamentStorageKey='playstuntsdx.bliss.tournaments.v1';
 const defaultTournamentSites:readonly TournamentSite[]=[
  {name:'ZakStunts',url:'https://zak.stunts.hu/'},
  {name:'Race For Kicks',url:'https://www.raceforkicks.com/'},
 ];
 const loadTournamentSites=():TournamentSite[]=>{
  try{
   const stored=localStorage.getItem(tournamentStorageKey);
   if(stored===null)return defaultTournamentSites.map(site=>({...site}));
   const value=JSON.parse(stored);
   if(!Array.isArray(value))return defaultTournamentSites.map(site=>({...site}));
   return value.filter(row=>row&&typeof row.name==='string'&&typeof row.url==='string'&&!(/^Custom Car Championship$/i.test(row.name)&&/ccc\.mystunts\.net/i.test(row.url))).map(row=>({name:row.name,url:row.url}));
  }catch{return defaultTournamentSites.map(site=>({...site}));}
 };
 const saveTournamentSites=(sites:readonly TournamentSite[])=>{try{localStorage.setItem(tournamentStorageKey,JSON.stringify(sites));}catch{}};

 async function showTournamentScoreboard(site:TournamentSite,race:BlissTournamentRace){
  if(!host.fetchUrl){await centeredNotice('Tournament','Network access is unavailable in this build.');return;}
  if(!race.scoreboard){await centeredNotice('Scoreboard','This tournament does not publish a scoreboard.');return;}
  let bytes:Uint8Array;
  try{bytes=await host.fetchUrl(blissTournamentUrl(site.url,race.scoreboard));}
  catch(error){await centeredNotice('Scoreboard','Could not load the scoreboard: '+String(error));return;}
  if(!bytes.length){await centeredNotice('Scoreboard','There is no scoreboard for this race yet.');return;}
  const entries=isZakStuntsTournament(site.url)?parseZakStuntsScoreboard(bytes):parseBlissScoreboard(bytes);
  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(820px,94vw);max-height:86vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:18px 20px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.35 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent=(race.tournament||site.name)+' — Scoreboard';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const list=document.createElement('div');list.style.cssText='overflow:auto;display:grid;gap:4px;';
  if(!entries.length){const empty=document.createElement('p');empty.textContent='No competing entries.';empty.style.color='#aaa';list.append(empty);}
  entries.forEach((entry,index)=>{
   const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:44px minmax(120px,1fr) 110px 100px 90px 70px;gap:7px;align-items:center;padding:7px 8px;background:#111126;border:1px solid #3d3d55;';
   const rank=document.createElement('strong');rank.textContent=entry.number||String(index+1);
   const racer=document.createElement('span');racer.textContent=entry.name||'—';
   const time=document.createElement('span');time.textContent=entry.lapTime||(entry.lapLength?entry.lapLength+' bytes':'—');
   const car=document.createElement('span');car.textContent=entry.car||entry.carId||'—';
   const style=document.createElement('span');style.textContent=entry.style||entry.handicap||'';
   const verified=document.createElement('span');verified.textContent=entry.verified?'✓ verified':'';
   row.append(rank,racer,time,car,style,verified);list.append(row);
  });
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;margin-top:14px;';
  const close=()=>{modalOpen=false;shade.remove();},back=button('Back',close);back.style.minWidth='105px';actions.append(back);
  box.append(heading,list,actions);shade.append(box);document.body.append(shade);
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});requestAnimationFrame(()=>back.focus());
 }

 async function loadTournamentTrack(site:TournamentSite,race:BlissTournamentRace){
  if(!host.fetchUrl){await centeredNotice('Tournament','Network access is unavailable in this build.');return false;}
  if(!race.trackFile){await centeredNotice('Tournament','This race does not specify a track file.');return false;}
  let bytes:Uint8Array;
  try{bytes=await host.fetchUrl(blissTournamentUrl(site.url,race.trackFile));}
  catch(error){await centeredNotice('Tournament','Could not download the current track: '+String(error));return false;}
  if(bytes.length<1802||bytes.length>13802){await centeredNotice('Tournament','The downloaded track is not a valid Bliss/Stunts track file.');return false;}
  core.loadBytes(bytes);
  if(!core.metadata()&&(race.trackTitle||race.trackAuthor||race.tournament)){
   const now=new Date();
   core.setMetadata({
    title:race.trackTitle,author:race.trackAuthor||'Anonymous',comment:'',championship:race.tournament||site.name,
    year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate(),tool:'PlayStunts DX',toolVersion:100,editingTime:0,
   });
  }
  const file=race.trackFile.split(/[\\/]/).pop()??'TOURTRK.TRK',stem=file.replace(/\.trk$/i,'').replace(/[^A-Za-z0-9_-]/g,'_').toUpperCase().slice(0,8)||'TOURTRK';
  host.track.name=stem;host.track.path='';host.track.raw=Array.from(bytes.subarray(0,1802));name.textContent=stem+'.TRK';
  metadataEditingBase=Math.max(0,core.metadata()?.metadata.editingTime??0);editingSessionStarted=performance.now();
  cellX=0;cellY=0;lastPlaced=null;core.setSelection(null);renderPalette();renderScenery();renderMap();renderStatus();
  status.textContent='Tournament track loaded · use Save to store it in Custom Tracks';status.style.color='#aee18a';return true;
 }

 async function showTournamentRace(site:TournamentSite,race:BlissTournamentRace){
  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(610px,92vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:20px 22px;box-shadow:0 22px 70px #000;border-radius:6px;font:14px/1.4 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent=race.tournament||site.name;heading.style.cssText='text-align:center;font-size:18px;margin:0 0 14px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const info=document.createElement('div');info.style.cssText='display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px 12px;';
  for(const [label,value] of [['Track',race.trackTitle||race.trackFile||'—'],['Author',race.trackAuthor||'—'],['Deadline',race.deadline||'—'],['Site',site.url]]){
   const a=document.createElement('strong'),b=document.createElement('span');a.textContent=label;a.style.color='#c8c8dc';b.textContent=value;b.style.color='#ddd';info.append(a,b);
  }
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:17px;';
  const close=()=>{modalOpen=false;shade.remove();};
  const scoreboard=button('Scoreboard',()=>{close();void showTournamentScoreboard(site,race);});
  const getTrack=button('Get Track',()=>{close();void loadTournamentTrack(site,race);});
  const back=button('Back',close);getTrack.style.cssText+='background:#4e5b2b;border-color:#a9bd58;';
  actions.append(scoreboard,getTrack,back);box.append(heading,info,actions);shade.append(box);document.body.append(shade);
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});requestAnimationFrame(()=>getTrack.focus());
 }

 function showTournaments(){
  modalOpen=true;
  let sites=loadTournamentSites(),selected=sites.length?0:-1;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(780px,94vw);height:min(520px,84vh);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:18px 20px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.35 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Tournaments';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const body=document.createElement('div');body.style.cssText='display:grid;grid-template-columns:minmax(220px,.85fr) minmax(300px,1.15fr);gap:16px;min-height:0;';
  const list=document.createElement('div');list.style.cssText='overflow:auto;display:grid;align-content:start;gap:4px;border:1px solid #444;background:#0c0c17;padding:5px;';
  const editor=document.createElement('div');editor.style.cssText='display:grid;grid-template-rows:auto auto 1fr;gap:7px;align-content:start;';
  const nameLabel=document.createElement('label');nameLabel.textContent='Tournament name';nameLabel.style.color='#c8c8dc';
  const nameInput=document.createElement('input');nameInput.style.cssText='box-sizing:border-box;width:100%;padding:8px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:4px;';
  const urlLabel=document.createElement('label');urlLabel.textContent='Web address';urlLabel.style.color='#c8c8dc;margin-top:5px';
  const urlInput=document.createElement('input');urlInput.placeholder='https://example.org/tournament/';urlInput.style.cssText='box-sizing:border-box;width:100%;padding:8px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:4px;';
  editor.append(nameLabel,nameInput,urlLabel,urlInput);
  const renderList=()=>{
   list.replaceChildren();
   sites.forEach((site,index)=>{const item=button(site.name||site.url,()=>{selected=index;nameInput.value=site.name;urlInput.value=site.url;renderList();});item.style.cssText+='text-align:left;overflow:hidden;text-overflow:ellipsis;';setActive(item,index===selected);list.append(item);});
   if(selected>=0&&sites[selected]){nameInput.value=sites[selected].name;urlInput.value=sites[selected].url;}
  };
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin-top:14px;';
  const close=()=>{modalOpen=false;shade.remove();};
  const add=button('Add New',()=>{selected=-1;nameInput.value='';urlInput.value='';renderList();nameInput.focus();});
  const saveSite=button('Save',()=>{
   const site={name:nameInput.value.trim(),url:urlInput.value.trim()};if(!site.name||!/^https?:\/\//i.test(site.url)){status.textContent='Tournament needs a name and http(s) address.';status.style.color='#ffbd7a';return;}
   if(selected>=0)sites[selected]=site;else{sites.push(site);selected=sites.length-1;}saveTournamentSites(sites);renderList();
  });
  const remove=button('Remove',()=>{if(selected<0)return;sites.splice(selected,1);selected=Math.min(selected,sites.length-1);saveTournamentSites(sites);renderList();if(selected<0){nameInput.value='';urlInput.value='';}});
  const connect=button('Connect',async()=>{
   let site=selected>=0?sites[selected]:null;
   if(!site&&nameInput.value.trim()&&/^https?:\/\//i.test(urlInput.value.trim()))site={name:nameInput.value.trim(),url:urlInput.value.trim()};
   if(!site){status.textContent='Select or enter a tournament first.';status.style.color='#ffbd7a';return;}
   if(!host.fetchUrl){close();await centeredNotice('Tournaments','Network access is unavailable in this build.');return;}
   connect.disabled=true;connect.textContent='Connecting…';
   try{
    let race:BlissTournamentRace;
    if(isZakStuntsTournament(site.url)){
     const homepage=await host.fetchUrl(blissTournamentUrl(site.url,''));
     race=parseZakStuntsCurrentRace(homepage);
    }else{
     const cfg=await host.fetchUrl(blissTournamentUrl(site.url,'tour.cfg'));
     race=parseBlissTournamentConfig(cfg);
     if(!race.tournament&&!race.trackFile)throw Error('tour.cfg does not contain Bliss tournament information');
    }
    close();await showTournamentRace(site,race);
   }catch(error){connect.disabled=false;connect.textContent='Connect';status.textContent='Tournament connection failed: '+String(error);status.style.color='#ff9b9b';}
  });
  const closeButton=button('Close',close);connect.style.cssText+='background:#4e5b2b;border-color:#a9bd58;';
  actions.append(add,saveSite,remove,connect,closeButton);body.append(list,editor);box.append(heading,body,actions);shade.append(box);document.body.append(shade);
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});renderList();requestAnimationFrame(()=>shade.focus());
 }

 function showSceneryGenerator(){
  modalOpen=true;
  const rules=blissSceneryDefaults(core.track.landscape).map(rule=>({...rule}));
  const availability=blissSceneryAvailability(core.track,false);
  const eligibleFor=(rule:BlissSceneryRule)=>rule.placement==='everywhere'?availability.openfield:rule.placement==='on-water'?availability.water:availability.byRoad;
  for(const rule of rules)rule.count=Math.max(0,blissRoundToEven(eligibleFor(rule)*rule.percent/100));

  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(760px,94vw);max-height:90vh;overflow:auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:18px 22px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.35 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Generate Scenery';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 12px;color:#fff;';

  const modeBar=document.createElement('div');modeBar.style.cssText='display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:14px;';
  const percentToggle=document.createElement('input');percentToggle.type='checkbox';percentToggle.checked=editorSettings.sceneryPercentMode;
  const percentLabel=document.createElement('label');percentLabel.style.cssText='display:flex;align-items:center;gap:7px;color:#ddd;cursor:pointer;';
  percentLabel.append(percentToggle,document.createTextNode('Use percentages instead of exact counts'));modeBar.append(percentLabel);

  const table=document.createElement('div');table.style.cssText='display:grid;grid-template-columns:minmax(180px,1fr) minmax(250px,1.5fr) 155px;gap:8px 12px;align-items:center;';
  const headers=['Scenery',editorSettings.sceneryPercentMode?'Percentage':'Count','Placement'].map(text=>{const h=document.createElement('strong');h.textContent=text;h.style.cssText='color:#d8d8ea;border-bottom:1px solid #555;padding-bottom:5px;';table.append(h);return h;});
  const valueInputs:HTMLInputElement[]=[],valueNotes:HTMLSpanElement[]=[],modeInputs:HTMLSelectElement[]=[];

  const syncRuleFromCount=(index:number,value:number)=>{
   const rule=rules[index],max=eligibleFor(rule),count=Math.max(0,Math.min(max,Math.trunc(value)||0));
   rule.count=count;rule.percent=max?Math.max(0,Math.min(100,blissRoundToEven(count*100/max))):0;
  };
  const syncRuleFromPercent=(index:number,value:number)=>{
   const rule=rules[index],max=eligibleFor(rule),percent=Math.max(0,Math.min(100,blissRoundToEven(value)));
   rule.percent=percent;rule.count=Math.max(0,Math.min(max,blissRoundToEven(max*percent/100)));
  };
  const refreshRow=(index:number)=>{
   const rule=rules[index],max=eligibleFor(rule),input=valueInputs[index],note=valueNotes[index],percentMode=percentToggle.checked;
   if(!input||!note)return;
   if(percentMode){
    input.min='0';input.max='100';input.value=String(rule.percent);note.textContent='≈ '+(rule.count??0)+' / '+max;
   }else{
    input.min='0';input.max=String(max);input.value=String(rule.count??0);note.textContent='max '+max;
   }
  };
  const refreshMode=()=>{
   editorSettings.sceneryPercentMode=percentToggle.checked;persistEditorSettings();
   headers[1].textContent=percentToggle.checked?'Percentage':'Count';
   rules.forEach((_,index)=>refreshRow(index));
   note.textContent=percentToggle.checked
    ?'Percentage mode uses the share of eligible cells and converts it to an exact object count. No extra random placements are added.'
    :'Count mode is exact: entering 6 creates 6 objects, provided enough eligible cells exist.';
  };

  rules.forEach((rule,index)=>{
   const label=document.createElement('div');label.style.cssText='display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;align-items:center;';
   const preview=document.createElement('canvas');preview.style.cssText='width:48px;height:48px;image-rendering:pixelated;background:#070707;border:1px solid #363650;';
   const image=blissOriginalPaletteImageData(rule.baseCode,false,host.resources,host.palette);preview.width=image.width;preview.height=image.height;preview.getContext('2d',{alpha:false})!.putImageData(image,0,0);
   const labelText=document.createElement('span');labelText.textContent=rule.name;labelText.style.color='#ddd';label.append(preview,labelText);

   const valueBox=document.createElement('div');valueBox.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;';
   const number=document.createElement('input');number.type='number';number.step='1';number.style.cssText='box-sizing:border-box;width:100%;padding:6px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:3px;text-align:right;';
   const valueNote=document.createElement('span');valueNote.style.cssText='color:#888;font-size:11px;white-space:nowrap;';
   valueInputs.push(number);valueNotes.push(valueNote);
   number.addEventListener('input',()=>{
    if(percentToggle.checked)syncRuleFromPercent(index,Number(number.value)||0);else syncRuleFromCount(index,Number(number.value)||0);
    refreshRow(index);
   });
   valueBox.append(number,valueNote);

   const mode=document.createElement('select');mode.style.cssText='box-sizing:border-box;width:100%;padding:6px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:3px;';
   const isShip=rule.baseCode===0xab;
   const choices:readonly [BlissSceneryPlacement,string][]=isShip?[['on-water','On water'],['everywhere','Everywhere']]:[['everywhere','Everywhere'],['by-road','By the road']];
   for(const [value,text] of choices){const option=document.createElement('option');option.value=value;option.textContent=text;option.selected=value===rule.placement;mode.append(option);}
   mode.addEventListener('change',()=>{
    rules[index].placement=mode.value as BlissSceneryPlacement;
    if(percentToggle.checked)syncRuleFromPercent(index,rules[index].percent);else syncRuleFromCount(index,rules[index].count??0);
    refreshRow(index);
   });
   modeInputs.push(mode);table.append(label,valueBox,mode);
  });

  const modeRow=document.createElement('div');modeRow.style.cssText='display:flex;justify-content:center;gap:18px;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid #555;';
  const preserveLabel=document.createElement('label'),eraseLabel=document.createElement('label'),preserve=document.createElement('input'),erase=document.createElement('input');
  preserve.type=erase.type='radio';preserve.name=erase.name='bliss-scenery-clear-'+Date.now();preserve.checked=true;
  preserveLabel.append(preserve,document.createTextNode(' Use free space'));eraseLabel.append(erase,document.createTextNode(' Remove old scenery'));modeRow.append(preserveLabel,eraseLabel);

  const note=document.createElement('p');note.style.cssText='margin:12px 0 0;color:#999;text-align:center;font-size:11px;';
  percentToggle.addEventListener('change',refreshMode);

  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:14px;';
  const close=()=>{modalOpen=false;shade.remove();};
  const zero=button('Set Everything to Zero',()=>{rules.forEach((rule,index)=>{rule.count=0;rule.percent=0;refreshRow(index);});});
  const generate=()=>{
   // Always pass exact counts to the generator. Percentage mode is only an
   // alternate way of calculating those counts, which keeps results predictable.
   if(percentToggle.checked)rules.forEach((rule,index)=>syncRuleFromPercent(index,rule.percent));
   core.generateScenery({eraseExisting:erase.checked,rules});close();changed('Scenery generated');
  };
  const generateButton=button('Generate',generate),cancel=button('Cancel',close);generateButton.style.cssText+='min-width:110px;background:#4e5b2b;border-color:#a9bd58;';zero.style.minWidth='150px';cancel.style.cssText+='min-width:105px;';
  actions.append(zero,generateButton,cancel);box.append(heading,modeBar,table,modeRow,note,actions);shade.append(box);document.body.append(shade);
  refreshMode();
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});
  requestAnimationFrame(()=>shade.focus());
 }

 function showTrackInformation(){
  modalOpen=true;
  const current=core.metadata(),now=new Date(),elapsed=metadataEditingBase+Math.max(0,Math.floor((performance.now()-editingSessionStarted)/1000));
  const metadata:BlissMetadata=current?{...current.metadata}:{
   title:'',author:'Anonymous',comment:'',championship:'',
   year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate(),
   tool:'PlayStunts DX',toolVersion:100,editingTime:elapsed,
  };
  if(!metadata.year){metadata.year=now.getFullYear();metadata.month=now.getMonth()+1;metadata.day=now.getDate();}
  metadata.editingTime=elapsed;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(610px,92vw);background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:20px 22px;box-shadow:0 22px 70px #000;border-radius:6px;font:14px/1.4 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Track Information';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 14px;color:#fff;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const form=document.createElement('div');form.style.cssText='display:grid;grid-template-columns:130px minmax(0,1fr);gap:9px 12px;align-items:center;';
  const makeField=(labelText:string,value:string,multiline=false)=>{
   const label=document.createElement('label');label.textContent=labelText;label.style.color='#c8c8dc';
   const input=multiline?document.createElement('textarea'):document.createElement('input');
   input.value=value;input.maxLength=64;input.style.cssText='box-sizing:border-box;width:100%;padding:8px 9px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:4px;font:13px ui-monospace,Consolas,monospace;'+(multiline?'min-height:70px;resize:vertical;':'');
   form.append(label,input);return input;
  };
  const titleField=makeField('Title',metadata.title),authorField=makeField('Author',metadata.author),commentField=makeField('Comment',metadata.comment,true),champField=makeField('Championship',metadata.championship);
  const dateLabel=document.createElement('span');dateLabel.textContent='Creation date';dateLabel.style.color='#c8c8dc';
  const dateValue=document.createElement('span');dateValue.textContent=[metadata.year,String(metadata.month).padStart(2,'0'),String(metadata.day).padStart(2,'0')].join('-');dateValue.style.color='#aaa';
  const timeLabel=document.createElement('span');timeLabel.textContent='Editing time';timeLabel.style.color='#c8c8dc';
  const timeValue=document.createElement('span');timeValue.textContent=Math.floor(elapsed/3600)+'h '+Math.floor((elapsed%3600)/60)+'m '+(elapsed%60)+'s';timeValue.style.color='#aaa';
  form.append(dateLabel,dateValue,timeLabel,timeValue);
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:16px;';
  const close=()=>{modalOpen=false;shade.remove();};
  const saveInfo=()=>{
   metadata.title=titleField.value.slice(0,64);metadata.author=authorField.value.slice(0,64);metadata.comment=commentField.value.slice(0,64);metadata.championship=champField.value.slice(0,64);
   metadata.tool='PlayStunts DX';metadata.toolVersion=100;metadata.editingTime=metadataEditingBase+Math.max(0,Math.floor((performance.now()-editingSessionStarted)/1000));
   core.setMetadata(metadata,current?.format??'binary');close();changed('Track information updated');
  };
  const saveButton=button('Save',saveInfo),cancel=button('Cancel',close);saveButton.style.cssText+='min-width:105px;background:#4e5b2b;border-color:#a9bd58;';cancel.style.cssText+='min-width:105px;';
  actions.append(saveButton,cancel);box.append(heading,form,actions);shade.append(box);document.body.append(shade);
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});
  requestAnimationFrame(()=>titleField.focus());
 }

 async function followAnalysisPath(pathIndex:number,analysis:BlissRouteAnalysis){
  const trace=traceBlissPath(core.track,analysis,pathIndex,0,core.definitions);
  if(!trace.steps.length){status.textContent='Path '+(pathIndex+1)+' cannot be followed.';status.style.color='#ffbd7a';return;}

  let goFast=false;
  const speedUp=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();goFast=true;};
  const oldPointerEvents=map.style.pointerEvents;
  modalOpen=true;suppressMapCursor=true;map.style.pointerEvents='none';window.addEventListener('keydown',speedUp,true);
  activeArea='grid';pasteMode=false;core.setSelection(null);

  try{
   for(const step of trace.steps){
    cellX=Math.max(0,Math.min(29,step.x));cellY=Math.max(0,Math.min(29,step.y));
    renderMap();
    context.save();
    context.fillStyle='rgba(100,240,240,.52)';
    context.strokeStyle='rgb(100,240,240)';
    context.lineWidth=2;
    context.fillRect(step.x*16,step.y*16,Math.max(1,step.width)*16,Math.max(1,step.height)*16);
    context.strokeRect(step.x*16+1,step.y*16+1,Math.max(1,step.width)*16-2,Math.max(1,step.height)*16-2);
    context.restore();
    if(!goFast)await new Promise(resolve=>setTimeout(resolve,100));
   }
  }finally{
   window.removeEventListener('keydown',speedUp,true);map.style.pointerEvents=oldPointerEvents;suppressMapCursor=false;modalOpen=false;
  }

  cellX=Math.max(0,Math.min(29,trace.cursor.x));cellY=Math.max(0,Math.min(29,trace.cursor.y));
  renderMap();renderStatus();
  status.textContent='Followed path '+(pathIndex+1)+' · cursor at '+(cellX+1)+','+(cellY+1);
  status.style.color='#aee18a';
 }

 function showTrackAnalysis(){
  let analysis:ReturnType<BlissEditorCore['analyze']>;
  try{analysis=core.analyze();}catch(error){void centeredNotice('Track Analysis','Analysis failed: '+String(error));return;}
  if(!analysis.sections.length){void centeredNotice('Track Analysis','Track has no valid path. A valid start/finish line is required.');return;}
  if(analysis.tooComplex){void centeredNotice('Track Analysis','Track is too complex. Too many splits!');return;}
  if(!analysis.paths.length){void centeredNotice('Track Analysis','Track has no valid path.');return;}

  const summary=summarizeBlissTrackAnalysis(core.track,analysis,core.definitions);
  const knownHandicaps=new Map<string,number>([
   ['ANSX',1.467],['AUDI',1.387],['VETT',1.499],['ZF40',1.242],['FGTO',1.415],['RANG',1.380],
   ['JAGU',1.129],['COUN',1.475],['LM02',1.552],['LANC',1.358],['ZLET',1.518],['CDOR',1.070],
   ['NSKY',1.466],['ZPTR',1.489],['P962',1.085],['PC04',1.508],['PMIN',1.000],['GATE',1.073],
  ]);
  const fallbackCars=[
   ['ANSX','Acura NSX'],['AUDI','Audi Quattro'],['VETT','Chevrolet Corvette ZR1'],['zF40','Ferrari F40'],
   ['FGTO','Ferrari GTO'],['RANG','Ford Ranger'],['JAGU','Jaguar XJR9 IMSA'],['COUN','Lamborghini Countach'],
   ['LM02','Lamborghini LM-002'],['LANC','Lancia Delta Integrale'],['zLET','Lotus Esprit Turbo'],['CDOR','Melange XGT-88'],
   ['NSKY','Nissan Skyline GT-R'],['zPTR','Porsche 911 Turbo'],['P962','Porsche 962 IMSA'],['PC04','Porsche Carrera 4'],
   ['PMIN','Porsche March Indy'],['GATE','Speedgate XSD'],
  ] as const;
  const installed=host.analysisCars?.length?host.analysisCars:fallbackCars.map(([id,name])=>({id,name}));
  const cars=installed.map(car=>({id:car.id,name:car.name,handicap:knownHandicaps.get(car.id.toUpperCase())??null}));
  if(analysisCarIndex<0||analysisCarIndex>=cars.length){
   const pmin=cars.findIndex(car=>car.id.toUpperCase()==='PMIN');analysisCarIndex=pmin>=0?pmin:0;
  }
  const rh=[['Duplode',6.8815],['Marco',6.8863],['FinRok',7.0758],['Zak McKracken',7.6161],['Cas',7.6255],['Nach',7.6588],['AbuRaf70',7.9953],['Shoegazing Leo',9.2796]] as const;
  const noRh=[['Marco',7.4313],['Duplode',7.6066],['Cas',8.3744]] as const;
  // Bliss stores car handicaps (and the famous-racer ratios below) as
  // FreeBASIC Single values. Preserve that float32 rounding before the final
  // Double multiplication, otherwise some estimates differ by 0.01s.
  const handicap=()=>cars[analysisCarIndex]?.handicap;
  const timeFor=(tokens:number,weight=7.2955,singleWeight=false)=>{
   const value=handicap();if(value===null||value===undefined)return '—';
   return blissTimey(blissEstimatedTimeCentiseconds(tokens,Math.fround(value),singleWeight?Math.fround(weight):weight));
  };

  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(820px,95vw);max-height:90vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:18px 20px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.4 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Track Analysis';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const body=document.createElement('div');body.style.cssText='overflow:auto;min-height:280px;';
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:14px;';
  let page:0|1|2=0,currentPath=0;

  const prognosisText=()=>{
   switch(summary.prognosis){
    case 'terrain-crash':return 'Stunts will crash because of terrain errors';
    case 'terrain-fatal':return 'Track will not run, due to terrain errors';
    case 'flow-fatal':return 'Track will fail because of path flow error';
    case 'terrain-warning':return 'Track will run, but terrain problems may occur';
    case 'non-stunts':return 'Stunts will run the track. Using the internal editor will corrupt it, though';
    case 'ok':return 'Track will run fine';
    default:return "Track will fail because there's no winning path";
   }
  };

  const carSelector=()=>{
   const wrap=document.createElement('div');wrap.style.cssText='display:flex;justify-content:center;align-items:center;gap:9px;margin-top:15px;';
   const label=document.createElement('span');label.textContent='Times estimated based on:';label.style.color='#c8c8dc';
   const select=document.createElement('select');select.style.cssText='padding:6px 8px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:3px;min-width:230px;';
   cars.forEach((car,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=car.name+(car.handicap===null?' · not calibrated':'');option.selected=index===analysisCarIndex;select.append(option);});
   select.addEventListener('change',()=>{analysisCarIndex=Number(select.value)||0;draw();});
   wrap.append(label,select);
   if(cars[analysisCarIndex]?.handicap===null){const note=document.createElement('span');note.textContent='No Bliss handicap for this custom car yet.';note.style.cssText='color:#ffbd7a;font-size:11px;';wrap.append(note);}
   return wrap;
  };

  const drawSummary=()=>{
   const table=document.createElement('div');table.style.cssText='display:grid;grid-template-columns:260px minmax(0,1fr);gap:8px 14px;';
   const rows:[string,string][]=[
    ['Total paths',String(summary.totalPaths)],
    ['Winning paths',String(summary.winningPaths)],
   ];
   if(summary.winningPaths){
    rows.push(['Shortest winning path',summary.shortestWinning+' tiles']);
    rows.push(['Estimated winning time',timeFor(summary.briefestWinning!)+' ('+summary.briefestWinning+' tokens)']);
   }
   rows.push(['Safe paths',String(summary.safePaths)]);
   if(summary.safePaths){
    rows.push(['Shortest safe path',summary.shortestSafe+' tiles']);
    rows.push(['Estimated winning time on a safe path',timeFor(summary.briefestSafe!)]);
   }
   rows.push(['Cycles',String(summary.cycles)]);
   for(const [label,value] of rows){const a=document.createElement('strong'),b=document.createElement('span');a.textContent=label;a.style.color='#c8c8dc';b.textContent=value;b.style.color='#d8d66d';table.append(a,b);}
   const prognosisLabel=document.createElement('strong');prognosisLabel.textContent='Prognosis:';prognosisLabel.style.cssText='display:block;color:#c8c8dc;margin-top:18px;';
   const prognosis=document.createElement('div');prognosis.textContent=prognosisText();prognosis.style.cssText='color:#d8d66d;margin-top:4px;';
   body.append(table,prognosisLabel,prognosis);
   if(summary.winningPaths)body.append(carSelector());
  };

  const drawPaths=()=>{
   const list=document.createElement('div');list.style.cssText='display:grid;gap:6px;';
   summary.paths.forEach(row=>{
    const selected=row.index===currentPath;
    const item=document.createElement('button');item.type='button';
    item.style.cssText='display:block;width:100%;text-align:left;padding:8px 10px;border:1px solid '+(selected?'#9b9bc5':'#40405b')+';background:'+(selected?'#09090f':'#111126')+';color:inherit;cursor:pointer;border-radius:2px;';
    const first=document.createElement('div');first.style.cssText='color:#c8c8dc;';
    first.textContent='Path '+(row.index+1)+': '+row.tiles+' tiles - '+timeFor(row.tokens);
    const second=document.createElement('div');second.style.cssText='color:#d8d66d;margin-top:2px;';
    let statusText=row.finishes?(row.error?'Complete, with warnings':'Complete, safe'):'Incomplete';
    if(!row.finishes&&row.wrongWay)statusText+=', wrong way';
    else if(!row.finishes&&row.cyclic)statusText+=', cyclic';
    if(row.opponentPath)statusText+=" (opp's path)";
    if(row.fastest)statusText+=' - Fastest';
    second.textContent=statusText;item.append(first,second);
    item.addEventListener('click',()=>{currentPath=row.index;draw();});
    if(selected)item.dataset.currentPath='true';
    list.append(item);
   });
   body.append(list);
   if(summary.winningPaths)body.append(carSelector());
   requestAnimationFrame(()=>body.querySelector<HTMLElement>('[data-current-path="true"]')?.scrollIntoView({block:'nearest'}));
  };

  const drawTimes=()=>{
   if(!summary.briefestWinning){const empty=document.createElement('p');empty.textContent='No winning path is available for time estimates.';body.append(empty);return;}
   const section=(titleText:string,rows:readonly (readonly [string,number])[])=>{
    const title=document.createElement('h3');title.textContent=titleText;title.style.cssText='text-align:center;font-size:14px;color:#ddd;margin:6px 0 8px;';
    const table=document.createElement('div');table.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:4px 16px;max-width:520px;margin:0 auto 18px;';
    for(const [racer,ratio] of rows){const a=document.createElement('span'),b=document.createElement('span');a.textContent=racer;a.style.color='#c8c8dc';b.textContent=timeFor(summary.briefestWinning!,ratio,true);b.style.color='#d8d66d';table.append(a,b);}
    body.append(title,table);
   };
   section('Estimated OWOOT times for famous racers',rh);
   section('Estimated OWOOT NoRH times for famous racers',noRh);
   body.append(carSelector());
  };

  const pathsButton=button('See paths',()=>{page=1;draw();}),timesButton=button('See times',()=>{page=2;draw();}),mainButton=button('Main page',()=>{page=0;draw();});
  const close=()=>{modalOpen=false;shade.remove();},closeButton=button('OK',close);
  const followButton=button('Follow path',()=>{
   const selected=currentPath;close();void followAnalysisPath(selected,analysis);
  });
  const draw=()=>{
   body.replaceChildren();actions.replaceChildren();
   if(page===0){drawSummary();actions.append(pathsButton);if(summary.winningPaths)actions.append(timesButton);actions.append(closeButton);}
   else if(page===1){drawPaths();actions.append(followButton);if(summary.winningPaths)actions.append(timesButton);actions.append(mainButton,closeButton);}
   else{drawTimes();actions.append(mainButton,pathsButton,closeButton);}
  };

  box.append(heading,body,actions);shade.append(box);document.body.append(shade);draw();
  shade.addEventListener('keydown',event=>{
   if(event.code==='Escape'){event.preventDefault();close();return;}
   if(page===1&&event.code==='ArrowUp'){event.preventDefault();currentPath=Math.max(0,currentPath-1);draw();return;}
   if(page===1&&event.code==='ArrowDown'){event.preventDefault();currentPath=Math.min(summary.paths.length-1,currentPath+1);draw();return;}
   if(page===1&&event.code==='Enter'){event.preventDefault();const selected=currentPath;close();void followAnalysisPath(selected,analysis);}
  });
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});
  requestAnimationFrame(()=>shade.focus());
 }

 function showHelp(initial:0|1){
  if(helpOverlay){helpOverlay.remove();helpOverlay=null;modalOpen=false;overlay.focus();return;}
  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;helpOverlay=shade;shade.style.cssText='position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:24px;';
  const closeHelp=()=>{if(helpOverlay!==shade)return;helpOverlay=null;modalOpen=false;shade.remove();overlay.focus();};
  const box=document.createElement('div');box.style.cssText='width:min(920px,94vw);height:min(760px,90vh);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#171717;border:1px solid #555;border-radius:9px;color:#ddd;box-shadow:0 18px 60px #000;font:13px/1.45 system-ui,Segoe UI,sans-serif;overflow:hidden;';
  const heading=document.createElement('div');heading.style.cssText='padding:16px 20px 12px;border-bottom:1px solid #333;';
  const title=document.createElement('h2');title.textContent='Track Editor Manual';title.style.cssText='font-size:18px;margin:0;color:#f1f1f1;';
  const subtitle=document.createElement('div');subtitle.textContent='PlayStunts DX · Bliss-compatible editor';subtitle.style.cssText='margin-top:3px;color:#888;font-size:11px;';
  heading.append(title,subtitle);

  const nav=document.createElement('div');nav.style.cssText='display:flex;gap:5px;flex-wrap:wrap;padding:9px 14px;background:#111;border-bottom:1px solid #2f2f2f;';
  const content=document.createElement('div');content.style.cssText='overflow:auto;scroll-behavior:smooth;padding:18px 22px 28px;min-height:0;';
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;padding:9px 14px;border-top:1px solid #333;background:#111;';
  const close=button('Back',closeHelp);actions.append(close);

  const section=(id:string,titleText:string,bodyText:string)=>{
   const s=document.createElement('section');s.id='help-'+id;s.style.cssText='scroll-margin-top:8px;margin:0 0 28px;';
   const h=document.createElement('h3');h.textContent=titleText;h.style.cssText='font-size:15px;color:#e8e8e8;margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #333;';
   const p=document.createElement('div');p.style.cssText='color:#bdbdbd;white-space:pre-line;max-width:780px;';p.textContent=bodyText;
   s.append(h,p);content.append(s);return s;
  };
  const tableSection=(id:string,titleText:string,rows:readonly (readonly [string,string])[])=>{
   const s=document.createElement('section');s.id='help-'+id;s.style.cssText='scroll-margin-top:8px;margin:0 0 28px;';
   const h=document.createElement('h3');h.textContent=titleText;h.style.cssText='font-size:15px;color:#e8e8e8;margin:0 0 9px;padding-bottom:5px;border-bottom:1px solid #333;';
   const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:minmax(105px,150px) minmax(0,1fr);gap:5px 16px;align-items:start;';
   for(const [keyName,description] of rows){
    const a=document.createElement('kbd');a.textContent=keyName;a.style.cssText='display:inline-block;width:max-content;max-width:145px;padding:3px 5px;border:1px solid #484848;border-radius:4px;background:#202020;color:#d8d66d;font:600 11px/1.25 ui-monospace,Consolas,monospace;';
    const b=document.createElement('span');b.textContent=description;b.style.color='#bcbcbc';grid.append(a,b);
   }
   s.append(h,grid);content.append(s);return s;
  };

  const sections=[
   ['basics','Basics',()=>section('basics','Basics',
`The editor works directly on a 30 × 30 Stunts track grid.

Choose a track piece from the palette on the left, then place it on the map. Left click paints, right click erases, and the middle mouse button picks an existing element. The active track piece is shown above the palette.

Use the 2D / 3D switch above the map whenever you want to inspect the result spatially. The editor keeps normal Bliss-compatible track data while adding PlayStunts DX conveniences such as high-resolution previews, metadata and custom-track saving.`)],
   ['pieces','Track Pieces',()=>section('pieces','Track Pieces',
`The palette is split across twelve pages. F1–F12 switch directly between those pages. Many common road types can also be selected with letter shortcuts.

Smart placement tries to choose a matching variant for connected roads where possible. Manual mode disables some of that protection and allows raw or conflicting combinations, which is useful for advanced editing but easier to misuse.

The scenery selector below the palette changes the track landscape/background independently from the individual scenery objects placed on the grid.`)],
   ['editing','Selection & Editing',()=>section('editing','Selection & Editing',
`Hold Ctrl and drag with the left mouse button, or use the Select toolbar button, to mark a rectangular area.

Copy and Cut store the selected track/terrain block in the clipboard. Paste enters hovering-paste mode so the block can be moved before placement. Flip and Rotate affect the current selection or paste block; when no selection exists, the toolbar variants can transform the whole track.

TRK and TER decide which layers are affected by destructive operations. Undo and Redo work on normal editor operations and strokes.`)],
   ['view3d','3D View',()=>section('view3d','3D View',
`Switch the center view from 2D to 3D with the toggle above the map.

In the 3D view, Ctrl + left-drag orbits the camera, Ctrl + right-drag pans, and the mouse wheel zooms. The zoom controls above the map also work in both views.

The 3D view is for inspection and navigation; track editing remains driven by the same underlying 30 × 30 track data.`)],
   ['scenery','Scenery & Tools',()=>section('scenery','Scenery & Tools',
`Generate Scenery creates scenery automatically from configurable placement rules and percentages.

Track Analysis inspects the route, identifies paths and errors, and can calculate estimated times for the available cars. Track Information edits title, author, comment and championship metadata. Tournaments handles Bliss-compatible tournament configuration and scoreboards.

WAR toggles conflict/warning marks, GRID toggles the grid, COL enables annotation/colouring mode, and TRK SHOT exports the complete map or the current selection.`)],
   ['saving','Saving & Custom Tracks',()=>section('saving','Saving & Custom Tracks',
`New creates a fresh track from a terrain preset. Load opens an existing track. Save writes the current track to Custom Tracks; Save As lets you choose a new name.

Track names are limited to eight Stunts-compatible characters. Supplied/original tracks are protected from being overwritten through the Custom Tracks workflow.

The editor stores Bliss metadata where supported, including creation date, editing time and PlayStunts DX as the editing tool.`)],
   ['keys','Option Keys',()=>tableSection('keys','Option Keys',OPTION_HELP)],
   ['tiles','Tile Shortcuts',()=>tableSection('tiles','Tile Shortcuts',TILE_HELP)],
  ] as const;

  const built=new Map<string,HTMLElement>();
  for(const [, ,build] of sections){const s=build();built.set(s.id.replace('help-',''),s);}
  const jump=(id:string)=>{built.get(id)?.scrollIntoView({behavior:'smooth',block:'start'});};

  for(const [id,labelText] of sections){
   const b=button(labelText,()=>jump(id));b.style.cssText+='padding:5px 8px;font-size:10px;background:#1d1d1d;border-color:#3f3f3f;color:#ccc;';
   nav.append(b);
  }

  box.append(heading,nav,content,actions);shade.append(box);document.body.append(shade);
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'||event.code==='F1'){event.preventDefault();event.stopPropagation();closeHelp();}},true);
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)closeHelp();});
  requestAnimationFrame(()=>{shade.focus();jump(initial===1?'tiles':'basics');});
 }

 function canvasBmpBlob(canvas:HTMLCanvasElement){
  const width=canvas.width,height=canvas.height,image=canvas.getContext('2d')!.getImageData(0,0,width,height),rowSize=((width*3+3)>>2)<<2,pixelSize=rowSize*height,fileSize=54+pixelSize;
  const bytes=new Uint8Array(fileSize),view=new DataView(bytes.buffer);
  bytes[0]=0x42;bytes[1]=0x4d;view.setUint32(2,fileSize,true);view.setUint32(10,54,true);view.setUint32(14,40,true);view.setInt32(18,width,true);view.setInt32(22,height,true);view.setUint16(26,1,true);view.setUint16(28,24,true);view.setUint32(34,pixelSize,true);
  for(let y=0;y<height;y++){
   const sourceY=height-1-y,row=54+y*rowSize;
   for(let x=0;x<width;x++){
    const source=(sourceY*width+x)*4,target=row+x*3;bytes[target]=image.data[source+2];bytes[target+1]=image.data[source+1];bytes[target+2]=image.data[source];
   }
  }
  return new Blob([bytes],{type:'image/bmp'});
 }
 async function takeTrackShot(){
  const format=editorSettings.trackShotFormat;
  const full=document.createElement('canvas');full.width=BLISS_ORIGINAL_MAP_SIZE;full.height=BLISS_ORIGINAL_MAP_SIZE;
  const fullContext=full.getContext('2d',{alpha:false})!;fullContext.putImageData(blissOriginalMapImageData(core.track,host.resources,host.palette,editorSettings.trackShotGrid),0,0);if(editorSettings.trackShotCarMarkers)drawCarMarkers(core.track,fullContext);if(editorSettings.trackShotAnnotations)drawColouring(fullContext);
  const selection=core.selection,shot=document.createElement('canvas');
  if(selection){
   shot.width=selection.width*16;shot.height=selection.height*16;
   shot.getContext('2d',{alpha:false})!.drawImage(full,selection.x*16,selection.y*16,shot.width,shot.height,0,0,shot.width,shot.height);
  }else{shot.width=full.width;shot.height=full.height;shot.getContext('2d',{alpha:false})!.drawImage(full,0,0);}
  let blob:Blob|null=null,extension=format;
  if(format==='bmp')blob=canvasBmpBlob(shot);
  else if(format==='jpeg'){extension='jpg';blob=await new Promise<Blob|null>(resolve=>shot.toBlob(resolve,'image/jpeg',editorSettings.jpegQuality));}
  else blob=await new Promise<Blob|null>(resolve=>shot.toBlob(resolve,'image/png'));
  if(!blob){status.textContent='Could not create track-shot.';status.style.color='#ff9b9b';return;}
  const filename=(host.track.name||'TRACK')+'-trackshot.'+extension;
  if(host.persistTrackShot){
   try{
    const location=await host.persistTrackShot(filename,new Uint8Array(await blob.arrayBuffer()));
    status.textContent='Track-shot saved to '+location+(selection?' from selected region':'')+'.';status.style.color='#aee18a';return;
   }catch(error){status.textContent='Could not save track-shot: '+String(error);status.style.color='#ff9b9b';return;}
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Track-shot exported as '+extension.toUpperCase()+(selection?' from selected region':'')+'.';status.style.color='#aee18a';
 }

 async function createNewTrack(){
  if(core.modified&&!await centeredConfirm('New Track','Discard the current unsaved changes and create a new track?','Discard and Continue','Cancel'))return;
  const preset=await selectTerrainPreset(blissTerrainPresets(host.presets));if(!preset)return;
  const landscape=core.track.landscape;
  core.newTrack({landscape,format:preset.format,terrain:preset.terrain});
  metadataEditingBase=0;editingSessionStarted=performance.now();syncMetadataClock();
  host.track.name='';name.textContent='UNTITLED.TRK';cellX=0;cellY=0;page=0;brush=4;terrainBrush=0;lastPlaced=null;core.setSelection(null);changed('New track · '+preset.name);
 }

 async function requestedTrackName(force=false){
  if(!force&&host.track.name){const isCustom=host.customTrackExists?await host.customTrackExists(host.track.name):true;if(isCustom)return host.track.name;}
  const entered=await centeredPrompt('Save Track','Track name (maximum 8 characters):',host.track.name||'NEWTRACK');if(entered===null)return null;
  const clean=entered.trim().replace(/[^A-Za-z0-9_-]/g,'_').toUpperCase().slice(0,8);
  if(!clean){await centeredNotice('Save Track','Please enter a track name.');return null;}
  return clean;
 }

 async function saveTrack(forceName=false){
  const target=await requestedTrackName(forceName);if(!target)return false;const savePath='';
  const targetIsCustom=host.customTrackExists?await host.customTrackExists(target):false,targetExists=await host.exists(savePath,target);
  if(host.customTrackExists&&targetExists&&!targetIsCustom){await centeredNotice('Save Track',target+'.TRK is a supplied track and cannot be replaced through Custom Tracks. Choose another name.');return false;}
  if(targetIsCustom&&(forceName||target!==host.track.name)&&!await centeredConfirm('Overwrite Track',target+'.TRK already exists in Custom Tracks. Overwrite it?','Overwrite','Cancel'))return false;
  syncMetadataClock();
  const fullBytes=encodeBlissTrack(core.track),bytes=fullBytes.subarray(0,1802);let customLocation='';
  try{if(host.persistCustomTrack)customLocation=await host.persistCustomTrack(target,fullBytes);}catch(error){status.textContent='Could not save to Custom Tracks: '+String(error);status.style.color='#ff9b9b';return false;}
  const statusCode=await host.writeTrack(savePath,target,bytes);if(statusCode){status.textContent='Track was written to Custom Tracks, but could not be added to the current track list.';status.style.color='#ffbd7a';return false;}
  host.track.name=target;host.track.path=savePath;name.textContent=host.track.name+'.TRK';await host.clearScores(savePath,host.track.name);host.track.raw=Array.from(bytes);core.markSaved();renderStatus();
  status.textContent=customLocation?'Saved to '+customLocation:'Saved '+host.track.name+'.TRK';status.style.color='#aee18a';return true;
 }
 function finishTest(spawn:RaceSpawn){
  if(closed)return;
  syncMetadataClock();host.track.raw=Array.from(encodeBlissTrack(core.track).subarray(0,1802));
  const carId=testCar.value||host.testCarId||cars[0]?.id||'';
  document.getElementById('playstunts-editor-test-loading')?.remove();
  const loading=document.createElement('div');loading.id='playstunts-editor-test-loading';
  loading.style.cssText='position:fixed;inset:0;z-index:2147482999;background:#090909;color:#ddd;display:grid;place-items:center;font:600 15px/1.2 system-ui,Segoe UI,sans-serif;';
  const card=document.createElement('div');card.textContent='Loading test drive…';card.style.cssText='padding:14px 18px;border:1px solid #444;border-radius:6px;background:#151515;color:#ddd;';
  loading.append(card);document.body.append(loading);
  closed=true;cleanup();resolveDone?.({spawn:{...spawn},carId});
 }
 async function finish(){
  if(closed)return;
  if(core.modified){
   const choice=await confirmExitChoice();
   if(choice==='cancel')return;
   if(choice==='save'&&!await saveTrack())return;
  }
  closed=true;cleanup();resolveDone?.(undefined);
 }
 const cleanup=()=>{if(editor3D)host.on3DCameraChange?.(editor3D.cameraState());core.endStroke();manualHexDeadline=0;helpOverlay?.remove();helpOverlay=null;window.removeEventListener('keydown',keyDown,true);window.removeEventListener('pointerdown',capturePointerBinding,true);window.removeEventListener('wheel',captureWheelBinding,true);window.removeEventListener('pointermove',updateSpawnDrag,true);window.removeEventListener('pointerup',finishSpawnDrag,true);window.removeEventListener('wheel',rotateDraggingSpawn,true);dragGhost.remove();editor3D?.close();editor3D=undefined;setBlissEditorActive(false);overlay.remove();};
 let resolveDone:((request:BrowserBlissEditorTestRequest|undefined)=>void)|undefined;
 for(const marker of Object.values(markerImages))marker.onload=()=>{if(!closed){renderPalette();renderMap();}};
 renderPalette();renderScenery();renderMap();renderStatus();updateArea();overlay.focus();void setViewMode(viewMode);if(viewMode==='2d')requestAnimationFrame(()=>fitMap());
 const requestedTest=await new Promise<BrowserBlissEditorTestRequest|undefined>(resolve=>{resolveDone=resolve;});cleanup();return requestedTest;
}
