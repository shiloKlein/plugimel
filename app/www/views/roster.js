import { esc, fmtDay, fmtTime, fmtShort, dayStart, addDays, DAY, toDateInput, fromDateInput, timeRange } from '../lib/util.js';
import { generate, rank, assess, isNight } from '../lib/scheduler.js';
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
    return `<button class="chip ${cls}" data-act="seat" data-shift="${sh.id}" data-sid="${sid}" title="${esc(tip)}">${avatar(st, sol, 'sm')}<span class="txt">${esc(sol.name)}${tip ? `<small>${esc(tip)}</small>` : ''}</span></button>`;
  };

  el.innerHTML = `
    <div class="daynav"><button class="nav" data-act="prev" aria-label="יום קודם">${icon('chevronR')}</button>
      <div class="daytitle">${fmtDay(day)}${day === dayStart(Date.now()) ? ' · היום' : ''}</div>
      <button class="nav" data-act="next" aria-label="יום הבא">${icon('chevron')}</button></div>
    <div class="bar">
      <select id="who" class="grow"><option value="">כל החיילים</option>${opts(st.soldiers.map((s) => [s.id, s.name]), who)}</select>
      <button class="btn ghost" data-act="today">היום</button><button class="btn ghost" data-act="share" aria-label="שתף">${icon('share')}</button>
      ${edit ? `<button class="btn" data-act="gen">${icon('sync')}צור שיבוץ</button>` : ''}
    </div>
    ${next ? `<div class="notice">${icon('clock')}<span>השמירה הבאה של ${esc(soldierName(st, who))}: <b>${fmtDay(next.start)} ${timeRange(next.start, next.end)}</b> · ${esc((st.posts.find((p) => p.id === next.postId) || {}).name || '')}</span></div>` : ''}
    ${shifts.length ? Object.entries(byPost).sort((a, b) => postIdx(a[0]) - postIdx(b[0])).map(([pid, list]) => {
      const post = st.posts.find((p) => p.id === pid);
      return `<div class="post-h"><b>${esc(post ? post.name : 'עמדה שנמחקה')}</b>${post ? `<span>${post.people} אנשים · ${post.shiftHours} ש׳${post.qual ? ' · ' + esc(post.qual) : ''}</span>` : ''}</div><div class="card">${list.map((sh) => {
        const as = assess(st, sh);
        const empties = Math.max(0, sh.need - sh.people.length);
        const night = isNight(sh.start, sh.end, st.settings);
        return `<div class="shift${night ? ' night' : ''}"><div class="time">${timeRange(sh.start, sh.end)}<small>${night ? icon('moon') + 'לילה' : ''}${sh.locked ? icon('lock') + 'נעול' : ''}</small></div><div class="chips">
          ${sh.people.map((sid) => chip(sh, sid, as[sid])).join('')}
          ${Array.from({ length: empties }, () => `<button class="chip empty" data-act="seat" data-shift="${sh.id}" data-sid="">חסר</button>`).join('')}</div></div>`;
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
    else if (a === 'seat') return edit && seatSheet(ctx, b.dataset.shift, b.dataset.sid);
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

function seatSheet(ctx, shiftId, sid) {
  const { st, update } = ctx;
  const sh = st.roster.find((x) => x.id === shiftId);
  if (!sh) return;
  const post = st.posts.find((p) => p.id === sh.postId);
  const cur = sid ? assess(st, sh)[sid] : null;
  const ranked = rank(st, sh, st.roster, { excludeId: sid || null }).filter((r) => r.soldier.id !== sid).slice(0, 12);
  const s = sheet(`<h3>${esc(post ? post.name : '')} · ${fmtShort(sh.start)} ${timeRange(sh.start, sh.end)}</h3>
    ${sid ? `<p><b>${esc(soldierName(st, sid))}</b>${cur && (cur.conflict || cur.reasons.length) ? ` <span class="${cur.conflict ? 'bad' : 'warnTxt'}">${esc([cur.conflict, ...cur.reasons].filter(Boolean).join(' · '))}</span>` : ''}</p>` : '<p class="muted">מקום פנוי</p>'}
    <h4>${sid ? 'החלפה מומלצת' : 'מומלצים'} <small class="muted">(פחות נקודות = מתאים יותר)</small></h4>
    <div class="card">${ranked.length ? ranked.map((r) => `<button class="row" data-pick="${r.soldier.id}">${avatar(st, r.soldier)}<span class="grow"><div class="t">${esc(r.soldier.name)}</div><div class="s">${esc(r.soldier.job || '')}${r.reasons.length ? ` <span class="warnTxt">· ${esc(r.reasons.join(' · '))}</span>` : ''}</div></span><span class="muted">${Math.round(r.points)} נק׳${r.partial ? ' *' : ''}</span></button>`).join('') : '<p class="empty">אין חיילים זמינים</p>'}</div>
    <div class="btnrow">${sid ? '<button class="btn danger" data-rm>הסר מהשמירה</button>' : ''}<button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      update((d) => {
        const x = d.roster.find((r) => r.id === shiftId);
        if (sid) x.people = x.people.map((p) => (p === sid ? pick.dataset.pick : p)); else x.people.push(pick.dataset.pick);
        x.locked = true;
      });
      s.close();
    }
    if (e.target.closest('[data-rm]')) {
      update((d) => { const x = d.roster.find((r) => r.id === shiftId); x.people = x.people.filter((p) => p !== sid); x.locked = true; });
      s.close();
    }
  };
}
