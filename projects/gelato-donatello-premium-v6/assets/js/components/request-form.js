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

export function renderRequestForm(container, { formId, fields }) {
  if (!container) return;

  const fieldsHtml = fields.map((field)=>fieldMarkup(formId,field)).join('');

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


      <div class="request-step request-step--finish">
        <div class="request-step__head">
          <span class="request-step__number">02</span>
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
  form.addEventListener('submit',(event)=>{
    event.preventDefault();
    const data=new FormData(form);
    const rows=[];
    fields.forEach((field)=>{
      const value=data.get(field.name);
      if(value) rows.push([field.label,value]);
    });
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
