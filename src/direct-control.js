import { BUILDINGS, TREES } from './navigation.js';

export const CHARACTER_RADIUS = 1.2;
export const MAX_MOVE_DT = 0.05;
export const CAMPUS_BOUNDS = Object.freeze({ x1: -58, x2: 64, z1: -50, z2: 53 });
const EPSILON = 0.00001;
const TREE_RADIUS = 0.3;
const POST_RADIUS = 0.05;

// Derived from shelter() in howon-blender/build_school.py. Blender Y becomes -Z.
function shelterPosts(x, y1, y2, width = 2.8) {
  const ys = Array.from({ length: Math.floor((y2 - y1) / 3.5) + 1 }, (_, i) => y1 + i * 3.5);
  if (ys.at(-1) !== y2) ys.push(y2);
  return ys.flatMap(y => [x - width / 2, x + width / 2].map(px => Object.freeze({ x: px, z: -y, radius: POST_RADIUS })));
}
export const CANOPY_POSTS = Object.freeze([
  ...shelterPosts(3, -47, -14),
  ...shelterPosts(3, 0, 43),
  ...shelterPosts(-1, -10, -4, 5.2),
]);
// The stylized characters are taller than these low roofs at runtime. Reserve
// their full footprints, rather than letting a character's head cross the roof.
export const CANOPY_FOOTPRINTS = Object.freeze([
  Object.freeze({ x1: 1.6, x2: 4.4, z1: 14, z2: 47 }),
  Object.freeze({ x1: 1.6, x2: 4.4, z1: -43, z2: 0 }),
  Object.freeze({ x1: -3.6, x2: 1.6, z1: 4, z2: 10 }),
]);

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const limits = Object.freeze({
  x1: CAMPUS_BOUNDS.x1 + CHARACTER_RADIUS,
  x2: CAMPUS_BOUNDS.x2 - CHARACTER_RADIUS,
  z1: CAMPUS_BOUNDS.z1 + CHARACTER_RADIUS,
  z2: CAMPUS_BOUNDS.z2 - CHARACTER_RADIUS,
});
const clampPosition = p => ({ x: clamp(p.x, limits.x1, limits.x2), z: clamp(p.z, limits.z1, limits.z2) });
const inflateBox = b => ({
  x1: b.x1 - CHARACTER_RADIUS, x2: b.x2 + CHARACTER_RADIUS,
  z1: b.z1 - CHARACTER_RADIUS, z2: b.z2 + CHARACTER_RADIUS,
});
const campusBoxes = [...BUILDINGS, ...CANOPY_FOOTPRINTS].map(inflateBox);
const campusCircles = [
  ...TREES.map(([x, z]) => ({ x, z, radius: TREE_RADIUS + CHARACTER_RADIUS })),
  ...CANOPY_POSTS.map(p => ({ ...p, radius: p.radius + CHARACTER_RADIUS })),
];

function colliders(obstacles) {
  const boxes = [...campusBoxes], circles = [...campusCircles];
  for (const obstacle of Array.isArray(obstacles) ? obstacles : []) {
    if (!obstacle) continue;
    if (['x1', 'x2', 'z1', 'z2'].every(k => Number.isFinite(obstacle[k]))) {
      boxes.push(inflateBox(obstacle));
    } else if (Number.isFinite(obstacle.x) && Number.isFinite(obstacle.z)) {
      circles.push({ x: obstacle.x, z: obstacle.z, radius: CHARACTER_RADIUS + Math.max(0, finite(obstacle.radius, CHARACTER_RADIUS)) });
    }
  }
  return { boxes, circles };
}

// Recover gracefully if a newly selected actor starts just inside a collider.
function resolveOverlap(position, boxes, circles) {
  let p = clampPosition(position);
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const b of boxes) {
      if (p.x > b.x1 && p.x < b.x2 && p.z > b.z1 && p.z < b.z2) {
        const exits = [
          { distance: p.x - b.x1, x: b.x1 - EPSILON, z: p.z },
          { distance: b.x2 - p.x, x: b.x2 + EPSILON, z: p.z },
          { distance: p.z - b.z1, x: p.x, z: b.z1 - EPSILON },
          { distance: b.z2 - p.z, x: p.x, z: b.z2 + EPSILON },
        ].sort((a, b) => a.distance - b.distance);
        p = { x: exits[0].x, z: exits[0].z };
        changed = true;
      }
    }
    for (const c of circles) {
      const dx = p.x - c.x, dz = p.z - c.z, length = Math.hypot(dx, dz);
      if (length < c.radius - EPSILON) {
        const scale = (c.radius + EPSILON) / (length || 1);
        p = { x: c.x + (length ? dx * scale : c.radius + EPSILON), z: c.z + (length ? dz * scale : 0) };
        changed = true;
      }
    }
    p = clampPosition(p);
    if (!changed) break;
  }
  return p;
}

function sweepBox(p, d, b) {
  let enter = -Infinity, exit = Infinity, normal = null;
  for (const axis of ['x', 'z']) {
    const min = b[`${axis}1`], max = b[`${axis}2`];
    if (Math.abs(d[axis]) < 1e-12) {
      // A segment lying on a wall is allowed to slide along it.
      if (p[axis] <= min || p[axis] >= max) return null;
      continue;
    }
    const a = (min - p[axis]) / d[axis], end = (max - p[axis]) / d[axis];
    const near = Math.min(a, end), far = Math.max(a, end);
    if (near > enter) {
      enter = near;
      normal = axis === 'x' ? { x: d.x > 0 ? -1 : 1, z: 0 } : { x: 0, z: d.z > 0 ? -1 : 1 };
    }
    exit = Math.min(exit, far);
    if (enter > exit) return null;
  }
  return normal && enter >= -1e-12 && enter <= 1 && exit >= 0 ? { t: Math.max(0, enter), normal } : null;
}

function sweepCircle(p, d, c) {
  const ox = p.x - c.x, oz = p.z - c.z;
  const length = Math.hypot(d.x, d.z);
  if (!length) return null;
  // Unit-distance form avoids squaring a potentially large speed.
  const ux = d.x / length, uz = d.z / length;
  const toward = ox * ux + oz * uz;
  if (toward >= 0) return null;
  const discriminant = toward * toward - (ox * ox + oz * oz - c.radius * c.radius);
  if (discriminant < 0) return null;
  const distance = -toward - Math.sqrt(discriminant);
  if (distance < -EPSILON || distance > length) return null;
  const t = Math.max(0, distance / length);
  const nx = p.x + d.x * t - c.x, nz = p.z + d.z * t - c.z;
  const nLength = Math.hypot(nx, nz);
  if (!nLength) return null;
  const normal = { x: nx / nLength, z: nz / nLength };
  if (ux * normal.x + uz * normal.z >= -1e-10) return null;
  return { t, normal };
}

function firstCollision(p, d, boxes, circles) {
  let hit = null;
  const consider = candidate => {
    if (candidate && candidate.t >= 0 && candidate.t <= 1 && (!hit || candidate.t < hit.t)) hit = candidate;
  };
  for (const axis of ['x', 'z']) {
    if (d[axis] === 0) continue;
    const edge = d[axis] > 0 ? limits[`${axis}2`] : limits[`${axis}1`];
    consider({ t: (edge - p[axis]) / d[axis], normal: axis === 'x' ? { x: d.x > 0 ? -1 : 1, z: 0 } : { x: 0, z: d.z > 0 ? -1 : 1 } });
  }
  for (const box of boxes) consider(sweepBox(p, d, box));
  for (const circle of circles) consider(sweepCircle(p, d, circle));
  return hit;
}

/**
 * Move a character in world X/Z, sweeping its 1.2-unit footprint against campus
 * geometry. Additional obstacles are circles {x,z,radius} or boxes {x1,x2,z1,z2}.
 * Diagonal input is capped at unit length; analog magnitudes below 1 are kept.
 * dt is in seconds and capped at 50 ms to avoid jumps after suspended frames.
 * Inputs are never mutated. Sliding is continuous, so thin posts cannot tunnel.
 */
export function safeMove(position, vector, dt, speed, obstacles = []) {
  const { boxes, circles } = colliders(obstacles);
  let p = resolveOverlap({ x: finite(position?.x, 31), z: finite(position?.z, 20) }, boxes, circles);
  let x = finite(vector?.x), z = finite(vector?.z);
  const magnitude = Math.hypot(x, z);
  if (magnitude > 1) { x /= magnitude; z /= magnitude; }
  const elapsed = clamp(finite(dt), 0, MAX_MOVE_DT);
  const distance = Math.min(1e6, Math.max(0, finite(speed)) * elapsed);
  let d = { x: x * distance, z: z * distance };
  for (let pass = 0; pass < 8 && Math.hypot(d.x, d.z) > EPSILON; pass++) {
    const hit = firstCollision(p, d, boxes, circles);
    if (!hit) { p = { x: p.x + d.x, z: p.z + d.z }; break; }
    const length = Math.hypot(d.x, d.z);
    const travel = Math.max(0, hit.t - EPSILON / length);
    p = { x: p.x + d.x * travel, z: p.z + d.z * travel };
    d = { x: d.x * (1 - hit.t), z: d.z * (1 - hit.t) };
    const intoWall = Math.min(0, d.x * hit.normal.x + d.z * hit.normal.z);
    d.x -= intoWall * hit.normal.x;
    d.z -= intoWall * hit.normal.z;
  }
  return clampPosition(p);
}

const KEY_VECTORS = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const KEY_CODES = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD' };
const SHIFT_CODES = new Set(['ShiftLeft', 'ShiftRight']);
function inputCode(event) {
  if (KEY_VECTORS[event.code] || SHIFT_CODES.has(event.code)) return event.code;
  if (event.key === 'Shift') return event.location === 2 ? 'ShiftRight' : 'ShiftLeft';
  return KEY_CODES[event.key?.toLowerCase()] || event.key;
}
function editable(target) {
  return Boolean(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '') || target.closest?.('[contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"]')));
}

/**
 * Keyboard and pointer joystick input. The joystick knob should be CSS-centered.
 * isRunning() is the run intent (held Shift OR the mobile toggle), independent of
 * movement. toggleRunning(bool) changes only the toggle, retaining a joystick
 * drag; omit its argument to invert it. reset() clears every active input.
 */
export function createInputController({ element } = {}) {
  const doc = element?.ownerDocument || globalThis.document;
  const win = doc?.defaultView || globalThis.window;
  const knob = element?.querySelector?.('#joystick-knob');
  const keys = new Set();
  const heldShifts = new Set();
  const listeners = [];
  let pointerId = null, joystick = { x: 0, z: 0 }, runningToggle = false, destroyed = false;
  const originalTouchAction = element?.style.touchAction;
  const originalTransform = knob?.style.transform;
  const originallyActive = element?.classList.contains('active');
  const listen = (target, type, handler, options) => {
    target?.addEventListener(type, handler, options);
    listeners.push(() => target?.removeEventListener(type, handler, options));
  };
  const blocked = target => Boolean(doc?.hidden) || editable(target) || editable(doc?.activeElement) || Boolean(doc?.querySelector?.('dialog[open]'));
  const release = () => {
    const oldPointer = pointerId;
    pointerId = null;
    joystick = { x: 0, z: 0 };
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    element?.classList.toggle('active', false);
    if (oldPointer !== null) {
      try { if (element?.hasPointerCapture?.(oldPointer)) element.releasePointerCapture(oldPointer); } catch { /* Capture may already be released by the browser. */ }
    }
  };
  const reset = () => { keys.clear(); heldShifts.clear(); runningToggle = false; release(); };
  const isRunning = () => {
    if (destroyed) return false;
    if (blocked()) { reset(); return false; }
    return runningToggle || heldShifts.size > 0;
  };
  const movePointer = event => {
    const rect = element.getBoundingClientRect();
    const knobRect = knob?.getBoundingClientRect?.();
    const knobSize = Math.max(knobRect?.width || 32, knobRect?.height || 32);
    const radius = Math.max(12, (Math.min(rect.width, rect.height) - knobSize) / 2);
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let z = (event.clientY - rect.top - rect.height / 2) / radius;
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) { x /= magnitude; z /= magnitude; }
    if (knob) knob.style.transform = `translate(${x * radius}px, ${z * radius}px)`;
    const deadzone = 0.1, amount = Math.min(1, magnitude);
    const scale = amount > deadzone ? (amount - deadzone) / ((1 - deadzone) * amount) : 0;
    joystick = { x: x * scale, z: z * scale };
  };

  if (element) element.style.touchAction = 'none';
  listen(win, 'keydown', event => {
    const code = inputCode(event);
    const shift = SHIFT_CODES.has(code);
    if ((!KEY_VECTORS[code] && !shift) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (blocked(event.target)) { reset(); return; }
    // Do not cancel Shift itself: Shift+Tab and ordinary browser focus behavior
    // must keep working. Only movement keys consume their default action.
    if (shift) { heldShifts.add(code); return; }
    event.preventDefault();
    keys.add(code);
  });
  listen(win, 'keyup', event => {
    const code = inputCode(event);
    if (SHIFT_CODES.has(code)) { heldShifts.delete(code); return; }
    if (keys.delete(code) && !blocked(event.target)) event.preventDefault();
  });
  listen(win, 'blur', reset);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) reset(); });
  listen(doc, 'focusin', event => { if (blocked(event.target)) reset(); });
  listen(element, 'pointerdown', event => {
    // A touch on the run button can be the primary pointer. The first pointer
    // that actually reaches this joystick owns it, even if it is non-primary.
    if (pointerId !== null || (event.button !== undefined && event.button !== 0) || blocked(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    element.classList.toggle('active', true);
    try { element.setPointerCapture?.(pointerId); } catch { /* Window listeners also track uncaptured drags. */ }
    movePointer(event);
  });
  listen(win, 'pointermove', event => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (blocked(event.target)) { reset(); return; }
    event.preventDefault();
    movePointer(event);
  }, { passive: false });
  const endPointer = event => { if (pointerId !== null && event.pointerId === pointerId) release(); };
  const cancelPointer = event => { if (pointerId === null || event.pointerId === pointerId) reset(); };
  const losePointer = event => { if (pointerId !== null && event.pointerId === pointerId) reset(); };
  listen(win, 'pointerup', endPointer);
  listen(win, 'pointercancel', cancelPointer);
  listen(element, 'lostpointercapture', losePointer);

  return {
    isRunning,
    toggleRunning(enabled = !runningToggle) {
      if (destroyed) return false;
      if (blocked()) { reset(); return false; }
      runningToggle = Boolean(enabled);
      return isRunning();
    },
    reset() { if (!destroyed) reset(); },
    getVector() {
      if (destroyed) return { x: 0, z: 0 };
      if (blocked()) { reset(); return { x: 0, z: 0 }; }
      let x = joystick.x, z = joystick.z;
      // Duplicate aliases (W + Up) must not make one axis faster.
      x += Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      z += Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      const magnitude = Math.hypot(x, z);
      return magnitude > 1 ? { x: x / magnitude, z: z / magnitude } : { x, z };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      reset();
      for (const remove of listeners) remove();
      if (element) { element.style.touchAction = originalTouchAction; element.classList.toggle('active', Boolean(originallyActive)); }
      if (knob) knob.style.transform = originalTransform;
    },
  };
}
