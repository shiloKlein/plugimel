import * as store from './lib/store.js';
import * as auth from './lib/auth.js';
import { makeDemo } from './lib/demo.js';
import { esc } from './lib/util.js';
import { icon } from './lib/icons.js';
import { sheet, formObj, opts, toast } from './lib/ui.js';
import * as board from './views/board.js';
import * as roster from './views/roster.js';
import * as calendar from './views/calendar.js';
import * as soldiers from './views/soldiers.js';
import * as equipment from './views/equipment.js';
import * as requests from './views/requests.js';
import * as settings from './views/settings.js';
import * as checks from './views/checks.js';
import * as drive from './lib/drive.js';
import { createSync } from './lib/sync.js';
import { openSyncSheet, joinExisting, statusText, statusClass } from './lib/syncui.js';
import { confirmDlg } from './lib/ui.js';

const $ = (id) => document.getElementById(id);

// `more: true` items live in the "עוד" menu on phones (and in the sidebar on wide screens).
const VIEWS = {
  board: { mod: board, title: 'מצב כוח אדם', label: 'לוח', icon: 'board', perm: 'viewPresence' },
  roster: { mod: roster, title: 'שמירות', label: 'שמירות', icon: 'shield' },
  calendar: { mod: calendar, title: 'יומן', label: 'יומן', icon: 'calendar' },
  soldiers: { mod: soldiers, title: 'חיילים', label: 'חיילים', icon: 'users' },
  equipment: { mod: equipment, title: 'ציוד', label: 'ציוד', icon: 'box' },
  checks: { mod: checks, title: 'בדיקות ציוד', label: 'בדיקות ציוד', icon: 'check', perm: 'viewPresence', more: true },
  requests: { mod: requests, title: 'בקשות', label: 'בקשות', icon: 'clipboard', perm: 'viewRequests', more: true },
  settings: { mod: settings, title: 'הגדרות', label: 'הגדרות', icon: 'sliders', perm: 'editRules', more: true },
};

let user = null;

// ───── Drive sync
let conflictShown = false;
const sync = createSync({ api: drive.api, getState: () => store.get(), applyRemote: (d) => store.replaceAll(d), onStatus: onSyncStatus });
const syncDeps = () => ({ sync, drive, store, toast, confirm: confirmDlg });

function renderSync(s = sync.snapshot()) {
  const b = $('syncBtn');
  if (b) { b.innerHTML = icon('cloud') + `<i class="sdot ${statusClass(s)}"></i>`; b.setAttribute('aria-label', 'סנכרון: ' + statusText(s)); }
  const l = $('syncLabel');
  if (l) l.textContent = 'סנכרון · ' + (s.connected ? statusText(s) : 'כבוי');
}
function onSyncStatus(s) {
  renderSync(s);
  if (s.status === 'conflict' && !conflictShown) { conflictShown = true; openSyncSheet(syncDeps()); }
  if (s.status !== 'conflict') conflictShown = false;
}
async function syncTick() {
  if (!sync.isConnected()) return;
  try { await drive.signIn({ interactive: false }); } catch { return sync.needAuth(); }
  sync.syncNow();
}

const ctx = () => ({ st: store.get(), user, can: (p) => store.can(user, p), update: store.update });
const visible = () => Object.keys(VIEWS).filter((k) => !VIEWS[k].perm || store.can(user, VIEWS[k].perm));
const pendingCount = () => (store.can(user, 'viewRequests') ? store.get().requests.filter((r) => r.status === 'pending').length : 0);

function render() {
  const st = store.get();
  user = auth.currentUser(st.users);
  const ids = visible();
  const hash = location.hash.slice(1);
  const view = ids.includes(hash) ? hash : ids[0];
  const pending = pendingCount();
  const inMore = VIEWS[view].more;

  document.title = `${VIEWS[view].title} · עוזר מחלקה`;
  $('title').textContent = VIEWS[view].title;
  $('whoBtn').innerHTML = user ? `<span class="me">${esc(user.name[0] || '?')}</span>` : icon('user');
  $('whoBtn').setAttribute('aria-label', user ? user.name : 'כניסת צוות');

  const link = (k, cls = '') => `<a href="#${k}" class="${cls}${k === view ? ' active' : ''}">${icon(VIEWS[k].icon)}<span>${VIEWS[k].label}</span>${k === 'requests' && pending ? `<i class="dot">${pending}</i>` : ''}</a>`;
  const main = ids.filter((k) => !VIEWS[k].more);
  $('tabbar').innerHTML = main.map((k) => link(k)).join('') +
    `<button class="${inMore ? 'active' : ''}" data-more>${icon('more')}<span>עוד</span>${pending ? `<i class="dot">${pending}</i>` : ''}</button>`;
  $('side').innerHTML = `<div class="brand"><img src="icons/icon.svg" alt="">עוזר מחלקה</div><nav>${ids.map((k) => link(k)).join('')}</nav>
    <div class="side-foot"><button class="side-btn" data-sync>${icon('cloud')}<span id="syncLabel"></span></button>${user ? `<div class="who"><span class="me">${esc(user.name[0] || '?')}</span>${esc(user.name)}</div><button class="side-btn" data-act="logout">${icon('logout')}יציאה</button>`
      : `<button class="side-btn" data-act="login">${icon('login')}כניסת צוות</button>`}</div>`;

  VIEWS[view].mod.render($('view'), ctx());
  renderSync();
}

function moreSheet() {
  const ids = visible().filter((k) => VIEWS[k].more), pending = pendingCount();
  const s = sheet(`<div class="menu">
    <div class="menu-user">${user ? `<span class="me lg">${esc(user.name[0] || '?')}</span><div><b>${esc(user.name)}</b><div class="muted">${esc(store.ROLES[user.role])}</div></div>` : `<span class="me lg none">${icon('user')}</span><div><b>צופה</b><div class="muted">צפייה בלבד</div></div>`}</div>
    ${ids.map((k) => `<a class="menu-row" href="#${k}">${icon(VIEWS[k].icon)}<span class="grow">${VIEWS[k].label}</span>${k === 'requests' && pending ? `<i class="dot">${pending}</i>` : ''}${icon('chevron', 'faint')}</a>`).join('')}
    ${user ? `<button class="menu-row" data-act="logout">${icon('logout')}<span class="grow">יציאה</span></button>` : `<button class="menu-row" data-act="login">${icon('login')}<span class="grow">כניסת צוות</span></button>`}
  </div>`);
  s.el.onclick = (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (e.target.closest('a')) s.close();
    if (a === 'logout') { s.close(); auth.logout(); render(); }
    if (a === 'login') { s.close(); loginSheet(); }
  };
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#syncBtn') || e.target.closest('[data-sync]')) return openSyncSheet(syncDeps());
  if (e.target.closest('[data-more]') || e.target.closest('#whoBtn')) return moreSheet();
  const a = e.target.closest('.side-foot [data-act]')?.dataset.act;
  if (a === 'logout') { auth.logout(); render(); }
  if (a === 'login') loginSheet();
});

function loginSheet() {
  const st = store.get();
  if (!st.users.length) return;
  const s = sheet(`<h3>כניסת צוות</h3><form>
    <label>משתמש<select name="u">${opts(st.users.map((u) => [u.id, u.name]))}</select></label>
    <label>סיסמה<input type="password" name="pw" autocomplete="current-password" required></label>
    <div class="btnrow"><button class="btn">כניסה</button><button type="button" class="btn ghost" data-close>סגור</button></div></form>`);
  s.el.querySelector('[data-close]').onclick = s.close;
  s.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    if (await auth.login(st.users, f.u, f.pw)) { s.close(); location.hash = ''; render(); } else toast('סיסמה שגויה');
  };
}

// First run: create the admin (and optionally fill in fake data).
function setup() {
  document.body.classList.add('bare');
  $('view').innerHTML = `<div class="welcome"><img src="icons/icon.svg" alt=""><h2>עוזר מחלקה</h2><p class="muted">ברוכים הבאים. צור את משתמש המנהל. רק הוא יכול ליצור משתמשים נוספים.</p>
    <form id="setup" class="card pad">
      <label>שם המנהל<input name="name" required></label>
      <label>סיסמה (לפחות 4 תווים)<input type="password" name="pw" minlength="4" required autocomplete="new-password"></label>
      <label class="chk"><input type="checkbox" name="demo" checked> טען נתוני דמו לבדיקה</label>
      <button class="btn block">התחל</button></form>
    <div class="divider">או</div>
    <button class="btn ghost block" id="join">${icon('cloud')}יש כבר נתונים ב-Drive? התחברות</button></div>`;
  $('join').onclick = () => joinExisting(syncDeps());
  $('setup').onsubmit = async (e) => {
    e.preventDefault();
    const f = formObj(e.target);
    const admin = await auth.makeUser(f.name.trim(), 'admin', f.pw);
    const demo = f.demo ? makeDemo() : null;
    document.body.classList.remove('bare');
    store.update((d) => { d.users.push(admin); if (demo) { Object.assign(d, demo); d.demo = true; } });
    await auth.login(store.get().users, admin.id, f.pw);
    render();
  };
}

store.load();
store.onChange(() => { if (!sync.isApplying()) sync.markDirty(); if (store.get().users.length) render(); });
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
if (store.get().users.length) render(); else setup();

// Keep in step with Drive: on open, when the app comes back to the front, when the connection returns, and once a minute.
syncTick();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncTick(); });
window.addEventListener('online', syncTick);
setInterval(() => { if (document.visibilityState === 'visible') syncTick(); }, 60000);

// Installable + works offline
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
