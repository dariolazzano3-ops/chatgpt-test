import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initHeroFlavors } from '../assets/js/components/hero-flavors.js';

function setup({ reducedMotion = false } = {}) {
  const timerJobs = new Map();
  const listeners = new Map();
  let nextTimerId = 0;
  let observer = null;

  function element() {
    return {
      attrs: {},
      events: {},
      textContent: '',
      title: '',
      src: '',
      alt: '',
      classList: {
        set: new Set(),
        add(key) { this.set.add(key); },
        remove(key) { this.set.delete(key); },
        contains(key) { return this.set.has(key); },
      },
      addEventListener(event, callback) { this.events[event] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) { return this.attrs[key]; },
    };
  }
  const photos = [element(), element()];
  photos[0].classList.add('is-active');
  photos[0].src = '/assets/images/flavors/pistazie.webp';
  const photoVisual = element();
  const name = element();
  const root = element();
  root.style = {
    values: new Map(),
    setProperty(key, value) { this.values.set(key, value); },
  };
  root.contains = () => false;
  root.querySelector = (key) => {
    const map = {
      '.v6-hero__visual': photoVisual,
      '[data-flavor-name]': name,
    };
    return map[key] ?? null;
  };
  root.querySelectorAll = (key) => key === '[data-flavor-photo]' ? photos : [];

  const old = { document: globalThis.document, window: globalThis.window, Image: globalThis.Image, IntersectionObserver: globalThis.IntersectionObserver };
  globalThis.document = {
    hidden: false,
    querySelector(key) { return key === '[data-hero-flavors]' ? root : null; },
    addEventListener(key, fn) { listeners.set(key, fn); },
  };
  globalThis.window = {
    matchMedia() { return { matches: reducedMotion }; },
    setTimeout(callback, delay) {
      assert.ok(delay >= 2000, 'timer never faster than two seconds');
      const id = ++nextTimerId;
      timerJobs.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timerJobs.delete(id); },
  };
  globalThis.Image = class MockImage {
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
    get src() { return this._src; }
  };
  globalThis.IntersectionObserver = class MockObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(el) { assert.equal(el, root); }
  };

  async function fireNextTimer() {
    assert.equal(timerJobs.size, 1, 'only one pending timer');
    const [id, { callback, delay }] = [...timerJobs.entries()][0];
    timerJobs.delete(id);
    callback();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    return delay;
  }
  async function flush() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
  return { old, root, photoVisual, photos, name, listeners, timerJobs, fireNextTimer, flush, get observer() { return observer; }, restore() { Object.assign(globalThis, old); } };
}

test('41-photo slideshow rotates at 2s with synchronized soft ambient colors and no controls', async () => {
  const e = setup();
  try {
    initHeroFlavors();
    assert.equal(e.name.textContent, 'Pistazie');
    assert.equal(e.root.style.values.get('--hero-tone'), '#b9c5a8');
    assert.equal(e.timerJobs.size, 1);
    assert.equal(await e.fireNextTimer(), 2000);
    assert.equal(e.name.textContent, 'Erdbeere');
    assert.equal(e.root.style.values.get('--hero-tone'), '#dfbbb4');
    assert.equal(e.photos[1].classList.contains('is-active'), true);
    assert.equal(e.photos[1].src, '/assets/images/flavors/erdbeere.webp');
    assert.equal(e.photos[1].attrs['aria-hidden'], 'false');
    assert.equal(e.photos[0].attrs['aria-hidden'], 'true');
    assert.equal(await e.fireNextTimer(), 2000);
    assert.equal(e.name.textContent, 'Zitrone');
    assert.equal(e.root.style.values.get('--hero-tone'), '#e4d8ab');
    assert.equal(e.photos.filter(p => p.classList.contains('is-active')).length, 1);
    // Cycling through every flavor eventually returns to the first picture.
    for (let i = 0; i < 39; i++) await e.fireNextTimer();
    assert.equal(e.name.textContent, 'Pistazie');
    assert.equal(e.photos.filter(p => p.classList.contains('is-active')).length, 1);
  } finally { e.restore(); }
});

test('swipes change flavors without intercepting vertical scroll, and offscreen + hidden stop autoplay', async () => {
  const e = setup();
  try {
    initHeroFlavors();
    const visual = e.photoVisual;
    const target = { closest() { return null; } };
    visual.events.touchstart({ target, touches: [{ clientX: 200, clientY: 250 }] });
    visual.events.touchend({ changedTouches: [{ clientX: 100, clientY: 252 }] });
    await e.flush();
    assert.equal(e.name.textContent, 'Erdbeere');
    visual.events.touchstart({ target, touches: [{ clientX: 170, clientY: 200 }] });
    visual.events.touchend({ changedTouches: [{ clientX: 165, clientY: 400 }] });
    await e.flush();
    assert.equal(e.name.textContent, 'Erdbeere');

    e.observer.callback([{ isIntersecting: false }]);
    assert.equal(e.timerJobs.size, 0);
    e.observer.callback([{ isIntersecting: true }]);
    assert.equal(e.timerJobs.size, 1);
    globalThis.document.hidden = true;
    e.listeners.get('visibilitychange')();
    assert.equal(e.timerJobs.size, 0);
    globalThis.document.hidden = false;
    e.listeners.get('visibilitychange')();
    assert.equal(e.timerJobs.size, 1);
  } finally { e.restore(); }
});

test('reduced-motion users see a stationary hero, but can still swipe manually', async () => {
  const e = setup({ reducedMotion: true });
  try {
    initHeroFlavors();
    assert.equal(e.name.textContent, 'Pistazie');
    assert.equal(e.timerJobs.size, 0);
    const target = { closest() { return null; } };
    e.photoVisual.events.touchstart({ target, touches: [{ clientX: 200, clientY: 150 }] });
    e.photoVisual.events.touchend({ changedTouches: [{ clientX: 100, clientY: 150 }] });
    await e.flush();
    assert.equal(e.name.textContent, 'Erdbeere');
    assert.equal(e.timerJobs.size, 0);
  } finally { e.restore(); }
});
