import { esc, dayStart, DAY, fmtDay } from '../lib/util.js';
import { ABSENCE_TYPES } from '../lib/store.js';
import { holidays, hebDayStr, hebDateStr, isShabbat, WEEKDAYS_SHORT } from '../lib/hebdate.js';
import { presenceOn, jobCoverage, roundInfo } from '../lib/status.js';
import { setDay } from './roster.js';
import { sheet } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

const MONTH = new Intl.DateTimeFormat('he', { month: 'long', year: 'numeric' });
let anchor = new Date(); anchor.setDate(1); anchor.setHours(12, 0, 0, 0);

const at = (y, m, d) => new Date(y, m, d, 12);

export function render(el, ctx) {
  const { st } = ctx;
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const first = at(y, m, 1), lead = first.getDay(), days = new Date(y, m + 1, 0).getDate();
  const today = dayStart(Date.now());
  const total = st.soldiers.filter((s) => s.active !== false).length;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cell blank"></div>');
  for (let d = 1; d <= days; d++) {
    const date = at(y, m, d), ts = dayStart(date);
    const ri = roundInfo(st, ts), hol = holidays(date);
    const pres = ri.inRound && total ? presenceOn(st, ts) : null;
    const gap = pres && jobCoverage(st, pres.present.concat()).some((j) => j.here === 0);
    cells.push(`<button class="cell${ri.inRound ? ' in' : ''}${ts === today ? ' today' : ''}${isShabbat(date) ? ' shabbat' : ''}${hol.some((h) => h.yomTov) ? ' yomtov' : ''}" data-ts="${ts}">
      <span class="g">${d}</span><span class="h">${hebDayStr(date)}</span>
      ${hol.length ? `<span class="hol">${esc(hol[0].name)}</span>` : ''}
      ${pres ? `<span class="n${gap ? ' gap' : ''}">${pres.present.length}</span>` : ''}</button>`);
  }
  el.innerHTML = `
    <div class="daynav"><button class="nav" data-act="prev" aria-label="חודש קודם">${icon('chevronR')}</button>
      <div class="daytitle">${MONTH.format(first)}<br><small class="muted">${esc(st.round.name)} · ${fmtDay(st.round.start)} עד ${fmtDay(st.round.end)}</small></div>
      <button class="nav" data-act="next" aria-label="חודש הבא">${icon('chevron')}</button></div>
    <div class="cal"><div class="dow">${WEEKDAYS_SHORT.map((w) => `<span>${w}</span>`).join('')}</div><div class="grid7">${cells.join('')}</div></div>
    <p class="muted legend">המספר = צפי נוכחים. אדום = אין אף אחד בתפקיד מסוים. הימים המסומנים הם ימי הסבב.</p>`;

  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act) { anchor = at(y, m + (b.dataset.act === 'next' ? 1 : -1), 1); return render(el, ctx); }
    if (b.dataset.ts) daySheet(ctx, +b.dataset.ts);
  };
}

function daySheet(ctx, ts) {
  const { st } = ctx;
  const date = new Date(ts); date.setHours(12);
  const ri = roundInfo(st, ts), hol = holidays(date);
  const { present, away } = presenceOn(st, ts);
  const cov = jobCoverage(st, present);
  const shifts = st.roster.filter((x) => x.start < ts + DAY && x.end > ts).length;
  const s = sheet(`<h3>${fmtDay(ts)} · ${hebDateStr(date)}</h3>
    <p>${hol.map((h) => `<span class="badge ${h.yomTov ? 'away' : 'base'}">${esc(h.name)}</span>`).join(' ')}${isShabbat(date) ? ' <span class="badge away">שבת</span>' : ''}</p>
    <p class="muted">${ri.inRound ? `יום ${ri.n} מתוך ${ri.total} בסבב` : 'מחוץ לסבב'}</p>
    ${ri.inRound || away.length ? `<p><b>צפי נוכחים: ${present.length}</b> מתוך ${present.length + away.length}</p>` : ''}
    ${away.length ? `<h4>לא נוכחים (${away.length})</h4><ul>${away.map(({ s: x, a }) => `<li>${esc(x.name)} · ${esc(ABSENCE_TYPES[a.type] || a.type)}</li>`).join('')}</ul>` : ''}
    ${cov.length ? `<h4>כיסוי תפקידים</h4><div class="cov">${cov.map((j) => `<span class="badge ${j.here === 0 ? 'denied' : 'base'}">${esc(j.job)} ${j.here}/${j.total}</span>`).join(' ')}</div>` : ''}
    <p class="muted">${shifts} שמירות משובצות ליום הזה</p>
    <div class="btnrow"><button class="btn" data-go>פתח שמירות ליום זה</button><button class="btn ghost" data-close>סגור</button></div>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-go]')) { setDay(ts); s.close(); location.hash = 'roster'; }
  };
}
