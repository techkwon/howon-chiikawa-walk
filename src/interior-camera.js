import * as THREE from 'three';

const OFFSETS=[0,-.55,.55,-1.1,1.1,-1.6,1.6];
const ray=new THREE.Raycaster();
function clearSegment(start,end,walls,margin=.22){
 const delta=end.clone().sub(start),distance=delta.length();
 ray.set(start,delta.normalize());ray.far=distance;
 const hit=ray.intersectObjects(walls,false)[0];
 return hit?start.clone().addScaledVector(delta,Math.max(.12,hit.distance-margin)):end;
}
/** Keep distance by looking from a clear shoulder/side, instead of zooming into the actor at a wall. */
export function interiorCameraPose(position,heading,walls,previousChoice=0,portrait=false){
 const focus=new THREE.Vector3(position.x,position.y+.85,position.z);
 const forward=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
 const target=clearSegment(focus,focus.clone().addScaledVector(forward,.65),walls,.15);
 const candidates=OFFSETS.map((offset,index)=>{
  const angle=heading+offset;
  const desired=focus.clone().add(new THREE.Vector3(-Math.sin(angle)*4.3,2.05,-Math.cos(angle)*4.3));
  desired.y=Math.min(2.95,desired.y);
  const camera=clearSegment(focus,desired,walls);
  const distance=camera.distanceTo(focus);
  return {camera,distance,index,score:distance-Math.abs(offset)*.22+(index===previousChoice?.35:0)};
 });
 const best=candidates.reduce((a,b)=>a.score>b.score?a:b);
 return {camera:best.camera,target,focus,choice:best.index,distance:best.distance,fov:portrait?88:76,opacity:best.distance<2.6?.25:1};
}

export function constrainInteriorCamera(focus,position,walls){return clearSegment(focus,position,walls);}
