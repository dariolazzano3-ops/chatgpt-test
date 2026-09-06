const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function timezoneParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const out = {};
  for (const part of parts) if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out;
}

function validTimezone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function addLocalDays(parts, amount) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function zonedMidnightUtc(parts, timeZone) {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  let guess = desired;
  for (let i = 0; i < 4; i += 1) {
    const actual = timezoneParts(guess, timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = desired - represented;
    guess += delta;
    if (Math.abs(delta) < 1000) break;
  }
  return new Date(guess).toISOString();
}

export function inferJarvisCalendarWindowV1(message = '', options = {}) {
  const timeZone = validTimezone(clean(options.timezone, 120)) ? clean(options.timezone, 120) : 'Europe/Berlin';
  const now = options.now ? new Date(options.now) : new Date();
  if (!Number.isFinite(now.getTime())) return { ok: false, error: 'JARVIS_CALENDAR_NOW_INVALID' };

  const local = timezoneParts(now.getTime(), timeZone);
  const text = clean(message, 4000).toLowerCase();
  let offset = 0;
  if (/übermorgen|day after tomorrow/.test(text)) offset = 2;
  else if (/morgen|tomorrow/.test(text)) offset = 1;

  const startLocal = addLocalDays(local, offset);
  const endLocal = addLocalDays(local, offset + 1);

  return {
    ok: true,
    schema: 'aurentara.jarvis.calendar-window.v1',
    timezone: timeZone,
    calendar_id: 'primary',
    time_min: zonedMidnightUtc(startLocal, timeZone),
    time_max: zonedMidnightUtc(endLocal, timeZone),
    max_results: 25,
    day_offset: offset
  };
}
