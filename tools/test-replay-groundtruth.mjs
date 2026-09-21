import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRestuntsDump,RESTUNTS_GAMESTATE_BYTES,RESTUNTS_PLAYER_OFFSET} from './replay-groundtruth.mjs';

test('parses packed Restunts GAMESTATE telemetry at documented offsets',()=>{
 const frames=2,bytes=new Uint8Array(2+frames*RESTUNTS_GAMESTATE_BYTES),view=new DataView(bytes.buffer);view.setUint16(0,frames,true);
 const decoded={frameCount:frames,frequencyHz:20,frames:[{raw:1,throttle:1,brake:0,driveConflict:0,steer:'center',steerValue:0,shiftUp:0,shiftDown:0},{raw:9,throttle:1,brake:0,driveConflict:0,steer:'left',steerValue:-1,shiftUp:0,shiftDown:0}],track:{grid:Array(900).fill(0)}};
 for(let i=0;i<frames;i++){const state=2+i*RESTUNTS_GAMESTATE_BYTES,p=state+RESTUNTS_PLAYER_OFFSET;view.setUint16(state+0x140,i+1,true);view.setInt32(p,65536*(2+i),true);view.setInt32(p+4,640,true);view.setInt32(p+8,65536*3,true);view.setInt16(p+0x20,100+i,true);view.setInt16(p+0x22,4000+i,true);view.setUint16(p+0x2a,256*(50+i),true);view.setUint16(p+0x2c,256*(49+i),true);bytes[p+0xbe]=3;bytes[p+0xc2]=1;bytes[p+0xc3]=1;bytes[p+0xc4]=4;bytes[p+0xc5]=4;bytes[p+0xc7]=i;}
 const result=parseRestuntsDump(bytes,decoded);assert.equal(result.declared,2);assert.equal(result.samples[0].stateFrame,1);assert.equal(result.samples[1].stateFrame,2);assert.equal(result.samples[0].x,1024);assert.equal(result.samples[0].y,10);assert.equal(result.samples[0].speed/256,50);assert.equal(result.samples[0].gear,3);assert.deepEqual(result.samples[0].surfaces,[1,1,4,4]);assert.equal(result.samples[1].steer,-1);assert.equal(result.samples[1].sliding,1);
});
