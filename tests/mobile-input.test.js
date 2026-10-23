import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from 'three';
import * as stages from '../src/stage-games.js';
import { createInputController } from '../src/direct-control.js';
import { zoomFollowDistance } from '../src/camera-follow.js';
import { createHarness, arrive, source } from './helpers/minigame-harness.js';

// Production controller + main.js event callbacks, using deterministic event
// and raycast doubles. These tests cannot certify Android gesture arbitration,
// GPU rendering, physical ergonomics or native browser event propagation.
function emitter(base = {}) {
  const listeners = new Map();
  return Object.assign(base, {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== fn)); },
    emit(type, properties = {}) { const event = { type, target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...properties };
      for (const fn of listeners.get(type) || []) fn(event); return event; },
  });
}
function cameraHarness() {
  const window = emitter({ visualViewport: emitter() }), canvas = emitter({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 }) }), elements = new Map();
  const document = emitter({ defaultView: window, hidden: false, activeElement: null, modal: null, querySelector: selector => selector === 'dialog[open]' ? document.modal : null });
  const classes = new Set(), captured = new Set();
  const knob = { style: {}, getBoundingClientRect: () => ({ width: 32, height: 32 }) };
  const joystick = emitter({ ownerDocument: document, style: {}, tagName: 'DIV', closest: () => null,
    classList: { contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
    querySelector: () => knob, getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 }),
    setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id),
  });
  const input = createInputController({ element: joystick });
  const $ = selector => {
    if (selector === 'dialog[open]') return document.modal;
    if (!elements.has(selector)) elements.set(selector, { textContent: '', setAttribute() {}, hidden: true });
    return elements.get(selector);
  };
  let c;
  class Raycaster {
    setFromCamera() { c.raycasts++; }
    intersectObject(model) { return c.hitModel === model ? [{}] : []; }
  }
  c = vm.createContext({ THREE: { ...THREE, Raycaster }, window, document, canvas, input, $, zoomFollowDistance,
    innerWidth: 390, innerHeight: 844, follow: true, galleryActive: false, manual: true, started: true, loaded: true, paused: false, uiPhase: 'game',
    selected: 0, names: ['햄스터', '가르마', '토끼'], actors: [{ model: {} }, { model: {} }, { model: {} }],
    controls: { enablePan: false, enabled: true }, transition: null, followDistance: 22,
    camera: { aspect: 390 / 844, updateProjectionMatrix() { c.projections++; } },
    renderer: { setSize(width, height) { c.renderSize = [width, height]; } },
    speechActive: false, speechBubble: {}, speechWidth: 0, speechHeight: 0,
    updateSpeechPosition() {}, measureSpeechObstacles() {}, syncCameraSettings() {}, syncRunUI() {}, syncPauseUI() {}, audio: { suspend() { c.audioSuspensions++; } }, audioSuspensions: 0,
    raycasts: 0, selections: 0, projections: 0, hitModel: null,
    select(index) { c.selected = index; c.selections++; }, toast() {},
    performance: { now: () => 1000 },
  });
  vm.runInContext(source.split('\n').find(line => line.startsWith('function setFollow(')), c);
  const start = source.indexOf('const raycaster='), end = source.indexOf("window.addEventListener('resize',()=>", start);
  assert.ok(start >= 0 && end > start, 'production canvas gesture registration is available');
  vm.runInContext(source.slice(start, end), c);
  const resize = source.split('\n').filter(line => line.startsWith("window.addEventListener('resize',()=>"));
  assert.ok(resize.length, 'production renderer resize callback is available');
  vm.runInContext(resize.join('\n'), c);
  return { c, window, document, canvas, joystick, input, captured,
    touch(type, pointerId, clientX, clientY, extras = {}) { const event = { pointerId, clientX, clientY, pointerType: 'touch', isPrimary: pointerId === 1, button: 0, ...extras }; const result = canvas.emit(type, event); window.emit(type, { ...event, target: canvas }); return result; },
    dragJoystick(pointerId = 10) { joystick.emit('pointerdown', { pointerId, clientX: 104, clientY: 60, button: 0, pointerType: 'touch' }); },
  };
}

test('a stationary canvas touch does not unexpectedly exit character follow', () => {
  const h = cameraHarness();
  h.touch('pointerdown', 1, 180, 220);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.follow, true);
});

test('intentional camera drag exits follow, but returning to its origin is not a character tap', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 180, 220);
  h.touch('pointermove', 1, 210, 250);
  assert.equal(h.c.follow, false);
  h.touch('pointermove', 1, 180, 220);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 0);
});

test('two-finger camera gesture cannot be mistaken for a character selection', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 100, 200);
  h.touch('pointerdown', 2, 250, 200);
  h.touch('pointerup', 1, 100, 200);
  h.touch('pointerup', 2, 250, 200);
  assert.equal(h.c.selections, 0);
});

test('canceled canvas touch cannot reuse its old coordinates to select a character', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 180, 220);
  h.touch('pointercancel', 1, 180, 220);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 0);
});

test('one character tap is consumed once and does not survive an unmatched pointerup', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 180, 220);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 1);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 1);
  assert.equal(h.c.follow, true);
});

test('viewport resize safely releases held joystick, keyboard and running intent', () => {
  const h = cameraHarness(); h.dragJoystick();
  h.window.emit('keydown', { code: 'KeyW' });
  h.input.toggleRunning(true);
  assert.equal(h.input.isRunning(), true);
  h.c.innerWidth = 844; h.c.innerHeight = 390;
  h.window.emit('resize');
  assert.deepEqual(h.input.getVector(), { x: 0, z: 0 });
  assert.equal(h.input.isRunning(), false);
  assert.equal(h.c.camera.aspect, 844 / 390);
  assert.deepEqual(h.c.renderSize, [844, 390]);
  assert.equal(h.c.projections, 1);
});

test('canvas pointer cleanup prevents a pre-resize touch from selecting after layout changes', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 180, 220);
  h.window.emit('resize');
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 0);
});

test('real run button and joystick support a second touch, unrelated pointer cancellation and owner cancellation', () => {
  const h = createHarness(stages); h.start(); h.context.setManual(true);
  h.$('#run-toggle').click();
  assert.equal(h.context.input.isRunning(), true);
  h.$('#joystick').emit('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 104, clientY: 60, button: 0 });
  assert.deepEqual(h.context.input.getVector(), { x: 1, z: 0 });
  h.window.emit('pointercancel', { pointerId: 99 });
  assert.equal(h.context.input.isRunning(), true);
  assert.deepEqual(h.context.input.getVector(), { x: 1, z: 0 });
  h.$('#run-toggle').click();
  assert.equal(h.context.input.isRunning(), false);
  assert.deepEqual(h.context.input.getVector(), { x: 1, z: 0 });
  h.$('#run-toggle').click();
  h.window.emit('pointercancel', { pointerId: 2 });
  assert.deepEqual(h.context.input.getVector(), { x: 0, z: 0 });
  assert.equal(h.context.input.isRunning(), false);
  assert.equal(h.$('#run-toggle').getAttribute('aria-pressed'), 'false');
});

test('opening a real minigame cancels a held touch and stale moves cannot resume it after close', () => {
  const h = createHarness(stages); h.start(); arrive(h, 0, { rescue: true }); h.context.setManual(true);
  h.$('#joystick').emit('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 104, clientY: 60, button: 0 });
  h.$('#run-toggle').click();
  h.$('#story-read').click();
  assert.equal(h.$('#stop-quiz-dialog').open, true);
  assert.deepEqual(h.context.input.getVector(), { x: 0, z: 0 });
  assert.equal(h.context.input.isRunning(), false);
  h.window.emit('pointermove', { pointerId: 2, clientX: 104, clientY: 60 });
  h.key('KeyW');
  const before = h.actors[0].model.position.clone(); h.tick(30);
  assert.equal(h.actors[0].model.position.distanceTo(before), 0);
  h.$('#stop-quiz-close').click();
  h.window.emit('pointermove', { pointerId: 2, clientX: 104, clientY: 60 }); h.tick(30);
  assert.equal(h.actors[0].model.position.distanceTo(before), 0);
});

test('a pointer captured before a modal opens cannot select behind that modal', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 180, 220);
  h.document.modal = {};
  h.touch('pointermove', 1, 240, 280);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 0);
  assert.equal(h.c.follow, true);
  h.document.modal = null;
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 0);
});

test('new touches during a modal or before exploration start cannot change camera/selection', () => {
  for (const state of ['modal', 'welcome']) {
    const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
    if (state === 'modal') h.document.modal = {}; else { h.c.started = false; h.c.uiPhase = 'welcome'; }
    h.touch('pointerdown', 1, 180, 220);
    h.touch('pointermove', 1, 240, 280);
    h.touch('pointerup', 1, 180, 220);
    assert.equal(h.c.selections, 0, state);
    assert.equal(h.c.follow, true, state);
  }
});

test('a near-edge pointer release outside the canvas never selects an actor', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 388, 220);
  h.touch('pointerup', 1, 394, 220);
  assert.equal(h.c.selections, 0);
});

test('blur and hidden-page transitions clear pending canvas gestures and joystick state', () => {
  for (const interruption of ['blur', 'hidden']) {
    const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
    h.touch('pointerdown', 1, 180, 220); h.dragJoystick(); h.input.toggleRunning(true);
    if (interruption === 'blur') h.window.emit('blur');
    else { h.document.hidden = true; h.document.emit('visibilitychange'); h.document.hidden = false; }
    assert.deepEqual(h.input.getVector(), { x: 0, z: 0 });
    assert.equal(h.input.isRunning(), false);
    h.touch('pointerup', 1, 180, 220);
    assert.equal(h.c.selections, 0);
  }
});

test('orientationchange releases joystick even before the renderer resize event', () => {
  const h = cameraHarness(); h.dragJoystick(); h.input.toggleRunning(true);
  h.window.emit('orientationchange');
  assert.deepEqual(h.input.getVector(), { x: 0, z: 0 });
  assert.equal(h.input.isRunning(), false);
  assert.equal(h.captured.size, 0);
});

test('follow wheel zoom remains bounded and is ignored behind a modal', () => {
  const h = cameraHarness();
  h.canvas.emit('wheel', { deltaY: -200 });
  assert.ok(h.c.followDistance < 22 && h.c.followDistance >= 8);
  const before = h.c.followDistance;
  h.document.modal = {};
  h.canvas.emit('wheel', { deltaY: -200 });
  assert.equal(h.c.followDistance, before);
});

test('WebGL context loss pauses, releases held input, clears canvas gestures and suspends audio', () => {
  const h = cameraHarness(); h.c.hitModel = h.c.actors[1].model;
  h.touch('pointerdown', 1, 180, 220); h.dragJoystick(); h.input.toggleRunning(true);
  const event = h.canvas.emit('webglcontextlost');
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.c.paused, true);
  assert.deepEqual(h.input.getVector(), { x: 0, z: 0 });
  assert.equal(h.input.isRunning(), false);
  assert.equal(h.c.audioSuspensions, 1);
  h.touch('pointerup', 1, 180, 220);
  assert.equal(h.c.selections, 0);
});

test('touch slop permits a small tap drift while mouse drag uses its tighter threshold', () => {
  const touch = cameraHarness();
  touch.touch('pointerdown', 1, 180, 220);
  touch.touch('pointermove', 1, 189, 220);
  assert.equal(touch.c.follow, true);
  touch.touch('pointerup', 1, 189, 220);
  const mouse = cameraHarness();
  mouse.touch('pointerdown', 1, 180, 220, { pointerType: 'mouse' });
  mouse.touch('pointermove', 1, 187, 220, { pointerType: 'mouse' });
  assert.equal(mouse.c.follow, false);
});

test('each real minigame close control preserves partial game state and resumes safely', () => {
  for (const selector of ['#stop-quiz-close', '#stage-close-bottom']) {
    const h = createHarness(stages); h.start(); arrive(h, 0, { rescue: true }); h.$('#story-read').click();
    const choice = h.$('#stage-options').children.find(button => button.dataset.option.endsWith(':uijeongbu'));
    choice.click();
    const before = JSON.stringify(h.context.stopQuiz);
    h.$(selector).click();
    assert.equal(h.$('#stop-quiz-dialog').open, false, selector);
    assert.equal(h.context.paused, false, selector);
    assert.equal(JSON.stringify(h.context.stopQuiz), before, selector);
    assert.equal(h.context.stopQuiz.completedIds.length, 0, selector);
    assert.deepEqual(h.context.input.getVector(), { x: 0, z: 0 });
    h.context.openStory(0); h.$('#story-read').click();
    assert.equal(JSON.stringify(h.context.stopQuiz), before, selector);
  }
});
