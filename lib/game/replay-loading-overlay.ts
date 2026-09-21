export interface ReplayLoadingController {
 readonly cancelled:boolean;
 update(stage:string,detail?:string):void;
 throwIfCancelled():void;
 fail(reason:unknown):Promise<void>;
 close():void;
}
export function createReplayLoadingOverlay(canvas:HTMLCanvasElement,file:string):ReplayLoadingController{
 const parent=canvas.parentElement??document.body,computed=getComputedStyle(parent),restorePosition=computed.position==='static'?parent.style.position:null;
 if(computed.position==='static')parent.style.position='relative';
 const root=document.createElement('div'),panel=document.createElement('div'),eyebrow=document.createElement('div'),title=document.createElement('div'),fileLine=document.createElement('div'),current=document.createElement('div'),detail=document.createElement('div'),history=document.createElement('div'),footer=document.createElement('div'),back=document.createElement('button');
 root.dataset.playstuntsReplayLoading='true';root.style.cssText='position:absolute;inset:0;z-index:2147483600;display:grid;place-items:center;background:rgba(5,7,8,.64);backdrop-filter:blur(2px);pointer-events:auto;';
 panel.style.cssText='width:min(620px,82%);box-sizing:border-box;padding:22px 24px 20px;border:1px solid rgba(206,219,112,.56);border-radius:10px;background:linear-gradient(180deg,rgba(24,27,23,.97),rgba(12,13,12,.98));box-shadow:0 24px 90px rgba(0,0,0,.72);color:#f2f2e8;font:600 14px/1.35 Archivo,system-ui,Segoe UI,sans-serif;';
 eyebrow.textContent='PLAYSTUNTS DX';eyebrow.style.cssText='font-size:10px;letter-spacing:.22em;color:#9aa35c;margin-bottom:5px;';
 title.textContent='LOADING REPLAY';title.style.cssText='font-size:24px;font-weight:800;letter-spacing:.04em;margin-bottom:4px;';
 fileLine.textContent=file;fileLine.style.cssText='font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#a9aaa4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:20px;';
 current.style.cssText='font-size:17px;font-weight:750;color:#d9e47a;margin-bottom:4px;';
 detail.style.cssText='min-height:19px;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#c7c7bd;margin-bottom:16px;white-space:pre-wrap;';
 history.style.cssText='border-top:1px solid #33382e;padding-top:11px;min-height:58px;color:#858980;font-size:11px;';
 footer.style.cssText='display:flex;justify-content:flex-end;margin-top:18px;';
 back.type='button';back.textContent='BACK';back.style.cssText='min-width:108px;padding:9px 16px;border:1px solid #6e7545;border-radius:5px;background:#20231b;color:#e5e9c1;font:700 12px Archivo,system-ui,Segoe UI,sans-serif;letter-spacing:.06em;cursor:pointer;';
 footer.append(back);panel.append(eyebrow,title,fileLine,current,detail,history,footer);root.append(panel);parent.append(root);
 let isCancelled=false,closed=false,lastStage='',lastDetail='',errorMode=false;const completed:string[]=[];
 let cancelResolve!:()=>void;const cancelledPromise=new Promise<void>(resolve=>{cancelResolve=resolve;});
 const renderHistory=()=>{history.replaceChildren();for(const text of completed.slice(-5)){const line=document.createElement('div');line.textContent='✓  '+text;line.style.cssText='margin:2px 0;color:#80857b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';history.append(line);}};
 const cancel=()=>{if(closed||isCancelled)return;isCancelled=true;back.textContent='BACK…';current.textContent=errorMode?'Returning to Options…':'Cancelling replay load…';detail.textContent='';cancelResolve();};
 const onKey=(event:KeyboardEvent)=>{if(event.key!=='Escape')return;event.preventDefault();event.stopImmediatePropagation();cancel();};
 back.addEventListener('click',cancel);window.addEventListener('keydown',onKey,true);
 back.addEventListener('pointerenter',()=>{back.style.background='#30371d';back.style.borderColor='#d6e16a';back.style.color='#fff';});
 back.addEventListener('pointerleave',()=>{back.style.background='#20231b';back.style.borderColor='#6e7545';back.style.color='#e5e9c1';});
 const controller:ReplayLoadingController={
  get cancelled(){return isCancelled;},
  update(stage:string,nextDetail=''){if(closed||isCancelled||errorMode)return;if(lastStage&&stage!==lastStage){completed.push(lastDetail?lastStage+' — '+lastDetail:lastStage);renderHistory();}lastStage=stage;lastDetail=nextDetail;current.textContent=stage;detail.textContent=nextDetail;},
  throwIfCancelled(){if(!isCancelled)return;const error=new Error('Replay loading was cancelled');error.name='ReplayLoadingCancelled';throw error;},
  async fail(reason:unknown){if(closed)return;errorMode=true;const message=reason instanceof Error?reason.message:String(reason);if(lastStage){completed.push(lastDetail?lastStage+' — '+lastDetail:lastStage);renderHistory();}title.textContent='REPLAY COULD NOT LOAD';title.style.color='#f1d3b0';current.textContent='Stopped at: '+(lastStage||'Replay loading');current.style.color='#e3ad70';detail.textContent=message;detail.style.color='#e4c4a7';back.textContent='BACK TO OPTIONS';if(!isCancelled)await cancelledPromise;},
  close(){if(closed)return;closed=true;window.removeEventListener('keydown',onKey,true);root.remove();if(restorePosition!==null)parent.style.position=restorePosition;},
 };
 controller.update('Reading replay file');return controller;
}
