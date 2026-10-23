import test from 'node:test';
import assert from 'node:assert/strict';
import { positionSpeechBubble } from '../src/speech-bubble.js';

const fixture = overrides => ({
  ndc: { x: 0, y: 0, z: 0 }, inFront: true,
  width: 1000, height: 800, bubbleWidth: 200, bubbleHeight: 100,
  insets: { top: 20, right: 20, bottom: 20, left: 20 }, ...overrides,
});
const assertContained = (result, options) => {
  assert.equal(result.visible, true);
  const { top = 0, right = 0, bottom = 0, left = 0 } = options.insets;
  assert.ok(result.x >= left && result.x + options.bubbleWidth <= options.width - right);
  assert.ok(result.y >= top && result.y + options.bubbleHeight <= options.height - bottom);
  assert.ok(result.tailX >= 12 && result.tailX <= options.bubbleWidth - 12);
};

test('centered head prefers above even when both placements fit', () => {
  assert.deepEqual(positionSpeechBubble(fixture()), {
    visible: true, x: 400, y: 282, tailX: 100, placement: 'above',
  });
});

test('head near the top switches below when the above position cannot fit', () => {
  assert.deepEqual(positionSpeechBubble(fixture({ ndc: { x: 0, y: 0.875, z: 0 }, gap: 20 })), {
    visible: true, x: 400, y: 70, tailX: 100, placement: 'below',
  });
});

test('below placement applies to a head on the upper frustum edge without a reserved top inset', () => {
  const result = positionSpeechBubble(fixture({ ndc: { x: 0, y: 1, z: 0 }, insets: {} }));
  assert.equal(result.placement, 'below');
  assert.equal(result.y, 18);
});

test('when neither side fits, the preferred above position is clamped into the safe area', () => {
  const options = fixture({ height: 200, bubbleHeight: 130 });
  const result = positionSpeechBubble(options);
  assertContained(result, options);
  assert.equal(result.placement, 'above');
  assert.equal(result.y, 20);
  assert.deepEqual(positionSpeechBubble(fixture({ ndc: { x: 0, y: 1, z: 0 } })), {
    visible: true, x: 400, y: 20, tailX: 100, placement: 'above',
  });
});

test('horizontal viewport edges clamp the bubble and keep the tail away from rounded corners', () => {
  for (const [x, expectedX, expectedTailX] of [[-1, 20, 12], [1, 780, 188]]) {
    const options = fixture({ ndc: { x, y: 0, z: 0 } });
    const result = positionSpeechBubble(options);
    assertContained(result, options);
    assert.equal(result.x, expectedX);
    assert.equal(result.tailX, expectedTailX);
  }
});

test('resizing recomputes pixel position and measurement without retaining old viewport state', () => {
  const ndc = Object.freeze({ x: 0.5, y: -0.25, z: 0 });
  const desktop = fixture({ ndc });
  const mobile = fixture({ ndc, width: 390, height: 844, bubbleWidth: 280 });
  const a = positionSpeechBubble(desktop), b = positionSpeechBubble(mobile);
  assertContained(a, desktop); assertContained(b, mobile);
  assert.equal(a.x, 650); assert.equal(a.y, 382);
  assert.equal(b.x, 90); assert.equal(b.y, 409.5); assert.equal(b.tailX, 202.5);
  assert.deepEqual(positionSpeechBubble(desktop), a);
});

test('mobile safe areas and reserved controls remain clear at all frustum corners', () => {
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const options = fixture({
      ndc: { x, y, z: 1 }, width: 390, height: 844,
      bubbleWidth: 280, bubbleHeight: 180,
      insets: { top: 90, right: 12, bottom: 220, left: 12 },
    });
    assertContained(positionSpeechBubble(options), options);
  }
});

test('heads behind the camera or outside any frustum plane are hidden', () => {
  assert.equal(positionSpeechBubble(fixture({ inFront: false })).visible, false);
  for (const axis of ['x', 'y', 'z']) for (const value of [-1.00001, 1.00001, -100, 100]) {
    const options = fixture({ ndc: { x: 0, y: 0, z: 0, [axis]: value } });
    assert.equal(positionSpeechBubble(options).visible, false, `${axis}=${value}`);
  }
  for (const z of [-1, 1]) assert.equal(positionSpeechBubble(fixture({ ndc: { x: 0, y: 0, z } })).visible, true);
});

test('nonfinite projections, dimensions, gaps, and insets never produce invalid CSS positions', () => {
  for (const value of [NaN, Infinity, -Infinity, undefined, '100']) {
    for (const axis of ['x', 'y', 'z']) {
      assert.equal(positionSpeechBubble(fixture({ ndc: { x: 0, y: 0, z: 0, [axis]: value } })).visible, false);
    }
    for (const name of ['width', 'height', 'bubbleWidth', 'bubbleHeight']) {
      assert.equal(positionSpeechBubble(fixture({ [name]: value })).visible, false);
    }
  }
  for (const value of [NaN, Infinity, -1]) {
    assert.equal(positionSpeechBubble(fixture({ gap: value })).visible, false);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      assert.equal(positionSpeechBubble(fixture({ insets: { [side]: value } })).visible, false);
    }
  }
  for (const options of [undefined, null, {}, fixture({ ndc: null }), fixture({ insets: null })]) {
    assert.deepEqual(positionSpeechBubble(options), { visible: false, x: 0, y: 0, tailX: 0, placement: 'above' });
  }
});

test('zero, negative, or impossible safe-area dimensions hide until a valid layout is measured', () => {
  for (const name of ['width', 'height', 'bubbleWidth', 'bubbleHeight']) for (const value of [0, -1]) {
    assert.equal(positionSpeechBubble(fixture({ [name]: value })).visible, false);
  }
  for (const options of [
    fixture({ bubbleWidth: 1000 }), fixture({ bubbleHeight: 800 }),
    fixture({ insets: { left: 600, right: 600 } }),
    fixture({ insets: { top: 600, bottom: 600 } }),
  ]) assert.equal(positionSpeechBubble(options).visible, false);
});

test('exact safe-area fits, zero gap, and unusually narrow bubbles stay finite', () => {
  const exact = fixture({ width: 240, height: 140, gap: 0 });
  assert.deepEqual(positionSpeechBubble(exact), { visible: true, x: 20, y: 20, tailX: 100, placement: 'above' });
  const narrow = positionSpeechBubble(fixture({ bubbleWidth: 10, ndc: { x: -1, y: 0, z: 0 } }));
  assert.equal(narrow.visible, true); assert.equal(narrow.tailX, 5);
});

test('input data can be frozen and is never mutated', () => {
  const options = Object.freeze(fixture({
    ndc: Object.freeze({ x: 0.2, y: 0.1, z: 0.5 }),
    insets: Object.freeze({ top: 30, right: 12, bottom: 200, left: 12 }),
  }));
  const before = structuredClone(options);
  assert.equal(positionSpeechBubble(options).visible, true);
  assert.deepEqual(options, before);
});
