import { FLAVORS } from '../data/flavors.js';
import { BUSINESS } from '../data/business.js';

function fieldMarkup(formId, field) {
  const id = `${formId}-${field.name}`;
  if (field.type === 'textarea') {
    return `<div class="form-field form-field--wide">
      <label for="${id}">${field.label}</label>
      <textarea id="${id}" name="${field.name}" rows="4" placeholder="${field.placeholder || ''}"></textarea>
    </div>`;
  }
  if (field.type === 'select') {
    const options=(field.options || []).map((option)=>{
      const value=typeof option === 'string' ? option : option.value;
      const label=typeof option === 'string' ? option : option.label;
      return `<option value="${value}">${label}</option>`;
    }).join('');
    return `<div class="form-field">
      <label for="${id}">${field.label}</label>
      <select id="${id}" name="${field.name}">
        <option value="">Bitte wählen</option>
        ${options}
      </select>
    </div>`;
  }
  return `<div class="form-field">
    <label for="${id}">${field.label}</label>
    <input id="${id}" name="${field.name}" type="${field.type}" placeholder="${field.placeholder || ''}" />
  </div>`;
}

export function renderRequestForm(container, { formId, fields, includeFlavorPicker = false, maxFlavors = 6 }) {
  if (!container) return;

  const fieldsHtml = fields.map((field)=>fieldMarkup(formId,field)).join('');
  const flavorPickerHtml = includeFlavorPicker ? `
    <div class="request-step request-step--flavors">
      <div class="request-step__head">
        <span class="request-step__number">02</span>
        <div><span class="request-step__kicker">Eissorten</span><h3>Deine Auswahl</h3></div>
      </div>
      <details class="flavor-picker">
        <summary><span>Sorten auswählen</span><span class="flavor-picker__count">0 / ${maxFlavors}</span></summary>
        <div class="flavor-picker__grid" role="group" aria-label="Eissorten auswählen">
          ${FLAVORS.map((flavor)=>`
            <label class="flavor-choice">
              <input type="checkbox" name="sorten" value="${flavor.label}" />
              <span>${flavor.label}</span>
            </label>
          `).join('')}
        </div>
      </details>
      <p class="request-note">Bei Eistorten und Spaghetti-Eistorten sind 2 Sorten vorgesehen, bei Eisbomben bis zu 6.</p>
    </div>
  ` : '';

  container.innerHTML = `
    <form class="request-form" id="${formId}" novalidate>
      <div class="request-form__intro">
        <span class="request-form__eyebrow">Unverbindlich vorbereiten</span>
        <p>Deine Auswahl wird lokal zusammengefasst. Es wird nichts automatisch versendet.</p>
      </div>

      <div class="request-step">
        <div class="request-step__head">
          <span class="request-step__number">01</span>
          <div><span class="request-step__kicker">Details</span><h3>Anlass & Termin</h3></div>
        </div>
        <div class="request-form__grid">${fieldsHtml}</div>
      </div>

      ${flavorPickerHtml}

      <div class="request-step request-step--finish">
        <div class="request-step__head">
          <span class="request-step__number">${includeFlavorPicker ? '03' : '02'}</span>
          <div><span class="request-step__kicker">Abschluss</span><h3>Anfrage vorbereiten</h3></div>
        </div>
        <button type="submit" class="button button--primary button--wide">Auswahl zusammenfassen</button>
        <div class="request-summary" aria-live="polite"></div>
        <p class="request-note">Danach telefonisch unter <a href="${BUSINESS.phoneHref}">${BUSINESS.phone}</a> oder vor Ort bestätigen.</p>
      </div>
    </form>
  `;

  const form=container.querySelector('form');
  const summary=form.querySelector('.request-summary');
  const countEl=form.querySelector('.flavor-picker__count');
  const variant=form.querySelector('select[name="variante"]');

  function effectiveMax(){
    if(!includeFlavorPicker) return 0;
    const selected=variant?.value || '';
    return selected.toLowerCase().includes('eisbombe') ? 6 : (selected ? 2 : maxFlavors);
  }
  function syncFlavorState(){
    if(!includeFlavorPicker) return;
    const max=effectiveMax();
    const checked=[...form.querySelectorAll('input[name="sorten"]:checked')];
    if(countEl) countEl.textContent=`${checked.length} / ${max}`;
    form.querySelectorAll('input[name="sorten"]:not(:checked)').forEach(input=>{ input.disabled=checked.length >= max; });
  }
  if(includeFlavorPicker){
    form.querySelectorAll('input[name="sorten"]').forEach(input=>input.addEventListener('change',syncFlavorState));
    variant?.addEventListener('change',()=>{
      const max=effectiveMax();
      const checked=[...form.querySelectorAll('input[name="sorten"]:checked')];
      checked.slice(max).forEach(input=>{input.checked=false;});
      syncFlavorState();
    });
    syncFlavorState();
  }

  form.addEventListener('submit',(event)=>{
    event.preventDefault();
    const data=new FormData(form);
    const rows=[];
    fields.forEach((field)=>{
      const value=data.get(field.name);
      if(value) rows.push([field.label,value]);
    });
    if(includeFlavorPicker){
      const sorten=data.getAll('sorten');
      if(sorten.length) rows.push(['Sortenwunsch',sorten.join(', ')]);
    }
    summary.replaceChildren();
    const card=document.createElement('div');
    card.className='request-summary__card';
    const eyebrow=document.createElement('span');
    eyebrow.className='request-summary__eyebrow';
    eyebrow.textContent='Deine Zusammenfassung';
    const dl=document.createElement('dl');
    rows.forEach(([label,value])=>{
      const row=document.createElement('div');
      const dt=document.createElement('dt');
      const dd=document.createElement('dd');
      dt.textContent=label;
      dd.textContent=String(value);
      row.append(dt,dd);
      dl.appendChild(row);
    });
    const call=document.createElement('a');
    call.className='button button--dark button--wide';
    call.href=BUSINESS.phoneHref;
    call.textContent='Jetzt anrufen';
    card.append(eyebrow,dl,call);
    summary.appendChild(card);
  });
}
