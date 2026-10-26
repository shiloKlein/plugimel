import { esc, newId, fmtDateTime } from '../lib/util.js';
import { CONDITIONS } from '../lib/store.js';
import { soldierName } from '../lib/status.js';
import { sheet, formObj, opts, toast, confirmDlg, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { gearIcon } from '../lib/gearicons.js';
import { drawTransfers, pendingTransfers } from './transfers.js';

// Two kinds of equipment:
//  - numbered (צלם): one record per item, with a serial number  (settings.equipTypes)
//  - counted personal gear (חתימות): one record per type and holder, with a quantity  (settings.gearTypes)
let tab = 'soldier', type = '', q = '', sq = '', stat = '';
const STATS = [['', 'הכל'], ['signed', 'חתום'], ['store', 'במחסן'], ['bad', 'תקול']];
const keepFocus = (body, sel, fn) => { const inp = body.querySelector(sel), pos = inp.selectionStart; fn(); const n = body.querySelector(sel); n.focus(); n.setSelectionRange(pos, pos); };

export const isCounted = (st, t) => st.settings.gearTypes.includes(t);
const qtyOf = (i) => (i.qty == null ? 1 : i.qty);
export const itemLabel = (st, i) => (isCounted(st, i.type) ? `${i.type} ×${qtyOf(i)}` : `${i.type}${i.name ? ' ' + i.name : ''}${i.serial ? ' ' + i.serial : ''}`);

// "נשק, וסט ×2" style summary of what a soldier holds
function holdings(st, sid) {
  const c = {};
  st.equipment.filter((i) => i.holderId === sid).forEach((i) => { c[i.type] = (c[i.type] || 0) + (isCounted(st, i.type) ? qtyOf(i) : 1); });
  return Object.entries(c).map(([t, n]) => `${esc(t)}${n > 1 ? ' ×' + n : ''}`).join(' · ');
}

export function render(el, ctx) {
  const { st } = ctx;
  const edit = ctx.can('editEquipment');
  const items = st.equipment;
  const hasGear = st.settings.gearTypes.length > 0;
  if (tab === 'gear' && !hasGear) tab = 'soldier';
  const tabs = [['sum', 'סיכום'], ['soldier', 'לפי חייל'], ['items', 'פריטים'], ...(hasGear ? [['gear', 'חתימות']] : []), ['transfers', 'העברות' + (pendingTransfers(st) ? ' (' + pendingTransfers(st) + ')' : '')]];
  el.innerHTML = `
    <div class="seg">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${edit && tab !== 'gear' && tab !== 'transfers' ? `<div class="bar"><span class="grow"></span><button class="btn" data-act="add">${icon('plus')}ציוד</button></div>` : ''}
    <div id="body"></div>`;
  const body = el.querySelector('#body');

  const draw = () => {
    if (tab === 'sum') {
      const types = [...new Set([...st.settings.equipTypes, ...st.settings.gearTypes, ...items.map((i) => i.type)])];
      body.innerHTML = `<div class="card">${types.map((t) => {
        const all = items.filter((i) => i.type === t);
        if (!all.length) return '';
        const n = (list) => list.reduce((a, i) => a + (isCounted(st, t) ? qtyOf(i) : 1), 0);
        const total = n(all), signed = n(all.filter((i) => i.holderId)), bad = all.filter((i) => i.condition !== 'ok').length;
        return `<button class="row" data-type="${esc(t)}"><b class="grow">${esc(t)}</b><span class="muted">סה"כ ${total}</span><span>חתומים ${signed}</span><span class="${total - signed ? 'warnTxt' : 'muted'}">במחסן ${total - signed}</span>${bad ? `<span class="bad">תקולים ${bad}</span>` : ''}</button>`;
      }).join('') || '<p class="empty">אין ציוד</p>'}</div>`;
    } else if (tab === 'soldier') {
      const hit = (s) => !sq || s.name.includes(sq) || st.equipment.some((i) => i.holderId === s.id && `${i.type} ${i.name} ${i.serial}`.includes(sq));
      const rows = st.soldiers.filter((s) => s.active !== false && hit(s));
      const places = [...new Set(rows.map((s) => s.place || ''))];
      const row = (s) => `<button class="row" data-sol="${s.id}">${avatar(st, s)}<span class="grow"><div class="t">${esc(s.name)}</div><div class="s">${holdings(st, s.id) || 'ללא ציוד'}</div></span>${icon('chevron', 'faint')}</button>`;
      body.innerHTML = `<div class="bar"><input id="sq" type="search" placeholder="שם חייל או מספר צלם" value="${esc(sq)}"></div>${places.length ? places.map((p) => `${places.length > 1 ? `<div class="post-h"><b>${esc(p || 'ללא מסגרת')}</b></div>` : ''}<div class="card">${rows.filter((s) => (s.place || '') === p).map(row).join('')}</div>`).join('') : '<p class="empty">לא נמצא</p>'}`;
      body.querySelector('#sq').oninput = (e) => { sq = e.target.value.trim(); keepFocus(body, '#sq', draw); };
    } else if (tab === 'transfers') {
      drawTransfers(body, ctx, edit);
    } else if (tab === 'gear') {
      const cols = st.settings.gearTypes, rows = st.soldiers.filter((s) => s.active !== false);
      const get = (sid, t) => items.find((i) => i.type === t && i.holderId === sid);
      const sum = (t) => items.filter((i) => i.type === t && i.holderId).reduce((a, i) => a + qtyOf(i), 0);
      body.innerHTML = `<p class="muted">כמות ציוד אישי לכל חייל. ${edit ? 'לחץ על מספר כדי לשנות.' : ''}</p><div class="gridwrap card"><table class="gear"><thead><tr><th></th>${cols.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((s) => `<tr><th>${esc(s.name)}</th>${cols.map((t) => { const r = get(s.id, t); const v = r ? qtyOf(r) : 0; return `<td>${edit ? `<input type="number" inputmode="numeric" min="0" max="99" value="${v || ''}" placeholder="–" data-s="${s.id}" data-t="${esc(t)}">` : (v || '–')}</td>`; }).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><th>סה"כ</th>${cols.map((t) => `<td><b>${sum(t) || '–'}</b></td>`).join('')}</tr></tfoot></table></div>`;
      if (edit) body.querySelectorAll('input[data-s]').forEach((inp) => { inp.onchange = () => setQty(ctx, inp.dataset.s, inp.dataset.t, Math.max(0, Math.min(99, parseInt(inp.value, 10) || 0))); });
    } else {
      const rows = items.filter((i) => (!type || i.type === type) && (!q || `${i.serial} ${i.name} ${i.type} ${soldierName(st, i.holderId)}`.includes(q))
        && (!stat || (stat === 'signed' ? i.holderId : stat === 'store' ? !i.holderId : i.condition !== 'ok')));
      body.innerHTML = `<div class="bar"><select id="ftype" class="grow"><option value="">כל הסוגים</option>${opts([...new Set(items.map((i) => i.type))].map((t) => [t, t]), type)}</select>
        <input id="fq" type="search" placeholder="מספר / שם" value="${esc(q)}"></div>
        <div class="seg sm">${STATS.map(([k, l]) => `<button data-stat="${k}" class="${stat === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <p class="muted">${rows.length} פריטים</p>
        <div class="card">${rows.map((i) => `<button class="row" data-item="${i.id}"><span class="grow"><div class="t">${esc(itemLabel(st, i))}</div></span>
          <span class="${i.condition !== 'ok' ? 'bad' : 'muted'}">${i.condition !== 'ok' ? CONDITIONS[i.condition] + ' · ' : ''}${i.holderId ? esc(soldierName(st, i.holderId)) : 'במחסן'}</span></button>`).join('') || '<p class="empty">לא נמצא</p>'}</div>`;
      body.querySelector('#ftype').onchange = (e) => { type = e.target.value; draw(); };
      body.querySelector('#fq').oninput = (e) => { q = e.target.value.trim(); keepFocus(body, '#fq', draw); };
      body.querySelectorAll('[data-stat]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); stat = b.dataset.stat; draw(); }; });
    }
  };
  draw();

  el.onclick = (e) => {
    const t = e.target.closest('[data-tab],[data-act],[data-type],[data-sol],[data-item]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; return render(el, ctx); }
    if (t.dataset.act === 'add') return itemSheet(ctx, null);
    if (t.dataset.type) { tab = 'items'; type = t.dataset.type; return render(el, ctx); }
    if (t.dataset.sol) return soldierSheet(ctx, t.dataset.sol);
    if (t.dataset.item) return itemSheet(ctx, t.dataset.item);
  };
}

// Counted gear: one record per (type, holder). 0 removes it.
function setQty(ctx, sid, t, n) {
  ctx.update((d) => {
    const r = d.equipment.find((i) => i.type === t && i.holderId === sid);
    if (r && n === 0) d.equipment = d.equipment.filter((i) => i !== r);
    else if (r) { if (qtyOf(r) !== n) { (r.log ||= []).push({ t: Date.now(), from: sid, to: sid, qty: n }); r.qty = n; } }
    else if (n > 0) d.equipment.push({ id: newId(), type: t, name: '', serial: '', qty: n, condition: 'ok', holderId: sid, note: '', log: [{ t: Date.now(), from: null, to: sid, qty: n }] });
  });
}

function soldierSheet(ctx, sid) {
  const { st, update } = ctx;
  const edit = ctx.can('editEquipment');
  const g = st.equipment.filter((i) => i.holderId === sid);
  const s = sheet(`<h3>${esc(soldierName(st, sid))} — חתום על</h3>
    <div class="card">${g.map((i) => `<div class="row static"><button class="grow lnk" data-item="${i.id}"><b>${esc(itemLabel(st, i))}</b>${i.condition !== 'ok' ? ` <span class="bad">${CONDITIONS[i.condition]}</span>` : ''}</button>${edit ? `<button class="btn sm ghost" data-ret="${i.id}">החזר למחסן</button>` : ''}</div>`).join('') || '<p class="empty">לא חתום על ציוד</p>'}</div>
    ${edit ? `<button class="btn block" data-addtoggle>${icon('plus')}הוסף ציוד</button><div class="typegrid" id="tg" hidden>${st.settings.equipTypes.map((t) => `<button class="tg" data-addtype="${esc(t)}">${gearIcon(t)}<span>${esc(t)}</span></button>`).join('')}</div><p class="muted" id="tgh" hidden>ציוד אישי (וסט, קסדה...) מסמנים בלשונית "חתימות".</p>` : ''}
    <div class="btnrow">${edit && st.equipment.some((i) => !i.holderId && !isCounted(st, i.type)) ? '<button class="btn ghost" data-sign>חתום מהמחסן</button>' : ''}<button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-sign]')) { s.close(); return signSheet(ctx, sid); }
    if (e.target.closest('[data-addtoggle]')) { const g = s.el.querySelector('#tg'); g.hidden = !g.hidden; s.el.querySelector('#tgh').hidden = g.hidden; if (!g.hidden) g.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const at = e.target.closest('[data-addtype]');
    if (at) { s.close(); return itemSheet(ctx, null, { type: at.dataset.addtype, holderId: sid }); }
    const ret = e.target.closest('[data-ret]');
    if (ret) {
      update((d) => { const x = d.equipment.find((i) => i.id === ret.dataset.ret); (x.log ||= []).push({ t: Date.now(), from: sid, to: null }); x.holderId = null; });
      s.close(); toast('הוחזר למחסן'); return soldierSheet(ctx, sid);
    }
    const it = e.target.closest('[data-item]');
    if (it) { s.close(); itemSheet(ctx, it.dataset.item); }
  };
}

// Sign numbered items from the warehouse to a soldier: pick a type, tap the items.
let signType = '';
function signSheet(ctx, sid) {
  const { st, update } = ctx;
  const free = st.equipment.filter((i) => !i.holderId && !isCounted(st, i.type));
  const types = [...new Set(free.map((i) => i.type))];
  if (!types.length) { toast('אין ציוד פנוי במחסן. הוסף ציוד בכפתור "ציוד"'); return soldierSheet(ctx, sid); }
  if (!types.includes(signType)) signType = types[0];
  const list = free.filter((i) => i.type === signType);
  const s = sheet(`<h3>חתימה על ציוד · ${esc(soldierName(st, sid))}</h3>
    <label>סוג<select id="stype">${opts(types.map((t) => [t, `${t} (${free.filter((i) => i.type === t).length} במחסן)`]), signType)}</select></label>
    <div class="card pick">${list.map((i) => `<button class="row" data-sign="${i.id}"><b class="grow">${esc(itemLabel(st, i))}</b><span class="${i.condition !== 'ok' ? 'bad' : 'muted'}">${i.condition !== 'ok' ? CONDITIONS[i.condition] : ''}</span></button>`).join('')}</div>
    <div class="btnrow"><button class="btn ghost" data-close>סיום</button></div>`);
  s.el.querySelector('#stype').onchange = (e) => { signType = e.target.value; s.close(); signSheet(ctx, sid); };
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) { s.close(); return soldierSheet(ctx, sid); }
    const b = e.target.closest('[data-sign]');
    if (b) {
      update((d) => { const x = d.equipment.find((i) => i.id === b.dataset.sign); (x.log ||= []).push({ t: Date.now(), from: null, to: sid }); x.holderId = sid; });
      toast('נחתם'); s.close(); signSheet(ctx, sid);
    }
  };
}

function itemSheet(ctx, id, preset = {}) {
  const { st, update } = ctx;
  const edit = ctx.can('editEquipment');
  const it = id ? st.equipment.find((i) => i.id === id) : { type: st.settings.equipTypes[0] || st.settings.gearTypes[0] || '', name: '', serial: '', qty: 1, condition: 'ok', holderId: '', note: '', ...preset };
  const dis = edit ? '' : ' disabled';
  const all = [...new Set([...st.settings.equipTypes, ...st.settings.gearTypes, it.type])].filter(Boolean);
  const typeOpts = (sel) => `<optgroup label="ציוד עם צלם">${opts(st.settings.equipTypes.map((t) => [t, t]), sel)}</optgroup><optgroup label="ציוד אישי (כמות)">${opts(st.settings.gearTypes.map((t) => [t, t]), sel)}</optgroup>${all.some((t) => !st.settings.equipTypes.includes(t) && !st.settings.gearTypes.includes(t)) ? `<option value="${esc(it.type)}" selected>${esc(it.type)}</option>` : ''}`;
  const s = sheet(`<h3>${id ? 'פרטי פריט' : 'ציוד חדש'}${!id && preset.holderId ? ' · ' + esc(soldierName(st, preset.holderId)) : ''}</h3>${!id && preset.type ? `<div class="gbig">${gearIcon(preset.type)}</div>` : ''}<form>
    <label>סוג<select name="type"${dis}>${typeOpts(it.type)}</select></label>
    <div data-numbered><div class="${id ? 'two' : ''}"><label>דגם / שם<input name="name" value="${esc(it.name)}"${dis}></label>
      ${id ? `<label>מספר סידורי<input name="serial" value="${esc(it.serial)}"${dis}></label>` : ''}</div>
      ${id ? '' : '<label>מספרים סידוריים (אחד בכל שורה, אפשר להדביק מאקסל)<textarea name="serials" rows="3"></textarea></label>'}</div>
    <div data-counted><label>כמות<input type="number" name="qty" min="1" max="99" value="${qtyOf(it)}"${dis}></label></div>
    <div class="two"><label>מצב<select name="condition"${dis}>${opts(Object.entries(CONDITIONS), it.condition)}</select></label>
      <label>חתום על / אחראי<select name="holder"${dis}><option value="">— במחסן —</option>${opts(st.soldiers.map((x) => [x.id, x.name]), it.holderId)}</select></label></div>
    <label>הערה<input name="note" value="${esc(it.note)}"${dis}></label>
    ${id && it.log && it.log.length ? `<details><summary>היסטוריית חתימות</summary><ul>${it.log.slice(-8).reverse().map((l) => `<li>${fmtDateTime(l.t)}: ${esc(l.from ? soldierName(st, l.from) : 'מחסן')} ← ${esc(l.to ? soldierName(st, l.to) : 'מחסן')}${l.qty ? ' (×' + l.qty + ')' : ''}</li>`).join('')}</ul></details>` : ''}
    <div class="btnrow">${edit ? '<button class="btn">שמור</button>' : ''}${edit && id ? '<button type="button" class="btn danger" data-del>מחק</button>' : ''}<button type="button" class="btn ghost" data-close>סגור</button></div></form>`);

  const form = s.el.querySelector('form');
  const syncKind = () => {   // show the serial fields or the quantity field, depending on the type
    const counted = isCounted(st, form.type.value);
    form.querySelector('[data-numbered]').hidden = counted;
    form.querySelector('[data-counted]').hidden = !counted;
  };
  form.type.onchange = syncKind; syncKind();

  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-del]') && await confirmDlg('למחוק את הפריט מהמלאי?', 'מחק')) { update((d) => { d.equipment = d.equipment.filter((i) => i.id !== id); }); s.close(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!edit) return;
    const f = formObj(form), holderId = f.holder || null, counted = isCounted(st, f.type);
    const base = { type: f.type, condition: f.condition, holderId, note: f.note.trim() };
    update((d) => {
      if (id) {
        const x = d.equipment.find((i) => i.id === id);
        if ((x.holderId || null) !== holderId) (x.log ||= []).push({ t: Date.now(), from: x.holderId || null, to: holderId });
        Object.assign(x, base, counted ? { qty: Math.max(1, +f.qty || 1), name: '', serial: '' } : { name: (f.name || '').trim(), serial: (f.serial || '').trim() });
      } else if (counted) {
        const qty = Math.max(1, Math.min(99, +f.qty || 1));
        const r = d.equipment.find((i) => i.type === f.type && (i.holderId || null) === holderId);
        if (r) r.qty = qty; else d.equipment.push({ id: newId(), ...base, name: '', serial: '', qty, log: holderId ? [{ t: Date.now(), from: null, to: holderId, qty }] : [] });
      } else {
        const serials = (f.serials || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        const list = serials.length ? serials : [''];
        for (const serial of list) d.equipment.push({ id: newId(), ...base, name: (f.name || '').trim(), serial, log: holderId ? [{ t: Date.now(), from: null, to: holderId }] : [] });
      }
    });
    s.close(); toast('נשמר');
  };
}
