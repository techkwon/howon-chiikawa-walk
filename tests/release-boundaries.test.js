import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const sceneAccess = source.split('\n').find(line => line.startsWith('function sceneAccess('));
const contextLost = source.split('\n').find(line => line.startsWith("canvas.addEventListener('webglcontextlost'"));
const interactKey = source.split('\n').find(line => line.startsWith("window.addEventListener('keydown',e=>{if(e.code==='KeyE'"));

for (const phase of ['loading', 'welcome', 'game']) {
  test(`graphics recovery is not explicitly inert during ${phase}`, () => {
    let lost;
    const dialog = { id: 'graphics-error', open: false, inert: false, showModal() { this.open = true; } };
    const button = { focus() {} };
    const elements = { '#app': { children: [dialog, { id: 'loading' }, { id: 'welcome' }] }, '#graphics-error': dialog, '#graphics-reload': button };
    const context = { uiPhase: '', paused: false, $: selector => elements[selector], canvas: { addEventListener(type, handler) { lost = handler; } }, input: { reset() {} }, syncPauseUI() {}, audio: { suspend() {} } };
    vm.createContext(context);
    vm.runInContext(sceneAccess, context);
    vm.runInContext(`sceneAccess('${phase}')`, context);
    vm.runInContext(contextLost, context);
    lost({ preventDefault() {} });
    assert.equal(dialog.open, true);
    assert.equal(dialog.inert, false, 'recovery dialog must clear its own inert flag before accepting input');
  });
}

for (const tagName of ['BUTTON', 'A', 'SUMMARY']) {
  test(`E interaction does not activate while ${tagName} has focus`, () => {
    let keydown, interactions = 0, prevented = false;
    const target = { tagName, isContentEditable: false, closest() { return this; } };
    const context = { window: { addEventListener(type, handler) { keydown = handler; } }, document: { activeElement: target }, $: () => null, interact() { interactions++; } };
    vm.runInNewContext(interactKey, context);
    keydown({ code: 'KeyE', target, repeat: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { prevented = true; } });
    assert.equal(interactions, 0);
    assert.equal(prevented, false);
  });
}

test('E interaction continues to work on the scene canvas', () => {
  let keydown, interactions = 0, prevented = false;
  const target = { tagName: 'CANVAS', isContentEditable: false, closest() { return null; } };
  const context = { window: { addEventListener(type, handler) { keydown = handler; } }, document: { activeElement: target }, $: () => null, interact() { interactions++; } };
  vm.runInNewContext(interactKey, context);
  keydown({ code: 'KeyE', target, repeat: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { prevented = true; } });
  assert.equal(interactions, 1);
  assert.equal(prevented, true);
});

test('late model completion does not make the open recovery dialog inert again', () => {
  let lost;
  const dialog = { id: 'graphics-error', open: false, inert: false, showModal() { this.open = true; } };
  const elements = { '#app': { children: [dialog, { id: 'loading' }, { id: 'welcome' }] }, '#graphics-error': dialog, '#graphics-reload': { focus() {} } };
  const context = { uiPhase: '', paused: false, $: selector => elements[selector], canvas: { addEventListener(type, handler) { lost = handler; } }, input: { reset() {} }, syncPauseUI() {}, audio: { suspend() {} } };
  vm.createContext(context);
  vm.runInContext(sceneAccess, context);
  vm.runInContext("sceneAccess('loading')", context);
  vm.runInContext(contextLost, context);
  lost({ preventDefault() {} });
  vm.runInContext("sceneAccess('welcome')", context);
  assert.equal(dialog.open, true);
  assert.equal(dialog.inert, false);
});
