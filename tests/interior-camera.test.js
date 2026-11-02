import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {interiorCameraPose} from '../src/interior-camera.js';
import {createInterior} from '../src/interior.js';
function room(){const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};try{const r=createInterior();r.group.updateMatrixWorld(true);return r;}finally{globalThis.document=previous;}}
test('corridor and room cameras keep enough distance to show the scene without changing character scale',()=>{
 const r=room();r.interact('classroom');r.interact('library');r.update(1,true);r.group.updateMatrixWorld(true);const walls=r.cameraWalls.filter(m=>m.visible);
 for(const [x,z,heading] of [[0,2,-Math.PI/2],[-5,-1.35,Math.PI],[7.7,-5,-Math.PI/2]]){
  const p=interiorCameraPose({x,y:.02,z},heading,walls);assert.ok(p.distance>3.2,`camera crowded at ${x},${z}: ${p.distance}`);assert.equal(p.opacity,1);
  const mobile=interiorCameraPose({x,y:.02,z},heading,walls,0,true);assert.equal(mobile.fov,88);assert.ok(mobile.distance>3.2);
 }
});
test('camera rays do not pass through walls and very tight corners fade the avatar instead of hiding the target',()=>{
 const r=room();const ray=new THREE.Raycaster();
 for(const [x,z] of [[-9.4,3.4],[9.4,3.4],[-8.6,-5.4],[0,2],[-5,.55]])for(let i=0;i<16;i++){
  const position={x,y:.02,z};const p=interiorCameraPose(position,i*Math.PI/8,r.cameraWalls);assert.ok(p.camera.y<3.2&&p.camera.y>.02);
  const origin=new THREE.Vector3(x,.87,z),d=p.camera.clone().sub(origin);ray.set(origin,d.clone().normalize());ray.far=d.length();assert.equal(ray.intersectObjects(r.cameraWalls,false).length,0);
  if(p.distance<2.6)assert.equal(p.opacity,.25);
  assert.ok(p.camera.x>-10&&p.camera.x<10&&p.camera.z>-9&&p.camera.z<4);
 }
});
