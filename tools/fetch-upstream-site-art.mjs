import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const refresh=/^(1|true|yes|on)$/i.test(process.env.PLAYSTUNTS_SITE_ART_REFRESH??'');
const base='https://playstunts.com';
const assets=[
 ['site/enhanced-artwork/SDTITL-prod-mindscape-v1.png','site/enhanced-artwork/SDTITL-prod-mindscape-v1.png'],
 ['site/enhanced-artwork/SDTITL-titl-title-v2.png','site/enhanced-artwork/SDTITL-titl-title-v2.png'],
 ['site/enhanced-artwork/SDMSEL-scrn-menu-v1.png','site/enhanced-artwork/SDMSEL-scrn-menu-v1.png'],
 ['site/enhanced-backgrounds/desert.png','site/enhanced-backgrounds/desert.png'],
 ['site/enhanced-backgrounds/tropical.png','site/enhanced-backgrounds/tropical.png'],
 ['site/enhanced-backgrounds/city.png','site/enhanced-backgrounds/city.png'],
 ['site/enhanced-backgrounds/country.png','site/enhanced-backgrounds/country.png'],
 ['site/enhanced-backgrounds/alpine-scen.png','site/enhanced-backgrounds/alpine-scen.png'],
 ['site/enhanced-backgrounds/alpine-sce2.png','site/enhanced-backgrounds/alpine-sce2.png'],
 ['site/enhanced-backgrounds/alpine-sce3.png','site/enhanced-backgrounds/alpine-sce3.png'],
 ['site/enhanced-backgrounds/alpine-sce4.png','site/enhanced-backgrounds/alpine-sce4.png'],
 ['site/enhanced-backgrounds/desert-overview.png','site/enhanced-backgrounds/desert-overview.png'],
 ['site/enhanced-backgrounds/tropical-overview.png','site/enhanced-backgrounds/tropical-overview.png'],
 ['site/enhanced-backgrounds/alpine-overview.png','site/enhanced-backgrounds/alpine-overview.png'],
 ['site/enhanced-backgrounds/city-overview.png','site/enhanced-backgrounds/city-overview.png'],
 ['site/enhanced-backgrounds/country-overview.png','site/enhanced-backgrounds/country-overview.png'],
];
const pngSignature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

async function validPng(file){
 try{return (await readFile(file)).subarray(0,8).equals(pngSignature);}catch{return false;}
}

let downloaded=0,kept=0;
for(const [remote,local] of assets){
 const target=path.join(root,'public',...local.split('/'));
 if(!refresh&&existsSync(target)&&await validPng(target)){kept++;continue;}
 const url=`${base}/${remote}`;
 const response=await fetch(url,{redirect:'follow',headers:{'user-agent':'PlayStunts-DX asset preparation'}});
 if(!response.ok)throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length<8||!bytes.subarray(0,8).equals(pngSignature))throw new Error(`Upstream asset is not a PNG: ${url}`);
 await mkdir(path.dirname(target),{recursive:true});
 await writeFile(target,bytes);
 console.log(`Fetched ${remote} (${bytes.length.toLocaleString()} bytes)`);
 downloaded++;
}
console.log(`Upstream enhanced artwork ready: ${downloaded} fetched, ${kept} already present.`);
