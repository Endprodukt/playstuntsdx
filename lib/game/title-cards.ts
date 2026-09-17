import {enhancedTexturesEnabled,hiresTextureUrl} from './enhanced-textures';

export interface OriginalTitleCardHost {
 hideMouse():void;clearVideo():void;showMouse():void;clearWindow():void;
 locate(name:'prod'|'titl'):number;
 draw():void;
 present(argument:-1,waitFlag:number):number;
 wait(argument:400,waitFlag:number):number;
}

const enhancedCards=new Map<'prod'|'titl',HTMLImageElement>();
let visibleEnhancedCard:'prod'|'titl'|undefined;

function enhancedCard(name:'prod'|'titl'){
 if(typeof Image==='undefined')return undefined;
 let image=enhancedCards.get(name);
 if(image)return image;
 image=new Image();
 image.decoding='async';
 image.src=hiresTextureUrl(name==='prod'?'intro/mindscape.png':'intro/title.png');
 enhancedCards.set(name,image);
 return image;
}

function drawEnhancedCard(name:'prod'|'titl'){
 if(typeof document==='undefined'||!enhancedTexturesEnabled())return;
 visibleEnhancedCard=name;
 const canvas=document.querySelector<HTMLCanvasElement>('canvas[aria-label="Native Stunts opening, menus, races and track editor"]');
 const image=enhancedCard(name);
 if(!canvas||!image)return;
 const draw=()=>{
  if(visibleEnhancedCard!==name||!enhancedTexturesEnabled())return;
  const context=canvas.getContext('2d');if(!context)return;
  context.setTransform(1,0,0,1,0,0);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(image,0,0,canvas.width,canvas.height);
 };
 if(image.complete&&image.naturalWidth)draw();else image.onload=draw;
}

function clearEnhancedCard(){visibleEnhancedCard=undefined;}

/** Supplied 2E78..2F61. Wait arguments remain original counter units;
 * their conversion and sprite presentation belong to the original host routines.
 */
export type OriginalTitleCardRequest={type:'present';argument:-1;waitFlag:number}|{type:'wait';argument:400;waitFlag:number};
/** The same source flow can be driven asynchronously by the browser. */
export function* originalTitleCards(host:Omit<OriginalTitleCardHost,'present'|'wait'>):Generator<OriginalTitleCardRequest,number,number>{
 host.hideMouse();host.clearVideo();host.showMouse();host.clearWindow();
 let waitFlag=host.locate('prod')!==0?160:180;
 host.locate('prod');host.draw();
 let result=(yield {type:'present',argument:-1,waitFlag})&65535;
 if(result){clearEnhancedCard();return result;}
 drawEnhancedCard('prod');
 result=(yield {type:'wait',argument:400,waitFlag})&65535;
 if(result){clearEnhancedCard();return result;}
 clearEnhancedCard();host.clearWindow();waitFlag=180;host.locate('titl');host.draw();
 result=(yield {type:'present',argument:-1,waitFlag})&65535;
 if(result){clearEnhancedCard();return result;}
 drawEnhancedCard('titl');
 result=(yield {type:'wait',argument:400,waitFlag})&65535;
 clearEnhancedCard();return result;
}

/** Synchronous adapter retained for existing executable-comparison callers. */
export function runOriginalTitleCards(host:OriginalTitleCardHost){
 const flow=originalTitleCards(host);let step=flow.next();
 while(!step.done){const request=step.value;step=flow.next(request.type==='present'?host.present(request.argument,request.waitFlag):host.wait(request.argument,request.waitFlag));}
 return step.value;
}
