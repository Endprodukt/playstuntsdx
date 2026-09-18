import {createBlissTrack} from '../lib/game/bliss-track.ts';
import {buildBlissClosedCircuit} from '../lib/game/bliss-smart-tools.ts';
import {blissSceneryAvailability,blissSceneryDefaults,blissSceneryTargetCount,generateBlissScenery} from '../lib/game/bliss-scenery-generator.ts';

const track=createBlissTrack(4,152);
if(!buildBlissClosedCircuit(track,{x1:5,y1:5,x2:20,y2:20},4))throw Error('could not build scenery smoke circuit');
const rules=blissSceneryDefaults(track.landscape);
for(const rule of rules)rule.percent=0;
const joe=rules.find(rule=>rule.name==="Joe's diner");
if(!joe)throw Error("Joe's diner rule missing");
joe.percent=3;joe.placement='by-road';
const available=blissSceneryAvailability(track,false).byRoad;
const expected=blissSceneryTargetCount(available,3);
let seed=1;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
const generated=generateBlissScenery(track,{eraseExisting:false,rules,random});
const actual=Array.from(generated.track).filter(code=>code>=0xaf&&code<=0xb2).length;
console.log(JSON.stringify({available,percent:3,expected,actual}));
if(actual!==expected)throw Error(`expected ${expected} Joe's diners, got ${actual}`);
