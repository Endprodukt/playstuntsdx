import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeReplayBytes,decodeReplayInput,INPUT_OFFSET} from './replay-dataset.mjs';

test('decodes original replay layout and digital controls',()=>{
 const inputs=Uint8Array.from([0x01,0x06,0x09,0x10,0x20]);
 const bytes=new Uint8Array(INPUT_OFFSET+inputs.length+2);
 bytes.set([67,79,85,78],0);bytes[6]=3;bytes.set([80,79,82,83],7);
 new DataView(bytes.buffer).setUint16(22,inputs.length,true);
 bytes[24+900]=17;bytes[24+901+900]=29;bytes.set(inputs,INPUT_OFFSET);bytes.set([0xaa,0xbb],INPUT_OFFSET+inputs.length);
 const replay=decodeReplayBytes(bytes,'TEST.RPL');
 assert.equal(replay.header.carId,'COUN');assert.equal(replay.header.opponentSelected,3);assert.equal(replay.header.opponentCarId,'PORS');
 assert.equal(replay.frameCount,5);assert.equal(replay.trailingBytes,2);assert.equal(replay.track.horizon,17);assert.equal(replay.terrain.trailing,29);
 assert.equal(replay.frames[0].throttle,1);assert.equal(replay.frames[1].steer,'right');assert.equal(replay.frames[1].brake,1);assert.equal(replay.frames[2].steer,'left');assert.equal(replay.frames[2].throttle,1);
 assert.equal(replay.frames[3].shiftUp,1);assert.equal(replay.frames[4].shiftDown,1);
});

test('reports ambiguous/unknown control bits instead of hiding them',()=>{
 assert.deepEqual(decodeReplayInput(0xc3),{raw:0xc3,throttle:0,brake:0,driveConflict:1,steer:'center',steerValue:0,shiftUp:0,shiftDown:0,unknownMask:0xc0});
});
