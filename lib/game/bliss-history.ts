// Native PlayStunts DX port support for Bliss-style undo/redo.
// Bliss uses 30 snapshots; this keeps the same user-visible history depth.
import {cloneBlissTrack,type BlissTrack} from './bliss-track.ts';

export class BlissHistory {
 private readonly undoStack:BlissTrack[]=[];
 private readonly redoStack:BlissTrack[]=[];
 constructor(readonly capacity=30){if(!Number.isInteger(capacity)||capacity<1)throw Error('Bliss history capacity must be positive');}
 get canUndo(){return this.undoStack.length>0;}
 get canRedo(){return this.redoStack.length>0;}
 get undoCount(){return this.undoStack.length;}
 get redoCount(){return this.redoStack.length;}
 clear(){this.undoStack.length=0;this.redoStack.length=0;}
 push(source:BlissTrack){
  this.undoStack.push(cloneBlissTrack(source));
  if(this.undoStack.length>this.capacity)this.undoStack.shift();
  this.redoStack.length=0;
 }
 undo(current:BlissTrack){
  const previous=this.undoStack.pop();if(!previous)return null;
  this.redoStack.push(cloneBlissTrack(current));
  if(this.redoStack.length>this.capacity)this.redoStack.shift();
  return cloneBlissTrack(previous);
 }
 redo(current:BlissTrack){
  const next=this.redoStack.pop();if(!next)return null;
  this.undoStack.push(cloneBlissTrack(current));
  if(this.undoStack.length>this.capacity)this.undoStack.shift();
  return cloneBlissTrack(next);
 }
}
