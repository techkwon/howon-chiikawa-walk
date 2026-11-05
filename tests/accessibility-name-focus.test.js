import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as stages from '../src/stage-games.js';
import {createHarness} from './helpers/minigame-harness.js';
test('HUD toggle uses its visible changing label as its accessible name',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const button=html.match(/<button id="hud-toggle"[^>]*>/)[0];
 assert.doesNotMatch(button,/aria-label=/);
});
test('every hotspot accessible name includes its visible number and short title',()=>{
 const h=createHarness(stages);
 for(const b of h.$('#hotspots').children)assert.ok(b.getAttribute('aria-label').includes(b.textContent));
 assert.equal(h.$('#hotspots').children.length,8);
});
test('closing a story returns keyboard focus to the visible scene',()=>{
 const h=createHarness(stages);h.start();h.context.openStory(0);h.$('#story-close').focus();h.$('#story-close').click();
 assert.equal(h.$('#story-card').hidden,true);assert.equal(h.document.activeElement,h.$('#scene'));
});

import vm from 'node:vm';
import {functionSource} from './helpers/minigame-harness.js';
for(const point of [{x:1.2,y:0,z:0},{x:0,y:-1.2,z:0},{x:0,y:0,z:0}])test(`hotspot viewport clipping ${JSON.stringify(point)}`,()=>{
 const button={style:{},hidden:false};let focused=false;
 const context={markers:[{button,position:{clone:()=>({project:()=>point})}}],camera:{position:{distanceTo:()=>20}},interiorActive:false,loaded:true,innerWidth:390,innerHeight:844,document:{activeElement:button},canvas:{focus:()=>focused=true}};
 vm.runInNewContext(functionSource('updateHotspots')+';updateHotspots();',context);
 const outside=Math.abs(point.x)>1||Math.abs(point.y)>1;
 assert.equal(button.hidden,outside);assert.equal(focused,outside);
});
