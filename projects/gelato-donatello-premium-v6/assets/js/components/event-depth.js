/** Gelato V14: swipe-controlled visual depth; no device sensors, no permission popups. */
export function initEventDepth() {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(-1, Math.min(1, value));
  const views = [...document.querySelectorAll('[data-event-depth-stage]')].map(stage => ({
    stage, x: 0, y: 0, pointerId: null, startX: 0, startY: 0, fromX: 0, fromY: 0
  }));

  const render = (view, x, y) => {
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
  };

  views.forEach(view => {
    const stage = view.stage;
    stage.addEventListener('pointerdown', e => {
      if (view.pointerId !== null || !e.isPrimary ||
          (e.pointerType === 'mouse' && e.button !== 0)) return;
      view.pointerId = e.pointerId;
      view.startX = e.clientX; view.startY = e.clientY;
      view.fromX = view.x; view.fromY = view.y;
      stage.classList.add('is-dragging');
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
      const rect = stage.getBoundingClientRect();
      if (view.pointerId === e.pointerId) {
        render(view, view.fromX + (e.clientX - view.startX) / Math.max(rect.width * .50, 1),
          view.fromY + (e.clientY - view.startY) / Math.max(rect.height * .66, 1));
      } else if (view.pointerId === null && e.pointerType === 'mouse' && !preference.matches) {
        render(view, ((e.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 1.2,
          ((e.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 1.2);
      }
    });
    const release = e => {
      if (view.pointerId !== e.pointerId) return;
      view.pointerId = null;
      stage.classList.remove('is-dragging');
      if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', () => {
      view.pointerId = null; stage.classList.remove('is-dragging');
    });
    stage.addEventListener('pointerleave', e => {
      if (view.pointerId === null && e.pointerType === 'mouse') render(view, 0, 0);
    });
    stage.addEventListener('keydown', e => {
      const directions = {ArrowLeft:[-.2,0],ArrowRight:[.2,0],
        ArrowUp:[0,-.2],ArrowDown:[0,.2],Home:[0,0]};
      if (!Object.prototype.hasOwnProperty.call(directions,e.key)) return;
      e.preventDefault();
      const delta = directions[e.key];
      if (e.key === 'Home') render(view,0,0);
      else render(view,view.x+delta[0],view.y+delta[1]);
    });
    render(view, 0, 0);
  });

  preference.addEventListener?.('change', () => {
    if (preference.matches) views.forEach(view => render(view, 0, 0));
  });
  const dialog=document.querySelector('[data-event-depth-dialog]');
  const expand=document.querySelector('[data-event-depth-open]');
  if (!dialog || !expand || typeof dialog.showModal !== 'function') return;
  expand.addEventListener('click', () => {
    dialog.showModal();
    dialog.querySelector('[data-event-depth-stage]')?.focus({preventScroll:true});
  });
  dialog.querySelector('[data-event-depth-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog) dialog.close();});
  dialog.addEventListener('close',()=>expand.focus({preventScroll:true}));
}
