import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES, route, lanePoint, nearestNode } from '../src/navigation.js';
import { safeMove } from '../src/direct-control.js';
import { SCHOOL_STORIES } from '../src/school-stories.js';
import { createArrivalGate, sampleArrival } from '../src/arrival-gate.js';

// Module-level movement scenarios, not a browser or simultaneous-actor test.
// Match production route/lane geometry, collision movement, speed and arrival APIs.
const stops = SCHOOL_STORIES.map(story => ({
  id: story.id, x: NODES[story.tourNode][0], z: NODES[story.tourNode][1],
  radius: story.id === 'welcome' ? 6 : 4.6,
}));
const guides = ['chiikawa', 'hachiware', 'usagi'];
const speeds = [2.2, 2.6, 3.6];

test('welcome radius 6 includes all school lanes without overlapping the next stop', () => {
  const welcome = stops.find(s => s.id === 'welcome');
  const together = stops.find(s => s.id === 'together');
  assert.ok(Math.hypot(welcome.x - together.x, welcome.z - together.z) > welcome.radius + together.radius);
  for (let guide = 0; guide < guides.length; guide++) {
    const [x, z] = lanePoint('school', guide);
    assert.ok(Math.hypot(x - welcome.x, z - welcome.z) + 0.22 < welcome.radius);
  }
});

for (const [guide, name] of guides.entries()) {
  test(`${name}: actual movement reaches all eight quiz arrival gates`, () => {
    let position = { x: 25 + 4 * guide, z: 20 };
    let gate = createArrivalGate(position, stops);
    for (const story of SCHOOL_STORIES) {
      let arrived = false, frames = 0, idleFrames = 0;
      const nodes = route(nearestNode(position.x, position.z), story.tourNode);
      for (const node of nodes) {
        const [x, z] = lanePoint(node, guide);
        while (Math.hypot(position.x - x, position.z - z) >= 0.22) {
          assert.ok(frames++ < 15000, `${name}/${story.id}: route timed out`);
          const distance = Math.hypot(x - position.x, z - position.z);
          const next = safeMove(position, {
            x: (x - position.x) / distance,
            z: (z - position.z) / distance,
          }, 0.05, Math.min(speeds[guide], distance / 0.05));
          idleFrames = Math.hypot(next.x - position.x, next.z - position.z) < 0.0001 ? idleFrames + 1 : 0;
          assert.ok(idleFrames <= 100, `${name}/${story.id}: blocked by campus geometry`);
          position = next;
          const arrival = sampleArrival(gate, position, stops, { active: true, goalId: story.id });
          gate = arrival.state;
          arrived ||= arrival.entered.includes(story.id);
        }
      }
      assert.ok(arrived, `${name}/${story.id}: no arrival; ended at ${JSON.stringify(position)}`);
    }
  });
}
