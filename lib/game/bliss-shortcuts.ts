// Keyboard selection helpers ported from Bliss 2.6.1.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
import type {BlissTrack} from './bliss-track.ts';
import {blissElementData,type BlissElementData} from './bliss-element-data.ts';
import {blissParentElement} from './bliss-edit.ts';
import {blissTransformations,type BlissTransformations} from './bliss-transformations.ts';

export interface BlissPoint {x:number;y:number}

const codeAt=(source:BlissTrack,x:number,y:number)=>source.track[y*30+x];
const inside=(x:number,y:number)=>x>=0&&x<30&&y>=0&&y<30;

export function changeBlissMaterial(code:number){
 switch(code){
  case 1:return 0x86;
  case 0xb3:case 0xb4:case 0xb5:return code-0x2c;
  case 0x86:case 0x87:case 0x88:case 0x89:return code+13;
  case 0x93:return 1;
  case 0x94:case 0x95:case 0x96:return code+0x1f;
  case 4:case 5:case 14:case 15:return code+10;
  case 24:case 25:return code-20;
  case 0x4a:return 0x7d;
  case 0x7d:return 0x8a;
  case 0x8a:return 0x4a;
 }
 if((code>=6&&code<=9)||(code>=0x10&&code<=0x13))return code+10;
 if(code>=0x1a&&code<=0x1d)return code-20;
 if((code>=0x0a&&code<=0x0d)||(code>=0x14&&code<=0x17))return code+10;
 if(code>=0x1e&&code<=0x21)return code-20;
 if(code>=0x4b&&code<=0x52)return code+0x33;
 if(code>=0x7e&&code<=0x85)return code+13;
 if(code>=0x8b&&code<=0x92)return code-0x40;
 return code;
}

/** Port of Bliss SmartSelect, including connection/material preference. */
export function smartSelectBliss(
 source:BlissTrack,
 currentBrush:number,
 entity:string,
 direction:1|-1=1,
 lastPlaced:BlissPoint|null=null,
 definitions:BlissTransformations=blissTransformations,
 elements:readonly BlissElementData[]=blissElementData,
){
 let checkConnections=true,checkMaterial=true;
 const connector=[0,0,0,0];
 let material=elements[currentBrush]?.material??0;
 if(!lastPlaced||!inside(lastPlaced.x,lastPlaced.y)||codeAt(source,lastPlaced.x,lastPlaced.y)===0){
  checkConnections=false;
  if(material===0)checkMaterial=false;
 }else{
  const parent=blissParentElement(source,lastPlaced.x,lastPlaced.y,definitions),n=parent.code,shape=definitions.track[n],data=elements[n];
  material=data.material;if(material===0)checkMaterial=false;
  const x=parent.x,y=parent.y;
  if(y>0&&inside(x+data.cisalt[0],y-1)&&codeAt(source,x+data.cisalt[0],y-1)===0)connector[2]=data.ctype[0];
  if(x<=29-shape.width&&inside(x+shape.width,y+data.cisalt[1])&&codeAt(source,x+shape.width,y+data.cisalt[1])===0)connector[3]=data.ctype[1];
  if(y<=29-shape.height&&inside(x+data.cisalt[2],y+shape.height)&&codeAt(source,x+data.cisalt[2],y+shape.height)===0)connector[0]=data.ctype[2];
  if(x>0&&inside(x-1,y+data.cisalt[3])&&codeAt(source,x-1,y+data.cisalt[3])===0)connector[1]=data.ctype[3];
  if(connector.every(value=>value===0))checkConnections=false;
 }

 const wanted=entity.toUpperCase().charCodeAt(0);
 const start=direction>0?currentBrush+1:currentBrush+255,end=direction>0?currentBrush+256:currentBrush;
 for(;;){
  for(let i=start;direction>0?i<=end:i>=end;i+=direction){
   const code=((i%256)+256)%256,data=elements[code];if(!data||String.fromCharCode(data.entity).toUpperCase().charCodeAt(0)!==wanted)continue;
   let ok=!checkConnections;
   if(checkConnections)for(let side=0;side<4;side++)if(connector[side]!==0&&data.ctype[side]===connector[side]){ok=true;break;}
   if(checkMaterial&&data.material!==material)ok=false;
   if(ok)return code;
  }
  if(checkMaterial)checkMaterial=false;
  else if(checkConnections)checkConnections=false;
  else return currentBrush;
 }
}

export function findBlissElementByName(query:string,startCode:number){
 const needle=query.trim().toLowerCase();if(!needle)return startCode;
 for(let offset=1;offset<=256;offset++){
  const code=(startCode+offset)&255,name=blissElementData[code]?.id?.trim().toLowerCase()??'';
  if(name.includes(needle))return code;
 }
 return startCode;
}
