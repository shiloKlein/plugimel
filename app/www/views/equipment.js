import { esc, newId, fmtDateTime } from '../lib/util.js';
import { CONDITIONS } from '../lib/store.js';
import { soldierName } from '../lib/status.js';
import { sheet, formObj, opts, toast, confirmDlg, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

let tab = 'soldier', type = '', q = '';

export function render(el, ctx) {
  const { st } = ctx;
  const edit = ctx.can('editEquipment');
  const items = st.equipment;
  el.innerHTML = `
    <div class="seg"><button data-tab="sum" class="${tab === 'sum' ? 'on' : ''}">סיכום</button><button data-tab="soldier" class="${tab === 'soldier' ? 'on' : ''}">לפי חייל</button><button data-tab="items" class="${tab === 'items' ? 'on' : ''}">פריטים</button></div>
    ${edit ? `<div class="bar"><span class="grow"></span><button class="btn" data-act="add">${icon('plus')}ציוד</button></div>` : ''}
    <div id="body"></div>`;
  const body = el.querySelector('#body');

  const draw = () => {
    if (tab === 'sum') {
      const types = [...new Set([...st.settings.equipTypes, ...items.map((i) => i.type)])];
      body.innerHTML = `<div class="card">${types.map((t) => {
        const all = items.filter((i) => i.type === t);
        if (!all.length) return '';
        const signed = all.filter((i) => i.holderId).length, bad = all.filter((i) => i.condition !== 'ok').length;
        return `<button class="row" data-type="${esc(t)}"><b class="grow">${esc(t)}</b><span class="muted">סה"כ ${all.length}</span><span>חתומים ${signed}</span><span class="${all.length - signed ? 'warnTxt' : 'muted'}">פנויים ${all.length - signed}</span>${bad ? `<span class="bad">תקולים ${bad}</span>` : ''}</button>`;
      }).join('') || '<p class="empty">אין ציוד</p>'}</div>`;
    } else if (tab === 'soldier') {
      const rows = st.soldiers.filter((s) => s.active !== false);
      body.innerHTML = `<div class="card">${rows.map((s) => {
        const g = items.filter((i) => i.holderId === s.id), c = {};
        g.forEach((i) => { c[i.type] = (c[i.type] || 0) + 1; });
        return `<button class="row" data-sol="${s.id}">${avatar(st, s)}<span class="grow"><div class="t">${esc(s.name)}</div><div class="s">${Object.entries(c).map(([t, n]) => `${esc(t)}${n > 1 ? ' ×' + n : ''}`).join(' · ') || 'ללא ציוד'}</div></span>${icon('chevron', 'faint')}</button>`;
      }).join('') || '<p class="empty">אין חיילים</p>'}</div>`;
    } else {
      const rows = items.filter((i) => (!type || i.type === type) && (!q || `${i.serial} ${i.name} ${soldierName(st, i.holderId)}`.includes(q)));
      body.innerHTML = `<div class="bar"><select id="ftype" class="grow"><option value="">כל הסוגים</option>${opts([...new Set(items.map((i) => i.type))].map((t) => [t, t]), type)}</select>
        <input id="fq" type="search" placeholder="מספר / שם" value="${esc(q)}"></div>
        <div class="card">${rows.map((i) => `<button class="row" data-item="${i.id}"><span class="grow"><b>${esc(i.type)}</b> ${esc(i.name || '')} <b>${esc(i.serial || '')}</b></span>
          <span class="${i.condition !== 'ok' ? 'bad' : 'muted'}">${i.condition !== 'ok' ? CONDITIONS[i.condition] + ' · ' : ''}${i.holderId ? esc(soldierName(st, i.holderId)) : 'פנוי'}</span></button>`).join('') || '<p class="empty">לא נמצא</p>'}</div>`;
      body.querySelector('#ftype').onchange = (e) => { type = e.target.value; draw(); };
      body.querySelector('#fq').oninput = (e) => { q = e.target.value.trim(); const pos = e.target.selectionStart; draw(); const n = body.querySelector('#fq'); n.focus(); n.setSelectionRange(pos, pos); };
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

function soldierSheet(ctx, sid) {
  const { st } = ctx;
  const g = st.equipment.filter((i) => i.holderId === sid);
  const s = sheet(`<h3>${esc(soldierName(st, sid))} — חתום על</h3>
    <div class="card">${g.map((i) => `<button class="row" data-item="${i.id}"><b class="grow">${esc(i.type)} ${esc(i.name || '')}</b><b>${esc(i.serial || '')}</b>${i.condition !== 'ok' ? `<span class="bad">${CONDITIONS[i.condition]}</span>` : ''}</button>`).join('') || '<p class="empty">לא חתום על ציוד</p>'}</div>
    <div class="btnrow"><button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) s.close();
    const it = e.target.closest('[data-item]');
    if (it) { s.close(); itemSheet(ctx, it.dataset.item); }
  };
}

function itemSheet(ctx, id) {
  const { st, update } = ctx;
  const edit = ctx.can('editEquipment');
  const it = id ? st.equipment.find((i) => i.id === id) : { type: st.settings.equipTypes[0], name: '', serial: '', condition: 'ok', holderId: '', note: '' };
  const dis = edit ? '' : ' disabled';
  const types = [...new Set([...st.settings.equipTypes, it.type])];
  const s = sheet(`<h3>${id ? 'פרטי פריט' : 'ציוד חדש'}</h3><form>
    <div class="two"><label>סוג<select name="type"${dis}>${opts(types.map((t) => [t, t]), it.type)}</select></label><label>שם / דגם<input name="name" value="${esc(it.name)}"${dis}></label></div>
    <label>מספר סידורי<input name="serial" value="${esc(it.serial)}"${dis}></label>
    <div class="two"><label>מצב<select name="condition"${dis}>${opts(Object.entries(CONDITIONS), it.condition)}</select></label>
      <label>חתום על<select name="holder"${dis}><option value="">— פנוי (במחסן) —</option>${opts(st.soldiers.map((x) => [x.id, x.name]), it.holderId)}</select></label></div>
    ${id ? '' : '<label>כמות (ללא מספר סידורי)<input type="number" name="qty" min="1" max="100" value="1"></label>'}
    <label>הערה<input name="note" value="${esc(it.note)}"${dis}></label>
    ${id && it.log && it.log.length ? `<details><summary>היסטוריית חתימות</summary><ul>${it.log.slice(-8).reverse().map((l) => `<li>${fmtDateTime(l.t)}: ${esc(l.from ? soldierName(st, l.from) : 'מחסן')} ← ${esc(l.to ? soldierName(st, l.to) : 'מחסן')}</li>`).join('')}</ul></details>` : ''}
    <div class="btnrow">${edit ? '<button class="btn">שמור</button>' : ''}${edit && id ? '<button type="button" class="btn danger" data-del>מחק</button>' : ''}<button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-del]') && await confirmDlg('למחוק את הפריט מהמלאי?', 'מחק')) { update((d) => { d.equipment = d.equipment.filter((i) => i.id !== id); }); s.close(); }
  };
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    if (!edit) return;
    const f = formObj(e.target), holderId = f.holder || null;
    const data = { type: f.type, name: f.name.trim(), serial: f.serial.trim(), condition: f.condition, holderId, note: f.note.trim() };
    update((d) => {
      if (id) {
        const x = d.equipment.find((i) => i.id === id);
        if ((x.holderId || null) !== holderId) (x.log ||= []).push({ t: Date.now(), from: x.holderId || null, to: holderId });
        Object.assign(x, data);
      } else {
        const n = data.serial ? 1 : Math.max(1, Math.min(100, +f.qty || 1));
        for (let k = 0; k < n; k++) d.equipment.push({ id: newId(), ...data, log: holderId ? [{ t: Date.now(), from: null, to: holderId }] : [] });
      }
    });
    s.close(); toast('נשמר');
  };
}
