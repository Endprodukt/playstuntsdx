import * as THREE from 'three';
import trackMaterials from '../../public/game/track-materials.json';
import trackRenderModels from '../../public/game/track-render-models.json';
import terrainObjects from '../../public/game/terrain-objects.json';
import {createTrackModel,createTrackModelFactory,type TrackMaterials} from './track-model.ts';
import {trackRenderPlacement} from './track-render-placement.ts';
import {hillRenderSelection} from './hill-render-selection.ts';
import type {Assets} from './types.ts';
import type {BlissTrack} from './bliss-track.ts';

export interface BlissEditor3DCell {x:number;y:number}
export interface BlissEditor3DView {
 render():void;
 update(track:BlissTrack):void;
 cellAt(clientX:number,clientY:number):BlissEditor3DCell|null;
 setHover(cell:BlissEditor3DCell|null):void;
 setGhost(cell:BlissEditor3DCell|null,code:number,terrain:boolean,terrainCode:number):void;
 orbit(dx:number,dy:number):void;
 pan(dx:number,dy:number):void;
 dolly(delta:number,clientX:number,clientY:number):void;
 close():void;
}

export function createBlissEditor3DView(canvas:HTMLCanvasElement,assets:Assets,track:BlissTrack):BlissEditor3DView{
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
 renderer.setClearColor(0x88a0b8,1);

 const scene=new THREE.Scene(),world=new THREE.Group();
 world.scale.z=-1;scene.add(world);
 const camera=new THREE.PerspectiveCamera(55,1,20,180000);
 const target=new THREE.Vector3(15360,0,-15360);
 let distance=26000,azimuth=-.72,elevation=.62;

 const light=new THREE.HemisphereLight(0xffffff,0x586030,1.15);scene.add(light);
 const materials=trackMaterials as TrackMaterials;
 let modelFactory=createTrackModelFactory(materials,2);
 const content=new THREE.Group(),ghostRoot=new THREE.Group();world.add(content,ghostRoot);

 const base=new THREE.Mesh(
  new THREE.PlaneGeometry(30720,30720),
  new THREE.MeshBasicMaterial({color:0x466f35,side:THREE.DoubleSide,toneMapped:false})
 );
 base.rotation.x=-Math.PI/2;base.position.set(15360,-3,15360);world.add(base);

 const pickPlane=new THREE.Mesh(
  new THREE.PlaneGeometry(30720,30720),
  new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide})
 );
 pickPlane.rotation.x=-Math.PI/2;pickPlane.position.set(15360,0,-15360);scene.add(pickPlane);

 const hover=new THREE.Mesh(
  new THREE.PlaneGeometry(1010,1010),
  new THREE.MeshBasicMaterial({color:0xffff66,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide})
 );
 hover.rotation.x=-Math.PI/2;hover.position.y=12;hover.visible=false;scene.add(hover);

 const makeGhost=(model:THREE.Object3D)=>{
  model.traverse(node=>{
   const drawable=node as THREE.Mesh|THREE.Line;
   const material=(drawable as THREE.Mesh).material as THREE.Material|THREE.Material[]|undefined;
   if(!material)return;
   const ghostMaterial=(value:THREE.Material)=>{const clone=value.clone();clone.transparent=true;clone.opacity=.5;clone.depthWrite=false;return clone;};
   (drawable as THREE.Mesh).material=Array.isArray(material)?material.map(ghostMaterial):ghostMaterial(material);
   node.renderOrder=100;
  });
  return model;
 };
 const clearGhost=()=>{
  while(ghostRoot.children.length){const child=ghostRoot.children[ghostRoot.children.length-1];ghostRoot.remove(child);disposeObject(child);}
 };
 const setGhost=(cell:BlissEditor3DCell|null,code:number,terrain:boolean,terrainCode:number)=>{
  clearGhost();if(!cell)return;
  const row=29-cell.y;
  if(terrain){
   const selected=hillRenderSelection(code,0),descriptor=(terrainObjects as Array<{id:number;shape:string;rotation:number}>).find(entry=>entry.id===selected.terrain);
   if(descriptor){
    const [group,name]=descriptor.shape.split('.'),shape=assets.shapes[group]?.[name];
    if(shape){const model=makeGhost(createTrackModel(shape,materials,0,true,2));model.position.set(cell.x*1024+512,code===6?450:18,row*1024+512);model.rotation.y=descriptor.rotation*Math.PI/512;ghostRoot.add(model);}
   }
  }else if(code>0&&code<253){
   const selected=hillRenderSelection(terrainCode,code),descriptor=(trackRenderModels as Record<string,{id:number;shape?:string;overlay?:number;rotation:number;multiTile:number;paint:number}>)[String(selected.tile)];
   if(descriptor){
    const parts=[descriptor,...(descriptor.overlay?[(trackRenderModels as Record<string,typeof descriptor>)[String(descriptor.overlay)]]:[])].filter(Boolean);
    for(const part of parts){
     if(!part?.shape)continue;const [group,name]=part.shape.split('.'),shape=assets.shapes[group]?.[name];if(!shape)continue;
     const placement=trackRenderPlacement(part,cell.x,row,terrainCode===6?450:18,0),paint=part.paint===255?0:placement.paint;
     const model=makeGhost(createTrackModel(shape,materials,paint,false,2));model.position.set(...placement.position);model.rotation.y=placement.rotation;ghostRoot.add(model);
    }
   }
  }
  render();
 };

 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

 const disposeObject=(root:THREE.Object3D)=>{
  root.traverse(node=>{
   const drawable=node as THREE.Mesh|THREE.Line;
   const geometry=(drawable as THREE.Mesh).geometry as THREE.BufferGeometry|undefined;
   geometry?.dispose();
   const material=(drawable as THREE.Mesh).material as THREE.Material|THREE.Material[]|undefined;
   if(Array.isArray(material))material.forEach(value=>value.dispose());else material?.dispose();
  });
 };

 const rebuild=(source:BlissTrack)=>{
  while(content.children.length){const child=content.children[content.children.length-1];content.remove(child);disposeObject(child);}
  modelFactory=createTrackModelFactory(materials,2);
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   const at=y*30+x,terrain=source.terrain[at],sourceId=source.track[at],selected=hillRenderSelection(terrain,sourceId);
   const row=29-y;
   if(selected.terrain&&!(terrain===6&&sourceId!==0)){
    const descriptor=(terrainObjects as Array<{id:number;shape:string;rotation:number}>).find(entry=>entry.id===selected.terrain);
    if(descriptor){
     const [group,name]=descriptor.shape.split('.'),shape=assets.shapes[group]?.[name];
     if(shape){
      const model=modelFactory(shape,0,true);
      model.position.set(x*1024+512,terrain===6?450:0,row*1024+512);
      model.rotation.y=descriptor.rotation*Math.PI/512;content.add(model);
     }
    }
   }
   if(!sourceId||sourceId>=253||!selected.tile)continue;
   const descriptor=(trackRenderModels as Record<string,{id:number;shape?:string;detailShape?:string;overlay?:number;rotation:number;multiTile:number;paint:number}>)[String(selected.tile)];
   if(!descriptor)continue;
   const parts=[descriptor,...(descriptor.overlay?[(trackRenderModels as Record<string,typeof descriptor>)[String(descriptor.overlay)]]:[])].filter(Boolean);
   for(const part of parts){
    if(!part?.shape)continue;
    const [group,name]=part.shape.split('.'),shape=assets.shapes[group]?.[name];
    if(!shape)continue;
    const placement=trackRenderPlacement(part,x,row,terrain===6?450:0,0);
    const paint=part.paint===255?0:placement.paint;
    const model=modelFactory(shape,paint);
    model.position.set(...placement.position);model.rotation.y=placement.rotation;content.add(model);
   }
  }
 };

 const updateCamera=()=>{
  const cos=Math.cos(elevation);
  camera.position.set(
   target.x+Math.sin(azimuth)*cos*distance,
   target.y+Math.sin(elevation)*distance,
   target.z+Math.cos(azimuth)*cos*distance
  );
  camera.up.set(0,1,0);camera.lookAt(target);
 };

 const resize=()=>{
  const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
  const pixelWidth=Math.max(1,Math.round(width*renderer.getPixelRatio())),pixelHeight=Math.max(1,Math.round(height*renderer.getPixelRatio()));
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight)renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();
 };

 const render=()=>{resize();updateCamera();renderer.render(scene,camera);};
 const cellAt=(clientX:number,clientY:number)=>{
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  pointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObject(pickPlane,false)[0];if(!hit)return null;
  const x=Math.floor(hit.point.x/1024),row=Math.floor((-hit.point.z)/1024),y=29-row;
  return x>=0&&x<30&&y>=0&&y<30?{x,y}:null;
 };
 const setHover=(cell:BlissEditor3DCell|null)=>{
  if(!cell){hover.visible=false;render();return;}
  hover.visible=true;hover.position.x=cell.x*1024+512;hover.position.z=-((29-cell.y)*1024+512);render();
 };
 const orbit=(dx:number,dy:number)=>{
  azimuth-=dx*.007;elevation=Math.max(.08,Math.min(1.48,elevation+dy*.006));render();
 };
 const pan=(dx:number,dy:number)=>{
  const scale=Math.max(1,distance/900);
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  target.addScaledVector(right,-dx*scale);target.addScaledVector(new THREE.Vector3(0,1,0),dy*scale);
  target.x=Math.max(-4096,Math.min(34816,target.x));target.z=Math.max(-34816,Math.min(4096,target.z));target.y=Math.max(-2048,Math.min(12000,target.y));render();
 };
 const dolly=(delta:number,clientX:number,clientY:number)=>{
  const before=cellAt(clientX,clientY),factor=Math.exp(delta*.0012);
  distance=Math.max(900,Math.min(90000,distance*factor));
  if(before){
   const aim=new THREE.Vector3(before.x*1024+512,0,-((29-before.y)*1024+512));
   target.lerp(aim,delta<0?.16:.06);
  }
  render();
 };

 rebuild(track);render();
 return {
  render,
  update(source){rebuild(source);render();},
  cellAt,
  setHover,
  setGhost,
  orbit,
  pan,
  dolly,
  close(){clearGhost();disposeObject(content);disposeObject(base);hover.geometry.dispose();(hover.material as THREE.Material).dispose();pickPlane.geometry.dispose();(pickPlane.material as THREE.Material).dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
