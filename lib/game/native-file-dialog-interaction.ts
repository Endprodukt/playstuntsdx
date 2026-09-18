import {originalFileDialogSession,type OriginalFileDialogReply} from './file-dialog-session.ts';
import type {NativeMenuInput} from './native-dialog-runtime.ts';
export interface NativeFileDialogPresentation {fields:ReadonlyArray<{x:number;y:number}>;hits:ReadonlyArray<{left:number;right:number;top:number;bottom:number}>;}
export interface NativeFileDialogServices {
 enumerate(path:string,extension:string):Promise<ReadonlyArray<string>>;
 editPath(path:string,length:number,timeout:number,field:{x:number;y:number}):Promise<{path:string;key:number}>;
}
/** Original file-list interaction shared by every display implementation. */
export async function interactNativeFileDialog(host:NativeFileDialogServices&{input():Promise<NativeMenuInput>;draw(input:{names:ReadonlyArray<string>;path:string;selected:number;scroll:number}):NativeFileDialogPresentation},path:string,extension:string,onPathChange?:(path:string)=>void){
 const flow=originalFileDialogSession(path,extension);let step=flow.next(),presentation:NativeFileDialogPresentation|undefined,hoverLock:{x:number;y:number}|null=null;
 while(!step.done){let reply:OriginalFileDialogReply;const effect=step.value;
  if(effect.type==='enumerate')reply={paths:await host.enumerate(effect.path,effect.extension)};
  else if(effect.type==='draw')presentation=host.draw(effect);
  else if(effect.type==='edit-path'){
   hoverLock=null;
   presentation??=host.draw({names:[],path:effect.path,selected:0,scroll:0});
   reply=await host.editPath(effect.path,effect.length,effect.timeout,presentation.fields[1]);onPathChange?.(reply.path);
  }else{
   const input=await host.input();
   if(input.wheelDelta){
    // Wheel scrolling moves a complete seven-row page and never enters the path field.
    hoverLock={x:input.x,y:input.y};
    reply={key:input.wheelDelta<0?0x4900:0x5100,buttons:0,hit:-1};
   }else{
    if(hoverLock&&(input.x!==hoverLock.x||input.y!==hoverLock.y))hoverLock=null;
    const hit=input.mouseActive&&!hoverLock?presentation!.hits.findIndex(r=>input.x>=r.left&&input.x<=r.right&&input.y>=r.top&&input.y<=r.bottom):-1;
    reply={key:input.key,buttons:input.buttons,hit};
   }
  }
  step=flow.next(reply);
 }
 return step.value;
}
