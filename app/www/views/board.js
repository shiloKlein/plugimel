import { esc, fmtDateTime, fmtTime, toInput, fromInput, HOUR } from '../lib/util.js';
import { ABSENCE_TYPES } from '../lib/store.js';
import { statusOf, roundInfo } from '../lib/status.js';
import { sheet, formObj, opts, toast, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

let platoon = '';

export function render(el, ctx) {
  const { st } = ctx;
  const now = Date.now();
  const platoons = [...new Set(st.soldiers.map((s) => s.platoon).filter(Boolean))];
  const rows = st.soldiers.filter((s) => s.active !== false && (!platoon || s.platoon === platoon)).map((s) => ({ s, t: statusOf(st, s.id, now) }));
  const by = (k) => rows.filter((r) => r.t.kind === k);
  const away = by('away'), duty = by('duty'), base = by('base');

  const row = ({ s, t }) => `<button class="row" data-act="soldier" data-id="${s.id}">${avatar(st, s)}
    <span class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc([s.place, s.job].filter(Boolean).join(' · ') || 'ללא מסגרת')}</div></span>
    <span class="badge ${t.kind}">${esc(t.label)}${t.until ? ` · עד ${fmtDateTime(t.until)}` : ''}</span></button>`;

  el.innerHTML = `
    ${platoons.length > 1 ? `<select id="platoon" class="full"><option value="">כל המחלקות</option>${opts(platoons.map((p) => [p, p]), platoon)}</select>` : ''}
    <p class="muted roundline">${esc(st.round.name)} · ${roundInfo(st).inRound ? `יום ${roundInfo(st).n} מתוך ${roundInfo(st).total}` : 'היום מחוץ לסבב'}</p>
    <div class="tiles">
      <div class="tile all"><span class="ti">${icon('users')}</span><b>${rows.length}</b><span>סה"כ</span></div>
      <div class="tile ok"><span class="ti">${icon('check')}</span><b>${base.length + duty.length}</b><span>בבסיס</span></div>
      <div class="tile duty"><span class="ti">${icon('shield')}</span><b>${duty.length}</b><span>בשמירה</span></div>
      <div class="tile away"><span class="ti">${icon('logout')}</span><b>${away.length}</b><span>בחוץ</span></div>
    </div>
    ${rows.length ? '' : '<p class="empty">אין חיילים. הוסף בלשונית "חיילים".</p>'}
    ${away.length ? `<h3>בחוץ (${away.length})</h3><div class="card">${away.sort((a, b) => a.t.until - b.t.until).map(row).join('')}</div>` : ''}
    ${duty.length ? `<h3>בשמירה כעת (${duty.length})</h3><div class="card">${duty.map(row).join('')}</div>` : ''}
    ${base.length ? `<h3>בבסיס (${base.length})</h3><div class="card">${base.map(row).join('')}</div>` : ''}`;

  el.onchange = (e) => { if (e.target.id === 'platoon') { platoon = e.target.value; render(el, ctx); } };
  el.onclick = (e) => {
    const b = e.target.closest('[data-act="soldier"]');
    if (b && ctx.can('editRequests')) statusSheet(ctx, b.dataset.id);
  };
}

function statusSheet(ctx, sid) {
  const { st, update } = ctx;
  const sol = st.soldiers.find((s) => s.id === sid);
  const cur = statusOf(st, sid);
  const s = sheet(`<h3>${esc(sol.name)} — ${esc(cur.label)}</h3>
    ${cur.kind === 'away' ? '<button class="btn" data-back>חזר לבסיס</button><hr>' : ''}
    <form>
      <label>סטטוס חדש<select name="type">${opts(Object.entries(ABSENCE_TYPES), 'leave')}</select></label>
      <label>עד מתי<input type="datetime-local" name="to" value="${toInput(Date.now() + 24 * HOUR)}" required></label>
      <label>הערה<input name="note" maxlength="80"></label>
      <div class="btnrow"><button class="btn">שמור</button><button type="button" class="btn ghost" data-close>סגור</button></div>
    </form>`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-back]')) {
      update((d) => { const a = d.absences.find((x) => x.id === cur.absence.id); a.to = Date.now(); });
      s.close(); toast('סומן כחזר לבסיס');
    }
  };
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const to = fromInput(f.to);
    if (!(to > Date.now())) return toast('זמן הסיום חייב להיות בעתיד');
    update((d) => {
      d.absences.filter((a) => a.soldierId === sid && a.from <= Date.now() && Date.now() < a.to).forEach((a) => { a.to = Date.now(); });
      d.absences.push({ id: Math.random().toString(36).slice(2, 9), soldierId: sid, type: f.type, from: Date.now(), to, note: f.note });
    });
    s.close();
  };
}
