const ATTRIBUTE='data-playstunts-bliss-editor-active';

export function setBlissEditorActive(active:boolean){
 if(typeof document==='undefined')return;
 if(active)document.documentElement.setAttribute(ATTRIBUTE,'1');
 else document.documentElement.removeAttribute(ATTRIBUTE);
}

export function blissEditorActive(){
 return typeof document!=='undefined'&&document.documentElement.getAttribute(ATTRIBUTE)==='1';
}
