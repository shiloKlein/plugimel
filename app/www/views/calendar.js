import { esc, dayStart, fmtDay, DAY } from '../lib/util.js';
import { holidays, hebDayStr, isShabbat, WEEKDAYS_SHORT } from '../lib/hebdate.js';
import { presenceOn, jobCoverage, roundInfo } from '../lib/status.js';
import { dayOverall } from '../lib/checks.js';
import { openDaySheet } from './daysheet.js';
import { icon } from '../lib/icons.js';

const MONTH = new Intl.DateTimeFormat('he', { month: 'long', year: 'numeric' });
let anchor = new Date(); anchor.setDate(1); anchor.setHours(12, 0, 0, 0);

const at = (y, m, d) => new Date(y, m, d, 12);
export const showMonth = (ts) => { const d = new Date(ts); anchor = at(d.getFullYear(), d.getMonth(), 1); };

export function render(el, ctx) {
  const { st } = ctx;
  const staff = ctx.can('viewPresence');
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const first = at(y, m, 1), lead = first.getDay(), days = new Date(y, m + 1, 0).getDate();
  const today = dayStart(Date.now());
  const total = st.soldiers.filter((s) => s.active !== false).length;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cell blank"></div>');
  for (let d = 1; d <= days; d++) {
    const date = at(y, m, d), ts = dayStart(date);
    const ri = roundInfo(st, ts), hol = holidays(date);
    const pres = staff && ri.inRound && total ? presenceOn(st, ts) : null;
    const gap = pres && jobCoverage(st, pres.present).some((j) => j.here === 0);
    const pend = staff && st.requests.some((r) => r.status === 'pending' && r.from < ts + DAY && r.to > ts);
    const chk = staff ? dayOverall(st, ts) : 'none';
    const hasShift = st.roster.some((x) => x.start < ts + DAY && x.end > ts);
    cells.push(`<button class="cell${ri.inRound ? ' in' : ''}${ts === today ? ' today' : ''}${isShabbat(date) ? ' shabbat' : ''}${hol.some((h) => h.yomTov) ? ' yomtov' : ''}" data-ts="${ts}">
      <span class="g">${d}</span><span class="h">${hebDayStr(date)}</span>
      ${hol.length ? `<span class="hol">${esc(hol[0].name)}</span>` : ''}
      <span class="dots">${hasShift ? '<i class="dt guard"></i>' : ''}${pend ? '<i class="dt pend"></i>' : ''}${chk !== 'none' ? `<i class="dt c-${chk}"></i>` : ''}</span>
      ${pres ? `<span class="n${gap ? ' gap' : ''}">${pres.present.length}</span>` : ''}</button>`);
  }
  el.innerHTML = `
    <div class="daynav"><button class="nav" data-act="prev" aria-label="חודש קודם">${icon('chevronR')}</button>
      <div class="daytitle">${MONTH.format(first)}<br><small class="muted">${esc(st.round.name)} · ${fmtDay(st.round.start)} עד ${fmtDay(st.round.end)}</small></div>
      <button class="nav" data-act="next" aria-label="חודש הבא">${icon('chevron')}</button></div>
    <div class="cal"><div class="dow">${WEEKDAYS_SHORT.map((w) => `<span>${w}</span>`).join('')}</div><div class="grid7">${cells.join('')}</div></div>
    <div class="legend muted"><span><i class="dt guard"></i> יש שמירות</span>${staff ? '<span><i class="dt pend"></i> בקשה ממתינה</span><span><i class="dt c-ok"></i> בדיקת ציוד תקינה</span><span><i class="dt c-bad"></i> לא תקינה</span><span><b>12</b> צפי נוכחים (אדום = תפקיד בלי אף אחד)</span>' : ''}</div>`;

  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act) { anchor = at(y, m + (b.dataset.act === 'next' ? 1 : -1), 1); return render(el, ctx); }
    if (b.dataset.ts) openDaySheet(ctx, +b.dataset.ts, () => render(el, ctx));
  };
}
