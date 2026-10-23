import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, TREES } from '../src/navigation.js';
import { safeMove, createInputController, CHARACTER_RADIUS, CANOPY_POSTS, CANOPY_FOOTPRINTS, CAMPUS_BOUNDS, MAX_MOVE_DT } from '../src/direct-control.js';

const close = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) <= tolerance, `${a} should be close to ${b}`);
function safePosition(p) {
  for (const b of [...BUILDINGS, ...CANOPY_FOOTPRINTS]) assert.ok(!(p.x > b.x1 - CHARACTER_RADIUS && p.x < b.x2 + CHARACTER_RADIUS && p.z > b.z1 - CHARACTER_RADIUS && p.z < b.z2 + CHARACTER_RADIUS), `building or canopy collision at ${JSON.stringify(p)}`);
  for (const [x, z] of TREES) assert.ok(Math.hypot(p.x - x, p.z - z) >= CHARACTER_RADIUS + 0.3 - 1e-4, 'tree collision');
  for (const post of CANOPY_POSTS) assert.ok(Math.hypot(p.x - post.x, p.z - post.z) >= CHARACTER_RADIUS + post.radius - 1e-4, 'canopy post collision');
  assert.ok(p.x >= CAMPUS_BOUNDS.x1 + CHARACTER_RADIUS && p.x <= CAMPUS_BOUNDS.x2 - CHARACTER_RADIUS);
  assert.ok(p.z >= CAMPUS_BOUNDS.z1 + CHARACTER_RADIUS && p.z <= CAMPUS_BOUNDS.z2 - CHARACTER_RADIUS);
}

test('ordinary and diagonal movement preserve speed and inputs', () => {
  const start = Object.freeze({ x: 31, z: 20 }), vector = Object.freeze({ x: 1, z: 1 });
  const cardinal = safeMove(start, { x: 1, z: 0 }, MAX_MOVE_DT, 6);
  const diagonal = safeMove(start, vector, MAX_MOVE_DT, 6);
  close(cardinal.x, 31.3);
  close(Math.hypot(diagonal.x - 31, diagonal.z - 20), 0.3);
  close(diagonal.x - 31, diagonal.z - 20);
  assert.deepEqual(start, { x: 31, z: 20 });
  close(safeMove(start, { x: 0.5, z: 0 }, MAX_MOVE_DT, 6).x, 31.15);
});

test('large or invalid frame deltas do not create unexpected jumps', () => {
  const start = { x: 31, z: 20 };
  assert.deepEqual(safeMove(start, { x: 1, z: 0 }, 999, 6), safeMove(start, { x: 1, z: 0 }, MAX_MOVE_DT, 6));
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(safeMove(start, { x: 1, z: 0 }, dt, 6), start);
  assert.deepEqual(safeMove(start, { x: NaN, z: Infinity }, 0.05, 6), start);
  assert.deepEqual(safeMove(start, { x: 1, z: 0 }, 0.05, -2), start);
});

test('main building and annex stop movement at the character footprint', () => {
  const main = safeMove({ x: 8, z: 2 }, { x: -1, z: 0 }, 0.05, 1000);
  close(main.x, -4 + CHARACTER_RADIUS); safePosition(main);
  const annex = safeMove({ x: -28, z: 38 }, { x: -1, z: 0 }, 0.05, 1000);
  close(annex.x, -32 + CHARACTER_RADIUS); safePosition(annex);
});

test('continuous collision cannot tunnel through a building at high speed', () => {
  const p = safeMove({ x: -45, z: -46 }, { x: 0, z: 1 }, 0.05, 10000);
  close(p.z, -40 - CHARACTER_RADIUS); safePosition(p);
});

test('diagonal motion slides along a building wall instead of sticking', () => {
  const p = safeMove({ x: -2.8, z: -26 }, { x: -1, z: 1 }, 0.05, 6);
  close(p.x, -2.8);
  assert.ok(p.z > -26.01 + 0.2); safePosition(p);
});

test('tree trunk sweep stops even when one frame would pass the entire tree', () => {
  const p = safeMove({ x: -14, z: 18 }, { x: 0, z: -1 }, 0.05, 1000);
  close(p.z, 14.5); safePosition(p);
});

test('all Blender shelter posts and low roof footprints are protected', () => {
  assert.equal(CANOPY_POSTS.length, 56);
  assert.ok(CANOPY_POSTS.some(p => p.x === -3.6 && p.z === 10));
  assert.ok(CANOPY_POSTS.some(p => p.x === 4.4 && p.z === -43));
  const p = safeMove({ x: 10, z: -19.25 }, { x: -1, z: 0 }, 0.05, 1000);
  close(p.x, 4.4 + CHARACTER_RADIUS); safePosition(p);
  const shortRoof = safeMove({ x: -1, z: 15 }, { x: 0, z: -1 }, 0.05, 1000);
  close(shortRoof.z, 10 + CHARACTER_RADIUS); safePosition(shortRoof);
  const southRoof = safeMove({ x: 10, z: 25 }, { x: -1, z: 0 }, 0.05, 1000);
  close(southRoof.x, 4.4 + CHARACTER_RADIUS); safePosition(southRoof);
});

test('campus edges constrain the whole character and permit edge sliding', () => {
  const corner = safeMove({ x: 60, z: 48 }, { x: 1, z: 1 }, 0.05, 10000);
  close(corner.x, 64 - CHARACTER_RADIUS);
  close(corner.z, 53 - CHARACTER_RADIUS); safePosition(corner);
  const west = safeMove({ x: -56.5, z: 10 }, { x: -1, z: 0 }, 0.05, 10000);
  close(west.x, -58 + CHARACTER_RADIUS); safePosition(west);
  const north = safeMove({ x: 31, z: -48 }, { x: 0, z: -1 }, 0.05, 10000);
  close(north.z, -50 + CHARACTER_RADIUS); safePosition(north);
  const slide = safeMove({ x: 62.8, z: 20 }, { x: 1, z: 1 }, 0.05, 6);
  close(slide.x, 62.8); assert.ok(slide.z > 20.2); safePosition(slide);
});

test('additional actor circles and rectangles are added without mutating them', () => {
  const circle = Object.freeze({ x: 35, z: 20, radius: 1.2 });
  const p = safeMove({ x: 31, z: 20 }, { x: 1, z: 0 }, 0.05, 1000, Object.freeze([circle]));
  close(p.x, 32.6); safePosition(p);
  const box = { x1: 34, x2: 35, z1: 18, z2: 22 };
  close(safeMove({ x: 31, z: 20 }, { x: 1, z: 0 }, 0.05, 1000, [box]).x, 32.8);
});

test('wall contact still permits retreat and repeated diagonal movement stays outside geometry', () => {
  let p = { x: -2.8, z: -26 };
  assert.ok(safeMove(p, { x: 1, z: 0 }, 0.05, 6).x > p.x);
  for (let i = 0; i < 120; i++) { p = safeMove(p, { x: -1, z: 1 }, 0.05, 6); safePosition(p); }
});

test('deterministic randomized movement remains outside all campus geometry', () => {
  let seed = 3989, checked = 0;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 1800; i++) {
    const start = { x: -56.8 + random() * 119.6, z: -48.8 + random() * 100.6 };
    try { safePosition(start); } catch { continue; }
    const vector = { x: random() * 2 - 1, z: random() * 2 - 1 };
    const speed = random() < 0.1 ? 10000 : random() * 50;
    safePosition(safeMove(start, vector, random() * 0.15, speed));
    checked++;
  }
  assert.ok(checked > 1000);
});

class FakeElement extends EventTarget {
  constructor(doc, width = 100, height = 100) {
    super(); this.ownerDocument = doc; this.style = { transform: '', touchAction: '' };
    this.rect = { left: 10, top: 20, width, height }; this.tagName = 'DIV'; this.captured = new Set();
    const classes = new Set();
    this.classList = { contains: name => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) };
  }
  getBoundingClientRect() { return this.rect; }
  querySelector() { return this.knob; }
  closest() { return null; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}
function inputFixture() {
  const win = new EventTarget(), doc = new EventTarget();
  doc.defaultView = win; doc.activeElement = null; doc.hidden = false; doc.modal = null;
  doc.querySelector = () => doc.modal;
  const element = new FakeElement(doc), knob = new FakeElement(doc, 32, 32);
  element.knob = knob;
  const controller = createInputController({ element });
  const fire = (target, type, props = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event); return event;
  };
  return { win, doc, element, knob, controller, fire };
}

test('keyboard supports WASD/arrows, opposite keys and normalized diagonals', () => {
  const { win, controller, fire } = inputFixture();
  assert.equal(fire(win, 'keydown', { code: 'KeyW' }).defaultPrevented, true);
  assert.deepEqual(controller.getVector(), { x: 0, z: -1 });
  fire(win, 'keydown', { code: 'KeyD' });
  close(Math.hypot(...Object.values(controller.getVector())), 1);
  fire(win, 'keydown', { code: 'ArrowUp' });
  close(controller.getVector().x, Math.SQRT1_2);
  fire(win, 'keyup', { code: 'KeyW' });
  close(controller.getVector().z, -Math.SQRT1_2);
  fire(win, 'keyup', { code: 'ArrowUp' });
  fire(win, 'keydown', { code: 'KeyA' });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  controller.destroy();
});

test('typing, dialogs and browser shortcuts never move the character', () => {
  const { win, doc, controller, fire } = inputFixture();
  doc.activeElement = { tagName: 'INPUT' };
  assert.equal(fire(win, 'keydown', { code: 'KeyW' }).defaultPrevented, false);
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  doc.activeElement = null;
  fire(win, 'keydown', { code: 'KeyW', ctrlKey: true });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  fire(win, 'keydown', { key: 'W' });
  assert.equal(controller.getVector().z, -1);
  doc.modal = {};
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  doc.modal = null;
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  doc.activeElement = { isContentEditable: true };
  fire(win, 'keydown', { code: 'ArrowRight' });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  controller.destroy();
});

test('mobile joystick handles drag, dead zone, release and pointer cancellation', () => {
  const { win, element, knob, controller, fire } = inputFixture();
  const center = { pointerId: 4, clientX: 60, clientY: 70, button: 0 };
  fire(element, 'pointerdown', center);
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  fire(win, 'pointermove', { ...center, clientX: 120, clientY: 10 });
  close(controller.getVector().x, Math.SQRT1_2);
  close(controller.getVector().z, -Math.SQRT1_2);
  fire(win, 'pointerup', { pointerId: 99 });
  assert.ok(controller.getVector().x > 0);
  fire(win, 'pointerup', { pointerId: 4 });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  assert.equal(knob.style.transform, 'translate(0px, 0px)');
  assert.equal(element.hasPointerCapture(4), false);
  fire(element, 'pointerdown', { ...center, clientX: 94 });
  assert.equal(controller.getVector().x, 1);
  fire(win, 'pointercancel', { pointerId: 4 });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  controller.destroy();
});

test('blur, focus changes and lost capture clear input and destroy removes listeners', () => {
  const { win, doc, element, knob, controller, fire } = inputFixture();
  fire(win, 'keydown', { code: 'KeyW' }); fire(win, 'blur');
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  fire(win, 'keydown', { code: 'KeyW' }); doc.hidden = true; fire(doc, 'visibilitychange'); doc.hidden = false;
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  fire(element, 'pointerdown', { pointerId: 2, clientX: 94, clientY: 70, button: 0 });
  assert.equal(controller.getVector().x, 1);
  fire(element, 'lostpointercapture', { pointerId: 2 });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  controller.destroy(); controller.destroy();
  assert.equal(element.style.touchAction, '');
  assert.equal(fire(win, 'keydown', { code: 'KeyW' }).defaultPrevented, false);
  fire(element, 'pointerdown', { pointerId: 2, clientX: 94, clientY: 70, button: 0 });
  assert.deepEqual(controller.getVector(), { x: 0, z: 0 });
  assert.equal(knob.style.transform, '');
});
