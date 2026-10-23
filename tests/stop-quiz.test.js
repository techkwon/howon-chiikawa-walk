import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STOP_QUIZZES,
  createStopQuizState,
  answerStopQuestion,
  retryStopQuestion,
  isStopQuizCompleted,
  getStopQuizProgress,
} from '../src/stop-quiz.js';
import { SCHOOL_STORIES } from '../src/school-stories.js';
import { createTourState, selectGuide } from '../src/tour-state.js';
import { createQuizState, answerQuestion } from '../src/school-quiz.js';

const ids = SCHOOL_STORIES.map(({ id }) => id);

function freezeState(state) {
  Object.freeze(state.answers);
  Object.freeze(state.completedIds);
  return Object.freeze(state);
}

test('every one of the eight tour stops has exactly one sourced OX question', () => {
  assert.equal(ids.length, 8);
  assert.deepEqual(Object.keys(STOP_QUIZZES), ids);
  for (const story of SCHOOL_STORIES) {
    const quiz = STOP_QUIZZES[story.id];
    assert.equal(quiz.id, story.id);
    assert.equal(quiz.storyId, story.id);
    assert.ok(quiz.question.length > 0 && quiz.question.length < 80);
    assert.equal(typeof quiz.answer, 'boolean');
    assert.ok(quiz.explanation.length > 0);
    assert.ok(story.sources.some(({ url }) => url === quiz.sourceURL));
    assert.equal(quiz.sourceURL, quiz.source.url);
    assert.ok(quiz.source.label.length > 0);
    assert.equal(new URL(quiz.sourceURL).protocol, 'https:');
    assert.equal(quiz.dateNote, story.dateNote);
    assert.equal(quiz.caution, story.caution);
  }
  assert.ok(Object.values(STOP_QUIZZES).some(({ answer }) => answer === true));
  assert.ok(Object.values(STOP_QUIZZES).some(({ answer }) => answer === false));
});

test('quiz data is immutable and does not retain mutable story source objects', () => {
  assert.ok(Object.isFrozen(STOP_QUIZZES));
  for (const quiz of Object.values(STOP_QUIZZES)) {
    assert.ok(Object.isFrozen(quiz));
    assert.ok(Object.isFrozen(quiz.source));
    const story = SCHOOL_STORIES.find(({ id }) => id === quiz.id);
    assert.ok(story.sources.every((source) => source !== quiz.source));
  }
});

test('new state is independent, serializable, and has no completed stops', () => {
  const state = createStopQuizState();
  assert.deepEqual(state, { answers: {}, completedIds: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.deepEqual(getStopQuizProgress(state), {
    total: 8, completed: 0, completedIds: [], done: false,
  });
  for (const id of ids) assert.equal(isStopQuizCompleted(state, id), false);
  const other = createStopQuizState();
  assert.notStrictEqual(state.answers, other.answers);
  assert.notStrictEqual(state.completedIds, other.completedIds);
});

test('first answer is immutable and repeated same or changed answers are ignored', () => {
  const initial = freezeState(createStopQuizState());
  const answered = freezeState(answerStopQuestion(initial, 'welcome', true));
  assert.deepEqual(initial, { answers: {}, completedIds: [] });
  assert.deepEqual(answered, { answers: { welcome: true }, completedIds: ['welcome'] });
  assert.notStrictEqual(answered.answers, initial.answers);
  assert.notStrictEqual(answered.completedIds, initial.completedIds);
  assert.strictEqual(answerStopQuestion(answered, 'welcome', true), answered);
  assert.strictEqual(answerStopQuestion(answered, 'welcome', false), answered);
  assert.equal(getStopQuizProgress(answered).completed, 1);
});

test('false is a valid answer and an incorrect response still completes participation', () => {
  assert.equal(STOP_QUIZZES.welcome.answer, true);
  const state = freezeState(answerStopQuestion(createStopQuizState(), 'welcome', false));
  assert.equal(state.answers.welcome, false);
  assert.equal(isStopQuizCompleted(state, 'welcome'), true);
  assert.strictEqual(answerStopQuestion(state, 'welcome', true), state);
  assert.equal(getStopQuizProgress(state).completed, 1);
});

test('stops can be answered in any order without cross-stop changes or duplicates', () => {
  let state = createStopQuizState();
  for (const [index, id] of [...ids].reverse().entries()) {
    state = answerStopQuestion(freezeState(state), id, STOP_QUIZZES[id].answer);
    assert.equal(getStopQuizProgress(state).completed, index + 1);
    assert.strictEqual(answerStopQuestion(state, id, STOP_QUIZZES[id].answer), state);
  }
  assert.deepEqual(Object.keys(state.answers), [...ids].reverse());
  assert.deepEqual(getStopQuizProgress(state), {
    total: 8, completed: 8, completedIds: ids, done: true,
  });
});

test('Retry clears just one answer, retains completed progress, and permits one new answer', () => {
  let state = answerStopQuestion(createStopQuizState(), 'welcome', false);
  state = freezeState(answerStopQuestion(state, 'library', true));
  const retry = freezeState(retryStopQuestion(state, 'welcome'));
  assert.deepEqual(retry.answers, { library: true });
  assert.deepEqual(retry.completedIds, ['welcome', 'library']);
  assert.equal(isStopQuizCompleted(retry, 'welcome'), true);
  assert.equal(state.answers.welcome, false);
  assert.strictEqual(retryStopQuestion(retry, 'welcome'), retry);

  const reanswered = freezeState(answerStopQuestion(retry, 'welcome', true));
  assert.deepEqual(reanswered.answers, { library: true, welcome: true });
  assert.deepEqual(reanswered.completedIds, ['welcome', 'library']);
  assert.strictEqual(answerStopQuestion(reanswered, 'welcome', false), reanswered);
  assert.equal(getStopQuizProgress(reanswered).completed, 2);
});

test('Retry cannot revoke an eight-stop completion and never requires a correct answer', () => {
  let state = createStopQuizState();
  for (const id of ids) state = answerStopQuestion(state, id, !STOP_QUIZZES[id].answer);
  assert.equal(getStopQuizProgress(state).done, true);
  for (const id of ids) state = retryStopQuestion(freezeState(state), id);
  assert.deepEqual(state.answers, {});
  assert.equal(getStopQuizProgress(state).done, true);
});

test('invalid IDs and non-boolean answers are identity-preserving no-ops', () => {
  const state = freezeState(createStopQuizState());
  for (const id of ['unknown', '', '__proto__', 'constructor', 'toString', null, undefined, 0, {}]) {
    assert.strictEqual(answerStopQuestion(state, id, true), state);
    assert.strictEqual(retryStopQuestion(state, id), state);
    assert.equal(isStopQuizCompleted(state, id), false);
  }
  for (const answer of [undefined, null, 'O', 'X', 'true', '', 0, 1, {}, []]) {
    assert.strictEqual(answerStopQuestion(state, 'welcome', answer), state);
  }
  assert.strictEqual(retryStopQuestion(state, 'welcome'), state);
});

test('guide changes leave shared stop quiz answers and completion untouched', () => {
  const quiz = freezeState(answerStopQuestion(createStopQuizState(), 'care', false));
  let tour = createTourState(ids);
  for (const guide of ['hachiware', 'usagi', 'chiikawa']) {
    tour = selectGuide(tour, guide);
    assert.equal(tour.guide, guide);
    assert.deepEqual(quiz, { answers: { care: false }, completedIds: ['care'] });
    assert.equal(isStopQuizCompleted(quiz, 'care'), true);
  }
});

test('a full reset clears all attempts and completion without modifying prior progress', () => {
  let previous = createStopQuizState();
  for (const id of ids) previous = answerStopQuestion(previous, id, STOP_QUIZZES[id].answer);
  freezeState(previous);
  const restarted = createStopQuizState();
  assert.deepEqual(restarted, { answers: {}, completedIds: [] });
  assert.equal(getStopQuizProgress(restarted).completed, 0);
  assert.equal(getStopQuizProgress(previous).completed, 8);
  assert.notStrictEqual(previous.answers, restarted.answers);
});

test('JSON round trips preserve retry state, and derived progress does not mutate the state', () => {
  let state = answerStopQuestion(createStopQuizState(), 'library', true);
  state = retryStopQuestion(state, 'library');
  const restored = freezeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(isStopQuizCompleted(restored, 'library'), true);
  const result = getStopQuizProgress(restored);
  result.completedIds.push('welcome');
  assert.equal(getStopQuizProgress(restored).completed, 1);
  const reanswered = answerStopQuestion(restored, 'library', false);
  assert.equal(reanswered.answers.library, false);
  assert.deepEqual(reanswered.completedIds, ['library']);
});

test('unknown or duplicated persisted completion IDs cannot inflate quiz completion', () => {
  const state = freezeState({ answers: {}, completedIds: ['welcome', 'unknown', 'welcome', '__proto__'] });
  assert.deepEqual(getStopQuizProgress(state), {
    total: 8, completed: 1, completedIds: ['welcome'], done: false,
  });
});

test('stop questions and the existing final three-question quiz remain independent', () => {
  const stopQuiz = freezeState(answerStopQuestion(createStopQuizState(), 'welcome', true));
  const finalQuiz = answerQuestion(createQuizState(), false);
  assert.deepEqual(stopQuiz.answers, { welcome: true });
  assert.deepEqual(finalQuiz, { index: 0, answers: [false], finished: false });
  assert.equal(getStopQuizProgress(stopQuiz).completed, 1);
});
