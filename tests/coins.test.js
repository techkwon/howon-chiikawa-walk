import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NODES, EDGES, BUILDINGS, TREES, route, lanePoint } from '../src/navigation.js';
import { safeMove, CHARACTER_RADIUS, CAMPUS_BOUNDS, CANOPY_FOOTPRINTS, CANOPY_POSTS } from '../src/direct-control.js';
import { COIN_SPOTS, createCoinState, collectNearby, resetCoins, createCoinVisuals } from '../src/coins.js';
import { createTourState, selectGuide, visitStop, readStop, getProgress } from '../src/tour-state.js';

const APPROACH_NODES = ['field', 'fieldE', 'fieldN', 'north', 'walkway', 'junction', 'south', 'annex', 'gardenGate', 'school'];
const close = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-5, `${label}: ${a} != ${b}`);
function assertSafe(p) {
  assert.ok(p.x >= CAMPUS_BOUNDS.x1 + CHARACTER_RADIUS && p.x <= CAMPUS_BOUNDS.x2 - CHARACTER_RADIUS, 'inside X boundaries');
  assert.ok(p.z >= CAMPUS_BOUNDS.z1 + CHARACTER_RADIUS && p.z <= CAMPUS_BOUNDS.z2 - CHARACTER_RADIUS, 'inside Z boundaries');
  for (const box of [...BUILDINGS, ...CANOPY_FOOTPRINTS]) {
    assert.ok(!(p.x > box.x1 - CHARACTER_RADIUS && p.x < box.x2 + CHARACTER_RADIUS && p.z > box.z1 - CHARACTER_RADIUS && p.z < box.z2 + CHARACTER_RADIUS), 'clear of wall and low canopy footprints');
  }
  for (const [x, z] of TREES) assert.ok(Math.hypot(p.x - x, p.z - z) >= CHARACTER_RADIUS + 0.3, 'clear of tree trunks');
  for (const post of CANOPY_POSTS) assert.ok(Math.hypot(p.x - post.x, p.z - post.z) >= CHARACTER_RADIUS + post.radius, 'clear of canopy posts');
}

function walkSegment(start, finish) {
  const length = Math.hypot(finish.x - start.x, finish.z - start.z);
  const steps = Math.max(1, Math.ceil(length / 0.15));
  let p = { ...start };
  assertSafe(p);
  for (let i = 1; i <= steps; i++) {
    const expected = { x: start.x + (finish.x - start.x) * i / steps, z: start.z + (finish.z - start.z) * i / steps };
    const dx = expected.x - p.x, dz = expected.z - p.z, distance = Math.hypot(dx, dz);
    p = safeMove(p, distance ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 }, 0.05, distance / 0.05);
    assertSafe(p);
    close(p.x, expected.x, 'collision-free sampled segment X');
    close(p.z, expected.z, 'collision-free sampled segment Z');
  }
  return p;
}

test('ten unique immutable spots are collision-safe and reachable from the connected exterior graph', () => {
  assert.equal(COIN_SPOTS.length, 10);
  assert.equal(new Set(COIN_SPOTS.map(coin => coin.id)).size, 10);
  assert.ok(Object.isFrozen(COIN_SPOTS));
  for (const [i, coin] of COIN_SPOTS.entries()) {
    assert.ok(Object.isFrozen(coin));
    assertSafe(coin);
    const path = route('field', APPROACH_NODES[i]);
    assert.equal(path.at(-1), APPROACH_NODES[i]);
    let current = { x: NODES.field[0], z: NODES.field[1] };
    for (let j = 1; j < path.length; j++) {
      assert.ok(EDGES.some(([a, b]) => (a === path[j - 1] && b === path[j]) || (b === path[j - 1] && a === path[j])));
      current = walkSegment(current, { x: NODES[path[j]][0], z: NODES[path[j]][1] });
    }
    walkSegment(current, coin);
    walkSegment(coin, current);
  }
});

test('coins sit off all three automatic lanes rather than being collected merely by touring', () => {
  for (const coin of COIN_SPOTS) for (let lane = 0; lane < 3; lane++) for (const [a, b] of EDGES) {
    const [ax, az] = lanePoint(a, lane), [bx, bz] = lanePoint(b, lane);
    const t = Math.max(0, Math.min(1, ((coin.x - ax) * (bx - ax) + (coin.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    assert.ok(Math.hypot(coin.x - ax - t * (bx - ax), coin.z - az - t * (bz - az)) > 2.3, `${coin.id} should require a short detour from lane ${lane}`);
  }
});

test('collecting is immutable, radius-bound, and deduplicated on revisits', () => {
  const initial = Object.freeze(createCoinState()), coin = COIN_SPOTS[0];
  assert.deepEqual(collectNearby(initial, { x: coin.x + 2.31, z: coin.z }), { state: [], newIds: [], done: false });
  const first = collectNearby(initial, { x: coin.x + 2, z: coin.z });
  assert.deepEqual(first.state, [coin.id]);
  assert.deepEqual(first.newIds, [coin.id]);
  assert.notStrictEqual(first.state, initial);
  assert.deepEqual(initial, []);
  Object.freeze(first.state);
  const revisit = collectNearby(first.state, coin);
  assert.strictEqual(revisit.state, first.state);
  assert.deepEqual(revisit.newIds, []);
  assert.equal(revisit.done, false);
  assert.deepEqual(collectNearby(initial, { x: coin.x + 2, z: coin.z }, 2).newIds, [coin.id]);
  assert.deepEqual(collectNearby(initial, coin, 0).newIds, [coin.id]);
});

test('all ten collect once, serialize, and reset without modifying previous progress', () => {
  let state = createCoinState();
  for (const [i, coin] of COIN_SPOTS.entries()) {
    const result = collectNearby(Object.freeze(state), coin);
    assert.deepEqual(result.newIds, [coin.id]);
    assert.equal(result.done, i === COIN_SPOTS.length - 1);
    state = result.state;
  }
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  for (const coin of COIN_SPOTS) assert.deepEqual(collectNearby(state, coin), { state, newIds: [], done: true });
  const fresh = resetCoins();
  assert.deepEqual(fresh, []);
  assert.notStrictEqual(fresh, resetCoins());
  assert.equal(state.length, 10);
  assert.deepEqual(collectNearby(fresh, COIN_SPOTS[0]).newIds, [COIN_SPOTS[0].id]);
});

test('invalid positions and duplicate or unknown persisted IDs cannot create rewards or false completion', () => {
  for (const position of [undefined, null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }]) {
    assert.deepEqual(collectNearby([], position), { state: [], newIds: [], done: false });
  }
  const dirty = Object.freeze(['unknown', COIN_SPOTS[0].id, COIN_SPOTS[0].id]);
  assert.deepEqual(collectNearby(dirty, COIN_SPOTS[0]), { state: [COIN_SPOTS[0].id], newIds: [], done: false });
  assert.equal(dirty.length, 3);
  assert.deepEqual(collectNearby(null, COIN_SPOTS[0]).newIds, [COIN_SPOTS[0].id]);
});

test('guide changes preserve the shared coin state and an eight-stop tour finishes with zero coins', () => {
  const coinState = Object.freeze(collectNearby([], COIN_SPOTS[0]).state);
  const stopIds = Array.from({ length: 8 }, (_, i) => `stop-${i}`);
  let tour = createTourState(stopIds);
  for (const guide of ['usagi', 'hachiware', 'chiikawa']) {
    tour = selectGuide(tour, guide);
    assert.deepEqual(coinState, [COIN_SPOTS[0].id]);
    assert.deepEqual(collectNearby(coinState, COIN_SPOTS[0]).newIds, []);
  }
  for (const id of stopIds) tour = readStop(visitStop(tour, id), id);
  assert.equal(getProgress(tour).done, true);
  assert.equal(collectNearby(createCoinState(), undefined).done, false);
});

test('visuals use one instanced mesh and hide collected coins while only nearby coins shimmer', () => {
  const visuals = createCoinVisuals(THREE);
  assert.equal(visuals.group.children.length, 1);
  const mesh = visuals.group.children[0];
  assert.ok(mesh.isInstancedMesh);
  assert.equal(mesh.count, 10);
  assert.equal(mesh.geometry.type, 'CylinderGeometry');
  assert.equal(Array.isArray(mesh.material), false);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, false);
  const before = new THREE.Matrix4(), after = new THREE.Matrix4();
  visuals.update(1, [], COIN_SPOTS[0]);
  mesh.getMatrixAt(0, before);
  visuals.update(2, [], COIN_SPOTS[0]);
  mesh.getMatrixAt(0, after);
  assert.notDeepEqual(after.elements, before.elements);
  mesh.getMatrixAt(2, before);
  visuals.update(3, [], COIN_SPOTS[0]);
  mesh.getMatrixAt(2, after);
  assert.deepEqual(after.elements, before.elements, 'far coins stay calm');
  visuals.update(3, [COIN_SPOTS[0].id], COIN_SPOTS[0]);
  mesh.getMatrixAt(0, after);
  assert.equal(after.determinant(), 0, 'collected coin has zero scale');
  assert.equal(mesh.visible, true);
  visuals.update(3, COIN_SPOTS.map(coin => coin.id));
  assert.equal(mesh.visible, false, 'no coin draw call remains once all are collected');
  visuals.update(3, resetCoins());
  assert.equal(mesh.visible, true);
  mesh.getMatrixAt(0, after);
  close(after.determinant(), 1, 'reset coin scale');
  mesh.geometry.dispose();
  mesh.material.dispose();
});
