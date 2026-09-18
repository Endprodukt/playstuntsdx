const ATTRIBUTE='data-playstunts-bliss-editor-active';

export function setBlissEditorActive(active:boolean){
 if(typeof document==='undefined')return;
 if(active)document.documentElement.setAttribute(ATTRIBUTE,'1');
 else document.documentElement.removeAttribute(ATTRIBUTE);
 const optionsRoot=document.querySelector<HTMLElement>('[data-playstunts-options-root]');
 if(optionsRoot)optionsRoot.style.display=active?'none':'block';
}

export function blissEditorActive(){
 return typeof document!=='undefined'&&document.documentElement.getAttribute(ATTRIBUTE)==='1';
}
