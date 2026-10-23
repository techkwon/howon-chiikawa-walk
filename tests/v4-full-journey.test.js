import test from 'node:test';
import assert from 'node:assert/strict';
import * as stages from '../src/stage-games.js';
import { createHarness, arrive, SCHOOL_STORIES, tours, navigation } from './helpers/minigame-harness.js';
import { finishStage } from './helpers/stage-paths.js';

for (const [selected, kind] of ['chiikawa', 'hachiware', 'usagi'].entries()) {
  test(`${kind}: production walking → story → explicit start → eight interactive minigames → farewell, without final OX`, () => {
    const h = createHarness(stages, selected), c = h.context;
    h.start(kind);
    assert.equal(c.tour.guide, kind);
    assert.equal(c.selected, selected);
    for (const [index, story] of SCHOOL_STORIES.entries()) {
      arrive(h, index);
      assert.equal(tours.getProgress(c.tour).completed, index, 'arrival alone does not complete the game');
      h.$('#story-read').click();
      assert.equal(h.$('#stop-quiz-dialog').open, true);
      assert.equal(c.stopQuizId, story.id);
      assert.equal(c.paused, true);
      assert.ok(h.$('#stage-fiction').textContent.includes(stages.STAGE_GAMES[story.id].fictionNote));
      finishStage(h, stages, story.id);
      assert.equal(tours.getProgress(c.tour).completed, index + 1);
      assert.ok(h.$('#stop-quiz-feedback').textContent.length > 0);
      h.$('#stop-quiz-next').click();
      assert.equal(h.$('#stop-quiz-dialog').open, false);
    }
    assert.equal(h.$('#farewell').open, true);
    assert.equal(tours.getProgress(c.tour).completed, 8);
    assert.equal(c.stopQuiz.completedIds.length, 8);
    assert.match(h.$('#final-score').textContent, /미니게임 8 \/ 8 완료/);
    assert.doesNotMatch(h.$('#final-score').textContent, /OX|퀴즈/);
    const opened = h.$('#farewell').modalCount;
    for (let n = 0; n < 10; n++) { h.$('#stop-quiz-next').click(); c.openFinalQuiz(); }
    assert.equal(h.$('#farewell').modalCount, opened, 'late repeated next clicks do not reopen farewell');
    h.$('#keep-walking').click();
    assert.equal(h.$('#farewell').open, false);
    assert.equal(c.manual, true);
    assert.equal(c.paused, false);
  });
}

test('normal welcome approach is still travelling after 15 seconds, not necessarily blocked', () => {
  for (const [selected, kind] of ['chiikawa', 'hachiware', 'usagi'].entries()) {
    const h = createHarness(stages, selected);
    h.start(kind);
    const before = h.actors[selected].model.position.clone();
    h.tick(300);
    assert.equal(h.context.tour.visitedIds.includes('welcome'), false);
    assert.ok(h.actors[selected].model.position.distanceTo(before) > 10);
  }
});

test('fault-injected off-graph canopy edge really stalls before optional recovery', () => {
  const h = createHarness(stages), c = h.context;
  h.start();
  h.actors[0].model.position.set(-2.79, .25, -20);
  h.actors[0].recovery = [];
  c.navigateStop(0);
  h.tick(300);
  const at15 = h.actors[0].model.position.clone();
  h.tick(300);
  assert.equal(c.tour.visitedIds.includes('welcome'), false);
  assert.ok(h.actors[0].model.position.distanceTo(at15) < .01);
  assert.ok(Math.abs(h.actors[0].model.position.x - .4) < .01);
});

for (const [selected, kind] of ['chiikawa', 'hachiware', 'usagi'].entries()) {
  test(`${kind}: blocked route → 15-second safe jump → explanation → all eight actual minigames → farewell`, () => {
    const h = createHarness(stages, selected), c = h.context;
    h.start(kind);
    for (const [index, story] of SCHOOL_STORIES.entries()) {
      const actor = h.actors[selected];
      actor.model.position.set(-2.79, .25, -20);
      actor.recovery = []; actor.manualTrail = [];
      c.navigateStop(index);
      h.tick(301);
      assert.equal(h.$('#travel-help').hidden, false, `${kind}/${story.id}`);
      assert.equal(h.$('#stop-quiz-dialog').open, false);
      const before = actor.model.position.clone();
      h.tick(60);
      assert.ok(actor.model.position.distanceTo(before) < .1);
      const peerPositions = h.actors.filter((_, i) => i !== selected).map(a => a.model.position.clone());
      h.$('#travel-jump').click();
      assert.equal(h.$('#travel-help').hidden, true);
      assert.equal(h.$('#story-card').hidden, false);
      assert.equal(h.$('#stop-quiz-dialog').open, false);
      assert.ok(c.tour.visitedIds.includes(story.id));
      assert.equal(tours.getProgress(c.tour).completed, index);
      assert.equal(navigation.insideBuilding(actor.model.position.x, actor.model.position.z, 1.19), false);
      h.actors.filter((_, i) => i !== selected).forEach((a, i) => assert.equal(a.model.position.distanceTo(peerPositions[i]), 0));
      h.$('#story-read').click();
      finishStage(h, stages, story.id);
      h.$('#stop-quiz-next').click();
    }
    assert.equal(h.$('#farewell').open, true);
    assert.equal(tours.getProgress(c.tour).completed, 8);
  });
}

test('15-second assistance excludes paused time and direct walking does not complete a game', () => {
  const h = createHarness(stages), c = h.context;
  h.start();
  h.actors[0].model.position.set(-2.79, .25, -20);
  c.navigateStop(0);
  h.$('#play').click();
  assert.equal(c.paused, true);
  h.tick(600);
  assert.equal(h.$('#travel-help').hidden, true);
  h.$('#play').click();
  h.tick(301);
  assert.equal(h.$('#travel-help').hidden, false);
  h.$('#travel-manual').click();
  assert.equal(c.manual, true);
  assert.equal(c.paused, false);
  assert.equal(h.$('#travel-help').hidden, true);
  assert.equal(h.actors[0].path.length, 0);
  h.key('KeyW');
  h.actors[0].model.rotation.y = Math.PI;
  const before = h.actors[0].model.position.clone();
  h.tick(20);
  assert.ok(h.actors[0].model.position.distanceTo(before) > 5.9);
  assert.equal(tours.getProgress(c.tour).completed, 0);
  assert.equal(h.$('#stop-quiz-dialog').open, false);
});

test('keep waiting dismisses assistance without movement or game progress', () => {
  const h = createHarness(stages), c = h.context;
  h.start();
  h.tick(301);
  assert.equal(h.$('#travel-help').hidden, false);
  const before = h.actors[0].model.position.clone();
  h.$('#travel-wait').click();
  assert.equal(h.$('#travel-help').hidden, true);
  assert.equal(h.actors[0].model.position.distanceTo(before), 0);
  assert.equal(c.manual, false);
  assert.equal(tours.getProgress(c.tour).completed, 0);
});
