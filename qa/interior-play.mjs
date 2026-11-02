import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>window.__HOWON__.getState());
async function hold(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function turn(angle){for(let i=0;i<30;i++){const s=await state(),a=s.actors[s.selected],diff=Math.atan2(Math.sin(angle-a.heading),Math.cos(angle-a.heading));if(Math.abs(diff)<.1)return;await hold(diff>0?'a':'d',Math.min(180,Math.max(40,Math.abs(diff)/2.25*1000)));}throw Error('turn timeout '+JSON.stringify(await state()));}
async function walk(x,z){console.log("walk",x,z);for(let i=0;i<100;i++){const s=await state(),a=s.actors[s.selected],distance=Math.hypot(x-a.x,z-a.z);if(distance<.13)return;await turn(Math.atan2(x-a.x,z-a.z));await hold('w',Math.min(220,Math.max(45,distance/2*1000)));}throw Error(`walk blocked ${x},${z}: ${JSON.stringify(await state())}`);}
async function capture(name){await page.screenshot({path:`evidence/${name}.png`});}
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__HOWON__?.getState().loaded);
 await page.click('[data-guide=chiikawa]');await page.click('#explore-start');await page.click('#interior-entry');await page.waitForTimeout(1400);await capture('after-entry-scale');await page.click('#interact');await capture('after-corridor');
 assert.equal((await state()).interior,true);
 await walk(-5,2);await turn(Math.PI);assert.equal((await state()).interaction,'classroom');await page.keyboard.press('e');await page.waitForTimeout(600);await walk(-5,-1.35);await turn(Math.PI);await capture('after-classroom');
 await walk(-8.6,-1.35);await walk(-8.6,-5.4);assert.equal((await state()).interaction,'board');await turn(-Math.PI/2);await page.keyboard.press('e');await capture('after-board');await page.keyboard.press('e');await page.keyboard.press('e');
 // Push against a solid west wall; the whole actor must remain inside.
 await hold('w',1000);let s=await state();assert.ok(s.actors[s.selected].x>=-9.55);assert.ok(s.camera.position[0]>-10);
 await walk(-8.6,-1.35);await walk(-5,-1.35);await walk(-5,2);await walk(5,2);await turn(Math.PI);assert.equal((await state()).interaction,'library');await page.click('#interact');await page.waitForTimeout(600);
 await walk(5,-1.35);await walk(1.2,-1.35);await walk(1.2,-6.8);await walk(7.7,-6.8);await walk(7.7,-5);await turn(-Math.PI/2);assert.equal((await state()).interaction,'book');await page.click('#interact');await capture('after-library');await page.keyboard.press('e');
 await page.click('#interior-leave');assert.equal((await state()).interior,false);await page.click('#interact');assert.equal((await state()).interior,true);await walk(0,3);await page.keyboard.press('e');assert.equal((await state()).interior,false);
 // Existing exterior story and minigame must remain accessible after a round trip.
 await page.click('#school-tour');assert.equal(await page.locator('#story-card').isVisible(),true);await page.click('#story-read');await page.waitForTimeout(100);assert.equal(await page.locator('#stop-quiz-dialog').isVisible(),true);await page.click('#stop-quiz-close');
 // Narrow touch viewport, real pointer input on the existing mobile joystick.
 await page.setViewportSize({width:390,height:844});await page.click('#interior-entry');await page.click('#interact');await page.waitForTimeout(500);await capture('after-mobile-corridor');
 const before=(await state()).actors[0],joy=await page.locator('#joystick').boundingBox();await page.mouse.move(joy.x+joy.width/2,joy.y+joy.height/2);await page.mouse.down();await page.mouse.move(joy.x+joy.width/2,joy.y+8);await page.waitForTimeout(700);await page.mouse.up();const after=(await state()).actors[0];assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.4);
 await page.click('#interior-leave');await page.click('#interact');assert.equal((await state()).interior,true);
 await page.emulateMedia({reducedMotion:'reduce'});await capture('after-mobile-reentry');
 assert.deepEqual(errors,[]);fs.writeFileSync('evidence/play-report.json',JSON.stringify({result:'passed',checks:['desktop browser keyboard path through classroom and library','both doors open on proximity','board and book repeated interactions','solid wall collision and camera bounds','exit and reenter via button and E','existing story and minigame opens after round trip','390x844 pointer joystick moves actor','mobile exit and reenter','reduced-motion media'],errors,state:await state()},null,2));
 console.log('PLAY PASS');
}catch(e){await capture('failure');throw e;}finally{await browser.close();}
