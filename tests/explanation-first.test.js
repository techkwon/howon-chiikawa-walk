import test from 'node:test';
import assert from 'node:assert/strict';
import * as stageModule from '../src/stage-games.js';
import { createHarness, arrive, SCHOOL_STORIES, tours, source, functionSource } from './helpers/minigame-harness.js';

const harness = () => { const h = createHarness(stageModule); h.start(); return h; };

test('production arrival displays explanation and never starts a game or schedules advance', () => {
  const h = harness(), c = h.context;
  arrive(h, 0);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
  assert.equal(h.read("introShownIds.has('welcome')"), true);
  assert.equal(h.read('nextStopAt'), null);
  h.tick(1000);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
  assert.equal(tours.getProgress(c.tour).completed, 0);
  assert.equal(stageModule.getStageView(c.stopQuiz, 'welcome').completed, false);
});

test('production explicit story-read click starts the minigame only after explanation', () => {
  const h = harness();
  arrive(h, 0);
  assert.match(h.$('#story-read').textContent, /미니게임 시작/);
  h.$('#story-read').click();
  assert.equal(h.$('#stop-quiz-dialog').open, true);
  assert.equal(h.$('#story-card').hidden, true);
  assert.ok(h.$('#stage-options').children.length > 1);
  assert.equal(tours.getProgress(h.context.tour).completed, 0);
});

test('production game guard expands explanation first even for an already visited location', () => {
  const h = harness(), c = h.context;
  c.tour = tours.visitStop(c.tour, 'welcome');
  c.openStopQuiz(0);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
  assert.equal(h.$('#story-card').hidden, false);
  h.$('#story-read').click();
  assert.equal(h.$('#stop-quiz-dialog').open, true);
});

test('viewing a remote story cannot award a visit or launch its minigame', () => {
  const h = harness();
  h.context.openStory(7);
  h.$('#story-read').click();
  assert.equal(h.$('#stop-quiz-dialog').open, false);
  assert.equal(h.context.tour.visitedIds.includes('care'), false);
  assert.equal(tours.getProgress(h.context.tour).completed, 0);
});

test('hidden previews do not unlock a game and expanded stories still require explicit start', () => {
  const h = harness();
  h.context.openStory(0, { expand: false });
  assert.equal(h.read("introShownIds.has('welcome')"), false);
  h.context.openStory(0, { expand: true });
  assert.equal(h.read("introShownIds.has('welcome')"), true);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
});

test('production arrival contains no game launch and no positive auto-advance assignment', () => {
  assert.doesNotMatch(functionSource('checkTourArrival'), /openStopQuiz\s*\(/);
  const assignments = [...source.matchAll(/nextStopAt\s*=(?!=)([^;\n,}]+)/g)].map(match => match[1].trim());
  assert.ok(assignments.length > 0);
  assert.ok(assignments.every(value => value === 'null'), JSON.stringify(assignments));
});

test('all eight production arrivals preserve explanation → explicit minigame start', () => {
  for (const [index, story] of SCHOOL_STORIES.entries()) {
    const h = harness();
    arrive(h, index, { rescue: true });
    assert.equal(h.$('#stop-quiz-dialog').open, false, story.id);
    h.$('#story-read').click();
    assert.equal(h.$('#stop-quiz-dialog').open, true, story.id);
    assert.equal(h.context.stopQuizId, story.id);
    assert.equal(tours.getProgress(h.context.tour).completed, 0, story.id);
  }
});
