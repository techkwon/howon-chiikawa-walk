import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as stages from '../src/stage-games.js';
import {createHarness, arrive} from './helpers/minigame-harness.js';
import {clickOption, STAGE_PATHS} from './helpers/stage-paths.js';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const snapshot=h=>JSON.stringify({tour:h.context.tour,stage:h.context.stopQuiz,coins:h.context.coins,positions:h.actors.map(a=>a.model.position.toArray())});
function partial(){const h=createHarness(stages);h.start();arrive(h,0);h.$('#story-read').click();clickOption(h,STAGE_PATHS.welcome[0]);h.$('#stop-quiz-close').click();return h;}
for(const escape of [false,true])test(`restart ${escape?'Escape':'cancel'} preserves progress and resumes previous pause state`,()=>{
 for(const paused of [false,true]){const h=partial();h.context.paused=paused;h.$('#tour-restart').focus();const before=snapshot(h);h.$('#tour-restart').click();assert.equal(h.$('#restart-confirm').open,true);assert.equal(h.context.paused,true);assert.equal(h.document.activeElement,h.$('#restart-cancel'));h.tick(20);assert.equal(snapshot(h),before);if(escape){const e=h.$('#restart-confirm').emit('cancel');assert.equal(e.defaultPrevented,true);}else h.$('#restart-cancel').click();assert.equal(h.$('#restart-confirm').open,false);assert.equal(h.context.paused,paused);assert.equal(snapshot(h),before);assert.equal(h.document.activeElement,h.$('#tour-restart'));}
});
test('restart requires explicit confirmation, rejects repeated opening and clears only after yes',()=>{const h=partial();const before=snapshot(h);h.$('#tour-restart').click();h.$('#tour-restart').click();assert.equal(h.$('#restart-confirm').modalCount,1);assert.equal(snapshot(h),before);h.$('#restart-yes').click();assert.equal(h.$('#restart-confirm').open,false);assert.equal(h.context.started,false);assert.equal(h.context.tour.visitedIds.length,0);assert.equal(Object.keys(h.context.stopQuiz.stages).length,0);assert.equal(h.context.paused,true);});
test('remote game action gives a persistent explanation and navigates instead of a dead end',()=>{const h=createHarness(stages);h.start();h.context.openStory(7);assert.equal(h.$('#story-read').textContent,'이곳으로 먼저 가기');assert.match(h.$('#story-visit-status').textContent,/먼저/);h.$('#story-read').click();assert.equal(h.read('activeGoalId'),'care');assert.match(h.$('#story-visit-status').textContent,/데려다주고/);assert.equal(h.$('#stop-quiz-dialog').open,false);arrive(h,7);assert.equal(h.$('#story-read').textContent,'미니게임 시작');assert.match(h.$('#story-visit-status').textContent,/도착/);h.$('#story-read').click();assert.equal(h.$('#stop-quiz-dialog').open,true);});
test('close explicitly means this open page, and reopening preserves the partial game',()=>{const h=partial();const before=JSON.stringify(h.context.stopQuiz);assert.match(h.$('#stop-quiz-close').textContent,/이 화면에서 이어 하기/);h.context.openStory(0);h.$('#story-read').click();assert.equal(JSON.stringify(h.context.stopQuiz),before);assert.match(html,/진행은 저장되지 않아요/);assert.match(html,/새로고침하거나 화면을 닫으면 처음부터 시작해요/);assert.match(html,/id="restart-cancel" autofocus/);});

test('opening a new or revisited story resets reading scroll without awarding progress',()=>{
 const h=createHarness(stages);h.start();h.context.openStory(0);h.$('#story-card').scrollTop=500;
 const before=snapshot(h);h.context.openStory(1);assert.equal(h.$('#story-card').scrollTop,0);assert.equal(snapshot(h),before);
 h.$('#story-card').scrollTop=300;h.$('#story-close').click();h.context.openStory(1);
 assert.equal(h.$('#story-card').scrollTop,0);assert.equal(h.$('#story-card').hidden,false);assert.equal(snapshot(h),before);
});
test('explicit navigation to an already-near goal after guide switch shows its story without completing it',()=>{const h=createHarness(stages);h.start();h.actors[2].model.position.set(-18,.25,20);h.friendButtons[2].click();h.context.checkTourArrival();assert.equal(h.context.tour.visitedIds.includes('together'),false);h.context.navigateStop(1);assert.equal(h.context.tour.visitedIds.includes('together'),true);assert.equal(h.$('#story-card').hidden,false);assert.equal(h.$('#stop-quiz-dialog').open,false);assert.equal(h.context.stopQuiz.completedIds.length,0);assert.equal(h.$('#travel-help').hidden,true);});

test('already-near first-game request preserves arrived guidance instead of travelling text',()=>{const h=createHarness(stages);h.start();h.actors[2].model.position.set(-18,.25,20);h.friendButtons[2].click();h.context.openStory(1);h.$('#story-read').click();assert.equal(h.context.tour.visitedIds.includes('together'),true);assert.match(h.$('#story-visit-status').textContent,/도착했어요/);assert.equal(h.$('#story-read').textContent,'미니게임 시작');assert.equal(h.context.stopQuiz.completedIds.length,0);});
