import {readOriginalMaterialPatterns} from './original-material-pattern';
import * as THREE from 'three';
import {createCarModel} from './car-model';
import {applyUpgradedCarMaterials,addUpgradedCarStudyLights,setUpgradedCarGroundContactPanels} from './upgraded-car-materials';
import {createUpgradedRetroLighting,RETRO_SUN} from './upgraded-retro-lighting';
import {SHOWROOM_SUN,SHOWROOM_SHADOW_WORLD_SCALE} from './showroom-lighting';
import {createShowroomCarModel} from './showroom-car-model.ts';
import type {Shape} from './types.ts';
import {readUpgradedShape} from './upgraded-submission';
import {rotateZXY,transpose} from '../physics/rotation';
import {vecTransform} from '../physics/math';
/** Depth-tested original showroom geometry. Unlike the source painter queue,
 * every face remains available as the car rotates; no simulation is owned here. */
export function createUpgradedCarMenu(palette:number[],indices:number[],options:{environment?:boolean}={}){
 const environment=!!options.environment;
 const renderer=new THREE.WebGLRenderer({alpha:!environment,antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
 if(environment)renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene(),world=new THREE.Group();world.scale.z=-1;scene.add(world);
 if(environment){scene.background=new THREE.Color(0x101b25);scene.fog=new THREE.Fog(0x101b25,16*400,36*400);}
 const lights=addUpgradedCarStudyLights(scene,environment?SHOWROOM_SUN:RETRO_SUN);
 if(environment){
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  lights.sun.castShadow=true;lights.sun.shadow.mapSize.set(2048,2048);
  lights.sun.shadow.camera.near=1;lights.sun.shadow.camera.far=12000;
  lights.sun.shadow.camera.left=-1800;lights.sun.shadow.camera.right=1800;lights.sun.shadow.camera.top=1800;lights.sun.shadow.camera.bottom=-1800;
  lights.sun.shadow.bias=-.00015;scene.add(lights.sun.target);
 }
 const floor=environment?new THREE.Mesh(new THREE.PlaneGeometry(100*400,100*400),new THREE.MeshStandardMaterial({color:0x172731,roughness:1,metalness:0,toneMapped:false})):undefined;
 if(floor){floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;world.add(floor);}
 const grid=environment?new THREE.GridHelper(40*400,40,0x47606a,0x243942):undefined;
 if(grid){grid.userData.originalEdgeVisibility=true;for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.toneMapped=false;world.add(grid);}
 const camera=new THREE.PerspectiveCamera();camera.near=1;camera.far=30000;
 let model:THREE.Group|undefined,bank:Uint8Array|undefined,lastPaint=-1,lastBuildMilliseconds:number|undefined,floorDirty=true,renderWidth=0,renderHeight=0;
 const roadContactY=(car:THREE.Group)=>{
  car.updateMatrixWorld(true);
  const tires:THREE.Mesh[]=[];car.traverse(node=>{if(node instanceof THREE.Mesh&&node.userData.originalWheelPart==='tire')tires.push(node);});
  if(!tires.length)return new THREE.Box3().setFromObject(car).min.y;
  const maxLateral=Math.max(...tires.map(tire=>Math.abs(tire.position.x)));
  const roadTires=tires.filter(tire=>Math.abs(tire.position.x)>=maxLateral*.75);
  return Math.min(...roadTires.map(tire=>new THREE.Box3().setFromObject(tire).min.y));
 };
 const disposeModel=(old:THREE.Group|undefined)=>{old?.traverse(node=>{if(node instanceof THREE.Mesh||node instanceof THREE.LineSegments){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();}});if(old)world.remove(old);};
 return {draw(memory:Uint8Array,width:number,height:number,rotation?:{pitch?:number;roll?:number;zoom?:number}){
  const d=0x2d1a0,v=new DataView(memory.buffer,memory.byteOffset,memory.byteLength),word=(at:number)=>v.getInt16(d+at,true),paint=memory[d+0xb013];
  let retired:THREE.Group|undefined,buildStarted:number|undefined;
  if(bank!==memory||lastPaint!==paint){buildStarted=performance.now();retired=model;retired?.removeFromParent();const shape=readUpgradedShape(memory,0x7f16);model=createCarModel(shape,0xffffff,{palette,indices,paint,paletteMaterial:memory[d+0x9b28],...readOriginalMaterialPatterns(memory)});applyUpgradedCarMaterials(model,shape);if(environment)setUpgradedCarGroundContactPanels(model,true);model.scale.setScalar(400);world.add(model);bank=memory;lastPaint=paint;floorDirty=environment;}
  const zoom=Math.max(.6,Math.min(1.9,rotation?.zoom??1)),yaw=word(0xb00e)*Math.PI/512;
  model!.scale.setScalar(400);model!.position.set(0,-840,2880);model!.rotation.order='YXZ';model!.rotation.set(0,yaw,0);
  if(floorDirty&&floor&&grid){
   const contact=roadContactY(model!);floor.position.y=contact;grid.position.y=contact+.002*400;
   const shadowTarget=new THREE.Vector3(0,contact+350,2880);
   lights.sun.target.position.copy(shadowTarget);
   lights.sun.position.copy(shadowTarget).addScaledVector(SHOWROOM_SUN,5000);
   lights.sun.target.updateMatrixWorld(true);lights.sun.updateMatrixWorld(true);
   floorDirty=false;
  }
  model!.rotation.set(rotation?.pitch??0,yaw,rotation?.roll??0);
  const inverse=transpose(rotateZXY(0,-46,0,true)),forward=vecTransform([0,0,16384],inverse),up=vecTransform([0,16384,0],inverse);
  camera.position.set(0,0,0);camera.up.set(up[0],up[1],-up[2]);camera.lookAt(forward[0],forward[1],-forward[2]);
  const [cx,cy,fx,fy]=[0,1,2,3].map(i=>word(0x4b88+i*2)),zoomFx=fx*zoom,zoomFy=fy*zoom;
  camera.projectionMatrix.makePerspective(-cx/zoomFx,(320-cx)/zoomFx,cy/zoomFy,-(200-cy)/zoomFy,1,30000);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  if(renderWidth!==width||renderHeight!==height){renderer.setSize(width,height,false);renderWidth=width;renderHeight=height;}
  renderer.render(scene,camera);
  // Dispose the previous car only after the replacement has acquired the
  // shared GPU programs. This prevents every menu change recompiling them.
  disposeModel(retired);if(buildStarted!==undefined)lastBuildMilliseconds=performance.now()-buildStarted;return renderer.domElement;
 },get lastBuildMilliseconds(){return lastBuildMilliseconds;},close(){disposeModel(model);if(floor){floor.geometry.dispose();for(const material of Array.isArray(floor.material)?floor.material:[floor.material])material.dispose();}if(grid){grid.geometry.dispose();for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.dispose();}renderer.dispose();renderer.forceContextLoss();}};
}


/** Modern Car Select showroom. This deliberately mirrors app/Garage.tsx:
 * the car is grounded and stationary while the camera orbits around it, so
 * the real floor/grid moves in perspective exactly like the website showroom.
 * The WebGL canvas is rendered at the preview's own display size and pixel
 * ratio, avoiding the old full-screen render -> crop -> rescale blur chain. */
export function createModernCarShowroom(palette:number[],indices:number[]){
 const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;

 const scene=new THREE.Scene();scene.background=new THREE.Color(0x101b25);scene.fog=new THREE.Fog(0x101b25,16,36);
 const camera=new THREE.PerspectiveCamera(36,1,.05,100);
 const target=new THREE.Vector3(0,.6,0),initial=new THREE.Vector3(6,3.1,7),offset=initial.clone().sub(target);
 const baseDistance=offset.length(),baseAzimuth=Math.atan2(offset.x,offset.z),baseElevation=Math.atan2(offset.y,Math.hypot(offset.x,offset.z));
 addUpgradedCarStudyLights(scene,SHOWROOM_SUN);
 const retroLighting=createUpgradedRetroLighting({sunDirection:SHOWROOM_SUN,worldScale:SHOWROOM_SHADOW_WORLD_SCALE});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:0x172731,toneMapped:false}));
 floor.rotation.x=-Math.PI/2;floor.userData.retroDistanceColour=false;scene.add(floor);retroLighting.apply(floor,true,false);
 const grid=new THREE.GridHelper(40,40,0x47606a,0x243942);grid.position.y=.002;grid.userData.originalEdgeVisibility=true;scene.add(grid);

 let model:THREE.Group|undefined,lastShape:Shape|undefined,lastRaceShape:Shape|undefined,lastPaint=-1,lastBuildMilliseconds:number|undefined,shadowDirty=true,renderWidth=0,renderHeight=0;
 const disposeModel=(old:THREE.Group|undefined)=>{old?.traverse(node=>{if(node instanceof THREE.Mesh||node instanceof THREE.LineSegments){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();}});if(old)scene.remove(old);};

 return {
  draw(shape:Shape,raceShape:Shape|undefined,paint:number,width:number,height:number,rotation?:{angle?:number;pitch?:number;zoom?:number}){
   let retired:THREE.Group|undefined,buildStarted:number|undefined;
   if(!model||shape!==lastShape||raceShape!==lastRaceShape||paint!==lastPaint){
    buildStarted=performance.now();retired=model;retired?.removeFromParent();
    model=createShowroomCarModel(shape,raceShape,{paint,indices,palette,paletteMaterial:0});
    scene.add(model);lastShape=shape;lastRaceShape=raceShape;lastPaint=paint;shadowDirty=true;
   }

   const zoom=Math.max(.6,Math.min(1.9,rotation?.zoom??1));
   const distance=THREE.MathUtils.clamp(baseDistance/zoom,4,16);
   const azimuth=baseAzimuth+(rotation?.angle??0)*Math.PI*2/1024;
   // Website OrbitControls never pass under the floor. Keep the same idea
   // while retaining the existing drag-return behavior from the Car Select.
   const elevation=THREE.MathUtils.clamp(baseElevation+(rotation?.pitch??0),Math.PI*.02,Math.PI*.45);
   const horizontal=Math.cos(elevation)*distance;
   camera.position.set(
    target.x+Math.sin(azimuth)*horizontal,
    target.y+Math.sin(elevation)*distance,
    target.z+Math.cos(azimuth)*horizontal,
   );
   camera.up.set(0,1,0);camera.lookAt(target);
   if(renderWidth!==width||renderHeight!==height){
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderWidth=width;renderHeight=height;
   }

   if(shadowDirty&&model){retroLighting.drawShadows(renderer,[model],scene);shadowDirty=false;}
   renderer.render(scene,camera);
   disposeModel(retired);if(buildStarted!==undefined)lastBuildMilliseconds=performance.now()-buildStarted;
   return renderer.domElement;
  },
  get lastBuildMilliseconds(){return lastBuildMilliseconds;},
  close(){
   disposeModel(model);retroLighting.dispose();
   floor.geometry.dispose();for(const material of Array.isArray(floor.material)?floor.material:[floor.material])material.dispose();
   grid.geometry.dispose();for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.dispose();
   renderer.dispose();renderer.forceContextLoss();
  }
 };
}
