/* V72: Curated photo-matched colors for all 41 original Gelato Donatello photos.
 * Representative upper scoop pixels blended with ivory for readability.
 * These are photographic surface hues, not fruit-name or stock-color guesses.
 */
export const FLAVORS = [{"name":"Pistazie","src":"/assets/images/flavors/pistazie.webp","tone":"#eadfc2","glow":"#d4c294"},{"name":"Erdbeere","src":"/assets/images/flavors/erdbeere.webp","tone":"#f3d9cf","glow":"#e7bbaf"},{"name":"Zitrone","src":"/assets/images/flavors/zitrone.webp","tone":"#f5f3eb","glow":"#e8e3db"},{"name":"Schokolade","src":"/assets/images/flavors/schokolade.webp","tone":"#d5c0b2","glow":"#b1927e"},{"name":"Mango","src":"/assets/images/flavors/mango.webp","tone":"#fce5a4","glow":"#f4cf6b"},{"name":"Vanille","src":"/assets/images/flavors/vanille.webp","tone":"#f6efe0","glow":"#ece2c9"},{"name":"Açaí","src":"/assets/images/flavors/acai.webp","tone":"#c8b5b6","glow":"#9b7e83"},{"name":"After Eight","src":"/assets/images/flavors/after-eight.webp","tone":"#dee1d4","glow":"#bcc3b1"},{"name":"Amarena Crunchy","src":"/assets/images/flavors/amarena-crunchy.webp","tone":"#e4d1c7","glow":"#c4a296"},{"name":"Amarena Kirsch","src":"/assets/images/flavors/amarena-kirsch.webp","tone":"#f1e9e0","glow":"#e1d3c4"},{"name":"Banane","src":"/assets/images/flavors/banane.webp","tone":"#f2eadd","glow":"#e4d9c6"},{"name":"Blauer Engel","src":"/assets/images/flavors/blauer-engel.webp","tone":"#b8e1eb","glow":"#83c8de"},{"name":"Blond Brownie","src":"/assets/images/flavors/blond-brownie.webp","tone":"#f9eace","glow":"#eed3a7"},{"name":"Buttermilch Sanddorn","src":"/assets/images/flavors/buttermilch-sanddorn.webp","tone":"#f4ebdd","glow":"#e9d6b5"},{"name":"Cointreau","src":"/assets/images/flavors/cointreau.webp","tone":"#b9b1a8","glow":"#82786f"},{"name":"Cookies","src":"/assets/images/flavors/cookies.webp","tone":"#e4d6c2","glow":"#bda58f"},{"name":"Dark Chocolate","src":"/assets/images/flavors/dark-chocolate.webp","tone":"#c3b4ab","glow":"#957e73"},{"name":"Dragon Summer","src":"/assets/images/flavors/dragon-summer.webp","tone":"#dfadbb","glow":"#c2758c"},{"name":"Dubai-Eis","src":"/assets/images/flavors/dubai-eis.webp","tone":"#ebdcbd","glow":"#cdb28d"},{"name":"Guapa","src":"/assets/images/flavors/guapa.webp","tone":"#f4cab8","glow":"#eaa38b"},{"name":"Haselnuss","src":"/assets/images/flavors/haselnuss.webp","tone":"#ebe0cd","glow":"#d4c0a3"},{"name":"Himbeer","src":"/assets/images/flavors/himbeer.webp","tone":"#f0c2c3","glow":"#e1969b"},{"name":"Joghurt","src":"/assets/images/flavors/joghurt.webp","tone":"#f7f1e8","glow":"#ebe3d7"},{"name":"Lemon Crumble","src":"/assets/images/flavors/lemon-crumble.webp","tone":"#faefd3","glow":"#eeddb0"},{"name":"Malaga","src":"/assets/images/flavors/malaga.webp","tone":"#efe2ce","glow":"#dfcaaa"},{"name":"Mascarpone Pistazien","src":"/assets/images/flavors/mascarpone-pistazien.webp","tone":"#f3ecdb","glow":"#e5dabc"},{"name":"Melone","src":"/assets/images/flavors/melone.webp","tone":"#f8e7d1","glow":"#f1d4b1"},{"name":"Mocca","src":"/assets/images/flavors/mocca.webp","tone":"#ead8be","glow":"#d5b892"},{"name":"Mozart Praline","src":"/assets/images/flavors/mozart-praline.webp","tone":"#d7c8b8","glow":"#b19a85"},{"name":"Nutella","src":"/assets/images/flavors/nutella.webp","tone":"#dac9bc","glow":"#b59c8b"},{"name":"Orange Minze","src":"/assets/images/flavors/orange-minze.webp","tone":"#f6e5c2","glow":"#ecd099"},{"name":"Oreo Keks","src":"/assets/images/flavors/oreo-keks.webp","tone":"#dbd3c8","glow":"#b1a59a"},{"name":"Pokémon Party","src":"/assets/images/flavors/pokemon-party.webp","tone":"#f3cec6","glow":"#dc9c99"},{"name":"Quark Orange","src":"/assets/images/flavors/quark-orange.webp","tone":"#f2eadb","glow":"#e7d8bd"},{"name":"Raffaello","src":"/assets/images/flavors/raffaello.webp","tone":"#f6f1e7","glow":"#ede5d2"},{"name":"Siciliano","src":"/assets/images/flavors/siciliano.webp","tone":"#f2e5d1","glow":"#e6c8a3"},{"name":"Snickers","src":"/assets/images/flavors/snickers.webp","tone":"#e6d3bd","glow":"#c8a989"},{"name":"Stracciatella","src":"/assets/images/flavors/stracciatella.webp","tone":"#f1eade","glow":"#e0d6c1"},{"name":"Strawberry Matcha","src":"/assets/images/flavors/strawberry-matcha.webp","tone":"#e4d9bf","glow":"#cdb18c"},{"name":"Yogo Twist","src":"/assets/images/flavors/yogo-twist.webp","tone":"#f3e7dc","glow":"#e7d2c5"},{"name":"Zuppa Inglese","src":"/assets/images/flavors/zuppa-inglese.webp","tone":"#f5ebd9","glow":"#e8d7be"}];

// Lightweight ambient flavor carousel: uses only existing photographs.
// Auto advances every 2s when in view; no tracking or external calls.
export function initHeroFlavors() {
  const hero = document.querySelector('[data-hero-flavors]');
  if (!hero || FLAVORS.length === 0) return;

  const visual = hero.querySelector('.v6-hero__visual');
  const photos = [...hero.querySelectorAll('[data-flavor-photo]')];
  const nameEl = hero.querySelector('[data-flavor-name]');
  if (!visual || photos.length !== 2 || !nameEl) return;

  const INTERVAL = 3500;
  const MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;
  let activePhoto = 0;
  const paused = MOTION.matches;
  let visible = true;
  let timer = null;
  let pending = false;
  let serial = 0;
  let gestureStart = null;
  const cache = new Map();

  function preload(index) {
    const key = (index + FLAVORS.length) % FLAVORS.length;
    if (cache.has(key)) return cache.get(key);
    const flavor = FLAVORS[key];
    const ready = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = flavor.src;
    });
    cache.set(key, ready);
    return ready;
  }

  function stopTimer() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }
  function schedule(delay = INTERVAL) {
    stopTimer();
    if (paused || !visible || document.hidden || pending) return;
    timer = window.setTimeout(() => {
      timer = null;
      goTo(activeIndex + 1, false);
    }, delay);
  }

  function applyTone(flavor) {
    hero.style.setProperty('--hero-tone', flavor.tone);
    hero.style.setProperty('--hero-glow', flavor.glow);
  }
  function announce(index) {
    const item = FLAVORS[index];
    nameEl.textContent = item.name;
    applyTone(item);
  }

  async function goTo(index, manual = true) {
    const target = (index + FLAVORS.length) % FLAVORS.length;
    if (manual) stopTimer();
    if (target === activeIndex && !pending) {
      if (manual) schedule(INTERVAL);
      return;
    }
    if (pending) return;
    pending = true;
    stopTimer();
    const token = ++serial;
    const loaded = await preload(target);
    if (token !== serial) return;
    pending = false;
    if (!loaded) {
      // Keep the previous photo rather than exposing a broken / blank frame.
      if (!manual) schedule(INTERVAL * 2);
      else schedule(INTERVAL);
      return;
    }
    const flavor = FLAVORS[target];
    const incoming = 1 - activePhoto;
    photos[incoming].src = flavor.src;
    photos[incoming].alt = 'Eissorte ' + flavor.name + ' von Gelato Donatello';
    photos[incoming].setAttribute('aria-hidden', 'false');
    photos[activePhoto].alt = '';
    photos[activePhoto].setAttribute('aria-hidden', 'true');
    photos[incoming].classList.add('is-active');
    photos[activePhoto].classList.remove('is-active');
    activePhoto = incoming;
    activeIndex = target;
    announce(target);
    preload(target + 1);
    schedule(INTERVAL);
  }

  // Swipe only for mostly horizontal gestures. Native vertical page scroll stays enabled.
  visual.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch || event.target.closest('a,button')) return;
    gestureStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  visual.addEventListener('touchend', (event) => {
    if (!gestureStart) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - gestureStart.x;
    const dy = point.clientY - gestureStart.y;
    gestureStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4)
      goTo(activeIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });
  visual.addEventListener('touchcancel', () => { gestureStart = null; }, { passive: true });

  hero.addEventListener('mouseenter', stopTimer);
  hero.addEventListener('mouseleave', () => schedule());
  hero.addEventListener('focusin', stopTimer);
  hero.addEventListener('focusout', (event) => {
    if (!hero.contains(event.relatedTarget)) schedule(INTERVAL);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer();
    else schedule();
  });
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) schedule();
      else stopTimer();
    }, { threshold: 0.15 });
    observer.observe(hero);
  }

  announce(0);
  preload(1);
  schedule();
}
