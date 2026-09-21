import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeReplayBytes,decodeReplayInput,OLD_INPUT_OFFSET,NEW_INPUT_OFFSET} from './replay-dataset.mjs';

test('decodes the common 1991+ 26-byte replay format',()=>{
 const inputs=Uint8Array.from([0x01,0x06,0x09,0x10,0x20]);
 const bytes=new Uint8Array(NEW_INPUT_OFFSET+inputs.length);
 bytes.set([67,79,85,78],0);bytes[4]=2;bytes[5]=1;bytes[6]=3;bytes.set([80,79,82,83],7);bytes.set(Buffer.from('ZCT282'),13);
 const view=new DataView(bytes.buffer);view.setUint16(22,20,true);view.setUint16(24,inputs.length,true);
 bytes[26+900]=17;bytes[26+901+900]=29;bytes.set(inputs,NEW_INPUT_OFFSET);
 const replay=decodeReplayBytes(bytes,'TEST.RPL');
 assert.equal(replay.format,'new');assert.equal(replay.frequencyHz,20);assert.equal(replay.header.carId,'COUN');assert.equal(replay.header.trackName,'ZCT282');
 assert.equal(replay.header.opponentSelected,3);assert.equal(replay.header.opponentCarId,'PORS');assert.equal(replay.frameCount,5);
 assert.equal(replay.track.horizon,17);assert.equal(replay.terrain.trailing,29);
 assert.equal(replay.frames[0].throttle,1);assert.equal(replay.frames[1].steer,'right');assert.equal(replay.frames[1].brake,1);assert.equal(replay.frames[2].steer,'left');assert.equal(replay.frames[2].throttle,1);
 assert.equal(replay.frames[3].shiftUp,1);assert.equal(replay.frames[4].shiftDown,1);
});

test('still decodes the older 24-byte replay format',()=>{
 const inputs=Uint8Array.from([0x01,0x09,0x02]);
 const bytes=new Uint8Array(OLD_INPUT_OFFSET+inputs.length);
 bytes.set([74,65,71,85],0);bytes.set(Buffer.from('OLDTRACK'),13);
 new DataView(bytes.buffer).setUint16(22,inputs.length,true);
 bytes[24+900]=7;bytes[24+901+900]=11;bytes.set(inputs,OLD_INPUT_OFFSET);
 const replay=decodeReplayBytes(bytes,'OLD.RPL');
 assert.equal(replay.format,'old');assert.equal(replay.frequencyHz,20);assert.equal(replay.frameCount,3);assert.equal(replay.track.horizon,7);assert.equal(replay.terrain.trailing,11);
});

test('reports ignored high bits without treating them as controls',()=>{
 assert.deepEqual(decodeReplayInput(0xc3),{raw:0xc3,throttle:0,brake:0,driveConflict:1,steer:'center',steerValue:0,shiftUp:0,shiftDown:0,ignoredMask:0xc0});
});
