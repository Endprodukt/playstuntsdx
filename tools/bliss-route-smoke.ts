import {createBlissTrack} from '../lib/game/bliss-track.ts';
import {buildBlissClosedCircuit} from '../lib/game/bliss-smart-tools.ts';
import {placeBlissTrackElement} from '../lib/game/bliss-edit.ts';
import {analyzeBlissRoute,checkBlissTrack} from '../lib/game/bliss-route.ts';
import {blissTransformations} from '../lib/game/bliss-transformations.ts';

const track=createBlissTrack(4,152);
if(!buildBlissClosedCircuit(track,{x1:5,y1:5,x2:14,y2:14},4))throw Error('could not build smoke-test circuit');
// Left edge is a north/south paved straight. Replace one tile with the north-facing start line.
placeBlissTrackElement(track,5,9,1,blissTransformations);
const analysis=analyzeBlissRoute(track);
console.log(JSON.stringify({
 sections:analysis.sections.length-1,
 paths:analysis.paths.map(p=>({finishes:p.finishes,error:p.error,sections:p.sections})),
 errors:analysis.errors,
 tooComplex:analysis.tooComplex,
 check:checkBlissTrack(track),
},null,2));
if(analysis.tooComplex)throw Error('simple circuit reported too complex');
if(!analysis.paths.some(path=>path.finishes))throw Error('simple circuit has no winning path');

const splitTrack=createBlissTrack(4,152);
if(!buildBlissClosedCircuit(splitTrack,{x1:5,y1:5,x2:14,y2:14},4))throw Error('could not build split-test circuit');
placeBlissTrackElement(splitTrack,5,9,1,blissTransformations);
// Top T split: entering from west can continue east or take the south shortcut.
placeBlissTrackElement(splitTrack,8,5,82,blissTransformations);
// Bottom T merge: both the east main route and north shortcut continue west.
placeBlissTrackElement(splitTrack,8,14,78,blissTransformations);
for(let y=6;y<14;y++)placeBlissTrackElement(splitTrack,8,y,4,blissTransformations);
const splitAnalysis=analyzeBlissRoute(splitTrack);
const winning=splitAnalysis.paths.filter(path=>path.finishes);
console.log('SPLIT',JSON.stringify({
 sections:splitAnalysis.sections.length-1,
 paths:splitAnalysis.paths.map(path=>({finishes:path.finishes,error:path.error,sections:path.sections,length:path.sections.reduce((sum,section)=>sum+(splitAnalysis.sections[section]?.length??0),0)})),
 errors:splitAnalysis.errors,
 tooComplex:splitAnalysis.tooComplex,
},null,2));
if(splitAnalysis.tooComplex)throw Error('split circuit reported too complex');
if(winning.length!==2)throw Error('expected 2 winning paths, got '+winning.length);
