import * as THREE from 'three';
import {ENTRY} from './interior.js';

// Preserve the source model; omit only its explicitly unverified backdrop.
export function removeApartmentBackdrop(root){
 let removed=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const excluded=materials.map(m=>m?.name==='Neighbouring massing unverified');
  if(excluded.every(Boolean)){mesh.visible=false;removed++;}
  else if(excluded.some(Boolean)){
   mesh.geometry=mesh.geometry.clone();
   mesh.geometry.groups=mesh.geometry.groups.filter(g=>!excluded[g.materialIndex]);removed++;
  }
 });
 // Apartment windows and roof caps share materials with the school. Their
 // triangles lie outside the campus; retain school triangles and low boundary walls.
 root.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||!['Parapet concrete','Glazing variation 01'].includes(mesh.material?.name))return;
  const source=mesh.geometry,positions=source.attributes.position,index=source.index,keep=[];
  for(let i=0;i<(index?.count??positions.count);i+=3){
   const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
   const x=ids.reduce((v,id)=>v+positions.getX(id),0)/3,y=ids.reduce((v,id)=>v+positions.getY(id),0)/3,z=ids.reduce((v,id)=>v+positions.getZ(id),0)/3;
   if(!(y>1&&(x< -69||x>84||z< -61)))keep.push(...ids);
  }
  if(keep.length<(index?.count??positions.count)){mesh.geometry=source.clone();mesh.geometry.setIndex(keep);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();removed++;}
 });
 return removed;
}
export function atEntrance(p){return Math.abs(p.x-ENTRY.x)<.7&&p.z<7.7&&p.z>6.5;}
export function createEntrance(){
 const group=new THREE.Group();group.name='체험용 학교 출입문';
 const frame=new THREE.MeshStandardMaterial({color:'#d6e3dc',roughness:.7});
 const glass=new THREE.MeshStandardMaterial({color:'#234b4b',roughness:.3});
 const brass=new THREE.MeshStandardMaterial({color:'#f6d68a',roughness:.4});
 function box(w,h,d,x,y,z,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;group.add(m);}
 // Door is a visual scene portal, not a claim about the real school's layout.
 for(const x of [-1.1,1.1])box(.16,2.65,.3,x,1.575,6.75,frame);
 box(2.36,.18,.3,0,2.9,6.75,frame);
 for(const x of [-.53,.53]){box(1.02,2.4,.12,x,1.55,6.72,glass);box(.06,.5,.12,x<0?-.13:.13,1.4,6.84,brass);}
 box(2.4,.08,1.4,0,.27,7.3,frame);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#214b40';ctx.fillRect(0,0,768,128);ctx.fillStyle='white';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText('실내 입구 · 걸어서 들어가기',384,80);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));sign.position.set(0,3.4,6.95);group.add(sign);
 group.position.x=ENTRY.x;return group;
}
