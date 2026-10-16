import { FLAVORS } from './hero-flavors.js';

const OCCASIONS=['Hochzeit','Geburtstag','Firmenevent','Anderer Anlass'];
const VENUES=['TEST: Musterort','TEST: Musterhalle','TEST: Firmenstandort'];
const $=(form,name)=>form.elements.namedItem(name);
const flavorOptions='<option value="">Bitte wählen</option>'+FLAVORS.map(flavor=>'<option value="'+flavor.name+'">'+flavor.name+'</option>').join('');
const todayOffset=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const read=form=>({
  anlass:$(form,'anlass').value,datum:$(form,'datum').value,ort:$(form,'ort').value,
  gaeste:Number($(form,'gaeste').value),
  eissorten:[1,2,3,4].map(i=>$(form,'flavor'+i).value).filter(Boolean),
  name:$(form,'name').value.trim(),email:$(form,'email').value.trim(),
  telefon:$(form,'telefon').value.trim(),website:$(form,'website').value,
  test_data_confirmed:$(form,'test_data_confirmed').checked,marketing_opt_in:false,
  privacy_notice_version:'demo-v1'
});
export function renderRentalInquiry(host){
  const selects=Array.from({length:4},(_,i)=>'<div class="r128-field"><label for="r128-flavor'+(i+1)+'">Eissorte '+(i+1)+(i===0?' *':' · optional')+'</label><select name="flavor'+(i+1)+'" id="r128-flavor'+(i+1)+'"'+(i===0?' required':'')+'>'+flavorOptions+'</select></div>').join('');
  host.innerHTML=[
    '<form class="r128-form" id="r128-inquiry" data-demo-status="locked" data-endpoint="/api/rental-interest">',
    '<span class="r128-form__eyebrow">Unverbindliche Anfrage · private Testphase</span>',
    '<h3>Event-Anfrage</h3>',
    '<p class="r128-form__intro">Ein paar Angaben genügen. Derzeit ist ausschließlich ein sicherer Test mit Beispieldaten möglich.</p>',
    '<fieldset disabled><div class="r128-fields">',
    '<div class="r128-field"><label for="r128-occasion">Anlass *</label><select name="anlass" id="r128-occasion" required>'+OCCASIONS.map(x=>'<option>'+x+'</option>').join('')+'</select></div>',
    '<div class="r128-field"><label for="r128-date">Veranstaltungsdatum *</label><input type="date" name="datum" id="r128-date" required /></div>',
    '<div class="r128-field"><label for="r128-venue">Veranstaltungsort (Test) *</label><select name="ort" id="r128-venue" required>'+VENUES.map(x=>'<option>'+x+'</option>').join('')+'</select></div>',
    '<div class="r128-field"><label for="r128-guests">Geschätzte Gästezahl *</label><input type="number" inputmode="numeric" name="gaeste" id="r128-guests" min="1" max="1000" step="1" value="40" required /></div>',
    '<div class="r128-flavors" role="group" aria-label="Eissortenwünsche"><p class="r128-flavors__title">Deine Lieblingssorten · bis zu vier</p>'+selects+'</div>',
    '<div class="r128-field"><label for="r128-name">Name (Test) *</label><input name="name" id="r128-name" type="text" autocomplete="off" value="Test Gast" maxlength="25" required /></div>',
    '<div class="r128-field"><label for="r128-email">E-Mail (Test) *</label><input name="email" id="r128-email" type="email" autocomplete="off" value="test@example.test" maxlength="50" required /></div>',
    '<div class="r128-field r128-field--wide"><label for="r128-phone">Telefon · optional</label><input name="telefon" id="r128-phone" type="tel" autocomplete="off" inputmode="tel" maxlength="6" placeholder="Leer lassen oder 000000" /></div>',
    '</div><div class="r128-bot" aria-hidden="true"><label for="r128-web">Website</label><input name="website" id="r128-web" autocomplete="off" tabindex="-1" /></div>',
    '<div class="r128-legal"><p class="r128-test-notice">🔒 <strong>Testmodus:</strong> Name „Test Gast“, E-Mail „test@example.test“ und ausschließlich die Beispielorte verwenden. Noch keine echten Angaben eingeben.</p>',
    '<label class="r128-consent"><input type="checkbox" name="test_data_confirmed" required /><span>Ich bestätige, dass alle Angaben erfundene Testdaten sind. Es wird nichts gespeichert oder versendet.</span></label>',
    '<p class="r128-privacy">Keine Werbung, keine Buchung und keine Zahlung. Echte Anfragen werden erst nach Freigabe einer Datenschutzerklärung, sicheren Speicherung und Benachrichtigung aktiviert. Verfügbarkeit und Leistungen bleiben unverbindlich.</p>',
    '</div></fieldset>',
    '<button type="submit" class="r128-submit" disabled><span>Interesse vormerken</span><span aria-hidden="true">↗</span></button>',
    '<p class="r128-error" role="alert" hidden></p>',
    '<div class="r128-success" role="status" aria-live="polite" tabindex="-1" hidden>',
    '<span class="r128-success__icon" aria-hidden="true">✓</span><h4>Testanfrage geprüft.</h4>',
    '<p>Deine Beispieleingaben wurden an unsere private Test-API übermittelt und geprüft. Es wurde <strong>nichts gespeichert, verschickt oder reserviert.</strong></p>',
    '<p class="r128-success__summary"></p><p class="r128-success__receipt"></p>',
    '<button type="button" class="r128-again">Neue Testanfrage</button></div>',
    '</form>'
  ].join('');
  const form=host.querySelector('form'),field=form.querySelector('fieldset'),submit=form.querySelector('.r128-submit'),status=form.querySelector('.r128-error'),success=form.querySelector('.r128-success'),endpoint=form.dataset.endpoint;
  $(form,'datum').min=todayOffset(1);
  $(form,'datum').max=todayOffset(365);
  const error=text=>{status.textContent=text;status.hidden=false;status.scrollIntoView({block:'nearest',behavior:'auto'});};
  const clear=()=>{status.hidden=true;status.textContent='';};
  const validate=d=>{
    if(!OCCASIONS.includes(d.anlass)||!VENUES.includes(d.ort))return 'Nur die angebotenen Testwerte verwenden.';
    if(!/^Test (Gast|Person|Kunde)( [0-9]{1,2})?$/.test(d.name))return 'Bitte nur Test Gast, Test Person oder Test Kunde verwenden.';
    if(!/^test(-[a-z0-9]{1,20})?@example\.test$/.test(d.email))return 'Bitte eine Testadresse wie test@example.test verwenden.';
    if(d.telefon!==''&&d.telefon!=='000000')return 'Telefon bitte leer lassen oder 000000 verwenden.';
    if(d.eissorten.length<1||d.eissorten.length>4||new Set(d.eissorten).size!==d.eissorten.length)return 'Bitte eine bis vier verschiedene Eissorten auswählen.';
    if(!Number.isInteger(d.gaeste)||d.gaeste<1||d.gaeste>1000)return 'Bitte eine Gästezahl von 1 bis 1000 wählen.';
    if(d.website)return 'Testanfrage konnte nicht geprüft werden.';
    if(!d.test_data_confirmed)return 'Bitte den Testdaten-Hinweis bestätigen.';
    return '';
  };
  async function prepare(){
    try{
      const res=await fetch(endpoint+'/status',{method:'GET',credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      if(!res.ok)throw Error('offline');
      const mode=await res.json();
      if(mode.ok!==true||mode.mode!=='test-only'||mode.real_submissions!==false||mode.storage!=='disabled'||mode.notifications!=='not_sent'||mode.booking!==false)throw Error('not-safe');
      field.disabled=false;submit.disabled=false;form.dataset.demoStatus='ready';clear();
    }catch{
      field.disabled=true;submit.disabled=true;form.dataset.demoStatus='api-unavailable';error('Die sichere Testfunktion ist derzeit nicht erreichbar. Es werden keine Angaben versendet.');
    }
  }
  document.querySelectorAll('[data-rental-occasion]').forEach(link=>link.addEventListener('click',()=>{
    const occasion=link.dataset.rentalOccasion;
    if(OCCASIONS.includes(occasion))$(form,'anlass').value=occasion;
  }));
  form.addEventListener('submit',async event=>{
    event.preventDefault();clear();
    if(submit.disabled||!form.reportValidity())return;
    const data=read(form),problem=validate(data);
    if(problem){error(problem);return;}
    submit.disabled=true;submit.querySelector('span').textContent='Testanfrage wird geprüft …';
    try {
      const res=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(data)});
      const response=await res.json();
      if(!res.ok||response.ok!==true||response.mode!=='test-only'||response.stored!==false||response.notified!==false||response.booking!==false||!/^DEMO-RENT-[0-9A-F]{8}$/.test(response.receipt))throw Error('Die Testanfrage konnte nicht bestätigt werden ('+(response.code||'API nicht verfügbar')+').');
      form.querySelector('.r128-success__summary').textContent=data.anlass+' · '+data.datum+' · '+data.gaeste+' Testgäste · '+data.eissorten.join(', ');
      form.querySelector('.r128-success__receipt').textContent='Testreferenz: '+response.receipt;
      field.hidden=true;submit.hidden=true;success.hidden=false;form.dataset.demoStatus='confirmed';success.focus();
    }catch(ex){error(ex.message||'Testanfrage fehlgeschlagen.');}
    finally {submit.querySelector('span').textContent='Interesse vormerken';if(!submit.hidden)submit.disabled=false;}
  });
  form.querySelector('.r128-again').addEventListener('click',()=>{
    form.reset();clear();field.hidden=false;submit.hidden=false;success.hidden=true;field.disabled=false;submit.disabled=false;
    form.dataset.demoStatus='ready';$(form,'anlass').focus();
  });
  prepare();
}
