// Equipment transfers. A transfer is only a request until the sergeant approves it; the item changes holder at approval.
// state.transfers = [{ id, itemId, from, to, note, status: 'pending'|'approved'|'rejected', at, by, decidedAt, decidedBy }]
import { esc, newId, fmtDateTime } from '../lib/util.js';
import { soldierName } from '../lib/status.js';
import { sheet, formObj, opts, toast } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

export const pendingTransfers = (st) => (st.transfers || []).filter((t) => t.status === 'pending').length;

const label = (st, i) => `${i.type}${i.name ? ' ' + i.name : ''}${i.serial ? ' ' + i.serial : ''}`;

// Can this transfer still be applied? (the item must still be with the soldier who gave it)
export function applicable(st, t) {
  const item = st.equipment.find((i) => i.id === t.itemId);
  return !!item && item.holderId === t.from && !!t.to && t.to !== t.from;
}

// Inside store.update.
export function decideTransfer(d, id, action, who = '') {
  const t = d.transfers.find((x) => x.id === id);
  if (!t || t.status !== 'pending') return;
  if (action === 'ok') {
    const item = d.equipment.find((i) => i.id === t.itemId);
    if (!item) return;
    (item.log ||= []).push({ t: Date.now(), from: item.holderId || null, to: t.to, via: 'transfer', by: who });
    item.holderId = t.to;
    t.status = 'approved';
  } else t.status = 'rejected';
  t.decidedAt = Date.now(); t.decidedBy = who;
}

export function drawTransfers(body, ctx, edit) {
  const { st } = ctx;
  const all = [...(st.transfers || [])].sort((a, b) => b.at - a.at);
  const row = (t) => {
    const it = st.equipment.find((i) => i.id === t.itemId);
    const right = t.status === 'pending'
      ? (edit ? `<button class="btn sm" data-tr="ok" data-id="${t.id}">אשר</button><button class="btn sm danger" data-tr="no" data-id="${t.id}">דחה</button>` : '<span class="badge pending">ממתין</span>')
      : `<span class="badge ${t.status === 'approved' ? 'approved' : 'denied'}">${t.status === 'approved' ? 'אושר' : 'נדחה'}</span>`;
    return `<div class="row static"><span class="grow"><div class="t">${esc(it ? label(st, it) : 'פריט שנמחק')}</div>
      <div class="s">${esc(soldierName(st, t.from))} ← ${esc(soldierName(st, t.to))}${t.note ? ' · ' + esc(t.note) : ''} · ${fmtDateTime(t.at)}</div></span>${right}</div>`;
  };
  const pend = all.filter((t) => t.status === 'pending'), done = all.filter((t) => t.status !== 'pending').slice(0, 30);
  body.innerHTML = `${edit ? `<div class="bar"><span class="grow"></span><button class="btn" data-tr="add">${icon('plus')}העברה</button></div>` : ''}
    <p class="muted">העברת ציוד בין חיילים נספרת רק אחרי אישור הסמל.</p>
    <h3>ממתינות לאישור (${pend.length})</h3><div class="card">${pend.map(row).join('') || '<p class="empty">אין העברות ממתינות</p>'}</div>
    ${done.length ? `<h3>היסטוריה</h3><div class="card">${done.map(row).join('')}</div>` : ''}`;
  body.onclick = (e) => {
    const b = e.target.closest('[data-tr]');
    if (!b) return;
    if (b.dataset.tr === 'add') return transferSheet(ctx);
    const t = st.transfers.find((x) => x.id === b.dataset.id);
    if (b.dataset.tr === 'ok' && !applicable(st, t)) return toast('הציוד כבר לא אצל המוסר. דחה את הבקשה');
    ctx.update((d) => decideTransfer(d, b.dataset.id, b.dataset.tr, ctx.user.name));
  };
}

// Staff records a transfer a soldier told them about (soldiers will be able to send these themselves later).
function transferSheet(ctx) {
  const { st } = ctx;
  const items = st.equipment.filter((i) => i.holderId && !st.settings.gearTypes.includes(i.type));
  if (!items.length) return toast('אין ציוד חתום להעברה');
  const s = sheet(`<h3>העברת ציוד</h3><form>
    <label>פריט<select name="item">${opts(items.map((i) => [i.id, `${label(st, i)} · ${soldierName(st, i.holderId)}`]))}</select></label>
    <label>מועבר אל<select name="to">${opts(st.soldiers.filter((x) => x.active !== false).map((x) => [x.id, x.name]))}</select></label>
    <label>הערה<input name="note" maxlength="80"></label>
    <label class="chk"><input type="checkbox" name="now" checked> אשר מיד (ידעתי שזה קרה)</label>
    <div class="btnrow"><button class="btn">שמור</button><button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.querySelector('[data-close]').onclick = s.close;
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target), item = items.find((i) => i.id === f.item);
    const t = { id: newId(), itemId: item.id, from: item.holderId, to: f.to, note: f.note.trim(), status: 'pending', at: Date.now(), by: ctx.user.name };
    if (t.from === t.to) return toast('הציוד כבר אצל החייל הזה');
    ctx.update((d) => { (d.transfers ||= []).push(t); if (e.target.now.checked) decideTransfer(d, t.id, 'ok', ctx.user.name); });
    s.close(); toast(e.target.now.checked ? 'הציוד הועבר' : 'נשמר, ממתין לאישור');
  };
}
