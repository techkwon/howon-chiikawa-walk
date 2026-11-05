import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {safeMove} from '../src/direct-control.js';
import {steerHeading} from '../src/camera-follow.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const actorSource=source.slice(source.indexOf('function updateInteriorActor(dt){'),source.indexOf('function updateInteriorCamera(dt){'));
function fixture(){
 const position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},actor={model:{position,rotation:{y:0}},shadow:{position:{set(){}}},ring:{position:{set(){}}}};
 let vector={x:0,z:0};
 const ctx={actors:[actor],selected:0,input:{getVector:()=>vector,isRunning:()=>false},paused:false,steerHeading,safeMove,interior:{world:()=>({bounds:{x1:-100,x2:100,z1:-100,z2:100},boxes:[]}),update(){}},time:0,reducedMotion:false,animateCharacter(){},updateInteriorUI(){}};
 vm.createContext(ctx);vm.runInContext(actorSource,ctx);
 return {actor,setVector:v=>vector=v,step:dt=>ctx.updateInteriorActor(dt)};
}
function distanceAt(magnitude){const f=fixture();f.setVector({x:0,z:-magnitude});for(let i=0;i<120;i++)f.step(1/60);return f.actor.model.position.z;}
test('indoor analog forward response is proportional rather than squared',()=>{
 const full=distanceAt(1),half=distanceAt(.5),ratio=half/full;
 assert.ok(Math.abs(ratio-.5)<.02,`50% input travels ${(ratio*100).toFixed(1)}% of full distance; expected 50%`);
});
test('indoor input release immediately stops translation',()=>{
 const f=fixture();f.setVector({x:0,z:-1});for(let i=0;i<30;i++)f.step(1/60);f.setVector({x:0,z:0});const before=f.actor.model.position.z;for(let i=0;i<30;i++)f.step(1/60);assert.equal(f.actor.model.position.z,before);
});
test('indoor walking over one second is comparable at 30, 60 and 120 FPS',()=>{
 const distances=[30,60,120].map(fps=>{const f=fixture();f.setVector({x:0,z:-1});for(let i=0;i<fps;i++)f.step(1/fps);return f.actor.model.position.z;});
 assert.ok(Math.max(...distances)-Math.min(...distances)<.03,JSON.stringify(distances));
});
