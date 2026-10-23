// Optional exploration keepsakes, not money, purchases, or a requirement for
// completing the eight-stop school tour. State belongs to the whole walk, not
// to an individual character, so switching friends must retain the same array.
// Each spot has a collision-safe approach from the exterior navigation graph.
export const COIN_SPOTS = Object.freeze([
  { id: 'field-side', x: 39, z: 13 },
  { id: 'field-east', x: 52, z: 25 },
  { id: 'field-north', x: 40, z: -29 },
  { id: 'north-corner', x: 18, z: -46 },
  { id: 'walkway-side', x: 15, z: -31 },
  { id: 'south-east', x: 19, z: 47 },
  { id: 'south-garden', x: -11, z: 46 },
  { id: 'annex-side', x: -27, z: 46 },
  { id: 'garden-corner', x: -26, z: 17 },
  { id: 'school-front', x: -26, z: 10 },
].map(Object.freeze));

const COIN_IDS = new Set(COIN_SPOTS.map(coin => coin.id));
const DEFAULT_RADIUS = 2.3;

/** JSON-serializable collected IDs; deliberately separate from tour progress. */
export function createCoinState() { return []; }
export function resetCoins() { return createCoinState(); }

function normalizeState(state) {
  if (!Array.isArray(state)) return [];
  const ids = [...new Set(state.filter(id => COIN_IDS.has(id)))];
  return ids.length === state.length && ids.every((id, i) => id === state[i]) ? state : ids;
}

/**
 * Collect only at the selected friend's world X/Z position. Inputs are never
 * mutated; revisits return no new IDs and retain the unchanged state identity.
 * `done` describes coins only, and must not gate the school-tour farewell.
 */
export function collectNearby(state, position, radius = DEFAULT_RADIUS) {
  const previous = normalizeState(state);
  const collected = new Set(previous);
  const distance = Number.isFinite(radius) ? Math.max(0, radius) : DEFAULT_RADIUS;
  const validPosition = Number.isFinite(position?.x) && Number.isFinite(position?.z);
  const newIds = validPosition ? COIN_SPOTS.filter(coin =>
    !collected.has(coin.id) && Math.hypot(position.x - coin.x, position.z - coin.z) <= distance,
  ).map(coin => coin.id) : [];
  const next = newIds.length ? [...previous, ...newIds] : previous;
  return { state: next, newIds, done: next.length === COIN_SPOTS.length };
}

/**
 * Ten low-poly keepsakes in a single draw call: one shared geometry/material.
 * Nearby coins gently shimmer and bob; there are no particles, lights, audio,
 * textures, shadow passes, or allocations of new scene objects during updates.
 * time is in seconds. Pass the walk's ID array and selected friend's position.
 */
export function createCoinVisuals(THREE) {
  const group = new THREE.Group();
  group.name = 'hidden-school-coins';
  const geometry = new THREE.CylinderGeometry(0.72, 0.72, 0.18, 16, 1);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: '#f2c35e', metalness: 0.55, roughness: 0.35,
    emissive: '#b87d19', emissiveIntensity: 0.08,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, COIN_SPOTS.length);
  mesh.name = 'optional-keepsake-coins';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // Only ten instances; keep one stable draw instead of rebuilding bounds as
  // coins disappear. Each instance is hidden with a zero-scale transform.
  mesh.frustumCulled = false;
  group.add(mesh);
  const transform = new THREE.Object3D();

  function update(time = 0, collectedIds = [], selectedPosition) {
    const t = Number.isFinite(time) ? time : 0;
    const collected = new Set(normalizeState(collectedIds));
    const hasPosition = Number.isFinite(selectedPosition?.x) && Number.isFinite(selectedPosition?.z);
    let visible = false;
    for (let i = 0; i < COIN_SPOTS.length; i++) {
      const coin = COIN_SPOTS[i];
      const hidden = collected.has(coin.id);
      const nearby = !hidden && hasPosition && Math.hypot(selectedPosition.x - coin.x, selectedPosition.z - coin.z) < 9;
      const phase = t * 1.7 + i * 1.4;
      const scale = hidden ? 0 : nearby ? 1 + Math.sin(phase) * 0.045 : 1;
      transform.position.set(coin.x, 1.1 + (nearby ? Math.sin(phase) * 0.09 : 0), coin.z);
      transform.rotation.set(0, nearby ? t * 0.65 + i * 0.7 : i * 0.7, 0);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      visible ||= !hidden;
    }
    mesh.visible = visible;
    mesh.instanceMatrix.needsUpdate = true;
  }

  update();
  return { group, update };
}
