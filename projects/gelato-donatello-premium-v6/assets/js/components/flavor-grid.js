import { FLAVORS, FLAVOR_COUNT_CONFIRMED, flavorImagePath } from '../data/flavors.js';
import { createAssetFigure } from './asset-image.js';

const FILTERS = [
  { key: 'all', label: 'Alle 41' },
  { key: 'regular', label: 'Regular' },
  { key: 'special', label: 'Specials' }
];

export function renderFlavorGrid(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="flavor-grid__toolbar">
      <div class="flavor-grid__filters" role="group" aria-label="Sorten filtern"></div>
      <label class="flavor-grid__search-wrap" for="flavor-search">
        <span>Suchen</span>
        <input id="flavor-search" class="flavor-grid__search" type="search" placeholder="z. B. Pistazie" aria-describedby="flavor-grid-status" />
      </label>
      <p id="flavor-grid-status" class="flavor-grid__status" role="status"></p>
    </div>
    <ul class="flavor-grid__list" id="flavor-grid-list"></ul>
  `;
  const filtersHost = container.querySelector('.flavor-grid__filters');
  filtersHost.innerHTML = FILTERS.map((f,i)=>`<button type="button" class="flavor-grid__filter" data-filter="${f.key}" aria-pressed="${i===0}">${f.label}</button>`).join('');
  const list=container.querySelector('#flavor-grid-list');
  const search=container.querySelector('#flavor-search');
  const status=container.querySelector('#flavor-grid-status');
  let activeFilter='all';

  function renderItems(items){
    list.innerHTML='';
    items.forEach((flavor,index)=>{
      const li=document.createElement('li');
      li.className='flavor-card';
      li.dataset.category=flavor.category;
      const figure=createAssetFigure({
        path:flavorImagePath(flavor.slug),
        alt:`${flavor.label} Gelato von Gelato Donatello`,
        aspect:'1-1',
        loading:index < 8 ? 'eager' : 'lazy'
      });
      li.appendChild(figure);
      const body=document.createElement('div');
      body.className='flavor-card__body';
      body.innerHTML=`
        <div class="flavor-card__meta">
          <span class="flavor-card__badge">${flavor.category==='special'?'Special':'Regular'}</span>
          <span class="flavor-card__number">${String(FLAVORS.indexOf(flavor)+1).padStart(2,'0')}</span>
        </div>
        <p class="flavor-card__label">${flavor.label}</p>
      `;
      li.appendChild(body);
      list.appendChild(li);
    });
    status.textContent=`${items.length} von ${FLAVOR_COUNT_CONFIRMED} Sorten`;
  }
  function currentItems(){
    const term=search.value.trim().toLowerCase();
    return FLAVORS.filter(f=>(activeFilter==='all'||f.category===activeFilter)&&(!term||f.label.toLowerCase().includes(term)));
  }
  filtersHost.querySelectorAll('.flavor-grid__filter').forEach(btn=>btn.addEventListener('click',()=>{
    activeFilter=btn.dataset.filter;
    filtersHost.querySelectorAll('.flavor-grid__filter').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    renderItems(currentItems());
  }));
  search.addEventListener('input',()=>renderItems(currentItems()));
  renderItems(currentItems());
}
