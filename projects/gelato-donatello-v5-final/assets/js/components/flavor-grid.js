import { FLAVORS, FLAVOR_COUNT_CONFIRMED, flavorImagePath } from '../data/flavors.js';
import { createAssetFigure } from './asset-image.js';

// Rendert die 41 bestaetigten Sorten als durchsuch- und filterbares Raster.
// Alle Namen sind real und bestaetigt (siehe data/flavors.js); keine
// Platzhalter-Labels mehr noetig.

const FILTERS = [
  { key: 'all', label: 'Alle' },
  { key: 'regular', label: 'Regular' },
  { key: 'special', label: 'Specials' }
];

export function renderFlavorGrid(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="flavor-grid__toolbar">
      <div class="flavor-grid__filters" role="group" aria-label="Sorten filtern"></div>
      <label class="visually-hidden" for="flavor-search">Sorten durchsuchen</label>
      <input id="flavor-search" class="flavor-grid__search" type="search"
             placeholder="Sorte suchen, z. B. Pistazie" aria-describedby="flavor-grid-status" />
      <p id="flavor-grid-status" class="flavor-grid__status" role="status"></p>
    </div>
    <ul class="flavor-grid__list" id="flavor-grid-list"></ul>
  `;

  const filtersHost = container.querySelector('.flavor-grid__filters');
  filtersHost.innerHTML = FILTERS.map((filter, i) => `
    <button type="button" class="flavor-grid__filter" data-filter="${filter.key}" aria-pressed="${i === 0}">${filter.label}</button>
  `).join('');

  const list = container.querySelector('#flavor-grid-list');
  const search = container.querySelector('#flavor-search');
  const status = container.querySelector('#flavor-grid-status');
  let activeFilter = 'all';

  function renderItems(items) {
    list.innerHTML = '';
    items.forEach((flavor) => {
      const li = document.createElement('li');
      li.className = 'flavor-card';

      const figure = createAssetFigure({
        path: flavorImagePath(flavor.slug),
        alt: `${flavor.label} Gelato von Gelato Donatello`,
        aspect: '1-1'
      });
      li.appendChild(figure);

      const body = document.createElement('div');
      body.className = 'flavor-card__body';
      const badgeClass = flavor.category === 'special' ? 'flavor-card__badge flavor-card__badge--special' : 'flavor-card__badge';
      const badgeLabel = flavor.category === 'special' ? 'Special' : 'Regular';
      body.innerHTML = `
        <span class="${badgeClass}">${badgeLabel}</span>
        <p class="flavor-card__label">${flavor.label}</p>
      `;
      li.appendChild(body);
      list.appendChild(li);
    });
    status.textContent = `${items.length} von ${FLAVOR_COUNT_CONFIRMED} Sorten angezeigt`;
  }

  function currentItems() {
    const term = search.value.trim().toLowerCase();
    return FLAVORS.filter((flavor) => {
      const matchesFilter = activeFilter === 'all' || flavor.category === activeFilter;
      const matchesTerm = !term || flavor.label.toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
  }

  filtersHost.querySelectorAll('.flavor-grid__filter').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      filtersHost.querySelectorAll('.flavor-grid__filter').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === button));
      });
      renderItems(currentItems());
    });
  });

  search.addEventListener('input', () => renderItems(currentItems()));

  renderItems(currentItems());
}
