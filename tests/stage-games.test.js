import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_GAMES, createStageState, chooseStageOption, resetStage, resetAllStages,
  getStageView, isStageCompleted, getStageProgress,
} from '../src/stage-games.js';
import { SCHOOL_STORIES } from '../src/school-stories.js';
import { createTourState, selectGuide } from '../src/tour-state.js';

const ids = SCHOOL_STORIES.map(({ id }) => id);
const routes = {
  welcome: ['uijeongbu', 'public', '2000'],
  together: ['speak', 'listen', 'summarize'],
  library: ['reading-club', 'challenge', 'reading-month'],
  voice: ['reading', 'notes', 'poster', 'confirm'],
  dream: ['nature', 'observe', 'curious'],
  healthy: ['ready', 'body', 'mind', 'try', 'body'],
  create: ['room:science', 'activity:science', 'room:computer', 'activity:computer', 'room:art', 'activity:art', 'room:music', 'activity:music'],
  care: ['trusted', 'request', 'wee', 'finish'],
};

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function choose(state, id, value) {
  const option = getStageView(state, id).options.find((item) => item.value === value);
  assert.ok(option, `Missing ${id} option ${value}`);
  assert.equal(option.disabled, false, `Disabled ${id} option ${value}`);
  return chooseStageOption(state, id, option.id);
}

function complete(state, id, route = routes[id]) {
  return route.reduce((current, value) => choose(deepFreeze(current), id, value), state);
}

function permutations(values) {
  return values.length === 0 ? [[]] : values.flatMap((value, index) => permutations(values.filter((_, i) => index !== i)).map((rest) => [value, ...rest]));
}

test('eight sourced stages have eight genuinely distinct interaction types, never OX answers', () => {
  assert.deepEqual(Object.keys(STAGE_GAMES), ids);
  assert.equal(new Set(Object.values(STAGE_GAMES).map(({ type }) => type)).size, 8);
  assert.ok(Object.isFrozen(STAGE_GAMES));
  for (const story of SCHOOL_STORIES) {
    const game = STAGE_GAMES[story.id];
    assert.equal(game.id, story.id);
    assert.equal(game.storyId, story.id);
    assert.ok(game.title.length > 0 && game.instructions.length > 0);
    assert.match(game.fictionNote, /가상|학습 게임/);
    assert.equal(game.fact, story.bullets.join(' '));
    assert.equal(game.factLabel, '확인된 학교 정보');
    assert.ok(story.sources.some(({ url }) => url === game.sourceURL));
    assert.equal(game.source.url, game.sourceURL);
    assert.equal(game.dateNote, story.dateNote);
    assert.ok(Object.isFrozen(game));
    assert.ok(Object.isFrozen(game.source));
    assert.ok(Object.isFrozen(game.sources));
    assert.ok(story.sources.every((source) => source !== game.source));
    assert.equal(typeof game.answer, 'undefined');
  }
});

test('fresh progress is independent and JSON serializable with eight incomplete attempts', () => {
  const state = createStageState();
  const other = createStageState();
  assert.deepEqual(state, { stages: {}, completedIds: [] });
  assert.notStrictEqual(state.stages, other.stages);
  assert.notStrictEqual(state.completedIds, other.completedIds);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.deepEqual(getStageProgress(state), { total: 8, completed: 0, completedIds: [], done: false });
  for (const id of ids) {
    const view = getStageView(state, id);
    assert.equal(view.completed, false);
    assert.equal(view.earned, false);
    assert.equal(view.step, 0);
    assert.ok(view.totalSteps >= 3);
    assert.ok(view.options.length > 0);
    assert.equal(view.status, 'idle');
  }
});

for (const id of ids) {
  test(`${id} has a finite solvable route and cannot complete before the last meaningful action`, () => {
    let state = deepFreeze(createStageState());
    for (const [index, value] of routes[id].entries()) {
      const before = state;
      state = choose(before, id, value);
      assert.notStrictEqual(state, before);
      assert.notStrictEqual(state.stages, before.stages);
      assert.equal(isStageCompleted(state, id), index === routes[id].length - 1);
      assert.equal(getStageView(state, id).completed, index === routes[id].length - 1);
      assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
      deepFreeze(state);
    }
    const view = getStageView(state, id);
    assert.equal(view.step, view.totalSteps);
    assert.equal(view.status, 'completed');
    assert.ok(view.feedback.length > 0);
    assert.ok(view.options.every(({ disabled }) => disabled));
    assert.deepEqual(state.completedIds, [id]);
    assert.deepEqual(getStageProgress(state).completedIds, [id]);
    for (const otherId of ids.filter((item) => item !== id)) assert.equal(isStageCompleted(state, otherId), false);
  });
}

test('wrong choices offer a gentle retry without deleting correct progress, losing lives, or awarding completion', () => {
  const cases = [
    ['welcome', ['uijeongbu'], 'private'],
    ['together', ['speak'], 'summarize'],
    ['library', ['reading-club'], 'dragon'],
    ['healthy', ['ready', 'body'], 'try'],
    ['create', ['room:science', 'activity:science', 'room:art'], 'activity:music'],
    ['care', ['trusted'], 'guess'],
  ];
  for (const [id, first, wrong] of cases) {
    const state = complete(createStageState(), id, first);
    const choices = [...state.stages[id].choices];
    const next = choose(deepFreeze(state), id, wrong);
    assert.deepEqual(next.stages[id].choices, choices);
    assert.equal(getStageView(next, id).status, 'incorrect');
    assert.match(getStageView(next, id).feedback, /괜찮아요/);
    assert.equal(isStageCompleted(next, id), false);
    assert.equal(getStageView(next, id).completed, false);
    assert.equal('lives' in next.stages[id], false);
    assert.equal('deadline' in next.stages[id], false);
  }
});

test('duplicate or stale option IDs cannot advance any stage, including repeated rhythm values', () => {
  for (const id of ids) {
    const initial = deepFreeze(createStageState());
    const option = getStageView(initial, id).options.find(({ value }) => value === routes[id][0]);
    const next = deepFreeze(chooseStageOption(initial, id, option.id));
    assert.strictEqual(chooseStageOption(next, id, option.id), next);
    assert.equal(next.stages[id].choices.length <= 1, true);
  }
  let state = createStageState();
  state = choose(state, 'healthy', 'ready');
  const firstBody = getStageView(state, 'healthy').options.find(({ value }) => value === 'body').id;
  state = chooseStageOption(state, 'healthy', firstBody);
  state = choose(state, 'healthy', 'mind');
  state = choose(state, 'healthy', 'try');
  assert.strictEqual(chooseStageOption(state, 'healthy', firstBody), state);
  assert.equal(getStageView(state, 'healthy').completed, false);
  state = choose(state, 'healthy', 'body');
  assert.equal(getStageView(state, 'healthy').completed, true);
});

test('only exact current option IDs are accepted, with invalid stages and values identity-preserving', () => {
  const state = deepFreeze(createStageState());
  for (const id of ['unknown', '', '__proto__', 'constructor', 'toString', null, undefined, 0, {}, []]) {
    assert.equal(getStageView(state, id), null);
    assert.equal(isStageCompleted(state, id), false);
    assert.strictEqual(chooseStageOption(state, id, 'welcome:0:uijeongbu'), state);
    assert.strictEqual(resetStage(state, id), state);
  }
  for (const value of [null, undefined, true, false, 1, {}, [], 'uijeongbu', 'welcome:90:uijeongbu', 'welcome:0:__proto__']) {
    assert.strictEqual(chooseStageOption(state, 'welcome', value), state);
  }
  assert.strictEqual(resetStage(state, 'welcome'), state);
});

test('collection works in any order and selected cards cannot be collected twice', () => {
  for (const route of permutations(routes.library)) {
    const initial = createStageState();
    let state = choose(initial, 'library', route[0]);
    const selected = getStageView(state, 'library').options.find(({ value }) => value === route[0]);
    assert.equal(selected.disabled, true);
    assert.equal(selected.selected, true);
    assert.strictEqual(chooseStageOption(state, 'library', selected.id), state);
    state = complete(state, 'library', route.slice(1));
    assert.equal(getStageView(state, 'library').completed, true);
    assert.equal(state.stages.library.choices.length, 3);
  }
});

test('proposal builder accepts all 27 distinct combinations and requires explicit final assembly', () => {
  const game = STAGE_GAMES.voice;
  const results = new Set();
  for (const topic of game.groups[0].choices) for (const method of game.groups[1].choices) for (const format of game.groups[2].choices) {
    let state = complete(createStageState(), 'voice', [topic.value, method.value, format.value]);
    const view = getStageView(state, 'voice');
    assert.equal(view.completed, false);
    assert.equal(view.step, 3);
    assert.equal(view.options.length, 1);
    assert.deepEqual(view.board.map(({ label }) => label), [topic.label, method.label, format.label]);
    results.add(view.board.map(({ label }) => label).join('|'));
    state = choose(state, 'voice', 'confirm');
    assert.equal(isStageCompleted(state, 'voice'), true);
  }
  assert.equal(results.size, 27);
});

test('interest choices branch into matching experiences and allow undecided and all reflections', () => {
  for (const interest of STAGE_GAMES.dream.interests) {
    for (const experience of interest.experiences) {
      for (const reflection of STAGE_GAMES.dream.reflections) {
        let state = choose(createStageState(), 'dream', interest.value);
        assert.deepEqual(getStageView(state, 'dream').options.map(({ value }) => value), interest.experiences.map(({ value }) => value));
        state = complete(state, 'dream', [experience.value, reflection.value]);
        assert.equal(isStageCompleted(state, 'dream'), true);
        assert.deepEqual(getStageView(state, 'dream').board.map(({ label }) => label), [interest.label, experience.label, reflection.label]);
      }
    }
  }
});

test('rhythm observation and unlimited hints do not fabricate progress or erase it', () => {
  let state = createStageState();
  let view = getStageView(state, 'healthy');
  assert.equal(view.options.length, 1);
  assert.ok(view.board.every(({ label }) => !label.includes('?')));
  state = choose(state, 'healthy', 'ready');
  state = choose(state, 'healthy', 'body');
  for (let index = 0; index < 10; index += 1) state = choose(state, 'healthy', 'hint');
  view = getStageView(state, 'healthy');
  assert.equal(view.step, 1);
  assert.equal(view.completed, false);
  assert.ok(view.board[1].label.includes('?'));
  state = choose(state, 'healthy', 'hint');
  assert.ok(getStageView(state, 'healthy').board.every(({ label }) => !label.includes('?')));
  state = complete(state, 'healthy', ['mind', 'try', 'body']);
  assert.equal(isStageCompleted(state, 'healthy'), true);
});

test('matching is genuinely two-sided, works in any pair order, and permits changing pending room', () => {
  const initial = createStageState();
  const disabled = getStageView(initial, 'create').options.filter(({ kind }) => kind === 'activity');
  assert.ok(disabled.every(({ disabled: value }) => value));
  assert.strictEqual(chooseStageOption(initial, 'create', disabled[0].id), initial);
  for (const order of permutations(['science', 'computer', 'art', 'music'])) {
    let state = choose(createStageState(), 'create', 'room:music');
    state = choose(state, 'create', `room:${order[0]}`);
    assert.equal(state.stages.create.pending, order[0]);
    assert.equal(getStageView(state, 'create').step, 0);
    state = choose(state, 'create', `activity:${order[0]}`);
    for (const pair of order.slice(1)) state = complete(state, 'create', [`room:${pair}`, `activity:${pair}`]);
    assert.equal(isStageCompleted(state, 'create'), true);
    assert.equal(getStageView(state, 'create').board.length, 4);
  }
});

test('care route exposes two valid branches and does not request personal worries or make real-world promises', () => {
  for (const branch of ['wee', 'health']) {
    const state = complete(createStageState(), 'care', ['trusted', 'request', branch, 'finish']);
    assert.equal(isStageCompleted(state, 'care'), true);
    assert.equal(state.stages.care.node, 'finish');
    assert.match(getStageView(state, 'care').boardLabel, /실제 지도 아님/);
  }
  assert.match(STAGE_GAMES.care.fictionNote, /시간·예약·위치·비밀보장 범위를 약속하지/);
  assert.equal('form' in STAGE_GAMES.care, false);
});

test('all eight can complete in arbitrary order, earn once, and survive arbitrary cross-stage revisits', () => {
  let state = createStageState();
  for (const [index, id] of [...ids].reverse().entries()) {
    state = complete(state, id);
    const snapshot = JSON.stringify(state);
    getStageView(state, ids[(index + 1) % ids.length]);
    assert.equal(JSON.stringify(state), snapshot);
    assert.equal(getStageProgress(state).completed, index + 1);
    assert.strictEqual(chooseStageOption(state, id, 'anything'), state);
  }
  assert.deepEqual(getStageProgress(state), { total: 8, completed: 8, completedIds: ids, done: true });
});

test('opening, closing, switching guides, and reading derived views never reset partial progress', () => {
  let state = choose(createStageState(), 'create', 'room:art');
  state = choose(state, 'library', 'challenge');
  deepFreeze(state);
  const snapshot = JSON.stringify(state);
  let tour = createTourState(ids);
  for (const guide of ['hachiware', 'usagi', 'chiikawa']) {
    tour = selectGuide(tour, guide);
    for (const id of ids) getStageView(state, id);
    assert.equal(JSON.stringify(state), snapshot);
    assert.equal(state.stages.create.pending, 'art');
    assert.deepEqual(state.stages.library.choices, ['challenge']);
  }
});

test('replay clears one attempt while preserving earned progress and rejects pre-replay click callbacks', () => {
  let state = createStageState();
  const firstOption = getStageView(state, 'welcome').options.find(({ value }) => value === 'uijeongbu').id;
  state = complete(state, 'welcome');
  state = choose(state, 'library', 'challenge');
  const library = state.stages.library;
  const before = deepFreeze(state);
  state = resetStage(state, 'welcome');
  assert.equal(getStageView(state, 'welcome').completed, false);
  assert.equal(getStageView(state, 'welcome').earned, true);
  assert.equal(getStageView(state, 'welcome').step, 0);
  assert.equal(getStageView(state, 'welcome').feedback, '');
  assert.strictEqual(state.stages.library, library);
  assert.strictEqual(chooseStageOption(state, 'welcome', firstOption), state);
  assert.equal(getStageView(before, 'welcome').completed, true);
  state = complete(state, 'welcome');
  assert.deepEqual(state.completedIds, ['welcome']);
  assert.equal(getStageProgress(state).completed, 1);
});

test('full reset clears every attempt and completion without mutating old state or accepting stale inputs', () => {
  let state = createStageState();
  for (const id of ids) state = complete(state, id);
  state = resetStage(state, 'healthy');
  const staleReady = getStageView(state, 'healthy').options[0].id;
  deepFreeze(state);
  const reset = resetAllStages(state);
  assert.deepEqual(reset.completedIds, []);
  for (const id of ids) {
    const view = getStageView(reset, id);
    assert.equal(view.step, 0);
    assert.equal(view.completed, false);
    assert.equal(view.earned, false);
  }
  assert.strictEqual(chooseStageOption(reset, 'healthy', staleReady), reset);
  assert.equal(getStageProgress(state).completed, 8);
  assert.equal(getStageProgress(reset).completed, 0);
  assert.deepEqual(resetAllStages(), createStageState());
});

test('JSON restoration preserves pending pair, wrong-answer feedback, chosen branches, and replay earnings', () => {
  let state = complete(createStageState(), 'welcome');
  state = resetStage(state, 'welcome');
  state = choose(state, 'create', 'room:music');
  state = choose(state, 'create', 'activity:art');
  state = choose(state, 'dream', 'undecided');
  const restored = deepFreeze(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(getStageView(restored, 'create').status, 'incorrect');
  assert.equal(getStageView(restored, 'welcome').earned, true);
  assert.equal(getStageView(restored, 'dream').options.length, 2);
  const next = choose(restored, 'create', 'activity:music');
  assert.deepEqual(next.stages.create.choices, ['music']);
});

test('derived metadata, board, options, and completion lists do not leak mutable state or shared data', () => {
  const state = complete(createStageState(), 'welcome');
  const snapshot = JSON.stringify(state);
  const view = getStageView(state, 'welcome');
  view.source.label = 'changed';
  view.sources[0].url = 'changed';
  view.board[0].label = 'changed';
  const collect = getStageView(state, 'library');
  collect.options[0].label = 'changed';
  const summary = getStageProgress(state);
  summary.completedIds.push('library');
  assert.equal(JSON.stringify(state), snapshot);
  assert.notEqual(getStageView(state, 'welcome').source.label, 'changed');
  assert.notEqual(getStageView(state, 'welcome').board[0].label, 'changed');
  assert.notEqual(getStageView(state, 'library').options[0].label, 'changed');
  assert.equal(getStageProgress(state).completed, 1);
});

test('unknown and duplicated stored completion IDs cannot inflate progress', () => {
  const state = { stages: {}, completedIds: ['welcome', 'unknown', 'welcome', '__proto__'] };
  assert.deepEqual(getStageProgress(state), { total: 8, completed: 1, completedIds: ['welcome'], done: false });
});


test('full reset also invalidates a displayed option from an untouched stage', () => {
  const state = createStageState();
  const oldOption = getStageView(state, 'welcome').options[0].id;
  const reset = resetAllStages(state);
  assert.strictEqual(chooseStageOption(reset, 'welcome', oldOption), reset);
  assert.equal(getStageProgress(reset).completed, 0);
});
