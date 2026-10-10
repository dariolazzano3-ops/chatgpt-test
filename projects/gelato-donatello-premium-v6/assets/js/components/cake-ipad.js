/**
 * Progressive, native-scroll cake carousel. Touch swipes work without JS;
 * JavaScript only synchronizes arrows, dots, keyboard and the counter.
 * No autoplay, external calls or additional providers.
 */
export function initCakeIpad() {
  const tablet = document.querySelector('[data-component="cake-ipad"]');
  if (!tablet) return;

  const viewport = tablet.querySelector('.v6-ipad__viewport');
  const slides = [...tablet.querySelectorAll('.v6-ipad__slide')];
  const dots = [...tablet.querySelectorAll('[data-ipad-dot]')];
  const previous = tablet.querySelector('[data-ipad-prev]');
  const next = tablet.querySelector('[data-ipad-next]');
  const count = tablet.querySelector('.v6-ipad__counter');
  if (!viewport || slides.length === 0 || slides.length !== dots.length || !previous || !next || !count) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let frame = null;

  const slideLeft = (slide) =>
    slide.getBoundingClientRect().left - viewport.getBoundingClientRect().left
    + viewport.scrollLeft - (viewport.clientWidth - slide.clientWidth) / 2;

  const setActive = (index) => {
    if (active === index && count.textContent === String(index + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0')) return;
    active = index;
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    count.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
  };

  const navigate = (index) => {
    const target = (index + slides.length) % slides.length;
    setActive(target);
    viewport.scrollTo({ left: slideLeft(slides[target]), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };

  const syncScroll = () => {
    frame = null;
    const middle = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - middle);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    setActive(best);
  };

  previous.addEventListener('click', () => navigate(active - 1));
  next.addEventListener('click', () => navigate(active + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => navigate(index)));

  viewport.addEventListener('scroll', () => {
    if (frame == null) frame = requestAnimationFrame(syncScroll);
  }, { passive: true });

  viewport.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    navigate(active + (event.key === 'ArrowRight' ? 1 : -1));
  });

  window.addEventListener('resize', syncScroll, { passive: true });
  syncScroll();
}
