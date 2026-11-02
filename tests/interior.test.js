import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInterior,nearestInteraction} from '../src/interior.js';
import {safeMove,CHARACTER_RADIUS} from '../src/direct-control.js';
import {createCharacter,animateCharacter} from '../src/characters.js';
function makeInterior(){const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};try{return createInterior();}finally{globalThis.document=previous;}}
function move(room,p,v,frames=60){for(let i=0;i<frames;i++)p=safeMove(p,v,.05,2,[],room.world());return p;}
test('closed room doors block movement; open doors admit the full character footprint both ways',()=>{
 for(const [id,x] of [['classroom',-5],['library',5]]){
  const room=makeInterior();let p=move(room,{x,z:2},{x:0,z:-1},25);assert.ok(p.z>=.1+CHARACTER_RADIUS);
  room.interact(id);room.update(.6,false);p=move(room,p,{x:0,z:-1},18);assert.ok(p.z<-.8);p=move(room,p,{x:0,z:1},30);assert.ok(p.z>1.4);
 }
});
test('furniture sweep and wall sweep cannot tunnel even at high speed',()=>{
 const room=makeInterior();const world=room.world();
 let p=safeMove({x:-6.5,z:-1.3},{x:0,z:-1},.05,10000,[],world);assert.ok(p.z>-2.2,'first desk stops the body');
 p=safeMove({x:-8.6,z:-5.4},{x:-1,z:0},.05,10000,[],world);assert.ok(p.x>=-9.55);
 for(let i=0;i<400;i++){p=safeMove(p,{x:Math.sin(i*1.7),z:Math.cos(i*.91)},.05,10,[],world);assert.ok(p.x>=-10+CHARACTER_RADIUS&&p.x<=10-CHARACTER_RADIUS&&p.z>=-9+CHARACTER_RADIUS&&p.z<=4-CHARACTER_RADIUS);}
});
test('interaction is proximity gated and already open doors no longer obscure object actions',()=>{
 assert.equal(nearestInteraction({x:0,z:-5},{}),null);
 assert.equal(nearestInteraction({x:-5,z:1.2},{}).id,'classroom');
 assert.equal(nearestInteraction({x:-5,z:1.2},{classroom:true}),null);
 assert.equal(nearestInteraction({x:7.7,z:-5},{}).id,'book');
});
test('scaled characters fit a 2.25m door including rabbit ears',()=>{
 for(const kind of ['chiikawa','hachiware','usagi']){const actor=createCharacter(kind);actor.scale.setScalar(.5);const b=new THREE.Box3().setFromObject(actor);assert.ok(b.max.y>1.2&&b.max.y<1.7);assert.ok(b.max.x-b.min.x<1.6);}
});
test('gait phase follows actual travel and eases to rest without time-driven skating',()=>{
 const actor=createCharacter();animateCharacter(actor,{dt:.05,distance:.2,time:1,walking:true});const d=actor.userData.character,phase=d.gaitPhase,blend=d.walkBlend;assert.ok(blend>0&&blend<1);
 animateCharacter(actor,{dt:.05,distance:0,time:100,walking:false});assert.equal(d.gaitPhase,phase);assert.ok(d.walkBlend<blend);
 for(let i=0;i<30;i++)animateCharacter(actor,{dt:.05,distance:0,time:100+i,walking:false,reducedMotion:true});assert.ok(Math.abs(d.legs[0].rotation.x)<.001);assert.equal(d.rig.position.y,0);assert.equal(d.head.rotation.y,0);
});
