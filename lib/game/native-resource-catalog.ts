export interface OriginalResourceFile {file:string;bytes:number;sha256:string}
/** Read-only supplied-game files. DOS directory prefixes refer to this mounted
 * distribution; user track/replay overlays remain owned by the menu file store. */
export function createNativeResourceCatalog(files:Record<string,OriginalResourceFile>,read:(file:string)=>Promise<Uint8Array>){
 const entries=new Map(Object.entries(files).map(([name,file])=>[name.toUpperCase(),file]));
 const cache=new Map<string,Promise<Uint8Array>>();
 const key=(name:string)=>name.replaceAll('/','\\').split('\\').pop()!.toUpperCase();
 return {
  exists(name:string){return entries.has(key(name));},
  async read(name:string):Promise<Uint8Array|null>{
   const normalized=key(name),entry=entries.get(normalized);if(!entry)return null;
   let pending=cache.get(normalized);
   if(!pending){pending=read(entry.file).then(bytes=>{if(bytes.length!==entry.bytes)throw Error('Original resource length mismatch: '+entry.file);return bytes.slice();}).catch(error=>{cache.delete(normalized);throw error;});cache.set(normalized,pending);}
   return (await pending).slice();
  },
 };
}
export async function loadBrowserOriginalResourceCatalog(){
 const originalRoot='/game/original-resources/',setupRoot='/game/setup-media/';
 const [originalResponse,setupResponse]=await Promise.all([fetch(originalRoot+'manifest.json'),fetch(setupRoot+'manifest.json')]);
 if(!originalResponse.ok)throw Error('Original resource catalog could not load');
 const originalManifest=await originalResponse.json() as {files:Record<string,OriginalResourceFile>};
 const original=createNativeResourceCatalog(originalManifest.files,async file=>{
  const response=await fetch(originalRoot+encodeURIComponent(file));if(!response.ok)throw Error('Original resource could not load: '+file);
  return new Uint8Array(await response.arrayBuffer());
 });
 // The portable preparation copies every user-supplied source file into
 // setup-media. Community cars are intentionally not part of the fixed
 // original-resources recipe, so expose that local copy as a fallback for the
 // original DOS resource loader. Original catalog entries keep precedence.
 if(!setupResponse.ok)return original;
 const setupManifest=await setupResponse.json() as {files:{name:string;bytes:number;sha256:string}[]};
 const supplemental=createNativeResourceCatalog(Object.fromEntries(setupManifest.files.map(file=>[file.name,{file:file.name,bytes:file.bytes,sha256:file.sha256}])),async file=>{
  const response=await fetch(setupRoot+encodeURIComponent(file));if(!response.ok)throw Error('Supplied resource could not load: '+file);
  return new Uint8Array(await response.arrayBuffer());
 });
 return {
  exists(name:string){return original.exists(name)||supplemental.exists(name);},
  async read(name:string):Promise<Uint8Array|null>{return await original.read(name)??supplemental.read(name);},
 };
}
