import { esc } from './util.js';

// Bottom sheet. Returns { el, close }.
export function sheet(html) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.body.appendChild(wrap);
  return { el: wrap.firstElementChild, close };
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

export function confirmDlg(msg, okLabel = 'אישור') {
  return new Promise((resolve) => {
    const s = sheet(`<p class="confirm-msg">${esc(msg)}</p><div class="btnrow"><button class="btn danger" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-no>ביטול</button></div>`);
    s.el.onclick = (e) => {
      if (e.target.closest('[data-ok]')) { s.close(); resolve(true); }
      else if (e.target.closest('[data-no]')) { s.close(); resolve(false); }
    };
  });
}

export const formObj = (form) => Object.fromEntries(new FormData(form).entries());
export const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');

// Round avatar with the soldier's initials; the color follows the soldier's place (squad).
const HUES = [98, 205, 32, 268, 345, 172, 55];
export function avatar(st, s, size = '') {
  const i = st.settings.places.indexOf(s.place);
  const ini = ((s.first || s.name || '?')[0] || '?') + ((s.last || '')[0] || '');
  return `<span class="av ${size}${i < 0 ? ' none' : ''}" style="--h:${HUES[Math.max(i, 0) % HUES.length]}">${esc(ini)}</span>`;
}
