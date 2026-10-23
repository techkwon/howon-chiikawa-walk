/** A short, optional recap of facts already introduced by the school tour. */
export const QUIZ_QUESTIONS = [
  {
    id: 'public-school',
    storyId: 'welcome',
    question: '호원중학교는 공립 중학교다.',
    answer: true,
    explanation: 'O! 학교알리미에는 호원중학교가 공립 중학교로 안내되어 있어요.',
    sourceURL: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=e001bd70-f134-49e5-b48c-bd654325b615',
    source: {
      label: '학교알리미 · 호원중학교',
      url: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=e001bd70-f134-49e5-b48c-bd654325b615',
    },
  },
  {
    id: 'library-name',
    storyId: 'library',
    question: '호원중학교 도서관 이름은 혜윰도서관이다.',
    answer: true,
    explanation: 'O! 공식 홈페이지의 도서관 소식 게시판 이름은 혜윰도서관이에요.',
    sourceURL: 'https://howon-m.goeujb.kr/howon-m/na/ntt/selectNttList.do?bbsId=4878&mi=8494',
    source: {
      label: '혜윰도서관 소식',
      url: 'https://howon-m.goeujb.kr/howon-m/na/ntt/selectNttList.do?bbsId=4878&mi=8494',
    },
  },
  {
    id: 'learn-together',
    storyId: 'together',
    question: '호원중학교의 공개 교육 방향은 협력보다 혼자 공부하는 것만 강조한다.',
    answer: false,
    explanation: 'X! 공개 역점과제에는 소통·협력 중심 수업이 제시되어 있어요. 친구와 생각을 나누는 배움을 중요하게 소개해요.',
    sourceURL: 'https://howon-m.goeujb.kr/howon-m/cm/cntnts/cntntsView.do?cntntsId=1037&mi=4562',
    source: {
      label: '학교 역점과제',
      url: 'https://howon-m.goeujb.kr/howon-m/cm/cntnts/cntntsView.do?cntntsId=1037&mi=4562',
    },
  },
];

/** Original fan reactions. These are not official character dialogue or audio. */
export const QUIZ_REACTIONS = {
  chiikawa: {
    correct: { speech: '와아…!', narration: '잘 기억했어요!' },
    incorrect: { speech: '응…!', narration: '괜찮아요. 설명을 보고 함께 알아가요.' },
  },
  hachiware: {
    correct: { speech: '맞았어! 같이 보길 잘했네.', narration: '' },
    incorrect: { speech: '앗, 설명을 보니까 알겠다! 다시 알게 되면 됐지.', narration: '' },
  },
  usagi: {
    correct: { speech: '야하!', narration: '토끼가 기쁘게 손을 들어요!' },
    incorrect: { speech: '야하.', narration: '토끼가 함께 설명을 바라봐요. 틀려도 괜찮아요.' },
  },
};

/**
 * JSON-serializable, in-memory progress. answers is a dense array of booleans
 * in question order: false is a recorded X, not an unanswered question.
 * Calling this again creates an independent, fresh quiz.
 */
export function createQuizState() {
  return { index: 0, answers: [], finished: false };
}

function hasCurrentQuestion(state) {
  return Number.isInteger(state.index)
    && state.index >= 0
    && state.index < QUIZ_QUESTIONS.length;
}

function hasCurrentAnswer(state) {
  return typeof state.answers[state.index] === 'boolean';
}

/** Record the first O/X choice only; leave time to read feedback before Next. */
export function answerQuestion(state, answer) {
  if (state.finished || !hasCurrentQuestion(state)
    || typeof answer !== 'boolean' || hasCurrentAnswer(state)) return state;

  const answers = [...state.answers];
  answers[state.index] = answer;
  return { ...state, answers };
}

/**
 * No score threshold: any answered question can advance, even an incorrect one.
 * The last Next marks completion without moving beyond the final question.
 */
export function nextQuestion(state) {
  if (state.finished || !hasCurrentQuestion(state) || !hasCurrentAnswer(state)) return state;
  if (state.index === QUIZ_QUESTIONS.length - 1) return { ...state, finished: true };
  return { ...state, index: state.index + 1 };
}

/** Skipping is always allowed and does not manufacture answers or erase them. */
export function skipQuiz(state) {
  return state.finished ? state : { ...state, finished: true };
}

/** Score only the three known questions; unanswered questions never earn points. */
export function quizScore(state) {
  return QUIZ_QUESTIONS.reduce(
    (score, question, index) => score + Number(state.answers[index] === question.answer),
    0,
  );
}
