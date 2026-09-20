import * as THREE from 'three';
import trackMaterials from '../../public/game/track-materials.json';
import trackRenderModels from '../../public/game/track-render-models.json';
import terrainObjects from '../../public/game/terrain-objects.json';
import {createTrackModel,createTrackModelFactory,type TrackMaterials} from './track-model.ts';
import {trackRenderPlacement} from './track-render-placement.ts';
import {hillRenderSelection} from './hill-render-selection.ts';
import {elevatedRoadUnderlays} from './elevated-road-underlays.ts';
import type {Assets} from './types.ts';
import type {BlissTrack} from './bliss-track.ts';
import {BLISS_TRANSPARENT_COLOUR,blissTrackMetadata} from './bliss-metadata.ts';
import {blissElementData} from './bliss-element-data.ts';

export interface BlissEditor3DCell {x:number;y:number}
export interface BlissEditor3DCameraState {position:[number,number,number];target:[number,number,number];fov:number}
export interface BlissEditor3DLayers {ground:boolean;terrain:boolean;track:boolean;buildings:boolean;items:boolean}
export interface BlissEditor3DView {
 render():void;
 update(track:BlissTrack):void;
 resetView():void;
 cellAt(clientX:number,clientY:number):BlissEditor3DCell|null;
 setHover(cell:BlissEditor3DCell|null):void;
 setGhost(cell:BlissEditor3DCell|null,code:number,terrain:boolean,terrainCode:number):void;
 orbit(dx:number,dy:number):void;
 pan(dx:number,dy:number):void;
 dolly(delta:number,clientX:number,clientY:number):void;
 setLayers(layers:Partial<BlissEditor3DLayers>):void;
 projectWorld(x:number,z:number,y?:number):{x:number;y:number}|null;
 roadHeightAt(x:number,z:number):number|null;
 worldAt(clientX:number,clientY:number):{x:number;z:number}|null;
 cameraState():BlissEditor3DCameraState;
 close():void;
}

export function createBlissEditor3DView(canvas:HTMLCanvasElement,assets:Assets,track:BlissTrack,options:{initialCamera?:{position:[number,number,number];target:[number,number,number];fov?:number};transparentBackground?:boolean;showGround?:boolean;showAnnotations?:boolean;layers?:Partial<BlissEditor3DLayers>}={}):BlissEditor3DView{
 const transparentBackground=!!options.transparentBackground;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:transparentBackground,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
 renderer.setClearColor(transparentBackground?0x000000:0x88a0b8,transparentBackground?0:1);

 const scene=new THREE.Scene(),world=new THREE.Group();
 world.scale.z=-1;scene.add(world);
 const camera=new THREE.PerspectiveCamera(options.initialCamera?.fov??55,1,20,180000);
 const defaultTarget=new THREE.Vector3(...(options.initialCamera?.target??[15360,0,-15360] as [number,number,number]));
 const defaultPosition=new THREE.Vector3(...(options.initialCamera?.position??[
  defaultTarget.x+Math.sin(-.72)*Math.cos(.62)*26000,
  defaultTarget.y+Math.sin(.62)*26000,
  defaultTarget.z+Math.cos(-.72)*Math.cos(.62)*26000
 ] as [number,number,number]));
 const target=defaultTarget.clone();
 const initialOffset=defaultPosition.clone().sub(defaultTarget);
 const initialDistance=Math.max(1,initialOffset.length());
 const initialElevation=Math.asin(THREE.MathUtils.clamp(initialOffset.y/initialDistance,-1,1));
 const initialAzimuth=Math.atan2(initialOffset.x,initialOffset.z);
 let distance=initialDistance,azimuth=initialAzimuth,elevation=initialElevation;

 const light=new THREE.HemisphereLight(0xffffff,0x586030,1.15);scene.add(light);
 const materials=trackMaterials as TrackMaterials;
 let modelFactory=createTrackModelFactory(materials,2);
 const content=new THREE.Group(),groundRoot=new THREE.Group(),groundSupportRoot=new THREE.Group(),terrainRoot=new THREE.Group(),trackRoot=new THREE.Group(),buildingsRoot=new THREE.Group(),itemsRoot=new THREE.Group(),annotationRoot=new THREE.Group(),ghostRoot=new THREE.Group();
 content.add(groundRoot,groundSupportRoot,terrainRoot,trackRoot,buildingsRoot,itemsRoot);world.add(content,annotationRoot,ghostRoot);
 annotationRoot.visible=options.showAnnotations!==false;
 const layerState:BlissEditor3DLayers={ground:options.showGround!==false,terrain:true,track:true,buildings:true,items:true,...options.layers};

 const base=new THREE.Mesh(
  new THREE.PlaneGeometry(30720,30720),
  new THREE.MeshBasicMaterial({color:0x466f35,side:THREE.DoubleSide,toneMapped:false})
 );
 base.rotation.x=-Math.PI/2;base.position.set(15360,-700,15360);base.visible=layerState.ground;world.add(base);

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
    if(terrainCode===6&&descriptor){
     const origin=trackRenderPlacement(descriptor,cell.x,row,450,0).position,high=assets.shapes.GAME2?.high;
     if(high)for(const underlay of elevatedRoadUnderlays(origin,descriptor.multiTile)){
      const grass=makeGhost(createTrackModel(high,materials,0,true,2));grass.position.set(...underlay.position);ghostRoot.add(grass);
     }
    }
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

 const colour565=(value:number)=>{
  const r=((value>>>11)&31)/31,g=((value>>>5)&63)/63,b=(value&31)/31;return new THREE.Color(r,g,b);
 };
 const rebuildAnnotations=(source:BlissTrack)=>{
  while(annotationRoot.children.length){const child=annotationRoot.children[annotationRoot.children.length-1];annotationRoot.remove(child);disposeObject(child);}
  const colours=blissTrackMetadata(source)?.metadata.colours;if(!colours)return;
  const borderGeometry=new THREE.BufferGeometry(),borderPositions:number[]=[],borderColors:number[]=[];
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   const at=y*30+x,bg=colours.background[at],border=colours.border[at],row=29-y,cx=x*1024+512,cz=row*1024+512;
   if(bg!==BLISS_TRANSPARENT_COLOUR){
    const material=new THREE.MeshBasicMaterial({color:colour565(bg),transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    const cell=new THREE.Mesh(new THREE.PlaneGeometry(1016,1016),material);
    cell.rotation.x=-Math.PI/2;cell.position.set(cx,24,cz);cell.renderOrder=80;annotationRoot.add(cell);
   }
   if(border!==BLISS_TRANSPARENT_COLOUR){
    const color=colour565(border),left=cx-506,right=cx+506,top=cz-506,bottom=cz+506,yPos=30;
    const segments=[[left,yPos,top,right,yPos,top],[right,yPos,top,right,yPos,bottom],[right,yPos,bottom,left,yPos,bottom],[left,yPos,bottom,left,yPos,top]];
    for(const segment of segments){borderPositions.push(...segment);for(let i=0;i<2;i++)borderColors.push(color.r,color.g,color.b);}
   }
  }
  if(borderPositions.length){
   borderGeometry.setAttribute('position',new THREE.Float32BufferAttribute(borderPositions,3));
   borderGeometry.setAttribute('color',new THREE.Float32BufferAttribute(borderColors,3));
   const lines=new THREE.LineSegments(borderGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));
   lines.renderOrder=90;annotationRoot.add(lines);
  }else borderGeometry.dispose();
 };

 const clearRoot=(root:THREE.Group)=>{while(root.children.length){const child=root.children[root.children.length-1];root.remove(child);disposeObject(child);}};
 const flatTerrain=(source:BlissTrack)=>{
  const grass:number[]=[],supportGrass:number[]=[],water:number[]=[],support=new Set<string>();
  const cell=(target:number[],x:number,y:number,h:number)=>{
   if(x<0||x>=30||y<0||y>=30)return;
   const row=29-y,x0=x*1024,x1=x0+1024,z0=row*1024,z1=z0+1024;
   target.push(x0,h,z0,x1,h,z0,x1,h,z1,x0,h,z0,x1,h,z1,x0,h,z1);
  };
  // Keep support only directly underneath actual hill/slope cells. Expanding
  // this into neighbouring flat cells made Ground appear partially enabled in
  // the race map even when the Ground layer was switched off.
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   const terrain=source.terrain[y*30+x];
   if(terrain>=6)support.add(x+','+y);
   if(terrain>=1&&terrain<=5)cell(water,x,y,-2);
  }
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
   if(source.terrain[y*30+x]===0&&!support.has(x+','+y))cell(grass,x,y,-1);
  }
  for(const key of support){
   const [x,y]=key.split(',').map(Number);
   if(x>=0&&x<30&&y>=0&&y<30)cell(supportGrass,x,y,-1);
  }
  const add=(root:THREE.Group,vertices:number[],colour:number,order:number)=>{
   if(!vertices.length)return;
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:colour,side:THREE.DoubleSide,toneMapped:false}));
   mesh.renderOrder=order;root.add(mesh);
  };
  add(terrainRoot,water,0x0080d0,-.6);
  add(groundRoot,grass,0x466f35,-.5);
  add(groundSupportRoot,supportGrass,0x466f35,-.45);
 };
 const applyLayers=()=>{
  base.visible=layerState.ground;groundRoot.visible=layerState.ground;
  // Hill support belongs to Ground when shown, and remains behind Terrain when
  // Ground is hidden so slope overhangs do not turn into transparent holes.
  groundSupportRoot.visible=layerState.ground||layerState.terrain;
  terrainRoot.visible=layerState.terrain;trackRoot.visible=layerState.track;buildingsRoot.visible=layerState.buildings;itemsRoot.visible=layerState.items;
 };
 const rebuild=(source:BlissTrack)=>{
  clearRoot(groundRoot);clearRoot(groundSupportRoot);clearRoot(terrainRoot);clearRoot(trackRoot);clearRoot(buildingsRoot);clearRoot(itemsRoot);
  modelFactory=createTrackModelFactory(materials,2);rebuildAnnotations(source);flatTerrain(source);
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
      model.rotation.y=descriptor.rotation*Math.PI/512;terrainRoot.add(model);
     }
    }
   }
   if(!sourceId||sourceId>=253||!selected.tile)continue;
   const descriptor=(trackRenderModels as Record<string,{id:number;shape?:string;detailShape?:string;overlay?:number;rotation:number;multiTile:number;paint:number}>)[String(selected.tile)];
   if(!descriptor)continue;
   const origin=trackRenderPlacement(descriptor,x,row,terrain===6?450:0,0).position;
   if(terrain===6){
    const high=assets.shapes.GAME2?.high;
    if(high)for(const underlay of elevatedRoadUnderlays(origin,descriptor.multiTile)){
     const grass=modelFactory(high,0,true);grass.position.set(...underlay.position);terrainRoot.add(grass);
    }
   }
   const element=blissElementData[sourceId],road=!!element&&(element.ctype.some(value=>value!==0)||(sourceId>=105&&sourceId<=108)),building=!road&&/(tennis|station|barn|office|windmill|ship|diner)/i.test(element?.id??'');
   const root=road?trackRoot:building?buildingsRoot:itemsRoot;
   const parts=[descriptor,...(descriptor.overlay?[(trackRenderModels as Record<string,typeof descriptor>)[String(descriptor.overlay)]]:[])].filter(Boolean);
   for(const part of parts){
    if(!part?.shape)continue;
    const [group,name]=part.shape.split('.'),shape=assets.shapes[group]?.[name];
    if(!shape)continue;
    const placement=trackRenderPlacement(part,x,row,terrain===6?450:0,0);
    const paint=part.paint===255?0:placement.paint;
    const model=modelFactory(shape,paint);
    model.position.set(...placement.position);model.rotation.y=placement.rotation;root.add(model);
   }
  }
  applyLayers();
 };

 const updateCamera=()=>{
  const cos=Math.cos(elevation);
  camera.position.set(
   target.x+Math.sin(azimuth)*cos*distance,
   target.y+Math.sin(elevation)*distance,
   target.z+Math.cos(azimuth)*cos*distance
  );
  const vertical=Math.abs(Math.cos(elevation))<.015;
  camera.up.set(vertical?0:0,vertical?0:1,vertical?-1:0);camera.lookAt(target);
 };

 const resize=()=>{
  const width=Math.max(1,canvas.clientWidth||canvas.width),height=Math.max(1,canvas.clientHeight||canvas.height);
  const pixelWidth=Math.max(1,Math.round(width*renderer.getPixelRatio())),pixelHeight=Math.max(1,Math.round(height*renderer.getPixelRatio()));
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight)renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();
 };

 const render=()=>{resize();updateCamera();renderer.render(scene,camera);};
 const projectWorld=(x:number,z:number,y=0)=>{
  resize();updateCamera();
  const point=new THREE.Vector3(x,y,-z).project(camera);
  if(!Number.isFinite(point.x+point.y+point.z))return null;
  const width=Math.max(1,canvas.clientWidth||canvas.width),height=Math.max(1,canvas.clientHeight||canvas.height);
  return {x:(point.x*.5+.5)*width,y:(-.5*point.y+.5)*height};
 };
 const cellAt=(clientX:number,clientY:number)=>{
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  pointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObject(pickPlane,false)[0];if(!hit)return null;
  const x=Math.floor(hit.point.x/1024),row=Math.floor((-hit.point.z)/1024),y=29-row;
  return x>=0&&x<30&&y>=0&&y<30?{x,y}:null;
 };
 const roadHeightAt=(x:number,z:number)=>{
  const origin=new THREE.Vector3(THREE.MathUtils.clamp(x,0,30719),4000,-THREE.MathUtils.clamp(z,0,30719));
  raycaster.set(origin,new THREE.Vector3(0,-1,0));
  const hits=raycaster.intersectObject(trackRoot,true);
  if(!hits.length)return null;
  return hits[0].point.y;
 };
 const worldAt=(clientX:number,clientY:number)=>{
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  pointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
  raycaster.setFromCamera(pointer,camera);
  // Prefer the track visible under the pointer for the rough X/Z pick.
  // The caller still performs the final placement against the 2D track data,
  // so roofs/bridges only help identify the footprint and never define height.
  const roadHit=raycaster.intersectObject(trackRoot,true)[0];
  const hit=roadHit??raycaster.intersectObject(pickPlane,false)[0];if(!hit)return null;
  return {x:THREE.MathUtils.clamp(hit.point.x,0,30719),z:THREE.MathUtils.clamp(-hit.point.z,0,30719)};
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
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;if(!forward.lengthSq())forward.set(0,0,-1);forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  // "Grab" navigation: horizontal drag moves sideways, vertical drag moves
  // across the ground toward/away from the current view direction.
  target.addScaledVector(right,-dx*scale);target.addScaledVector(forward,dy*scale);
  target.x=Math.max(-4096,Math.min(34816,target.x));target.z=Math.max(-34816,Math.min(4096,target.z));render();
 };
 const dolly=(delta:number,clientX:number,clientY:number)=>{
  const before=cellAt(clientX,clientY),factor=Math.exp(delta*.0012);
  distance=Math.max(180,Math.min(90000,distance*factor));
  if(before){
   const aim=new THREE.Vector3(before.x*1024+512,0,-((29-before.y)*1024+512));
   target.lerp(aim,delta<0?.16:.06);
  }
  render();
 };
 const zoomPercent=()=>Math.round(initialDistance/distance*100);

 const resetView=()=>{
  target.copy(defaultTarget);distance=initialDistance;azimuth=initialAzimuth;elevation=initialElevation;camera.fov=options.initialCamera?.fov??55;camera.updateProjectionMatrix();render();
 };

 rebuild(track);render();
 return {
  render,
  update(source){rebuild(source);render();},
  resetView,
  zoomPercent,
  cellAt,
  setHover,
  setGhost,
  orbit,
  pan,
  dolly,
  setLayers(next){Object.assign(layerState,next);applyLayers();render();},
  projectWorld,roadHeightAt,worldAt,
  cameraState(){updateCamera();return {position:[camera.position.x,camera.position.y,camera.position.z],target:[target.x,target.y,target.z],fov:camera.fov};},
  close(){clearGhost();disposeObject(content);disposeObject(annotationRoot);disposeObject(base);hover.geometry.dispose();(hover.material as THREE.Material).dispose();pickPlane.geometry.dispose();(pickPlane.material as THREE.Material).dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
