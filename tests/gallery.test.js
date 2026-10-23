import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GALLERY_VIEWS,
  createGalleryState,
  enterGallery,
  leaveGallery,
  selectGalleryView,
  nextGalleryView,
} from '../src/gallery.js';

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function walkSnapshot() {
  return {
    camera: { position: [12, 25, 70], target: [-28, 6, 0], zoom: 1.4 },
    characters: [
      { id: 'chiikawa', position: [31, 0, 20], rotation: [0, 1.2, 0], path: ['field', 'junction'] },
      { id: 'hachiware', position: [33, 0, 20.4], rotation: [0, 1.1, 0], path: ['field'] },
    ],
    controls: { follow: true, manual: false, playing: false, speed: 2 },
    progress: { guide: 'chiikawa', visitedIds: ['a', 'b'], readIds: ['a'], collectedCoins: [1, 4], quiz: 2 },
  };
}

test('four deeply frozen gallery compositions are finite exterior model views', () => {
  assert.equal(GALLERY_VIEWS.length, 4);
  assert.equal(new Set(GALLERY_VIEWS.map(view => view.id)).size, 4);
  assert.ok(Object.isFrozen(GALLERY_VIEWS));
  for (const view of GALLERY_VIEWS) {
    assert.ok(Object.isFrozen(view));
    assert.ok(view.label.trim().length > 0);
    assert.ok(view.description.trim().length > 0);
    for (const point of [view.position, view.target]) {
      assert.ok(Object.isFrozen(point));
      assert.equal(point.length, 3);
      assert.ok(point.every(Number.isFinite));
    }
    assert.notDeepEqual(view.position, view.target);
    // All cameras are elevated above roofs or outside the footprint.
    assert.ok(view.position[1] >= 28);
    assert.ok(view.target[0] >= -60 && view.target[0] <= 68);
    assert.ok(view.target[2] >= -54 && view.target[2] <= 62);
    assert.ok(view.position[0] > 68 || view.position[2] > 62 || view.position[1] >= 65);
  }
  assert.deepEqual(GALLERY_VIEWS.map(({ position, target }) => ({ position, target })), [
    { position: [98, 74, 118], target: [-4, 3, 5] },
    { position: [10, 28, 75], target: [-28, 8, 0] },
    { position: [-15, 65, 5], target: [-30, 5, -17] },
    { position: [70, 35, 60], target: [-8, 7, 0] },
  ]);
  assert.match(GALLERY_VIEWS[0].description, /실제 사진이 아닙니다/);
});

test('new gallery states are independent, inactive and serializable', () => {
  const state = createGalleryState();
  assert.deepEqual(state, { active: false, index: 0, snapshot: null });
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.notStrictEqual(createGalleryState(), state);
});

test('entering deep clones all camera, position and progress data without mutating inputs', () => {
  const initial = freezeDeep(createGalleryState());
  const snapshot = walkSnapshot();
  const expected = structuredClone(snapshot);
  const entered = enterGallery(initial, snapshot);
  assert.notStrictEqual(entered, initial);
  assert.equal(initial.active, false);
  assert.equal(initial.snapshot, null);
  assert.equal(entered.active, true);
  assert.deepEqual(snapshot, expected);
  assert.deepEqual(entered.snapshot, expected);
  assert.notStrictEqual(entered.snapshot, snapshot);
  assert.notStrictEqual(entered.snapshot.camera.position, snapshot.camera.position);
  assert.notStrictEqual(entered.snapshot.characters[0].position, snapshot.characters[0].position);
  assert.notStrictEqual(entered.snapshot.progress.visitedIds, snapshot.progress.visitedIds);
  snapshot.camera.position[0] = 999;
  snapshot.characters[0].position[0] = 888;
  snapshot.progress.visitedIds.push('c');
  snapshot.controls.playing = true;
  assert.deepEqual(entered.snapshot, expected);
});

test('repeated entry cannot overwrite the original walk snapshot', () => {
  const entered = freezeDeep(enterGallery(createGalleryState(), freezeDeep(walkSnapshot())));
  assert.strictEqual(enterGallery(entered, { camera: { position: [98, 74, 118] } }), entered);
  assert.strictEqual(enterGallery(entered), entered);
  assert.deepEqual(entered.snapshot, walkSnapshot());
});

test('leaving returns an independent restoration snapshot without mutating the active state', () => {
  const original = freezeDeep(walkSnapshot());
  const entered = freezeDeep(selectGalleryView(enterGallery(createGalleryState(), original), 2));
  const { state, snapshot } = leaveGallery(entered);
  assert.deepEqual(state, { active: false, index: 2, snapshot: null });
  assert.deepEqual(snapshot, original);
  assert.notStrictEqual(snapshot, entered.snapshot);
  assert.notStrictEqual(snapshot.camera.target, entered.snapshot.camera.target);
  assert.notStrictEqual(snapshot.characters[0].position, entered.snapshot.characters[0].position);
  assert.notStrictEqual(snapshot.progress.collectedCoins, entered.snapshot.progress.collectedCoins);
  snapshot.camera.target[0] = 400;
  snapshot.characters[0].position[2] = 300;
  snapshot.progress.collectedCoins.push(9);
  assert.deepEqual(entered.snapshot, original);
  assert.equal(entered.active, true);
});

test('leaving while inactive is idempotent and never replays stale progress', () => {
  const initial = freezeDeep(createGalleryState());
  const first = leaveGallery(initial);
  assert.strictEqual(first.state, initial);
  assert.equal(first.snapshot, null);
  const exited = leaveGallery(enterGallery(initial, walkSnapshot()));
  const repeated = leaveGallery(freezeDeep(exited.state));
  assert.strictEqual(repeated.state, exited.state);
  assert.equal(repeated.snapshot, null);
});

test('selecting indices wraps both directions while preserving the captured snapshot', () => {
  const entered = freezeDeep(enterGallery(createGalleryState(), walkSnapshot()));
  for (const [input, expected] of [[0, 0], [1, 1], [3, 3], [4, 0], [5, 1], [-1, 3], [-4, 0], [-5, 3], [100, 0]]) {
    const selected = selectGalleryView(entered, input);
    assert.equal(selected.index, expected);
    assert.equal(selected.active, true);
    assert.strictEqual(selected.snapshot, entered.snapshot);
    if (expected === 0) assert.strictEqual(selected, entered);
  }
  assert.equal(entered.index, 0);
});

test('next and previous views form stable wrapping cycles, including large safe steps', () => {
  let state = freezeDeep(enterGallery(createGalleryState(), walkSnapshot()));
  const snapshot = state.snapshot;
  for (const index of [1, 2, 3, 0, 1, 2, 3, 0]) {
    const old = freezeDeep(state);
    state = nextGalleryView(old);
    assert.equal(state.index, index);
    assert.strictEqual(state.snapshot, snapshot);
    assert.equal(old.index, (index + 3) % 4);
  }
  state = nextGalleryView(state, -1);
  assert.equal(state.index, 3);
  assert.equal(nextGalleryView(state, 6).index, 1);
  assert.equal(nextGalleryView(state, -6).index, 1);
  assert.equal(nextGalleryView(state, Number.MAX_SAFE_INTEGER).index, 2);
  assert.equal(nextGalleryView(state, Number.MIN_SAFE_INTEGER).index, 0);
  assert.strictEqual(nextGalleryView(state, 0), state);
  assert.strictEqual(nextGalleryView(state, 4), state);
});

test('invalid indices and steps never enter state or change progress', () => {
  const state = freezeDeep(enterGallery(createGalleryState(), walkSnapshot()));
  for (const value of [NaN, Infinity, -Infinity, 0.2, '1', null, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.strictEqual(selectGalleryView(state, value), state);
    assert.strictEqual(nextGalleryView(state, value), state);
  }
  assert.strictEqual(selectGalleryView(state, undefined), state);
  assert.equal(state.index, 0);
  assert.deepEqual(state.snapshot, walkSnapshot());
});

test('a fresh entry after leaving captures the new walk and keeps the chosen composition', () => {
  let state = selectGalleryView(enterGallery(createGalleryState(), walkSnapshot()), 3);
  state = leaveGallery(state).state;
  const later = walkSnapshot();
  later.camera.position = [70, 25, 10];
  later.progress.readIds.push('b');
  const entered = enterGallery(freezeDeep(state), later);
  assert.equal(entered.index, 3);
  assert.equal(entered.active, true);
  assert.deepEqual(entered.snapshot, later);
  assert.notStrictEqual(entered.snapshot.progress, later.progress);
});
