#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const toolsDir=dirname(fileURLToPath(import.meta.url));
const allowed=new Set(['--input','--output','--cars','--tools','--work','--game','--dosbox']);
const values=new Map();
for(let i=2;i<process.argv.length;i++){
 const key=process.argv[i];
 if(!allowed.has(key))throw Error('Unknown option: '+key);
 const value=process.argv[++i];if(!value)throw Error('Missing value for '+key);values.set(key,value);
}
const run=(script,args)=>{
 console.log('\n> '+script+' '+args.join(' '));
 const result=spawnSync(process.execPath,[resolve(toolsDir,script),...args],{stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
};
const common=(keys)=>keys.flatMap(key=>values.has(key)?[key,values.get(key)]:[]);
run('replay-groundtruth.mjs',common(['--input','--output','--cars','--tools','--work','--game','--dosbox']));
run('replay-telemetry.mjs',[...common(['--input','--output','--cars','--game']),'--physics','bb11']);
run('replay-compare-groundtruth.mjs',common(['--input','--output']));
console.log('\nBB1.1 verification completed.');
