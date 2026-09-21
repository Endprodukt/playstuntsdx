import test from 'node:test';
import assert from 'node:assert/strict';
import {stepGrip} from '../lib/physics/broderbund-1991/grip.ts';
import {BRODERBUND_1991_FALL_INCREMENTS,BRODERBUND_1991_LANDING_SOUND_THRESHOLD,BRODERBUND_1991_LANDING_CRASH_THRESHOLD} from '../lib/physics/broderbund-1991/wheel-plane-contact.ts';

test('BB1.1 landing constants match Restunts original assembly',()=>{
 assert.deepEqual([...BRODERBUND_1991_FALL_INCREMENTS],[21,21,15,15]);
 assert.equal(BRODERBUND_1991_LANDING_SOUND_THRESHOLD,0x00fa);
 assert.equal(BRODERBUND_1991_LANDING_CRASH_THRESHOLD,0x5aeb);
});
test('BB1.1 grip uses signed SAR quartering for negative slide angle',()=>{
 const before={speed:20*256,roadSpeed:20*256,steeringAngle:-81,wheelAngle:0,spin:0,frontWheelAngle:0,slip:0,demandedGrip:0,surfaceGrip:0,allContact:4,surfaces:[1,1,1,1],sliding:0,crash:0,soundFlags:0,yaw:0,roll:0};
 const tuning={grip:10,surfaceGrip:[0,1,0,0,0,0]};
 assert.equal(stepGrip(before,tuning,true,0).frontWheelAngle,-21);
});
