import { FLAVORS } from './hero-flavors.js';

const sizes={
  'Klassische Eistorte':['18 cm','20 cm','24 cm','26 cm'],
  'Spaghetti-Eistorte':['18 cm','20 cm','24 cm','26 cm'],
  'Eisbombe':['40 Kugeln','60 Kugeln']
};
const decorations=['TEST: Schokolade und Beeren','TEST: Fruechte','TEST: Zahl 7','TEST: Ohne Dekoration'];
const notes=['TEST: Keine weiteren Wuensche','TEST: Weitere Farben','TEST: Ohne Sahne'];
const $=(root,name)=>root.elements.namedItem(name);
const option=(value,label=value)=>'<option value="'+value+'">'+label+'</option>';
const choices=(name,labels,required=false)=>'<div class="form-field cake127-field" data-flavor-field="'+name+'"><label for="cake127-'+name+'">'+(name==='flavor1'?'Eissorte 1':name==='flavor2'?'Eissorte 2':'Weitere Eissorte '+name.slice(-1))+'</label><select id="cake127-'+name+'" name="'+name+'"'+(required?' required':'')+'><option value="">'+(required?'Bitte wählen':'Optional')+'</option>'+labels.map(x=>option(x)).join('')+'</select></div>';
const read=(form)=>({
  variante:$(form,'variante').value,
  kreation:$(form,'kreation').value,
  groesse:$(form,'groesse').value,
  eissorten:[1,2,3,4,5,6].map(i=>$(form,'flavor'+i)).filter(x=>!x.disabled).map(x=>x.value).filter(Boolean),
  dekoration:$(form,'dekoration').value,
  wunschdatum:$(form,'wunschdatum').value,
  bemerkungen:$(form,'bemerkungen').value,
  name:$(form,'name').value.trim(),
  email:$(form,'email').value.trim(),
  phone:$(form,'phone').value.trim(),
  website:$(form,'website').value,
  test_data_confirmed:$(form,'test_data_confirmed').checked,
  marketing_opt_in:false,
  privacy_notice_version:'demo-v1'
});

export function renderCakeInquiry(container,{fields}) {
  const creationOptions=fields.find(x=>x.name==='kreation')?.options||[];
  const names=FLAVORS.map(x=>x.name);
  container.innerHTML=[
    '<form class="request-form cake127-form" id="eistorten-anfrage" data-endpoint="/api/cakes-interest" data-demo-status="locked">',
    '<div class="request-form__intro"><span class="request-form__eyebrow">Deine Wunschkreation · privater Test</span>',
    '<p>Wähle deine Kreation und gestalte die Details direkt hier. Diese Testversion nimmt <strong>ausschließlich erfundene Testdaten</strong> an. Noch keine echte Kundenanfrage, Reservierung oder Bestellung.</p></div>',
    '<fieldset disabled class="cake127-fields"><div class="request-step"><div class="request-step__head"><span class="request-step__number">01</span><div><span class="request-step__kicker">Deine Kreation</span><h3>Wunsch & Geschmack</h3></div></div>',
    '<div class="request-form__grid">',
    '<div class="form-field"><label for="eistorten-anfrage-variante">Produkttyp</label><select name="variante" id="eistorten-anfrage-variante" required>'+Object.keys(sizes).map(x=>option(x)).join('')+'</select></div>',
    '<div class="form-field"><label for="eistorten-anfrage-kreation">Kreation</label><select name="kreation" id="eistorten-anfrage-kreation" required>'+creationOptions.map(x=>option(x)).join('')+'</select></div>',
    '<div class="form-field"><label for="cake127-size">Größe</label><select name="groesse" id="cake127-size" required></select></div>',
    '<div class="form-field"><label for="cake127-date">Wunschtermin</label><input type="date" name="wunschdatum" id="cake127-date" required /></div>',
    '<p class="cake127-hint form-field--wide" id="cake127-lead">Bei Eistorten möglichst eine Woche Vorlauf einplanen. Die Verfügbarkeit wird erst nach einer persönlichen Zusage bestätigt.</p>',
    ...[1,2,3,4,5,6].map(i=>choices('flavor'+i,names,i<=2)),
    '<div class="form-field form-field--wide"><label for="cake127-deco">Dekorationswunsch (Testbeispiele)</label><select name="dekoration" id="cake127-deco" required>'+decorations.map(x=>option(x)).join('')+'</select></div>',
    '<div class="form-field form-field--wide"><label for="cake127-note">Weitere Wünsche (optional, nur Beispiele)</label><select name="bemerkungen" id="cake127-note"><option value="">Keine</option>'+notes.map(x=>option(x)).join('')+'</select></div>',
    '</div></div>',
    '<div class="request-step request-step--finish"><div class="request-step__head"><span class="request-step__number">02</span><div><span class="request-step__kicker">Kontaktdaten · Testmodus</span><h3>Interesse vormerken</h3></div></div>',
    '<p class="cake127-hint">Nur „Test Gast“ und „test@example.test“ verwenden. Für echte Anfragen fehlen noch Freigaben für Datenschutz, Speicherung und Benachrichtigung.</p>',
    '<div class="request-form__grid">',
    '<div class="form-field"><label for="cake127-name">Name</label><input id="cake127-name" name="name" autocomplete="off" value="Test Gast" required maxlength="25" /></div>',
    '<div class="form-field"><label for="cake127-email">E-Mail</label><input id="cake127-email" name="email" type="email" autocomplete="off" value="test@example.test" required maxlength="50" /></div>',
    '<div class="form-field form-field--wide"><label for="cake127-phone">Telefon (optional)</label><input id="cake127-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" maxlength="6" placeholder="Leer oder 000000" /></div>',
    '</div>',
    '<div class="cake127-bot" aria-hidden="true"><label for="cake127-web">Website</label><input id="cake127-web" tabindex="-1" name="website" autocomplete="off" /></div>',
    '<label class="cake127-consent"><input name="test_data_confirmed" type="checkbox" required /><span>Ich bestätige, dass alle Angaben ausschließlich erfundene Testdaten sind. In diesem Probelauf wird <strong>nichts gespeichert oder verschickt</strong>.</span></label>',
    '<p class="cake127-privacy">Keine Werbung und kein Newsletter. Die spätere echte Anfrage benötigt eine freigegebene <a href="/datenschutz/" data-cake-privacy-link>Datenschutzerklärung</a>, Angaben zur verantwortlichen Stelle, Rechtsgrundlage und Löschfristen. Diese Testversion ist nicht für echte Kontaktdaten freigegeben.</p>',
    '</div></fieldset>',
    '<button class="button button--primary button--wide cake127-submit" type="submit" disabled>Interesse vormerken ↗</button>',
    '<p class="cake127-error" role="alert" hidden></p>',
    '<div class="cake127-success" role="status" aria-live="polite" tabindex="-1" hidden><span class="cake127-tick" aria-hidden="true">✓</span><h3>Testanfrage erfolgreich geprüft.</h3><p>Deine Beispielangaben wurden sicher geprüft, aber <strong>nicht gespeichert, per E-Mail verschickt oder als Bestellung aufgenommen.</strong></p><dl class="cake127-recap"></dl><p class="cake127-receipt"></p><button type="button" class="cake127-again">Neue Testanfrage</button></div>',
    '<p class="request-note">Derzeit nur private technische Vorschau. Keine verbindliche Bestellung, keine Zahlung, keine automatische Zusage.</p>',
    '</form>'
  ].join('');

  const form=container.querySelector('form'),fieldset=form.querySelector('fieldset'),submit=form.querySelector('.cake127-submit'),error=form.querySelector('.cake127-error'),success=form.querySelector('.cake127-success'),endpoint=form.dataset.endpoint;
  // Disable the missing legal-link destination rather than link to a nonexistent policy.
  const privacyLink=form.querySelector('[data-cake-privacy-link]');
  privacyLink.replaceWith(document.createTextNode('Datenschutzerklärung'));
  const showError=message=>{error.textContent=message;error.hidden=false;error.scrollIntoView({block:'nearest'});};
  const clearError=()=>{error.hidden=true;error.textContent='';};
  const today=new Date(),localDay=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
  const iso=d=>String(d.getFullYear())+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  $(form,'wunschdatum').min=iso(localDay);
  const latest=new Date(today.getFullYear(),today.getMonth(),today.getDate()+365);
  $(form,'wunschdatum').max=iso(latest);
  function syncVariant() {
    const type=$(form,'variante').value, size=$(form,'groesse'), oldSize=size.value;
    size.replaceChildren(...sizes[type].map(value=>{const op=document.createElement('option');op.value=value;op.textContent=value;return op;}));
    if(sizes[type].includes(oldSize))size.value=oldSize;
    const bomb=type==='Eisbombe';
    for(let i=2;i<=6;i++){
      const select=$(form,'flavor'+i),wrap=select.closest('[data-flavor-field]');
      if(i>=3){wrap.hidden=!bomb;select.disabled=!bomb;select.value='';}
      select.required=i===2&&!bomb;
    }
    $(form,'flavor1').required=true;
    form.querySelector('#cake127-lead').textContent=bomb
      ? 'Für Eisbomben möglichst 1–2 Tage Vorlauf einplanen. Bis zu sechs Eissorten möglich. Keine Verfügbarkeitsgarantie.'
      : 'Für Eistorten möglichst eine Woche Vorlauf einplanen. Wähle zwei unterschiedliche Eissorten. Keine Verfügbarkeitsgarantie.';
  }
  function syncCreation(){
    const val=$(form,'kreation').value,match=/^Nr\. (\d\d) · /.exec(val);
    if(!match)return;
    const i=Number(match[1]);
    $(form,'variante').value=i<=19?'Klassische Eistorte':i<=22?'Spaghetti-Eistorte':'Eisbombe';
    syncVariant();
  }
  $(form,'variante').addEventListener('change',()=>{
    const value=$(form,'kreation').value,match=/^Nr\. (\d\d) · /.exec(value),i=match?Number(match[1]):0,type=$(form,'variante').value;
    if(i && ((type==='Eisbombe')!==(i>=23) || (type==='Spaghetti-Eistorte')!==(i>=20 && i<=22))){
      $(form,'kreation').value='Eigene Idee / noch unsicher';
    }
    syncVariant();
  });
  $(form,'kreation').addEventListener('change',syncCreation);
  syncVariant();
  const check=d=>{
    if(!/^Test (Gast|Person|Kunde)( [0-9]{1,2})?$/.test(d.name))return 'Bitte ausschließlich Test Gast, Test Person oder Test Kunde verwenden.';
    if(!/^test(-[a-z0-9]{1,20})?@example\.test$/.test(d.email))return 'Bitte nur eine Testadresse wie test@example.test verwenden.';
    if(d.phone!==''&&d.phone!=='000000')return 'Telefon bitte leer lassen oder 000000 eintragen.';
    if(!decorations.includes(d.dekoration)||!['',...notes].includes(d.bemerkungen))return 'Bitte nur vorgegebene Testwünsche auswählen.';
    if(d.website)return 'Testanfrage konnte nicht geprüft werden.';
    if(d.variante==='Eisbombe'){
      if(d.eissorten.length<1||d.eissorten.length>6)return 'Wähle eine bis sechs Testsorten.';
    } else if(d.eissorten.length!==2)return 'Wähle genau zwei Testsorten.';
    if(new Set(d.eissorten).size!==d.eissorten.length)return 'Bitte unterschiedliche Sorten wählen.';
    if(!d.test_data_confirmed)return 'Bitte den Testdaten-Hinweis bestätigen.';
    return '';
  };
  async function unlock(){
    try {
      const res=await fetch(endpoint+'/status',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      if(!res.ok)throw Error('offline');
      const d=await res.json();
      if(!d.ok||d.mode!=='test-only'||d.real_submissions!==false||d.storage!=='disabled'||d.notifications!=='not_sent'||d.booking!==false)throw Error('unsafe');
      fieldset.disabled=false;submit.disabled=false;form.dataset.demoStatus='ready';clearError();
    }catch{
      form.dataset.demoStatus='api-unavailable';fieldset.disabled=true;submit.disabled=true;
      showError('Sicherer Testmodus nicht erreichbar. Es werden keine Daten versendet.');
    }
  }
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();clearError();
    if(submit.disabled||!form.reportValidity())return;
    const d=read(form),problem=check(d);
    if(problem){showError(problem);return;}
    submit.disabled=true;submit.textContent='Testanfrage wird geprüft …';
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(d)});
      const result=await response.json();
      if(!response.ok||result.ok!==true||result.mode!=='test-only'||result.stored!==false||result.notified!==false||result.booking!==false||!/^DEMO-CAKE-[0-9A-F]{8}$/.test(result.receipt))throw Error('Test nicht angenommen ('+(result.code||'API-Fehler')+').');
      const rows=[['Kreation',d.kreation],['Produkt',d.variante],['Größe',d.groesse],['Eissorten',d.eissorten.join(', ')],['Dekoration',d.dekoration],['Wunschtermin',d.wunschdatum]];
      const dl=form.querySelector('.cake127-recap');dl.replaceChildren();
      for(const [label,value] of rows){
        const wrap=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
        dt.textContent=label;dd.textContent=value;wrap.append(dt,dd);dl.append(wrap);
      }
      form.querySelector('.cake127-receipt').textContent='Testreferenz: '+result.receipt;
      fieldset.hidden=true;submit.hidden=true;success.hidden=false;form.dataset.demoStatus='confirmed';success.focus({preventScroll:false});
    }catch(e){showError(e.message||'Test-API derzeit nicht verfügbar.');}
    finally{submit.textContent='Interesse vormerken ↗';if(!submit.hidden)submit.disabled=false;}
  });
  form.querySelector('.cake127-again').addEventListener('click',()=>{
    form.reset();syncVariant();clearError();
    success.hidden=true;fieldset.hidden=false;submit.hidden=false;fieldset.disabled=false;submit.disabled=false;
    form.dataset.demoStatus='ready';$(form,'kreation').focus();
  });
  unlock();
}
