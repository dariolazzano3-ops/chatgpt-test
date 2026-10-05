import { EISBECHER_KATEGORIEN, EXTRAS_KATEGORIEN } from '../data/pricing.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function priceList(items) {
  const list = element('ul', 'price-table menu-price-table');
  items.forEach((item) => {
    const row = element('li', 'price-table__row');
    const labelWrap = element('span', 'price-table__label');
    labelWrap.append(element('span', '', item.label));
    if (item.note) labelWrap.append(element('small', 'price-table__note', item.note));
    row.append(labelWrap, element('span', 'price-table__value', item.display));
    list.append(row);
  });
  return list;
}

function renderGroups(host, groups, { showSourceNotes = false } = {}) {
  const grid = element('div', 'menu-groups');
  groups.forEach((group) => {
    const section = element('section', 'menu-group');
    section.setAttribute('aria-labelledby', 'menu-' + group.key);
    const heading = element('h3', 'menu-group__title', group.label);
    heading.id = 'menu-' + group.key;
    section.append(heading, priceList(group.items));

    if (showSourceNotes && group.sourceNote) {
      section.append(element('p', 'menu-source-note', 'Datenhinweis: ' + group.sourceNote));
    }
    grid.append(section);
  });
  host.replaceChildren(grid);
}

export function renderCupMenu(host) {
  renderGroups(host, EISBECHER_KATEGORIEN, { showSourceNotes: true });
}

export function renderExtrasMenu(host) {
  renderGroups(host, EXTRAS_KATEGORIEN);
}
