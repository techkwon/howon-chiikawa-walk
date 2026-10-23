import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUIZ_QUESTIONS,
  QUIZ_REACTIONS,
  createQuizState,
  answerQuestion,
  nextQuestion,
  skipQuiz,
  quizScore,
} from '../src/school-quiz.js';
import { SCHOOL_STORIES } from '../src/school-stories.js';

function freezeState(state) {
  Object.freeze(state.answers);
  return Object.freeze(state);
}

test('three OX questions cite facts and sources already introduced in the tour', () => {
  assert.equal(QUIZ_QUESTIONS.length, 3);
  assert.equal(new Set(QUIZ_QUESTIONS.map(({ id }) => id)).size, 3);
  assert.deepEqual(QUIZ_QUESTIONS.map(({ answer }) => answer), [true, true, false]);
  for (const question of QUIZ_QUESTIONS) {
    assert.equal(typeof question.question, 'string');
    assert.ok(question.question.length > 0);
    assert.equal(typeof question.answer, 'boolean');
    assert.ok(question.explanation.length > 0);
    assert.ok(question.source.label.length > 0);
    assert.equal(question.sourceURL, question.source.url);
    const story = SCHOOL_STORIES.find(({ id }) => id === question.storyId);
    assert.ok(story, `${question.id} must refer to a tour story`);
    assert.ok(story.sources.some(({ url }) => url === question.source.url));
    assert.equal(new URL(question.source.url).protocol, 'https:');
  }
});

test('each selectable guide has correct and incorrect feedback without a score gate', () => {
  assert.deepEqual(Object.keys(QUIZ_REACTIONS), ['chiikawa', 'hachiware', 'usagi']);
  for (const guide of Object.values(QUIZ_REACTIONS)) {
    for (const outcome of ['correct', 'incorrect']) {
      assert.equal(typeof guide[outcome].speech, 'string');
      assert.ok(guide[outcome].speech.length > 0);
      assert.equal(typeof guide[outcome].narration, 'string');
    }
  }
});

test('a new quiz has independent, serializable empty progress and zero points', () => {
  const initial = createQuizState();
  assert.deepEqual(initial, { index: 0, answers: [], finished: false });
  assert.deepEqual(JSON.parse(JSON.stringify(initial)), initial);
  assert.equal(quizScore(initial), 0);
  const second = createQuizState();
  assert.notStrictEqual(initial, second);
  assert.notStrictEqual(initial.answers, second.answers);
});

test('answering is immutable and both same-answer and changed-answer retries are no-ops', () => {
  const initial = freezeState(createQuizState());
  const answered = freezeState(answerQuestion(initial, true));
  assert.deepEqual(answered, { index: 0, answers: [true], finished: false });
  assert.deepEqual(initial.answers, []);
  assert.notStrictEqual(answered.answers, initial.answers);
  assert.strictEqual(answerQuestion(answered, true), answered);
  assert.strictEqual(answerQuestion(answered, false), answered);
  assert.equal(quizScore(answered), 1);
});

test('X is a valid recorded answer and does not allow answer replacement', () => {
  const answered = freezeState(answerQuestion(createQuizState(), false));
  assert.deepEqual(answered.answers, [false]);
  assert.strictEqual(answerQuestion(answered, true), answered);
  assert.strictEqual(answerQuestion(answered, false), answered);
  assert.equal(quizScore(answered), 0);
  assert.equal(nextQuestion(answered).index, 1);
});

test('only booleans count as answers, and Next is gated on the current answer', () => {
  const initial = freezeState(createQuizState());
  assert.strictEqual(nextQuestion(initial), initial);
  for (const value of [undefined, null, 0, 1, '', 'O', 'X', 'true', {}, []]) {
    assert.strictEqual(answerQuestion(initial, value), initial);
  }
  const answered = freezeState(answerQuestion(initial, true));
  const secondQuestion = freezeState(nextQuestion(answered));
  assert.equal(secondQuestion.index, 1);
  assert.deepEqual(secondQuestion.answers, [true]);
  assert.equal(answered.index, 0);
  assert.strictEqual(nextQuestion(secondQuestion), secondQuestion);
});

test('all correct answers score exactly three and finish only after final feedback', () => {
  let state = createQuizState();
  for (const [index, question] of QUIZ_QUESTIONS.entries()) {
    state = answerQuestion(freezeState(state), question.answer);
    assert.equal(state.index, index);
    assert.equal(state.finished, false);
    assert.equal(quizScore(state), index + 1);
    state = nextQuestion(freezeState(state));
    assert.equal(state.finished, index === QUIZ_QUESTIONS.length - 1);
  }
  assert.deepEqual(state, { index: 2, answers: [true, true, false], finished: true });
  assert.equal(quizScore(state), 3);
  assert.strictEqual(answerQuestion(state, true), state);
  assert.strictEqual(nextQuestion(state), state);
  assert.strictEqual(skipQuiz(state), state);
});

test('all incorrect answers still finish normally with zero points', () => {
  let state = createQuizState();
  for (const question of QUIZ_QUESTIONS) {
    state = nextQuestion(answerQuestion(state, !question.answer));
  }
  assert.equal(state.finished, true);
  assert.equal(quizScore(state), 0);
  assert.equal(state.answers.length, 3);
});

test('skip works before starting or mid-quiz and preserves the existing answers', () => {
  const initial = freezeState(createQuizState());
  const skipped = freezeState(skipQuiz(initial));
  assert.deepEqual(skipped, { index: 0, answers: [], finished: true });
  assert.equal(initial.finished, false);
  assert.equal(quizScore(skipped), 0);
  assert.strictEqual(answerQuestion(skipped, true), skipped);
  assert.strictEqual(nextQuestion(skipped), skipped);
  assert.strictEqual(skipQuiz(skipped), skipped);

  const partial = freezeState(nextQuestion(answerQuestion(createQuizState(), true)));
  const partialSkip = skipQuiz(partial);
  assert.deepEqual(partialSkip, { index: 1, answers: [true], finished: true });
  assert.equal(partial.finished, false);
  assert.equal(quizScore(partialSkip), 1);
});

test('starting again resets a finished quiz without modifying its previous result', () => {
  let completed = createQuizState();
  for (const question of QUIZ_QUESTIONS) {
    completed = nextQuestion(answerQuestion(completed, question.answer));
  }
  freezeState(completed);
  const restarted = createQuizState();
  assert.deepEqual(restarted, { index: 0, answers: [], finished: false });
  assert.equal(quizScore(restarted), 0);
  assert.equal(quizScore(completed), 3);
  assert.equal(completed.finished, true);
});

test('progress resumes after JSON serialization and score never exceeds three', () => {
  const partial = nextQuestion(answerQuestion(createQuizState(), true));
  let restored = JSON.parse(JSON.stringify(partial));
  for (const question of QUIZ_QUESTIONS.slice(1)) {
    restored = nextQuestion(answerQuestion(restored, question.answer));
  }
  assert.equal(restored.finished, true);
  assert.equal(quizScore(restored), 3);
  assert.equal(quizScore({ ...restored, answers: [...restored.answers, true, true] }), 3);
  assert.equal(quizScore({ ...restored, answers: [null, undefined, undefined] }), 0);
});

test('invalid current indices cannot answer or advance', () => {
  for (const index of [-1, 3, 10, 0.5, '0', NaN]) {
    const state = freezeState({ ...createQuizState(), index });
    assert.strictEqual(answerQuestion(state, true), state);
    assert.strictEqual(nextQuestion(state), state);
  }
});
