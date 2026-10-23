import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as stages from '../src/stage-games.js';
import { createHarness, arrive, SCHOOL_STORIES, tours, source } from './helpers/minigame-harness.js';
import { STAGE_PATHS, clickOption, finishStage } from './helpers/stage-paths.js';

const openStage = index => {
  const h = createHarness(stages);
  h.start();
  arrive(h, index, { rescue: true });
  h.$('#story-read').click();
  assert.equal(h.$('#stop-quiz-dialog').open, true);
  return h;
};
const snapshot = h => JSON.stringify(h.context.stopQuiz);

test('production startup requires guide choice and explicit exploration start', () => {
  const h = createHarness(stages);
  h.$('#explore-start').click();
  assert.equal(h.context.started, false);
  h.guideButtons[2].click();
  assert.equal(h.context.started, false);
  assert.equal(h.$('#explore-start').disabled, false);
  h.$('#explore-start').click();
  assert.equal(h.context.started, true);
  assert.equal(h.context.selected, 2);
  assert.equal(h.context.tour.guide, 'usagi');
});

for (const [index, story] of SCHOOL_STORIES.entries()) {
  test(`${story.id}: closing an unfinished game, changing guide and revisiting resumes without awarding progress`, () => {
    const h = openStage(index), c = h.context;
    const button = clickOption(h, STAGE_PATHS[story.id][0]);
    assert.equal(stages.getStageView(c.stopQuiz, story.id).completed, false);
    const partial = snapshot(h);
    h.$('#stop-quiz-close').click();
    assert.equal(h.$('#stop-quiz-dialog').open, false);
    assert.equal(tours.getProgress(c.tour).completed, 0);
    assert.equal(c.paused, false);
    button.click();
    assert.equal(snapshot(h), partial, 'detached/closed game callbacks cannot change progress');
    h.friendButtons[1].click();
    assert.equal(c.tour.guide, 'hachiware');
    c.openStory(index);
    h.$('#story-read').click();
    assert.equal(snapshot(h), partial, 'a shared attempt survives guide changes and re-entry');
    finishStage(h, stages, story.id, { from: 1 });
    assert.equal(tours.getProgress(c.tour).completed, 1);
    h.$('#stop-quiz-close').click();
    c.openStory(index);
    h.$('#story-read').click();
    assert.equal(stages.getStageView(c.stopQuiz, story.id).completed, true);
    assert.equal(tours.getProgress(c.tour).completed, 1);
  });

  test(`${story.id}: rapid stale button clicks cannot advance extra steps or inflate stamps`, () => {
    const h = openStage(index), c = h.context;
    const oldButton = clickOption(h, STAGE_PATHS[story.id][0]);
    const once = snapshot(h);
    for (let n = 0; n < 10; n++) oldButton.click();
    assert.equal(snapshot(h), once);
    assert.equal(tours.getProgress(c.tour).completed, 0);
    finishStage(h, stages, story.id, { from: 1 });
    const completed = snapshot(h);
    for (let n = 0; n < 10; n++) oldButton.click();
    assert.equal(snapshot(h), completed);
    assert.equal(c.stopQuiz.completedIds.filter(id => id === story.id).length, 1);
    assert.equal(tours.getProgress(c.tour).completed, 1);
  });
}

test('Escape cancels without completion and restores the pre-game pause state', () => {
  for (const previouslyPaused of [false, true]) {
    const h = createHarness(stages), c = h.context;
    h.start();
    arrive(h, 0, { rescue: true });
    if (previouslyPaused) h.$('#play').click();
    h.$('#story-read').click();
    assert.equal(c.paused, true);
    assert.equal(h.$('#stop-quiz-next').disabled, true);
    h.$('#stop-quiz-next').click();
    assert.equal(h.$('#stop-quiz-dialog').open, true);
    const event = h.$('#stop-quiz-dialog').emit('cancel');
    assert.equal(event.defaultPrevented, true);
    assert.equal(h.$('#stop-quiz-dialog').open, false);
    assert.equal(c.paused, previouslyPaused);
    assert.equal(tours.getProgress(c.tour).completed, 0);
    const once = snapshot(h);
    h.$('#stop-quiz-close').click();
    assert.equal(snapshot(h), once);
    assert.equal(c.paused, previouslyPaused);
  }
});

test('game entry, modal input and close cannot leak held movement or running intent', () => {
  const h = createHarness(stages), c = h.context;
  h.start();
  arrive(h, 0, { rescue: true });
  c.setManual(true);
  h.key('KeyW'); h.key('ShiftLeft');
  assert.equal(c.input.getVector().z, -1);
  assert.equal(c.input.isRunning(), true);
  h.$('#story-read').click();
  assert.deepEqual(c.input.getVector(), { x: 0, z: 0 });
  assert.equal(c.input.isRunning(), false);
  const before = h.actors[c.selected].model.position.clone();
  h.key('KeyW'); h.key('ShiftLeft');
  h.tick(600);
  assert.equal(h.actors[c.selected].model.position.distanceTo(before), 0);
  assert.equal(tours.getProgress(c.tour).completed, 0);
  h.$('#stop-quiz-close').click();
  assert.equal(c.manual, true);
  assert.equal(c.paused, false);
  assert.deepEqual(c.input.getVector(), { x: 0, z: 0 });
  assert.equal(c.input.isRunning(), false);
  h.tick(20);
  assert.equal(h.actors[c.selected].model.position.distanceTo(before), 0, 'no drift on resuming');
  h.key('KeyW');
  assert.equal(c.input.getVector().z, -1, 'new intentional input still works');
});

test('retry resets only this attempt, preserves earned tour completion, and invalidates previous choices', () => {
  const h = openStage(0), c = h.context;
  const oldButton = h.$('#stage-options').children[0];
  finishStage(h, stages, 'welcome');
  h.$('#stop-quiz-retry').click();
  assert.equal(stages.getStageView(c.stopQuiz, 'welcome').completed, false);
  assert.equal(c.stopQuiz.completedIds.includes('welcome'), true);
  assert.equal(tours.getProgress(c.tour).completed, 1);
  assert.equal(h.$('#stop-quiz-next').disabled, true);
  const reset = snapshot(h);
  oldButton.click();
  assert.equal(snapshot(h), reset);
  finishStage(h, stages, 'welcome');
  assert.equal(tours.getProgress(c.tour).completed, 1);
});

test('restart clears all attempt/visit/stamp state and requires a fresh guide and explicit start', () => {
  const h = openStage(0), c = h.context;
  finishStage(h, stages, 'welcome');
  h.$('#stop-quiz-next').click();
  arrive(h, 1, { rescue: true });
  h.$('#story-read').click();
  const oldButton = clickOption(h, STAGE_PATHS.together[0]);
  h.$('#stop-quiz-close').click();
  h.$('#tour-restart').click();
  assert.equal(c.started, false);
  assert.equal(c.paused, true);
  assert.equal(h.$('#welcome').hidden, false);
  assert.equal(h.$('#explore-start').disabled, true);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
  assert.equal(h.$('#farewell').open, false);
  assert.equal(c.stopQuizId, null);
  assert.equal(tours.getProgress(c.tour).completed, 0);
  assert.equal(tours.getProgress(c.tour).visited, 0);
  assert.equal(c.stopQuiz.completedIds.length, 0);
  assert.equal(h.read('introShownIds.size'), 0);
  assert.deepEqual(c.input.getVector(), { x: 0, z: 0 });
  const reset = snapshot(h);
  oldButton.click();
  assert.equal(snapshot(h), reset);
  h.start('usagi');
  arrive(h, 0, { rescue: true });
  h.$('#story-read').click();
  finishStage(h, stages, 'welcome');
  assert.equal(tours.getProgress(c.tour).completed, 1);
});

test('completed-game next multiclick cannot bypass the next story or repeatedly open farewell', () => {
  const h = openStage(0), c = h.context;
  finishStage(h, stages, 'welcome');
  h.$('#stop-quiz-next').click();
  const target = h.read('activeGoalId');
  for (let n = 0; n < 10; n++) h.$('#stop-quiz-next').click();
  assert.equal(h.read('activeGoalId'), target);
  assert.equal(tours.getProgress(c.tour).completed, 1);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
  assert.equal(h.$('#farewell').open, false);
});

test('production no longer imports OX modules or renders local/final binary quiz controls', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"]\.\/(?:school-quiz|stop-quiz)\.js['"]/);
  assert.doesNotMatch(html, /id="(?:quiz-dialog|quiz-o|quiz-x|quiz-next|stop-quiz-o|stop-quiz-x)"/);
  assert.match(html, /id="stage-options"/);
  assert.match(html, /시간 제한은 없어요/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket)\b/);
});

for (const [id, setup, wrong, from] of [
  ['welcome', [], 'seoul', 0],
  ['together', [], 'summarize', 0],
  ['library', [], 'robot', 0],
  ['healthy', ['ready'], 'mind', 1],
  ['create', ['room:science'], 'activity:art', 0],
  ['care', [], 'alone', 0],
]) {
  test(`${id}: incorrect actual button input gives recoverable feedback without progress`, () => {
    const index = SCHOOL_STORIES.findIndex(story => story.id === id);
    const h = openStage(index), c = h.context;
    setup.forEach(value => clickOption(h, value));
    const before = stages.getStageView(c.stopQuiz, id).step;
    clickOption(h, wrong);
    assert.equal(stages.getStageView(c.stopQuiz, id).step, before);
    assert.equal(stages.getStageView(c.stopQuiz, id).status, 'incorrect');
    assert.match(h.$('#stop-quiz-feedback').textContent, /괜찮아요|다시/);
    assert.equal(tours.getProgress(c.tour).completed, 0);
    assert.equal(h.$('#stop-quiz-next').disabled, true);
    finishStage(h, stages, id, { from });
    assert.equal(tours.getProgress(c.tour).completed, 1);
  });
}

for (const [id, values] of [
  ['voice', ['rest', 'draw', 'cards', 'confirm']],
  ['dream', ['undecided', 'browse', 'pause']],
  ['library', ['reading-month', 'challenge', 'reading-club']],
  ['create', ['room:music', 'activity:music', 'room:art', 'activity:art', 'room:computer', 'activity:computer', 'room:science', 'activity:science']],
  ['care', ['trusted', 'request', 'health', 'finish']],
]) {
  test(`${id}: alternative branch or collection order completes through actual rendered choices`, () => {
    const h = openStage(SCHOOL_STORIES.findIndex(story => story.id === id));
    values.forEach(value => clickOption(h, value));
    assert.equal(stages.getStageView(h.context.stopQuiz, id).completed, true);
    assert.equal(tours.getProgress(h.context.tour).completed, 1);
  });
}

test('rhythm hint can be opened and closed without time pressure or losing already entered rhythm', () => {
  const h = openStage(5);
  clickOption(h, 'ready');
  clickOption(h, 'body');
  clickOption(h, 'hint');
  assert.match(h.$('#stage-board').children.map(node => node.textContent).join(' '), /몸.*마음.*도전.*몸/);
  h.tick(2400);
  assert.equal(stages.getStageView(h.context.stopQuiz, 'healthy').step, 1);
  clickOption(h, 'hint');
  ['mind', 'try', 'body'].forEach(value => clickOption(h, value));
  assert.equal(stages.getStageView(h.context.stopQuiz, 'healthy').completed, true);
});
