import { esc, newId } from '../lib/util.js';
import { ROLES, QUALS, clearData, replaceAll, newRound } from '../lib/store.js';
import { fromDateInput, toDateInput, DAY } from '../lib/util.js';
import { makeUser, setPassword } from '../lib/auth.js';
import { makeDemo } from '../lib/demo.js';
import { sheet, formObj, opts, toast, confirmDlg } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

const NUM = [
  ['windowHours', 'חלון נקודות (שעות אחורה)', 1, 168], ['restHours', 'מנוחה מינימלית בין שמירות (שעות)', 0, 24],
  ['wNight', 'נקודות לשעת לילה', 0.5, 5], ['wEvening', 'נקודות לשעת ערב', 0.5, 5], ['wDay', 'נקודות לשעת יום', 0.5, 5],
  ['nightFrom', 'לילה מתחיל (שעה)', 0, 23], ['nightTo', 'לילה נגמר (שעה)', 0, 23], ['eveningFrom', 'ערב מתחיל', 0, 23], ['eveningTo', 'ערב נגמר', 0, 23],
  ['penRest', 'קנס: מנוחה קצרה', 0, 200], ['penNightNight', 'קנס: לילה אחרי לילה', 0, 200], ['penPair', 'קנס: זוג שלא ביחד', 0, 500],
];

export function render(el, ctx) {
  const { st } = ctx;
  const cfg = st.settings;
  const sol = (id) => (st.soldiers.find((s) => s.id === id) || { name: '?' }).name;
  el.innerHTML = `
    ${st.demo ? `<div class="notice">${icon('alert')}<span>האפליקציה מכילה נתוני דמו. מחק אותם בסוף העמוד, תחת "נתונים".</span></div>` : ''}
    <h3>סבב שירות</h3>
    <form id="round" class="card pad">
      <label>שם הסבב<input name="name" value="${esc(st.round.name)}" required></label>
      <div class="two"><label>התחלה<input type="date" name="start" value="${toDateInput(st.round.start)}" required></label><label>סיום (היום האחרון)<input type="date" name="end" value="${toDateInput(st.round.end)}" required></label></div>
      <div class="btnrow"><button class="btn">שמור</button><button type="button" class="btn ghost" data-act="newround">סבב חדש…</button></div>
    </form>

    <h3>מסגרות ותפקידים</h3>
    <form id="lists" class="card pad">
      <div class="two"><label>מסגרות (שורה לכל אחת)<textarea name="places" rows="6">${esc(cfg.places.join('\n'))}</textarea></label>
        <label>תפקידים (שורה לכל אחד)<textarea name="jobs" rows="6">${esc(cfg.jobs.join('\n'))}</textarea></label></div>
      <button class="btn">שמור רשימות</button>
    </form>

    <h3>רשימת ציוד</h3>
    <form id="gear" class="card pad">
      <div class="two"><label>ציוד עם צלם (מספר סידורי)<textarea name="equip" rows="8">${esc(cfg.equipTypes.join('\n'))}</textarea></label>
        <label>ציוד אישי (כמות)<textarea name="gear" rows="8">${esc(cfg.gearTypes.join('\n'))}</textarea></label></div>
      <button class="btn">שמור רשימות ציוד</button>
    </form>

    <h3>כללי השיבוץ</h3>
    <form id="rules" class="card pad">
      <div class="grid">${NUM.map(([k, l, min, max]) => `<label>${l}<input type="number" name="${k}" min="${min}" max="${max}" step="any" value="${cfg[k]}"></label>`).join('')}</div>
      <p class="muted">נקודות = שעות × משקל. מנצח מי שיש לו הכי מעט נקודות בחלון האחורי. קנסים נוספים לנקודות, לא אוסרים.</p>
      <button class="btn">שמור כללים</button>
    </form>

    <h3>זוגות שלא ביחד</h3>
    <div class="card pad">
      ${cfg.separate.map(([a, b], i) => `<div class="row static"><span class="grow">${esc(sol(a))} ✕ ${esc(sol(b))}</span><button class="btn sm ghost" data-act="unpair" data-i="${i}">הסר</button></div>`).join('')}
      <form id="pair" class="bar"><select name="a">${opts(st.soldiers.map((s) => [s.id, s.name]))}</select><select name="b">${opts(st.soldiers.map((s) => [s.id, s.name]))}</select><button class="btn sm">הוסף</button></form>
    </div>

    <h3>עמדות שמירה</h3>
    <div class="card">${st.posts.map((p) => `<button class="row" data-act="post" data-id="${p.id}"><b class="grow">${esc(p.name)}</b><span class="muted">${p.people} אנשים · ${p.shiftHours} ש׳ · ${p.from}:00–${p.to}:00${p.qual ? ' · ' + esc(p.qual) : ''}</span></button>`).join('') || '<p class="empty">אין עמדות</p>'}</div>
    <div class="bar"><button class="btn" data-act="post">+ עמדה</button></div>

    ${ctx.can('manageUsers') ? `
    <h3>משתמשים (צוות)</h3>
    <div class="card">${st.users.map((u) => `<button class="row" data-act="user" data-id="${u.id}"><b class="grow">${esc(u.name)}</b><span class="muted">${ROLES[u.role]}</span></button>`).join('')}</div>
    <div class="bar"><button class="btn" data-act="user">+ משתמש</button></div>
    <p class="muted">חיילים רגילים לא צריכים משתמש. הם רק צופים. ההרשאות כאן קובעות מה מוצג במסך. ההגנה האמיתית היא שיתוף תיקיית ה-Drive.</p>

    <h3>נתונים</h3>
    <div class="card pad btncol">
      <button class="btn ghost" data-act="export">${icon('download')}גיבוי לקובץ</button>
      <label class="btn ghost" style="margin:0;color:var(--ink)">${icon('upload')}שחזור מקובץ<input type="file" id="import" accept="application/json" hidden></label>
      <button class="btn ghost" data-act="demo">טען נתוני דמו</button>
      <button class="btn danger" data-act="clear">מחק את כל החיילים, הציוד והשיבוצים${st.demo ? ' (דמו)' : ''}</button>
    </div>` : ''}`;

  el.onsubmit = async (e) => {
    e.preventDefault();
    if (e.target.id === 'rules') {
      const f = formObj(e.target);
      ctx.update((d) => NUM.forEach(([k]) => { if (f[k] !== '' && !isNaN(+f[k])) d.settings[k] = +f[k]; }));
      toast('נשמר');
    }
    if (e.target.id === 'round') {
      const f = formObj(e.target), start = fromDateInput(f.start), end = fromDateInput(f.end);
      if (end < start) return toast('תאריך הסיום לפני ההתחלה');
      ctx.update((d) => { d.round = { name: f.name.trim(), start, end }; });
      toast('נשמר');
    }
    if (e.target.id === 'lists') {
      const f = formObj(e.target), lines = (t) => [...new Set(t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
      ctx.update((d) => { d.settings.places = lines(f.places); d.settings.jobs = lines(f.jobs); });
      toast('נשמר');
    }
    if (e.target.id === 'gear') {
      const f = formObj(e.target), lines = (t) => [...new Set(t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
      ctx.update((d) => { d.settings.equipTypes = lines(f.equip); d.settings.gearTypes = lines(f.gear); });
      toast('נשמר');
    }
    if (e.target.id === 'pair') {
      const { a, b } = formObj(e.target);
      if (a === b) return toast('בחר שני חיילים שונים');
      ctx.update((d) => d.settings.separate.push([a, b]));
    }
  };
  el.onchange = (e) => {
    if (e.target.id !== 'import' || !e.target.files[0]) return;
    const r = new FileReader();
    r.onload = async () => {
      try { const j = JSON.parse(r.result); if (!j.soldiers || !j.settings) throw 0; if (await confirmDlg('לשחזר? הנתונים הנוכחיים יוחלפו.', 'שחזר')) replaceAll(j); } catch { toast('קובץ לא תקין'); }
    };
    r.readAsText(e.target.files[0]);
  };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'newround') return roundSheet(ctx);
    if (a === 'unpair') ctx.update((d) => d.settings.separate.splice(+b.dataset.i, 1));
    if (a === 'post') postSheet(ctx, b.dataset.id);
    if (a === 'user') userSheet(ctx, b.dataset.id);
    if (a === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(st)], { type: 'application/json' }));
      const l = document.createElement('a'); l.href = url; l.download = `platoon-backup-${new Date().toISOString().slice(0, 10)}.json`; l.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    if (a === 'demo' && await confirmDlg('לטעון נתוני דמו? הם יתווספו לנתונים הקיימים.', 'טען')) {
      const demo = makeDemo();
      ctx.update((d) => { Object.assign(d, { soldiers: [...d.soldiers, ...demo.soldiers], posts: [...d.posts, ...demo.posts], absences: [...d.absences, ...demo.absences], equipment: [...d.equipment, ...demo.equipment], requests: [...d.requests, ...demo.requests], demo: true }); });
    }
    if (a === 'clear' && await confirmDlg('למחוק את כל החיילים, העמדות, הציוד, הבקשות והשיבוצים? המשתמשים והכללים נשארים.', 'מחק הכל')) { clearData(); toast('נמחק'); }
  };
}

function postSheet(ctx, id) {
  const { st, update } = ctx;
  const p = id ? st.posts.find((x) => x.id === id) : { name: '', people: 1, shiftHours: 4, from: 0, to: 24, qual: '' };
  const s = sheet(`<h3>${id ? 'עריכת עמדה' : 'עמדה חדשה'}</h3><form>
    <label>שם<input name="name" value="${esc(p.name)}" required></label>
    <div class="two"><label>אנשים בשמירה<input type="number" name="people" min="1" max="10" value="${p.people}"></label><label>אורך משמרת (שעות)<input type="number" name="shiftHours" min="1" max="24" value="${p.shiftHours}"></label></div>
    <div class="two"><label>פעילה מ (שעה)<input type="number" name="from" min="0" max="23" value="${p.from}"></label><label>עד (שעה)<input type="number" name="to" min="1" max="30" value="${p.to}"></label></div>
    <label>דורש תפקיד / הסמכה<select name="qual"><option value="">— ללא —</option>${opts([...new Set([...st.settings.jobs, ...QUALS])].map((q) => [q, q]), p.qual)}</select></label>
    <p class="muted">0 עד 24 = כל היום. אם "עד" קטן מ"מ" העמדה נמשכת אחרי חצות (למשל 20 עד 6).</p>
    <div class="btnrow"><button class="btn">שמור</button>${id ? '<button type="button" class="btn danger" data-del>מחק</button>' : ''}<button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-del]') && await confirmDlg('למחוק את העמדה? שמירות עתידיות שלה יימחקו.', 'מחק')) {
      update((d) => { d.posts = d.posts.filter((x) => x.id !== id); d.roster = d.roster.filter((x) => x.postId !== id || x.end < Date.now()); });
      s.close();
    }
  };
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const data = { name: f.name.trim(), people: +f.people, shiftHours: +f.shiftHours, from: +f.from, to: +f.to, qual: f.qual };
    update((d) => { if (id) Object.assign(d.posts.find((x) => x.id === id), data); else d.posts.push({ id: newId(), ...data }); });
    s.close();
  };
}

function userSheet(ctx, id) {
  const { st, update } = ctx;
  const u = id ? st.users.find((x) => x.id === id) : { name: '', role: 'officer' };
  const s = sheet(`<h3>${id ? 'עריכת משתמש' : 'משתמש חדש'}</h3><form>
    <label>שם<input name="name" value="${esc(u.name)}" required></label>
    <label>תפקיד<select name="role">${opts(Object.entries(ROLES), u.role)}</select></label>
    <label>${id ? 'סיסמה חדשה (השאר ריק כדי לא לשנות)' : 'סיסמה'}<input type="password" name="pw" minlength="4" autocomplete="new-password"${id ? '' : ' required'}></label>
    <div class="btnrow"><button class="btn">שמור</button>${id ? '<button type="button" class="btn danger" data-del>מחק</button>' : ''}<button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.onclick = async (e) => {
    if (e.target.closest('[data-close]')) s.close();
    if (e.target.closest('[data-del]')) {
      if (u.id === ctx.user.id) return toast('אי אפשר למחוק את עצמך');
      if (u.role === 'admin' && st.users.filter((x) => x.role === 'admin').length < 2) return toast('חייב להישאר מנהל אחד');
      if (await confirmDlg(`למחוק את ${u.name}?`, 'מחק')) { update((d) => { d.users = d.users.filter((x) => x.id !== id); }); s.close(); }
    }
  };
  s.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    if (id && u.role === 'admin' && f.role !== 'admin' && st.users.filter((x) => x.role === 'admin').length < 2) return toast('חייב להישאר מנהל אחד');
    const nu = id ? null : await makeUser(f.name.trim(), f.role, f.pw);
    const pwUser = id && f.pw ? { ...u } : null;
    if (pwUser) await setPassword(pwUser, f.pw);
    update((d) => {
      if (nu) d.users.push(nu);
      else { const x = d.users.find((y) => y.id === id); x.name = f.name.trim(); x.role = f.role; if (pwUser) { x.salt = pwUser.salt; x.hash = pwUser.hash; } }
    });
    s.close();
  };
}

function roundSheet(ctx) {
  const { st } = ctx;
  const len = Math.round((st.round.end - st.round.start) / DAY);
  const start = st.round.end + DAY;
  const s = sheet(`<h3>סבב חדש</h3>
    <p class="muted">החיילים, העמדות והכללים נשארים. מה לאפס?</p>
    <form>
      <label>שם<input name="name" value="סבב חדש" required></label>
      <div class="two"><label>התחלה<input type="date" name="start" value="${toDateInput(start)}" required></label><label>סיום<input type="date" name="end" value="${toDateInput(start + len * DAY)}" required></label></div>
      <label class="chk"><input type="checkbox" name="clearRoster" checked> שיבוץ שמירות</label>
      <label class="chk"><input type="checkbox" name="clearAbsences" checked> היעדרויות וסטטוסים</label>
      <label class="chk"><input type="checkbox" name="clearRequests" checked> בקשות</label>
      <label class="chk"><input type="checkbox" name="unsign"> ציוד: בטל חתימות (כל הציוד חוזר למחסן)</label>
      <div class="btnrow"><button class="btn danger">התחל סבב חדש</button><button type="button" class="btn ghost" data-close>סגור</button></div>
    </form>`);
  s.el.querySelector('[data-close]').onclick = s.close;
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target, start = fromDateInput(f.start.value), end = fromDateInput(f.end.value);
    if (end < start) return toast('תאריך הסיום לפני ההתחלה');
    newRound({ name: f.name.value.trim(), start, end, clearRoster: f.clearRoster.checked, clearAbsences: f.clearAbsences.checked, clearRequests: f.clearRequests.checked, unsign: f.unsign.checked });
    s.close(); toast('הסבב החדש התחיל');
  };
}
