// The sheet for one day: holiday, who is in/away and why, requests, guard list, equipment checks. Opened from the calendar and other screens.
import { esc, dayStart, DAY, fmtDay, fmtRange, fmtTime, timeRange } from '../lib/util.js';
import { ABSENCE_TYPES } from '../lib/store.js';
import { holidays, hebDateStr, isShabbat } from '../lib/hebdate.js';
import { presenceOn, jobCoverage, roundInfo, soldierName } from '../lib/status.js';
import { dayStatus, checksEnabled } from '../lib/checks.js';
import { decide, TYPES as REQ_TYPES } from './requests.js';
import { setDay } from './roster.js';
import { setCheckDay } from './checks.js';
import { sheet, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

const CHECK_BADGE = { ok: 'approved', bad: 'denied', pending: 'pending', none: '' };

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

  let people = '';
  if (staff) {
    const { present, away } = presenceOn(st, ts);
    const cov = jobCoverage(st, present);
    const pending = st.requests.filter((r) => r.status === 'pending' && r.from < ts + DAY && r.to > ts);
    people = `
      ${ri.inRound || away.length ? `<p><b>${past ? 'היו' : 'צפי'} נוכחים: ${present.length}</b> מתוך ${present.length + away.length}</p>` : ''}
      ${pending.length ? `<h4>בקשות ממתינות (${pending.length})</h4><div class="card">${pending.map((r) => `<div class="row static"><span class="grow"><div class="t">${esc(soldierName(st, r.soldierId))} · ${REQ_TYPES[r.type]}</div><div class="s">${fmtRange(r.from, r.to)}${r.note ? ' · ' + esc(r.note) : ''}</div></span>
          ${ctx.can('editRequests') ? `<button class="btn sm" data-ok="${r.id}">אשר</button><button class="btn sm danger" data-no="${r.id}">דחה</button>` : ''}</div>`).join('')}</div>` : ''}
      ${away.length ? `<h4>לא נוכחים (${away.length})</h4><div class="card">${away.map(({ s, a }) => `<div class="row static">${avatar(st, s)}<span class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(ABSENCE_TYPES[a.type] || a.type)}${a.note ? ' · ' + esc(a.note) : ''} · ${fmtRange(a.from, a.to)}</div></span></div>`).join('')}</div>` : ''}
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
    <div class="btnrow"><button class="btn" data-go>${icon('shield')}פתח בשמירות</button><button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-go]')) { setDay(ts); s.close(); location.hash = 'roster'; return; }
    const c = e.target.closest('[data-check]');
    if (c) { setCheckDay(ts, c.dataset.check); s.close(); location.hash = 'checks'; return; }
    const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]');
    if (ok || no) { s.close(); ctx.update((d) => decide(d, (ok || no).dataset[ok ? 'ok' : 'no'], ok ? 'ok' : 'no')); onChange(); }
  };
  return s;
}
