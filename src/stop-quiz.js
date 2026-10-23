import { SCHOOL_STORIES } from './school-stories.js';

/**
 * One short OX question for each virtual tour stop. All claims come from that
 * stop's existing story, not from assumptions about real room locations or
 * current programmes. Arrival/opening remains the responsibility of the UI.
 */
const questions = [
  {
    id: 'welcome',
    question: '호원중학교는 공립 중학교다.',
    answer: true,
    explanation: 'O! 학교알리미에는 호원중학교가 공립 중학교로 안내되어 있어요.',
    sourceIndex: 0,
  },
  {
    id: 'together',
    question: '학교의 공개 교육 방향은 협력보다 혼자 공부하는 것만 강조한다.',
    answer: false,
    explanation: 'X! 공개 역점과제에는 소통·협력 중심 수업과 독서·토론·논술 수업이 제시되어 있어요.',
    sourceIndex: 1,
  },
  {
    id: 'library',
    question: '호원중학교 도서관 이름은 혜윰도서관이다.',
    answer: true,
    explanation: 'O! 공식 홈페이지에서 혜윰도서관 소식과 전자도서관·우리학교 도서검색을 안내해요.',
    sourceIndex: 0,
  },
  {
    id: 'voice',
    question: '공개 역점과제에는 학생자치회와 동아리 문화 조성이 담겨 있다.',
    answer: true,
    explanation: 'O! 학생자치회와 자발적인 동아리 문화 조성이 공개 역점과제에 담겨 있어요.',
    sourceIndex: 0,
  },
  {
    id: 'dream',
    question: '공식 학교현황에는 진로진학상담실이 안내되어 있지 않다.',
    answer: false,
    explanation: 'X! 공식 학교현황에는 진로진학상담실이 안내되어 있어요.',
    sourceIndex: 1,
  },
  {
    id: 'healthy',
    question: '학교의 교육목표는 건강한 몸뿐 아니라 마음도 중요하게 여긴다.',
    answer: true,
    explanation: 'O! 교육목표의 건강인 항목은 건강한 몸과 마음, 적극적인 자세를 강조해요.',
    sourceIndex: 0,
  },
  {
    id: 'create',
    question: '공식 학교현황에는 과학실과 미술실이 안내되어 있지 않다.',
    answer: false,
    explanation: 'X! 학교현황에는 과학실·컴퓨터실·미술실·음악실이 안내되어 있어요. 이 산책 지점이 실제 교실 위치를 뜻하는 것은 아니에요.',
    sourceIndex: 1,
  },
  {
    id: 'care',
    question: '공식 홈페이지 위클래스에는 상담자료와 고민상담 안내가 있다.',
    answer: true,
    explanation: 'O! 공식 홈페이지 위클래스에는 상담자료와 고민상담을 안내하는 공간이 있어요.',
    sourceIndex: 0,
  },
];

/** Keyed by the same stable IDs used by SCHOOL_STORIES and tour progress. */
export const STOP_QUIZZES = Object.freeze(Object.fromEntries(questions.map(
  ({ sourceIndex, ...question }) => {
    const story = SCHOOL_STORIES.find(({ id }) => id === question.id);
    const source = Object.freeze({ ...story.sources[sourceIndex] });
    return [question.id, Object.freeze({
      ...question,
      storyId: question.id,
      sourceURL: source.url,
      source,
      dateNote: story.dateNote,
      ...(story.caution ? { caution: story.caution } : {}),
    })];
  },
)));

const STOP_IDS = Object.keys(STOP_QUIZZES);
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isKnownStop = (id) => typeof id === 'string' && owns(STOP_QUIZZES, id);
const hasAnswer = (state, id) => owns(state.answers, id) && typeof state.answers[id] === 'boolean';

/**
 * Shared, JSON-serializable progress, independent of the selected guide.
 * answers[id] is the latest attempt's boolean; false is a valid X answer.
 * completedIds remembers participation, even if an optional retry is open.
 * Call createStopQuizState() again to reset the whole set.
 */
export function createStopQuizState() {
  return { answers: {}, completedIds: [] };
}

/** First answer wins until Retry. Any answer completes participation, not only O. */
export function answerStopQuestion(state, id, answer) {
  if (!isKnownStop(id) || typeof answer !== 'boolean' || hasAnswer(state, id)) return state;
  return {
    ...state,
    answers: { ...state.answers, [id]: answer },
    completedIds: state.completedIds.includes(id)
      ? state.completedIds
      : [...state.completedIds, id],
  };
}

/** Retry only this stop, without erasing other answers or earned tour progress. */
export function retryStopQuestion(state, id) {
  if (!isKnownStop(id) || !hasAnswer(state, id)) return state;
  const answers = { ...state.answers };
  delete answers[id];
  return { ...state, answers };
}

/** Completion means the visitor has answered once; it is not a correctness gate. */
export function isStopQuizCompleted(state, id) {
  return isKnownStop(id) && state.completedIds.includes(id);
}

/** Derived progress is deduplicated and cannot be inflated by unknown stop IDs. */
export function getStopQuizProgress(state) {
  const completedIds = STOP_IDS.filter((id) => isStopQuizCompleted(state, id));
  return {
    total: STOP_IDS.length,
    completed: completedIds.length,
    completedIds,
    done: completedIds.length === STOP_IDS.length,
  };
}
