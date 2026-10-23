import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import * as navigation from '../src/navigation.js';
import * as movement from '../src/direct-control.js';
import * as cameraFollow from '../src/camera-follow.js';

// Execute production updateActors, not a reimplementation. WebGL, rendering,
// animation appearance and DOM events are intentionally outside this VM test.
function harness({ positions, manual = true, running = false, selected = 0, targets = [] }) {
  const source = fs.readFileSync(process.env.HOWON_ACTOR_SOURCE || new URL('../src/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function targetFor(');
  const end = source.indexOf('const loader=', start);
  assert.ok(start >= 0 && end > start, 'production actor function boundaries exist');
  const actors = positions.map(([x, z], i) => ({
    model: { position: new THREE.Vector3(x, .25, z), rotation: { y: 0 }, userData: { character: { rig: new THREE.Group() } } },
    shadow: { position: new THREE.Vector3() },
    ring: { position: new THREE.Vector3(), material: {} },
    path: [], recovery: [], manualTrail: [], wait: targets[i] ? 0 : 10000,
    target: targets[i] ? new THREE.Vector3(targets[i][0], .25, targets[i][1]) : null,
    targetNode: 'field', node: 'field', dist: 0, phase: 0, walking: false,
  }));
  const context = vm.createContext({
    THREE, ...navigation, ...movement, ...cameraFollow, actors,
    loaded: true, tour: {}, getProgress: () => ({ done: false }), paused: false,
    manual, selected, follow: true, speed: 1, time: 0,
    input: { getVector: () => ({ x: 0, z: -1 }), isRunning: () => running },
    animateCharacter() {}, updateCompanionOffsets() {},
    sendTo() { throw Error('Unexpected new destination'); },
  });
  vm.runInContext(source.slice(start, end), context);
  return { actors, context, tick(frames = 1) { for (let n = 0; n < frames; n++) {
    context.time += .05; context.updateActors(.05);
    for (const actor of actors) {
      const rig = actor.model.userData.character.rig;
      assert.ok([rig.position.x, rig.position.z, actor.model.position.x, actor.model.position.z].every(Number.isFinite));
      assert.ok(Math.hypot(rig.position.x, rig.position.z) <= 2.401, 'visual yielding remains bounded');
      assert.equal(navigation.insideBuilding(actor.shadow.position.x, actor.shadow.position.z, 1.19), false, 'visual yielding must not push friends into buildings');
      assert.ok(actor.shadow.position.x >= movement.CAMPUS_BOUNDS.x1 + 1.199 && actor.shadow.position.x <= movement.CAMPUS_BOUNDS.x2 - 1.199);
      assert.ok(actor.shadow.position.z >= movement.CAMPUS_BOUNDS.z1 + 1.199 && actor.shadow.position.z <= movement.CAMPUS_BOUNDS.z2 - 1.199);
    }
  } } };
}

test('three friends at identical coordinates do not teleport the directly controlled player', () => {
  const h = harness({ positions: [[40, 20], [40, 20], [40, 20]] });
  const before = h.actors[0].model.position.clone();
  h.tick();
  assert.ok(h.actors[0].model.position.distanceTo(before) <= .301, `only intended walking distance is applied, no hard peer depenetration: ${JSON.stringify(h.actors[0].model.position)}`);
  h.tick(39);
  assert.ok(h.actors[0].model.position.z > 30, 'player escapes overlap with continued forward input');
});

for (const running of [false, true]) {
  test(`${running ? 'running' : 'walking'} can continue between stationary companions`, () => {
    const h = harness({ positions: [[40, 16], [39, 20], [41, 20]], running });
    h.tick(60);
    assert.ok(h.actors[0].model.position.z > 27, `blocked at ${JSON.stringify(h.actors[0].model.position)}`);
  });
}

test('opposing automatic friends do not deadlock head-on', () => {
  const h = harness({ positions: [[40, 20], [40, 24], [50, 30]], manual: false, targets: [[40, 30], [40, 14]] });
  h.tick(240);
  assert.ok(h.actors[0].model.position.distanceTo(new THREE.Vector3(40, .25, 30)) < .3, `first actor blocked at ${JSON.stringify(h.actors[0].model.position)}`);
  assert.ok(h.actors[1].model.position.distanceTo(new THREE.Vector3(40, .25, 14)) < .3, `second actor blocked at ${JSON.stringify(h.actors[1].model.position)}`);
});

test('automatic navigation can pass a stationary companion', () => {
  const h = harness({ positions: [[40, 16], [40, 20], [50, 30]], manual: false, targets: [[40, 30]] });
  h.tick(240);
  assert.ok(h.actors[0].model.position.distanceTo(new THREE.Vector3(40, .25, 30)) < .3, `blocked at ${JSON.stringify(h.actors[0].model.position)}`);
});

test('all three automatic friends can separate from identical starting coordinates', () => {
  const targets = [[38, 30], [40, 30], [42, 30]];
  const h = harness({ positions: [[40, 20], [40, 20], [40, 20]], manual: false, targets });
  h.tick(240);
  for (const [index, actor] of h.actors.entries()) {
    assert.ok(actor.model.position.distanceTo(new THREE.Vector3(targets[index][0], .25, targets[index][1])) < .3,
      `actor ${index} blocked at ${JSON.stringify(actor.model.position)}`);
  }
});

for (const selected of [0, 1, 2]) for (const running of [false, true]) {
  test(`guide ${selected}, ${running ? 'run' : 'walk'}: eight headings escape complete overlap`, () => {
    for (let angle = 0; angle < 8; angle++) {
      const h = harness({ positions: [[40, 20], [40, 20], [40, 20]], selected, running });
      const heading = angle * Math.PI / 4;
      h.actors[selected].model.rotation.y = heading;
      h.tick(20);
      const p = h.actors[selected].model.position;
      const intended = (p.x - 40) * Math.sin(heading) + (p.z - 20) * Math.cos(heading);
      assert.ok(intended > (running ? 11 : 5.9), `guide ${selected}, heading ${angle} blocked`);
      assert.equal(h.actors[selected].model.userData.character.rig.position.length(), 0, 'selected friend is never visually displaced');
    }
  });
}

test('changing selected guide repeatedly retains escape movement and clears its visual offset', () => {
  const h = harness({ positions: [[40, 20], [40, 20], [40, 20]] });
  for (let cycle = 0; cycle < 3; cycle++) for (const selected of [0, 1, 2]) {
    h.context.selected = selected;
    const before = h.actors[selected].model.position.clone();
    h.tick(10);
    assert.ok(h.actors[selected].model.position.z > before.z + 2.9);
    assert.equal(h.actors[selected].model.userData.character.rig.position.length(), 0);
  }
});

test('wall-adjacent friends yield safely while the player slides along the school wall', () => {
  const h = harness({ positions: [[-2.79, -25], [-2.79, -22], [-2.79, -20]], running: true });
  h.tick(40);
  assert.ok(h.actors[0].model.position.z > -3, 'companions do not block the safe exterior wall route before the canopy');
  assert.ok(h.actors[0].model.position.x > -2.8, 'fixed school collision remains in effect');
});

test('paused overlap stays frozen, then resumes movement', () => {
  const h = harness({ positions: [[40, 20], [40, 20], [40, 20]] });
  h.context.paused = true;
  h.tick(30);
  for (const actor of h.actors) assert.deepEqual(actor.model.position.toArray(), [40, .25, 20]);
  h.context.paused = false;
  h.tick(20);
  assert.ok(h.actors[0].model.position.z > 25.9);
});

test('automatic recovery trail passes a stationary friend before rejoining its destination path', () => {
  const h = harness({ positions: [[40, 16], [40, 20], [50, 30]], manual: false });
  const actor = h.actors[0];
  actor.wait = 0;
  actor.recovery = [new THREE.Vector3(40, .25, 22), new THREE.Vector3(31, .25, 20)];
  actor.path = ['field', 'fieldN'];
  h.tick(900);
  const [x, z] = navigation.lanePoint('fieldN', 0);
  assert.ok(actor.model.position.distanceTo(new THREE.Vector3(x, .25, z)) < .3);
  assert.equal(actor.recovery.length, 0);
  assert.equal(actor.path.length, 0);
});

test('repeated resets to the same overlap positions do not accumulate a movement lock', () => {
  const h = harness({ positions: [[40, 20], [40, 20], [40, 20]] });
  // These are reset-state inputs to updateActors; this does not execute a DOM reset click.
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const actor of h.actors) { actor.model.position.set(40, .25, 20); actor.manualTrail = []; actor.wait = 10000; }
    h.context.selected = cycle % 3;
    h.tick(10);
    assert.ok(h.actors[h.context.selected].model.position.z > 22.9);
  }
});
