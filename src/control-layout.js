// Bottom offsets for the central control stack. Hidden controls consume no lane.
export function controlStack(dockTop, gap, heights) {
  let bottom = dockTop;
  return Object.fromEntries(heights.map(([name, height]) => {
    if (height > 0) bottom += gap;
    const entry = [name, bottom];
    bottom += Math.max(0, height);
    return entry;
  }));
}
export function installControlLayout() {
  const app = document.querySelector('#app');
  const dock = app.querySelector('.toolbar');
  const lanes = [['walk', '.walk-mode'], ['interact', '#interact'], ['caption', '.view-label'], ['toast', '#toast']]
    .map(([name, selector]) => [name, app.querySelector(selector)]);
  let pending = false;
  const measure = () => {
    pending = false;
    if (innerWidth <= 700 || innerHeight <= 500 || (document.body.dataset.interior === 'true' && innerWidth <= 900)) return;
    const gap = Math.max(12, parseFloat(getComputedStyle(document.documentElement).fontSize));
    const heights = lanes.map(([name, element]) => [name, element.hidden || getComputedStyle(element).display === 'none' ? 0 : element.getBoundingClientRect().height]);
    const offsets = controlStack(innerHeight - dock.getBoundingClientRect().top, gap, heights);
    for (const [name, bottom] of Object.entries(offsets)) {
      const property = `--control-${name}-bottom`, value = `${bottom}px`;
      if (app.style.getPropertyValue(property) !== value) app.style.setProperty(property, value);
    }
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(measure); } };
  const resize = new ResizeObserver(schedule);
  [dock, ...lanes.map(([, element]) => element)].forEach(element => resize.observe(element));
  const visibility = new MutationObserver(schedule);
  [dock, ...lanes.map(([, element]) => element)].forEach(element => visibility.observe(element, { attributes: true, attributeFilter: ['hidden'] }));
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['data-interior', 'data-gallery', 'data-compact'] });
  window.addEventListener('resize', schedule);
  schedule();
}
