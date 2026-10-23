/**
 * Exterior camera compositions for the project's approximate 3D school model.
 * These are virtual model views, not photographs or an accurate campus map.
 * Positions and targets use Three.js coordinates: x, y-up, z.
 */
export const GALLERY_VIEWS = Object.freeze([
  {
    id: 'overview',
    label: '학교 전경',
    description: '사진을 참고해 만든 3D 학교 모델의 전체 풍경입니다. 실제 사진이 아닙니다.',
    position: [98, 74, 118],
    target: [-4, 3, 5],
  },
  {
    id: 'facade',
    label: '학교 앞 풍경',
    description: '가상 카메라로 본관 외관과 앞마당을 바라보는 장면입니다.',
    position: [10, 28, 75],
    target: [-28, 8, 0],
  },
  {
    id: 'courtyard',
    label: '안뜰 내려다보기',
    description: '높은 시점에서 3D 모델의 안뜰과 건물 배치를 내려다봅니다.',
    position: [-15, 65, 5],
    target: [-30, 5, -17],
  },
  {
    id: 'field',
    label: '운동장 너머',
    description: '운동장 방향에서 학교 외관을 바라보는 가상 장면입니다.',
    position: [70, 35, 60],
    target: [-8, 7, 0],
  },
].map(view => Object.freeze({
  ...view,
  position: Object.freeze(view.position),
  target: Object.freeze(view.target),
})));

const wrapIndex = index => ((index % GALLERY_VIEWS.length) + GALLERY_VIEWS.length) % GALLERY_VIEWS.length;

/** Pure, serializable gallery state. The initial view is the complete campus. */
export function createGalleryState() {
  return { active: false, index: 0, snapshot: null };
}

/**
 * Store an independent copy of camera, characters, controls and tour progress.
 * Supply data, not renderer/DOM objects or functions. A repeated entry is a
 * no-op so it cannot replace the original return point with a gallery camera.
 */
export function enterGallery(state, snapshot = null) {
  if (state.active) return state;
  return { ...state, active: true, snapshot: structuredClone(snapshot) };
}

/**
 * Return { state, snapshot }; the latter is another independent copy to restore.
 * This module never writes into the caller's live camera or progress objects.
 * Leaving twice returns null on the second call, so old progress is not replayed.
 */
export function leaveGallery(state) {
  if (!state.active) return { state, snapshot: null };
  return {
    state: { ...state, active: false, snapshot: null },
    snapshot: structuredClone(state.snapshot),
  };
}

/** Valid integer indices wrap in both directions; invalid inputs are no-ops. */
export function selectGalleryView(state, index) {
  if (!Number.isSafeInteger(index)) return state;
  const nextIndex = wrapIndex(index);
  if (nextIndex === state.index) return state;
  return { ...state, index: nextIndex };
}

/** Advance or reverse without changing the captured walk or its progress. */
export function nextGalleryView(state, step = 1) {
  if (!Number.isSafeInteger(step)) return state;
  // Reduce the step before adding, avoiding overflow at safe integer bounds.
  return selectGalleryView(state, state.index + (step % GALLERY_VIEWS.length));
}
