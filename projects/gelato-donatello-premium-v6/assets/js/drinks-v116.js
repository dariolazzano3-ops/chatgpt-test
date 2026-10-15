/* V118: one composited milk circuit = one true lap. Switch only after
   two 'animationiteration' events, i.e. at the 12 o'clock switch point.
   The three flavor buttons keep fixed screen positions for smooth UX. */
function initGelatoShakeWheel() {
  const section = document.querySelector('[data-shake-showcase]');
  if (!section) return;

  const controls = [...section.querySelectorAll('[data-shake-slot]')];
  const frames = [...section.querySelectorAll('[data-shake-frame]')];
  const title = section.querySelector('[data-active-shake-name]');
  const flow = section.querySelector('.dr118-milk-flow');
  const names = ['Erdbeer-Shake', 'Schoko-Shake', 'Vanille-Shake'];
  const shortNames = ['Erdbeer', 'Schoko', 'Vanille'];
  // Source-photo IDs stay stable: Erdbeer=0, Schoko=1, Vanille=2.
  const order = [0, 2, 1];
  if (controls.length !== 3 || frames.length !== 3 || !title || !flow) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0;
  let completedLaps = 0;
  let visible = false;

  const setFlavor = (next) => {
    const active = order.indexOf(next);
    if (active < 0) return;
    selected = next;
    const positions = [next, order[(active + 1) % 3], order[(active + 2) % 3]];
    controls.forEach((button, slot) => {
      const flavor = positions[slot];
      const isCurrent = slot === 0;
      button.dataset.shakeIndex = String(flavor);
      button.dataset.flavor = shortNames[flavor].toLowerCase();
      button.querySelector('.dr118-choice-label').textContent = shortNames[flavor];
      button.classList.toggle('is-active', isCurrent);
      button.setAttribute('aria-pressed', String(isCurrent));
      button.setAttribute('aria-label',
        shortNames[flavor] + (isCurrent ? ', aktuelle Sorte' : ', auswählen'));
    });
    frames.forEach((frame, i) => {
      frame.classList.toggle('is-active', i === next);
      frame.setAttribute('aria-hidden', String(i !== next));
    });
    title.textContent = names[next];
  };

  const refreshMotion = () => {
    const running = visible && !document.hidden && !reduced.matches;
    section.classList.toggle('dr118-motion-on', running);
    flow.style.animationPlayState = running ? 'running' : 'paused';
  };

  flow.addEventListener('animationiteration', event => {
    if (event.animationName !== 'dr118-milk-circuit' ||
        !visible || document.hidden || reduced.matches) return;
    completedLaps += 1;
    if (completedLaps === 2) {
      completedLaps = 0;
      setFlavor(order[(order.indexOf(selected) + 1) % 3]);
    }
  });

  controls.forEach(button => {
    button.addEventListener('click', () => {
      const chosen = Number(button.dataset.shakeIndex);
      if (chosen === selected) return;
      setFlavor(chosen);
      completedLaps = 0;
      // Restart this two-lap sequence at the real 12 o'clock position.
      // WAAPI re-seeks the compositor animation without a layout reflow.
      const animation = flow.getAnimations().find(item =>
        item.animationName === 'dr118-milk-circuit');
      if (animation) animation.currentTime = 0;
      refreshMotion();
    });
  });

  setFlavor(0); // Static, readable without JavaScript.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      refreshMotion(); // Pauses in-place if the wheel is out of view.
    }, { threshold: 0.18 });
    observer.observe(section);
  } else {
    visible = true;
    refreshMotion();
  }
  document.addEventListener('visibilitychange', refreshMotion);
  if (reduced.addEventListener) reduced.addEventListener('change', refreshMotion);
  else if (reduced.addListener) reduced.addListener(refreshMotion);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGelatoShakeWheel, { once: true });
} else {
  initGelatoShakeWheel();
}
