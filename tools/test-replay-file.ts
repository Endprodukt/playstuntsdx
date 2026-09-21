import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeOriginalReplayFile,encodeOriginalReplayFile} from '../lib/game/replay-file.ts';

const oldReplay=(count=3)=>{const bytes=new Uint8Array(0x722+count);bytes.set([67,79,85,78]);new DataView(bytes.buffer).setUint16(22,count,true);bytes.fill(1,0x722);return bytes;};
const newReplay=(count=3)=>{const bytes=new Uint8Array(0x724+count);bytes.set([67,79,85,78]);const v=new DataView(bytes.buffer);v.setUint16(22,20,true);v.setUint16(24,count,true);bytes.fill(1,0x724);return bytes;};

test('decodes old24 replay files',()=>{
 const replay=decodeOriginalReplayFile(oldReplay(5));
 assert.equal(replay.format,'old24');assert.equal(replay.frequencyHz,20);assert.equal(replay.header.length,24);assert.equal(replay.inputs.length,5);
 assert.deepEqual(encodeOriginalReplayFile(replay),oldReplay(5));
});

test('decodes common new26 replay files while keeping a 24-byte race configuration',()=>{
 const bytes=newReplay(5),replay=decodeOriginalReplayFile(bytes);
 assert.equal(replay.format,'new26');assert.equal(replay.frequencyHz,20);assert.equal(replay.header.length,24);assert.equal(replay.inputs.length,5);
 assert.deepEqual(encodeOriginalReplayFile(replay),bytes);
});
