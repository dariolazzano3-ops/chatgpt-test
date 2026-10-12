/**
 * Gelato Donatello V13: stronger lockscreen-style photo depth.
 * Original owner-provided photograph only. No fake 360 or generated new angles.
 * Gyroscope data stays in the browser, never stored or transmitted.
 * iOS Safari requires requestPermission() during a user gesture. We trigger
 * that on the first natural interaction with the photo, never silently.
 */
export function initEventDepth() {
  const nodes = [...document.querySelectorAll('[data-event-depth-stage]')];
  if (!nodes.length) return;

  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = v => Math.max(-1, Math.min(1, v));
  const views = nodes.map(stage => ({
    stage,
    scene: stage.closest('[data-event-depth]'),
    x: 0, y: 0, pointerId: null, startX: 0, startY: 0, fromX: 0, fromY: 0
  }));

  function render(view, x, y) {
    // Respect the OS accessibility preference, including manual interactions.
    view.x = preference.matches ? 0 : clamp(x);
    view.y = preference.matches ? 0 : clamp(y);
    const css = view.stage.style;
    css.setProperty('--depth-yaw', (view.x * 16).toFixed(2) + 'deg');
    css.setProperty('--depth-pitch', (-view.y * 11).toFixed(2) + 'deg');
    css.setProperty('--depth-shift-x', (-view.x * 24).toFixed(2) + 'px');
    css.setProperty('--depth-shift-y', (-view.y * 17).toFixed(2) + 'px');
    css.setProperty('--depth-photo-x', (-view.x * 8).toFixed(2) + '%');
    css.setProperty('--depth-light-x', (50 + view.x * 27).toFixed(1) + '%');
    css.setProperty('--depth-light-y', (30 + view.y * 23).toFixed(1) + '%');
  }

  const sensorAvailable = typeof window.DeviceOrientationEvent !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || /iPhone|iPad|Android/i.test(navigator.userAgent));
  const sensorAllowed = () => sensorAvailable && !preference.matches;
  const requiresIosPermission = sensorAvailable &&
    typeof window.DeviceOrientationEvent.requestPermission === 'function';
  let sensorActive = false;
  let requested = false;
  let reference = null;
  let targetX = 0, targetY = 0, smoothX = 0, smoothY = 0;
  let raf = 0;

  function tick() {
    raf = 0;
    if (!sensorActive || preference.matches || document.hidden) return;
    smoothX += (targetX - smoothX) * .23;
    smoothY += (targetY - smoothY) * .23;
    views.forEach(view => {
      if (view.pointerId === null) render(view, smoothX, smoothY);
    });
    if (Math.abs(targetX - smoothX) + Math.abs(targetY - smoothY) > .003) {
      raf = window.requestAnimationFrame(tick);
    }
  }
  function schedule() {
    if (sensorActive && !raf && !document.hidden && !preference.matches) {
      raf = window.requestAnimationFrame(tick);
    }
  }
  function onOrientation(event) {
    if (!sensorActive || document.hidden || preference.matches ||
      !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!reference) {
      reference = { beta: event.beta, gamma: event.gamma };
      return;
    }
    const angle = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
    let horizontal = event.gamma - reference.gamma;
    let vertical = event.beta - reference.beta;
    if (angle === 90) [horizontal, vertical] = [vertical, -horizontal];
    else if (angle === 270) [horizontal, vertical] = [-vertical, horizontal];
    else if (angle === 180) [horizontal, vertical] = [-horizontal, -vertical];
    // A modest 11-degree device tilt now uses ~90% of the bigger range.
    targetX = clamp(horizontal / 11) * .91;
    targetY = clamp(vertical / 11) * .84;
    schedule();
  }
  function stopSensor() {
    sensorActive = false;
    reference = null;
    targetX = targetY = smoothX = smoothY = 0;
    window.removeEventListener('deviceorientation', onOrientation);
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    views.forEach(view => {
      view.scene?.classList.remove('is-gyro-active');
      if (view.pointerId === null) render(view, 0, 0);
    });
  }
  function startSensor() {
    if (!sensorAllowed() || sensorActive) return;
    sensorActive = true;
    reference = null;
    views.forEach(view => view.scene?.classList.add('is-gyro-active'));
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }
  function maybeRequestIosSensor() {
    if (!requiresIosPermission || !sensorAllowed() || requested) return;
    requested = true;
    let permission;
    // Called synchronously from a trusted pointerup/touchend/click gesture.
    try {
      permission = window.DeviceOrientationEvent.requestPermission();
    } catch (_) {
      return; // Safari denied access. Swipe/keyboard fallbacks still work.
    }
    Promise.resolve(permission).then(result => {
      if (result === 'granted') startSensor();
    }).catch(() => {});
  }

  // Android and other permissionless browsers may start without an extra button.
  // iOS instead waits for the viewer's first natural touch (browser requirement).
  if (sensorAllowed() && !requiresIosPermission) startSensor();
  const handlePreference = () => {
    if (preference.matches) {
      stopSensor();
      views.forEach(view => render(view, 0, 0));
    } else if (sensorAllowed() && !requiresIosPermission) {
      startSensor();
    }
  };
  preference.addEventListener?.('change', handlePreference);

  views.forEach(view => {
    const {stage, scene} = view;
    stage.addEventListener('pointerdown', e => {
      if (view.pointerId !== null || !e.isPrimary ||
        (e.pointerType === 'mouse' && e.button !== 0)) return;
      view.pointerId = e.pointerId;
      view.startX = e.clientX;
      view.startY = e.clientY;
      view.fromX = view.x;
      view.fromY = view.y;
      stage.classList.add('is-dragging');
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
      const rect = stage.getBoundingClientRect();
      if (view.pointerId === e.pointerId) {
        const dx = e.clientX - view.startX, dy = e.clientY - view.startY;
        render(view, view.fromX + dx / Math.max(rect.width * .50, 1),
          view.fromY + dy / Math.max(rect.height * .66, 1));
      } else if (view.pointerId === null && e.pointerType === 'mouse' &&
        !sensorActive && !preference.matches) {
        render(view, ((e.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 1.2,
          ((e.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 1.2);
      }
    });
    const release = e => {
      if (view.pointerId !== e.pointerId) return;
      view.pointerId = null;
      stage.classList.remove('is-dragging');
      if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      if (sensorActive) schedule();
    };
    stage.addEventListener('pointerup', e => {
      release(e);
      // iOS touch pointerup can count as user activation. No visible button.
      if (e.pointerType === 'touch' || e.pointerType === 'pen') maybeRequestIosSensor();
    });
    stage.addEventListener('touchend', maybeRequestIosSensor, {passive: true});
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', () => {
      view.pointerId = null;
      stage.classList.remove('is-dragging');
      if (sensorActive) schedule();
    });
    stage.addEventListener('pointerleave', e => {
      if (view.pointerId === null && e.pointerType === 'mouse' && !sensorActive &&
        !preference.matches) render(view, 0, 0);
    });
    stage.addEventListener('keydown', e => {
      const dirs = { ArrowLeft:[-.2,0], ArrowRight:[.2,0],
        ArrowUp:[0,-.2], ArrowDown:[0,.2], Home:[0,0] };
      if (!Object.hasOwn(dirs, e.key)) return;
      e.preventDefault();
      if (e.key === 'Home') render(view, 0, 0);
      else render(view, view.x + dirs[e.key][0], view.y + dirs[e.key][1]);
    });
    render(view, 0, 0);
  });

  document.addEventListener('visibilitychange', () => {
    if (!sensorActive) return;
    reference = null;
    if (document.hidden) {
      targetX = targetY = smoothX = smoothY = 0;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      views.forEach(view => { if (view.pointerId === null) render(view, 0, 0); });
    }
  });
  const dialog = document.querySelector('[data-event-depth-dialog]');
  const openButton = document.querySelector('[data-event-depth-open]');
  if (!dialog || !openButton || typeof dialog.showModal !== 'function') return;
  openButton.addEventListener('click', () => {
    // Opening the image is also an intentional interaction on iOS.
    maybeRequestIosSensor();
    dialog.showModal();
    dialog.querySelector('[data-event-depth-stage]')?.focus({preventScroll:true});
  });
  dialog.querySelector('[data-event-depth-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => openButton.focus({preventScroll:true}));
}
