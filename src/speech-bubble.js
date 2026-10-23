const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hidden = () => ({ visible: false, x: 0, y: 0, tailX: 0, placement: 'above' });

/**
 * Position a measured bubble around a projected head, in viewport-local pixels.
 * NDC uses the WebGL convention: x/y/z in [-1, 1], with positive y upward.
 * The caller supplies inFront separately because projection alone cannot reject
 * a head behind the camera. Insets reserve space for UI and mobile safe areas.
 */
export function positionSpeechBubble(options = {}) {
  const {
    ndc, inFront, width, height, bubbleWidth, bubbleHeight,
    insets = {}, gap = 18,
  } = options ?? {};
  if (!ndc || !inFront || ![ndc.x, ndc.y, ndc.z].every(Number.isFinite)
    || [ndc.x, ndc.y, ndc.z].some(value => value < -1 || value > 1)
    || ![width, height, bubbleWidth, bubbleHeight].every(value => Number.isFinite(value) && value > 0)
    || !Number.isFinite(gap) || gap < 0 || !insets) return hidden();

  const { top = 0, right = 0, bottom = 0, left = 0 } = insets;
  if (![top, right, bottom, left].every(value => Number.isFinite(value) && value >= 0)) return hidden();
  const maxX = width - right - bubbleWidth;
  const maxY = height - bottom - bubbleHeight;
  // There is no valid contained position for a bubble larger than the safe area.
  // Hide until the caller remeasures/resizes it rather than leak it off-screen.
  if (maxX < left || maxY < top) return hidden();

  const anchorX = (ndc.x + 1) / 2 * width;
  const anchorY = (1 - ndc.y) / 2 * height;
  const aboveY = anchorY - gap - bubbleHeight;
  const belowY = anchorY + gap;
  const fits = y => y >= top && y <= maxY;
  const placement = !fits(aboveY) && fits(belowY) ? 'below' : 'above';
  const x = clamp(anchorX - bubbleWidth / 2, left, maxX);
  const y = clamp(placement === 'below' ? belowY : aboveY, top, maxY);
  // Extremely narrow bubbles cannot accommodate two 12px tail margins.
  const tailMargin = Math.min(12, bubbleWidth / 2);
  const tailX = clamp(anchorX - x, tailMargin, bubbleWidth - tailMargin);
  return { visible: true, x, y, tailX, placement };
}
