import { FLAVORS } from '../data/flavors.js';
import { BUSINESS } from '../data/business.js';

// Generisches Anfrage-Formular fuer Eistorten & Eisbomben sowie Eisvitrine.
// external_writes ist projektweit false: es gibt keinen bestaetigten
// digitalen Zustellkanal, daher fasst das Formular lokal zusammen statt eine
// Uebermittlung zu simulieren.

export function renderRequestForm(container, { formId, fields, includeFlavorPicker = false, maxFlavors = 6 }) {
  if (!container) return;

  const fieldsHtml = fields.map((field) => {
    if (field.type === 'textarea') {
      return `
        <div class="form-field">
          <label for="${formId}-${field.name}">${field.label}</label>
          <textarea id="${formId}-${field.name}" name="${field.name}" rows="3"></textarea>
        </div>
      `;
    }
    return `
      <div class="form-field">
        <label for="${formId}-${field.name}">${field.label}</label>
        <input id="${formId}-${field.name}" name="${field.name}" type="${field.type}" />
      </div>
    `;
  }).join('');

  const flavorPickerHtml = includeFlavorPicker ? `
    <div class="form-field">
      <label id="${formId}-flavors-label">Sortenwunsch (bis zu ${maxFlavors} aus unseren 41 Sorten)</label>
      <div class="category-list" role="group" aria-labelledby="${formId}-flavors-label">
        ${FLAVORS.map((flavor) => `
          <label class="konfigurator__choice">
            <input type="checkbox" name="sorten" value="${flavor.label}" /> ${flavor.label}
          </label>
        `).join('')}
      </div>
      <p class="request-note">Vollstaendige Beschreibung im <a href="/sortiment/">Sortiment</a>. Bitte zusaetzliche Wuensche unten in den Bemerkungen notieren.</p>
    </div>
  ` : '';

  container.innerHTML = `
    <form class="request-form" id="${formId}" novalidate>
      ${fieldsHtml}
      ${flavorPickerHtml}
      <button type="submit" class="button button--primary">Anfrage absenden</button>
      <div class="request-summary" aria-live="polite"></div>
      <p class="request-note">
        Diese Anfrage wird noch nicht automatisch digital uebermittelt. Bitte die Zusammenfassung
        telefonisch unter <a href="${BUSINESS.phoneHref}">${BUSINESS.phone}</a> oder vor Ort in
        ${BUSINESS.address.street}, ${BUSINESS.address.postalCode} ${BUSINESS.address.city} bestaetigen.
      </p>
    </form>
  `;

  const form = container.querySelector('form');
  const summary = form.querySelector('.request-summary');

  if (includeFlavorPicker) {
    const flavorInputs = form.querySelectorAll('input[name="sorten"]');
    flavorInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const checked = form.querySelectorAll('input[name="sorten"]:checked');
        if (checked.length > maxFlavors) {
          input.checked = false;
        }
      });
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const list = document.createElement('ul');

    fields.forEach((field) => {
      const li = document.createElement('li');
      const value = data.get(field.name) || '-';
      li.textContent = `${field.label}: ${value}`;
      list.appendChild(li);
    });

    if (includeFlavorPicker) {
      const sorten = data.getAll('sorten');
      const li = document.createElement('li');
      li.textContent = `Sortenwunsch: ${sorten.length ? sorten.join(', ') : '-'}`;
      list.appendChild(li);
    }

    summary.innerHTML = '';
    summary.appendChild(list);
  });
}
