#!/usr/bin/env node
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {basename,dirname,extname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeReplayBytes} from './replay-dataset.mjs';
import {parseRestuntsDump} from './replay-groundtruth.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaults={input:join(repoRoot,'training','replays','input'),output:join(repoRoot,'training','replays','output')};
function args(){
 const result={...defaults};
 for(let i=2;i<process.argv.length;i++){
  const arg=process.argv[i];
  if(arg==='--input')result.input=resolve(process.argv[++i]??'');
  else if(arg==='--output')result.output=resolve(process.argv[++i]??'');
  else throw Error('Unknown option: '+arg);
 }
 return result;
}
const fields=[
 'xFixed','yFixed','zFixed','yaw','pitch','roll','pseudoGravity',
 'speed','roadSpeed','rpm','gear','steeringAngle','wheelAngle','frontWheelAngle',
 'spin','demandedGrip','surfaceGrip','braking','accelerating','sliding','crash','changingGear',
];
const surfaceFields=['surface0','surface1','surface2','surface3'];

async function main(){
 const options=args();
 const files=(await readdir(options.input,{withFileTypes:true}))
  .filter(entry=>entry.isFile()&&/\.rpl$/i.test(entry.name))
  .map(entry=>entry.name).sort();
 if(!files.length)throw Error('No .RPL files found in '+options.input);
 const results=[];
 let failures=0;
 for(const name of files){
  const stem=basename(name,extname(name)),folder=join(options.output,stem);
  let replayBytes,dumpBytes,actual;
  try{
   [replayBytes,dumpBytes,actual]=await Promise.all([
    readFile(join(options.input,name)).then(bytes=>new Uint8Array(bytes)),
    readFile(join(folder,'restunts-state.bin')).then(bytes=>new Uint8Array(bytes)),
    readFile(join(folder,'telemetry-after.json'),'utf8').then(JSON.parse),
   ]);
  }catch(error){
   const result={file:name,status:'skipped',reason:error instanceof Error?error.message:String(error)};
   results.push(result);console.log(name+': skipped — '+result.reason);continue;
  }
  const decoded=decodeReplayBytes(replayBytes,name),expected=parseRestuntsDump(dumpBytes,decoded).samples;
  let mismatch=null;
  const count=Math.min(expected.length,actual.length);
  for(let frame=0;frame<count&&!mismatch;frame++){
   const e=expected[frame],a=actual[frame];
   for(const field of fields){
    if(Number(a[field])!==Number(e[field])){mismatch={frame,field,expected:e[field],actual:a[field]};break;}
   }
   if(!mismatch)for(let wheel=0;wheel<4;wheel++){
    if(Number(a.surfaces?.[wheel])!==Number(e.surfaces?.[wheel])){
     mismatch={frame,field:surfaceFields[wheel],expected:e.surfaces?.[wheel],actual:a.surfaces?.[wheel]};break;
    }
   }
  }
  if(!mismatch&&actual.length!==expected.length)mismatch={frame:count,field:'frameCount',expected:expected.length,actual:actual.length};
  if(mismatch){
   failures++;
   const result={file:name,status:'mismatch',framesCompared:count,firstMismatch:mismatch};
   results.push(result);
   console.log(`${name}: mismatch at frame ${mismatch.frame} · ${mismatch.field} · BB1.1=${mismatch.expected} DX=${mismatch.actual}`);
  }else{
   const result={file:name,status:'exact',framesCompared:count};
   results.push(result);console.log(`${name}: exact for ${count} frames`);
  }
 }
 const summary={reference:'Restunts BB1.1 repldump',physicsVersion:'broderbund-1991',failures,results};
 await writeFile(join(options.output,'bb11-groundtruth-comparison.json'),JSON.stringify(summary,null,2)+'\n','utf8');
 if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:error);process.exitCode=1;});
