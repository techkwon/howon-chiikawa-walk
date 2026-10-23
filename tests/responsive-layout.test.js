import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

// Static stylesheet/geometry checks only. These are not browser layout, screenshot,
// WebGL, assistive technology, or physical touch-device tests.
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ast = postcss.parse(css);
const fluid = css.slice(css.indexOf('/* FLUID UI SCALE:'));
const viewports = [
  [280, 653], [320, 568], [360, 740], [390, 844], [430, 932],
  [768, 1024], [1024, 768], [1440, 900], [1920, 1080],
  [568, 320], [844, 390], [720, 720], [882, 1104], [1024, 600],
];
function mediaMatches(query, { width, height, root }) {
  if (/prefers-|forced-colors|hover:/.test(query)) return false;
  if (/orientation:\s*portrait/.test(query) && width > height) return false;
  if (/orientation:\s*landscape/.test(query) && width <= height) return false;
  for (const [, bound, axis, amount, unit] of query.matchAll(/(min|max)-(width|height):\s*([\d.]+)(px|rem)/g)) {
    const value = (axis === 'width' ? width : height);
    const limit = Number(amount) * (unit === 'rem' ? root : 1);
    if (bound === 'min' ? value < limit : value > limit) return false;
  }
  return true;
}
function active(node, context) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && !mediaMatches(parent.params, context)) return false;
  }
  return true;
}
function tokens(context) {
  const values = {};
  ast.walkRules(rule => {
    if (![':root', '#app'].includes(rule.selector) || !active(rule, context)) return;
    rule.walkDecls(declaration => {
      if (declaration.prop.startsWith('--')) values[declaration.prop] = declaration.value;
    });
  });
  return values;
}
function evaluate(expression, context, values = tokens(context)) {
  let text = expression;
  for (let i = 0; i < 40 && /var\(/.test(text); i++) {
    text = text.replace(/var\((--[\w-]+)\)/g, (_, key) => {
      assert.ok(values[key], `Missing token ${key}`);
      return `(${values[key]})`;
    });
  }
  text = text.replace(/env\(safe-area-inset-(top|right|bottom|left),\s*0px\)/g, (_, edge) => String(context.safe?.[edge] || 0));
  text = text.replace(/(-?(?:\d*\.)?\d+)(dvh|vmin|vw|vh|rem|px)\b/g, (_, number, unit) => {
    const scale = { px: 1, rem: context.root, vw: context.width / 100, vh: context.height / 100, dvh: context.height / 100, vmin: Math.min(context.width, context.height) / 100 }[unit];
    return String(Number(number) * scale);
  }).replace(/calc\(/g, '(');
  assert.match(text, /^[\d\s.,()+*/\-a-z]+$/, `Unexpected CSS math ${text}`);
  assert.doesNotMatch(text, /var|env|rem|vh|vw|px/);
  const result = Function('min', 'max', 'clamp', `"use strict"; return (${text});`)(Math.min, Math.max, (low, preferred, high) => Math.max(low, Math.min(preferred, high)));
  assert.ok(Number.isFinite(result), `Non-finite CSS math: ${expression}`);
  return result;
}
const context = (width, height, root = 16, safe = {}) => ({ width, height, root, safe });
const token = (name, ctx) => evaluate(`var(${name})`, ctx);

test('fluid font tokens keep rem lower and upper bounds instead of fixed pixel caps', () => {
  const base = tokens(context(1440, 900));
  for (const name of ['micro', 'label', 'body', 'reading', 'heading', 'display']) {
    const value = base[`--ui-font-${name}`];
    assert.match(value, /^clamp\([\d.]+rem, .*vw, [\d.]+rem\)$/);
    assert.doesNotMatch(value, /px/);
  }
  assert.match(fluid, /html\s*\{\s*font-size:\s*100%/);
  assert.doesNotMatch(fluid, /font-size:\s*(?:\d*\.)?\d+px/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/);
});

test('wide viewports increase typography and panel size without changing DPR', () => {
  const phone = context(390, 844), desktop = context(1920, 1080);
  for (const name of ['body', 'reading', 'heading', 'display']) {
    assert.ok(token(`--ui-font-${name}`, desktop) > token(`--ui-font-${name}`, phone));
  }
  assert.ok(token('--ui-story-width', desktop) > token('--ui-story-width', phone));
  assert.ok(token('--ui-speech-width', desktop) > token('--ui-speech-width', phone));
  assert.doesNotMatch(fluid, /devicePixelRatio\s*[:=]|resolution\s*:/);
});

test('320 through 1920, short landscape and Fold viewports keep fluid widths within safe-area bounds', () => {
  for (const [width, height] of viewports) {
    for (const root of [16, 20, 32]) {
      const ctx = context(width, height, root, { left: width > height ? 24 : 0, right: width > height ? 24 : 0, top: 12, bottom: 16 });
      const available = token('--ui-available-width', ctx);
      assert.ok(available > 0 && available <= width);
      for (const name of ['rail', 'companion', 'story', 'speech', 'dialog']) {
        const value = token(`--ui-${name}-width`, ctx);
        assert.ok(value > 0 && value <= available + .001, `${width}×${height}, ${root}px root: ${name} ${value} > ${available}`);
      }
      const pair = token('--ui-peek-width', ctx) * 2 + token('--ui-gap', ctx);
      assert.ok(pair <= available + .001, `${width}×${height}: peek panels exceed width`);
    }
  }
});

test('44 CSS-pixel target floor survives fluid sizing and a 200% user font setting', () => {
  for (const [width, height] of viewports) {
    const normal = token('--ui-control-size', context(width, height));
    const enlarged = token('--ui-control-size', context(width, height, 32));
    assert.ok(normal >= 44);
    assert.ok(enlarged >= normal * 2);
  }
  assert.match(fluid, /--ui-control-size:\s*max\(44px,\s*2\.75rem\)/);
  assert.match(fluid, /\.toolbar button, \.toolbar \.primary, \.toolbar #reset\s*\{[^}]*min-width:\s*44px/);
});

test('phone toolbar retains all six core controls and enough track width at 100% and 200% text', () => {
  const nav = html.match(/<nav class="toolbar[\s\S]*?<\/nav>/)?.[0] || '';
  const ids = [...nav.matchAll(/<button id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, ['play', 'follow', 'overview', 'gallery-toggle', 'photo', 'reset']);
  for (const width of [320, 360, 390, 430, 480]) {
    for (const root of [16, 32]) {
      const ctx = context(width, 844, root);
      const available = token('--ui-available-width', ctx);
      const track = (available - .375 * root * 2 - 2 - .25 * root * 2) / 3;
      assert.ok(track >= 44, `${width}px / ${root}px root: track ${track}`);
      assert.ok(token('--toolbar-height', ctx) >= token('--ui-control-size', ctx) * 2);
    }
  }
});

test('user font enlargement grows labels rather than hitting a pixel cap', () => {
  for (const [width, height] of viewports) {
    for (const name of ['micro', 'label', 'body', 'reading', 'heading', 'display']) {
      const normal = token(`--ui-font-${name}`, context(width, height));
      const enlarged = token(`--ui-font-${name}`, context(width, height, 32));
      assert.ok(enlarged > normal * 1.35, `${width}: ${name} failed to grow enough`);
    }
  }
  const reflow = '(max-width: 24rem) and (max-height: 32rem) and (orientation: portrait)';
  assert.equal(mediaMatches(reflow, context(320, 568)), false);
  assert.equal(mediaMatches(reflow, context(320, 568, 32)), true);
  assert.ok(fluid.includes(`@media ${reflow}`));
  assert.match(fluid, /#app\s*\{\s*display:\s*grid;[^}]*overflow-y:\s*auto/);
});

test('all dialogs, reading panels, settings and dense controls remain scrollable', () => {
  for (const id of ['info', 'stop-quiz-dialog', 'farewell']) assert.ok(html.includes(`<dialog id="${id}"`));
  assert.match(fluid, /dialog, #quiz-dialog, #farewell\s*\{[^}]*width:\s*var\(--ui-dialog-width\)/);
  assert.match(css, /dialog\s*\{[^}]*overflow-y:\s*auto/s);
  for (const selector of ['.toolbar', '.companions', '.walk-mode', '#gallery-controls']) {
    assert.ok(fluid.includes(`${selector} {`) || fluid.includes(`${selector},`));
  }
  assert.match(fluid, /\.walk-mode\s*\{[^}]*flex-wrap:\s*wrap;[^}]*overflow-y:\s*auto/);
  assert.match(fluid, /\.toolbar\s*\{[^}]*overflow-y:\s*auto/);
});

test('compact HUD, gallery, run control and reduced-motion behavior are preserved', () => {
  for (const id of ['hud-toggle', 'manual', 'run-toggle', 'school-tour', 'music-toggle', 'sound-toggle', 'season-toggle', 'day-toggle', 'gallery-prev', 'gallery-next', 'gallery-photo', 'gallery-close', 'camera-fov', 'camera-distance', 'camera-reset']) assert.ok(html.includes(`id="${id}"`), `${id} missing`);
  assert.match(css, /body\[data-compact="true"\]/);
  assert.match(css, /body\[data-gallery="true"\]/);
  assert.match(css, /#run-toggle\[aria-pressed="true"\]/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation:\s*none\s*!important/);
  assert.match(fluid, /#joystick-knob\s*\{[^}]*left:\s*calc\(\(100% - var\(--ui-knob-size\)\) \/ 2\)/);
});
