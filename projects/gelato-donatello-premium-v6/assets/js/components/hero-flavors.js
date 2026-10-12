const FLAVORS = [{"name":"Pistazie","src":"/assets/images/flavors/pistazie.webp","tone":"#b9c5a8","glow":"#8fa66e"},{"name":"Erdbeere","src":"/assets/images/flavors/erdbeere.webp","tone":"#dfbbb4","glow":"#c97c7d"},{"name":"Zitrone","src":"/assets/images/flavors/zitrone.webp","tone":"#e4d8ab","glow":"#dfc16c"},{"name":"Schokolade","src":"/assets/images/flavors/schokolade.webp","tone":"#c9b5a6","glow":"#956d54"},{"name":"Mango","src":"/assets/images/flavors/mango.webp","tone":"#e5c9a3","glow":"#dba554"},{"name":"Vanille","src":"/assets/images/flavors/vanille.webp","tone":"#dfd7c1","glow":"#c8af89"},{"name":"Açaí","src":"/assets/images/flavors/acai.webp","tone":"#c6b3bf","glow":"#9f809f"},{"name":"After Eight","src":"/assets/images/flavors/after-eight.webp","tone":"#bed0bb","glow":"#83aa8c"},{"name":"Amarena Crunchy","src":"/assets/images/flavors/amarena-crunchy.webp","tone":"#d4b7b1","glow":"#b67e77"},{"name":"Amarena Kirsch","src":"/assets/images/flavors/amarena-kirsch.webp","tone":"#d5b0b4","glow":"#aa7080"},{"name":"Banane","src":"/assets/images/flavors/banane.webp","tone":"#e3d9b2","glow":"#cbb65f"},{"name":"Blauer Engel","src":"/assets/images/flavors/blauer-engel.webp","tone":"#c3d9da","glow":"#91bdce"},{"name":"Blond Brownie","src":"/assets/images/flavors/blond-brownie.webp","tone":"#d9c6ae","glow":"#c49b77"},{"name":"Buttermilch Sanddorn","src":"/assets/images/flavors/buttermilch-sanddorn.webp","tone":"#dfccb0","glow":"#d4ab72"},{"name":"Cointreau","src":"/assets/images/flavors/cointreau.webp","tone":"#dbc4ac","glow":"#cb9b71"},{"name":"Cookies","src":"/assets/images/flavors/cookies.webp","tone":"#cfc4b4","glow":"#9c8a79"},{"name":"Dark Chocolate","src":"/assets/images/flavors/dark-chocolate.webp","tone":"#baa69e","glow":"#86685b"},{"name":"Dragon Summer","src":"/assets/images/flavors/dragon-summer.webp","tone":"#d9bcb8","glow":"#c87d83"},{"name":"Dubai-Eis","src":"/assets/images/flavors/dubai-eis.webp","tone":"#c3c6ab","glow":"#a1ad74"},{"name":"Guapa","src":"/assets/images/flavors/guapa.webp","tone":"#d5b5b8","glow":"#bf879a"},{"name":"Haselnuss","src":"/assets/images/flavors/haselnuss.webp","tone":"#d1c1ab","glow":"#b39470"},{"name":"Himbeer","src":"/assets/images/flavors/himbeer.webp","tone":"#d6afb5","glow":"#ba7d91"},{"name":"Joghurt","src":"/assets/images/flavors/joghurt.webp","tone":"#d7d9ca","glow":"#adb3a4"},{"name":"Lemon Crumble","src":"/assets/images/flavors/lemon-crumble.webp","tone":"#e5d7b4","glow":"#cbb678"},{"name":"Malaga","src":"/assets/images/flavors/malaga.webp","tone":"#d6c3ab","glow":"#b89d7c"},{"name":"Mascarpone Pistazien","src":"/assets/images/flavors/mascarpone-pistazien.webp","tone":"#c3cbb5","glow":"#a6ae84"},{"name":"Melone","src":"/assets/images/flavors/melone.webp","tone":"#d9d7b8","glow":"#a7b687"},{"name":"Mocca","src":"/assets/images/flavors/mocca.webp","tone":"#c5b4a9","glow":"#927565"},{"name":"Mozart Praline","src":"/assets/images/flavors/mozart-praline.webp","tone":"#cfb9b0","glow":"#ae897d"},{"name":"Nutella","src":"/assets/images/flavors/nutella.webp","tone":"#c2ac9e","glow":"#8b715f"},{"name":"Orange Minze","src":"/assets/images/flavors/orange-minze.webp","tone":"#d6d2af","glow":"#a9b38b"},{"name":"Oreo Keks","src":"/assets/images/flavors/oreo-keks.webp","tone":"#c8c4bc","glow":"#98958f"},{"name":"Pokémon Party","src":"/assets/images/flavors/pokemon-party.webp","tone":"#d2c6c7","glow":"#b396ae"},{"name":"Quark Orange","src":"/assets/images/flavors/quark-orange.webp","tone":"#e4d0b6","glow":"#d4b18a"},{"name":"Raffaello","src":"/assets/images/flavors/raffaello.webp","tone":"#ded5c7","glow":"#c0ac99"},{"name":"Siciliano","src":"/assets/images/flavors/siciliano.webp","tone":"#d2c7b0","glow":"#b4ab81"},{"name":"Snickers","src":"/assets/images/flavors/snickers.webp","tone":"#cfb6a1","glow":"#ae886d"},{"name":"Stracciatella","src":"/assets/images/flavors/stracciatella.webp","tone":"#d6cabb","glow":"#aa9a91"},{"name":"Strawberry Matcha","src":"/assets/images/flavors/strawberry-matcha.webp","tone":"#c7c9aa","glow":"#adac82"},{"name":"Yogo Twist","src":"/assets/images/flavors/yogo-twist.webp","tone":"#d5c6be","glow":"#b1a3a4"},{"name":"Zuppa Inglese","src":"/assets/images/flavors/zuppa-inglese.webp","tone":"#d9c2bb","glow":"#c6a090"}];

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
