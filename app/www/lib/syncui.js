// The sync sheet (connect / status / conflict) and the "join existing data" flow used on a new phone.
import { esc, fmtDateTime } from './util.js';
import { sheet } from './ui.js';
import { icon } from './icons.js';

const TEXT = {
  off: 'לא מחובר ל-Drive', idle: 'מסונכרן', dirty: 'שינויים ממתינים לשליחה', syncing: 'מסנכרן…',
  offline: 'אין חיבור. השינויים נשמרו בטלפון ויישלחו כשיחזור החיבור', auth: 'צריך להתחבר מחדש ל-Google',
  conflict: 'התנגשות: מישהו אחר עדכן את הנתונים', error: 'שגיאה',
};
export const statusText = (s) => (s.status === 'error' && s.error ? s.error : TEXT[s.status] || '');
export const statusClass = (s) => ({ idle: 'ok', syncing: 'busy', dirty: 'busy', offline: 'warn', auth: 'warn', conflict: 'bad', error: 'bad', off: 'off' }[s.status] || 'off');

const errMsg = (e) => (e && e.message === 'auth' ? 'ההתחברות ל-Google נכשלה או נסגרה' : e && e.message === 'offline' ? 'אין חיבור לאינטרנט' : 'שגיאה: ' + ((e && e.message) || ''));

async function connectNew({ sync, drive, store, toast }) {
  const st = store.get();
  if (!st.users.length) return toast('צור קודם משתמש מנהל');
  try {
    await drive.signIn();
    await sync.connectCreate(async (state) => {
      const folder = await drive.api.folder('plugimel');
      return drive.api.create('plugimel-data.json', state, folder.id);
    });
    toast('נוצר קובץ ב-Drive והנתונים נשלחו');
  } catch (e) { toast(errMsg(e)); }
}

// Another phone: pick the file the admin shared, then load its data.
export async function joinExisting({ sync, drive, store, toast, confirm }) {
  try {
    const id = await drive.pickFile();
    if (!id) return false;
    if (store.get().soldiers.length && !(await confirm('הנתונים שבטלפון הזה יוחלפו בנתונים מ-Drive. להמשיך?', 'החלף'))) return false;
    await sync.attach(id);
    toast('מחובר. הנתונים נטענו');
    return true;
  } catch (e) { toast(errMsg(e)); return false; }
}

export function openSyncSheet(deps) {
  const { sync, drive, toast, confirm } = deps;
  const s0 = sync.snapshot();
  const body = !s0.connected ? `
      <p class="muted">שמור את הנתונים ב-Google Drive כדי שכמה טלפונים יעבדו על אותם נתונים. בטלפון הראשון צור קובץ חדש.</p>
      <div class="card pad btncol">
        <button class="btn" data-a="new">${icon('cloud')}צור קובץ חדש ב-Drive</button>
        <button class="btn ghost" data-a="join">${icon('download')}בחר קובץ קיים</button>
      </div>
      <p class="muted">בטלפון נוסף, מי שיצר את הקובץ משתף אותו עם המייל שלך, ואז בוחרים אותו כאן.</p>`
    : `
      <div class="card pad"><div class="row static" style="padding:0"><span class="grow"><div class="t">${esc(statusText(s0))}</div>
        <div class="s">${esc(s0.name)}${s0.lastSync ? ' · סנכרון אחרון ' + fmtDateTime(s0.lastSync) : ''}</div></span><i class="sdot inline ${statusClass(s0)}"></i></div></div>
      ${s0.conflict ? `<div class="notice">${icon('alert')}<span>גם אתה וגם מישהו אחר שיניתם נתונים. בחר איזו גרסה לשמור.</span></div>
        <div class="btnrow"><button class="btn" data-a="mine">שמור את שלי</button><button class="btn ghost" data-a="theirs">קח את שלהם</button></div>` : ''}
      <div class="btnrow">
        ${s0.status === 'auth' ? `<button class="btn" data-a="auth">התחבר ל-Google</button>` : `<button class="btn" data-a="now">${icon('sync')}סנכרן עכשיו</button>`}
        <button class="btn ghost" data-a="off">נתק</button>
      </div>`;
  const s = sheet(`<h3>סנכרון עם Drive</h3>${body}<div class="btnrow"><button class="btn ghost" data-a="close">סגור</button></div>`);

  s.el.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'close') return s.close();
    if (a === 'new') { await connectNew(deps); return s.close(); }
    if (a === 'join') { const ok = await joinExisting(deps); if (ok) s.close(); return; }
    if (a === 'now' || a === 'auth') {
      try { await drive.signIn({ interactive: a === 'auth' }); } catch (err) { sync.needAuth(); toast(errMsg(err)); return s.close(); }
      sync.syncNow(); return s.close();
    }
    if (a === 'mine' || a === 'theirs') { s.close(); return sync.resolve(a); }
    if (a === 'off' && await confirm('לנתק מ-Drive? הנתונים יישארו בטלפון הזה.', 'נתק')) { sync.disconnect(); drive.signOut(); s.close(); }
  };
  return s;
}
