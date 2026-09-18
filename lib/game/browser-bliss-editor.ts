import {BlissEditorCore} from './bliss-editor-core.ts';
import {blissElementData,blissPalettePages} from './bliss-element-data.ts';
import {blissOriginalMapImageData,blissOriginalPaletteImageData,type BlissOriginalMapResources,BLISS_ORIGINAL_MAP_SIZE} from './bliss-original-map.ts';
import {createBlissTrack,encodeBlissTrack} from './bliss-track.ts';
import {blissParentElement} from './bliss-edit.ts';
import {blissTrackHash} from './bliss-track.ts';
import {changeBlissMaterial,findBlissElementByName,smartSelectBliss} from './bliss-shortcuts.ts';
import {transformBlissTerrainCode,transformBlissTrackCode,type BlissTransformOperation} from './bliss-transformations.ts';
import {BLISS_TOOL_ICON_COLUMNS,BLISS_TOOL_ICON_SIZE,BLISS_TOOL_ICON_SPRITE} from './bliss-tool-icons.ts';
import {setBlissEditorActive} from './bliss-editor-presence.ts';
import {blissTerrainPresets,type BlissTerrainPreset} from './bliss-terrain-presets.ts';
import {setBlissTrackMetadata,type BlissMetadata} from './bliss-metadata.ts';
import {blissSceneryAvailability,blissSceneryDefaults,blissSceneryTargetCount,type BlissSceneryPlacement,type BlissSceneryRule} from './bliss-scenery-generator.ts';
import {blissTournamentUrl,parseBlissScoreboard,parseBlissTournamentConfig,type BlissTournamentRace} from './bliss-tournaments.ts';
import {blissEstimatedTimeCentiseconds,blissTimey} from './bliss-route.ts';

export interface BrowserBlissEditorHost {
 canvas:HTMLCanvasElement;
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
 fetchUrl?(url:string):Promise<Uint8Array>;
 enumerateTracks?():Promise<string[]>;
 readTrack?(path:string,name:string):Promise<Uint8Array>;
 presets?:readonly {terrain:number[]}[];
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
 ['Ctrl-S','Take a track-shot'],
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
 {name:'Settings',description:'Bliss editor settings. Full settings port still pending.'},
];
const SWITCH_TOOL_HELP:Record<string,HoverHelp>={
 clip:{name:'CLIP',description:'Shows whether the clipboard contains a block. Click to clear it.'},
 warn:{name:'WAR',shortcut:'Ctrl+D',description:'Show or hide Bliss conflict/warning markings on the map.'},
 manual:{name:'MAN',shortcut:'Ctrl+E',description:'Manual editing: allow raw/conflicting tile combinations Bliss normally prevents.'},
 grid:{name:'GRID',shortcut:'Ctrl+G',description:'Show or completely hide the 30×30 map grid.'},
 colour:{name:'COL',shortcut:'Ctrl+O',description:'Colouring/annotation mode. Port still pending.'},
 shot:{name:'TRK SHOT',shortcut:'Ctrl+S',description:'Export a picture of the complete map or the active selection.'},
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
 let brush=4,terrainBrush=0,page=0,cellX=0,cellY=0,painting=false,selecting=false,selectionAnchor:{x:number;y:number}|null=null,closed=false,zoom=1;
 let activeArea:EditorArea='grid',paletteCursor=0,lastPlaced:{x:number;y:number}|null=null;
 let allowConflicts=false,showConflicts=true,showGrid=true,debugMode=false,affectTrack=true,affectTerrain=false;
 let selectionTool=false,pasteMode=false,manualHex='',manualHexDeadline=0,modalOpen=false;

 const overlay=document.createElement('div');overlay.tabIndex=-1;overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#090909;color:#ddd;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:12px;box-sizing:border-box;font-family:system-ui,Segoe UI,sans-serif;';
 const top=document.createElement('div');top.style.cssText='display:flex;align-items:center;gap:8px;min-width:0;';
 const title=document.createElement('strong');title.textContent='PlayStunts DX — Bliss Track Editor';title.style.cssText='font-size:14px;color:#fff;margin-right:auto;';
 const name=document.createElement('span');name.textContent=host.track.name+'.TRK';name.style.cssText='color:#aaa;font-size:12px;';
 const status=document.createElement('span');status.style.cssText='color:#c8c8c8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48vw;';
 top.append(title,name,status);

 const main=document.createElement('div');main.style.cssText='display:grid;grid-template-columns:minmax(360px,460px) minmax(0,1fr) minmax(220px,280px);gap:10px;min-height:0;';
 const palettePanel=panel('Track pieces');
 palettePanel.style.display='grid';palettePanel.style.gridTemplateRows='auto auto minmax(0,1fr) auto auto';palettePanel.style.gap='8px';
 const selectedPiece=document.createElement('div');selectedPiece.style.cssText='display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;align-items:center;min-height:126px;padding:8px;border:1px solid #353535;background:#0b0b0b;border-radius:5px;';
 const selectedPreview=document.createElement('canvas');selectedPreview.width=32;selectedPreview.height=32;selectedPreview.style.cssText='width:112px;height:112px;image-rendering:pixelated;display:block;background:#070707;border:1px solid #292929;';
 const selectedInfo=document.createElement('div');selectedInfo.style.cssText='min-width:0;';
 const selectedName=document.createElement('strong');selectedName.style.cssText='display:block;color:#fff;font-size:14px;line-height:1.25;margin-bottom:5px;';
 const selectedCode=document.createElement('span');selectedCode.style.cssText='display:block;color:#888;font-size:11px;';
 selectedInfo.append(selectedName,selectedCode);selectedPiece.append(selectedPreview,selectedInfo);
 const paletteGrid=document.createElement('div');paletteGrid.style.cssText='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;align-content:start;overflow:auto;min-height:0;padding-right:3px;';
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

 const mapPanel=panel('30 × 30 track');
 mapPanel.style.display='grid';mapPanel.style.gridTemplateRows='auto auto minmax(0,1fr)';mapPanel.style.placeItems='stretch';
 const zoomBar=document.createElement('div');zoomBar.style.cssText='display:flex;justify-content:center;align-items:center;gap:5px;margin:-2px 0 8px;';
 const zoomOut=button('−',()=>setZoom(zoom-.25)),zoomReset=button('100%',()=>setZoom(1)),zoomIn=button('+',()=>setZoom(zoom+.25)),zoomFit=button('Fit',()=>fitMap());
 zoomOut.title='Zoom out';zoomIn.title='Zoom in';zoomReset.title='Actual size';zoomFit.title='Fit map to editor';
 for(const control of [zoomOut,zoomReset,zoomIn,zoomFit])control.style.padding='4px 8px';
 const mapWrap=document.createElement('div');mapWrap.style.cssText='min-height:0;min-width:0;display:grid;place-items:center;overflow:auto;background:#050505;border-radius:4px;';
 const map=document.createElement('canvas');map.width=BLISS_ORIGINAL_MAP_SIZE;map.height=BLISS_ORIGINAL_MAP_SIZE;map.style.cssText='display:block;image-rendering:pixelated;width:480px;height:480px;max-width:none;max-height:none;cursor:crosshair;box-shadow:0 0 0 1px #333;flex:none;';
 mapWrap.append(map);mapPanel.append(zoomBar,mapWrap);

 const toolsPanel=panel('Bliss tools');
 const attachHoverHelp=(control:HTMLElement,help:HoverHelp)=>{
  const shortcut=help.shortcut?('Shortcut: '+help.shortcut+'\n'):'';
  // Use the browser's native hover tooltip instead of reserving permanent
  // editor space. The tooltip contains the name, shortcut and explanation.
  control.title=help.name+'\n'+shortcut+help.description;
  control.setAttribute('aria-label',help.name+(help.shortcut?' — '+help.shortcut:'')+'. '+help.description);
 };
 const quick=document.createElement('div');quick.style.cssText='display:grid;grid-template-columns:repeat(4,48px);gap:4px;justify-content:center;padding:6px;background:#17172a;border:1px solid #303047;border-radius:5px;';
 const quickButton=(icon:number,titleText:string,action?:()=>void)=>{
  const help=QUICK_TOOL_HELP[icon]??{name:titleText,description:titleText};
  const control=button('',()=>action?.());
  control.style.cssText+='width:48px;height:48px;padding:1px;display:grid;place-items:center;background:#222238;border-color:#4a4a64;';
  const image=document.createElement('span'),column=icon%BLISS_TOOL_ICON_COLUMNS,row=Math.floor(icon/BLISS_TOOL_ICON_COLUMNS);
  image.style.cssText='display:block;width:'+BLISS_TOOL_ICON_SIZE+'px;height:'+BLISS_TOOL_ICON_SIZE+'px;background-image:url("'+BLISS_TOOL_ICON_SPRITE+'");background-repeat:no-repeat;background-size:'+(BLISS_TOOL_ICON_SIZE*BLISS_TOOL_ICON_COLUMNS)+'px '+(BLISS_TOOL_ICON_SIZE*5)+'px;background-position:-'+(column*BLISS_TOOL_ICON_SIZE)+'px -'+(row*BLISS_TOOL_ICON_SIZE)+'px;image-rendering:pixelated;';
  control.replaceChildren(image);attachHoverHelp(control,help);
  if(!action){control.setAttribute('aria-disabled','true');control.style.opacity='.35';control.style.cursor='help';}
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
 quickButton(17,'Track Analysis — paths/errors; racer time estimates pending',()=>showTrackAnalysis());
 quickButton(18,'Tournaments',()=>showTournaments());
 quickButton(19,'Editor Settings — full Bliss settings port pending');

 const switches=document.createElement('div');switches.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:10px;';
 const switchButtons=new Map<string,HTMLButtonElement>();
 const addSwitch=(id:string,label:string,action:()=>void)=>{const b=button(label,action),help=SWITCH_TOOL_HELP[id]??{name:label,description:label};attachHoverHelp(b,help);switchButtons.set(id,b);switches.append(b);return b;};
 addSwitch('clip','CLIP',()=>{core.clearClipboard();pasteMode=false;renderMap();renderStatus();status.textContent='Clipboard cleared.';});
 addSwitch('warn','WAR',()=>{showConflicts=!showConflicts;renderMap();renderStatus();});
 addSwitch('manual','MAN',()=>{allowConflicts=!allowConflicts;renderStatus();});
 addSwitch('grid','GRID',()=>{showGrid=!showGrid;renderMap();renderStatus();});
 const colourSwitch=addSwitch('colour','COL',()=>{status.textContent='Bliss colouring mode is not ported yet.';status.style.color='#ffbd7a';});
 colourSwitch.setAttribute('aria-disabled','true');colourSwitch.style.opacity='.35';colourSwitch.style.cursor='help';
 addSwitch('shot','TRK SHOT',()=>void takeTrackShot());
 addSwitch('trk','TRK',()=>{affectTrack=!affectTrack;renderMap();renderStatus();});
 addSwitch('ter','TER',()=>{affectTerrain=!affectTerrain;renderMap();renderStatus();});
 addSwitch('debug','DEB',()=>{debugMode=!debugMode;renderMap();renderStatus();});

 const help=document.createElement('p');help.textContent='Bliss keys are active: F/Shift+F, R/Shift+R, F1–F12, Ctrl+C/X/V/W, arrows, Tab, Enter, Del, P, U, C and tile shortcuts.';help.style.cssText='font-size:11px;line-height:1.35;color:#999;margin:10px 0 0;';
 toolsPanel.append(quick,switches,help);

 main.append(palettePanel,mapPanel,toolsPanel);

 const footer=document.createElement('div');footer.style.cssText='display:flex;align-items:center;gap:7px;min-width:0;';
 const coords=document.createElement('span');coords.style.cssText='font-size:11px;color:#888;margin-right:auto;';
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
 footer.append(coords,newTrackButton,loadTrackButton,save,saveAs,done);
 overlay.append(top,main,footer);setBlissEditorActive(true);document.body.append(overlay);

 const context=map.getContext('2d',{alpha:false})!;
 const setZoom=(next:number)=>{
  zoom=Math.max(.5,Math.min(4,Math.round(next*4)/4));
  const size=Math.round(BLISS_ORIGINAL_MAP_SIZE*zoom);
  map.style.width=size+'px';map.style.height=size+'px';zoomReset.textContent=Math.round(zoom*100)+'%';
 };
 const fitMap=()=>{
  const width=Math.max(1,mapWrap.clientWidth-20),height=Math.max(1,mapWrap.clientHeight-20);
  setZoom(Math.min(4,width/BLISS_ORIGINAL_MAP_SIZE,height/BLISS_ORIGINAL_MAP_SIZE));
 };
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
 const renderMap=()=>{
  context.putImageData(blissOriginalMapImageData(core.track,host.resources,host.palette,showGrid),0,0);
  if(pasteMode){
   const preview=core.previewPaste(cellX,cellY,{track:affectTrack,terrain:affectTerrain});
   if(preview){
    const ghost=document.createElement('canvas');ghost.width=BLISS_ORIGINAL_MAP_SIZE;ghost.height=BLISS_ORIGINAL_MAP_SIZE;
    ghost.getContext('2d',{alpha:false})!.putImageData(blissOriginalMapImageData(preview,host.resources,host.palette,showGrid),0,0);
    context.save();context.globalAlpha=.62;context.drawImage(ghost,0,0);context.globalAlpha=1;
    const size=core.clipboardSize();if(size){context.strokeStyle='#ffe34d';context.lineWidth=2;context.strokeRect(cellX*16+1,cellY*16+1,size.width*16-2,size.height*16-2);}
    context.restore();
   }
  }
  drawConflict();drawDebug();drawSelection();
  context.save();context.strokeStyle=activeArea==='grid'?'#fff':'rgba(255,255,255,.55)';context.lineWidth=1;context.strokeRect(cellX*16+.5,cellY*16+.5,15,15);context.restore();
 };
 const updateArea=()=>{
  palettePanel.style.boxShadow=activeArea==='palette'?'0 0 0 2px #879341 inset':'none';
  mapPanel.style.boxShadow=activeArea==='grid'?'0 0 0 2px #879341 inset':'none';
  renderMap();renderPalette();renderScenery();renderStatus();
 };
 const renderStatus=()=>{
  const terrainPage=page>=10,activeCode=terrainPage?terrainBrush:brush;
  const label=terrainPage?('Terrain '+terrainBrush):(blissElementData[brush]?.id||('Element '+brush));
  const flags=[allowConflicts?'MAN':'',showGrid?'GRID':'',showConflicts?'WAR':'',affectTrack?'TRK':'',affectTerrain?'TER':'',debugMode?'DEB':'',pasteMode?'PASTE':'',selectionTool?'SELECT':''].filter(Boolean).join(' ');
  status.textContent=(core.modified?'Modified · ':'')+label+' ['+activeCode+']'+(flags?' · '+flags:'');
  status.style.color=core.modified?'#f2d36d':'#c8c8c8';
  const selection=core.selection;
  coords.textContent='Cell '+(cellX+1)+','+(cellY+1)+(selection?' · selection '+selection.width+'×'+selection.height:'')+' · '+(activeArea==='grid'?'GRID':'PALETTE');
  undoTool.disabled=!core.history.canUndo;redoTool.disabled=!core.history.canRedo;
  for(const [id,b] of switchButtons){
   const active=id==='clip'?!!core.clipboardSize():id==='warn'?showConflicts:id==='manual'?allowConflicts:id==='grid'?showGrid:id==='trk'?affectTrack:id==='ter'?affectTerrain:id==='debug'?debugMode:false;
   setActive(b,active);
  }
 };
 const changed=(message='')=>{
  const bytes=encodeBlissTrack(core.track).subarray(0,1802);host.track.raw=Array.from(bytes);
  renderMap();renderPalette();renderScenery();renderStatus();if(message)status.textContent=message+' · '+status.textContent;
 };
 const paletteLabels=['Paved','Dirt','Ice','Stunts','Banked','Splits','Highway','Elevated','Spins','Scenery','Terrain tiles','Terrain brush'] as const;
 const pageCodes=(index:number)=>{
  const codes=Array.from(new Set(blissPalettePages[index])).filter(code=>index>=10?code<=18:code>0&&code<253);
  return index===11?codes.filter(code=>code===1||code===6):codes;
 };
 const terrainLabel=(code:number,pageIndex=page)=>{
  if(pageIndex===11)return code===1?'Water brush':code===6?'Mountain brush':('Terrain brush '+code);
  if(code===0)return 'Flat / grass';
  if(code===1)return 'Water';
  if(code===6)return 'Mountain';
  return 'Terrain tile '+code;
 };
 const drawPreview=(canvas:HTMLCanvasElement,code:number,terrain:boolean,size:number)=>{
  const image=blissOriginalPaletteImageData(code,terrain,host.resources,host.palette);
  canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d',{alpha:false})!.putImageData(image,0,0);
  canvas.style.width=size+'px';canvas.style.height=size+'px';
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
  const codes=pageCodes(index),representative=codes[0]??0;drawPreview(canvas,representative,false,38);
 };
 const renderPalette=()=>{
  const terrainPage=page>=10,currentCode=terrainPage?terrainBrush:brush,currentLabel=terrainPage?terrainLabel(terrainBrush):(blissElementData[brush]?.id||('Element '+brush));
  selectedName.textContent=manualHexDeadline?'?':currentLabel;
  selectedCode.textContent=manualHexDeadline?('Manual code: '+manualHex.padEnd(2,'_')):page===10
   ?('F11 · direct terrain tile · left click/Enter places, right click/Del clears')
   :page===11
    ?('F12 · brush mode · left adds, right removes · mouse only')
    :(('Track element ')+currentCode+' · F'+(page+1));
  drawPreview(selectedPreview,currentCode,terrainPage,112);

  paletteGrid.replaceChildren();
  const codes=pageCodes(page);if(paletteCursor>=codes.length)paletteCursor=Math.max(0,codes.length-1);
  codes.forEach((code,index)=>{
   const label=terrainPage?terrainLabel(code):(blissElementData[code]?.id||('Element '+code));
   const entry=button('',()=>{
    paletteCursor=index;selectPaletteCode(code,terrainPage);activeArea='palette';updateArea();
   });
   entry.title=label;entry.setAttribute('aria-label',label);
   entry.style.cssText+='display:grid;place-items:center;min-height:74px;padding:4px;overflow:hidden;';
   const preview=document.createElement('canvas');preview.style.cssText='image-rendering:pixelated;display:block;';
   drawPreview(preview,code,terrainPage,64);entry.append(preview);
   setActive(entry,code===currentCode||activeArea==='palette'&&index===paletteCursor);paletteGrid.append(entry);
  });

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
  renderPalette();renderStatus();
 };
 const mapCoordinates=(event:PointerEvent)=>{
  const rect=map.getBoundingClientRect(),px=(event.clientX-rect.left)*map.width/rect.width,py=(event.clientY-rect.top)*map.height/rect.height;
  return {x:Math.max(0,Math.min(29,Math.floor(px/16))),y:Math.max(0,Math.min(29,Math.floor(py/16))),vx:Math.max(0,Math.min(30,Math.round(px/16))),vy:Math.max(0,Math.min(30,Math.round(py/16)))};
 };
 const setSelectionFrom=(a:{x:number;y:number},b:{x:number;y:number})=>{
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),width=Math.abs(a.x-b.x)+1,height=Math.abs(a.y-b.y)+1;
  core.setSelection({x,y,width,height});renderMap();renderStatus();
 };
 const apply=(event:PointerEvent,forceErase=false)=>{
  const p=mapCoordinates(event);cellX=p.x;cellY=p.y;activeArea='grid';
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
  event.preventDefault();activeArea='grid';map.setPointerCapture(event.pointerId);
  const p=mapCoordinates(event);cellX=p.x;cellY=p.y;
  if(event.button===1){pickAtCursor();return;}
  if(pasteMode){
   if(event.button===0)commitPaste();
   else if(event.button===2){pasteMode=false;renderMap();renderStatus();}
   return;
  }
  if((event.ctrlKey||selectionTool)&&event.button===0){selecting=true;selectionAnchor={x:p.x,y:p.y};setSelectionFrom(selectionAnchor,p);return;}
  painting=true;core.beginStroke();apply(event,event.button===2);
 };
 const pointerMove=(event:PointerEvent)=>{
  const p=mapCoordinates(event);if(p.x===cellX&&p.y===cellY)return;cellX=p.x;cellY=p.y;
  if(selecting&&selectionAnchor){setSelectionFrom(selectionAnchor,p);return;}
  if(pasteMode){renderMap();renderStatus();return;}
  if(painting&&(event.buttons&3))apply(event,(event.buttons&2)!==0);else{renderMap();renderStatus();}
 };
 const pointerUp=(event:PointerEvent)=>{
  if(painting)core.endStroke();
  painting=false;
  if(selecting&&selectionTool)selectionTool=false;
  selecting=false;selectionAnchor=null;
  if(map.hasPointerCapture(event.pointerId))map.releasePointerCapture(event.pointerId);
  renderStatus();
 };
 map.addEventListener('pointerdown',pointerDown);map.addEventListener('pointermove',pointerMove);map.addEventListener('pointerup',pointerUp);map.addEventListener('pointercancel',pointerUp);map.addEventListener('contextmenu',event=>event.preventDefault());
 map.addEventListener('wheel',event=>{event.preventDefault();setZoom(zoom+(event.deltaY<0?.25:-.25));},{passive:false});

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
   const codes=pageCodes(page),code=codes[paletteCursor];if(code!==undefined)selectPaletteCode(code,page>=10);activeArea='grid';updateArea();return;
  }
  if(core.selection){if(core.buildClosedCircuit(brush))changed('Closed circuit created');else{status.textContent='This brush cannot create a closed circuit.';status.style.color='#ffbd7a';}return;}
  if(page===11){status.textContent='Bliss F12 terrain brushes are mouse-only.';status.style.color='#ffbd7a';return;}
  if(page===10){if(core.paintTerrain(cellX,cellY,terrainBrush))changed('Terrain placed');}
  else if(core.place(cellX,cellY,brush,allowConflicts)){lastPlaced={x:cellX,y:cellY};changed('Element placed');}
 };
 const smartSelect=(key:string,direction:1|-1)=>{
  const next=smartSelectBliss(core.track,brush,key,direction,lastPlaced,core.definitions);if(next!==brush){brush=next;renderPalette();renderStatus();}
 };
 const changeMaterial=()=>{if(page>2)return;const next=changeBlissMaterial(brush);if(next!==brush){brush=next;renderPalette();renderStatus();}};
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
 const movePalette=(dx:number,dy:number)=>{const codes=pageCodes(page);if(!codes.length)return;paletteCursor=Math.max(0,Math.min(codes.length-1,paletteCursor+dx+dy*4));renderPalette();renderStatus();};

 const keyDown=(event:KeyboardEvent)=>{
  if(modalOpen||event.defaultPrevented)return;
  const code=event.code,key=event.key;

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
   if(upper==='S'){event.preventDefault();void takeTrackShot();return;}
   if(upper==='H'){event.preventDefault();status.textContent='Track hash: '+blissTrackHash(core.track).toString(16).toUpperCase().padStart(8,'0');status.style.color='#aee18a';return;}
   if(upper==='O'){event.preventDefault();status.textContent='Bliss colouring mode is not ported yet; no fake toggle is applied.';status.style.color='#ffbd7a';return;}
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
  if(terrain)terrainBrush=next;else brush=next;renderPalette();renderStatus();
  if(next===before){status.textContent=label+': this piece is symmetrical, so its orientation does not change.';status.style.color='#aaa';}
  else{status.textContent=label+' → '+next+' · '+(terrain?('Terrain '+next):(blissElementData[next]?.id||('Element '+next)));status.style.color='#aee18a';}
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
 const loadTournamentSites=():TournamentSite[]=>{
  try{
   const value=JSON.parse(localStorage.getItem(tournamentStorageKey)??'[]');
   if(!Array.isArray(value))return [];
   return value.filter(row=>row&&typeof row.name==='string'&&typeof row.url==='string').map(row=>({name:row.name,url:row.url}));
  }catch{return [];}
 };
 const saveTournamentSites=(sites:readonly TournamentSite[])=>{try{localStorage.setItem(tournamentStorageKey,JSON.stringify(sites));}catch{}};

 async function showTournamentScoreboard(site:TournamentSite,race:BlissTournamentRace){
  if(!host.fetchUrl){await centeredNotice('Tournament','Network access is unavailable in this build.');return;}
  if(!race.scoreboard){await centeredNotice('Scoreboard','This tournament does not publish a scoreboard.');return;}
  let bytes:Uint8Array;
  try{bytes=await host.fetchUrl(blissTournamentUrl(site.url,race.scoreboard));}
  catch(error){await centeredNotice('Scoreboard','Could not load the scoreboard: '+String(error));return;}
  if(!bytes.length){await centeredNotice('Scoreboard','There is no scoreboard for this race yet.');return;}
  const entries=parseBlissScoreboard(bytes);
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
    const cfg=await host.fetchUrl(blissTournamentUrl(site.url,'tour.cfg')),race=parseBlissTournamentConfig(cfg);
    if(!race.tournament&&!race.trackFile)throw Error('tour.cfg does not contain Bliss tournament information');
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
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(790px,94vw);max-height:88vh;overflow:auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:18px 22px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.35 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Generate Scenery';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 7px;color:#fff;';
  const intro=document.createElement('p');intro.textContent='Bliss uses percentages of the currently available cells, not literal object counts. The calculated object count is shown beside each percentage.';intro.style.cssText='text-align:center;color:#aaa;margin:0 0 14px;';
  const table=document.createElement('div');table.style.cssText='display:grid;grid-template-columns:minmax(145px,1fr) 92px 105px 150px;gap:6px 10px;align-items:center;';
  for(const label of ['Scenery','Percentage','Objects','Placement']){const h=document.createElement('strong');h.textContent=label;h.style.cssText='color:#d8d8ea;border-bottom:1px solid #555;padding-bottom:5px;';table.append(h);}
  const percentageInputs:HTMLInputElement[]=[],countLabels:HTMLSpanElement[]=[],modeInputs:HTMLSelectElement[]=[];
  const availabilityFor=(rule:BlissSceneryRule,eraseExisting:boolean)=>{
   const available=blissSceneryAvailability(core.track,eraseExisting);
   return rule.placement==='everywhere'?available.openfield:rule.placement==='on-water'?available.water:available.byRoad;
  };
  const refreshCounts=()=>{
   rules.forEach((rule,index)=>{
    const available=availabilityFor(rule,erase.checked);
    countLabels[index].textContent=String(blissSceneryTargetCount(available,rule.percent));
    countLabels[index].title=rule.percent+'% of '+available+' eligible cells using Bliss\' rounding/count rule';
   });
  };
  const normalizeGroup=(lastChanged:number)=>{
   const shipOnWater=rules[9]?.placement==='on-water',top=shipOnWater?8:9;
   const group=(rule:BlissSceneryRule)=>rule.placement==='everywhere'?1:2;
   const changedGroup=group(rules[lastChanged]);
   const indices=Array.from({length:top+1},(_,i)=>i).filter(i=>group(rules[i])===changedGroup);
   const total=indices.reduce((sum,i)=>sum+rules[i].percent,0);if(total<=100)return;
   const own=indices.includes(lastChanged)?rules[lastChanged].percent:0,others=total-own;
   const factor=others>0?(100-own)/others:0;
   for(const i of indices)if(i!==lastChanged){
    rules[i].percent=Math.max(0,Math.min(100,Math.round(rules[i].percent*factor)));
    percentageInputs[i].value=String(rules[i].percent);
   }
  };
  rules.forEach((rule,index)=>{
   const label=document.createElement('span');label.textContent=rule.name;label.style.color='#ddd';
   const percentage=document.createElement('input');percentage.type='number';percentage.min='0';percentage.max='100';percentage.step='1';percentage.value=String(rule.percent);percentage.style.cssText='box-sizing:border-box;width:100%;padding:6px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:3px;';
   const count=document.createElement('span');count.style.cssText='text-align:right;color:#d6c95f;font:12px ui-monospace,Consolas,monospace;';
   const mode=document.createElement('select');mode.style.cssText='box-sizing:border-box;width:100%;padding:6px;background:#0d0d18;border:1px solid #676783;color:#fff;border-radius:3px;';
   const isShip=rule.baseCode===0xab;
   const choices:readonly [BlissSceneryPlacement,string][]=isShip?[['on-water','On water'],['everywhere','Everywhere']]:[['everywhere','Everywhere'],['by-road','By the road']];
   for(const [value,text] of choices){const option=document.createElement('option');option.value=value;option.textContent=text;option.selected=value===rule.placement;mode.append(option);}
   percentageInputs.push(percentage);countLabels.push(count);modeInputs.push(mode);
   percentage.addEventListener('input',()=>{
    rules[index].percent=Math.max(0,Math.min(100,Math.round(Number(percentage.value)||0)));percentage.value=String(rules[index].percent);
    normalizeGroup(index);refreshCounts();
   });
   mode.addEventListener('change',()=>{rules[index].placement=mode.value as BlissSceneryPlacement;normalizeGroup(index);refreshCounts();});
   table.append(label,percentage,count,mode);
  });
  const clearRow=document.createElement('div');clearRow.style.cssText='display:flex;justify-content:center;gap:16px;align-items:center;margin-top:15px;padding-top:12px;border-top:1px solid #555;';
  const preserveLabel=document.createElement('label'),eraseLabel=document.createElement('label'),preserve=document.createElement('input'),erase=document.createElement('input');
  preserve.type=erase.type='radio';preserve.name=erase.name='bliss-scenery-clear-'+Date.now();preserve.checked=true;
  preserveLabel.append(preserve,document.createTextNode(' Use free space only'));eraseLabel.append(erase,document.createTextNode(' Remove old scenery'));
  preserve.addEventListener('change',refreshCounts);erase.addEventListener('change',refreshCounts);clearRow.append(preserveLabel,eraseLabel);
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:15px;';
  const close=()=>{modalOpen=false;shade.remove();};
  const zero=button('Set Everything to Zero',()=>{rules.forEach((rule,index)=>{rule.percent=0;percentageInputs[index].value='0';});refreshCounts();});
  const generate=()=>{
   core.generateScenery({eraseExisting:erase.checked,rules});close();changed('Scenery generated');
  };
  const generateButton=button('Generate',generate),cancel=button('Cancel',close);generateButton.style.cssText+='min-width:110px;background:#4e5b2b;border-color:#a9bd58;';zero.style.minWidth='150px';cancel.style.cssText+='min-width:105px;';
  actions.append(zero,generateButton,cancel);box.append(heading,intro,table,clearRow,actions);shade.append(box);document.body.append(shade);
  refreshCounts();
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

 function showTrackAnalysis(){
  let analysis:ReturnType<BlissEditorCore['analyze']>;
  try{analysis=core.analyze();}catch(error){void centeredNotice('Track Analysis','Analysis failed: '+String(error));return;}
  if(!analysis.sections.length){void centeredNotice('Track Analysis','A start/finish line is required before the track can be analysed.');return;}
  if(analysis.tooComplex){void centeredNotice('Track Analysis','Track too complex. Bliss supports up to 254 sections and 1000 paths.');return;}
  if(!analysis.paths.length){void centeredNotice('Track Analysis','Track has no valid path.');return;}

  const tileLengths=analysis.paths.map((_,index)=>core.pathLength(analysis,index,false));
  const tokenLengths=analysis.paths.map((_,index)=>core.pathLength(analysis,index,true));
  const winning=analysis.paths.map((path,index)=>({path,index,tiles:tileLengths[index],tokens:tokenLengths[index]})).filter(row=>row.path.finishes);
  const safe=winning.filter(row=>row.path.error===0);
  const cycles=analysis.paths.filter(path=>path.error===82).length;
  const shortestWinning=winning.length?Math.min(...winning.map(row=>row.tiles)):0;
  const shortestSafe=safe.length?Math.min(...safe.map(row=>row.tiles)):0;
  const fastestWinning=winning.length?Math.min(...winning.map(row=>row.tokens)):0;
  const fastestSafe=safe.length?Math.min(...safe.map(row=>row.tokens)):0;
  const estimated=(tokens:number)=>blissTimey(blissEstimatedTimeCentiseconds(tokens,1));

  modalOpen=true;
  const shade=document.createElement('div');shade.tabIndex=-1;shade.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:24px;';
  const box=document.createElement('div');box.style.cssText='width:min(780px,94vw);max-height:88vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #9090ad;color:#eee;padding:18px 20px;box-shadow:0 22px 70px #000;border-radius:6px;font:13px/1.4 system-ui,Segoe UI,sans-serif;';
  const heading=document.createElement('h2');heading.textContent='Track Analysis';heading.style.cssText='text-align:center;font-size:18px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const body=document.createElement('div');body.style.cssText='overflow:auto;';
  let page:'summary'|'paths'='summary';
  const draw=()=>{
   body.replaceChildren();
   if(page==='summary'){
    const table=document.createElement('div');table.style.cssText='display:grid;grid-template-columns:230px minmax(0,1fr);gap:8px 14px;';
    const rows:[string,string][]=[
     ['Total paths',String(analysis.paths.length)],
     ['Winning paths',String(winning.length)],
     ['Shortest winning path',winning.length?shortestWinning+' tiles':'none'],
     ['Estimated winning time',winning.length?estimated(fastestWinning)+' ('+fastestWinning+' tokens)':'—'],
     ['Safe paths',String(safe.length)],
     ['Shortest safe path',safe.length?shortestSafe+' tiles':'none'],
     ['Estimated safe time',safe.length?estimated(fastestSafe)+' ('+fastestSafe+' tokens)':'—'],
     ['Cycles',String(cycles)],
     ['Route errors / warnings',String(analysis.errors.length)],
    ];
    for(const [label,value] of rows){const a=document.createElement('strong'),b=document.createElement('span');a.textContent=label;a.style.color='#c8c8dc';b.textContent=value;b.style.color='#ddd';table.append(a,b);}
    const prognosis=document.createElement('p');
    const fatal=analysis.paths.some(path=>path.error>=70&&path.error<=79);
    prognosis.textContent=winning.length?(fatal?'Prognosis: track contains a path-flow error.':'Prognosis: at least one winning path is available.'):'Prognosis: no winning path.';
    prognosis.style.cssText='margin:16px 0 0;color:'+(winning.length?'#b9d88c':'#ffbd7a')+';';
    const note=document.createElement('p');note.textContent='Opponent path = shortest winning path by Stunts tile count. Fastest = lowest Bliss weighted token count. Time uses Bliss default Porsche March Indy calibration (7.2955).';note.style.cssText='margin:8px 0 0;color:#aaa;';
    body.append(table,prognosis,note);
   }else{
    const table=document.createElement('div');table.style.cssText='display:grid;gap:4px;';
    analysis.paths.forEach((path,index)=>{
     const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:48px 92px 115px 92px 105px minmax(120px,1fr);gap:8px;padding:7px 8px;border:1px solid #3d3d55;background:#111126;';
     const labels:string[]=[];
     if(path.finishes&&tileLengths[index]===shortestWinning)labels.push("opp's path");
     if(path.finishes&&tokenLengths[index]===fastestWinning)labels.push('Fastest');
     const statusText=path.finishes?(path.error===0?'Complete, safe':'Complete, with warnings'):(path.error===72?'Incomplete, wrong way':path.error===82?'Incomplete, cyclic':'Incomplete');
     const values=['#'+(index+1),tileLengths[index]+' tiles',estimated(tokenLengths[index]),tokenLengths[index]+' tokens',statusText,labels.join(' · ')];
     values.forEach((value,column)=>{const span=document.createElement(column===0?'strong':'span');span.textContent=value;row.append(span);});table.append(row);
    });
    body.append(table);
   }
  };
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:14px;';
  const pathsButton=button('See paths',()=>{page=page==='summary'?'paths':'summary';pathsButton.textContent=page==='summary'?'See paths':'Main page';draw();});
  const close=()=>{modalOpen=false;shade.remove();},closeButton=button('Close',close);
  actions.append(pathsButton,closeButton);box.append(heading,body,actions);shade.append(box);document.body.append(shade);draw();
  shade.addEventListener('keydown',event=>{if(event.code==='Escape'){event.preventDefault();close();}});
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)close();});requestAnimationFrame(()=>shade.focus());
 }

 function showHelp(initial:0|1){
  let helpPage=initial;
  const shade=document.createElement('div');shade.style.cssText='position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:30px;';
  const box=document.createElement('div');box.style.cssText='width:min(760px,90vw);max-height:88vh;overflow:auto;background:#1e1e34;border:2px solid #80809a;color:#ddd;padding:18px 22px;box-shadow:0 18px 60px #000;font:14px/1.35 ui-monospace,Consolas,monospace;';
  const heading=document.createElement('h2');heading.style.cssText='text-align:center;font-size:16px;margin:0 0 12px;border-bottom:1px solid #aaa;padding-bottom:8px;';
  const table=document.createElement('div');table.style.cssText='display:grid;grid-template-columns:120px 1fr;column-gap:18px;row-gap:2px;';
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:16px;';
  const optionsButton=button('Option keys',()=>{helpPage=0;draw();}),tilesButton=button('Tile shortcuts',()=>{helpPage=1;draw();}),close=button('Back',()=>shade.remove());
  actions.append(optionsButton,tilesButton,close);box.append(heading,table,actions);shade.append(box);document.body.append(shade);
  const draw=()=>{heading.textContent=helpPage===0?'Help — Option keys':'Help — Tile shortcuts';table.replaceChildren();for(const [keyName,description] of helpPage===0?OPTION_HELP:TILE_HELP){const a=document.createElement('span'),b=document.createElement('span');a.textContent=keyName;a.style.color='#d7d76a';b.textContent=description;b.style.color='#aaaaff';table.append(a,b);}setActive(optionsButton,helpPage===0);setActive(tilesButton,helpPage===1);};
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)shade.remove();});draw();
 }

 async function takeTrackShot(){
  const full=document.createElement('canvas');full.width=BLISS_ORIGINAL_MAP_SIZE;full.height=BLISS_ORIGINAL_MAP_SIZE;
  full.getContext('2d',{alpha:false})!.putImageData(blissOriginalMapImageData(core.track,host.resources,host.palette,showGrid),0,0);
  const selection=core.selection,shot=document.createElement('canvas');
  if(selection){
   shot.width=selection.width*16;shot.height=selection.height*16;
   shot.getContext('2d',{alpha:false})!.drawImage(full,selection.x*16,selection.y*16,shot.width,shot.height,0,0,shot.width,shot.height);
  }else{shot.width=full.width;shot.height=full.height;shot.getContext('2d',{alpha:false})!.drawImage(full,0,0);}
  const blob=await new Promise<Blob|null>(resolve=>shot.toBlob(resolve,'image/png'));if(!blob){status.textContent='Could not create track-shot.';return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(host.track.name||'TRACK')+'-trackshot.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Track-shot exported'+(selection?' from selected region':'')+'.';status.style.color='#aee18a';
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
 async function finish(){
  if(closed)return;
  if(core.modified){
   const choice=await confirmExitChoice();
   if(choice==='cancel')return;
   if(choice==='save'&&!await saveTrack())return;
  }
  closed=true;cleanup();resolveDone?.();
 }
 const cleanup=()=>{core.endStroke();manualHexDeadline=0;window.removeEventListener('keydown',keyDown,true);setBlissEditorActive(false);overlay.remove();};
 let resolveDone:(()=>void)|undefined;
 renderPalette();renderScenery();renderMap();renderStatus();updateArea();overlay.focus();requestAnimationFrame(()=>fitMap());
 await new Promise<void>(resolve=>{resolveDone=resolve;});cleanup();
}
