import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import * as navigation from '../src/navigation.js';
import * as movement from '../src/direct-control.js';
import * as cameraFollow from '../src/camera-follow.js';
import * as arrivals from '../src/arrival-gate.js';
import * as tours from '../src/tour-state.js';
import * as localQuiz from '../src/stop-quiz.js';
import * as finalQuiz from '../src/school-quiz.js';
import * as guides from '../src/guide-dialogue.js';
import * as coinModule from '../src/coins.js';
import { SCHOOL_STORIES } from '../src/school-stories.js';

// Production control functions + production event callbacks in a DOM double.
// This is not a real browser/phone/GPU rendering or native event propagation test.
function harness(selected = 0) {
  const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const elements = new Map();
  function element() { return { hidden: true, open: false, disabled: false, dataset: {}, style: {}, children: [], textContent: '',
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, replaceChildren(...children) { this.children = children; }, appendChild(child) { this.children.push(child); },
    addEventListener() {}, focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
    click() { if (!this.disabled) this.onclick?.(); },
  }; }
  const $ = selector => {
    if (selector === 'dialog[open]') return [...elements.values()].find(e => e.open && e.isDialog) || null;
    if (!elements.has(selector)) { const e = element(); e.isDialog = /dialog|farewell|info/.test(selector); elements.set(selector, e); }
    return elements.get(selector);
  };
  const actors = [0, 1, 2].map(i => ({
    model: { position: new THREE.Vector3(25 + i * 4, .25, 20), rotation: { y: 0 }, userData: { character: { rig: new THREE.Group() } } },
    shadow: { position: new THREE.Vector3() }, ring: { position: new THREE.Vector3(), material: {} },
    path: [], recovery: [], manualTrail: [], wait: 0, target: null, targetNode: 'field', node: 'field', dist: 0, phase: 0,
  }));
  const context = vm.createContext({ THREE, ...navigation, ...movement, ...cameraFollow, ...arrivals, ...tours, ...localQuiz, ...finalQuiz, ...guides, ...coinModule,
    SCHOOL_STORIES, actors, $, $$: () => [], document: { createElement: element },
    loaded: true, started: false, paused: true, manual: false, selected, follow: true, speed: 1, time: 0,
    galleryActive: false, uiPhase: 'welcome', destination: 'field', nextStopAt: null,
    tour: tours.createTourState(SCHOOL_STORIES.map(s => s.id)), stopQuiz: localQuiz.createStopQuizState(), stopQuizId: null, stopQuizWasPaused: false,
    quiz: finalQuiz.createQuizState(), coins: [], kinds: ['chiikawa', 'hachiware', 'usagi'], names: ['햄스터', '가르마', '토끼'],
    input: { reset() {}, getVector: () => ({ x: 0, z: 0 }), isRunning: () => false },
    audio: { unlock: () => Promise.resolve(), play() {} }, animateCharacter() {}, fx() {}, showSpeech() {}, syncPauseUI() {}, syncRunUI() {}, labelButton() {},
    canvas: { focus() {} }, setTimeout, toast(message) { context.lastToast = message; },
    sceneAccess(phase) { context.uiPhase = phase; }, select(i) { context.selected = i; },
    setFollow(value) { context.follow = value; }, setManual(value) { context.manual = value; }, sendTo() {},
  });
  vm.runInContext(source.slice(source.indexOf('function targetFor('), source.indexOf('const loader=')), context);
  vm.runInContext(source.slice(source.indexOf('function setManual('), source.indexOf("$('#manual').onclick=")), context);
  vm.runInContext(source.slice(source.indexOf('const introShownIds='), source.indexOf('function updateCoins(')), context);
  return { context, actors, $, tick(frames = 1) { for (let n = 0; n < frames; n++) { if (!context.paused && !context.galleryActive) context.time += .05; if (!context.galleryActive) context.updateActors(.05); context.checkTourArrival(); context.updateTravelHelp(); } } };
}

for (const [selected, kind] of ['chiikawa', 'hachiware', 'usagi'].entries()) {
  test(`${kind}: production movement → story → explicit quiz click → eight stops → final recap → ending`, () => {
    const h = harness(selected), c = h.context;
    c.startTour(kind);
    for (const [index, story] of SCHOOL_STORIES.entries()) {
      let frames = 0;
      while (!c.tour.visitedIds.includes(story.id) && frames++ < 4000) h.tick();
      assert.ok(c.tour.visitedIds.includes(story.id), `${kind}/${story.id}: no arrival after ${frames * .05}s; ${JSON.stringify(h.actors[selected].model.position)}; ${c.lastToast}`);
      assert.equal(h.$('#story-card').hidden, false, 'arrival shows story first');
      assert.equal(h.$('#stop-quiz-dialog').open, false, 'arrival never opens quiz automatically');
      assert.equal(h.$('#story-card').dataset.arrival, 'true');
      h.$('#story-read').click();
      assert.equal(h.$('#stop-quiz-dialog').open, true, 'explicit story button opens quiz');
      assert.equal(c.stopQuizId, story.id);
      assert.equal(c.paused, true);
      // Wrong choices must still permit completing this educational journey.
      h.$(localQuiz.STOP_QUIZZES[story.id].answer ? '#stop-quiz-x' : '#stop-quiz-o').click();
      assert.equal(tours.getProgress(c.tour).completed, index + 1);
      assert.ok(h.$('#stop-quiz-feedback').textContent.length > 0);
      h.$('#stop-quiz-next').click();
      assert.equal(h.$('#stop-quiz-dialog').open, false);
    }
    assert.equal(h.$('#quiz-dialog').open, true);
    for (const question of finalQuiz.QUIZ_QUESTIONS) {
      h.$(question.answer ? '#quiz-o' : '#quiz-x').click();
      h.$('#quiz-next').click();
    }
    assert.equal(c.quiz.finished, true);
    assert.equal(h.$('#quiz-dialog').open, false);
    assert.equal(h.$('#farewell').open, true);
    assert.equal(tours.getProgress(c.tour).completed, 8);
  });
}

test('normal welcome approach is still travelling after 15 seconds, not necessarily blocked', () => {
  for (const [selected, kind] of ['chiikawa', 'hachiware', 'usagi'].entries()) {
    const h = harness(selected);
    h.context.startTour(kind);
    const before = h.actors[selected].model.position.clone();
    h.tick(300);
    assert.equal(h.context.tour.visitedIds.includes('welcome'), false);
    assert.ok(h.actors[selected].model.position.distanceTo(before) > 10, 'ordinary travel makes real progress');
  }
});

test('off-graph route at canopy edge exposes a genuine no-arrival condition', () => {
  const h = harness(0), c = h.context;
  c.startTour('chiikawa');
  // A safe, off-graph state with no recovery history. This is a fault-injection
  // robustness case, not a claim that the normal manual UI creates this state.
  h.actors[0].model.position.set(-2.79, .25, -20);
  h.actors[0].recovery = [];
  c.navigateStop(0);
  h.tick(300);
  const at15 = h.actors[0].model.position.clone();
  h.tick(300);
  assert.equal(c.tour.visitedIds.includes('welcome'), false);
  assert.ok(h.actors[0].model.position.distanceTo(at15) < .01, `unexpected movement: ${JSON.stringify(h.actors[0].model.position)}`);
  assert.ok(Math.abs(h.actors[0].model.position.x - .4) < .01, 'fixed canopy correctly blocks direct graph re-entry');
});

for (const [selected, kind] of ['chiikawa', 'hachiware', 'usagi'].entries()) {
  test(`${kind}: blocked approach → optional safe jump → story → explicit quiz → all eight → ending`, () => {
    const h = harness(selected), c = h.context;
    c.startTour(kind);
    for (const [index, story] of SCHOOL_STORIES.entries()) {
      // Inject the same safe canopy-edge failure before every target, so all
      // eight rescue destinations and all three character lane points execute.
      const actor = h.actors[selected];
      actor.model.position.set(-2.79, .25, -20);
      actor.recovery = []; actor.manualTrail = [];
      c.navigateStop(index);
      h.tick(301);
      assert.equal(h.$('#travel-help').hidden, false, `${kind}/${story.id}: missing help`);
      assert.equal(h.$('#stop-quiz-dialog').open, false);
      const before = actor.model.position.clone();
      h.tick(60);
      assert.ok(actor.model.position.distanceTo(before) < .1, `${kind}/${story.id}: before ${JSON.stringify(before)}, after ${JSON.stringify(actor.model.position)}`);
      const peerPositions = h.actors.filter((_, i) => i !== selected).map(a => a.model.position.clone());
      h.$('#travel-jump').click();
      assert.equal(h.$('#travel-help').hidden, true);
      assert.equal(h.$('#story-card').hidden, false);
      assert.equal(h.$('#stop-quiz-dialog').open, false, 'safe jump also shows story before quiz');
      assert.ok(c.tour.visitedIds.includes(story.id));
      assert.equal(tours.getProgress(c.tour).completed, index, 'arrival does not earn quiz participation');
      assert.equal(navigation.insideBuilding(actor.model.position.x, actor.model.position.z, 1.19), false);
      h.actors.filter((_, i) => i !== selected).forEach((a, i) => assert.equal(a.model.position.distanceTo(peerPositions[i]), 0, 'jump moves selected friend only'));
      h.$('#story-read').click();
      assert.equal(c.stopQuizId, story.id);
      h.$('#stop-quiz-o').click();
      h.$('#stop-quiz-next').click();
    }
    assert.equal(h.$('#quiz-dialog').open, true);
    h.$('#quiz-skip').click();
    assert.equal(h.$('#farewell').open, true);
    assert.equal(tours.getProgress(c.tour).completed, 8);
  });
}

test('15-second help excludes paused time and offers working direct walking without completing the quiz', () => {
  const h = harness(0), c = h.context;
  c.startTour('chiikawa');
  h.actors[0].model.position.set(-2.79, .25, -20);
  c.navigateStop(0);
  c.paused = true; h.tick(600);
  assert.equal(h.$('#travel-help').hidden, true);
  c.paused = false; h.tick(301);
  assert.equal(h.$('#travel-help').hidden, false);
  h.$('#travel-manual').click();
  assert.equal(c.manual, true);
  assert.equal(c.paused, false);
  assert.equal(h.$('#travel-help').hidden, true);
  assert.equal(h.actors[0].path.length, 0);
  c.input.getVector = () => ({ x: 0, z: -1 });
  h.actors[0].model.rotation.y = Math.PI;
  const before = h.actors[0].model.position.clone();
  h.tick(20);
  assert.ok(h.actors[0].model.position.distanceTo(before) > 5.9);
  assert.equal(tours.getProgress(c.tour).completed, 0);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
});

test('keep waiting dismisses the offer without moving the character or awarding progress', () => {
  const h = harness(0), c = h.context;
  c.startTour('chiikawa');
  h.tick(301);
  assert.equal(h.$('#travel-help').hidden, false);
  const before = h.actors[0].model.position.clone();
  h.$('#travel-wait').click();
  assert.equal(h.$('#travel-help').hidden, true);
  assert.equal(h.actors[0].model.position.distanceTo(before), 0);
  assert.equal(c.manual, false);
  assert.equal(tours.getProgress(c.tour).completed, 0);
});
