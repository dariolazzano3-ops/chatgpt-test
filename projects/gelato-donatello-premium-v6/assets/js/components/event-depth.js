/**
 * Gelato Donatello V12: optional iPhone lock-screen-style depth.
 * The user-provided event photo remains the ONLY image.
 * No fake 360, no sensor storage, no sensor network transmission.
 * Motion sensors are accessed only after an explicit user gesture.
 */
export function initEventDepth() {
  const stages = [...document.querySelectorAll('[data-event-depth-stage]')];
  if (!stages.length) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value) => Math.max(-1, Math.min(1, value));
  const entries = stages.map((stage) => ({
    stage, scene: stage.closest('[data-event-depth]'),
    x: 0, y: 0, pointerId: null, startX: 0, startY: 0, fromX: 0, fromY: 0
  }));

  // Keep the photo oversized inside the crop so neither a tilt nor a swipe can reveal gaps.
  function draw(entry, x, y) {
    entry.x = clamp(x);
    entry.y = clamp(y);
    const s = entry.stage.style;
    s.setProperty('--depth-yaw', (entry.x * 9).toFixed(2) + 'deg');
    s.setProperty('--depth-pitch', (-entry.y * 6).toFixed(2) + 'deg');
    s.setProperty('--depth-shift-x', (-entry.x * 11).toFixed(2) + 'px');
    s.setProperty('--depth-shift-y', (-entry.y * 8).toFixed(2) + 'px');
    s.setProperty('--depth-photo-x', (-entry.x * 5.5).toFixed(2) + '%');
    s.setProperty('--depth-light-x', (50 + entry.x * 19).toFixed(1) + '%');
    s.setProperty('--depth-light-y', (30 + entry.y * 17).toFixed(1) + '%');
  }

  const controls = [...document.querySelectorAll('[data-gyro-toggle]')];
  const hasSensor = typeof window.DeviceOrientationEvent !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || /iPhone|iPad|Android/i.test(navigator.userAgent));
  const allowed = () => hasSensor && !motionPreference.matches;
  let enabled = false;
  let pending = false;
  let sensed = false;
  let initial = null;
  let goalX = 0, goalY = 0, currentX = 0, currentY = 0;
  let frame = 0, startupTimeout = 0;

  function setControls(label, pressed, isPending = false) {
    controls.forEach((button) => {
      button.querySelector('[data-gyro-label]').textContent = label;
      button.setAttribute('aria-pressed', String(pressed));
      button.disabled = isPending;
    });
  }
  function syncControls() {
    controls.forEach((button) => { button.hidden = !allowed(); });
    if (!allowed() && enabled) disableGyro();
  }
  function settle() {
    frame = 0;
    if (!enabled || document.hidden || motionPreference.matches) return;
    currentX += (goalX - currentX) * 0.17;
    currentY += (goalY - currentY) * 0.17;
    entries.forEach((entry) => {
      if (entry.pointerId === null) draw(entry, currentX, currentY);
    });
    if (Math.abs(goalX - currentX) + Math.abs(goalY - currentY) > 0.004) {
      frame = window.requestAnimationFrame(settle);
    }
  }
  function queueFrame() {
    if (!frame && enabled && !document.hidden && !motionPreference.matches) {
      frame = window.requestAnimationFrame(settle);
    }
  }
  function onOrientation(event) {
    if (!enabled || document.hidden || !Number.isFinite(event.beta) ||
        !Number.isFinite(event.gamma)) return;
    if (!sensed) {
      sensed = true;
      window.clearTimeout(startupTimeout);
      setControls('Neigung ausschalten', true);
    }
    if (!initial) {
      initial = { beta: event.beta, gamma: event.gamma };
      return;
    }

    const beta = Math.max(-25, Math.min(25, event.beta - initial.beta));
    const gamma = Math.max(-25, Math.min(25, event.gamma - initial.gamma));
    const angle = ((window.screen?.orientation?.angle ??
      window.orientation ?? 0) + 360) % 360;
    let horizontal = gamma, vertical = beta;
    if (angle === 90) { horizontal = beta; vertical = -gamma; }
    else if (angle === 270) { horizontal = -beta; vertical = gamma; }
    else if (angle === 180) { horizontal = -gamma; vertical = -beta; }
    // A small angular movement already feels like depth; ±14° saturates the range.
    goalX = clamp(horizontal / 14) * 0.72;
    goalY = clamp(vertical / 14) * 0.60;
    queueFrame();
  }
  function disableGyro() {
    enabled = false;
    sensed = false;
    initial = null;
    goalX = goalY = currentX = currentY = 0;
    window.removeEventListener('deviceorientation', onOrientation);
    window.clearTimeout(startupTimeout);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    entries.forEach((entry) => {
      if (entry.pointerId === null) draw(entry, 0, 0);
      entry.scene?.classList.remove('is-gyro-active');
    });
    setControls('Neigung aktivieren', false);
  }
  function startGyro() {
    pending = false;
    enabled = true;
    sensed = false;
    initial = null;
    setControls('Sensor wird verbunden', true);
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    entries.forEach((entry) => entry.scene?.classList.add('is-gyro-active'));
    startupTimeout = window.setTimeout(() => {
      if (enabled && !sensed) {
        disableGyro();
        setControls('Sensor nicht verfügbar', false);
      }
    }, 4500);
  }
  function activate(event) {
    if (!allowed() || pending) return;
    if (enabled) { disableGyro(); return; }
    const Orientation = window.DeviceOrientationEvent;
    // On iOS requestPermission MUST be called synchronously from the click handler.
    if (typeof Orientation.requestPermission === 'function') {
      pending = true;
      setControls('Zugriff wird angefragt', false, true);
      let permission;
      try { permission = Orientation.requestPermission(); }
      catch (_) {
        pending = false;
        setControls('Neigung aktivieren', false);
        return;
      }
      Promise.resolve(permission).then((result) => {
        if (result === 'granted' && allowed()) startGyro();
        else {
          pending = false;
          setControls('Zugriff nicht erlaubt', false);
        }
      }).catch(() => {
        pending = false;
        setControls('Neigung aktivieren', false);
      });
    } else {
      startGyro();
    }
  }
  controls.forEach((button) => button.addEventListener('click', activate));
  syncControls();
  if (typeof motionPreference.addEventListener === 'function') {
    motionPreference.addEventListener('change', syncControls);
  }

  entries.forEach((entry) => {
    const { stage, scene } = entry;
    stage.addEventListener('pointerdown', (event) => {
      if (entry.pointerId !== null || !event.isPrimary ||
          (event.pointerType === 'mouse' && event.button !== 0)) return;
      entry.pointerId = event.pointerId;
      entry.startX = event.clientX;
      entry.startY = event.clientY;
      entry.fromX = entry.x;
      entry.fromY = entry.y;
      stage.classList.add('is-dragging');
      if (stage.setPointerCapture) stage.setPointerCapture(entry.pointerId);
    });
    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      if (entry.pointerId === event.pointerId) {
        const dx = event.clientX - entry.startX;
        const dy = event.clientY - entry.startY;
        draw(entry, entry.fromX + dx / Math.max(rect.width * 0.50, 1),
          entry.fromY + dy / Math.max(rect.height * 0.66, 1));
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) scene?.classList.add('has-explored');
      } else if (entry.pointerId === null && event.pointerType === 'mouse' &&
                 !enabled && !motionPreference.matches) {
        draw(entry, ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 1.1,
          ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 1.1);
      }
    });
    const release = (event) => {
      if (entry.pointerId !== event.pointerId) return;
      entry.pointerId = null;
      stage.classList.remove('is-dragging');
      if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      if (enabled) queueFrame();
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', () => {
      entry.pointerId = null;
      stage.classList.remove('is-dragging');
      if (enabled) queueFrame();
    });
    stage.addEventListener('pointerleave', (event) => {
      if (entry.pointerId === null && event.pointerType === 'mouse' && !enabled &&
          !motionPreference.matches) draw(entry, 0, 0);
    });
    stage.addEventListener('keydown', (event) => {
      const changes = {
        ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0],
        ArrowUp: [0, -0.2], ArrowDown: [0, 0.2], Home: [0, 0]
      };
      if (!Object.prototype.hasOwnProperty.call(changes, event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') draw(entry, 0, 0);
      else draw(entry, entry.x + changes[event.key][0], entry.y + changes[event.key][1]);
      scene?.classList.add('has-explored');
    });
    draw(entry, 0, 0);
  });

  // Avoid collecting motion information while the tab is not active.
  document.addEventListener('visibilitychange', () => {
    if (!enabled) return;
    initial = null;
    if (document.hidden) {
      goalX = goalY = currentX = currentY = 0;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      entries.forEach((entry) => {
        if (entry.pointerId === null) draw(entry, 0, 0);
      });
    }
  });

  const dialog = document.querySelector('[data-event-depth-dialog]');
  const openButton = document.querySelector('[data-event-depth-open]');
  if (!dialog || !openButton || typeof dialog.showModal !== 'function') return;
  openButton.addEventListener('click', () => {
    dialog.showModal();
    dialog.querySelector('[data-event-depth-stage]')?.focus({ preventScroll: true });
  });
  dialog.querySelector('[data-event-depth-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => openButton.focus({ preventScroll: true }));
}
