// The sheet for one day: holiday, who is in/away and why, requests, guard list, equipment checks. Opened from the calendar and other screens.
import { esc, dayStart, DAY, fmtDay, fmtRange, fmtTime, timeRange } from '../lib/util.js';
import { ABSENCE_TYPES } from '../lib/store.js';
import { holidays, hebDateStr, isShabbat } from '../lib/hebdate.js';
import { presenceOn, jobCoverage, roundInfo, soldierName } from '../lib/status.js';
import { dayStatus, checksEnabled } from '../lib/checks.js';
import { decide, TYPES as REQ_TYPES } from './requests.js';
import { setDay } from './roster.js';
import { setCheckDay } from './checks.js';
import { sheet, avatar, toast } from '../lib/ui.js';
import { setPresence } from '../lib/presence.js';
import { openPresenceSheet, rangeFlow } from './presenceplan.js';
import { icon } from '../lib/icons.js';

let listOpen = false;   // keep the full list expanded after an action reopens the sheet
const CHECK_BADGE = { ok: 'approved', bad: 'denied', pending: 'pending', none: '' };

function everyone(ctx, present, away, canPlan) {
  const { st } = ctx;
  if (!present.length && !away.length) return '';
  const dots = (id) => (canPlan ? `<button class="btn sm ghost more" data-menu="${id}" aria-label="אפשרויות">${icon('more')}</button>` : '');
  return `<details class="all"${listOpen ? ' open' : ''}><summary>כל החיילים · <b>${present.length}</b> בבסיס · <b>${away.length}</b> מחוץ לבסיס</summary>
    ${away.length ? `<h4>מחוץ לבסיס (${away.length})</h4><div class="card">${away.map(({ s, a }) => `<div class="row static">${avatar(st, s)}<span class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(ABSENCE_TYPES[a.type] || a.type)}${a.note ? ' · ' + esc(a.note) : ''} · ${fmtRange(a.from, a.to)}</div></span>${dots(s.id)}</div>`).join('')}</div>` : ''}
    <h4>בבסיס (${present.length})</h4><div class="card">${present.map((s) => `<div class="row static">${avatar(st, s)}<span class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.place || '')}${s.place && s.job ? ' · ' : ''}${esc(s.job || '')}</div></span>${dots(s.id)}</div>`).join('') || '<p class="empty">אף אחד</p>'}</div></details>`;
}

export function openDaySheet(ctx, ts, onChange = () => {}) {
  const { st } = ctx;
  ts = dayStart(ts);
  const staff = ctx.can('viewPresence');
  const date = new Date(ts); date.setHours(12);
  const ri = roundInfo(st, ts), hol = holidays(date);
  const shifts = st.roster.filter((x) => x.start < ts + DAY && x.end > ts).sort((a, b) => a.start - b.start);
  const byPost = {};
  shifts.forEach((x) => { (byPost[x.postId] ||= []).push(x); });
  const past = ts < dayStart(Date.now());
  const canPlan = staff && !past && ctx.can('editRequests');

  let people = '';
  if (staff) {
    const { present, away } = presenceOn(st, ts);
    const cov = jobCoverage(st, present);
    const pending = st.requests.filter((r) => r.status === 'pending' && r.from < ts + DAY && r.to > ts);
    people = `
      ${ri.inRound || away.length ? `<p><b>${past ? 'היו' : 'צפי'} נוכחים: ${present.length}</b> מתוך ${present.length + away.length}</p>` : ''}
      ${pending.length ? `<h4>בקשות ממתינות (${pending.length})</h4><div class="card">${pending.map((r) => `<div class="row static"><span class="grow"><div class="t">${esc(soldierName(st, r.soldierId))} · ${REQ_TYPES[r.type]}</div><div class="s">${fmtRange(r.from, r.to)}${r.note ? ' · ' + esc(r.note) : ''}</div></span>
          ${ctx.can('editRequests') ? `<button class="btn sm" data-ok="${r.id}">אשר</button><button class="btn sm danger" data-no="${r.id}">דחה</button>` : ''}</div>`).join('')}</div>` : ''}
      ${everyone(ctx, present, away, canPlan)}
      ${cov.length ? `<h4>כיסוי תפקידים</h4><div class="cov">${cov.map((j) => `<span class="badge ${j.here === 0 ? 'denied' : 'base'}">${esc(j.job)} ${j.here}/${j.total}</span>`).join(' ')}</div>` : ''}`;
  }

  const guard = Object.keys(byPost).length ? `<h4>${past ? 'שמירות שהיו' : 'שמירות'}</h4><div class="card">${Object.entries(byPost).map(([pid, list]) => {
    const post = st.posts.find((p) => p.id === pid);
    return list.map((x) => `<div class="row static"><span class="grow"><div class="t">${esc(post ? post.name : '')} · ${timeRange(x.start, x.end)}</div><div class="s">${x.people.map((id) => esc(soldierName(st, id))).join(', ') || 'חסר'}</div></span></div>`).join('');
  }).join('')}</div>` : '<p class="muted">אין שמירות משובצות ליום הזה</p>';

  let checks = '';
  if (staff && checksEnabled(st)) {
    const rows = st.settings.checks.map((c) => ({ c, s: dayStatus(st, ts, c) })).filter((x) => x.s.state !== 'none');
    if (rows.length) checks = `<h4>בדיקות ציוד</h4><div class="card">${rows.map(({ c, s }) => `<button class="row" data-check="${c.id}"><span class="grow"><div class="t">${esc(c.name)}</div><div class="s">${s.done} מתוך ${s.total} אושרו${s.missing ? ` · ${s.missing} חסרים` : ''}</div></span><span class="badge ${CHECK_BADGE[s.state]}">${{ ok: 'תקין', bad: 'לא תקין', pending: 'ממתין' }[s.state]}</span></button>`).join('')}</div>`;
  }

  const s = sheet(`<h3>${fmtDay(ts)} · ${hebDateStr(date)}</h3>
    <p>${hol.map((h) => `<span class="badge ${h.yomTov ? 'away' : 'base'}">${esc(h.name)}</span>`).join(' ')}${isShabbat(date) ? ' <span class="badge away">שבת</span>' : ''}</p>
    <p class="muted">${ri.inRound ? `יום ${ri.n} מתוך ${ri.total} בסבב` : 'מחוץ לסבב'}</p>
    ${people}${guard}${checks}
    <div class="btnrow">${canPlan ? '<button class="btn" data-plan>תכנון נוכחות</button>' : ''}<button class="btn ghost" data-go>${icon('shield')}פתח בשמירות</button><button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-plan]')) { s.close(); openPresenceSheet(ctx, { from: ts, to: ts, onChange }); return; }
    const menu = e.target.closest('[data-menu]');
    if (menu) { listOpen = true; s.close(); return personMenu(ctx, menu.dataset.menu, ts, onChange); }
    if (e.target.closest('[data-go]')) { setDay(ts); s.close(); location.hash = 'roster'; return; }
    const c = e.target.closest('[data-check]');
    if (c) { setCheckDay(ts, c.dataset.check); s.close(); location.hash = 'checks'; return; }
    const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]');
    if (ok || no) { s.close(); ctx.update((d) => decide(d, (ok || no).dataset[ok ? 'ok' : 'no'], ok ? 'ok' : 'no')); onChange(); }
  };
  s.el.querySelector('details.all')?.addEventListener('toggle', (e) => { listOpen = e.target.open; });
  return s;
}

// The three dots next to a soldier: in/out for this day only, or a range of days.
function personMenu(ctx, sid, ts, onChange) {
  const { st } = ctx;
  const cur = st.absences.find((a) => a.soldierId === sid && a.from < ts + DAY && a.to > ts);
  const back = () => { onChange(); openDaySheet(ctx, ts, onChange); };
  const s = sheet(`<h3>${esc(soldierName(st, sid))}</h3>
    <p class="muted">${fmtDay(ts)} · ${cur ? esc(ABSENCE_TYPES[cur.type] || cur.type) + (cur.note ? ' · ' + esc(cur.note) : '') : 'בבסיס'}</p>
    <div class="btncol">
      ${cur ? '<button class="btn" data-set="present">סמן כנוכח בבסיס ביום הזה</button>' : ''}
      <h4>${cur ? 'לשנות את הסטטוס ליום הזה' : 'לסמן כמחוץ לבסיס ביום הזה'}</h4>
      <div class="chips">${Object.entries(ABSENCE_TYPES).map(([k, l]) => `<button class="chip" data-set="${k}"><span class="txt">${esc(l)}</span></button>`).join('')}</div>
      <button class="btn ghost" data-range>${icon('calendar')}טווח תאריכים…</button>
      <button class="btn ghost" data-close>סגור</button>
    </div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) { s.close(); return openDaySheet(ctx, ts, onChange); }
    if (e.target.closest('[data-range]')) { s.close(); return rangeFlow(ctx, { sid, from: ts, onDone: back }); }
    const set = e.target.closest('[data-set]');
    if (set) { ctx.update((d) => setPresence(d, sid, ts, ts + DAY, set.dataset.set)); s.close(); toast(set.dataset.set === 'present' ? 'סומן כנוכח ביום הזה' : 'עודכן ליום הזה'); back(); }
  };
}
