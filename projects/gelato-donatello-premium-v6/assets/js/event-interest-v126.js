/* Gelato Event Interest V126: strict private synthetic-only UX. */
function initEventInterestDemo() {
 const form=document.querySelector('#ev126-interest-form');
 if(!form) return;
 const fields=form.querySelector('fieldset');
 const submit=form.querySelector('.ev126-submit');
 const status=form.querySelector('.ev126-form-feedback');
 const success=form.querySelector('.ev126-success');
 const receipt=success.querySelector('.ev126-success__receipt');
 const reset=success.querySelector('.ev126-success__reset');
 const endpoint=form.dataset.endpoint;
 const errorText={
  ONLY_SYNTHETIC_NAME:'Bitte ausschließlich „Test Gast“, „Test Person“ oder „Test Kunde“ verwenden.',
  ONLY_SYNTHETIC_EMAIL:'Bitte eine Testadresse wie test@example.test verwenden.',
  ONLY_SYNTHETIC_PHONE:'Bitte Telefon leer lassen oder 000000 eintragen.',
  ONLY_SYNTHETIC_NOTE:'Eine optionale Nachricht muss mit „TEST: “ beginnen und darf keine echten Angaben enthalten.',
  INVALID_SEAT_COUNT:'Wähle zwischen 1 und 8 Testplätzen.',
  TEST_CONFIRMATION_REQUIRED:'Bitte bestätigen, dass nur Testdaten verwendet werden.',
  ORIGIN_DENIED:'Diese Testfunktion steht nur auf unserer privaten Vorschau zur Verfügung.'
 };
 const showError=message=>{
  status.textContent=message;
  status.hidden=false;
  status.scrollIntoView({block:'nearest',behavior:'auto'});
 };
 const clearError=()=>{status.hidden=true;status.textContent=''};
 const read=()=>({
  name:form.elements.namedItem('name').value.trim(),
  email:form.elements.namedItem('email').value.trim(),
  phone:form.elements.namedItem('phone').value.trim(),
  requested_seats:Number(form.elements.namedItem('requested_seats').value),
  note:form.elements.namedItem('note').value.trim(),
  test_data_confirmed:form.elements.namedItem('test_data_confirmed').checked,
  marketing_opt_in:false,
  privacy_notice_version:'demo-v1'
 });
 const check=x=>{
  if(!/^Test (Gast|Person|Kunde)( [0-9]{1,2})?$/.test(x.name))return 'ONLY_SYNTHETIC_NAME';
  if(!/^test(-[a-z0-9]{1,20})?@example\.test$/.test(x.email))return 'ONLY_SYNTHETIC_EMAIL';
  if(x.phone!==''&&x.phone!=='000000')return 'ONLY_SYNTHETIC_PHONE';
  if(!Number.isInteger(x.requested_seats)||x.requested_seats<1||x.requested_seats>8)return 'INVALID_SEAT_COUNT';
  if(x.note!==''&&!/^TEST: [a-zA-Z0-9 .,!?-]{0,100}$/.test(x.note))return 'ONLY_SYNTHETIC_NOTE';
  if(x.test_data_confirmed!==true)return 'TEST_CONFIRMATION_REQUIRED';
  return null;
 };
 const enable=()=>{
  fields.disabled=false;submit.disabled=false;form.dataset.eventFormStatus='synthetic-only-ready';clearError();
 };
 const disable=()=>{
  fields.disabled=true;submit.disabled=true;form.dataset.eventFormStatus='test-api-unavailable';
  showError('Der sichere Testserver ist derzeit nicht erreichbar. Es werden keine Angaben versendet.');
 };
 async function prepare(){
  try{
   const res=await fetch(endpoint+'/status',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
   if(!res.ok)throw Error('server unavailable');
   const mode=await res.json();
   if(!mode.ok||mode.mode!=='test-only'||mode.real_submissions!==false||mode.storage!=='disabled'||mode.notifications!=='not_sent')throw Error('unsafe mode');
   enable();
  }catch{disable();}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();clearError();
  if(submit.disabled)return;
  if(!form.reportValidity())return;
  const data=read();
  const problem=check(data);
  if(problem){showError(errorText[problem]||problem);return;}
  submit.disabled=true;submit.textContent='Testanfrage wird geprüft …';
  try{
   const res=await fetch(endpoint,{method:'POST',credentials:'same-origin',mode:'same-origin',cache:'no-store',
     headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});
   const body=await res.json();
   if(!res.ok||body.ok!==true||body.mode!=='test-only'||body.stored!==false||body.notified!==false||body.booking!==false||
     !/^DEMO-[0-9A-F]{8}$/.test(body.receipt))throw Error(errorText[body.code]||'Der Test konnte nicht abgeschlossen werden.');
   fields.hidden=true;submit.hidden=true;success.hidden=false;
   receipt.textContent='Testreferenz: '+body.receipt;
   success.focus();
   form.dataset.eventFormStatus='demo-confirmed';
  }catch(error){showError(error.message||'Test nicht möglich.');}
  finally{
   submit.textContent='Interesse vormerken';
   if(!submit.hidden)submit.disabled=false;
  }
 });
 reset.addEventListener('click',()=>{
  success.hidden=true;fields.hidden=false;submit.hidden=false;fields.disabled=false;submit.disabled=false;
  form.elements.namedItem('name').value='Test Gast';
  form.elements.namedItem('email').value='test@example.test';
  form.elements.namedItem('phone').value='';
  form.elements.namedItem('requested_seats').value='2';
  form.elements.namedItem('note').value='';
  form.elements.namedItem('test_data_confirmed').checked=false;
  clearError();form.dataset.eventFormStatus='synthetic-only-ready';
  form.elements.namedItem('name').focus();
 });
 prepare();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initEventInterestDemo,{once:true});
else initEventInterestDemo();
