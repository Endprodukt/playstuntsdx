import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReplayUpload} from '../lib/game/replay-upload.ts';
const oldRecording=(count=3)=>{const bytes=new Uint8Array(0x722+count);bytes.set([67,79,85,78]);new DataView(bytes.buffer).setUint16(22,count,true);bytes.fill(1,0x722);return bytes;};
const newRecording=(count=3)=>{const bytes=new Uint8Array(0x724+count);bytes.set([67,79,85,78]);const v=new DataView(bytes.buffer);v.setUint16(22,20,true);v.setUint16(24,count,true);bytes.fill(1,0x724);return bytes;};
test('imports original bytes into the selected game directory without sharing the input buffer',()=>{
 const bytes=newRecording(),file=prepareReplayUpload('race.rpl',bytes,'C:\\STUNTS');
 assert.equal(file.key,'C:\\STUNTS\\RACE.RPL');assert.deepEqual(file.bytes,bytes);bytes[0]=0;assert.equal(file.bytes[0],67);
});
test('accepts both known replay layouts',()=>{
 for(const bytes of [oldRecording(),newRecording()])assert.doesNotThrow(()=>prepareReplayUpload('race.rpl',bytes,'C:\\'));
});
test('rejects wrong extensions and DOS path injection',()=>{
 for(const name of ['race.trk','../race.rpl','TOOLONGNAME.rpl'])assert.throws(()=>prepareReplayUpload(name,newRecording(),'C:\\'));
});
test('rejects truncated, empty and unsupported-length recordings',()=>{
 for(const bytes of [new Uint8Array(20),newRecording().slice(0,-1),newRecording(0),newRecording(12001)])assert.throws(()=>prepareReplayUpload('race.rpl',bytes,'C:\\'));
});
