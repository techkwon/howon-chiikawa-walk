import test from 'node:test';import assert from 'node:assert/strict';import {NODES,EDGES,route,insideBuilding,lanePoint,TREES} from '../src/navigation.js';
test('all exterior waypoints are outside school buildings',()=>{for(const p of Object.values(NODES))assert.equal(insideBuilding(...p,.7),false)});
test('route segments do not cross a building',()=>{for(const [a,b] of EDGES){for(let i=0;i<=100;i++){const t=i/100,x=NODES[a][0]*(1-t)+NODES[b][0]*t,z=NODES[a][1]*(1-t)+NODES[b][1]*t;assert.equal(insideBuilding(x,z,.7),false,`${a}-${b}`)}}});
test('every destination reachable',()=>{for(const a of Object.keys(NODES))for(const b of Object.keys(NODES)){const r=route(a,b);assert.equal(r[0],a);assert.equal(r.at(-1),b)}});

test('all three character lanes avoid building walls and tree trunks',()=>{for(let k=0;k<3;k++)for(const [a,b] of EDGES){const A=lanePoint(a,k),B=lanePoint(b,k);for(let i=0;i<=100;i++){const t=i/100,x=A[0]*(1-t)+B[0]*t,z=A[1]*(1-t)+B[1]*t;assert.equal(insideBuilding(x,z,1.1),false,`${a}-${b} lane ${k}`);for(const tree of TREES)assert.ok(Math.hypot(x-tree[0],z-tree[1])>1.5,`${a}-${b} lane ${k} tree ${tree}`);}}});
