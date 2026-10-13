// Real Gelato Donatello drink photography, including Orange Flip, formerly miscategorized as a cup.
const DRINKS = [
  { name: "Erdbeer-Shake", src: "/assets/images/drinks/erdbeer-shake.webp" },
  { name: "Vanille-Shake", src: "/assets/images/drinks/vanille-shake.webp" },
  { name: "Schoko-Shake", src: "/assets/images/drinks/schoko-shake.webp" },
  { name: "Orange Flip", src: "/assets/images/drinks/orange-flip.webp" },
  { name: "Eiskaffee", src: "/assets/images/drinks/eiskaffee.webp" },
  { name: "Eisschokolade", src: "/assets/images/drinks/eisschokolade.webp" }
];

const TICK_MS = 2000;

// Rotates only inside the visible Shakes & Drinks card. Other page slideshows are unaffected.
export function initDiscoveryDrinks() {
  const card = document.querySelector('[data-discovery-drinks]');
  if (!card || DRINKS.length < 2) return;

  const layers = [
    card.querySelector('[data-drink-layer="0"]'),
    card.querySelector('[data-drink-layer="1"]')
  ];
  if (layers.some((layer) => !layer)) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let index = 0;
  let activeLayer = 0;
  let timer = null;
  let busy = false;
  let queued = null;
  let focused = false;
  let sequence = 0;

  // The next photograph is warmed in advance, so the pulse doesn't reveal an empty layer.
  function warmNext() {
    const nextIndex = (index + 1) % DRINKS.length;
    if (queued?.index === nextIndex) return queued;
    const src = DRINKS[nextIndex].src;
    const img = new Image();
    img.decoding = 'async';
    const ready = new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = src;
    queued = { index: nextIndex, ready, img };
    return queued;
  }

  async function tick() {
    if (busy || !visible || document.hidden || focused || reduceMotion.matches) return;
    busy = true;
    const token = sequence;
    const image = warmNext();
    const loaded = await image.ready;
    if (token !== sequence || !visible || document.hidden || focused || reduceMotion.matches) {
      busy = false;
      return;
    }
    if (!loaded) {
      queued = null;
      busy = false;
      return; // Keep the previous, valid picture on a failed download.
    }

    const nextLayer = 1 - activeLayer;
    const incoming = layers[nextLayer];
    const outgoing = layers[activeLayer];
    incoming.src = DRINKS[image.index].src;
    try {
      if (typeof incoming.decode === 'function') await incoming.decode();
    } catch {
      queued = null;
      busy = false;
      return;
    }
    if (token !== sequence || !visible || document.hidden || focused || reduceMotion.matches) {
      busy = false;
      return;
    }
    outgoing.classList.remove('is-active', 'is-beating');
    incoming.classList.remove('is-beating');
    // Force a fresh heartbeat on every switch even when alternating the same two nodes.
    void incoming.offsetWidth;
    incoming.classList.add('is-active', 'is-beating');
    index = image.index;
    activeLayer = nextLayer;
    queued = null;
    warmNext();
    busy = false;
  }

  function stop() {
    sequence++;
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  }

  function sync() {
    const shouldPlay = visible && !document.hidden && !focused && !reduceMotion.matches;
    if (!shouldPlay) {
      stop();
      return;
    }
    if (timer === null) {
      warmNext();
      timer = window.setInterval(tick, TICK_MS);
    }
  }

  card.addEventListener('focusin', () => { focused = true; sync(); });
  card.addEventListener('focusout', (event) => {
    if (!card.contains(event.relatedTarget)) {
      focused = false;
      sync();
    }
  });
  document.addEventListener('visibilitychange', sync);
  if (typeof reduceMotion.addEventListener === 'function')
    reduceMotion.addEventListener('change', sync);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      visible = Boolean(entries[0]?.isIntersecting);
      sync();
    }, { threshold: 0.15 });
    observer.observe(card);
  } else {
    visible = true;
    sync();
  }
}
