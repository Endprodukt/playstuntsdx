// Native editor state built around the Bliss 2.6.1 behaviour port.
// This is the integration seam for the future React/Tauri editor UI.
import {createBlissTrack,decodeBlissTrack,encodeBlissTrack,cloneBlissTrack,type BlissTrack} from './bliss-track.ts';
import {BlissHistory} from './bliss-history.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';
import {clearBlissTrackElement,dryBlissTerrain,floodBlissTerrain,lowerBlissTerrain,placeBlissTrackElement,raiseBlissTerrain} from './bliss-edit.ts';
import {captureBlissRegion,cutBlissRegion,hflipBlissRegion,pasteBlissRegion,rotateBlissRegionClockwise,rotateBlissRegionCounterClockwise,vflipBlissRegion,type BlissRegion} from './bliss-region.ts';
import {buildBlissClosedCircuit,linkBlissTiles} from './bliss-smart-tools.ts';
import {analyzeBlissRoute,blissPathLength,checkBlissTrack} from './bliss-route.ts';
import {detectBlissNonStunts,detectBlissTerrainError,findBlissStart,listBlissCompatibilityIssues} from './bliss-validation.ts';
import {blissTrackMetadata,setBlissTrackMetadata,type BlissMetadata,type BlissMetadataFormat} from './bliss-metadata.ts';
import {generateBlissScenery,type BlissSceneryGeneratorConfig} from './bliss-scenery-generator.ts';

export interface BlissSelection {x:number;y:number;width:number;height:number}

export class BlissEditorCore {
 track:BlissTrack;
 readonly history:BlissHistory;
 clipboard:BlissRegion|null=null;
 selection:BlissSelection|null=null;
 modified=false;
 private strokeBefore:BlissTrack|null=null;
 private strokeChanged=false;
 constructor(track:BlissTrack,readonly definitions:BlissTransformations=blissTransformations,historyDepth=30){
  this.track=cloneBlissTrack(track);this.history=new BlissHistory(historyDepth);
 }
 static fromBytes(bytes:Uint8Array,definitions:BlissTransformations=blissTransformations){return new BlissEditorCore(decodeBlissTrack(bytes),definitions);}
 serialize(){return encodeBlissTrack(this.track);}
 loadBytes(bytes:Uint8Array){
  this.track=decodeBlissTrack(bytes);this.history.clear();this.clipboard=null;this.selection=null;this.strokeBefore=null;this.strokeChanged=false;this.modified=false;
 }
 private record(before:BlissTrack){
  if(this.strokeBefore)this.strokeChanged=true;
  else this.history.push(before);
  this.modified=true;
 }
 private change(action:()=>void){const before=cloneBlissTrack(this.track);action();this.record(before);}
 beginStroke(){if(!this.strokeBefore){this.strokeBefore=cloneBlissTrack(this.track);this.strokeChanged=false;}}
 endStroke(){
  if(!this.strokeBefore)return;
  if(this.strokeChanged)this.history.push(this.strokeBefore);
  this.strokeBefore=null;this.strokeChanged=false;
 }
 markSaved(){this.modified=false;}
 newTrack(options:{landscape?:number;format?:number;terrain?:ArrayLike<number>}={}){
  const next=createBlissTrack(options.landscape??4,options.format??152);
  if(options.terrain){
   if(options.terrain.length<900)throw Error('New Bliss terrain preset must contain at least 900 cells');
   for(let i=0;i<900;i++)next.terrain[i]=options.terrain[i];
  }
  this.track=next;this.history.clear();this.clipboard=null;this.selection=null;this.strokeBefore=null;this.strokeChanged=false;this.modified=true;
 }
 analyze(){return analyzeBlissRoute(this.track,this.definitions);}
 pathLength(analysis:ReturnType<typeof analyzeBlissRoute>,pathIndex:number,weighted=false){return blissPathLength(this.track,analysis,pathIndex,weighted,this.definitions);}
 check(){return checkBlissTrack(this.track);}
 compatibility(){return detectBlissNonStunts(this.track,this.definitions);}
 warnings(){return listBlissCompatibilityIssues(this.track,this.definitions);}
 terrainError(){return detectBlissTerrainError(this.track);}
 start(){return findBlissStart(this.track);}
 metadata(){return blissTrackMetadata(this.track);}
 setMetadata(metadata:BlissMetadata|null,format:BlissMetadataFormat='binary'){this.change(()=>setBlissTrackMetadata(this.track,metadata,format));}
 generateScenery(config:BlissSceneryGeneratorConfig){
  const next=generateBlissScenery(this.track,config);
  this.change(()=>{this.track.track.set(next.track);});
 }
 setSelection(selection:BlissSelection|null){
  if(selection){captureBlissRegion(this.track,selection.x,selection.y,selection.width,selection.height);}
  this.selection=selection?{...selection}:null;
 }
 place(x:number,y:number,code:number,allowErrors=false){const before=cloneBlissTrack(this.track),placed=placeBlissTrackElement(this.track,x,y,code,this.definitions,{allowErrors});if(placed)this.record(before);return placed;}
 previewPlace(x:number,y:number,code:number,allowErrors=false){const preview=cloneBlissTrack(this.track);return placeBlissTrackElement(preview,x,y,code,this.definitions,{allowErrors})?preview:null;}
 clear(x:number,y:number,allowErrors=false){const before=cloneBlissTrack(this.track),changed=clearBlissTrackElement(this.track,x,y,this.definitions,{allowErrors});if(changed)this.record(before);return changed;}
 flood(x:number,y:number){this.change(()=>floodBlissTerrain(this.track,x,y));}
 dry(x:number,y:number){this.change(()=>dryBlissTerrain(this.track,x,y));}
 raise(x:number,y:number){this.change(()=>raiseBlissTerrain(this.track,x,y));}
 lower(x:number,y:number){this.change(()=>lowerBlissTerrain(this.track,x,y));}
 setLandscape(landscape:number){
  if(!Number.isInteger(landscape)||landscape<0||landscape>4)throw Error('Bliss landscape must be between 0 and 4');
  if(this.track.landscape===landscape)return false;
  const before=cloneBlissTrack(this.track);this.track.landscape=landscape;this.record(before);return true;
 }
 paintTerrain(x:number,y:number,code:number){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=30||y<0||y>=30)throw Error(`Track coordinates out of range: ${x},${y}`);
  if(!Number.isInteger(code)||code<0||code>255)throw Error(`Invalid terrain code: ${code}`);
  const index=y*30+x;if(this.track.terrain[index]===code)return false;
  const before=cloneBlissTrack(this.track);this.track.terrain[index]=code;this.record(before);return true;
 }
 link(x:number,y:number){const before=cloneBlissTrack(this.track),code=linkBlissTiles(this.track,x,y,this.definitions);if(code!==null)this.record(before);return code;}
 buildClosedCircuit(currentBrush:number){if(!this.selection)return false;const s=this.selection,before=cloneBlissTrack(this.track),built=buildBlissClosedCircuit(this.track,{x1:s.x,y1:s.y,x2:s.x+s.width-1,y2:s.y+s.height-1},currentBrush,this.definitions);if(built)this.record(before);return built;}
 copySelection(){if(!this.selection)return null;const s=this.selection;this.clipboard=captureBlissRegion(this.track,s.x,s.y,s.width,s.height);return this.clipboard;}
 cutSelection(options:{track?:boolean;terrain?:boolean}={}){if(!this.selection)return null;const s=this.selection;this.change(()=>{this.clipboard=cutBlissRegion(this.track,s.x,s.y,s.width,s.height,options);});return this.clipboard;}
 deleteSelection(options:{track?:boolean;terrain?:boolean}={}){
  if(!this.selection)return false;const s=this.selection,affectTrack=options.track!==false,affectTerrain=options.terrain===true;
  this.change(()=>{for(let y=s.y;y<s.y+s.height;y++)for(let x=s.x;x<s.x+s.width;x++){const index=y*30+x;if(affectTrack)this.track.track[index]=0;if(affectTerrain)this.track.terrain[index]=0;}});
  this.selection=null;return true;
 }
 paste(x:number,y:number,options:{track?:boolean;terrain?:boolean}={}){if(!this.clipboard)return false;this.change(()=>pasteBlissRegion(this.track,x,y,this.clipboard!,options));return true;}
 previewPaste(x:number,y:number,options:{track?:boolean;terrain?:boolean}={}){
  if(!this.clipboard)return null;
  if(x<0||y<0||x+this.clipboard.width>30||y+this.clipboard.height>30)return null;
  const preview=cloneBlissTrack(this.track);pasteBlissRegion(preview,x,y,this.clipboard,options);return preview;
 }
 clipboardSize(){return this.clipboard?{width:this.clipboard.width,height:this.clipboard.height}:null;}
 clearClipboard(){this.clipboard=null;}
 hflipSelection(){if(!this.selection)return false;const s=this.selection,region=hflipBlissRegion(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 vflipSelection(){if(!this.selection)return false;const s=this.selection,region=vflipBlissRegion(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 rotateSelectionClockwise(){if(!this.selection)return false;const s=this.selection;if(s.width!==s.height)throw Error('In-place Bliss rotation requires a square selection');const region=rotateBlissRegionClockwise(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 rotateSelectionCounterClockwise(){if(!this.selection)return false;const s=this.selection;if(s.width!==s.height)throw Error('In-place Bliss rotation requires a square selection');const region=rotateBlissRegionCounterClockwise(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 hflipClipboard(){if(!this.clipboard)return false;this.clipboard=hflipBlissRegion(this.clipboard,this.definitions);return true;}
 vflipClipboard(){if(!this.clipboard)return false;this.clipboard=vflipBlissRegion(this.clipboard,this.definitions);return true;}
 rotateClipboardClockwise(){if(!this.clipboard)return false;this.clipboard=rotateBlissRegionClockwise(this.clipboard,this.definitions);return true;}
 rotateClipboardCounterClockwise(){if(!this.clipboard)return false;this.clipboard=rotateBlissRegionCounterClockwise(this.clipboard,this.definitions);return true;}
 undo(){this.endStroke();const previous=this.history.undo(this.track);if(!previous)return false;this.track=previous;this.modified=true;return true;}
 redo(){this.endStroke();const next=this.history.redo(this.track);if(!next)return false;this.track=next;this.modified=true;return true;}
}
