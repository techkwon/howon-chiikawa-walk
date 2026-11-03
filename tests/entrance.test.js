import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {atEntrance,removeApartmentBackdrop} from '../src/entrance.js';
test('door threshold accepts the approach but not the exit landing or wall',()=>{
 assert.equal(atEntrance({x:-18,z:7.5}),true);
 for(const p of [{x:-18,z:9.5},{x:-17,z:7.5},{x:-18,z:6}])assert.equal(atEntrance(p),false);
});
test('unverified apartments are omitted while school geometry remains',()=>{
 const root=new THREE.Group(),school=new THREE.MeshStandardMaterial({name:'Warm red brick • procedural mortar'}),apartment=new THREE.MeshStandardMaterial({name:'Neighbouring massing unverified'});
 const geometry=new THREE.BoxGeometry();geometry.clearGroups();geometry.addGroup(0,18,0);geometry.addGroup(18,18,1);
 const mixed=new THREE.Mesh(geometry,[school,apartment]),backdrop=new THREE.Mesh(new THREE.BoxGeometry(),apartment);root.add(mixed,backdrop);
 assert.equal(removeApartmentBackdrop(root),2);assert.equal(backdrop.visible,false);assert.equal(mixed.visible,true);assert.deepEqual(mixed.geometry.groups,[{start:0,count:18,materialIndex:0}]);assert.equal(geometry.groups.length,2);
});
test('shared glazing removes remote apartment panes but keeps school windows',()=>{
 const root=new THREE.Group(),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-80,3,0,-79,3,0,-80,4,0,-18,3,6,-17,3,6,-18,4,6],3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({name:'Glazing variation 01'}));root.add(mesh);removeApartmentBackdrop(root);assert.deepEqual([...mesh.geometry.index.array],[3,4,5]);
});
