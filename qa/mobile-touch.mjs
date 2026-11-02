import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__HOWON__?.getState().loaded);await page.locator('[data-guide=usagi]').tap();await page.locator('#explore-start').tap();await page.locator('#interior-entry').tap();await page.locator('#interact').tap();await page.locator('#run-toggle').tap();
 const state=()=>page.evaluate(()=>window.__HOWON__.getState());const before=await state();const r=await page.locator('#joystick').boundingBox();const client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width/2,y:r.y+6}]});await page.waitForTimeout(900);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await state();assert.ok(Math.hypot(after.actors[2].x-before.actors[2].x,after.actors[2].z-before.actors[2].z)>1);
 await page.waitForTimeout(200);const stopped=await state();await page.waitForTimeout(300);const rest=await state();assert.ok(Math.hypot(rest.actors[2].x-stopped.actors[2].x,rest.actors[2].z-stopped.actors[2].z)<.01);
 await page.locator('#interior-leave').tap();await page.locator('#interact').tap();assert.equal((await state()).interior,true);await page.waitForTimeout(2600);await page.screenshot({path:'evidence/after-mobile-touch-usagi.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync('evidence/touch-report.json',JSON.stringify({result:'passed',device:'Chrome 390x844 touch emulation (not physical phone)',checks:['Usagi selection','touch entry','run toggle','touch joystick drag moves actor','touch release stops translation','touch exit and reentry'],before:before.actors[2],after:after.actors[2],errors},null,2));console.log('TOUCH PASS');
}finally{await browser.close();}
