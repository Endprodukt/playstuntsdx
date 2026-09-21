#!/usr/bin/env node
import {access,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {basename,dirname,extname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaultInput=join(repoRoot,'training','replays','input');
const defaultOutput=join(repoRoot,'training','replays','output');
const defaultCars=join(repoRoot,'training','replays','cars');

function args(){
 const result={input:defaultInput,output:defaultOutput,cars:defaultCars,game:null};
 for(let i=2;i<process.argv.length;i++){
  const arg=process.argv[i];
  if(arg==='--input')result.input=resolve(process.argv[++i]??'');
  else if(arg==='--output')result.output=resolve(process.argv[++i]??'');
  else if(arg==='--cars')result.cars=resolve(process.argv[++i]??'');
  else if(arg==='--game')result.game=resolve(process.argv[++i]??'');
  else throw Error('Unknown option: '+arg);
 }
 return result;
}
async function exists(path){try{await access(path);return true;}catch{return false;}}
async function findGameRoot(explicit){
 const candidates=explicit?[explicit]:[
  join(repoRoot,'local-assets','prepared','game'),
  join(repoRoot,'public','game'),
  join(repoRoot,'dist-desktop','game'),
 ];
 for(const root of candidates){
  if(await exists(join(root,'native-race-startup.bin'))&&await exists(join(root,'assets.json')))return root;
 }
 throw Error(
  'Prepared PlayStunts game data was not found. Expected local-assets/prepared/game or public/game. '+
  'If your prepared game data is elsewhere, run: npm run replay:simulate -- --game "FULL\\PATH\\TO\\game"'
 );
}
const json=async(root,name)=>JSON.parse(await readFile(join(root,name+'.json'),'utf8'));
const csvCell=value=>{const text=String(value??'');return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
const writeCsv=(path,rows)=>writeFile(path,rows.map(row=>row.map(csvCell).join(',')).join('\n')+'\n','utf8');
const carId=header=>String.fromCharCode(...header.subarray(0,4));

async function findCaseInsensitiveFile(root,name){
 try{
  const entries=await readdir(root,{withFileTypes:true});
  const match=entries.find(entry=>entry.isFile()&&entry.name.toUpperCase()===name.toUpperCase());
  return match?join(root,match.name):null;
 }catch{return null;}
}
async function findCaseInsensitiveFileRecursive(root,name){
 const direct=await findCaseInsensitiveFile(root,name);if(direct)return direct;
 try{
  const entries=(await readdir(root,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){
   if(!entry.isDirectory())continue;
   const found=await findCaseInsensitiveFileRecursive(join(root,entry.name),name);
   if(found)return found;
  }
 }catch{}
 return null;
}
function decodeCarSimulationResource(bytes,id){
 if(bytes.length<14)throw Error(`CAR${id}.RES is too short`);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),size=view.getUint32(0,true),count=view.getUint16(4,true),base=6+8*count;
 if(size!==bytes.length||base>size)throw Error(`CAR${id}.RES has an invalid resource table`);
 const names=Array.from({length:count},(_,i)=>String.fromCharCode(...bytes.subarray(6+i*4,10+i*4)));
 const offsets=Array.from({length:count},(_,i)=>view.getUint32(6+4*count+i*4,true));
 const index=names.indexOf('simd');if(index<0)throw Error(`CAR${id}.RES has no simd resource`);
 const offset=offsets[index],endOffset=Math.min(...offsets.filter(value=>value>offset),size-base);
 const simulation=bytes.slice(base+offset,base+endOffset);
 if(simulation.length<192)throw Error(`CAR${id}.RES simd resource is too short`);
 const sim=new DataView(simulation.buffer,simulation.byteOffset,simulation.byteLength);
 const word=at=>sim.getUint16(at,true);
 const tuning={
  id:id.toUpperCase(),gears:simulation[0],mass:word(2),braking:word(4),idleRPM:word(6),downshiftRPM:word(8),upshiftRPM:word(10),maxRPM:word(12),
  gearRatios:Array.from({length:7},(_,i)=>word(14+i*2)),
  gearKnobPoints:Array.from({length:7},(_,i)=>[sim.getInt16(28+i*4,true),sim.getInt16(30+i*4,true)]),
  aeroResistance:word(56),idleTorque:simulation[58],torqueCurve:Array.from(simulation.subarray(59,163)),
  grip:word(164),surfaceGrip:Array.from({length:6},(_,i)=>word(180+i*2)),
  rawSimulation:Buffer.from(simulation).toString('hex'),
 };
 return {tuning,simulation};
}
async function loadPreparedCar(gameRoot,carRoot,id){
 const filename=`CAR${id}.RES`;
 const roots=[
  carRoot,
  join(repoRoot,'Custom Cars'),
  join(gameRoot,'setup-media'),
  join(gameRoot,'original-resources'),
 ];
 for(const root of roots){
  const path=await findCaseInsensitiveFileRecursive(root,filename);
  if(!path)continue;
  const decoded=decodeCarSimulationResource(new Uint8Array(await readFile(path)),id);
  return {...decoded,source:path};
 }
 return null;
}
const controls=raw=>{
 raw&=255;const drive=raw&3,steer=(raw>>2)&3;
 return {raw,throttle:drive===1?1:0,brake:drive===2?1:0,driveConflict:drive===3?1:0,steer:steer===1?1:steer===2?-1:0,steerConflict:steer===3?1:0,shiftUp:(raw&16)?1:0,shiftDown:(raw&32)?1:0};
};
function snapshot(state,raw,track,frequency,frame){
 const car=state.player.driving.car,engine=car.engine,grip=car.grip,pos=car.pose.position,rot=car.pose.rotation,nav=state.player.navigation.progress;
 const column=(pos[0]>>>16)&255,row=(pos[2]>>>16)&255,element=column<30&&row<30?track.track[row*30+column]:-1;
 const surfaces=Array.from({length:4},(_,i)=>grip.surfaces[i]??0),grass=surfaces.filter(x=>x===4).length,air=surfaces.filter(x=>x===0).length;
 return {
  frame,time:frame/frequency,...controls(raw),
  raceClock:state.player.driving.race.stats[2],
  xFixed:pos[0],yFixed:pos[1],zFixed:pos[2],x:pos[0]/64,y:pos[1]/64,z:pos[2]/64,
  yaw:rot[0],pitch:rot[1],roll:rot[2],
  speed:engine.speed,speedMph:engine.speed/256,roadSpeed:engine.roadSpeed,roadSpeedMph:engine.roadSpeed/256,rpm:engine.rpm,gear:engine.gear,
  steeringAngle:grip.steeringAngle,wheelAngle:grip.wheelAngle,frontWheelAngle:grip.frontWheelAngle,spin:grip.spin,sliding:grip.sliding,
  demandedGrip:grip.demandedGrip,surfaceGrip:grip.surfaceGrip,crash:grip.crash,
  surfaces,grass,air,allContact:grip.allContact,
  route:nav.route,lastRoute:nav.lastRoute,laps:nav.laps,penalty:nav.totalPenalty,
  column,row,trackElement:element,
 };
}
const header=[
 'frame','time_s','input_raw_hex','input_raw_dec','throttle','brake','drive_conflict','steer','steer_conflict','shift_up','shift_down',
 'race_clock','x_fixed','y_fixed','z_fixed','x_world','y_world','z_world','yaw','pitch','roll',
 'speed_raw','speed_mph','road_speed_raw','road_speed_mph','rpm','gear','steering_angle','wheel_angle','front_wheel_angle','spin','sliding',
 'demanded_grip','surface_grip','crash','surface_0','surface_1','surface_2','surface_3','grass_wheels','air_wheels','all_contact',
 'route','last_route','laps','penalty','track_column','track_row','track_element'
];
const row=s=>[
 s.frame,s.time.toFixed(3),`0x${s.raw.toString(16).padStart(2,'0').toUpperCase()}`,s.raw,s.throttle,s.brake,s.driveConflict,s.steer,s.steerConflict,s.shiftUp,s.shiftDown,
 s.raceClock,s.xFixed,s.yFixed,s.zFixed,s.x.toFixed(3),s.y.toFixed(3),s.z.toFixed(3),s.yaw,s.pitch,s.roll,
 s.speed,s.speedMph.toFixed(4),s.roadSpeed,s.roadSpeedMph.toFixed(4),s.rpm,s.gear,s.steeringAngle,s.wheelAngle,s.frontWheelAngle,s.spin,s.sliding,
 s.demandedGrip,s.surfaceGrip,s.crash,...s.surfaces,s.grass,s.air,s.allContact,s.route,s.lastRoute,s.laps,s.penalty,s.column,s.row,s.trackElement
];

async function main(){
 const options=args(),gameRoot=await findGameRoot(options.game);
 await mkdir(options.output,{recursive:true});await mkdir(options.cars,{recursive:true});
 const files=(await readdir(options.input,{withFileTypes:true})).filter(x=>x.isFile()&&/\.rpl$/i.test(x.name)).map(x=>x.name).sort();
 if(!files.length){console.log('No .RPL files found in '+options.input);return;}
 const vite=await createServer({root:repoRoot,configFile:false,appType:'custom',server:{middlewareMode:true,watch:{ignored:['**/.vs/**','**/.git/**','**/node_modules/**','**/training/replays/**','**/dist/**','**/dist-desktop/**','**/src-tauri/target/**']}},logLevel:'error'});
 try{
  const [{decodeOriginalReplayFile},{createNativeReplaySession}]=await Promise.all([
   vite.ssrLoadModule('/lib/game/replay-file.ts'),
   vite.ssrLoadModule('/lib/game/native-replay-session.ts'),
  ]);
  const [startup,assets,records,vectors,samples,objects,points,indices,planes,wallsFile]=await Promise.all([
   readFile(join(gameRoot,'native-race-startup.bin')).then(b=>new Uint8Array(b)),
   json(gameRoot,'assets'),json(gameRoot,'route-records'),json(gameRoot,'route-vectors'),json(gameRoot,'route-sample-vectors'),
   json(gameRoot,'track-objects'),json(gameRoot,'route-point-vectors'),json(gameRoot,'route-speed-indices'),
   json(gameRoot,'collision-planes'),json(gameRoot,'collision-walls')
  ]);
  const manifest={gameRoot,carRoot:options.cars,replays:[]};
  for(const name of files){
   const path=join(options.input,name),bytes=new Uint8Array(await readFile(path)),replay=decodeOriginalReplayFile(bytes),id=carId(replay.header);
   const folder=join(options.output,basename(name,extname(name)));await mkdir(folder,{recursive:true});
   if(replay.header[6]!==0){
    const summary={file:name,status:'skipped',reason:'First headless probe supports solo replays only',opponentSelected:replay.header[6]};
    await writeFile(join(folder,'simulation-summary.json'),JSON.stringify(summary,null,2)+'\n');manifest.replays.push(summary);continue;
   }
   let tuning=assets.cars.find(car=>String(car.id).toUpperCase()===id.toUpperCase()),simulation,tuningSource='assets.json';
   if(tuning?.rawSimulation)simulation=Uint8Array.from(Buffer.from(tuning.rawSimulation,'hex'));
   else{
    const prepared=await loadPreparedCar(gameRoot,options.cars,id);
    if(prepared){tuning=prepared.tuning;simulation=prepared.simulation;tuningSource=prepared.source;}
   }
   if(!tuning||!simulation){
    const summary={file:name,status:'skipped',carId:id,reason:`Missing CAR${id}.RES. Put it in ${options.cars}`};
    await writeFile(join(folder,'simulation-summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');
    manifest.replays.push(summary);
    console.log(`${name}: skipped — missing CAR${id}.RES (drop it into ${options.cars})`);
    continue;
   }
   const session=createNativeReplaySession({startup,packedOpponent:new Uint8Array(),simulation,tuning,records,vectors,samples,objects,points,indices,planes,walls:wallsFile.walls},id,bytes);
   const rows=[header],samplesOut=[],start=snapshot(session.state,replay.inputs[0]??0,replay.track,replay.frequencyHz,0);
   let maxSpeed=0,grassFrames=0,airFrames=0,slidingFrames=0,crashFrames=0;
   for(let frame=0;frame<replay.inputs.length;frame++){
    const sample=snapshot(session.state,replay.inputs[frame],replay.track,replay.frequencyHz,frame);
    samplesOut.push(sample);rows.push(row(sample));maxSpeed=Math.max(maxSpeed,sample.speedMph);
    if(sample.grass)grassFrames++;if(sample.air===4)airFrames++;if(sample.sliding)slidingFrames++;if(sample.crash)crashFrames++;
    session.tick(0);
   }
   const final=snapshot(session.state,0,replay.track,replay.frequencyHz,replay.inputs.length);
   const summary={
    file:name,status:'ok',format:replay.format,frequencyHz:replay.frequencyHz,carId:id,tuningSource,frames:replay.inputs.length,
    durationSeconds:replay.inputs.length/replay.frequencyHz,finalRaceClock:final.raceClock,raceClockMatchesFrames:final.raceClock===replay.inputs.length,
    maxSpeedMph:maxSpeed,grassFrames,airFrames,slidingFrames,crashFrames,
    start:{x:start.x,y:start.y,z:start.z,yaw:start.yaw,speedMph:start.speedMph,route:start.route},
    final:{x:final.x,y:final.y,z:final.z,yaw:final.yaw,speedMph:final.speedMph,route:final.route,laps:final.laps,penalty:final.penalty,crash:final.crash},
   };
   await Promise.all([
    writeCsv(join(folder,'telemetry.csv'),rows),
    writeFile(join(folder,'simulation-summary.json'),JSON.stringify(summary,null,2)+'\n','utf8'),
   ]);
   manifest.replays.push(summary);
   console.log(`${name}: simulated ${summary.frames} frames, final clock ${summary.finalRaceClock}, max ${summary.maxSpeedMph.toFixed(1)} mph, final (${summary.final.x.toFixed(1)}, ${summary.final.z.toFixed(1)})`);
  }
  await writeFile(join(options.output,'simulation-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
  console.log('Telemetry written to '+options.output);
 }finally{await vite.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:error);process.exitCode=1;});
