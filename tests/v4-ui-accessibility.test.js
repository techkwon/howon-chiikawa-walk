import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

// Source/stylesheet assertions only. These cannot certify physical target sizes,
// browser zoom, screen-reader behavior, GPU output, contrast or a rendered layout.
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const ast = postcss.parse(css);
const v4 = css.slice(css.indexOf('/* V4 approval-candidate UI:'));
const core = ['play', 'follow', 'overview', 'gallery-toggle', 'photo', 'reset'];
const nav = html.match(/<nav class="toolbar[\s\S]*?<\/nav>/)?.[0] || '';
const settings = html.match(/<details id="experience-settings"[\s\S]*?<\/details>/)?.[0] || '';
const button = (source, id) => source.match(new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/button>`));

test('six core toolbar actions have visible Korean text as well as symbols', () => {
  assert.deepEqual([...nav.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]), core);
  for (const id of core) {
    const match = button(nav, id);
    assert.ok(match, `${id} missing`);
    assert.match(match[1].replace(/<[^>]*>/g, ''), /[가-힣]{2}/, `${id} has no visible Korean label`);
    assert.match(match[1], /<(?:span|b)\b/, `${id} label needs a layout element`);
  }
  assert.match(v4, /\.toolbar button span, \.toolbar button b\s*\{[^}]*display:\s*block;[^}]*white-space:\s*normal/s);
  assert.match(v4, /grid-template-columns:\s*repeat\(6, minmax\(44px, 1fr\)\)/);
  assert.match(v4, /grid-template-columns:\s*repeat\(3, minmax\(44px, 1fr\)\)/);
});

test('speed and quality remain available once each in settings rather than disappearing', () => {
  for (const id of ['speed', 'quality']) {
    assert.ok(button(settings, id), `${id} not preserved in settings`);
    assert.equal((html.match(new RegExp(`\\bid="${id}"`, 'g')) || []).length, 1, `${id} duplicated`);
    assert.equal(button(nav, id), null);
  }
  assert.match(v4, /#experience-settings #speed, #experience-settings #quality\s*\{\s*min-height:\s*var\(--ui-control-size\)/);
});

test('all screen sizes start in compact mode without hiding the core toolbar', () => {
  assert.match(main, /let\s+compactHUD\s*=\s*true\s*;/);
  assert.match(main, /document\.body\.dataset\.compact\s*=\s*String\(compactHUD\)/);
  assert.match(html, /id="hud-toggle"/);
  ast.walkRules(rule => {
    if (!rule.selector.includes('body[data-compact="true"]')) return;
    if (!rule.nodes.some(node => node.prop === 'display' && node.value === 'none')) return;
    for (const selector of rule.selectors) {
      assert.ok(!core.some(id => selector.includes(`#${id}`)), `${selector} hides a core action`);
      assert.ok(!/\.toolbar(?:\s|$)/.test(selector), `${selector} hides the toolbar`);
    }
  });
});

test('200% text keeps document reflow, readable labels, keyboard focus and reduced-motion guards', () => {
  assert.match(css, /--ui-control-size:\s*max\(44px, 2\.75rem\)/);
  assert.match(v4, /@media \(max-width: 24rem\) and \(max-height: 32rem\) and \(orientation: portrait\)/);
  assert.match(v4, /@media \(max-height: 15rem\) and \(orientation: landscape\)/);
  assert.match(v4, /#app\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(v4, /@media \(max-width: 279px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(44px, 1fr\)\)/);
  assert.match(css, /button:focus-visible/);
  assert.match(v4, /prefers-reduced-motion:\s*reduce[^}]+animation:\s*none\s*!important[^}]+transition:\s*none\s*!important/s);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/);
});

test('start explains its disabled state, OX feedback uses words and travel recovery starts hidden', () => {
  const start = button(html, 'explore-start')?.[0] || '';
  assert.match(start, /aria-describedby="start-hint"/);
  assert.match(start, /\bdisabled(?:\s|>)/);
  assert.match(html, /id="start-hint"[^>]*>[^<]*친구[^<]*시작/);
  assert.match(main, /✓ 맞았어요/);
  assert.match(main, /↺ 다시 알아봐요/);
  assert.match(main, /✓ 정답/);
  assert.match(main, /↺ 다시 알아보기/);
  assert.match(html, /id="stop-quiz-feedback"[^>]*aria-live="polite"/);
  assert.match(html, /id="quiz-feedback"[^>]*aria-live="polite"/);
  assert.match(html, /id="travel-help"[^>]*\bhidden\b/);
  assert.match(v4, /#travel-help button\s*\{[^}]*min-height:\s*var\(--ui-control-size\)/);
  assert.match(v4, /body\[data-gallery="true"\] #travel-help\s*\{\s*display:\s*none\s*!important/);
  assert.match(v4, /#travel-help\s*\{[^}]*position:\s*absolute;[^}]*overflow-y:\s*auto/s);
});

test('long disclosure and contact links wrap and scroll instead of covering fixed controls', () => {
  assert.match(html, /운영 종료일 미정/);
  assert.match(html, /문의·삭제 요청/);
  assert.match(v4, /--ui-footer-space:\s*max\(88px, 5\.5rem\)/);
  assert.match(v4, /footer\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
  assert.match(v4, /footer button, footer a\s*\{[^}]*min-height:\s*var\(--ui-control-size\)[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(v4, /\.toolbar\s*\{[^}]*bottom:\s*calc\(var\(--ui-footer-space\) \+ var\(--safe-bottom\)\)/s);
});

test('CSS no longer contacts Google Fonts or another external font host', () => {
  assert.doesNotMatch(css, /@import\b/i);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:\/\//i);
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/i);
  assert.match(css, /system-ui,-apple-system,BlinkMacSystemFont/);
});
