const storageKey='playstunts-dx-current-player-car';

function normaliseCarId(value:string){
 return value.trim().toUpperCase();
}

export function carIdFromConfiguration(configuration:readonly number[],offset=0){
 return normaliseCarId(String.fromCharCode(...configuration.slice(offset,offset+4)));
}

export function rememberCurrentPlayerCar(id:string){
 const value=normaliseCarId(id);
 if(!value||typeof window==='undefined')return;
 try{window.localStorage.setItem(storageKey,value);}catch{}
}

export function currentPlayerCarId(){
 if(typeof window==='undefined')return '';
 try{return normaliseCarId(window.localStorage.getItem(storageKey)??'');}catch{return '';}
}
