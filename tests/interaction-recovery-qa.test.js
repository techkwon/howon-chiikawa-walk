import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function pointerHarness(){
 const listeners={},calls=[];
 const context={canvas:{addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);}},pointerStart:null,follow:true,galleryActive:false,interiorActive:false,setFollow:v=>{context.follow=v;calls.push(v);},toast:()=>{},pointer:{set:()=>{}},raycaster:{setFromCamera:()=>{}},camera:{},actors:[],innerWidth:390,innerHeight:844};
 vm.createContext(context);
 const snippet=source.slice(source.indexOf("canvas.addEventListener('pointermove'"),source.indexOf('\nfunction render',source.indexOf("canvas.addEventListener('pointermove'")));
 // Limit extraction to the three handlers; avoid invoking unrelated frame code.
 const end=snippet.indexOf("\n",snippet.indexOf("canvas.addEventListener('pointerdown'"));
 vm.runInContext(snippet.slice(0,end<0?undefined:end),context);
 return {context,calls,fire:(type,event={})=>(listeners[type]||[]).forEach(fn=>fn({pointerId:1,clientX:10,clientY:10,...event}))};
}
test('a simple scene tap preserves follow camera, while a deliberate drag releases it',()=>{
 const h=pointerHarness();h.fire('pointerdown');h.fire('pointermove',{clientX:14});h.fire('pointerup');assert.equal(h.context.follow,true);assert.deepEqual(h.calls,[]);
 h.fire('pointerdown');h.fire('pointermove',{clientX:18});assert.equal(h.context.follow,false);
});
test('cancelled pointer and another finger do not release follow camera',()=>{
 const h=pointerHarness();h.fire('pointerdown');h.fire('pointermove',{pointerId:2,clientX:30});assert.equal(h.context.follow,true);h.fire('pointercancel');h.fire('pointermove',{clientX:30});assert.equal(h.context.follow,true);
});
test('indoor camera remains automatic after a drag',()=>{
 const h=pointerHarness();h.context.interiorActive=true;h.fire('pointerdown');h.fire('pointermove',{clientX:30});assert.equal(h.context.follow,true);
});
test('keep waiting restarts the recovery timer for the same destination',()=>{
 let handler,requested=null,focused=false;const context={canvas:{focus(){focused=true;}},...{$:()=>({set onclick(fn){handler=fn;}}),travelRequest:{index:3,startedAt:10},armTravelHelp:index=>requested=index}};vm.createContext(context);const handlerSource=source.match(/\$\('#travel-wait'\)\.onclick=([^\n]*?);(?=\n|$)/)?.[0];assert.ok(handlerSource);vm.runInContext(handlerSource,context);handler();assert.equal(requested,3);assert.equal(focused,true);context.travelRequest=null;requested=null;handler();assert.equal(requested,null);
});
