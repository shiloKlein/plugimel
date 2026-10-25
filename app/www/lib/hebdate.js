// Hebrew calendar helpers, built on the browser's built-in Intl Hebrew calendar.
// Holidays follow the Israel schedule (one day of Yom Tov).

const HEB_FMT = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric', month: 'long', day: 'numeric' });
const GREG_MONTH_FMT = new Intl.DateTimeFormat('he', { month: 'long' });
const GREG_SHORT_FMT = new Intl.DateTimeFormat('he', { month: 'short' });

const MONTHS_HE = {
  'Tishri': 'תשרי', 'Heshvan': 'חשון', 'Kislev': 'כסלו', 'Tevet': 'טבת', 'Shevat': 'שבט',
  'Adar I': 'אדר א׳', 'Adar': 'אדר', 'Adar II': 'אדר ב׳', 'Nisan': 'ניסן', 'Iyar': 'אייר',
  'Sivan': 'סיון', 'Tamuz': 'תמוז', 'Av': 'אב', 'Elul': 'אלול',
};

export const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export function dateKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  return r;
}

export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12);
}

const infoCache = new Map();

export function hebInfo(date) {
  const key = dateKey(date);
  let info = infoCache.get(key);
  if (!info) {
    const parts = HEB_FMT.formatToParts(parseKey(key));
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const month = get('month');
    info = { day: Number(get('day')), month, monthHe: MONTHS_HE[month] || month, year: Number(get('year') || get('relatedYear')) };
    infoCache.set(key, info);
  }
  return info;
}

export function gematria(n) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  let s = '';
  let h = Math.floor(n / 100);
  while (h > 4) { s += 'ת'; h -= 4; }
  s += hundreds[h];
  const r = n % 100;
  if (r === 15) s += 'טו';
  else if (r === 16) s += 'טז';
  else s += tens[Math.floor(r / 10)] + ones[r % 10];
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}

export const hebDayStr = (date) => gematria(hebInfo(date).day);
export const hebYearStr = (year) => gematria(year % 1000);

export function hebDateStr(date) {
  const i = hebInfo(date);
  return `${gematria(i.day)} ב${i.monthHe} ${hebYearStr(i.year)}`;
}

export function gregDateStr(date) {
  return `${date.getDate()} ב${GREG_MONTH_FMT.format(date)} ${date.getFullYear()}`;
}

export const gregMonthShort = (date) => GREG_SHORT_FMT.format(date);

// First and last day of the Hebrew month that contains `date`.
export function hebMonthRange(date) {
  const { month, year } = hebInfo(date);
  const same = (d) => { const i = hebInfo(d); return i.month === month && i.year === year; };
  let start = date;
  while (same(addDays(start, -1))) start = addDays(start, -1);
  let end = date;
  while (same(addDays(end, 1))) end = addDays(end, 1);
  return { start, end };
}

// Gregorian months covered by a range, e.g. "ספטמבר–אוקטובר 2026".
export function gregRangeStr(start, end) {
  const m1 = GREG_MONTH_FMT.format(start);
  const m2 = GREG_MONTH_FMT.format(end);
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();
  if (y1 !== y2) return `${m1} ${y1} – ${m2} ${y2}`;
  return m1 === m2 ? `${m1} ${y1}` : `${m1}–${m2} ${y1}`;
}

function chanukahNight(date) {
  for (let i = 0; i < 8; i++) {
    const h = hebInfo(addDays(date, -i));
    if (h.month === 'Kislev' && h.day === 25) return i + 1;
  }
  return 0;
}

// Returns [{ name, yomTov }] for the given civil date (Israel schedule).
export function holidays(date) {
  const { day: d, month: m } = hebInfo(date);
  const dow = date.getDay();
  const out = [];
  const add = (name, yomTov = false) => out.push({ name, yomTov });

  if (d === 30 || (d === 1 && m !== 'Tishri')) add('ראש חודש');

  switch (m) {
    case 'Elul':
      if (d === 29) add('ערב ראש השנה');
      break;
    case 'Tishri':
      if (d === 1 || d === 2) add('ראש השנה', true);
      if ((d === 3 && dow !== 6) || (d === 4 && dow === 0)) add('צום גדליה');
      if (d === 9) add('ערב יום כיפור');
      if (d === 10) add('יום כיפור', true);
      if (d === 14) add('ערב סוכות');
      if (d === 15) add('סוכות', true);
      if (d >= 16 && d <= 20) add('חול המועד סוכות');
      if (d === 21) add('הושענא רבה');
      if (d === 22) add('שמיני עצרת · שמחת תורה', true);
      break;
    case 'Tevet':
      if (d === 10) add('עשרה בטבת');
      break;
    case 'Shevat':
      if (d === 15) add('ט״ו בשבט');
      break;
    case 'Adar':
    case 'Adar II':
      if ((d === 13 && dow !== 6) || (d === 11 && dow === 4)) add('תענית אסתר');
      if (d === 14) add('פורים');
      if (d === 15) add('שושן פורים');
      break;
    case 'Adar I':
      if (d === 14) add('פורים קטן');
      break;
    case 'Nisan':
      if (d === 14) add('ערב פסח');
      if (d === 15) add('פסח', true);
      if (d >= 16 && d <= 20) add('חול המועד פסח');
      if (d === 21) add('שביעי של פסח', true);
      break;
    case 'Iyar':
      if (d === 18) add('ל״ג בעומר');
      break;
    case 'Sivan':
      if (d === 5) add('ערב שבועות');
      if (d === 6) add('שבועות', true);
      break;
    case 'Tamuz':
      if ((d === 17 && dow !== 6) || (d === 18 && dow === 0)) add('י״ז בתמוז');
      break;
    case 'Av':
      if ((d === 9 && dow !== 6) || (d === 10 && dow === 0)) add('תשעה באב');
      if (d === 15) add('ט״ו באב');
      break;
  }

  const night = chanukahNight(date);
  if (night) add(`חנוכה · נר ${gematria(night)}`);

  return out;
}

export const isShabbat = (date) => date.getDay() === 6;
export const isYomTov = (date) => holidays(date).some((h) => h.yomTov);
export const isRestDay = (date) => isShabbat(date) || isYomTov(date);

// Chol HaMoed, Hoshana Raba included.
export function isCholHamoed(date) {
  const { day: d, month: m } = hebInfo(date);
  return (m === 'Tishri' && d >= 16 && d <= 21) || (m === 'Nisan' && d >= 16 && d <= 20);
}
// Days tefillin are worn (Israel custom: not on Shabbat, Yom Tov or Chol HaMoed).
export const isTefillinDay = (date) => !isRestDay(date) && !isCholHamoed(date);
