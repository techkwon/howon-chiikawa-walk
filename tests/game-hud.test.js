import test from 'node:test';
import assert from 'node:assert/strict';
import {goalView} from '../src/game-hud.js';
const base={progress:{done:false},story:{label:'책과 함께'},arrived:false,paused:false,manual:false};
for(const [name,state,action] of [
 ['automatic travel',{},'잠깐 쉬기'],['pause',{paused:true},'다시 걷기'],['manual travel',{manual:true},'친구 따라 가기'],['arrival',{arrived:true},'이야기 보기'],['interior door',{interiorActive:true,room:'복도',interaction:'문 열기'},'문 열기'],['interior exit',{interiorActive:true,room:'교실'},'밖으로 나가기'],['completed',{progress:{done:true}},'이야기 다시 보기'],
])test(`HUD presents one contextual action: ${name}`,()=>{const view=goalView({...base,...state});assert.equal(view.action,action);assert.ok(view.title);assert.ok(view.hint);});

test('exterior entrance becomes the sole contextual action',()=>{assert.equal(goalView({...base,interaction:'실내 들어가기'}).action,'실내 들어가기');});

import {installGameHUD} from '../src/game-hud.js';
test('menu clears inherited inert, pauses safely, and restores focus and pause state',()=>{
 const nodes=new Map();let focused=null,paused=false,resets=0;
 const node=()=>({inert:true,open:false,hidden:false,textContent:'',listeners:{},classList:{add(){}},append(){},setAttribute(){},focus(){focused=this;},showModal(){this.open=true;},close(){this.open=false;},addEventListener(type,fn){this.listeners[type]=fn;}});
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 const original=globalThis.document;
 globalThis.document={querySelector:selector=>selector==='dialog[open]'?(get('#game-menu').open?get('#game-menu'):null):get(selector),createElement:node,body:{dataset:{}}};
 try{
  installGameHUD({read:()=>({...base,started:true,loaded:true,progress:{completed:0,total:8}}),resetInput:()=>resets++,pause:()=>{const old=paused;paused=true;return old;},resume:value=>paused=value,act(){}});
  for(const selector of ['#tour-progress','.toolbar','#experience-settings','.companions','.places','#interior-entry','#school-tour','#help','#credits'])assert.equal(get(selector).inert,false);
  get('#hud-toggle').onclick();assert.equal(paused,true);assert.equal(get('#game-menu').open,true);assert.equal(focused,get('#menu-close'));
  get('#game-menu').listeners.cancel({preventDefault(){}});assert.equal(paused,false);assert.equal(focused,get('#hud-toggle'));assert.equal(get('#game-menu').open,false);
  paused=true;get('#hud-toggle').onclick();get('#menu-close').onclick();assert.equal(paused,true);assert.equal(focused,get('#scene'));assert.ok(resets>=4);
 }finally{globalThis.document=original;}
});

test('pause recovery takes precedence over a nearby interaction',()=>{assert.equal(goalView({...base,paused:true,interiorActive:true,room:'복도',interaction:'문 열기'}).action,'다시 걷기');});
test('completed stop points to the next action',()=>{assert.equal(goalView({...base,completed:true,arrived:true}).action,'다음 장소로');});

import vm from 'node:vm';
import {functionSource} from './helpers/minigame-harness.js';
test('gallery return restores a visible canvas focus after its opener moves into the closed menu',()=>{
 let focused=false;const node={hidden:false};const vector={fromArray(){}};
 const context={galleryActive:true,coinVisuals:{group:{}},actors:[],selected:0,document:{body:{dataset:{}}},$:()=>node,controls:{update(){},target:vector},reducedMotion:false,camera:{position:vector},gallerySnapshot:{paused:false,follow:true,camera:[],target:[],storyHidden:true},paused:true,setFollow(){},syncPauseUI(){},canvas:{focus(){focused=true;}}};
 vm.runInNewContext(functionSource('leaveGallery')+';leaveGallery();',context);
 assert.equal(context.galleryActive,false);assert.equal(context.paused,false);assert.equal(context.gallerySnapshot,null);assert.equal(focused,true);
});
