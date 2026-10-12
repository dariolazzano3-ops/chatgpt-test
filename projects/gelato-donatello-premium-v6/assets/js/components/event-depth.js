/**
 * Touch-first simulated depth for the owner-provided event photograph.
 * A single photo is NOT an actual 360-degree capture. Do not label as real VR.
 */
export function initEventDepth() {
  const stages = document.querySelectorAll('[data-event-depth-stage]');
  if (!stages.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (value) => Math.max(-1, Math.min(1, value));

  stages.forEach((stage) => {
    let viewX = 0;
    let viewY = 0;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let fromX = 0;
    let fromY = 0;
    let moved = false;

    const scene = stage.closest('[data-event-depth]');
    const update = (x, y) => {
      viewX = clamp(x);
      viewY = clamp(y);
      stage.style.setProperty('--depth-yaw', (viewX * 12).toFixed(2) + 'deg');
      stage.style.setProperty('--depth-pitch', (-viewY * 8).toFixed(2) + 'deg');
      stage.style.setProperty('--depth-shift-x', (-viewX * 13).toFixed(2) + 'px');
      stage.style.setProperty('--depth-shift-y', (-viewY * 9).toFixed(2) + 'px');
      stage.style.setProperty('--depth-photo-x', (-viewX * 9).toFixed(2) + '%');
      stage.style.setProperty('--depth-light-x', (50 + viewX * 28).toFixed(1) + '%');
      stage.style.setProperty('--depth-light-y', (30 + viewY * 25).toFixed(1) + '%');
    };

    stage.addEventListener('pointerdown', (event) => {
      if (pointerId !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      fromX = viewX;
      fromY = viewY;
      moved = false;
      stage.classList.add('is-dragging');
      if (stage.setPointerCapture) stage.setPointerCapture(pointerId);
    });

    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      if (pointerId === event.pointerId) {
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) moved = true;
        update(fromX + deltaX / Math.max(rect.width * 0.38, 1),
          fromY + deltaY / Math.max(rect.height * 0.55, 1));
        if (moved && scene) scene.classList.add('has-explored');
      } else if (pointerId === null && event.pointerType === 'mouse' && !reducedMotion) {
        const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
        const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
        update((x - 0.5) * 1.55, (y - 0.5) * 1.55);
      }
    });

    const release = (event) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      stage.classList.remove('is-dragging');
      if (stage.hasPointerCapture && stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', () => {
      pointerId = null;
      stage.classList.remove('is-dragging');
    });
    stage.addEventListener('pointerleave', (event) => {
      if (pointerId === null && event.pointerType === 'mouse' && !reducedMotion) update(0, 0);
    });

    stage.addEventListener('keydown', (event) => {
      const keys = {
        ArrowLeft: [-0.24, 0],
        ArrowRight: [0.24, 0],
        ArrowUp: [0, -0.24],
        ArrowDown: [0, 0.24],
        Home: [0, 0]
      };
      if (!Object.prototype.hasOwnProperty.call(keys, event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') update(0, 0);
      else update(viewX + keys[event.key][0], viewY + keys[event.key][1]);
      if (scene) scene.classList.add('has-explored');
    });
    update(0, 0);
  });

  const dialog = document.querySelector('[data-event-depth-dialog]');
  const openButton = document.querySelector('[data-event-depth-open]');
  if (!dialog || !openButton || typeof dialog.showModal !== 'function') return;
  const closeButton = dialog.querySelector('[data-event-depth-close]');

  openButton.addEventListener('click', () => {
    dialog.showModal();
    dialog.querySelector('[data-event-depth-stage]')?.focus({ preventScroll: true });
  });
  closeButton?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => openButton.focus({ preventScroll: true }));
}
