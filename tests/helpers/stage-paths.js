import assert from 'node:assert/strict';

// Explicit human-playable option routes. The integration tests click current
// production-rendered buttons; they never assign a completed engine/tour state.
export const STAGE_PATHS = {
  welcome: ['uijeongbu', 'public', '2000'],
  together: ['speak', 'listen', 'summarize'],
  library: ['reading-club', 'challenge', 'reading-month'],
  voice: ['reading', 'notes', 'poster', 'confirm'],
  dream: ['nature', 'observe', 'curious'],
  healthy: ['ready', 'body', 'mind', 'try', 'body'],
  create: ['room:science', 'activity:science', 'room:computer', 'activity:computer', 'room:art', 'activity:art', 'room:music', 'activity:music'],
  care: ['trusted', 'request', 'wee', 'finish'],
};

export function clickOption(h, optionId) {
  const option = h.context.getStageView(h.context.stopQuiz, h.context.stopQuizId).options.find(item => item.value === optionId || item.id === optionId);
  const button = h.$('#stage-options').children.find(node => node.dataset.option === option?.id);
  assert.ok(button, `Missing rendered option ${optionId}; have ${h.$('#stage-options').children.map(node => `${node.dataset.option}:${node.textContent}`).join(', ')}`);
  assert.equal(button.disabled, false, `Rendered option ${optionId} is disabled`);
  button.click();
  return button;
}

export function finishStage(h, stages, id, { from = 0 } = {}) {
  assert.ok(STAGE_PATHS[id], `No independently reviewed input route for ${id}`);
  const initial = stages.getStageView(h.context.stopQuiz, id);
  assert.equal(initial.completed, false, `${id}: cannot start already completed`);
  let clicks = 0;
  for (const option of STAGE_PATHS[id].slice(from)) {
    if (stages.getStageView(h.context.stopQuiz, id).completed) break;
    clickOption(h, option);
    clicks++;
  }
  assert.ok(clicks + from >= 2, `${id}: must be an interactive multistep game`);
  assert.equal(stages.getStageView(h.context.stopQuiz, id).completed, true, `${id}: route did not complete`);
  assert.equal(h.$('#stop-quiz-next').disabled, false, `${id}: next is available after completion`);
}
