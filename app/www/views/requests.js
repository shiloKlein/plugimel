import { esc, newId, fmtRange, fmtDateTime, toInput, fromInput, HOUR, overlap } from '../lib/util.js';
import { soldierName } from '../lib/status.js';
import { sheet, formObj, opts, toast, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { openDaySheet } from './daysheet.js';

export const TYPES = { break: 'הפסקה', exit: 'יציאה', appt: 'תור / פגישה', leave: 'חופשה' };
// An approved request becomes an absence, which the roster then avoids.
const ABSENCE_OF = { break: 'break', exit: 'other', appt: 'appt', leave: 'leave' };
const STATUS = { pending: 'ממתין', approved: 'אושר', denied: 'נדחה' };

// Inside store.update: approve ('ok'), deny ('no') or revoke an approved request.
export function decide(d, id, action) {
  const r = d.requests.find((x) => x.id === id);
  if (!r) return;
  if (action === 'ok') {
    r.status = 'approved';
    d.absences.push({ id: newId(), soldierId: r.soldierId, type: ABSENCE_OF[r.type], from: r.from, to: r.to, note: r.note, requestId: r.id });
  } else if (action === 'no') r.status = 'denied';
  else if (action === 'revoke') { r.status = 'denied'; d.absences = d.absences.filter((a) => a.requestId !== r.id); }
}

export function render(el, ctx) {
  const { st } = ctx;
  const edit = ctx.can('editRequests');
  const list = [...st.requests].sort((a, b) => b.created - a.created);
  const pending = list.filter((r) => r.status === 'pending'), done = list.filter((r) => r.status !== 'pending');
  const row = (r) => `<div class="row static">${avatar(st, st.soldiers.find((x) => x.id === r.soldierId) || { name: '?' })}<span class="grow"><div class="t">${esc(soldierName(st, r.soldierId))} · ${TYPES[r.type]}</div>
    <div class="s">${fmtRange(r.from, r.to)}${r.note ? ' · ' + esc(r.note) : ''}</div>
    <button class="btn sm ghost" data-act="day" data-ts="${r.from}" style="margin-top:6px">${icon('calendar')}ביומן</button>
    ${r.status === 'pending' ? conflicts(st, r) : ''}</span>
    ${r.status === 'pending' && edit ? `<button class="btn sm" data-act="ok" data-id="${r.id}">אשר</button><button class="btn sm danger" data-act="no" data-id="${r.id}">דחה</button>`
      : `<span class="badge ${r.status}">${STATUS[r.status]}</span>${edit && r.status === 'approved' ? `<button class="btn sm ghost" data-act="revoke" data-id="${r.id}">בטל</button>` : ''}`}</div>`;
  el.innerHTML = `
    <div class="bar"><span class="grow"></span>${edit ? `<button class="btn" data-act="add">${icon('plus')}בקשה</button>` : ''}</div>
    <h3>ממתינות (${pending.length})</h3><div class="card">${pending.length ? pending.map(row).join('') : '<p class="empty">אין בקשות ממתינות</p>'}</div>
    ${done.length ? `<h3>היסטוריה</h3><div class="card">${done.slice(0, 40).map(row).join('')}</div>` : ''}`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'add') return addSheet(ctx);
    if (b.dataset.act === 'day') return openDaySheet(ctx, +b.dataset.ts, () => render(el, ctx));
    ctx.update((d) => decide(d, id, b.dataset.act));
  };
}

function conflicts(st, r) {
  const n = st.roster.filter((x) => x.people.includes(r.soldierId) && overlap(x.start, x.end, r.from, r.to)).length;
  return n ? `<div class="s warnTxt">משובץ ל-${n} שמירות בזמן הזה</div>` : '';
}

function addSheet(ctx) {
  const { st, update } = ctx;
  const t0 = Math.ceil(Date.now() / HOUR) * HOUR;
  const s = sheet(`<h3>בקשה חדשה</h3><form>
    <label>חייל<select name="sid" required>${opts(st.soldiers.filter((x) => x.active !== false).map((x) => [x.id, x.name]))}</select></label>
    <label>סוג<select name="type">${opts(Object.entries(TYPES))}</select></label>
    <div class="two"><label>מ<input type="datetime-local" name="from" value="${toInput(t0)}" required></label><label>עד<input type="datetime-local" name="to" value="${toInput(t0 + 2 * HOUR)}" required></label></div>
    <label>הערה<input name="note" maxlength="80"></label>
    <div class="btnrow"><button class="btn">שמור</button><button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.querySelector('[data-close]').onclick = s.close;
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target), from = fromInput(f.from), to = fromInput(f.to);
    if (!(to > from)) return toast('זמן הסיום חייב להיות אחרי ההתחלה');
    update((d) => d.requests.push({ id: newId(), soldierId: f.sid, type: f.type, from, to, note: f.note, status: 'pending', created: Date.now() }));
    s.close();
  };
}
