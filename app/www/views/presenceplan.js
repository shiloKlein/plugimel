// Plan who is in/out by date, from today on. One sheet, opened from the calendar, a day, or a soldier:
// pick soldiers, a status, first and last day (whole days), and it is applied to all of them.
import { esc, dayStart, DAY, toDateInput, fromDateInput, fmtShort, fmtDay } from '../lib/util.js';
import { hebDayStr, WEEKDAYS_SHORT } from '../lib/hebdate.js';
import { icon } from '../lib/icons.js';
import { ABSENCE_TYPES } from '../lib/store.js';
import { setPresence, dayRange, upcomingAbsences } from '../lib/presence.js';
import { soldierName } from '../lib/status.js';
import { sheet, toast, formObj, opts, avatar } from '../lib/ui.js';

const rangeText = (a) => (dayStart(a.from) === dayStart(a.to - 1) ? fmtShort(a.from) : `${fmtShort(a.from)} – ${fmtShort(a.to - 1)}`);

// opts: { sids: preselected soldier ids, from, to: timestamps (default today), only: list just these soldiers' plans, onChange }
export function openPresenceSheet(ctx, o = {}) {
  const { st, update } = ctx;
  const today = dayStart(Date.now());
  const sids = o.sids || [];
  const from = Math.max(today, dayStart(o.from ?? today)), to = Math.max(from, dayStart(o.to ?? from));
  const soldiers = st.soldiers.filter((s) => s.active !== false);
  const plans = upcomingAbsences(st, Date.now(), o.only ? sids : null);
  const s = sheet(`<h3>תכנון נוכחות</h3>
    <p class="muted">קובעים מי נוכח ומי לא, לפי תאריכים, מהיום והלאה.</p>
    <form>
      <label>לפי מסגרת (מסמן את כולם)<select name="place"><option value="">— בחר —</option>${opts(st.settings.places.map((p) => [p, p]))}</select></label>
      <input id="q" type="search" placeholder="חיפוש חייל" autocomplete="off">
      <div class="card pick">${soldiers.map((x) => `<label class="chk row" data-name="${esc(x.name + ' ' + (x.job || ''))}" data-place="${esc(x.place || '')}"><input type="checkbox" name="s" value="${x.id}"${sids.includes(x.id) ? ' checked' : ''}>${avatar(st, x, 'sm')}<span class="grow"><span class="t">${esc(x.name)}</span> <span class="muted">${esc(x.job || '')}</span></span></label>`).join('') || '<p class="empty">אין חיילים</p>'}</div>
      <p class="muted" id="cnt"></p>
      <label>סטטוס<select name="type">${opts([...Object.entries(ABSENCE_TYPES), ['present', 'נוכח (מבטל היעדרות)']], o.type || 'leave')}</select></label>
      <div class="two"><label>מתאריך<input type="date" name="from" min="${toDateInput(today)}" value="${toDateInput(from)}" required></label>
        <label>עד תאריך (כולל)<input type="date" name="to" min="${toDateInput(today)}" value="${toDateInput(to)}" required></label></div>
      <label>הערה<input name="note" maxlength="80"></label>
      <div class="btnrow"><button class="btn">שמור</button><button type="button" class="btn ghost" data-close>סגור</button></div>
    </form>
    ${plans.length ? `<h4>${o.only ? 'מתוכנן לחייל' : 'היעדרויות מתוכננות'} (${plans.length})</h4><div class="card">${plans.slice(0, 40).map((a) => `<div class="row static"><span class="grow"><div class="t">${esc(soldierName(st, a.soldierId))} · ${esc(ABSENCE_TYPES[a.type] || a.type)}</div><div class="s">${rangeText(a)}${a.note ? ' · ' + esc(a.note) : ''}</div></span><button class="btn sm ghost" data-del="${a.id}">בטל</button></div>`).join('')}</div>` : ''}`);
  const form = s.el.querySelector('form');
  const count = () => { s.el.querySelector('#cnt').textContent = `נבחרו ${form.querySelectorAll('[name=s]:checked').length} חיילים`; };
  count();
  form.place.onchange = () => {
    if (!form.place.value) return;
    form.querySelectorAll('.pick [data-place]').forEach((r) => { if (r.dataset.place === form.place.value) r.querySelector('input').checked = true; });
    count();
  };
  form.onchange = (e) => { if (e.target.name === 's') count(); };
  s.el.querySelector('#q').oninput = (e) => {
    const q = e.target.value.trim();
    form.querySelectorAll('.pick [data-name]').forEach((r) => { r.hidden = !!q && !r.dataset.name.includes(q); });
  };
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    const del = e.target.closest('[data-del]');
    if (del) {
      const a = st.absences.find((x) => x.id === del.dataset.del);
      if (!a) return;
      // only the part from today on is cancelled; days already gone stay in the history
      update((d) => setPresence(d, a.soldierId, Math.max(a.from, today), a.to, 'present'));
      s.close(); toast('בוטל'); if (o.onChange) o.onChange();
      openPresenceSheet(ctx, o);
    }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const picked = [...form.querySelectorAll('[name=s]:checked')].map((c) => c.value);
    if (!picked.length) return toast('בחר לפחות חייל אחד');
    const first = fromDateInput(f.from), last = fromDateInput(f.to);
    if (first < today) return toast('אפשר לערוך רק מהיום והלאה');
    if (last < first) return toast('תאריך הסיום לפני ההתחלה');
    const [a, b] = dayRange(first, last);
    update((d) => picked.forEach((id) => setPresence(d, id, a, b, f.type, f.note.trim())));
    s.close();
    toast(f.type === 'present' ? `סומנו כנוכחים: ${picked.length}` : `נשמר ל-${picked.length} חיילים`);
    if (o.onChange) o.onChange();
  };
  return s;
}

// ---- Range flow for one soldier: pick first and last day on a calendar, then confirm the status.
const MONTH = new Intl.DateTimeFormat('he', { month: 'long', year: 'numeric' });

export function rangeFlow(ctx, { sid, from, onDone = () => {} }) {
  pickRange(ctx, { sid, from, onDone });
}

function pickRange(ctx, { sid, from, to = null, onDone }) {
  const { st } = ctx;
  const today = dayStart(Date.now());
  let a = Math.max(today, dayStart(from ?? today)), b = to;
  const anchor = new Date(a); anchor.setDate(1); anchor.setHours(12, 0, 0, 0);
  const s = sheet('<div id="rp"></div>');
  const box = s.el.querySelector('#rp');
  const lo = () => (b == null ? a : Math.min(a, b)), hi = () => (b == null ? a : Math.max(a, b));
  const draw = () => {
    const y = anchor.getFullYear(), m = anchor.getMonth(), lead = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const cells = Array.from({ length: lead }, () => '<div class="cell blank"></div>');
    for (let d = 1; d <= days; d++) {
      const ts = dayStart(new Date(y, m, d, 12)), past = ts < today, edge = ts === lo() || ts === hi(), mid = ts > lo() && ts < hi();
      cells.push(`<button type="button" class="cell pk in${edge ? ' sel' : ''}${mid ? ' rng' : ''}${ts === today ? ' today' : ''}" data-ts="${ts}"${past ? ' disabled' : ''}><span class="g">${d}</span><span class="h">${hebDayStr(new Date(ts + 12 * 3600e3))}</span></button>`);
    }
    box.innerHTML = `<h3>${esc(soldierName(st, sid))} · בחירת טווח</h3>
      <p class="muted">${b == null ? 'נבחר יום התחלה. לחץ על יום הסיום (או על אותו יום לבחירת יום בודד).' : 'לחץ על יום כדי להתחיל בחירה מחדש.'}</p>
      <div class="daynav"><button type="button" class="nav" data-m="-1" aria-label="חודש קודם">${icon('chevronR')}</button><div class="daytitle">${MONTH.format(anchor)}</div><button type="button" class="nav" data-m="1" aria-label="חודש הבא">${icon('chevron')}</button></div>
      <div class="cal"><div class="dow">${WEEKDAYS_SHORT.map((w) => `<span>${w}</span>`).join('')}</div><div class="grid7">${cells.join('')}</div></div>
      <p><b>${fmtDay(lo())}${hi() !== lo() ? ' עד ' + fmtDay(hi()) : ''}</b> <span class="muted">(${Math.round((hi() - lo()) / DAY) + 1} ימים)</span></p>
      <div class="btnrow"><button type="button" class="btn" data-next>המשך</button><button type="button" class="btn ghost" data-close>ביטול</button></div>`;
  };
  draw();
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-next]')) { s.close(); return confirmRange(ctx, { sid, a: lo(), b: hi(), onDone }); }
    const mv = e.target.closest('[data-m]');
    if (mv) { anchor.setMonth(anchor.getMonth() + +mv.dataset.m); return draw(); }
    const c = e.target.closest('[data-ts]');
    if (!c) return;
    const t = +c.dataset.ts;
    if (b != null) { a = t; b = null; } else b = t;
    draw();
  };
}

function confirmRange(ctx, { sid, a, b, onDone }) {
  const { st, update } = ctx;
  const cur = st.absences.find((x) => x.soldierId === sid && x.from < b + DAY && x.to > a);
  const s = sheet(`<h3>אישור שינוי נוכחות</h3>
    <p><b>${esc(soldierName(st, sid))}</b><br>${fmtDay(a)}${b !== a ? ' עד ' + fmtDay(b) : ''} <span class="muted">(${Math.round((b - a) / DAY) + 1} ימים)</span></p>
    ${cur ? `<p class="muted">בטווח הזה כבר יש: ${esc(ABSENCE_TYPES[cur.type] || cur.type)}. השינוי יחליף את זה בימים שנבחרו.</p>` : ''}
    <form><label>סטטוס בימים האלה<select name="type">${opts([['present', 'נוכח בבסיס'], ...Object.entries(ABSENCE_TYPES)], 'leave')}</select></label>
      <label>הערה<input name="note" maxlength="80"></label>
      <div class="btnrow"><button class="btn">אשר</button><button type="button" class="btn ghost" data-back>חזרה לבחירת תאריכים</button></div></form>`);
  s.el.querySelector('[data-back]').onclick = () => { s.close(); pickRange(ctx, { sid, from: a, to: b, onDone }); };
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    update((d) => setPresence(d, sid, a, b + DAY, f.type, f.note.trim()));
    s.close(); toast('נוכחות עודכנה'); onDone();
  };
}
