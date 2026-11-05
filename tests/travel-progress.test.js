import test from 'node:test';
import assert from 'node:assert/strict';
import {remainingTravelDistance,trackTravelProgress} from '../src/travel-progress.js';
import {createHarness,SCHOOL_STORIES} from './helpers/minigame-harness.js';
import * as stages from '../src/stage-games.js';

test('planned detour progress is measured along the route, not distance to goal',()=>{
 const points=[{x:0,z:20},{x:20,z:20},{x:20,z:0}];
 assert.equal(remainingTravelDistance({x:0,z:0},points),60);
 assert.equal(remainingTravelDistance({x:0,z:5},points),55);
});
test('long moving route never raises the stalled notice',()=>{let state=null;for(let t=0;t<=300;t++) {state=trackTravelProgress(state,1000-t,t);assert.equal(state.stalled,false);}});
test('stationary and bounded jitter expose help after fifteen active seconds',()=>{let state=null;for(let t=0;t<=14;t++){state=trackTravelProgress(state,10+(t%2)*.1,t);assert.equal(state.stalled,false);}assert.equal(trackTravelProgress(state,10,15).stalled,true);});
test('resumed progress clears help and starts a fresh grace period',()=>{let state=trackTravelProgress(null,20,0);state=trackTravelProgress(state,20,16);assert.equal(state.stalled,true);state=trackTravelProgress(state,19,17);assert.equal(state.stalled,false);assert.equal(trackTravelProgress(state,19,31).stalled,false);assert.equal(trackTravelProgress(state,19,32).stalled,true);});
test('wait re-arms stalled help, restores canvas focus, and permits rescue',()=>{
 const h=createHarness(stages);h.start();h.actors[0].path=[];h.actors[0].target=null;h.actors[0].recovery=[];
 h.tick(322);assert.equal(h.$('#travel-help').hidden,false);
 h.$('#travel-wait').focus();h.$('#travel-wait').click();assert.equal(h.$('#travel-help').hidden,true);assert.equal(h.document.activeElement,h.$('#scene'));
 h.tick(200);assert.equal(h.$('#travel-help').hidden,true);h.tick(122);assert.equal(h.$('#travel-help').hidden,false);
 h.$('#travel-jump').click();assert.equal(h.$('#travel-help').hidden,true);assert.equal(h.context.tour.visitedIds.includes(SCHOOL_STORIES[0].id),true);
});
test('inactive modal intervals do not count as route stalls',()=>{
 const h=createHarness(stages);h.start();h.actors[0].path=[];h.actors[0].target=null;h.tick(200);
 h.$('#info').showModal();h.tick(500);h.$('#info').close();h.tick(200);assert.equal(h.$('#travel-help').hidden,true);h.tick(122);assert.equal(h.$('#travel-help').hidden,false);
});
for(let guide=0;guide<3;guide++)for(let stop=0;stop<SCHOOL_STORIES.length;stop++)test(`real route model guide${guide} → stop${stop+1} does not show premature help`,()=>{
 const h=createHarness(stages,guide);h.start();h.context.navigateStop(stop);let ticks=0;
 while(!h.context.tour.visitedIds.includes(SCHOOL_STORIES[stop].id)&&ticks++<5000){h.tick();assert.equal(h.$('#travel-help').hidden,true,`help while route progresses at ${ticks*.05}s`);}
 assert.ok(h.context.tour.visitedIds.includes(SCHOOL_STORIES[stop].id),'must actually arrive');
});
