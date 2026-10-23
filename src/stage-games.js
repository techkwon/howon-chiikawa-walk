import { SCHOOL_STORIES } from './school-stories.js';

/**
 * Eight optional, untimed minigames. School facts are copied only from the
 * separately sourced tour stories; every invented scenario is labelled.
 * This module has no DOM, clock, random, storage, guide, or movement dependency.
 */
const definitions = [
  {
    id: 'welcome', type: 'fill_slots', title: '학교 소개 카드 완성',
    instructions: '빈칸에 어울리는 조각을 하나씩 눌러 학교 소개 카드를 완성해요.',
    fictionNote: '카드 조립은 이 산책을 위해 만든 학습 게임이에요.', sourceIndex: 0,
    slots: [
      { label: '학교가 있는 도시', answer: 'uijeongbu', choices: [{ value: 'seoul', label: '서울특별시' }, { value: 'uijeongbu', label: '의정부시' }, { value: 'suwon', label: '수원시' }], hint: '학교 이야기의 주소는 의정부시 호암로 205예요.' },
      { label: '학교의 설립 구분', answer: 'public', choices: [{ value: 'private', label: '사립' }, { value: 'national', label: '국립' }, { value: 'public', label: '공립' }], hint: '학교알리미에는 공립 중학교로 안내되어 있어요.' },
      { label: '학교알리미의 설립일', answer: '2000', choices: [{ value: '2010', label: '2010년 3월 1일' }, { value: '2000', label: '2000년 3월 1일' }, { value: '1990', label: '1990년 3월 1일' }], hint: '학교 이야기에서 본 설립일은 2000년 3월 1일이에요.' },
    ],
    success: '소개 카드 완성! 의정부시의 공립 중학교, 2000년 3월 1일 설립이라는 공개 정보를 연결했어요.',
  },
  {
    id: 'together', type: 'order', title: '협력 이야기 순서 만들기',
    instructions: '아래 가상 장면을 읽고, 세 장의 카드를 이야기 순서대로 골라요. 끌어 놓지 않아도 돼요.',
    fictionNote: '게임 속 협력 장면과 순서는 가상 예시이며, 실제 수업 절차를 뜻하지 않아요.', sourceIndex: 1,
    story: '먼저 내 생각을 말했어요. 이어서 친구의 생각을 들었어요. 마지막으로 함께 생각을 정리했어요.',
    cards: [{ value: 'summarize', label: '함께 생각 정리하기' }, { value: 'speak', label: '내 생각 말하기' }, { value: 'listen', label: '친구 생각 듣기' }],
    order: ['speak', 'listen', 'summarize'],
    success: '협력 이야기 완성! 말하기, 듣기, 함께 정리하기를 차례로 연결했어요.',
  },
  {
    id: 'library', type: 'collect', title: '독서 소식 책갈피 찾기',
    instructions: '여섯 장의 카드에서 학교 이야기에 나온 2026년 독서 소식 세 장을 찾아요. 순서는 자유예요.',
    fictionNote: '카드 모으기는 가상 게임이에요. 게시 사실을 찾는 활동이며 현재 신청 가능 여부를 뜻하지 않아요.', sourceIndex: 0,
    cards: [
      { value: 'reading-club', label: '학생 독서모임 모집', correct: true },
      { value: 'robot', label: '달 탐사 로봇 대회', correct: false },
      { value: 'challenge', label: '2학기 독서챌린지', correct: true },
      { value: 'underwater', label: '해저 보물 탐험', correct: false },
      { value: 'reading-month', label: '독서의 달 행사 안내', correct: true },
      { value: 'dragon', label: '용의 성 요리 교실', correct: false },
    ],
    success: '책갈피 세 장을 찾았어요! 독서모임, 독서챌린지, 독서의 달은 2026년 게시판에 안내된 소식이에요.',
  },
  {
    id: 'voice', type: 'proposal_builder', title: '우리의 제안 카드 공방',
    instructions: '관심 주제, 의견을 모으는 방법, 제안 방식을 골라 나만의 가상 제안 카드를 만들어요. 모든 선택이 가능해요.',
    fictionNote: '실제 학생자치회 안건이나 행사 계획이 아닌 가상 제안이에요. 학교에 전송되지 않아요.', sourceIndex: 0,
    groups: [
      { label: '어떤 주제를 이야기하고 싶나요?', choices: [{ value: 'reading', label: '함께 책 이야기하기' }, { value: 'rest', label: '쉬는 시간 아이디어' }, { value: 'club', label: '새로운 동아리 상상하기' }] },
      { label: '친구들의 생각을 어떻게 모을까요?', choices: [{ value: 'notes', label: '익명 쪽지로 의견 모으기' }, { value: 'circle', label: '차례로 이야기 나누기' }, { value: 'draw', label: '그림으로 생각 모으기' }] },
      { label: '모인 의견을 어떤 모습으로 제안할까요?', choices: [{ value: 'poster', label: '한 장의 제안 포스터' }, { value: 'speech', label: '짧은 발표로 정리' }, { value: 'cards', label: '아이디어 카드로 정리' }] },
    ],
    success: '우리의 제안 카드가 완성됐어요! 서로의 목소리를 모아 보는 가상 활동을 마쳤어요. 실제로 제출되지는 않아요.',
  },
  {
    id: 'dream', type: 'branch_choice', title: '나의 관심 탐험 지도',
    instructions: '지금 눈길이 가는 관심을 고르면 그 관심에서 출발하는 탐색 길이 열려요. 정해진 꿈이나 정답은 없어요.',
    fictionNote: '관심 탐색은 가상 예시이며 학교의 실제 진로 프로그램, 진단 또는 추천 결과가 아니에요.', sourceIndex: 0,
    interests: [
      { value: 'nature', label: '자연과 생명', experiences: [{ value: 'observe', label: '주변 자연 관찰해 보기' }, { value: 'nature-book', label: '자연 이야기 책 찾아보기' }] },
      { value: 'making', label: '만들기와 표현', experiences: [{ value: 'sketch', label: '아이디어를 그림으로 표현하기' }, { value: 'model', label: '작은 모형 상상해 보기' }] },
      { value: 'people', label: '사람과 이야기', experiences: [{ value: 'listen-story', label: '다양한 사람의 이야기 읽기' }, { value: 'questions', label: '궁금한 질문 만들어 보기' }] },
      { value: 'undecided', label: '아직 잘 모르겠어요', experiences: [{ value: 'browse', label: '여러 분야를 조금씩 둘러보기' }, { value: 'notice', label: '오늘 재미있었던 일 떠올리기' }] },
    ],
    reflections: [{ value: 'curious', label: '더 궁금한 점을 하나 남길래요' }, { value: 'again', label: '다른 경험도 천천히 찾아볼래요' }, { value: 'pause', label: '지금은 발견한 것만 기억할래요' }],
    success: '나만의 관심 길이 생겼어요! 지금의 선택은 바뀌어도 괜찮고, 꿈을 바로 정할 필요도 없어요.',
  },
  {
    id: 'healthy', type: 'sequence_memory', title: '활력 리듬 따라 누르기',
    instructions: '리듬을 살펴본 뒤 같은 순서로 카드를 눌러요. 시간 제한은 없고 언제든 힌트를 펼칠 수 있어요.',
    fictionNote: '몸·마음·도전 카드를 사용한 가상 기억 게임이며 운동 처방이나 실제 체육 수업이 아니에요.', sourceIndex: 0,
    cards: [{ value: 'body', label: '몸' }, { value: 'mind', label: '마음' }, { value: 'try', label: '도전' }],
    sequence: ['body', 'mind', 'try', 'body'],
    success: '몸 → 마음 → 도전 → 몸! 활력 리듬을 완성했어요. 학교 교육목표는 건강한 몸과 마음, 적극적인 자세를 강조해요.',
  },
  {
    id: 'create', type: 'match', title: '탐구와 표현 연결판',
    instructions: '공간 카드 하나를 먼저 고르고, 어울리는 가상 활동 카드를 연결해요. 네 쌍을 자유로운 순서로 찾아요.',
    fictionNote: '활동은 이해를 돕기 위한 가상 예시예요. 실제 수업·장비·교실 위치를 설명하지 않아요.', sourceIndex: 1,
    pairs: [
      { value: 'science', left: '과학실', right: '질문과 탐구' },
      { value: 'computer', left: '컴퓨터실', right: '컴퓨터 활동' },
      { value: 'art', left: '미술실', right: '그림과 표현' },
      { value: 'music', left: '음악실', right: '소리와 음악' },
    ],
    rightOrder: ['art', 'music', 'science', 'computer'],
    success: '네 쌍을 연결했어요! 학교현황에 소개된 공간을 가상 활동과 이어 보았어요. 실제 교실 위치는 이 게임과 달라요.',
  },
  {
    id: 'care', type: 'route', title: '도움으로 이어지는 길',
    instructions: '가상의 친구가 혼자 고민을 안고 있지 않도록 다음 길을 골라요. 실제 지도나 상담 예약 화면은 아니에요.',
    fictionNote: '도움 경로는 가상 장면이에요. 실제 상담 시간·예약·위치·비밀보장 범위를 약속하지 않아요.', sourceIndex: 0,
    nodes: {
      start: { label: '고민을 혼자 안고 있는 친구', prompt: '가상의 친구가 고민을 혼자 안고 있어요. 어떤 길로 갈까요?', choices: [{ value: 'trusted', label: '믿을 만한 어른에게 말 꺼내기', next: 'share' }, { value: 'alone', label: '누구에게도 말하지 않고 혼자 버티기', hint: '이 게임의 목적은 도움으로 연결되는 길을 찾는 거예요. 함께할 사람을 떠올려 볼까요?' }] },
      share: { label: '도움 요청하기', prompt: '말을 꺼냈어요. 내 마음을 전하는 다음 발판을 골라요.', choices: [{ value: 'request', label: '필요한 도움을 함께 이야기하기', next: 'choose' }, { value: 'guess', label: '상대가 모두 알아맞히길 기다리기', hint: '모든 것을 설명할 필요는 없어요. 필요한 도움을 함께 이야기하는 길을 골라 볼까요?' }] },
      choose: { label: '도움 공간 알아보기', prompt: '학교현황에 소개된 도움 공간을 하나 살펴볼까요? 두 길 모두 열려 있어요.', choices: [{ value: 'wee', label: '위클래스 안내 알아보기', next: 'wee' }, { value: 'health', label: '보건실 안내 알아보기', next: 'health' }] },
      wee: { label: '위클래스 안내', prompt: '위클래스에는 상담자료와 고민상담 안내 공간이 있어요. 가상 경로를 마칠까요?', choices: [{ value: 'finish', label: '혼자만 안고 있지 않기 · 길 완성', next: 'finish' }] },
      health: { label: '보건실 안내', prompt: '학교현황에는 보건실이 안내되어 있어요. 가상 경로를 마칠까요?', choices: [{ value: 'finish', label: '혼자만 안고 있지 않기 · 길 완성', next: 'finish' }] },
    },
    success: '도움으로 이어지는 길을 완성했어요. 필요한 도움을 이야기하고 안내를 알아보는 것도 하나의 방법이에요.',
  },
];

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Stable story IDs; no fictional scenario is presented as a school fact. */
export const STAGE_GAMES = deepFreeze(Object.fromEntries(definitions.map(({ sourceIndex, ...game }) => {
  const story = SCHOOL_STORIES.find(({ id }) => id === game.id);
  const source = { ...story.sources[sourceIndex] };
  return [game.id, {
    ...game,
    storyId: game.id,
    factLabel: '확인된 학교 정보',
    fact: story.bullets.join(' '),
    fictionLabel: '게임을 위한 가상 활동',
    source, sourceURL: source.url,
    sources: story.sources.map((item) => ({ ...item })),
    dateNote: story.dateNote,
    caution: story.caution || '',
  }];
})));

const STAGE_IDS = Object.freeze(Object.keys(STAGE_GAMES));
const owns = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
const isKnownStage = (id) => typeof id === 'string' && owns(STAGE_GAMES, id);
const initialAttempt = () => ({ choices: [], pending: null, node: 'start', phase: 'observe', hintVisible: false, revision: 0, completed: false, feedback: '', status: 'idle' });
const attemptFor = (state, id) => owns(state?.stages, id) ? state.stages[id] : initialAttempt();
const labelFor = (cards, value) => cards.find((card) => card.value === value)?.label || '';

/** In-memory, JSON-serializable progress shared by all guides and revisit views. */
export function createStageState() {
  return { stages: {}, completedIds: [] };
}

/** Earned stage completion survives an optional replay, never close/reopen. */
export function isStageCompleted(state, id) {
  return isKnownStage(id) && Array.isArray(state?.completedIds) && state.completedIds.includes(id);
}

export function getStageProgress(state) {
  const completedIds = STAGE_IDS.filter((id) => isStageCompleted(state, id));
  return { total: STAGE_IDS.length, completed: completedIds.length, completedIds, done: completedIds.length === STAGE_IDS.length };
}

function totalSteps(game) {
  switch (game.type) {
    case 'fill_slots': return game.slots.length;
    case 'order': return game.order.length;
    case 'collect': return game.cards.filter((card) => card.correct).length;
    case 'proposal_builder': return game.groups.length + 1;
    case 'branch_choice': return 3;
    case 'sequence_memory': return game.sequence.length;
    case 'match': return game.pairs.length;
    case 'route': return 4;
    default: return 0;
  }
}

function viewContent(game, attempt) {
  const count = attempt.choices.length;
  switch (game.type) {
    case 'fill_slots': {
      const slot = game.slots[count];
      return {
        prompt: slot ? `${count + 1}번 빈칸: ${slot.label}` : '세 개의 빈칸을 모두 채웠어요.',
        options: (slot?.choices || []).map((choice) => ({ ...choice, kind: 'tile' })),
        boardLabel: '학교 소개 카드',
        board: game.slots.map((item, index) => ({ label: `${item.label}: ${index < count ? labelFor(item.choices, attempt.choices[index]) : '빈칸'}`, state: index < count ? 'done' : index === count ? 'current' : 'waiting' })),
      };
    }
    case 'order': return {
      prompt: `${game.story}\n${count < game.order.length ? `이야기의 ${count + 1}번째 카드를 골라요.` : '이야기의 순서를 모두 연결했어요.'}`,
      options: game.cards.map((card) => ({ ...card, kind: 'order', selected: attempt.choices.includes(card.value), disabled: attempt.choices.includes(card.value) })),
      boardLabel: '내가 연결한 이야기',
      board: game.order.map((_, index) => ({ label: `${index + 1}. ${index < count ? labelFor(game.cards, attempt.choices[index]) : '다음 카드'}`, state: index < count ? 'done' : index === count ? 'current' : 'waiting' })),
    };
    case 'collect': return {
      prompt: '학교 이야기에서 본 독서 소식 세 장을 모아요. 이미 찾은 책갈피는 그대로 남아요.',
      options: game.cards.map(({ value, label }) => ({ value, label, kind: 'collect', selected: attempt.choices.includes(value), disabled: attempt.choices.includes(value) })),
      boardLabel: '모은 독서 책갈피',
      board: attempt.choices.map((value) => ({ label: labelFor(game.cards, value), state: 'done' })),
    };
    case 'proposal_builder': {
      const group = game.groups[count];
      return {
        prompt: group ? group.label : '완성될 제안을 읽어 보고, 카드에 담아 볼까요?',
        options: group ? group.choices.map((choice) => ({ ...choice, kind: 'proposal' })) : [{ value: 'confirm', label: '이 제안으로 카드 완성하기', kind: 'confirm' }],
        boardLabel: '나의 가상 제안 카드',
        board: game.groups.map((item, index) => ({ label: index < count ? labelFor(item.choices, attempt.choices[index]) : ['관심 주제', '의견 모으는 방법', '제안 방식'][index], state: index < count ? 'done' : index === count ? 'current' : 'waiting' })),
      };
    }
    case 'branch_choice': {
      const interest = game.interests.find(({ value }) => value === attempt.choices[0]);
      const cards = count === 0 ? game.interests : count === 1 ? interest.experiences : game.reflections;
      return {
        prompt: count === 0 ? '지금 눈길이 가는 관심을 골라요. 아직 잘 모르겠어도 괜찮아요.' : count === 1 ? `“${interest.label}”에서 출발해 어떤 경험을 상상해 볼까요?` : '탐험 끝에 어떤 생각을 남기고 싶나요?',
        options: cards.map(({ value, label }) => ({ value, label, kind: 'branch', selected: attempt.choices.includes(value) })),
        boardLabel: '나의 관심 탐험 지도',
        board: [
          { label: interest?.label || '관심 고르기', state: count > 0 ? 'done' : 'current' },
          { label: count > 1 ? labelFor(interest.experiences, attempt.choices[1]) : '탐색 길 고르기', state: count > 1 ? 'done' : count === 1 ? 'current' : 'waiting' },
          { label: count > 2 ? labelFor(game.reflections, attempt.choices[2]) : '생각 남기기', state: count > 2 ? 'done' : count === 2 ? 'current' : 'waiting' },
        ],
      };
    }
    case 'sequence_memory': {
      const showPattern = attempt.phase === 'observe' || attempt.hintVisible || attempt.completed;
      return {
        prompt: attempt.phase === 'observe' ? '몸 → 마음 → 도전 → 몸. 충분히 살펴본 뒤 시작해요.' : attempt.completed ? '네 박자를 모두 연결했어요.' : `${count + 1}번째 박자를 눌러요. 헷갈리면 리듬 힌트를 펼쳐도 좋아요.`,
        options: attempt.phase === 'observe'
          ? [{ value: 'ready', label: '살펴봤어요 · 리듬 시작', kind: 'confirm' }]
          : [...game.cards.map((card) => ({ ...card, kind: 'rhythm' })), { value: 'hint', label: attempt.hintVisible ? '리듬 힌트 접기' : '리듬 힌트 펼치기', kind: 'hint' }],
        boardLabel: showPattern ? '따라 누를 리듬' : '내가 연결한 리듬',
        board: game.sequence.map((value, index) => ({ label: showPattern || index < count ? `${index + 1}. ${labelFor(game.cards, value)}` : `${index + 1}. ?`, state: index < count ? 'done' : index === count ? 'current' : 'waiting' })),
      };
    }
    case 'match': {
      const pending = game.pairs.find(({ value }) => value === attempt.pending);
      return {
        prompt: pending ? `“${pending.left}”과 이어질 가상 활동 카드를 골라요. 다른 공간으로 바꿔 골라도 돼요.` : '먼저 공간 카드 하나를 고른 뒤, 어울리는 활동 카드와 연결해요.',
        options: [
          ...game.pairs.map((pair) => ({ value: `room:${pair.value}`, label: `공간 · ${pair.left}`, kind: 'room', selected: attempt.pending === pair.value || attempt.choices.includes(pair.value), disabled: attempt.choices.includes(pair.value) })),
          ...game.rightOrder.map((value) => { const pair = game.pairs.find((item) => item.value === value); return { value: `activity:${value}`, label: `활동 · ${pair.right}`, kind: 'activity', selected: attempt.choices.includes(value), disabled: !pending || attempt.choices.includes(value) }; }),
        ],
        boardLabel: '내가 만든 연결',
        board: attempt.choices.map((value) => { const pair = game.pairs.find((item) => item.value === value); return { label: `${pair.left} ↔ ${pair.right}`, state: 'done' }; }),
      };
    }
    case 'route': {
      const node = game.nodes[attempt.node];
      return {
        prompt: node?.prompt || '도움으로 이어지는 길을 완성했어요.',
        options: (node?.choices || []).map(({ value, label }) => ({ value, label, kind: 'path' })),
        boardLabel: '가상의 도움 경로 · 실제 지도 아님',
        board: [{ label: game.nodes.start.label, state: 'done' }, ...attempt.choices.map((value) => ({ label: game.nodes[value]?.label || '혼자만 안고 있지 않기', state: 'done' }))],
      };
    }
    default: return { prompt: '', options: [], boardLabel: '', board: [] };
  }
}

/**
 * DOM-neutral rendering model. Render options as native buttons using textContent;
 * disabled is real disabled, selected can be aria-pressed, feedback aria-live=polite.
 * Each option ID contains the current revision so queued double-clicks and stale
 * buttons cannot advance a later step. Pass option.id, not its label or raw value.
 */
export function getStageView(state, id) {
  if (!isKnownStage(id)) return null;
  const game = STAGE_GAMES[id];
  const attempt = attemptFor(state, id);
  const content = viewContent(game, attempt);
  const total = totalSteps(game);
  const step = Math.min(attempt.choices.length, total);
  return {
    id, title: game.title, type: game.type,
    instructions: game.instructions, fictionNote: game.fictionNote,
    factLabel: game.factLabel, fact: game.fact, fictionLabel: game.fictionLabel,
    source: { ...game.source }, sourceURL: game.sourceURL,
    sources: game.sources.map((source) => ({ ...source })),
    dateNote: game.dateNote, caution: game.caution,
    ...content,
    options: content.options.map(({ value, ...option }) => ({
      ...option,
      id: `${id}:${attempt.revision}:${value}`,
      value,
      disabled: Boolean(attempt.completed || option.disabled),
      selected: Boolean(option.selected),
    })),
    feedback: attempt.feedback,
    status: attempt.status,
    feedbackTone: attempt.status === 'incorrect' ? 'gentle' : attempt.completed ? 'success' : 'neutral',
    completed: attempt.completed,
    earned: isStageCompleted(state, id),
    step, totalSteps: total,
    progressLabel: `${step} / ${total}`,
  };
}

const incorrect = (attempt, text) => ({ ...attempt, feedback: `괜찮아요. ${text} 다시 골라도 돼요.`, status: 'incorrect' });
const progress = (attempt, choices, text = '좋아요! 다음 조각을 이어 보세요.') => ({ ...attempt, choices, feedback: text, status: 'correct' });

function reduceChoice(game, attempt, value) {
  const count = attempt.choices.length;
  switch (game.type) {
    case 'fill_slots': {
      const slot = game.slots[count];
      return value === slot.answer ? progress(attempt, [...attempt.choices, value], `${slot.label} 칸을 채웠어요.`) : incorrect(attempt, slot.hint);
    }
    case 'order': return value === game.order[count]
      ? progress(attempt, [...attempt.choices, value], `${count + 1}번째 카드를 연결했어요.`)
      : incorrect(attempt, '위에 적힌 가상 이야기를 읽고 다음에 일어난 일을 찾아보세요.');
    case 'collect': return game.cards.find((card) => card.value === value).correct
      ? progress(attempt, [...attempt.choices, value], '독서 소식 책갈피를 찾았어요. 순서와 상관없이 더 찾아봐요.')
      : incorrect(attempt, '그 카드는 게임을 위해 만든 가상 소식이에요. 독서모임·독서챌린지·독서의 달을 찾아보세요.');
    case 'proposal_builder': return progress(attempt, [...attempt.choices, value], value === 'confirm' ? '' : '선택을 제안 카드에 담았어요.');
    case 'branch_choice': return progress(attempt, [...attempt.choices, value], '나의 관심 길에 선택을 남겼어요. 다른 선택도 모두 괜찮아요.');
    case 'sequence_memory': {
      if (value === 'ready') return { ...attempt, phase: 'play', feedback: '천천히 한 박자씩 눌러요. 필요하면 힌트를 다시 볼 수 있어요.', status: 'progress' };
      if (value === 'hint') return { ...attempt, hintVisible: !attempt.hintVisible, feedback: attempt.hintVisible ? '힌트를 접었어요. 지금까지 연결한 리듬은 남아 있어요.' : '몸 → 마음 → 도전 → 몸. 보고 따라 눌러도 괜찮아요.', status: 'progress' };
      return value === game.sequence[count]
        ? progress(attempt, [...attempt.choices, value], `${count + 1}번째 박자를 연결했어요.`)
        : incorrect(attempt, `지금은 ${count + 1}번째 박자예요. 리듬 힌트를 펼쳐 확인할 수 있어요. 연결한 박자는 그대로 남아요.`);
    }
    case 'match': {
      const [kind, pair] = value.split(':');
      if (kind === 'room') return { ...attempt, pending: pair, feedback: '이 공간과 연결할 가상 활동 카드를 골라요.', status: 'progress' };
      if (pair !== attempt.pending) return incorrect(attempt, '고른 공간의 이름과 활동을 다시 살펴보세요. 이미 연결한 쌍은 그대로 남아요.');
      return { ...progress(attempt, [...attempt.choices, pair], '공간과 활동 한 쌍을 연결했어요.'), pending: null };
    }
    case 'route': {
      const choice = game.nodes[attempt.node].choices.find((item) => item.value === value);
      if (!choice.next) return incorrect(attempt, choice.hint);
      return { ...progress(attempt, [...attempt.choices, choice.next], '도움으로 이어지는 다음 발판에 도착했어요.'), node: choice.next };
    }
    default: return attempt;
  }
}

/** Immutable reducer. Unknown, disabled, completed, or stale choices are no-ops. */
export function chooseStageOption(state, id, optionId) {
  if (!isKnownStage(id) || typeof optionId !== 'string') return state;
  const view = getStageView(state, id);
  const option = view.options.find((item) => item.id === optionId);
  if (!option || option.disabled || view.completed) return state;
  const game = STAGE_GAMES[id];
  const previous = attemptFor(state, id);
  let attempt = reduceChoice(game, previous, option.value);
  if (attempt === previous) return state;
  const completed = attempt.choices.length === totalSteps(game);
  attempt = { ...attempt, revision: previous.revision + 1, completed };
  if (completed) attempt = { ...attempt, feedback: game.success, status: 'completed' };
  const completedIds = completed && !isStageCompleted(state, id)
    ? [...state.completedIds, id]
    : state.completedIds;
  return { ...state, stages: { ...state.stages, [id]: attempt }, completedIds };
}

/** Optional replay clears only the current attempt, not earned tour completion. */
export function resetStage(state, id) {
  if (!isKnownStage(id) || !owns(state?.stages, id)) return state;
  // Keep a monotonically increasing revision even when the visible attempt is
  // cleared: a queued click from before Replay must never answer the new game.
  const attempt = attemptFor(state, id);
  const stages = { ...state.stages, [id]: { ...initialAttempt(), revision: attempt.revision + 1 } };
  return { ...state, stages };
}

/** Full restart clears all attempts and all completion, leaving old state intact. */
export function resetAllStages(state) {
  if (!state) return createStageState();
  const stages = Object.fromEntries(STAGE_IDS.map((id) => [id, { ...initialAttempt(), revision: attemptFor(state, id).revision + 1 }]));
  return { stages, completedIds: [] };
}
