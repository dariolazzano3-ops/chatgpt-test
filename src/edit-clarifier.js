function clean(value, max = 4000) { return String(value || '').trim().slice(0, max); }
function hasAny(text, terms) { return terms.some((term) => text.includes(term)); }

export function analyzeEditIntent(prompt = '') {
  const raw = clean(prompt, 4000);
  const text = raw.toLowerCase();
  const reasons = [];
  const conflicts = [];
  const hasTarget = hasAny(text, ['hero','headline','überschrift','ueberschrift','subheadline','untertitel','button','cta','karte','karten','card','cards','grid','section','sektion','abschnitt','bereich','navigation','navbar','menü','header','rakete','rocket','rauch','smoke','faq','kontakt','leistungen','services','referenzen']);
  const vagueReference = /\b(das|dies|dieses|es|dort|so)\b/i.test(raw) && !hasTarget;
  const vagueStyle = hasAny(text, ['schöner','besser','moderner','cooler','hochwertiger','professioneller','irgendwie']) && !hasTarget;
  if (vagueReference) reasons.push('AMBIGUOUS_REFERENCE');
  if (vagueStyle) reasons.push('AMBIGUOUS_STYLE_DIRECTION');

  const pairs = [
    ['SIZE_CONFLICT', ['größer','groesser','riesig','massiv'], ['kleiner','reduzier','weniger groß','weniger gross']],
    ['BRIGHTNESS_CONFLICT', ['dunkler'], ['heller']],
    ['RADIUS_CONFLICT', ['runder','abgerundet','runde ecken','rounded'], ['eckiger','kantiger','weniger rund','square']],
    ['ALIGNMENT_CONFLICT', ['zentrier','mittig','center'], ['linksbündig','links ausrichten','left aligned','align left']]
  ];
  for (const [code, a, b] of pairs) if (hasAny(text, a) && hasAny(text, b)) conflicts.push(code);

  const needsClarification = reasons.length > 0 || conflicts.length > 0;
  let question = null;
  if (conflicts.length) question = 'Die Anweisung enthält widersprüchliche Änderungen. Welche Variante soll gelten?';
  else if (vagueReference) question = 'Welches Element oder welcher Bereich soll geändert werden?';
  else if (vagueStyle) question = 'Welcher Bereich soll geändert werden und was genau bedeutet die gewünschte Stilrichtung?';

  return {
    version: 1,
    needs_clarification: needsClarification,
    reasons,
    conflicts,
    question,
    safe_to_execute: !needsClarification
  };
}
