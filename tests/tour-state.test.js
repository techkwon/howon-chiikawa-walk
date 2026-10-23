import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTourState,
  selectGuide,
  visitStop,
  readStop,
  restartTour,
  getProgress,
} from '../src/tour-state.js';
import { SCHOOL_STORIES } from '../src/school-stories.js';

const ids = SCHOOL_STORIES.map((story) => story.id);

function freezeState(state) {
  Object.freeze(state.stopIds);
  Object.freeze(state.visitedIds);
  Object.freeze(state.readIds);
  return Object.freeze(state);
}

test('a new tour has eight unique stops and JSON-serializable empty progress', () => {
  const state = createTourState(ids);
  assert.equal(state.guide, 'chiikawa');
  assert.equal(state.stopIds.length, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.deepEqual(getProgress(state), {
    total: 8, visited: 0, read: 0, completed: 0, completedIds: [], done: false,
  });
});

test('duplicate input IDs are normalized without mutating or retaining the input', () => {
  const input = ['a', 'b', 'a', '', ' ', null, 4, 'b', 'c'];
  const snapshot = [...input];
  const state = createTourState(input, 'usagi');
  assert.deepEqual(state.stopIds, ['a', 'b', 'c']);
  assert.deepEqual(input, snapshot);
  input.push('d');
  assert.deepEqual(state.stopIds, ['a', 'b', 'c']);
  assert.equal(state.guide, 'usagi');
});

test('visiting and reading are independent, and both are required for completion', () => {
  const initial = freezeState(createTourState(['a', 'b']));
  const visited = visitStop(initial, 'a');
  const read = readStop(initial, 'b');
  assert.equal(getProgress(visited).visited, 1);
  assert.equal(getProgress(visited).completed, 0);
  assert.equal(getProgress(read).read, 1);
  assert.equal(getProgress(read).completed, 0);
  assert.deepEqual(getProgress(readStop(visited, 'a')).completedIds, ['a']);
  assert.deepEqual(getProgress(visitStop(read, 'b')).completedIds, ['b']);
  assert.deepEqual(initial.visitedIds, []);
  assert.deepEqual(initial.readIds, []);
});

test('every stop counts exactly once, independent of event order', () => {
  let state = createTourState(ids);
  for (const id of [...ids].reverse()) {
    state = readStop(state, id);
    state = readStop(state, id);
  }
  assert.equal(getProgress(state).done, false);
  for (const [index, id] of ids.entries()) {
    state = visitStop(state, id);
    state = visitStop(state, id);
    const progress = getProgress(state);
    assert.equal(progress.completed, index + 1);
    assert.equal(progress.done, index === ids.length - 1);
  }
  assert.deepEqual(getProgress(state), {
    total: 8, visited: 8, read: 8, completed: 8, completedIds: ids, done: true,
  });
});

test('unknown IDs and repeated visits/reads are identity-preserving no-ops', () => {
  const initial = freezeState(createTourState(['a']));
  for (const id of ['unknown', '', undefined, null, 0]) {
    assert.strictEqual(visitStop(initial, id), initial);
    assert.strictEqual(readStop(initial, id), initial);
  }
  const visited = freezeState(visitStop(initial, 'a'));
  assert.strictEqual(visitStop(visited, 'a'), visited);
  const complete = freezeState(readStop(visited, 'a'));
  assert.strictEqual(readStop(complete, 'a'), complete);
  assert.strictEqual(visitStop(complete, 'a'), complete);
});

test('all guides retain existing progress and repeated selections are idempotent', () => {
  let state = readStop(visitStop(createTourState(ids), ids[0]), ids[0]);
  const expectedProgress = getProgress(state);
  for (const guide of ['hachiware', 'usagi', 'chiikawa']) {
    const previous = freezeState(state);
    state = selectGuide(previous, guide);
    assert.notStrictEqual(state, previous);
    assert.equal(state.guide, guide);
    assert.deepEqual(getProgress(state), expectedProgress);
    assert.strictEqual(selectGuide(state, guide), state);
  }
  assert.strictEqual(selectGuide(state, 'unknown'), state);
  assert.equal(createTourState(ids, 'unknown').guide, 'chiikawa');
});

test('restart clears both progress lists but keeps the guide and stop order', () => {
  let state = createTourState(ids, 'hachiware');
  for (const id of ids) state = readStop(visitStop(state, id), id);
  const completed = freezeState(state);
  const restarted = restartTour(completed);
  assert.equal(restarted.guide, 'hachiware');
  assert.deepEqual(restarted.stopIds, ids);
  assert.deepEqual(restarted.visitedIds, []);
  assert.deepEqual(restarted.readIds, []);
  assert.equal(getProgress(restarted).done, false);
  assert.equal(getProgress(completed).done, true);
  assert.strictEqual(restartTour(restarted), restarted);
});

test('farewell triggers once on completion, not on rereads, revisits, or guide changes', () => {
  let state = createTourState(ids);
  let farewells = 0;
  const apply = (mutator, value) => {
    const previous = state;
    state = mutator(state, value);
    if (!getProgress(previous).done && getProgress(state).done) farewells += 1;
  };
  const finish = () => {
    for (const id of ids) {
      apply(visitStop, id);
      apply(readStop, id);
    }
  };

  finish();
  assert.equal(farewells, 1);
  finish();
  apply(selectGuide, 'usagi');
  finish();
  assert.equal(farewells, 1);
  apply(restartTour);
  assert.equal(farewells, 1);
  finish();
  assert.equal(farewells, 2);
});

test('empty or invalid stop lists do not prematurely trigger a farewell', () => {
  for (const input of [[], undefined, null, 'a', ['', ' ', null]]) {
    const state = createTourState(input);
    assert.deepEqual(getProgress(state), {
      total: 0, visited: 0, read: 0, completed: 0, completedIds: [], done: false,
    });
  }
});

test('a serialized state resumes progress and derived results cannot mutate it', () => {
  const state = readStop(visitStop(createTourState(ids), ids[0]), ids[0]);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(getProgress(restored), getProgress(state));
  const result = getProgress(restored);
  result.completedIds.push(ids[1]);
  assert.equal(getProgress(restored).completed, 1);
  assert.equal(getProgress(readStop(visitStop(restored, ids[1]), ids[1])).completed, 2);
});
