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
