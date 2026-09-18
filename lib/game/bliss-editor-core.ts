// Native editor state built around the Bliss 2.6.1 behaviour port.
// This is the integration seam for the future React/Tauri editor UI.
import {decodeBlissTrack,encodeBlissTrack,cloneBlissTrack,type BlissTrack} from './bliss-track.ts';
import {BlissHistory} from './bliss-history.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';
import {clearBlissTrackElement,dryBlissTerrain,floodBlissTerrain,lowerBlissTerrain,placeBlissTrackElement,raiseBlissTerrain} from './bliss-edit.ts';
import {captureBlissRegion,cutBlissRegion,hflipBlissRegion,pasteBlissRegion,rotateBlissRegionClockwise,rotateBlissRegionCounterClockwise,vflipBlissRegion,type BlissRegion} from './bliss-region.ts';

export interface BlissSelection {x:number;y:number;width:number;height:number}

export class BlissEditorCore {
 track:BlissTrack;
 readonly history:BlissHistory;
 clipboard:BlissRegion|null=null;
 selection:BlissSelection|null=null;
 modified=false;
 constructor(track:BlissTrack,readonly definitions:BlissTransformations=blissTransformations,historyDepth=30){
  this.track=cloneBlissTrack(track);this.history=new BlissHistory(historyDepth);
 }
 static fromBytes(bytes:Uint8Array,definitions:BlissTransformations=blissTransformations){return new BlissEditorCore(decodeBlissTrack(bytes),definitions);}
 serialize(){return encodeBlissTrack(this.track);}
 private change(action:()=>void){const before=cloneBlissTrack(this.track);action();this.history.push(before);this.modified=true;}
 markSaved(){this.modified=false;}
 setSelection(selection:BlissSelection|null){
  if(selection){captureBlissRegion(this.track,selection.x,selection.y,selection.width,selection.height);}
  this.selection=selection?{...selection}:null;
 }
 place(x:number,y:number,code:number,allowErrors=false){const before=cloneBlissTrack(this.track),placed=placeBlissTrackElement(this.track,x,y,code,this.definitions,{allowErrors});if(placed){this.history.push(before);this.modified=true;}return placed;}
 clear(x:number,y:number,allowErrors=false){const before=cloneBlissTrack(this.track),changed=clearBlissTrackElement(this.track,x,y,this.definitions,{allowErrors});if(changed){this.history.push(before);this.modified=true;}return changed;}
 flood(x:number,y:number){this.change(()=>floodBlissTerrain(this.track,x,y));}
 dry(x:number,y:number){this.change(()=>dryBlissTerrain(this.track,x,y));}
 raise(x:number,y:number){this.change(()=>raiseBlissTerrain(this.track,x,y));}
 lower(x:number,y:number){this.change(()=>lowerBlissTerrain(this.track,x,y));}
 copySelection(){if(!this.selection)return null;const s=this.selection;this.clipboard=captureBlissRegion(this.track,s.x,s.y,s.width,s.height);return this.clipboard;}
 cutSelection(options:{track?:boolean;terrain?:boolean}={}){if(!this.selection)return null;const s=this.selection;this.change(()=>{this.clipboard=cutBlissRegion(this.track,s.x,s.y,s.width,s.height,options);});return this.clipboard;}
 paste(x:number,y:number,options:{track?:boolean;terrain?:boolean}={}){if(!this.clipboard)return false;this.change(()=>pasteBlissRegion(this.track,x,y,this.clipboard!,options));return true;}
 hflipSelection(){if(!this.selection)return false;const s=this.selection,region=hflipBlissRegion(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 vflipSelection(){if(!this.selection)return false;const s=this.selection,region=vflipBlissRegion(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 rotateSelectionClockwise(){if(!this.selection)return false;const s=this.selection;if(s.width!==s.height)throw Error('In-place Bliss rotation requires a square selection');const region=rotateBlissRegionClockwise(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 rotateSelectionCounterClockwise(){if(!this.selection)return false;const s=this.selection;if(s.width!==s.height)throw Error('In-place Bliss rotation requires a square selection');const region=rotateBlissRegionCounterClockwise(captureBlissRegion(this.track,s.x,s.y,s.width,s.height),this.definitions);this.change(()=>pasteBlissRegion(this.track,s.x,s.y,region));return true;}
 hflipClipboard(){if(!this.clipboard)return false;this.clipboard=hflipBlissRegion(this.clipboard,this.definitions);return true;}
 vflipClipboard(){if(!this.clipboard)return false;this.clipboard=vflipBlissRegion(this.clipboard,this.definitions);return true;}
 rotateClipboardClockwise(){if(!this.clipboard)return false;this.clipboard=rotateBlissRegionClockwise(this.clipboard,this.definitions);return true;}
 rotateClipboardCounterClockwise(){if(!this.clipboard)return false;this.clipboard=rotateBlissRegionCounterClockwise(this.clipboard,this.definitions);return true;}
 undo(){const previous=this.history.undo(this.track);if(!previous)return false;this.track=previous;this.modified=true;return true;}
 redo(){const next=this.history.redo(this.track);if(!next)return false;this.track=next;this.modified=true;return true;}
}
