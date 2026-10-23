import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

// Static author-cascade regression checks. This does not execute showModal(),
// reproduce browser focus behavior, or validate an actual rendered screenshot.
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ast = postcss.parse(css);
const dialogs = [...html.matchAll(/<dialog\b([^>]*)>/g)].map(([, attributes]) => ({
  tag: 'dialog', id: attributes.match(/\bid="([^"]+)"/)?.[1],
  open: /(?:^|\s)open(?:\s|=|$)/.test(attributes),
  hidden: /(?:^|\s)hidden(?:\s|=|$)/.test(attributes),
  classes: [],
}));
const viewports = [[280, 653], [320, 568], [390, 844], [568, 320], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
function mediaMatches(query, { width, height, root }) {
  if (/prefers-|forced-colors|hover:/.test(query)) return false;
  if (/orientation:\s*portrait/.test(query) && width > height) return false;
  if (/orientation:\s*landscape/.test(query) && width <= height) return false;
  for (const [, bound, axis, amount, unit] of query.matchAll(/(min|max)-(width|height):\s*([\d.]+)(px|rem)/g)) {
    const value = axis === 'width' ? width : height;
    const limit = Number(amount) * (unit === 'rem' ? root : 1);
    if (bound === 'min' ? value < limit : value > limit) return false;
  }
  return true;
}
function active(rule, viewport) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && !mediaMatches(parent.params, viewport)) return false;
  }
  return true;
}
function matches(selector, target, state) {
  if (selector.includes('::') || selector.includes(':has(')) return false;
  if (selector.includes('body[data-gallery="true"]') && !state.gallery) return false;
  if (selector.includes('body[data-compact="true"]') && !state.compact) return false;
  let terminal = selector.trim().split(/\s+(?![^[]*\])/).at(-1);
  if (terminal.includes(':not([open])')) {
    if (target.open) return false;
    terminal = terminal.replace(':not([open])', '');
  }
  if (terminal.includes('[open]') && !target.open) return false;
  if (terminal.includes('[hidden]') && !target.hidden) return false;
  terminal = terminal.replace(/\[(?:open|hidden)\]/g, '');
  if (terminal.includes('[') || terminal.includes(':')) return false;
  const id = terminal.match(/#([\w-]+)/)?.[1];
  if (id && id !== target.id) return false;
  const classes = [...terminal.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
  if (!classes.every(name => target.classes.includes(name))) return false;
  const tag = terminal.match(/^([a-z][\w-]*)/)?.[1];
  return !tag || tag === target.tag;
}
function specificity(selector) {
  const text = selector.replace(/:not\(([^)]+)\)/g, '$1');
  return [
    (text.match(/#[\w-]+/g) || []).length,
    (text.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length,
    (text.match(/(?:^|[\s>+~])([a-z][\w-]*)/g) || []).length,
  ];
}
function beats(next, previous) {
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== previous[i]) return next[i] > previous[i];
  }
  return true;
}
function computed(target, viewport, state = {}) {
  const result = { display: target.hidden || (target.tag === 'dialog' && !target.open) ? 'none' : 'block' };
  const ranks = {};
  let order = 0;
  ast.walkRules(rule => {
    if (!active(rule, viewport)) return;
    const matching = rule.selectors.filter(selector => matches(selector, target, state));
    if (!matching.length) return;
    const spec = matching.map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    rule.walkDecls(declaration => {
      order++;
      if (!['display', 'visibility', 'pointer-events'].includes(declaration.prop)) return;
      const rank = [declaration.important ? 1 : 0, ...spec, order];
      if (!ranks[declaration.prop] || beats(rank, ranks[declaration.prop])) {
        result[declaration.prop] = declaration.value;
        ranks[declaration.prop] = rank;
      }
    });
  });
  return result;
}

test('every dialog in the initial HTML is closed and cannot start as an open game', () => {
  assert.deepEqual(dialogs.map(dialog => dialog.id).sort(), ['farewell', 'info', 'stop-quiz-dialog']);
  for (const dialog of dialogs) assert.equal(dialog.open, false, `${dialog.id} has an initial open attribute`);
  assert.match(html, /<div id="welcome"(?![^>]*\bhidden\b)/);
  for (const id of ['story-card', 'gallery-controls', 'character-speech', 'run-toggle']) {
    const tag = html.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(tag && /\bhidden(?:\s|=|>)/.test(tag), `${id} must start hidden`);
  }
});

test('explicit unconditional guards remove closed dialogs and hidden panels from layout', () => {
  for (const selector of ['dialog:not([open])', '#app dialog:not([open])', '[hidden]', '#app [hidden]']) {
    const guards = [];
    ast.walkRules(rule => { if (rule.parent.type === 'root' && rule.selectors.includes(selector)) guards.push(rule); });
    assert.ok(guards.some(rule => rule.nodes.some(node => node.prop === 'display' && node.value === 'none' && node.important)), `${selector} needs a top-level display:none!important guard`);
  }
});

test('closed game and information dialogs remain non-rendered through every responsive layout', () => {
  for (const [width, height] of viewports) for (const root of [16, 32]) for (const dialog of dialogs) {
    const result = computed(dialog, { width, height, root });
    assert.equal(result.display, 'none', `${dialog.id} visible at ${width}×${height}, root ${root}`);
    assert.equal(result.visibility, 'hidden');
    assert.equal(result['pointer-events'], 'none');
  }
});

test('hidden welcome, gallery, story, speech and run controls cannot be revived by flex/grid or HUD states', () => {
  const targets = [
    { id: 'welcome', tag: 'div', classes: [] },
    { id: 'gallery-controls', tag: 'section', classes: ['panel'] },
    { id: 'story-card', tag: 'section', classes: ['panel'] },
    { id: 'character-speech', tag: 'aside', classes: [] },
    { id: 'run-toggle', tag: 'button', classes: [] },
  ];
  for (const [width, height] of viewports) for (const root of [16, 32]) {
    for (const state of [{}, { gallery: true }, { compact: true }]) for (const target of targets) {
      const result = computed({ ...target, hidden: true, open: false }, { width, height, root }, state);
      assert.equal(result.display, 'none', `${target.id} visible at ${width}×${height}`);
      assert.equal(result.visibility, 'hidden');
      assert.equal(result['pointer-events'], 'none');
    }
  }
});

test('the closed-state safety guard stops matching after an explicit dialog open', () => {
  for (const dialog of dialogs) {
    const result = computed({ ...dialog, open: true, hidden: false }, { width: 390, height: 844, root: 16 });
    assert.notEqual(result.display, 'none', `${dialog.id} cannot open`);
    assert.notEqual(result.visibility, 'hidden');
    assert.notEqual(result['pointer-events'], 'none');
    const stillHidden = computed({ ...dialog, open: true, hidden: true }, { width: 390, height: 844, root: 16 });
    assert.equal(stillHidden.display, 'none', 'hidden must still win even on an open dialog');
  }
});

test('initial guide choice does not bypass the explicit, disabled-until-selection start control', () => {
  const start = html.match(/<button\b[^>]*\bid="explore-start"[^>]*>/)?.[0];
  assert.ok(start, 'Explicit start action is missing');
  assert.match(start, /\bdisabled(?:\s|=|>)/);
  const styleRules = [];
  ast.walkRules(rule => { if (rule.selectors.includes('#explore-start')) styleRules.push(rule); });
  assert.ok(styleRules.some(rule => rule.nodes.some(node => node.prop === 'width' && node.value === '100%')));
  assert.ok(styleRules.some(rule => rule.nodes.some(node => node.prop === 'min-height' && node.value === 'var(--ui-control-size)')));
  assert.match(css, /\.guide-choices button\[aria-pressed="true"\]\s*\{[^}]*border-color:[^}]*background:/);
});
