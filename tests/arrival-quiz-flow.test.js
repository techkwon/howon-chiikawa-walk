import test from 'node:test';
import assert from 'node:assert/strict';
import * as stages from '../src/stage-games.js';
import { createHarness, arrive, tours } from './helpers/minigame-harness.js';
import { clickOption, finishStage, STAGE_PATHS } from './helpers/stage-paths.js';

test('production arrival and a partial choice do not earn a stamp; interactive completion earns it once', () => {
  const h = createHarness(stages);
  h.start(); arrive(h, 0);
  assert.equal(tours.getProgress(h.context.tour).completed, 0);
  h.$('#story-read').click();
  clickOption(h, STAGE_PATHS.welcome[0]);
  assert.equal(tours.getProgress(h.context.tour).completed, 0);
  finishStage(h, stages, 'welcome', { from: 1 });
  assert.equal(tours.getProgress(h.context.tour).completed, 1);
  h.$('#stop-quiz-retry').click();
  assert.equal(tours.getProgress(h.context.tour).completed, 1);
  assert.equal(h.context.stopQuiz.completedIds.length, 1);
});

test('production close/next cannot award unplayed or partially played stages', () => {
  const h = createHarness(stages);
  h.start(); arrive(h, 0, { rescue: true });
  h.$('#story-read').click();
  assert.equal(h.$('#stop-quiz-next').disabled, true);
  h.$('#stop-quiz-next').click();
  assert.equal(h.$('#stop-quiz-dialog').open, true);
  h.$('#stop-quiz-close').click();
  assert.equal(tours.getProgress(h.context.tour).completed, 0);
  h.context.openFinalQuiz();
  assert.equal(h.$('#farewell').open, false);
});
