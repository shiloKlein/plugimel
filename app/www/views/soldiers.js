import { esc, newId, timeRange, fmtDay, fullName } from '../lib/util.js';
import { QUALS, CONDITIONS, SERVICE } from '../lib/store.js';
import { statusOf } from '../lib/status.js';
import { sheet, formObj, opts, toast, confirmDlg, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { itemLabel } from './equipment.js';

let q = '';
let mode = 'list';          // 'list' | 'organize'
const sel = new Set();      // soldiers ticked in organize mode

// One soldier per line. Columns (tab from Excel, or comma): שם פרטי | שם משפחה | תפקיד | מסגרת. The last two are optional.
// A line with a single column is split at the first space (first name, rest = last name).
export function parseNames(text) {
  const out = [], seen = new Set();
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/[.‏‎]+$/g, '').trim();
    if (!line) continue;
    let first, last, job = '', place = '';
    const cols = line.split(/\t|,/).map((x) => x.trim());
    if (cols.length >= 2 && cols[0] && cols[1]) [first, last, job = '', place = ''] = cols;
    else { const one = cols.find(Boolean) || ''; const m = one.match(/^(\S+)\s+(.*)$/); [first, last] = m ? [m[1], m[2]] : [one, '']; }
    const key = `${first} ${last}`;
    if (!seen.has(key)) { seen.add(key); out.push({ first, last, job, place }); }
  }
  return out;
}

const placeRank = (st, p) => { const i = st.settings.places.indexOf(p); return i < 0 ? 99 : i; };
const listOpts = (list, cur) => opts([...(cur && !list.includes(cur) ? [cur] : []), ...list].map((x) => [x, x]), cur);

export function render(el, ctx) {
  const { st } = ctx;
  const edit = ctx.can('editSoldiers');
  if (!edit) mode = 'list';
  el.innerHTML = `
    <div class="bar"><input id="q" class="grow" type="search" placeholder="חיפוש חייל" value="${esc(q)}">
      ${edit ? `<button class="btn ghost" data-act="import">${icon('upload')}ייבוא</button><button class="btn ghost" data-act="mode">${mode === 'list' ? 'ארגון' : 'רשימה'}</button><button class="btn" data-act="add" aria-label="חייל חדש">${icon('plus')}</button>` : ''}</div>
    <div id="list"></div>`;
  const list = el.querySelector('#list');

  const draw = () => {
    const rows = st.soldiers.filter((s) => !q || `${s.name} ${s.place} ${s.job}`.includes(q));
    if (!rows.length) { list.innerHTML = `<p class="empty">${st.soldiers.length ? 'לא נמצאו חיילים' : 'אין חיילים. לחץ "ייבוא שמות" או +.'}</p>`; return; }
    if (mode === 'organize') return drawOrganize(rows);
    const groups = {};
    rows.forEach((s) => { (groups[s.place || 'ללא מסגרת'] ||= []).push(s); });
    list.innerHTML = Object.entries(groups).sort((a, b) => placeRank(st, a[0]) - placeRank(st, b[0])).map(([g, arr]) => `<h3>${esc(g)} (${arr.length})</h3><div class="card">${arr.map((s) => {
      const t = statusOf(st, s.id), n = st.equipment.filter((e) => e.holderId === s.id).length;
      return `<button class="row" data-act="open" data-id="${s.id}">${avatar(st, s)}<span class="grow"><div class="t">${esc(s.name)}${s.active === false ? ' <span class="muted">(לא פעיל)</span>' : ''}</div>
        <div class="s">${esc(s.job || 'ללא תפקיד')}${s.service && s.service !== 'full' ? ' · ' + SERVICE[s.service] : ''}${n ? ' · ' + n + ' פריטי ציוד' : ''}</div></span><span class="badge ${t.kind}">${esc(t.label)}</span></button>`;
    }).join('')}</div>`).join('');
  };

  const drawOrganize = (rows) => {
    const sorted = [...rows].sort((a, b) => placeRank(st, a.place) - placeRank(st, b.place) || a.name.localeCompare(b.name, 'he'));
    list.innerHTML = `
      <div class="card pad bulk"><b>החל על ${sel.size} מסומנים</b>
        <div class="two"><select id="bulkPlace"><option value="">מסגרת: ללא שינוי</option>${listOpts(st.settings.places, '')}</select>
        <select id="bulkJob"><option value="">תפקיד: ללא שינוי</option>${listOpts(st.settings.jobs, '')}</select></div>
        <div class="btnrow"><button class="btn" data-act="bulk">החל</button><button class="btn ghost" data-act="all">סמן הכל</button><button class="btn ghost" data-act="none">נקה</button></div></div>
      <div class="card">${sorted.map((s) => `<div class="org"><input type="checkbox" data-sel="${s.id}"${sel.has(s.id) ? ' checked' : ''}>
        ${avatar(st, s, 'sm')}<span class="grow">${esc(s.name)}</span>
        <select data-f="place" data-id="${s.id}"><option value="">מסגרת</option>${listOpts(st.settings.places, s.place)}</select>
        <select data-f="job" data-id="${s.id}"><option value="">תפקיד</option>${listOpts(st.settings.jobs, s.job)}</select></div>`).join('')}</div>`;
  };
  draw();

  el.querySelector('#q').oninput = (e) => { q = e.target.value.trim(); draw(); };
  el.onchange = (e) => {
    const t = e.target;
    if (t.dataset.sel) { t.checked ? sel.add(t.dataset.sel) : sel.delete(t.dataset.sel); const b = el.querySelector('.bulk b'); if (b) b.textContent = `החל על ${sel.size} מסומנים`; }
    if (t.dataset.f) ctx.update((d) => { d.soldiers.find((s) => s.id === t.dataset.id)[t.dataset.f] = t.value; });
  };
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'add') editSheet(ctx, null);
    if (a === 'open') detailSheet(ctx, b.dataset.id);
    if (a === 'import') importSheet(ctx);
    if (a === 'mode') { mode = mode === 'list' ? 'organize' : 'list'; render(el, ctx); }
    if (a === 'all') { st.soldiers.forEach((s) => sel.add(s.id)); render(el, ctx); }
    if (a === 'none') { sel.clear(); render(el, ctx); }
    if (a === 'bulk') {
      const place = el.querySelector('#bulkPlace').value, job = el.querySelector('#bulkJob').value;
      if (!sel.size || (!place && !job)) return toast('סמן חיילים ובחר מסגרת או תפקיד');
      ctx.update((d) => d.soldiers.filter((s) => sel.has(s.id)).forEach((s) => { if (place) s.place = place; if (job) s.job = job; }));
      toast('עודכן');
    }
  };
}

function importSheet(ctx) {
  const { st, update } = ctx;
  const s = sheet(`<h3>ייבוא שמות</h3>
    <p class="muted">הדבק מהאקסל, חייל בכל שורה. עמודות לפי הסדר: <b>שם פרטי | שם משפחה | תפקיד | מסגרת</b>. התפקיד והמסגרת לא חובה, ואפשר גם עמודה אחת של שם מלא. מה שחסר תשלים במסך "ארגון".</p>
    <form><textarea name="t" rows="8" placeholder="דני לוי&#10;יוסי כהן" required></textarea>
      <p class="muted" id="count"></p>
      <div class="btnrow"><button class="btn">ייבא</button><button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  const ta = s.el.querySelector('textarea');
  const count = () => {
    const names = parseNames(ta.value), have = new Set(st.soldiers.map((x) => x.name));
    const fresh = names.filter((n) => !have.has(fullName(n.first, n.last)));
    s.el.querySelector('#count').textContent = names.length ? `${fresh.length} חדשים${names.length - fresh.length ? `, ${names.length - fresh.length} כבר קיימים (ידולגו)` : ''}` : '';
  };
  ta.oninput = count;
  s.el.querySelector('[data-close]').onclick = s.close;
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const have = new Set(st.soldiers.map((x) => x.name));
    const fresh = parseNames(ta.value).filter((n) => !have.has(fullName(n.first, n.last)));
    if (fresh.length) mode = 'organize';
    update((d) => fresh.forEach((n) => {
      if (n.place && !d.settings.places.includes(n.place)) d.settings.places.push(n.place);
      if (n.job && !d.settings.jobs.includes(n.job)) d.settings.jobs.push(n.job);
      d.soldiers.push({ id: newId(), first: n.first, last: n.last, name: fullName(n.first, n.last), platoon: d.soldiers.at(-1)?.platoon || '', place: n.place, job: n.job, service: 'full', quals: [], phone: '', active: true, joinedAt: Date.now() });
    }));
    s.close();
    toast(`נוספו ${fresh.length} חיילים`);
  };
}

function detailSheet(ctx, id) {
  const { st } = ctx;
  const sol = st.soldiers.find((s) => s.id === id);
  if (!sol) return;
  const t = statusOf(st, id);
  const gear = st.equipment.filter((e) => e.holderId === id);
  const upcoming = st.roster.filter((x) => x.people.includes(id) && x.end > Date.now()).sort((a, b) => a.start - b.start).slice(0, 6);
  const s = sheet(`<h3>${esc(sol.name)}</h3>
    <p class="muted">${esc(sol.place || 'ללא מסגרת')} · ${esc(sol.job || 'ללא תפקיד')} · ${SERVICE[sol.service] || ''}${(sol.quals || []).length ? ' · ' + esc(sol.quals.join(', ')) : ''}</p>
    <p><span class="badge ${t.kind}">${esc(t.label)}</span></p>
    ${ctx.can('viewRequests') && sol.phone ? `<p><a class="btn ghost sm" href="tel:${esc(sol.phone)}">${icon('phone')}${esc(sol.phone)}</a></p>` : ''}
    <h4>ציוד חתום</h4>
    ${gear.length ? `<ul>${gear.map((e) => `<li>${esc(itemLabel(st, e))}${e.condition !== 'ok' ? ` <span class="bad">(${CONDITIONS[e.condition]})</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">אין</p>'}
    <h4>שמירות קרובות</h4>
    ${upcoming.length ? `<ul>${upcoming.map((x) => `<li>${fmtDay(x.start)} ${timeRange(x.start, x.end)} · ${esc((st.posts.find((p) => p.id === x.postId) || {}).name || '')}</li>`).join('')}</ul>` : '<p class="muted">אין</p>'}
    <div class="btnrow">${ctx.can('editSoldiers') ? '<button class="btn" data-edit>עריכה</button>' : ''}<button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-edit]')) { s.close(); editSheet(ctx, id); }
  };
}

function editSheet(ctx, id) {
  const { st, update } = ctx;
  const sol = id ? st.soldiers.find((s) => s.id === id) : { first: '', last: '', platoon: st.soldiers.at(-1)?.platoon || '', place: '', job: '', service: 'full', phone: '', quals: [], active: true };
  const s = sheet(`<h3>${id ? 'עריכת חייל' : 'חייל חדש'}</h3>
    <form>
      <div class="two"><label>שם פרטי<input name="first" value="${esc(sol.first)}" required></label><label>שם משפחה<input name="last" value="${esc(sol.last)}"></label></div>
      <div class="two"><label>מסגרת<select name="place"><option value="">—</option>${listOpts(st.settings.places, sol.place)}</select></label>
        <label>תפקיד<select name="job"><option value="">—</option>${listOpts(st.settings.jobs, sol.job)}</select></label></div>
      <div class="two"><label>סוג שירות<select name="service">${opts(Object.entries(SERVICE), sol.service)}</select></label><label>מחלקה<input name="platoon" value="${esc(sol.platoon)}"></label></div>
      <label>טלפון (רק לצוות)<input name="phone" type="tel" value="${esc(sol.phone)}"></label>
      <fieldset><legend>הסמכות נוספות</legend>${QUALS.map((x) => `<label class="chk"><input type="checkbox" name="q" value="${x}"${(sol.quals || []).includes(x) ? ' checked' : ''}> ${x}</label>`).join('')}</fieldset>
      <label class="chk"><input type="checkbox" name="active"${sol.active !== false ? ' checked' : ''}> פעיל (לא פעיל = לא משובץ)</label>
      <div class="btnrow"><button class="btn">שמור</button>${id ? '<button type="button" class="btn danger" data-del>מחק</button>' : ''}<button type="button" class="btn ghost" data-close>סגור</button></div>
    </form>`);
  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-del]') && await confirmDlg(`למחוק את ${sol.name}? הוא יוסר גם מהשיבוצים והציוד יהפוך לפנוי.`, 'מחק')) {
      update((d) => {
        d.soldiers = d.soldiers.filter((x) => x.id !== id);
        d.absences = d.absences.filter((x) => x.soldierId !== id);
        d.requests = d.requests.filter((x) => x.soldierId !== id);
        d.roster.forEach((x) => { x.people = x.people.filter((p) => p !== id); });
        d.equipment.forEach((x) => { if (x.holderId === id) x.holderId = null; });
        d.settings.separate = d.settings.separate.filter((p) => !p.includes(id));
      });
      s.close(); toast('נמחק');
    }
  };
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const data = { first: f.first.trim(), last: f.last.trim(), place: f.place, job: f.job, service: f.service, platoon: f.platoon.trim(), phone: f.phone.trim(), quals: [...e.target.querySelectorAll('[name=q]:checked')].map((c) => c.value), active: !!e.target.active.checked };
    data.name = fullName(data.first, data.last);
    update((d) => {
      if (id) Object.assign(d.soldiers.find((x) => x.id === id), data);
      else d.soldiers.push({ id: newId(), joinedAt: Date.now(), ...data });
    });
    s.close();
  };
}
