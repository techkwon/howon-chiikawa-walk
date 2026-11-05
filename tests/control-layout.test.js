import test from 'node:test';
import assert from 'node:assert/strict';
import { controlStack } from '../src/control-layout.js';

test('desktop controls stack above the actual dock without overlapping variable-height labels', () => {
  for (const scale of [1, 1.25, 2]) {
    const dockTop = 168 * scale, gap = 16 * scale;
    for (const interactVisible of [false, true]) {
      for (const captionVisible of [false, true]) {
        const heights = [['walk', 60 * scale], ['interact', interactVisible ? 44 * scale : 0], ['caption', captionVisible ? 48 * scale : 0], ['toast', 72 * scale]];
        const offsets = controlStack(dockTop, gap, heights);
        let previousTop = dockTop;
        for (const [name, height] of heights) {
          if (!height) continue;
          assert.equal(offsets[name] - previousTop, gap);
          previousTop = offsets[name] + height;
        }
        if (!interactVisible) assert.equal(offsets.interact, offsets.walk + heights[0][1]);
      }
    }
  }
});
