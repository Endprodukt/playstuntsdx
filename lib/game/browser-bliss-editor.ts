import {BlissEditorCore} from './bliss-editor-core.ts';
import {blissElementData,blissPalettePages} from './bliss-element-data.ts';
import {blissOriginalMapImageData,blissOriginalPaletteImageData,type BlissOriginalMapResources,BLISS_ORIGINAL_MAP_SIZE} from './bliss-original-map.ts';
import {encodeBlissTrack} from './bliss-track.ts';
import {blissParentElement} from './bliss-edit.ts';
import {blissTrackHash} from './bliss-track.ts';
import {changeBlissMaterial,findBlissElementByName,smartSelectBliss} from './bliss-shortcuts.ts';
import {transformBlissTerrainCode,transformBlissTrackCode,type BlissTransformOperation} from './bliss-transformations.ts';
import {BLISS_TOOL_ICON_COLUMNS,BLISS_TOOL_ICON_SIZE,BLISS_TOOL_ICON_SPRITE} from './bliss-tool-icons.ts';
import {setBlissEditorActive} from './bliss-editor-presence.ts';

export interface BrowserBlissEditorHost {
 canvas:HTMLCanvasElement;
 track:{name:string;path:string;raw:number[]};
 palette:ReadonlyArray<number>;
 resources:BlissOriginalMapResources;
 writeTrack(path:string,name:string,bytes:Uint8Array):Promise<number>;
 clearScores(path:string,name:string):Promise<void>;
 exists(path:string,name:string):Promise<boolean>;
 customTrackExists?(name:string):Promise<boolean>;
 persistCustomTrack?(name:string,bytes:Uint8Array):Promise<string>;
 enumerateTracks?():Promise<string[]>;
 readTrack?(path:string,name:string):Promise<Uint8Array>;
 presets?:readonly {terrain:number[]}[];
}

type Tool='place'|'erase'|'link'|'flood'|'dry'|'raise'|'lower'|'terrain';
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
 {name:'Track Information',description:'Bliss metadata editor for title, author and comments. Port still pending.'},
 {name:'Undo',shortcut:'Ctrl+Z',description:'Undo the previous edit stroke or operation.'},
 {name:'Redo',shortcut:'Ctrl+Y',description:'Redo the last undone edit.'},
 {name:'Help',shortcut:'F1 on palette 1',description:'Show Bliss option keys and tile shortcuts.'},
 {name:'Generate Scenery',description:'Automatic Bliss scenery generator. Port still pending.'},
 {name:'Track Analysis',description:'Analyse route sections, paths and track errors.'},
 {name:'Tournaments',description:'Bliss tournament integration. Not used by PlayStunts DX.'},
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
const EDIT_TOOL_HELP:Record<Tool,HoverHelp>={
 place:{name:'Place',shortcut:'Left click / Enter',description:'Place the currently selected track element.'},
 erase:{name:'Erase',shortcut:'Right click / Del',description:'Remove the track element at the cursor.'},
 link:{name:'Auto link',shortcut:'U',description:'Choose and place the track element that connects neighbouring pieces.'},
 flood:{name:'Flood',shortcut:'F12 Water + left click',description:'Raise the water brush at this point; Bliss completes unfinished edges.'},
 dry:{name:'Dry',shortcut:'F12 Water + right click',description:'Remove water at this point; Bliss repairs the surrounding edges.'},
 raise:{name:'Raise',shortcut:'F12 Mountain + left click',description:'Raise mountain terrain with the Bliss brush.'},
 lower:{name:'Lower',shortcut:'F12 Mountain + right click',description:'Lower mountain terrain with the Bliss brush.'},
 terrain:{name:'Terrain tile',shortcut:'F11',description:'Directly place the selected terrain tile from palette page 11.'},
};

/** Native PlayStunts DX shell for the Bliss 2.6.1 port.
 * Track/terrain art comes from the user's Stunts data. Behaviour and shortcuts
 * intentionally follow Bliss so experienced Bliss users can work by muscle memory. */
export async function runBrowserBlissEditor(host:BrowserBlissEditorHost){
 const core=BlissEditorCore.fromBytes(Uint8Array.from(host.track.raw));
 let tool:Tool='place',brush=4,terrainBrush=0,page=0,cellX=0,cellY=0,painting=false,selecting=false,selectionAnchor:{x:number;y:number}|null=null,closed=false,zoom=1;
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
 const landscapeImages=[
  '/site/enhanced-backgrounds/desert-overview.png',
  '/site/enhanced-backgrounds/tropical-overview.png',
  '/site/enhanced-backgrounds/alpine-overview.png',
  '/site/enhanced-backgrounds/city-overview.png',
  '/site/enhanced-backgrounds/country-overview.png',
 ] as const;
 const sceneryBox=document.createElement('div');sceneryBox.style.cssText='border-top:1px solid #2d2d2d;padding-top:8px;';
 const sceneryTitle=document.createElement('div');sceneryTitle.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11px;color:#aaa;';
 const sceneryLabel=document.createElement('strong');sceneryLabel.textContent='Background / Scenery';sceneryLabel.style.color='#ddd';
 const sceneryCurrent=document.createElement('span');
 const sceneryPreview=document.createElement('img');sceneryPreview.alt='Selected Stunts background';sceneryPreview.style.cssText='display:block;width:100%;height:92px;object-fit:cover;object-position:center;border:1px solid #353535;background:#070707;margin-bottom:6px;image-rendering:auto;';
 sceneryPreview.addEventListener('error',()=>{sceneryPreview.style.display='none';});
 sceneryPreview.addEventListener('load',()=>{sceneryPreview.style.display='block';});
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
  const nextSource=landscapeImages[selected];
  if(!sceneryPreview.src.endsWith(nextSource))sceneryPreview.src=nextSource;
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
 const toolHint=document.createElement('div');toolHint.style.cssText='min-height:54px;margin:0 0 8px;padding:7px 8px;border:1px solid #34344a;background:#0c0c17;color:#bdbdd0;border-radius:4px;font:11px/1.35 system-ui,Segoe UI,sans-serif;';
 const defaultToolHint='Hover a Bliss tool to see what it does and its shortcut.';
 const showToolHint=(help:HoverHelp)=>{
  const shortcut=help.shortcut?(' · Shortcut: '+help.shortcut):'';
  toolHint.innerHTML='<strong style="color:#fff">'+help.name+'</strong><span style="color:#d6c95f">'+shortcut+'</span><br><span>'+help.description+'</span>';
 };
 const clearToolHint=()=>{toolHint.textContent=defaultToolHint;};
 clearToolHint();
 const attachHoverHelp=(control:HTMLElement,help:HoverHelp)=>{
  const show=()=>showToolHint(help),hide=()=>clearToolHint();
  control.addEventListener('mouseenter',show);control.addEventListener('focus',show);
  control.addEventListener('mouseleave',hide);control.addEventListener('blur',hide);
 };
 const quick=document.createElement('div');quick.style.cssText='display:grid;grid-template-columns:repeat(4,48px);gap:4px;justify-content:center;padding:6px;background:#17172a;border:1px solid #303047;border-radius:5px;';
 const quickButton=(icon:number,titleText:string,action?:()=>void)=>{
  const help=QUICK_TOOL_HELP[icon]??{name:titleText,description:titleText};
  const control=button('',()=>action?.());control.title=help.name+(help.shortcut?' ('+help.shortcut+')':'');control.setAttribute('aria-label',control.title);
  control.style.cssText+='width:48px;height:48px;padding:1px;display:grid;place-items:center;background:#222238;border-color:#4a4a64;';
  const image=document.createElement('span'),column=icon%BLISS_TOOL_ICON_COLUMNS,row=Math.floor(icon/BLISS_TOOL_ICON_COLUMNS);
  image.style.cssText='display:block;width:'+BLISS_TOOL_ICON_SIZE+'px;height:'+BLISS_TOOL_ICON_SIZE+'px;background-image:url("'+BLISS_TOOL_ICON_SPRITE+'");background-repeat:no-repeat;background-size:'+(BLISS_TOOL_ICON_SIZE*BLISS_TOOL_ICON_COLUMNS)+'px '+(BLISS_TOOL_ICON_SIZE*5)+'px;background-position:-'+(column*BLISS_TOOL_ICON_SIZE)+'px -'+(row*BLISS_TOOL_ICON_SIZE)+'px;image-rendering:pixelated;';
  control.replaceChildren(image);attachHoverHelp(control,help);
  if(!action){control.setAttribute('aria-disabled','true');control.style.opacity='.35';control.style.cursor='help';}
  quick.append(control);return control;
 };
 // Keep Bliss' original 4×5 toolbar order so muscle memory carries over.
 quickButton(0,'New Track',()=>void createNewTrack());
 quickButton(1,'Save Track',()=>void saveTrack());
 quickButton(2,'Load Track',()=>void loadTrack());
 quickButton(3,'Exit Bliss editor',()=>void finish());
 quickButton(4,'Select — same as holding Ctrl',()=>{selectionTool=true;activeArea='grid';updateArea();status.textContent='Selection tool active — drag a region.';});
 quickButton(5,'Copy',()=>copySelection());
 quickButton(6,'Cut',()=>cutSelection());
 quickButton(7,'Paste',()=>startPaste());
 quickButton(8,'Flip whole track / selection horizontally',()=>toolbarFlip(false));
 quickButton(9,'Flip whole track / selection vertically',()=>toolbarFlip(true));
 quickButton(10,'Rotate whole track / selection clockwise',()=>toolbarRotate(false));
 quickButton(11,'Rotate whole track / selection counter-clockwise',()=>toolbarRotate(true));
 quickButton(12,'Track Information — metadata editing port pending');
 quickButton(13,'Undo',()=>{if(core.undo())changed('Undo');});
 quickButton(14,'Redo',()=>{if(core.redo())changed('Redo');});
 quickButton(15,'Help',()=>showHelp(0));
 quickButton(16,'Generate Scenery — port pending');
 quickButton(17,'Track Analysis — paths/errors; racer time estimates pending',()=>showTrackAnalysis());
 quickButton(18,'Tournaments — not used by PlayStunts DX');
 quickButton(19,'Editor Settings — full Bliss settings port pending');

 const switches=document.createElement('div');switches.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:10px;';
 const switchButtons=new Map<string,HTMLButtonElement>();
 const addSwitch=(id:string,label:string,action:()=>void)=>{const b=button(label,action),help=SWITCH_TOOL_HELP[id]??{name:label,description:label};b.title=help.name+(help.shortcut?' ('+help.shortcut+')':'');attachHoverHelp(b,help);switchButtons.set(id,b);switches.append(b);return b;};
 addSwitch('clip','CLIP',()=>{core.clearClipboard();pasteMode=false;renderMap();renderStatus();status.textContent='Clipboard cleared.';});
 addSwitch('warn','WAR',()=>{showConflicts=!showConflicts;renderMap();renderStatus();});
 addSwitch('manual','MAN',()=>{allowConflicts=!allowConflicts;renderStatus();});
 addSwitch('grid','GRID',()=>{showGrid=!showGrid;renderMap();renderStatus();});
 const colourSwitch=addSwitch('colour','COL',()=>{status.textContent='Bliss colouring mode is not ported yet.';status.style.color='#ffbd7a';});
 colourSwitch.disabled=true;colourSwitch.style.opacity='.35';colourSwitch.style.cursor='not-allowed';
 addSwitch('shot','TRK SHOT',()=>void takeTrackShot());
 addSwitch('trk','TRK',()=>{affectTrack=!affectTrack;renderMap();renderStatus();});
 addSwitch('ter','TER',()=>{affectTerrain=!affectTerrain;renderMap();renderStatus();});
 addSwitch('debug','DEB',()=>{debugMode=!debugMode;renderMap();renderStatus();});

 const terrainTools=document.createElement('div');terrainTools.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:10px;';
 const toolButtons=new Map<Tool,HTMLButtonElement>();
 const chooseTool=(next:Tool)=>{tool=next;for(const [key,value] of toolButtons)setActive(value,key===tool);renderStatus();};
 for(const [key,label] of [['place','Place'],['erase','Erase'],['link','Auto link'],['flood','Flood'],['dry','Dry'],['raise','Raise'],['lower','Lower'],['terrain','Terrain tile']] as const){
  const control=button(label,()=>chooseTool(key)),help=EDIT_TOOL_HELP[key];control.title=help.name+(help.shortcut?' ('+help.shortcut+')':'');attachHoverHelp(control,help);toolButtons.set(key,control);terrainTools.append(control);
 }
 const help=document.createElement('p');help.textContent='Bliss keys are active: F/Shift+F, R/Shift+R, F1–F12, Ctrl+C/X/V/W, arrows, Tab, Enter, Del, P, U, C and tile shortcuts.';help.style.cssText='font-size:11px;line-height:1.35;color:#999;margin:10px 0 0;';
 toolsPanel.append(quick,toolHint,switches,terrainTools,help);

 main.append(palettePanel,mapPanel,toolsPanel);

 const footer=document.createElement('div');footer.style.cssText='display:flex;align-items:center;gap:7px;min-width:0;';
 const coords=document.createElement('span');coords.style.cssText='font-size:11px;color:#888;margin-right:auto;';
 const newTrackButton=button('New',()=>{void createNewTrack();});
 const undo=button('Undo',()=>{if(core.undo())changed('Undo');});
 const redo=button('Redo',()=>{if(core.redo())changed('Redo');});
 const validate=button('Check track',()=>checkTrack());
 const save=button('Save',()=>{void saveTrack();});
 const saveAs=button('Save As',()=>{void saveTrack(true);});
 const done=button('Done',()=>{void finish();});
 footer.append(coords,newTrackButton,undo,redo,validate,save,saveAs,done);
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
  undo.disabled=!core.history.canUndo;redo.disabled=!core.history.canRedo;
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
  if(terrain){
   terrainBrush=code;
   if(page===11)chooseTool(code===1?'flood':'raise');else chooseTool('terrain');
  }else{brush=code;chooseTool('place');}
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
   // Bliss F12: water and mountain are brush tools. Left adds, right removes.
   if(terrainBrush===1){if(forceErase||event.button===2)core.dry(p.vx,p.vy);else core.flood(p.vx,p.vy);}
   else if(terrainBrush===6){if(forceErase||event.button===2)core.lower(p.vx,p.vy);else core.raise(p.vx,p.vy);}
  }else if(forceErase||event.button===2||tool==='erase')core.clear(p.x,p.y,allowConflicts);
  else if(tool==='place'){if(core.place(p.x,p.y,brush,allowConflicts))lastPlaced={x:p.x,y:p.y};}
  else if(tool==='link')core.link(p.x,p.y);
  else if(tool==='flood')core.flood(p.vx,p.vy);
  else if(tool==='dry')core.dry(p.vx,p.vy);
  else if(tool==='raise')core.raise(p.vx,p.vy);
  else if(tool==='lower')core.lower(p.vx,p.vy);
  else if(tool==='terrain')core.paintTerrain(p.x,p.y,terrainBrush);
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
  if(code){const parent=blissParentElement(core.track,cellX,cellY,core.definitions);brush=parent.code;page=Math.min(9,Math.max(0,blissPalettePages.findIndex(values=>values.includes(brush))));chooseTool('place');renderPalette();renderStatus();return;}
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
  const result=core.check();status.textContent=result.ok?'Track OK — winning path found':'Track check: '+result.reason+' · error '+result.error;status.style.color=result.ok?'#aee18a':'#ffbd7a';
  if(result.point){cellX=result.point.x;cellY=result.point.y;renderMap();}
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
  const next=smartSelectBliss(core.track,brush,key,direction,lastPlaced,core.definitions);if(next!==brush){brush=next;chooseTool('place');renderPalette();renderStatus();}
 };
 const changeMaterial=()=>{if(page>2)return;const next=changeBlissMaterial(brush);if(next!==brush){brush=next;renderPalette();renderStatus();}};
 const findByName=()=>{
  if(page===11){terrainBrush=terrainBrush===0||terrainBrush>5?1:6;renderPalette();renderStatus();return;}
  const query=window.prompt('Find Bliss element by name:','');if(query===null)return;
  const next=findBlissElementByName(query,brush);if(next!==brush){brush=next;chooseTool('place');renderPalette();renderStatus();}else{status.textContent='No matching element found.';status.style.color='#ffbd7a';}
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
   event.preventDefault();brush=code==='KeyX'?255:code==='KeyY'?254:253;chooseTool('place');renderPalette();renderStatus();return;
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
  if(core.modified&&!window.confirm('Discard the current unsaved changes and load another track?'))return;
  let filenames:string[];
  try{filenames=(await host.enumerateTracks()).filter(value=>/\.trk$/i.test(value)).sort((a,b)=>a.localeCompare(b));}
  catch(error){status.textContent='Could not list tracks: '+String(error);status.style.color='#ff9b9b';return;}
  if(!filenames.length){status.textContent='No tracks found.';status.style.color='#ffbd7a';return;}
  const shade=document.createElement('div');shade.style.cssText='position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:30px;';
  const box=document.createElement('div');box.style.cssText='width:min(560px,90vw);max-height:82vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#1e1e34;border:2px solid #80809a;padding:16px;box-shadow:0 18px 60px #000;';
  const heading=document.createElement('h2');heading.textContent='Load Track';heading.style.cssText='text-align:center;font:16px ui-monospace,Consolas,monospace;margin:0 0 10px;color:#eee;';
  const list=document.createElement('div');list.style.cssText='display:grid;gap:4px;overflow:auto;min-height:120px;max-height:60vh;';
  const close=button('Cancel',()=>shade.remove());
  const choose=async(filename:string)=>{
   const stem=filename.replace(/\.trk$/i,'');
   try{
    const bytes=await host.readTrack!('',stem);if(bytes.length!==1802)throw Error('Track must contain exactly 1802 bytes');
    core.loadBytes(bytes);host.track.name=stem;host.track.path='';host.track.raw=Array.from(bytes);name.textContent=stem+'.TRK';
    cellX=0;cellY=0;lastPlaced=null;core.setSelection(null);shade.remove();renderPalette();renderScenery();renderMap();renderStatus();status.textContent='Loaded '+stem+'.TRK';status.style.color='#aee18a';
   }catch(error){status.textContent='Could not load '+filename+': '+String(error);status.style.color='#ff9b9b';}
  };
  for(const filename of filenames){const entry=button(filename,()=>void choose(filename));entry.style.textAlign='left';entry.style.fontFamily='ui-monospace,Consolas,monospace';list.append(entry);}
  box.append(heading,list,close);shade.append(box);document.body.append(shade);
  shade.addEventListener('pointerdown',event=>{if(event.target===shade)shade.remove();});
 }

 function showTrackAnalysis(){
  const analysis=core.analyze();
  const finishing=analysis.paths.filter(path=>path.finishes).length;
  showTextModal('Track Analysis',[
   'Sections: '+Math.max(0,analysis.sections.length-1),
   'Paths: '+analysis.paths.length,
   'Finishing paths: '+finishing,
   'Errors: '+analysis.errors.length,
   'Too complex: '+(analysis.tooComplex?'yes':'no'),
   analysis.errors.length?'First error: '+analysis.errors[0].error+' at '+(analysis.errors[0].x+1)+','+(analysis.errors[0].y+1):'No route errors detected.',
  ]);
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
  if(core.modified&&!window.confirm('Discard the current unsaved changes and create a new track?'))return;
  const names=['Desert','Tropical','Alpine','City','Country'],current=Math.max(0,Math.min(4,core.track.landscape))+1;
  const answer=window.prompt('New track environment:\n1 Desert\n2 Tropical\n3 Alpine\n4 City\n5 Country',String(current));if(answer===null)return;
  const choice=Number.parseInt(answer.trim(),10)-1;if(!Number.isInteger(choice)||choice<0||choice>4){window.alert('Choose a number from 1 to 5.');return;}
  const preset=host.presets?.[choice]?.terrain;core.newTrack({landscape:choice,format:preset?.[900]??152,terrain:preset});
  host.track.name='';name.textContent='UNTITLED.TRK';cellX=0;cellY=0;page=0;brush=4;terrainBrush=0;lastPlaced=null;core.setSelection(null);chooseTool('place');changed('New '+names[choice]+' track');
 }

 async function requestedTrackName(force=false){
  if(!force&&host.track.name){const isCustom=host.customTrackExists?await host.customTrackExists(host.track.name):true;if(isCustom)return host.track.name;}
  const entered=window.prompt('Track name (maximum 8 characters):',host.track.name||'NEWTRACK');if(entered===null)return null;
  const clean=entered.trim().replace(/[^A-Za-z0-9_-]/g,'_').toUpperCase().slice(0,8);if(!clean){window.alert('Please enter a track name.');return null;}return clean;
 }

 async function saveTrack(forceName=false){
  const target=await requestedTrackName(forceName);if(!target)return false;const savePath='';
  const targetIsCustom=host.customTrackExists?await host.customTrackExists(target):false,targetExists=await host.exists(savePath,target);
  if(host.customTrackExists&&targetExists&&!targetIsCustom){window.alert(target+'.TRK is a supplied track and cannot be replaced through Custom Tracks. Choose another name.');return false;}
  if(targetIsCustom&&(forceName||target!==host.track.name)&&!window.confirm(target+'.TRK already exists in Custom Tracks. Overwrite it?'))return false;
  const bytes=encodeBlissTrack(core.track).subarray(0,1802);let customLocation='';
  try{if(host.persistCustomTrack)customLocation=await host.persistCustomTrack(target,bytes);}catch(error){status.textContent='Could not save to Custom Tracks: '+String(error);status.style.color='#ff9b9b';return false;}
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
 renderPalette();renderScenery();renderMap();renderStatus();chooseTool('place');updateArea();overlay.focus();requestAnimationFrame(()=>fitMap());
 await new Promise<void>(resolve=>{resolveDone=resolve;});cleanup();
}
