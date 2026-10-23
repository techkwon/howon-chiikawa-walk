import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import * as navigation from '../../src/navigation.js';
import * as movement from '../../src/direct-control.js';
import * as cameraFollow from '../../src/camera-follow.js';
import * as arrivals from '../../src/arrival-gate.js';
import * as tours from '../../src/tour-state.js';
import * as guides from '../../src/guide-dialogue.js';
import * as coinModule from '../../src/coins.js';
import { SCHOOL_STORIES } from '../../src/school-stories.js';

export { SCHOOL_STORIES, navigation, tours };
export const source = fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
export const functionSource = name => {
  const line = source.split('\n').find(line => line.startsWith(`function ${name}(`));
  assert.ok(line, `production function ${name} exists`);
  return line;
};

// Real production main.js functions, registered callbacks, input controller,
// movement, collision, arrival and stage state run against an event-capable DOM
// double. This is not a GPU/browser screenshot, native focus/event propagation,
// screen-reader, or physical touch-device test.
export function createHarness(stageModule, selected = 0) {
  const elements = new Map();
  const allElements = new Set();
  let document;
  function eventTarget(base = {}) {
    const listeners = new Map();
    return Object.assign(base, {
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
      removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== fn)); },
      emit(type, properties = {}) {
        const event = { type, target: this, currentTarget: this, defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...properties };
        for (const fn of listeners.get(type) || []) fn(event);
        return event;
      },
    });
  }
  function element(tagName = 'div') {
    const classes = new Set();
    const node = eventTarget({
      tagName: tagName.toUpperCase(), hidden: false, open: false, disabled: false,
      dataset: {}, style: {}, attributes: {}, children: [], parentElement: null, textContent: '',
      classList: { toggle(name, value) { const on = value ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); }, add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains(name) { return classes.has(name); } },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; children.forEach(child => this.appendChild(child)); },
      appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      focus() { document.activeElement = this; document.emit('focusin', { target: this }); },
      showModal() { if (this.open) throw new Error('showModal called twice without close'); this.open = true; this.modalCount = (this.modalCount || 0) + 1; },
      close() { if (!this.open) return; this.open = false; document.activeElement = null; this.emit('close'); },
      click() { if (!this.disabled) { this.onclick?.({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }); this.emit('click'); } },
      closest(selector) { let node = this; while (node) { if ((selector.includes('dialog') && node.tagName === 'DIALOG') || (selector.includes('[contenteditable]') && node.isContentEditable)) return node; node = node.parentElement; } return null; },
      querySelector(selector) { if (selector === '#joystick-knob') return $('#joystick-knob'); return this.children.find(child => selector === 'button' ? child.tagName === 'BUTTON' : selector[0] === '#' && child.id === selector.slice(1)) || null; },
      getBoundingClientRect() { return { left: 0, top: 0, width: this.id === 'joystick-knob' ? 32 : 120, height: this.id === 'joystick-knob' ? 32 : 120 }; },
      setPointerCapture() {}, hasPointerCapture() { return false; }, releasePointerCapture() {},
    });
    Object.defineProperty(node, 'ownerDocument', { get: () => document });
    allElements.add(node);
    return node;
  }
  const $ = selector => {
    if (selector === 'dialog[open]') return [...allElements].find(node => node.open && node.tagName === 'DIALOG') || null;
    if (selector === '[data-guide]') return guideButtons[0];
    if (!elements.has(selector)) {
      const id = selector.match(/^#([\w-]+)$/)?.[1];
      const tag = id && html.match(new RegExp(`<([\\w-]+)\\b([^>]*\\bid="${id}"[^>]*)>`));
      const node = element(tag?.[1] || 'div');
      node.id = id || '';
      node.hidden = tag ? /(?:\s|^)hidden(?:\s|=|$)/.test(tag[2]) : true;
      node.disabled = tag ? /(?:\s|^)disabled(?:\s|=|$)/.test(tag[2]) : false;
      elements.set(selector, node);
    }
    return elements.get(selector);
  };
  const guideButtons = ['chiikawa', 'hachiware', 'usagi'].map(guide => Object.assign(element('button'), { dataset: { guide } }));
  const friendButtons = [0, 1, 2].map(() => element('button'));
  const $$ = selector => selector === '[data-guide]' ? guideButtons : selector === '.friend' ? friendButtons : selector === '#stage-options button:not(:disabled)' ? $('#stage-options').children.filter(button => !button.disabled) : [];
  const window = eventTarget();
  document = eventTarget({ hidden: false, activeElement: null, defaultView: window,
    createElement: element, createTextNode: text => ({ textContent: text }), querySelector: $, body: { dataset: {} } });
  const actors = [0, 1, 2].map(i => ({
    model: { position: new THREE.Vector3(25 + i * 4, .25, 20), rotation: { y: 0 }, userData: { character: { rig: new THREE.Group() } } },
    shadow: { position: new THREE.Vector3() }, ring: { position: new THREE.Vector3(), material: {} },
    path: [], recovery: [], manualTrail: [], wait: 0, target: null, targetNode: 'field', node: 'field', dist: 0, phase: 0,
  }));
  const input = movement.createInputController({ element: $('#joystick') });
  const playedSounds = [];
  const context = vm.createContext({
    THREE, ...navigation, ...movement, ...cameraFollow, ...arrivals, ...tours, ...guides, ...coinModule, ...stageModule,
    SCHOOL_STORIES, actors, $, $$, document, window, input,
    loaded: true, started: false, paused: true, manual: false, selected, follow: true, speed: 1, time: 0,
    galleryActive: false, uiPhase: 'welcome', destination: 'field', nextStopAt: null,
    tour: tours.createTourState(SCHOOL_STORIES.map(story => story.id)),
    stopQuiz: stageModule.createStageState(), stopQuizId: null, stopQuizWasPaused: false,
    isStopQuizCompleted: stageModule.isStageCompleted, createStopQuizState: stageModule.createStageState, stageRenderVersion: 0,
    coins: [], kinds: ['chiikawa', 'hachiware', 'usagi'], names: ['햄스터', '가르마', '토끼'],
    audio: { unlock: () => Promise.resolve(), play(sound) { playedSounds.push(sound); } },
    animateCharacter() {}, fx() {}, showSpeech() {}, labelButton() {},
    camera: { position: new THREE.Vector3(), clone() { return this; } },
    controls: { target: new THREE.Vector3(), enablePan: false }, transition: null,
    canvas: { focus() { document.activeElement = null; } }, setTimeout(fn) { fn(); },
    speechUntil: null, speechActive: false, speechVisible: false, speechBubble: $('#character-speech'),
    toast(message) { context.lastToast = message; },
    sceneAccess(phase) { context.uiPhase = phase; }, makeElement: (tag, text, props = {}) => Object.assign(element(tag), { textContent: text }, props),
  });
  const oneLine = ['select', 'syncRunUI', 'updateStatus', 'sendTo', 'syncPauseUI', 'setFollow'];
  vm.runInContext(oneLine.map(functionSource).join('\n'), context);
  vm.runInContext(source.slice(source.indexOf('function targetFor('), source.indexOf('const loader=')), context);
  vm.runInContext(source.slice(source.indexOf('function setManual('), source.indexOf("$('#manual').onclick=")) + "$('#manual').onclick=()=>setManual(!manual);", context);
  vm.runInContext(source.slice(source.indexOf('const introShownIds='), source.indexOf('function updateCoins(')), context);
  const friendBinding = source.split('\n').find(line => line.startsWith("$$('.friend').forEach"));
  if (friendBinding) vm.runInContext(friendBinding, context);
  const resetBinding = source.split('\n').find(line => line.startsWith("$('#reset').onclick="));
  if (resetBinding) vm.runInContext(resetBinding, context);
  // Camera-only overview effects are outside this integration harness.
  $('#overview').onclick = () => {};
  return { context, actors, $, $$, document, window, guideButtons, friendButtons, playedSounds,
    read(expression) { return vm.runInContext(expression, context); },
    start(kind = context.kinds[selected]) { guideButtons[context.kinds.indexOf(kind)].click(); $('#explore-start').click(); },
    tick(frames = 1) { for (let n = 0; n < frames; n++) { if (!context.paused && !context.galleryActive) context.time += .05; if (!context.galleryActive) context.updateActors(.05); context.checkTourArrival(); context.updateTravelHelp(); } },
    key(code, type = 'keydown', target = null) { return window.emit(type, { code, key: code === 'ShiftLeft' ? 'Shift' : code, target, ctrlKey: false, metaKey: false, altKey: false }); },
  };
}

export function arrive(h, index, { rescue = false } = {}) {
  const c = h.context, story = SCHOOL_STORIES[index];
  if (rescue) {
    const actor = h.actors[c.selected];
    actor.model.position.set(-2.79, .25, -20); actor.recovery = []; actor.manualTrail = [];
    c.navigateStop(index); h.tick(301);
    assert.equal(h.$('#travel-help').hidden, false, `${story.id}: 15-second assistance appears`);
    h.$('#travel-jump').click();
  } else {
    if (h.read('activeGoalId') !== story.id) c.navigateStop(index);
    let frames = 0;
    while (!c.tour.visitedIds.includes(story.id) && frames++ < 4000) h.tick();
    assert.ok(c.tour.visitedIds.includes(story.id), `${story.id}: no arrival after ${frames * .05}s; ${JSON.stringify(h.actors[c.selected].model.position)}`);
  }
  assert.equal(h.$('#story-card').hidden, false, `${story.id}: arrival shows explanation`);
  assert.equal(h.$('#story-card').dataset.arrival, 'true');
  assert.equal(h.$('#stop-quiz-dialog').open, false, `${story.id}: arrival does not launch game`);
  return story;
}
