// Existing, confirmed local Gelato Donatello Eisbecher photos.
// Adding additional original cups later only requires appending new entries here.
const FLAVORS = [
  { name: "fruechte becher", src: "/assets/images/cups/fruechte-becher.webp" },
  { name: "erdbeer becher", src: "/assets/images/cups/erdbeer-becher.webp" },
  { name: "amarena becher", src: "/assets/images/cups/amarena-becher.webp" },
  { name: "banana split", src: "/assets/images/cups/banana-split.webp" },
  { name: "after eight becher", src: "/assets/images/cups/after-eight-becher.webp" },
  { name: "biene maja", src: "/assets/images/cups/biene-maja.webp" },
  { name: "ananas becher", src: "/assets/images/cups/ananas-becher.webp" },
  { name: "gummibaeren becher", src: "/assets/images/cups/gummibaeren-becher.webp" },
  { name: "joghurt banane", src: "/assets/images/cups/joghurt-banane.webp" }
];

const TICK_MS = 2000;

// Rotates only inside the visible Eisbecher card. Other page slideshows are unaffected.
export function initDiscoveryCups() {
  const card = document.querySelector('[data-discovery-cups]');
  if (!card || FLAVORS.length < 2) return;

  const layers = [
    card.querySelector('[data-cup-layer="0"]'),
    card.querySelector('[data-cup-layer="1"]')
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
    const nextIndex = (index + 1) % FLAVORS.length;
    if (queued?.index === nextIndex) return queued;
    const src = FLAVORS[nextIndex].src;
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
    incoming.src = FLAVORS[image.index].src;
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
