// Wiederverwendbare Bildkomponente mit bewusst gestaltetem Platzhalter.
// Zeigt ein echtes Foto, sobald es exakt unter dem Manifest-Pfad abgelegt wird
// (siehe assets/manifest.json) - ohne Code-Aenderung. Bis dahin erscheint ein
// neutraler, markierter Platzhalter statt eines kaputten Bild-Icons. Keine
// generischen Stockbilder.

export function createAssetFigure({ path, alt, caption, aspect = '4-3' }) {
  const figure = document.createElement('figure');
  figure.className = `asset-figure asset-figure--${aspect}`;

  const frame = document.createElement('div');
  frame.className = 'asset-figure__frame';

  const img = document.createElement('img');
  img.src = path;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'asset-figure__img';

  img.addEventListener('error', () => {
    frame.classList.add('asset-figure__frame--placeholder');
    img.remove();
    const placeholder = document.createElement('div');
    placeholder.className = 'asset-figure__placeholder';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', alt);
    placeholder.innerHTML = '<span class="asset-figure__placeholder-mark">Foto folgt</span>';
    frame.appendChild(placeholder);
  }, { once: true });

  frame.appendChild(img);
  figure.appendChild(frame);

  if (caption) {
    const figcaption = document.createElement('figcaption');
    figcaption.className = 'asset-figure__caption';
    figcaption.textContent = caption;
    figure.appendChild(figcaption);
  }

  return figure;
}

export function hydrateAssetFigures(root = document) {
  root.querySelectorAll('[data-asset-path]').forEach((placeholderEl) => {
    const path = placeholderEl.getAttribute('data-asset-path');
    const alt = placeholderEl.getAttribute('data-asset-alt') || '';
    const caption = placeholderEl.getAttribute('data-asset-caption') || '';
    const aspect = placeholderEl.getAttribute('data-asset-aspect') || '4-3';
    const figure = createAssetFigure({ path, alt, caption, aspect });
    placeholderEl.replaceWith(figure);
  });
}
