import { esc, dayStart, addDays, fmtDay, fmtTime, fmtShort } from '../lib/util.js';
import { dayStatus, groups, mark, markAll, pendingGroups, checksEnabled, dayKey } from '../lib/checks.js';
import { waLink, reminderText, groupText } from '../lib/whatsapp.js';
import { sheet, toast, avatar } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

let day = dayStart(Date.now()), cid = '', onlyOpen = false;
export const setCheckDay = (ts, id) => { day = dayStart(ts); if (id) cid = id; };

const STATE_TEXT = { ok: 'הכל תקין', bad: 'חסר / לא הושלם', pending: 'ממתין לאישורים', none: 'אין נתונים' };
const itemText = (st, i) => `${i.type}${i.name ? ' ' + i.name : ''}${i.serial ? ' ' + i.serial : ''}`;

export function render(el, ctx) {
  const { st } = ctx;
  const checks = st.settings.checks;
  if (!checksEnabled(st)) {
    el.innerHTML = `<div class="card pad"><h3 style="margin-top:0">בדיקות יומיות</h3>
      <p class="muted">כל יום בודקים רימונים וצל"מ: כל חייל מאשר שהציוד שחתום עליו נמצא, והסמל רואה מי אישר. הבדיקות יופיעו ביומן בירוק או באדום.</p>
      <button class="btn block" data-act="enable">${icon('check')}הפעל בדיקות יומיות מהיום</button></div>`;
    el.onclick = (e) => { if (e.target.closest('[data-act=enable]')) ctx.update((d) => { d.settings.checksFrom = dayStart(Date.now()); }); };
    return;
  }
  if (!checks.some((c) => c.id === cid)) cid = checks[0].id;
  const check = checks.find((c) => c.id === cid);
  const today = dayStart(Date.now());
  const s = dayStatus(st, day, check), gs = groups(st, day, check);
  const shown = onlyOpen ? gs.map((g) => ({ ...g, items: g.items.filter((x) => !x.mark || x.mark.s !== 'ok') })).filter((g) => g.items.length) : gs;
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const strip = Array.from({ length: 14 }, (_, k) => addDays(today, k - 13));

  el.innerHTML = `
    <div class="seg">${checks.map((c) => `<button data-check="${c.id}" class="${c.id === cid ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</div>
    <div class="daynav"><button class="nav" data-act="prev" aria-label="יום קודם">${icon('chevronR')}</button>
      <div class="daytitle">${fmtDay(day)}${day === today ? ' · היום' : ''}</div>
      <button class="nav" data-act="next" aria-label="יום הבא">${icon('chevron')}</button></div>
    <div class="card pad chk-sum ${s.state}">
      <div class="row static" style="padding:0"><span class="grow"><div class="t">${STATE_TEXT[s.state]}</div><div class="s">${s.done} מתוך ${s.total} אושרו${s.away ? ` · ${s.away} מחוץ לבסיס` : ''}${s.missing ? ` · <span class="bad">${s.missing} חסרים</span>` : ''}</div></span>
        <span class="pct">${pct}%</span></div>
      <div class="bar-track"><i style="width:${pct}%"></i></div>
      <div class="btnrow"><button class="btn sm" data-act="remind">${icon('share')}תזכורות בוואטסאפ</button>
        <button class="btn sm ghost ${onlyOpen ? 'on' : ''}" data-act="open">${onlyOpen ? 'הצג הכל' : 'רק מה שחסר'}</button></div>
    </div>
    <div class="hist">${strip.map((ts) => { const x = dayStatus(st, ts, check).state; return `<button data-day="${ts}" class="h ${x}${ts === day ? ' sel' : ''}" title="${fmtShort(ts)}"><small>${new Date(ts).getDate()}</small></button>`; }).join('')}</div>
    ${shown.length ? shown.map((g) => {
      const allOk = g.items.every((x) => x.mark && x.mark.s === 'ok');
      return `<div class="card chk-grp"><div class="row static">${avatar(st, g.soldier)}<span class="grow"><div class="t">${esc(g.soldier.name)}</div><div class="s">${esc(g.soldier.job || '')}</div></span>
        <button class="btn sm ${allOk ? 'ghost' : ''}" data-all="${g.soldier.id}">${icon('check')}הכל נמצא</button></div>
        <div class="chips pad2">${g.items.map(({ item, mark: m }) => `<button class="chip ck ${m ? m.s : 'none'}" data-item="${item.id}"><span class="txt">${esc(itemText(st, item))}${m && m.note ? `<small>${esc(m.note)}</small>` : ''}</span></button>`).join('')}</div></div>`;
    }).join('') : `<p class="empty">${s.total ? 'הכל אושר' : 'אין ציוד חתום בבדיקה הזו. חתום ציוד על חיילים במסך "ציוד".'}</p>`}`;

  el.onclick = (e) => {
    const b = e.target.closest('[data-check],[data-act],[data-day],[data-all],[data-item]');
    if (!b) return;
    if (b.dataset.check) { cid = b.dataset.check; return render(el, ctx); }
    if (b.dataset.day) { day = +b.dataset.day; return render(el, ctx); }
    if (b.dataset.all) { ctx.update((d) => markAll(d, day, check, b.dataset.all, 'ok', { by: ctx.user.name })); return; }
    if (b.dataset.item) return itemSheet(ctx, check, b.dataset.item);
    const a = b.dataset.act;
    if (a === 'prev') day = addDays(day, -1);
    else if (a === 'next') day = Math.min(addDays(day, 1), today);
    else if (a === 'open') onlyOpen = !onlyOpen;
    else if (a === 'remind') return remindSheet(ctx, check);
    render(el, ctx);
  };
}

function itemSheet(ctx, check, itemId) {
  const { st } = ctx;
  const item = st.equipment.find((i) => i.id === itemId);
  if (!item) return;
  const rec = st.checkLog[dayKey(day)] && st.checkLog[dayKey(day)][check.id];
  const m = rec && rec.marks[itemId];
  const holder = st.soldiers.find((x) => x.id === ((m && m.h) || item.holderId));
  const s = sheet(`<h3>${esc(itemText(st, item))}</h3><p class="muted">${esc(holder ? holder.name : '')} · ${fmtDay(day)}</p>
    <div class="btncol">
      <button class="btn" data-s="ok">${icon('check')}נמצא ותקין</button>
      <div class="card pad"><label>מחוץ לבסיס, הציוד אצל החייל (הערה)<input id="awaynote" value="${esc(m && m.s === 'away' ? m.note : '')}" placeholder="בבית / בחופשה / בקורס"></label>
        <button class="btn ghost" data-s="away">סמן: אצל החייל מחוץ לבסיס</button></div>
      <button class="btn danger" data-s="missing">${icon('alert')}חסר</button>
      ${m ? '<button class="btn ghost" data-s="clear">נקה סימון</button>' : ''}
    </div>
    ${m ? `<p class="muted">סומן ${fmtTime(m.at)}${m.by ? ' על ידי ' + esc(m.by) : ''}</p>` : ''}`);
  s.el.onclick = (e) => {
    const k = e.target.closest('[data-s]')?.dataset.s;
    if (!k) return;
    const note = k === 'away' ? s.el.querySelector('#awaynote').value.trim() : '';
    if (k === 'away' && !note) return toast('כתוב איפה הציוד, למשל "בבית"');
    ctx.update((d) => mark(d, day, check, itemId, k, { note, by: ctx.user.name }));
    s.close();
  };
}

function remindSheet(ctx, check) {
  const { st } = ctx;
  const pend = pendingGroups(st, day, check);
  const origin = location.origin + location.pathname;
  const s = sheet(`<h3>תזכורות · ${esc(check.name)}</h3>
    ${pend.length ? `<p class="muted">${pend.length} חיילים טרם אישרו. כל כפתור פותח וואטסאפ עם ההודעה מוכנה. נשאר ללחוץ שלח.</p>
      <div class="card">${pend.map((g) => {
        const txt = reminderText(g.soldier.name, check.name, g.items.map((x) => itemText(st, x.item)).join(', ')) + ` ${origin}`;
        return `<div class="row static">${avatar(st, g.soldier)}<span class="grow"><div class="t">${esc(g.soldier.name)}</div><div class="s">${g.items.length} פריטים${g.soldier.phone ? '' : ' · אין טלפון'}</div></span>
          ${g.soldier.phone ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(waLink(g.soldier.phone, txt))}">${icon('share')}שלח</a>` : '<span class="muted">—</span>'}</div>`;
      }).join('')}</div>
      <div class="btnrow"><button class="btn" data-copy>העתק הודעה לקבוצה</button><button class="btn ghost" data-close>סגור</button></div>`
    : '<p class="empty">כולם אישרו. אין למי לשלוח.</p><div class="btnrow"><button class="btn ghost" data-close>סגור</button></div>'}`);
  s.el.onclick = (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-copy]')) {
      const text = groupText(check.name, pend.map((g) => g.soldier.name));
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else navigator.clipboard.writeText(text).then(() => toast('הועתק'), () => toast('לא ניתן להעתיק'));
    }
  };
}
