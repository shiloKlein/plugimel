import { esc, newId, fmtDay, fmtTime, fmtShort, dayStart, addDays, DAY, HOUR, toDateInput, fromDateInput, fromInput, timeRange } from '../lib/util.js';
import { generate, candidates, assess, isNight, postKind, KINDS, expandRoles, openRoles, roleCount } from '../lib/scheduler.js';
import { icon } from '../lib/icons.js';
import { soldierName } from '../lib/status.js';
import { sheet, toast, confirmDlg, formObj, opts, avatar } from '../lib/ui.js';

let day = dayStart(Date.now());
const getWho = () => { try { return localStorage.getItem('platoon.who') || ''; } catch { return ''; } };
const setWho = (v) => { try { localStorage.setItem('platoon.who', v); } catch { /* ignore */ } };

// Lets the calendar open the roster on a given day
export const setDay = (ts) => { day = dayStart(ts); };

export function render(el, ctx) {
  const { st } = ctx;
  const edit = ctx.can('editRoster');
  const who = st.soldiers.some((s) => s.id === getWho()) ? getWho() : '';
  const postIdx = (id) => st.posts.findIndex((p) => p.id === id);
  const shifts = st.roster.filter((x) => x.start < day + DAY && x.end > day && (!who || x.people.includes(who)))
    .sort((a, b) => a.start - b.start || postIdx(a.postId) - postIdx(b.postId));
  const byPost = {};
  shifts.forEach((x) => { (byPost[x.postId] ||= []).push(x); });

  const next = who ? st.roster.filter((x) => x.people.includes(who) && x.end > Date.now()).sort((a, b) => a.start - b.start)[0] : null;

  const chip = (sh, sid, a) => {
    const cls = edit ? (a.conflict ? 'bad' : a.reasons.length ? 'warn' : '') : '';
    const tip = edit ? [a.conflict, ...a.reasons].filter(Boolean).join(' · ') : '';
    const sol = st.soldiers.find((x) => x.id === sid) || { name: '?' };
    const post = st.posts.find((p) => p.id === sh.postId), ri = sh.roles && sh.roles[sid];
    const role = ri != null && post ? (expandRoles(post)[ri] || {}).label : '';
    const sub = [role, tip].filter(Boolean).join(' · ');
    return `<button class="chip ${cls}" data-act="seat" data-shift="${sh.id}" data-sid="${sid}" title="${esc(tip)}">${avatar(st, sol, 'sm')}<span class="txt">${esc(sol.name)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
  };

  const dayShifts = st.roster.filter((x) => x.start < day + DAY && x.end > day);
  let gaps = 0, reds = 0, yellows = 0;
  if (edit) for (const sh of dayShifts) {
    const post = st.posts.find((p) => p.id === sh.postId);
    gaps += Math.max(0, (post && roleCount(post) ? roleCount(post) : sh.need) - sh.people.length);
    const as = assess(st, sh);
    for (const sid of sh.people) { if (as[sid].conflict) reds++; else if (as[sid].reasons.length) yellows++; }
  }
  const summary = edit && (gaps || reds || yellows)
    ? `<div class="notice">${icon('alert')}<span>ביום הזה: ${[gaps && `<b>${gaps}</b> מקומות חסרים`, reds && `<b>${reds}</b> שיבוצים בעייתיים (אדום)`, yellows && `<b>${yellows}</b> אזהרות (צהוב)`].filter(Boolean).join(' · ')}</span></div>` : '';

  el.innerHTML = `
    <div class="daynav"><button class="nav" data-act="prev" aria-label="יום קודם">${icon('chevronR')}</button>
      <div class="daytitle">${fmtDay(day)}${day === dayStart(Date.now()) ? ' · היום' : ''}</div>
      <button class="nav" data-act="next" aria-label="יום הבא">${icon('chevron')}</button></div>
    <div class="bar wrap">
      <select id="who" class="grow"><option value="">כל החיילים</option>${opts(st.soldiers.map((s) => [s.id, s.name]), who)}</select>
      <button class="btn ghost" data-act="today">היום</button><button class="btn ghost" data-act="share" aria-label="שתף">${icon('share')}</button>
      ${edit ? `<button class="btn" data-act="add">${icon('plus')}הוסף</button><button class="btn ghost" data-act="gen">${icon('sync')}אוטומטי</button>` : ''}
    </div>
    ${summary}
    ${next ? `<div class="notice">${icon('clock')}<span>השמירה הבאה של ${esc(soldierName(st, who))}: <b>${fmtDay(next.start)} ${timeRange(next.start, next.end)}</b> · ${esc((st.posts.find((p) => p.id === next.postId) || {}).name || '')}</span></div>` : ''}
    ${shifts.length ? Object.entries(byPost).sort((a, b) => postIdx(a[0]) - postIdx(b[0])).map(([pid, list]) => {
      const post = st.posts.find((p) => p.id === pid);
      return `<div class="post-h"><b>${esc(post ? post.name : 'עמדה שנמחקה')}</b>${post ? `<span>${postKind(post) !== 'guard' ? KINDS[postKind(post)] + ' · ' : ''}${roleCount(post) || post.people} אנשים${postKind(post) === 'guard' ? ` · ${post.shiftHours} ש׳` : ''}${post.qual ? ' · ' + esc(post.qual) : ''}</span>` : ''}</div><div class="card">${list.map((sh) => {
        const as = assess(st, sh);
        const open = post && roleCount(post) ? openRoles(post, sh) : null;
        const empties = open ? 0 : Math.max(0, sh.need - sh.people.length);
        const night = isNight(sh.start, sh.end, st.settings);
        return `<div class="shift${night ? ' night' : ''}"><div class="time">${timeRange(sh.start, sh.end)}<small>${night ? icon('moon') + 'לילה' : ''}${sh.locked && postKind(post) === 'guard' ? icon('lock') + 'נעול' : ''}</small></div><div class="chips">
          ${sh.people.map((sid) => chip(sh, sid, as[sid])).join('')}
          ${open ? open.map((r) => `<button class="chip empty" data-act="seat" data-shift="${sh.id}" data-sid="" data-role="${r.i}">חסר${r.label ? ' · ' + esc(r.label) : ''}</button>`).join('') : ''}
          ${Array.from({ length: empties }, () => `<button class="chip empty" data-act="seat" data-shift="${sh.id}" data-sid="">חסר</button>`).join('')}
          ${sh.note ? `<span class="note muted">${esc(sh.note)}</span>` : ''}</div></div>`;
      }).join('')}</div>`;
    }).join('') : `<p class="empty">${st.roster.length ? 'אין שמירות ביום הזה' : 'עדיין אין שיבוץ.'}${edit ? ' לחץ "צור שיבוץ".' : ''}</p>`}
    ${edit && !st.posts.length ? '<p class="notice">אין עמדות. הגדר עמדות בלשונית "הגדרות".</p>' : ''}`;

  el.onchange = (e) => { if (e.target.id === 'who') { setWho(e.target.value); render(el, ctx); } };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'prev') day = addDays(day, -1);
    else if (a === 'next') day = addDays(day, 1);
    else if (a === 'today') day = dayStart(Date.now());
    else if (a === 'share') return share(st, shifts, byPost);
    else if (a === 'gen') return genSheet(ctx);
    else if (a === 'add') return shiftSheet(ctx, null);
    else if (a === 'seat') return edit && seatSheet(ctx, b.dataset.shift, b.dataset.sid, b.dataset.role);
    render(el, ctx);
  };
}

function share(st, shifts, byPost) {
  if (!shifts.length) return toast('אין מה לשתף');
  const lines = [`שמירות – ${fmtDay(day)}`];
  for (const [pid, list] of Object.entries(byPost)) {
    lines.push('', `*${(st.posts.find((p) => p.id === pid) || {}).name || ''}*`);
    list.forEach((sh) => lines.push(`${timeRange(sh.start, sh.end)}: ${sh.people.map((id) => soldierName(st, id)).join(', ') || 'חסר'}`));
  }
  const text = lines.join('\n');
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast('הועתק ללוח'), () => toast('לא ניתן להעתיק'));
}

function genSheet(ctx) {
  const { st, update } = ctx;
  const s = sheet(`<h3>יצירת שיבוץ אוטומטי</h3>
    <form><div class="two"><label>מתאריך<input type="date" name="from" value="${toDateInput(day)}" required></label>
      <label>מספר ימים<input type="number" name="days" min="1" max="14" value="7" required></label></div>
      <p class="muted">שיבוצים שנערכו ידנית (🔒) נשמרים. השאר יוחלפו בטווח הזה.</p>
      <div class="btnrow"><button class="btn">צור</button><button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.querySelector('[data-close]').onclick = s.close;
  s.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const from = fromDateInput(f.from), to = addDays(from, Math.min(14, Math.max(1, +f.days)));
    if (!st.posts.length) return toast('אין עמדות מוגדרות');
    if (st.roster.some((x) => !x.locked && x.start >= from && x.start < to) && !(await confirmDlg('יש כבר שיבוץ בטווח הזה. להחליף אותו?', 'החלף'))) return;
    let res;
    update((d) => { d.roster = res = generate(d, from, to); });
    s.close();
    const missing = res.filter((x) => x.start >= from && x.start < to).reduce((n, x) => n + Math.max(0, x.need - x.people.length), 0);
    day = from;
    toast(missing ? `נוצר. חסרים ${missing} מקומות – אין מספיק חיילים זמינים` : 'השיבוץ נוצר');
  };
}

const ago = (t, ref) => { const h = Math.round(Math.abs(ref - t) / HOUR * 10) / 10; return `${h} ש׳`; };

// Placing somebody by hand: everybody is listed with the full picture, nothing is blocked, only warned.
function seatSheet(ctx, shiftId, sid, role) {
  const { st, update } = ctx;
  const sh = st.roster.find((x) => x.id === shiftId);
  if (!sh) return;
  const post = st.posts.find((p) => p.id === sh.postId);
  const roles = expandRoles(post);
  const roleIdx = role !== undefined && role !== '' ? +role : sid && sh.roles && sh.roles[sid] != null ? sh.roles[sid] : null;
  const seatRole = roleIdx != null ? roles[roleIdx] : null;
  const qual = seatRole ? seatRole.qual : post && post.qual;
  const cur = sid ? assess(st, sh)[sid] : null;
  const list = candidates(st, sh, { excludeId: sid || null, qual }).filter((r) => r.soldier.id !== sid);
  const seated = sh.people.filter((p) => p !== sid);
  const row = (r) => {
    const parts = [`${Math.round(r.points)} נק׳${r.partial ? ' *' : ''}`];
    if (r.prev) parts.push(`קודמת הסתיימה ${fmtTime(r.prev.end)} (לפני ${ago(r.prev.end, sh.start)})`);
    if (r.next) parts.push(`הבאה ${fmtShort(r.next.start)} ${fmtTime(r.next.start)}`);
    if (!r.prev && !r.next) parts.push('בלי שמירות אחרות');
    const day = r.today.length ? `<div class="s">באותו יום: ${r.today.map((x) => `${timeRange(x.start, x.end)} ${esc(x.post)}`).join(' · ')}</div>` : '';
    return `<button class="row${r.conflict ? ' dim' : ''}" data-pick="${r.soldier.id}" data-name="${esc(r.soldier.name + ' ' + (r.soldier.job || ''))}">${avatar(st, r.soldier)}<span class="grow">
      <div class="t">${esc(r.soldier.name)} <span class="muted">${esc(r.soldier.job || '')}</span></div>
      <div class="s">${parts.join(' · ')}</div>${day}
      ${r.conflict ? `<div class="s bad">${esc(r.conflict)}</div>` : ''}${r.reasons.length ? `<div class="s warnTxt">${esc(r.reasons.join(' · '))}</div>` : ''}</span></button>`;
  };
  const s = sheet(`<h3>${esc(post ? post.name : '')} · ${fmtShort(sh.start)} ${timeRange(sh.start, sh.end)}</h3>
    <p class="muted">${post ? KINDS[postKind(post)] : ''}${seatRole && seatRole.label ? ` · מקום: <b>${esc(seatRole.label)}</b>` : ''}${qual ? ` · דורש: ${esc(qual)}` : ''}${seated.length ? ` · כבר בשמירה: ${seated.map((id) => esc(soldierName(st, id))).join(', ')}` : ''}</p>
    ${sid ? `<p><b>${esc(soldierName(st, sid))}</b>${cur && (cur.conflict || cur.reasons.length) ? ` <span class="${cur.conflict ? 'bad' : 'warnTxt'}">${esc([cur.conflict, ...cur.reasons].filter(Boolean).join(' · '))}</span>` : ''}</p>` : '<p class="muted">מקום פנוי</p>'}
    <h4>${sid ? 'להחליף ב' : 'לשבץ את'} <small class="muted">(מי שפנוי למעלה. אפשר לבחור גם מי שמסומן באדום, תתבקש לאשר)</small></h4>
    <input id="q" type="search" placeholder="חיפוש חייל" autocomplete="off">
    <div class="card" id="cands">${list.length ? list.map(row).join('') : '<p class="empty">אין חיילים</p>'}</div>
    <div class="btnrow">${sid ? '<button class="btn danger" data-rm>הסר מהשמירה</button>' : ''}<button class="btn ghost" data-edit>ערוך משמרת</button><button class="btn ghost" data-close>סגור</button></div>`);
  s.el.oninput = (e) => {
    if (e.target.id !== 'q') return;
    const q = e.target.value.trim();
    s.el.querySelectorAll('[data-pick]').forEach((r) => { r.hidden = !!q && !r.dataset.name.includes(q); });
  };
  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-edit]')) { s.close(); return shiftSheet(ctx, shiftId); }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const c = list.find((r) => r.soldier.id === pick.dataset.pick);
      if (c && c.conflict && !(await confirmDlg(`${c.soldier.name}: ${c.conflict}. לשבץ בכל זאת?`, 'שבץ'))) return;
      update((d) => {
        const x = d.roster.find((r) => r.id === shiftId), np = pick.dataset.pick;
        x.roles ||= {};
        if (sid) { x.people = x.people.map((p) => (p === sid ? np : p)); if (x.roles[sid] != null) { x.roles[np] = x.roles[sid]; delete x.roles[sid]; } } else x.people.push(np);
        if (roleIdx != null) x.roles[np] = roleIdx;
        x.locked = true;
      });
      s.close();
    }
    if (e.target.closest('[data-rm]')) {
      update((d) => { const x = d.roster.find((r) => r.id === shiftId); x.people = x.people.filter((p) => p !== sid); if (x.roles) delete x.roles[sid]; x.locked = true; });
      s.close();
    }
  };
}

// Create or edit one shift by hand (a guard slot, a patrol or a mission at any time).
function shiftSheet(ctx, shiftId, { setDay: showDay } = {}) {
  const { st, update } = ctx;
  const sh = shiftId ? st.roster.find((x) => x.id === shiftId) : null;
  if (shiftId && !sh) return;
  if (!st.posts.length) return toast('הגדר קודם עמדה, סיור או יזומה בהגדרות');
  const post0 = sh ? st.posts.find((p) => p.id === sh.postId) || st.posts[0] : st.posts.find((p) => postKind(p) !== 'guard') || st.posts[0];
  const start0 = sh ? sh.start : dayStart(day) + Math.min(23, new Date().getHours() + 1) * HOUR;
  const end0 = sh ? sh.end : start0 + post0.shiftHours * HOUR;
  const need0 = sh ? sh.need : roleCount(post0) || post0.people;
  const s = sheet(`<h3>${sh ? 'עריכת משמרת' : 'הוספת שמירה / סיור / יזומה'}</h3><form>
    <label>עמדה<select name="post">${opts(st.posts.map((p) => [p.id, `${p.name}${postKind(p) === 'guard' ? '' : ' (' + KINDS[postKind(p)] + ')'}`]), post0.id)}</select></label>
    <label>תאריך<input type="date" name="date" value="${toDateInput(start0)}" required></label>
    <div class="two"><label>התחלה<input type="time" name="from" value="${fmtTime(start0)}" required></label><label>סיום<input type="time" name="to" value="${fmtTime(end0)}" required></label></div>
    <label>מספר אנשים<input type="number" name="need" min="1" max="30" value="${need0}"></label>
    <label>הערה (למשל מטרת היזומה)<input name="note" maxlength="80" value="${esc(sh ? sh.note || '' : '')}"></label>
    <p class="muted" id="hint"></p>
    <div class="btnrow"><button class="btn">${sh ? 'שמור' : 'הוסף ושבץ'}</button>${sh ? '<button type="button" class="btn danger" data-del>מחק</button>' : ''}<button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  const form = s.el.querySelector('form');
  const hint = () => {
    const p = st.posts.find((x) => x.id === form.post.value), n = roleCount(p);
    form.need.readOnly = !!n; if (n) form.need.value = n;
    s.el.querySelector('#hint').textContent = n ? `הרכב: ${p.roles.map((r) => `${r.n} ${r.label}`).join(', ')}` : '';
  };
  form.post.onchange = () => {
    const p = st.posts.find((x) => x.id === form.post.value);
    if (!sh && p && form.from.value) {
      const [h, m] = form.from.value.split(':').map(Number), e = new Date(0, 0, 0, h, m + p.shiftHours * 60);
      form.to.value = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
    }
    if (p) form.need.value = roleCount(p) || p.people;
    hint();
  };
  hint();
  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-del]') && await confirmDlg('למחוק את המשמרת?', 'מחק')) { update((d) => { d.roster = d.roster.filter((x) => x.id !== shiftId); }); s.close(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const start = fromInput(`${f.date}T${f.from}`);
    let end = fromInput(`${f.date}T${f.to}`);
    if (end <= start) end += DAY;
    const post = st.posts.find((p) => p.id === f.post), need = roleCount(post) || Math.max(1, +f.need || 1);
    const id = shiftId || newId();
    update((d) => {
      let x = shiftId && d.roster.find((r) => r.id === shiftId);
      if (!x) { x = { id, postId: post.id, start, end, need, people: [], roles: {}, locked: true, note: '' }; d.roster.push(x); }
      if (x.postId !== post.id) { x.postId = post.id; x.roles = {}; }
      Object.assign(x, { start, end, need, note: f.note.trim(), locked: true });
      if (x.people.length > need) { x.people = x.people.slice(0, need); x.roles = Object.fromEntries(Object.entries(x.roles || {}).filter(([k]) => x.people.includes(k))); }
    });
    if (showDay) showDay(start); else day = dayStart(start);
    s.close();
    if (!shiftId) {
      const fresh = ctx.st.roster.find((r) => r.id === id);
      if (fresh) seatSheet(ctx, id, '', roleCount(post) ? String(openRoles(post, fresh)[0].i) : undefined);
    }
  };
}
