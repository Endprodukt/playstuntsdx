import {readOriginalMaterialPatterns} from './original-material-pattern';
import * as THREE from 'three';
import {createCarModel} from './car-model';
import {applyUpgradedCarMaterials,addUpgradedCarStudyLights,setUpgradedCarGroundContactPanels} from './upgraded-car-materials';
import {createUpgradedRetroLighting} from './upgraded-retro-lighting';
import {SHOWROOM_SUN,SHOWROOM_SHADOW_WORLD_SCALE} from './showroom-lighting';
import {readUpgradedShape} from './upgraded-submission';
import {rotateZXY,transpose} from '../physics/rotation';
import {vecTransform} from '../physics/math';
/** Depth-tested original showroom geometry. Unlike the source painter queue,
 * every face remains available as the car rotates; no simulation is owned here. */
export function createUpgradedCarMenu(palette:number[],indices:number[]){
 const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene(),world=new THREE.Group();world.scale.z=-1;scene.add(world);
 scene.background=new THREE.Color(0x101b25);scene.fog=new THREE.Fog(0x101b25,16*400,36*400);
 addUpgradedCarStudyLights(scene,SHOWROOM_SUN);
 const retroLighting=createUpgradedRetroLighting({sunDirection:SHOWROOM_SUN,worldScale:SHOWROOM_SHADOW_WORLD_SCALE*400});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100*400,100*400),new THREE.MeshBasicMaterial({color:0x172731,toneMapped:false}));
 floor.rotation.x=-Math.PI/2;floor.userData.retroDistanceColour=false;world.add(floor);retroLighting.apply(floor,true,false);
 const grid=new THREE.GridHelper(40*400,40,0x47606a,0x243942);grid.userData.originalEdgeVisibility=true;
 for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.toneMapped=false;
 world.add(grid);
 const camera=new THREE.PerspectiveCamera();camera.near=1;camera.far=30000;
 let model:THREE.Group|undefined,bank:Uint8Array|undefined,lastPaint=-1,lastBuildMilliseconds:number|undefined,floorDirty=true;
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
  if(bank!==memory||lastPaint!==paint){buildStarted=performance.now();retired=model;retired?.removeFromParent();const shape=readUpgradedShape(memory,0x7f16);model=createCarModel(shape,0xffffff,{palette,indices,paint,paletteMaterial:memory[d+0x9b28],...readOriginalMaterialPatterns(memory)});applyUpgradedCarMaterials(model,shape);setUpgradedCarGroundContactPanels(model,true);model.scale.setScalar(400);world.add(model);bank=memory;lastPaint=paint;floorDirty=true;}
  const zoom=Math.max(.6,Math.min(1.9,rotation?.zoom??1)),yaw=word(0xb00e)*Math.PI/512;
  model!.scale.setScalar(400);model!.position.set(0,-840,2880);model!.rotation.order='YXZ';model!.rotation.set(0,yaw,0);
  if(floorDirty){
   const contact=roadContactY(model!);floor.position.y=contact-.75;grid.position.y=contact;floorDirty=false;
  }
  model!.rotation.set(rotation?.pitch??0,yaw,rotation?.roll??0);
  const inverse=transpose(rotateZXY(0,-46,0,true)),forward=vecTransform([0,0,16384],inverse),up=vecTransform([0,16384,0],inverse);
  camera.position.set(0,0,0);camera.up.set(up[0],up[1],-up[2]);camera.lookAt(forward[0],forward[1],-forward[2]);
  const [cx,cy,fx,fy]=[0,1,2,3].map(i=>word(0x4b88+i*2)),zoomFx=fx*zoom,zoomFy=fy*zoom;
  camera.projectionMatrix.makePerspective(-cx/zoomFx,(320-cx)/zoomFx,cy/zoomFy,-(200-cy)/zoomFy,1,30000);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  if(renderer.domElement.width!==width||renderer.domElement.height!==height)renderer.setSize(width,height,false);
  retroLighting.drawShadows(renderer,[model!],scene);
  renderer.render(scene,camera);
  // Dispose the previous car only after the replacement has acquired the
  // shared GPU programs. This prevents every menu change recompiling them.
  disposeModel(retired);if(buildStarted!==undefined)lastBuildMilliseconds=performance.now()-buildStarted;return renderer.domElement;
 },get lastBuildMilliseconds(){return lastBuildMilliseconds;},close(){disposeModel(model);retroLighting.dispose();floor.geometry.dispose();for(const material of Array.isArray(floor.material)?floor.material:[floor.material])material.dispose();grid.geometry.dispose();for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
