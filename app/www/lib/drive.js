// Google sign-in (Identity Services token flow, no server) and the few Drive calls the app needs.
import { GOOGLE } from './config.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,name,version,md5Checksum,modifiedTime,capabilities/canEdit,owners/emailAddress';
const TOK = 'platoon.tok', HINT = 'platoon.gsignin';

let token = null, expiresAt = 0, client = null;
try { const t = JSON.parse(sessionStorage.getItem(TOK) || 'null'); if (t && t.exp > Date.now() + 60e3) { token = t.v; expiresAt = t.exp; } } catch { /* ignore */ }

const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve();
  const s = document.createElement('script');
  s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('offline'));
  document.head.appendChild(s);
});

export const hasToken = () => !!token && expiresAt > Date.now() + 60e3;
// True if this browser signed in before, so we can try to get a token without showing anything.
export const wasSignedIn = () => { try { return localStorage.getItem(HINT) === '1'; } catch { return false; } };

// interactive: may open the Google popup (needs a tap). Otherwise tries silently and fails with 'auth'.
export async function signIn({ interactive = true } = {}) {
  if (hasToken()) return token;
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    client ||= google.accounts.oauth2.initTokenClient({ client_id: GOOGLE.clientId, scope: GOOGLE.scope, callback: () => {} });
    client.callback = (r) => {
      if (r.error) return reject(new Error('auth'));
      token = r.access_token; expiresAt = Date.now() + (r.expires_in || 3600) * 1000;
      try { sessionStorage.setItem(TOK, JSON.stringify({ v: token, exp: expiresAt })); localStorage.setItem(HINT, '1'); } catch { /* ignore */ }
      resolve(token);
    };
    client.error_callback = () => reject(new Error('auth'));
    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}

export function signOut() {
  if (token && window.google) google.accounts.oauth2.revoke(token, () => {});
  token = null; expiresAt = 0;
  try { sessionStorage.removeItem(TOK); localStorage.removeItem(HINT); } catch { /* ignore */ }
}

async function call(url, opts = {}) {
  if (!hasToken()) throw new Error('auth');
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (res.status === 401) { token = null; throw new Error('auth'); }
  if (!res.ok) { const e = new Error(`drive ${res.status}`); e.status = res.status; throw e; }
  return res;
}

// The sync layer only needs this small interface, so it can be tested with a fake.
export const api = {
  async meta(id) { return (await call(`${API}/files/${id}?fields=${FIELDS}`)).json(); },
  async read(id) { return (await call(`${API}/files/${id}?alt=media`)).json(); },
  async write(id, obj) {
    return (await call(`${UPLOAD}/files/${id}?uploadType=media&fields=${FIELDS}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })).json();
  },
  async folder(name) {
    return (await call(`${API}/files?fields=id,name`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }) })).json();
  },
  async create(name, obj, parentId) {
    const boundary = 'plg' + Math.random().toString(36).slice(2);
    const meta = { name, mimeType: 'application/json', ...(parentId ? { parents: [parentId] } : {}) };
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--${boundary}--`;
    return (await call(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json();
  },
};

// Google's file picker: gives this app access to one existing file (e.g. one the admin shared). Resolves to the file id or null.
export async function pickFile() {
  await signIn();
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((resolve) => gapi.load('picker', resolve));
  return new Promise((resolve) => {
    const mine = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/json').setIncludeFolders(false);
    const shared = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/json').setIncludeFolders(false).setOwnedByMe(false);
    new google.picker.PickerBuilder()
      .addView(shared).addView(mine)
      .setOAuthToken(token).setDeveloperKey(GOOGLE.apiKey).setAppId(GOOGLE.projectNumber).setLocale('he')
      .setCallback((d) => { if (d.action === 'picked') resolve(d.docs[0].id); else if (d.action === 'cancel') resolve(null); })
      .build().setVisible(true);
  });
}
