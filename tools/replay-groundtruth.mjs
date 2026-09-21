#!/usr/bin/env node
import {access,cp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {basename,dirname,extname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {decodeReplayBytes} from './replay-dataset.mjs';

export const RESTUNTS_GAMESTATE_BYTES=0x460;
export const RESTUNTS_PLAYER_OFFSET=0x152;
export const REPLDUMP_DOWNLOAD='https://scr.stunts.hu/files/utils/repldump-dos-2013-02-10.zip';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaults={input:join(repoRoot,'training','replays','input'),output:join(repoRoot,'training','replays','output'),cars:join(repoRoot,'training','replays','cars'),tools:join(repoRoot,'training','replays','restunts'),work:join(repoRoot,'training','replays','work'),game:null,dosbox:null,convertOnly:false};

function args(){
 const result={...defaults};
 for(let i=2;i<process.argv.length;i++){
  const arg=process.argv[i];
  if(arg==='--input')result.input=resolve(process.argv[++i]??'');
  else if(arg==='--output')result.output=resolve(process.argv[++i]??'');
  else if(arg==='--cars')result.cars=resolve(process.argv[++i]??'');
  else if(arg==='--tools')result.tools=resolve(process.argv[++i]??'');
  else if(arg==='--work')result.work=resolve(process.argv[++i]??'');
  else if(arg==='--game')result.game=resolve(process.argv[++i]??'');
  else if(arg==='--dosbox')result.dosbox=resolve(process.argv[++i]??'');
  else if(arg==='--convert-only')result.convertOnly=true;
  else throw Error('Unknown option: '+arg);
 }
 return result;
}
async function exists(path){try{await access(path);return true;}catch{return false;}}
async function findGameRoot(explicit){
 const candidates=explicit?[explicit]:[join(repoRoot,'local-assets','prepared','game'),join(repoRoot,'public','game'),join(repoRoot,'dist-desktop','game')];
 for(const root of candidates)if(await exists(join(root,'setup-media'))&&await exists(join(root,'assets.json')))return root;
 throw Error('Prepared PlayStunts game data was not found. Expected local-assets/prepared/game or public/game.');
}
async function findRecursive(root,names){
 const wanted=new Set(names.map(name=>name.toUpperCase()));
 try{
  const entries=(await readdir(root,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries)if(entry.isFile()&&wanted.has(entry.name.toUpperCase()))return join(root,entry.name);
  for(const entry of entries)if(entry.isDirectory()){const found=await findRecursive(join(root,entry.name),names);if(found)return found;}
 }catch{}
 return null;
}
const csvCell=value=>{const text=String(value??'');return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
const writeCsv=(path,rows)=>writeFile(path,rows.map(row=>row.map(csvCell).join(',')).join('\n')+'\n','utf8');
function commandExists(command){
 const probe=spawnSync(process.platform==='win32'?'where.exe':'which',[command],{encoding:'utf8',windowsHide:true});
 if(probe.status!==0)return null;
 return (probe.stdout??'').split(/\r?\n/).map(x=>x.trim()).find(Boolean)??null;
}
async function findDosbox(explicit){
 if(explicit){if(!await exists(explicit))throw Error('DOSBox executable not found: '+explicit);return explicit;}
 const env=process.env.DOSBOX;if(env&&await exists(env))return env;
 for(const name of process.platform==='win32'?['dosbox-staging.exe','dosbox-x.exe','dosbox.exe']:['dosbox-staging','dosbox-x','dosbox']){const found=commandExists(name);if(found)return found;}
 return null;
}
function psLiteral(value){return "'"+String(value).replaceAll("'","''")+"'";}
function extractZip(zip,target){
 if(process.platform==='win32'){
  const script=`Expand-Archive -LiteralPath ${psLiteral(zip)} -DestinationPath ${psLiteral(target)} -Force`;
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{stdio:'inherit',windowsHide:true});if(p.status===0)return;
 }
 for(const python of ['python','python3','py']){const argv=python==='py'?['-3','-m','zipfile','-e',zip,target]:['-m','zipfile','-e',zip,target];const p=spawnSync(python,argv,{stdio:'inherit',windowsHide:true});if(p.status===0)return;}
 throw Error('Could not extract repldump ZIP. PowerShell or Python is required.');
}
async function ensureRepldump(root){
 await mkdir(root,{recursive:true});
 let exe=await findRecursive(root,['REPLDUMO.EXE','REPLDUMP.EXE']);if(exe)return exe;
 const zip=join(root,'repldump-dos-2013-02-10.zip');
 if(!await exists(zip)){console.log('Downloading Restunts repldump from '+REPLDUMP_DOWNLOAD);const response=await fetch(REPLDUMP_DOWNLOAD);if(!response.ok)throw Error('Could not download repldump: HTTP '+response.status);await writeFile(zip,new Uint8Array(await response.arrayBuffer()));}
 extractZip(zip,root);
 exe=await findRecursive(root,['REPLDUMO.EXE','REPLDUMP.EXE']);if(!exe)throw Error('The repldump archive did not contain REPLDUMO.EXE or REPLDUMP.EXE');
 return exe;
}
async function copyDirectoryContents(source,target){for(const entry of await readdir(source,{withFileTypes:true}))await cp(join(source,entry.name),join(target,entry.name),{recursive:true,force:true});}
async function findCar(gameRoot,carsRoot,id){
 const filename=`CAR${id}.RES`;
 for(const root of [carsRoot,join(repoRoot,'Custom Cars'),join(gameRoot,'setup-media')]){const found=await findRecursive(root,[filename]);if(found)return found;}
 return null;
}
function runDosbox(dosbox,workspace){
 const result=spawnSync(dosbox,['-c',`mount c "${workspace}"`,'-c','c:','-c','REPLDUMP.EXE INPUT.RPL -o STATE.BIN','-c','exit'],{stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;if(result.status!==0)throw Error('DOSBox/repldump exited with code '+result.status);
}
function inputFields(decoded,index){return decoded.frames[index]??{raw:0,throttle:0,brake:0,driveConflict:0,steer:'center',steerValue:0,shiftUp:0,shiftDown:0};}

export function parseRestuntsDump(bytes,decoded){
 if(bytes.length<2)throw Error('Restunts dump is shorter than its frame-count word');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),declared=view.getUint16(0,true),expected=2+declared*RESTUNTS_GAMESTATE_BYTES;
 if(bytes.length!==expected)throw Error(`Restunts dump size mismatch: expected ${expected} bytes for ${declared} frames, got ${bytes.length}`);
 if(declared!==decoded.frameCount)throw Error(`Restunts dump contains ${declared} frames but replay declares ${decoded.frameCount}`);
 const samples=[];
 for(let index=0;index<declared;index++){
  const state=2+index*RESTUNTS_GAMESTATE_BYTES,p=state+RESTUNTS_PLAYER_OFFSET,input=inputFields(decoded,index);
  const x=view.getInt32(p+0x00,true),y=view.getInt32(p+0x04,true),z=view.getInt32(p+0x08,true),worldColumn=Math.floor(x/65536),worldRow=Math.floor(z/65536),trackRow=29-worldRow;
  const valid=worldColumn>=0&&worldColumn<30&&trackRow>=0&&trackRow<30,surfaces=[0,1,2,3].map(i=>view.getUint8(p+0xc2+i));
  samples.push({frame:index,time:index/decoded.frequencyHz,stateFrame:view.getUint16(state+0x140,true),raw:input.raw,throttle:input.throttle,brake:input.brake,driveConflict:input.driveConflict,steer:input.steerValue,steerConflict:input.steer==='both'?1:0,shiftUp:input.shiftUp,shiftDown:input.shiftDown,
   xFixed:x,yFixed:y,zFixed:z,x:x/64,y:y/64,z:z/64,yaw:view.getInt16(p+0x18,true),pitch:view.getInt16(p+0x1a,true),roll:view.getInt16(p+0x1c,true),pseudoGravity:view.getInt16(p+0x1e,true),steeringAngle:view.getInt16(p+0x20,true),rpm:view.getInt16(p+0x22,true),speed:view.getUint16(p+0x2a,true),roadSpeed:view.getUint16(p+0x2c,true),wheelAngle:view.getInt16(p+0x36,true),spin:view.getInt16(p+0x3e,true),frontWheelAngle:view.getInt16(p+0x40,true),demandedGrip:view.getInt16(p+0x44,true),surfaceGrip:view.getInt16(p+0x46,true),trackDataIndex:view.getInt16(p+0x4a,true),braking:view.getUint8(p+0xbc),accelerating:view.getUint8(p+0xbd),gear:view.getUint8(p+0xbe),surfaceFront:view.getUint8(p+0xbf),surfaceRear:view.getUint8(p+0xc0),surfaceAll:view.getUint8(p+0xc1),surfaces,sliding:view.getUint8(p+0xc7),crash:view.getUint8(p+0xc9),changingGear:view.getUint8(p+0xca),transmission:view.getUint8(p+0xcc),
   gameFrameInSecond:view.getInt16(state+0x138,true),gameFramesPerSecond:view.getInt16(state+0x13a,true),travelledDistance:view.getInt32(state+0x13c,true),totalFinish:view.getInt16(state+0x142,true),playerEndFrame:view.getInt16(state+0x146,true),penalty:view.getInt16(state+0x14a,true),impactSpeed:view.getUint16(state+0x14c,true),topSpeed:view.getUint16(state+0x14e,true),jumpCount:view.getInt16(state+0x150,true),worldColumn,worldRow,trackRow,trackElement:valid?decoded.track.grid[trackRow*30+worldColumn]:-1});
 }
 return {declared,samples};
}
const header=['frame','time_s','state_frame','input_raw_hex','input_raw_dec','throttle','brake','drive_conflict','steer','steer_conflict','shift_up','shift_down','x_fixed','y_fixed','z_fixed','x_world','y_world','z_world','yaw','pitch','roll','pseudo_gravity','speed_raw','speed_mph','road_speed_raw','road_speed_mph','rpm','gear','steering_angle','wheel_angle','front_wheel_angle','spin','demanded_grip','surface_grip','braking','accelerating','sliding','crash','changing_gear','transmission','surface_0','surface_1','surface_2','surface_3','surface_front','surface_rear','surface_all','game_frame_in_second','game_frames_per_second','travelled_distance','total_finish','player_end_frame','penalty','impact_speed','top_speed','jump_count','world_column','world_row','track_row','track_element'];
const csvRow=s=>[s.frame,s.time.toFixed(3),s.stateFrame,`0x${s.raw.toString(16).padStart(2,'0').toUpperCase()}`,s.raw,s.throttle,s.brake,s.driveConflict,s.steer,s.steerConflict,s.shiftUp,s.shiftDown,s.xFixed,s.yFixed,s.zFixed,s.x.toFixed(3),s.y.toFixed(3),s.z.toFixed(3),s.yaw,s.pitch,s.roll,s.pseudoGravity,s.speed,(s.speed/256).toFixed(4),s.roadSpeed,(s.roadSpeed/256).toFixed(4),s.rpm,s.gear,s.steeringAngle,s.wheelAngle,s.frontWheelAngle,s.spin,s.demandedGrip,s.surfaceGrip,s.braking,s.accelerating,s.sliding,s.crash,s.changingGear,s.transmission,...s.surfaces,s.surfaceFront,s.surfaceRear,s.surfaceAll,s.gameFrameInSecond,s.gameFramesPerSecond,s.travelledDistance,s.totalFinish,s.playerEndFrame,s.penalty,s.impactSpeed,s.topSpeed,s.jumpCount,s.worldColumn,s.worldRow,s.trackRow,s.trackElement];

async function convertDump(replayPath,dumpPath,outputFolder){
 const replayBytes=new Uint8Array(await readFile(replayPath)),decoded=decodeReplayBytes(replayBytes,basename(replayPath)),parsed=parseRestuntsDump(new Uint8Array(await readFile(dumpPath)),decoded),samples=parsed.samples,final=samples.at(-1),crashIndex=samples.findIndex(s=>s.crash!==0),maxSpeed=samples.reduce((m,s)=>Math.max(m,s.speed/256),0);
 const summary={file:basename(replayPath),source:'restunts-repldump',frames:parsed.declared,frequencyHz:decoded.frequencyHz,carId:decoded.header.carId,trackName:new TextDecoder().decode(replayBytes.subarray(13,22)).replace(/\0.*$/,''),stateFramesMatch:samples.every((s,i)=>s.stateFrame===i+1),maxSpeedMph:maxSpeed,firstCrashFrame:crashIndex>=0?crashIndex:null,firstCrashSeconds:crashIndex>=0?crashIndex/decoded.frequencyHz:null,final:final?{x:final.x,y:final.y,z:final.z,speedMph:final.speed/256,gear:final.gear,crash:final.crash,playerEndFrame:final.playerEndFrame,penalty:final.penalty}:null};
 await mkdir(outputFolder,{recursive:true});await Promise.all([writeCsv(join(outputFolder,'groundtruth.csv'),[header,...samples.map(csvRow)]),writeFile(join(outputFolder,'groundtruth-summary.json'),JSON.stringify(summary,null,2)+'\n','utf8')]);return summary;
}
async function main(){
 const options=args();await Promise.all([mkdir(options.input,{recursive:true}),mkdir(options.output,{recursive:true}),mkdir(options.cars,{recursive:true}),mkdir(options.tools,{recursive:true}),mkdir(options.work,{recursive:true})]);
 const files=(await readdir(options.input,{withFileTypes:true})).filter(x=>x.isFile()&&/\.rpl$/i.test(x.name)).map(x=>x.name).sort();if(!files.length){console.log('No .RPL files found in '+options.input);return;}
 const gameRoot=options.convertOnly?null:await findGameRoot(options.game);let repldump=null,dosbox=null;
 if(!options.convertOnly){repldump=await ensureRepldump(options.tools);dosbox=await findDosbox(options.dosbox);if(!dosbox)throw Error('No DOSBox executable found. Install DOSBox/DOSBox-X/DOSBox Staging or pass --dosbox "FULL\\PATH\\TO\\dosbox.exe".');console.log('Restunts tool: '+repldump);console.log('DOSBox: '+dosbox);}
 const manifest={source:'restunts-repldump',replays:[]};
 for(const name of files){
  const replayPath=join(options.input,name),stem=basename(name,extname(name)),out=join(options.output,stem),dumpPath=join(out,'restunts-state.bin');await mkdir(out,{recursive:true});
  if(!options.convertOnly){
   const replayBytes=new Uint8Array(await readFile(replayPath)),decoded=decodeReplayBytes(replayBytes,name),workspace=join(options.work,stem);await rm(workspace,{recursive:true,force:true});await mkdir(workspace,{recursive:true});await copyDirectoryContents(join(gameRoot,'setup-media'),workspace);
   const car=await findCar(gameRoot,options.cars,decoded.header.carId);if(!car){const skipped={file:name,status:'skipped',reason:`Missing CAR${decoded.header.carId}.RES`};manifest.replays.push(skipped);console.log(name+': skipped — '+skipped.reason);continue;}await cp(car,join(workspace,`CAR${decoded.header.carId}.RES`),{force:true});
   if(decoded.header.opponentSelected){const opponent=await findCar(gameRoot,options.cars,decoded.header.opponentCarId);if(!opponent){const skipped={file:name,status:'skipped',reason:`Missing CAR${decoded.header.opponentCarId}.RES for opponent`};manifest.replays.push(skipped);console.log(name+': skipped — '+skipped.reason);continue;}await cp(opponent,join(workspace,`CAR${decoded.header.opponentCarId}.RES`),{force:true});}
   await Promise.all([cp(repldump,join(workspace,'REPLDUMP.EXE'),{force:true}),cp(replayPath,join(workspace,'INPUT.RPL'),{force:true})]);console.log(name+': running Restunts ground-truth replay...');runDosbox(dosbox,workspace);const produced=join(workspace,'STATE.BIN');if(!await exists(produced))throw Error(name+': repldump completed without producing STATE.BIN');await cp(produced,dumpPath,{force:true});
  }
  if(!await exists(dumpPath)){console.log(name+': no restunts-state.bin to convert');continue;}
  const summary=await convertDump(replayPath,dumpPath,out);manifest.replays.push({status:'ok',...summary});console.log(`${name}: ${summary.frames} ground-truth frames, max ${summary.maxSpeedMph.toFixed(1)} mph, crash ${summary.firstCrashFrame??'none'}`);
 }
 await writeFile(join(options.output,'groundtruth-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');console.log('Ground-truth dataset written to '+options.output);
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:error);process.exitCode=1;});
