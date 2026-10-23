/** Pure, JSON-serializable progress for the school's character-guided tour. */
const GUIDE_IDS = ['chiikawa', 'hachiware', 'usagi'];

/**
 * A stop is completed only after both visitStop and readStop have recorded it.
 * Input IDs are deduplicated in their original order; blank/non-string IDs are
 * discarded. The input array is never retained or mutated.
 */
export function createTourState(ids = [], guide = 'chiikawa') {
  const stopIds = [...new Set(
    (Array.isArray(ids) ? ids : []).filter(
      (id) => typeof id === 'string' && id.trim().length > 0,
    ),
  )];

  return {
    stopIds,
    guide: GUIDE_IDS.includes(guide) ? guide : 'chiikawa',
    visitedIds: [],
    readIds: [],
  };
}

/** Changing the guide never resets progress. No-op actions retain identity. */
export function selectGuide(state, guide) {
  if (!GUIDE_IDS.includes(guide) || guide === state.guide) return state;
  return { ...state, guide };
}

function recordStop(state, id, field) {
  if (!state.stopIds.includes(id) || state[field].includes(id)) return state;
  return { ...state, [field]: [...state[field], id] };
}

/** Call only when the player's position has reached the story stop. */
export function visitStop(state, id) {
  return recordStop(state, id, 'visitedIds');
}

/** Reading alone does not count as physically visiting the story stop. */
export function readStop(state, id) {
  return recordStop(state, id, 'readIds');
}

/** Start a fresh tour while retaining the selected guide and stop order. */
export function restartTour(state) {
  if (state.visitedIds.length === 0 && state.readIds.length === 0) return state;
  return { ...state, visitedIds: [], readIds: [] };
}

/**
 * Derive UI progress without mutating state. An empty tour is never done.
 * To show the farewell once per tour, react only to a false -> true change in
 * `done` between the previous and next state, not to every true observation.
 */
export function getProgress(state) {
  const visitedIds = new Set(state.visitedIds);
  const readIds = new Set(state.readIds);
  const completedIds = state.stopIds.filter(
    (id) => visitedIds.has(id) && readIds.has(id),
  );
  const total = state.stopIds.length;

  return {
    total,
    visited: state.stopIds.filter((id) => visitedIds.has(id)).length,
    read: state.stopIds.filter((id) => readIds.has(id)).length,
    completed: completedIds.length,
    completedIds,
    done: total > 0 && completedIds.length === total,
  };
}
