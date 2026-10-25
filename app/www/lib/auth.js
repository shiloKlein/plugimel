// UI-level login for staff. This only decides what the screens show; real access control is the Drive folder sharing.
import { newId } from './util.js';

const SESSION = 'platoon.session';

async function hashPw(pw, salt) {
  const data = new TextEncoder().encode(`${salt}:${pw}`);
  if (globalThis.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const b of data) h = ((h << 5) + h + b) >>> 0;
  return 'x' + h.toString(16);
}

export async function makeUser(name, role, password) {
  const salt = newId();
  return { id: newId(), name, role, salt, hash: await hashPw(password, salt) };
}
export async function setPassword(user, password) {
  user.salt = newId(); user.hash = await hashPw(password, user.salt);
}
export async function login(users, userId, password) {
  const u = users.find((x) => x.id === userId);
  if (!u || (await hashPw(password, u.salt)) !== u.hash) return null;
  try { localStorage.setItem(SESSION, u.id); } catch { /* ignore */ }
  return u;
}
export function logout() { try { localStorage.removeItem(SESSION); } catch { /* ignore */ } }
export function currentUser(users) {
  try { const id = localStorage.getItem(SESSION); return users.find((u) => u.id === id) || null; } catch { return null; }
}
