import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

// CSS declaration and numeric geometry checks, NOT a rendering engine. These do
// not establish text shaping, native scrolling, focus navigation, phone, or GPU QA.
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ast = postcss.parse(css);
const mobile = css.slice(css.indexOf('/* MOBILE REVIEW:'));
const context = (width, height, root = 16, extra = {}) => ({ width, height, root, coarse: true, safe: {}, ...extra });
const portrait = [[320, 568], [360, 740], [390, 844], [412, 915], [768, 1024]];
const landscape = [[568, 320], [740, 360], [844, 390], [915, 412], [1024, 768]];

function mediaMatches(query, ctx) {
  // Commas are OR, not AND. rem thresholds represent browser default-font settings.
  return query.split(',').some(part => {
    if (/prefers-reduced-motion:\s*reduce/.test(part) && !ctx.reduced) return false;
    if (/forced-colors|hover:/.test(part)) return false;
    if (/pointer:\s*coarse/.test(part) && !ctx.coarse) return false;
    if (/orientation:\s*portrait/.test(part) && ctx.width > ctx.height) return false;
    if (/orientation:\s*landscape/.test(part) && ctx.width <= ctx.height) return false;
    for (const [, bound, axis, amount, unit] of part.matchAll(/(min|max)-(width|height):\s*([\d.]+)(px|rem)/g)) {
      const limit = Number(amount) * (unit === 'rem' ? ctx.root : 1);
      if (bound === 'min' ? ctx[axis] < limit : ctx[axis] > limit) return false;
    }
    return true;
  });
}
function active(rule, ctx) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && !mediaMatches(parent.params, ctx)) return false;
  }
  return true;
}
function specificity(selector) {
  // Only the explicit selector sets used below; not a general DOM/CSS matcher.
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const types = (selector.match(/(?:^|\s)(?:body|button|dialog|summary|footer)(?=[\s\[.#:]|$)/g) || []).length;
  return ids * 100 + classes * 10 + types;
}
function styles(selectors, ctx) {
  const declarations = {};
  ast.walkRules(rule => {
    if (!active(rule, ctx)) return;
    const matching = rule.selectors.filter(selector => selectors.includes(selector));
    if (!matching.length) return;
    const rank = Math.max(...matching.map(specificity));
    rule.nodes.filter(node => node.type === 'decl').forEach(decl => {
      const score = rank + (decl.important ? 10000 : 0);
      if (!declarations[decl.prop] || declarations[decl.prop].score <= score) declarations[decl.prop] = { value: decl.value, score };
    });
  });
  return Object.fromEntries(Object.entries(declarations).map(([key, item]) => [key, item.value]));
}
function tokens(ctx) {
  return Object.fromEntries(Object.entries(styles([':root', '#app'], ctx)).filter(([key]) => key.startsWith('--')));
}
function number(expression, ctx) {
  const values = tokens(ctx);
  let value = expression;
  for (let i = 0; i < 40 && /var\(/.test(value); i++) {
    value = value.replace(/var\((--[\w-]+)\)/g, (_, key) => {
      assert.ok(values[key], `Missing CSS token ${key}`);
      return `(${values[key]})`;
    });
  }
  value = value.replace(/env\(safe-area-inset-(top|right|bottom|left),\s*0px\)/g, (_, side) => String(ctx.safe[side] || 0));
  value = value.replace(/(-?(?:\d*\.)?\d+)(dvh|vmin|vw|vh|rem|px|%)/g, (_, amount, unit) => String(Number(amount) * {
    px: 1, rem: ctx.root, vw: ctx.width / 100, vh: ctx.height / 100, dvh: ctx.height / 100,
    vmin: Math.min(ctx.width, ctx.height) / 100, '%': ctx.width / 100,
  }[unit])).replace(/calc\(/g, '(');
  assert.match(value, /^[\d\s.,()+*/\-a-z]+$/);
  assert.doesNotMatch(value, /var|env|rem|vh|vw|px/);
  const result = Function('min', 'max', 'clamp', `"use strict"; return (${value});`)(Math.min, Math.max, (low, preferred, high) => Math.max(low, Math.min(preferred, high)));
  assert.ok(Number.isFinite(result));
  return result;
}
const token = (name, ctx) => number(`var(${name})`, ctx);

for (const [width, height] of [...portrait, ...landscape]) {
  test(`mobile CSS dock budget and target geometry at ${width}×${height}`, () => {
    const ctx = context(width, height);
    const dock = styles(['.toolbar'], ctx);
    assert.equal(dock['grid-template-columns'], 'repeat(6, minmax(44px, 1fr))');
    assert.equal(dock.height, 'var(--mobile-dock-height)');
    const available = token('--mobile-available', ctx);
    const targetWidth = (available - .25 * ctx.root * 2 - 2 - .125 * ctx.root * 5) / 6;
    assert.ok(targetWidth >= 44, `${targetWidth}px wide target`);
    assert.equal(token('--mobile-dock-height', ctx), 72);
    assert.equal(token('--mobile-dock-bottom', ctx), 28);
    assert.equal(token('--mobile-dock-height', ctx) + token('--mobile-dock-bottom', ctx), 100);
    assert.ok(token('--ui-control-size', ctx) >= 44);
    assert.equal(styles(['#app'], ctx)['overflow'], 'clip');
  });
}

test('safe areas are included once in bottom controls and horizontal widths', () => {
  for (const [width, height] of [[390, 844], [844, 390], [1024, 768]]) {
    const safe = { top: 24, bottom: 34, left: width > height ? 24 : 0, right: width > height ? 24 : 0 };
    const ctx = context(width, height, 16, { safe });
    assert.equal(token('--mobile-dock-bottom', ctx), 62);
    assert.equal(token('--mobile-available', ctx), width - 2 * token('--mobile-edge', ctx) - safe.left - safe.right);
    assert.ok(token('--mobile-content-top', ctx) >= safe.top + 88);
    assert.ok(token('--mobile-walk-bottom', ctx) >= token('--mobile-dock-bottom', ctx) + 72 + 8);
    const walk = styles(['.walk-mode', 'body[data-compact="true"] .walk-mode'], ctx);
    assert.ok(number(walk.width, ctx) + token('--mobile-joystick-size', ctx) < token('--mobile-available', ctx));
  }
});

test('coarse-pointer Fold inner layout extends beyond 900px without replacing desktop mode', () => {
  assert.ok(tokens(context(1024, 768, 16, { coarse: true }))['--mobile-dock-height']);
  assert.equal(tokens(context(1024, 768, 16, { coarse: false }))['--mobile-dock-height'], undefined);
  assert.equal(tokens(context(1440, 900, 16, { coarse: true }))['--mobile-dock-height'], undefined);
});

test('200% default text and narrow zoomed views reflow the HUD instead of shrinking targets', () => {
  for (const ctx of [
    ...portrait.map(([w, h]) => context(w, h, 32)),
    ...landscape.filter(([, h]) => h < 500).map(([w, h]) => context(w, h, 32)),
    context(160, 284), context(195, 422),
  ]) {
    assert.equal(styles(['#app'], ctx).display, 'grid');
    assert.equal(styles(['#app'], ctx)['overflow-y'], 'auto');
    const dock = styles(['.toolbar'], ctx);
    assert.equal(dock.position, 'relative');
    assert.equal(dock.height, 'auto');
    assert.equal(dock['max-height'], '60dvh');
    const columns = ctx.width <= 279 ? 2 : 3;
    assert.equal(dock['grid-template-columns'], `repeat(${columns}, minmax(44px, 1fr))`);
    const track = (token('--mobile-available', ctx) - .5 * ctx.root - 2 - .125 * ctx.root * (columns - 1)) / columns;
    assert.ok(track >= 44, `${ctx.width}px / ${ctx.root}px root: ${track}px`);
    assert.ok(token('--ui-control-size', ctx) >= 44);
    if (ctx.root === 32) assert.equal(token('--ui-control-size', ctx), 88);
  }
});

test('all native dialogs use bounded dvh scrolling and safe-area centering', () => {
  for (const ctx of [context(320, 568), context(390, 844), context(768, 1024), context(844, 390), context(320, 568, 32)]) {
    for (const id of ['#info', '#stop-quiz-dialog', '#farewell']) {
      const dialog = styles(['dialog', id], ctx);
      assert.equal(dialog.position, 'fixed');
      assert.equal(dialog.inset, 'var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)');
      assert.equal(dialog.height, 'fit-content');
      assert.equal(dialog['overflow-y'], 'auto');
      assert.match(dialog['max-height'], /100dvh/);
      assert.ok(number(dialog.width, ctx) <= ctx.width);
      assert.ok(number(dialog['max-height'], ctx) < ctx.height);
      assert.equal(dialog['scroll-padding-block'], '4rem 6rem');
      const close = styles(['button', '.close', 'dialog .close'], ctx);
      assert.equal(close.position, 'sticky');
      assert.ok(number(close['min-height'], ctx) >= 44);
    }
  }
});

test('stage top close remains sticky, and both close controls retain 44px targets', () => {
  assert.match(html, /<dialog id="stop-quiz-dialog"[^>]*><button id="stop-quiz-close" class="stage-close-top"/);
  assert.match(html, /id="stage-close-bottom">나중에 이어 하기<\/button>/);
  for (const ctx of [context(320, 568), context(390, 844), context(844, 390), context(320, 568, 32), context(1440, 900)]) {
    const top = styles(['button', '.stage-close-top'], ctx);
    const bottom = styles(['button', '.quiz-nav button', '#stop-quiz-dialog .quiz-nav button'], ctx);
    assert.equal(top.position, 'sticky');
    assert.ok(number(top.top, ctx) <= 0);
    assert.ok(Number(top['z-index']) >= 5);
    assert.ok(number(top['min-height'], ctx) >= 44);
    assert.ok(number(top['min-width'], ctx) >= 44);
    assert.ok(number(bottom['min-height'], ctx) >= 44);
  }
  const enlargedNav = styles(['.quiz-nav', '#stop-quiz-dialog .quiz-nav'], context(320, 568, 32));
  assert.equal(enlargedNav.position, 'static');
  assert.equal(enlargedNav['grid-template-columns'], '1fr');
});

test('stage answers use available width, wrap long labels, and never require dragging', () => {
  for (const root of [16, 32]) {
    const ctx = context(320, 568, root);
    const grid = styles(['.stage-options'], ctx);
    const button = styles(['button', '.stage-options button'], ctx);
    assert.equal(grid['grid-template-columns'], 'repeat(auto-fit, minmax(min(100%, 8rem), 1fr))');
    assert.equal(button['white-space'], 'normal');
    assert.equal(button['overflow-wrap'], 'anywhere');
    assert.ok(number(button['min-height'], ctx) >= 48);
    const contentWidth = token('--mobile-available', ctx) - 1.5 * root - 2;
    const minimumColumn = Math.min(contentWidth, 8 * root);
    const columns = Math.floor((contentWidth + .5 * root) / (minimumColumn + .5 * root));
    assert.equal(columns, root === 16 ? 2 : 1);
  }
});

test('settings and progress open as scrollable sheets, welcome start remains reachable', () => {
  const ctx = context(390, 844);
  const settings = styles(['#experience-settings', '#experience-settings[open]'], ctx);
  const progress = styles(['#tour-progress', '#tour-progress[open]'], ctx);
  for (const sheet of [settings, progress]) {
    assert.equal(sheet['overflow-y'], 'auto');
    assert.ok(number(sheet['max-height'], ctx) > 200);
    assert.ok(number(sheet['max-height'], ctx) < ctx.height - token('--mobile-dock-height', ctx));
  }
  assert.equal(styles(['#experience-settings summary', '#experience-settings[open] summary'], ctx).position, 'sticky');
  assert.equal(styles(['#explore-start'], ctx).position, 'sticky');
  assert.equal(styles(['.welcome-card'], ctx)['overflow-y'], 'auto');
  const settingsHtml = html.match(/<details id="experience-settings"[\s\S]*?<\/details>/)?.[0] || '';
  assert.ok(settingsHtml.includes('id="credits"'));
  assert.match(html, /<footer>[\s\S]*?class="compact-disclaimer"/);
  for (const id of ['speed', 'quality', 'camera-fov', 'camera-distance', 'camera-reset', 'music-toggle', 'sound-toggle']) assert.ok(settingsHtml.includes(`id="${id}"`));
});

test('hidden state, compact mode, keyboard focus and reduced motion keep their safeguards', () => {
  const lastRule = ast.nodes.filter(node => node.type === 'rule').at(-1);
  assert.ok(lastRule.selectors.includes('[hidden]'));
  assert.ok(lastRule.selectors.includes('dialog:not([open])'));
  assert.ok(lastRule.nodes.some(node => node.prop === 'display' && node.value === 'none' && node.important));
  assert.match(css, /body\[data-compact="true"\] \.intro, body\[data-compact="true"\] \.places, body\[data-compact="true"\] \.companions \{display:none!important;/);
  assert.match(css, /body\[data-gallery="true"\] #travel-help \{ display: none !important;/);
  assert.match(mobile, /\.stage-close-top:focus-visible/);
  assert.match(mobile, /prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none\s*!important/);
  assert.doesNotMatch(css, /@import\s+url\(['"]?https:/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/);
});
