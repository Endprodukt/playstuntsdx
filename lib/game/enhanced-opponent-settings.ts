export type OpponentAiMode='original'|'enhanced';
export const opponentAiStorageKey='playstunts-dx-opponent-ai';

export function parseOpponentAiMode(value:string|null|undefined):OpponentAiMode{
 return value?.trim().toLowerCase()==='enhanced'?'enhanced':'original';
}
export function opponentAiMode():OpponentAiMode{
 if(typeof window==='undefined')return 'original';
 return parseOpponentAiMode(window.localStorage.getItem(opponentAiStorageKey));
}
export function setOpponentAiMode(mode:OpponentAiMode){
 if(typeof window!=='undefined')window.localStorage.setItem(opponentAiStorageKey,mode);
 return mode;
}
export function enhancedOpponentAiEnabled(){return opponentAiMode()==='enhanced';}
