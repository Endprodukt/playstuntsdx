export interface ModernReplayChoice {
 label:string;
 path:string;
 name:string;
 customPath?:string;
}

export function pickModernReplay(canvas:HTMLCanvasElement,entries:ReadonlyArray<ModernReplayChoice>):Promise<ModernReplayChoice|undefined>{
 if(entries.length===0){
  window.alert('No replay files were found. Put .RPL files anywhere under Custom Tracks and try again.');
  return Promise.resolve(undefined);
 }
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog'),heading=document.createElement('div'),description=document.createElement('div'),list=document.createElement('select'),footer=document.createElement('div'),cancel=document.createElement('button'),load=document.createElement('button'),style=document.createElement('style');
  dialog.className='playstunts-replay-picker';
  dialog.style.cssText='width:min(760px,88vw);max-height:84vh;padding:18px;border:1px solid #6f783d;border-radius:8px;background:#101010;color:#eee;box-shadow:0 20px 80px #000;font:14px system-ui,Segoe UI,sans-serif;';
  style.textContent='.playstunts-replay-picker::backdrop{background:rgba(0,0,0,.76)}';
  heading.textContent='LOAD REPLAY';heading.style.cssText='font-size:20px;font-weight:750;color:#c2cd6c;margin-bottom:4px';
  description.textContent=`${entries.length} replay${entries.length===1?'':'s'} · Custom Tracks is searched recursively`;
  description.style.cssText='font-size:12px;color:#929292;margin-bottom:14px';
  list.size=Math.min(18,Math.max(8,entries.length));list.style.cssText='display:block;width:100%;box-sizing:border-box;background:#171717;color:#eee;border:1px solid #444;border-radius:5px;padding:5px;font:13px ui-monospace,SFMono-Regular,Consolas,monospace';
  entries.forEach((entry,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=entry.label;list.appendChild(option);});
  footer.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin-top:14px';
  for(const button of [cancel,load])button.style.cssText='min-width:96px;padding:8px 14px;border:1px solid #555;border-radius:5px;background:#202020;color:#ddd;font-weight:650;cursor:pointer';
  cancel.textContent='CANCEL';load.textContent='LOAD';load.style.borderColor='#899449';load.style.color='#d8e487';
  footer.append(cancel,load);dialog.append(style,heading,description,list,footer);document.body.appendChild(dialog);
  let finished=false;
  const finish=(choice?:ModernReplayChoice)=>{if(finished)return;finished=true;dialog.close();dialog.remove();canvas.focus({preventScroll:true});resolve(choice);};
  const selected=()=>entries[Math.max(0,list.selectedIndex)];
  cancel.addEventListener('click',()=>finish());
  load.addEventListener('click',()=>finish(selected()));
  list.addEventListener('dblclick',()=>finish(selected()));
  list.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();finish(selected());}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
  dialog.showModal();list.selectedIndex=0;list.focus();
 });
}
