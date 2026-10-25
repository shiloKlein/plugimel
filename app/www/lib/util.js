export const HOUR = 3600e3;
export const DAY = 24 * HOUR;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const fullName = (first, last) => [first, last].filter(Boolean).join(' ');
export const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

const pad = (n) => String(n).padStart(2, '0');
export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const fmtTime = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtShort = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
export const fmtDay = (t) => { const d = new Date(t); return `יום ${WEEKDAYS[d.getDay()]} ${fmtShort(t)}`; };
// Isolated left-to-right so numbers like 00:00–04:00 don't flip inside Hebrew text
const ltr = (s) => '⁦' + s + '⁩';
export const fmtDateTime = (t) => ltr(`${fmtShort(t)} ${fmtTime(t)}`);
export const timeRange = (a, b) => ltr(`${fmtTime(a)}–${fmtTime(b)}`);
export const fmtRange = (a, b) => ltr(dayStart(a) === dayStart(b - 1) ? `${fmtShort(a)} ${fmtTime(a)}–${fmtTime(b)}` : `${fmtShort(a)} ${fmtTime(a)} – ${fmtShort(b)} ${fmtTime(b)}`);

// <input type="datetime-local"> / <input type="date"> helpers (local time)
export const toInput = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const toDateInput = (t) => toInput(t).slice(0, 10);
export const fromInput = (s) => new Date(s).getTime();
export const fromDateInput = (s) => new Date(s + 'T00:00').getTime();
