// Exact non-graphical element metadata ported from Bliss 2.6.1 xlation.dat.
// Bliss copyright (C) 2016-2023 Lucas Pedrosa; GPLv3. See THIRD_PARTY_NOTICES.md.
export interface BlissElementData {
 id:string;xsmall:number;ysmall:number;
 ctype:readonly [number,number,number,number];
 cto:readonly [number,number,number,number];
 cisalt:readonly [number,number,number,number];
 length:number;material:number;entity:number;
}

const decodeBase64=(value:string)=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const output:number[]=[];let bits=0,buffer=0;
 for(const char of value){
  if(char==='=')break;
  const digit=alphabet.indexOf(char);if(digit<0)continue;
  buffer=(buffer<<6)|digit;bits+=6;
  if(bits>=8){bits-=8;output.push((buffer>>bits)&255);}
 }
 return Uint8Array.from(output);
};
const signed=(value:number)=>value>127?value-256:value;

const NAMES=["Nothing","Paved s/f line","Player's car","Opponent's car","Paved road","Paved road","Pvd. sharp cnr.","Pvd. sharp cnr.","Pvd. sharp cnr.","Pvd. sharp cnr.","Pvd. large cnr.","Pvd. large cnr.","Pvd. large cnr.","Pvd. large cnr.","Dirt road","Dirt road","Dirt sharp cnr.","Dirt sharp cnr.","Dirt sharp cnr.","Dirt sharp cnr.","Dirt large cnr.","Dirt large cnr.","Dirt large cnr.","Dirt large cnr.","Icy road","Icy road","Icy sharp cnr.","Icy sharp cnr.","Icy sharp cnr.","Icy sharp cnr.","Icy large cnr.","Icy large cnr.","Icy large cnr.","Icy large cnr.","Elevated road","Elevated road","Elevated ramp","Elevated ramp","Elevated ramp","Elevated ramp","Banked road s/e","Banked road s/e","Banked road s/e","Banked road s/e","Banked road s/e","Banked road s/e","Banked road s/e","Banked road s/e","Banked road","Banked road","Banked road","Banked road","Banked corner","Banked corner","Banked corner","Banked corner","Bridge ramp","Bridge ramp","Bridge ramp","Bridge ramp","Chicane","Chicane","Chicane","Chicane","Loop","Loop","Tunnel","Tunnel","Pipe","Pipe","Pipe start/end","Pipe start/end","Pipe start/end","Pipe start/end","Paved crossroad","Pvd. sharp split","Pvd. sharp split","Pvd. sharp split","Pvd. sharp split","Pvd. sharp split","Pvd. sharp split","Pvd. sharp split","Pvd. sharp split","Half pipe","Half pipe","Corkscrew","Corkscrew","Pvd. large split","Pvd. large split","Pvd. large split","Pvd. large split","Pvd. large split","Pvd. large split","Pvd. large split","Pvd. large split","Solid ramp","Solid ramp","Solid ramp","Solid ramp","Solid elev. road","Solid elev. road","Span over road","Span over road","Elevated span","Elevated span","Elevated corner","Elevated corner","Elevated corner","Elevated corner","Highway","Highway","Highway s/e","Highway s/e","Highway s/e","Highway s/e","Slalom road","Slalom road","CW spin","CW spin","CW spin","CW spin","CCW spin","CCW spin","CCW spin","CCW spin","Dirt crossroad","Dirt split","Dirt split","Dirt split","Dirt split","Dirt split","Dirt split","Dirt split","Dirt split","Dirt s/f line","Dirt s/f line","Dirt s/f line","Dirt s/f line","Icy crossroad","Icy split","Icy split","Icy split","Icy split","Icy split","Icy split","Icy split","Icy split","Icy s/f line","Icy s/f line","Icy s/f line","Icy s/f line","Palm tree","Cactus","Pine tree","Tennis court","Gas station","Gas station","Gas station","Gas station","Barn","Barn","Barn","Barn","Office building","Office building","Office building","Office building","Windmill","Windmill","Windmill","Windmill","Ship","Ship","Ship","Ship","Joe's diner","Joe's diner","Joe's diner","Joe's diner","Paved s/f line","Paved s/f line","Paved s/f line","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","Corner filler","Bottom filler","Side filler"] as const;

const unpackRle=(value:string)=>{
 const packed=decodeBase64(value),out:number[]=[];
 for(let i=0;i<packed.length;){
  const head=packed[i++];
  if(head&0x80){const count=(head&0x7f)+1,value=packed[i++];for(let n=0;n<count;n++)out.push(value);}
  else{const count=head+1;for(let n=0;n<count;n++)out.push(packed[i++]);}
 }
 return Uint8Array.from(out);
};
const FIELD_RAW=unpackRle('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AAsZAFQKEwIAAQAEAAGEAC54AGcKFAABAAIACAACAAEAAXgAZwkSAQACAAQAAQABAAEAeABnCBMAAgABAAgAAoMAHXgAZwkTAgABAAQAAQABAAEAeABnCBQAAQACAAgAAoMAC3gAZwoSAQACAAQAAYQAFXgAZwkUAAIAAQAIAAIAAQABeABnAACDAQMECAECgwAMDwJrAAABAAEBBAAJBIMAAh4CZIIAggEDAAwCAoMABB4CZAAAggEDAAYBAYQADB4CZAAAAQEAAQgIAAODAAQeAmQAAIIBAwAEBAOEAAweAmQAAAEBAAECCQACgwAMHgJkAAABAAEBDAABAYMAAh4CZIIAggEDAAgIBoMACx4CZAAAAQABAAQAAYQACxQCbwAAAQABAAQAAYQAAhQCb4IABgEAAQAIAAKDAAIUAm+CAAYBAAEACAACgwAEFAJvAACDAQMECAECgwAMFANrAAABAAEBBAAJBIMAAigDZIIAggEDAAwCAoMABCgDZAAAggEDAAYBAYQADCgDZAAAAQEAAQgIAAODAAQoA2QAAIIBAwAEBAOEAAwoA2QAAAEBAAECCQACgwAMKANkAAABAAEBDAABAYMAAigDZIIAggEDAAgIBoMACygDZAAAAQABAAQAAYQACyMDbwAAAQABAAQAAYQAAiMDb4IABgEAAQAIAAKDAAIjA2+CAAYBAAEACAACgwACIwNvjwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAAbo8AAG6PAABujwAJbgAAAQABAAQAAYQAAg8Bb4IABgEAAQAIAAKDAAIPAW+CAAYBAAEACAACgwACDwFv');
// Exact metadata for codes 0x00..0xB5 extracted from the user-supplied
// Bliss 2.6.1 xlation.dat. Unused codes are zero-filled.
if(FIELD_RAW.length!==182*17)throw Error('Embedded Bliss element table has the wrong size');
const FIELD_BYTES=new Uint8Array(256*17);
FIELD_BYTES.set(FIELD_RAW);

const elementAt=(code:number):BlissElementData=>{
 const o=code*17;
 return {
  id:NAMES[code],xsmall:FIELD_BYTES[o],ysmall:FIELD_BYTES[o+1],
  ctype:[FIELD_BYTES[o+2],FIELD_BYTES[o+3],FIELD_BYTES[o+4],FIELD_BYTES[o+5]] as const,
  cto:[FIELD_BYTES[o+6],FIELD_BYTES[o+7],FIELD_BYTES[o+8],FIELD_BYTES[o+9]] as const,
  cisalt:[signed(FIELD_BYTES[o+10]),signed(FIELD_BYTES[o+11]),signed(FIELD_BYTES[o+12]),signed(FIELD_BYTES[o+13])] as const,
  length:FIELD_BYTES[o+14],material:signed(FIELD_BYTES[o+15]),entity:FIELD_BYTES[o+16],
 };
};
export const blissElementData:readonly BlissElementData[]=Object.freeze(Array.from({length:256},(_,code)=>Object.freeze(elementAt(code))));

const PALETTE_BYTES=decodeBase64('AAYFBwG0SgQICbO1CgoLC0xSCgoLC1BODAwNDU9LDAwNDU1RABAPEYaIfQ4SE4eJFBQVFX+FFBQVFYOBFhYXF4J+FhYXF4CEABoZG5OVihgcHZSWHh4fH4ySHh4fH5COICAhIY+LICAhIY2RAABzO0dAODl0OkRASUVUSFNVQUFWVkZVQgAAAAAAQwAAAAAAACkyLy4qAC0zKzAxNDQ1NSgsNDQ1NQAANjY3NwAANjY3NwAAAABbW1dXAABbW1dXXFxZWV1dXFxZWV1dWlpYWF5eWlpYWF5eAABwbnJxAAAAAABtPDw9PQBvPDw9PQAAPj4/PwAAPj4/PwAAAAAkI2glAABfZmRgaWlqaidiaWlqaiJla2tsbGdja2tsbCZhAAB3d3t7AAB3d3t7eHh5eXV1eHh5eXV1enp8fHZ2enp8fHZ2mQCjpqSlmACfoqChlwCbnpydmgCnqqipAgCrrqytAwCvsrCxAAAAAAAAAAAAAQYAAAADAggHAAAEBQkKAAANDBEQAAAOCxIPAAAAAAAAAAAAAAAAAAEBBgYAAAEBBgYAAAAAAAAAAAAAAAAA');
if(PALETTE_BYTES.length!==12*36)throw Error('Embedded Bliss palette table has the wrong size');
export const blissPalettePages:readonly (readonly number[])[]=Object.freeze(Array.from({length:12},(_,page)=>Object.freeze(Array.from(PALETTE_BYTES.subarray(page*36,page*36+36)))));
