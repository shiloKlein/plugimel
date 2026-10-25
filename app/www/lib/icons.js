// Small stroke icon set (24x24). icon('name') returns an inline <svg> that inherits the text color.
const P = {
  board: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3l7.5 2.8v5.7c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V5.8L12 3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  users: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 20c.4-3.4 3-5.6 6.2-5.6s5.8 2.2 6.2 5.6"/><circle cx="17.2" cy="9.2" r="2.5"/><path d="M17.5 14.3c2.2.2 3.6 1.9 3.9 4.2"/>',
  box: '<path d="M12 3l8 4.4v9.2L12 21l-8-4.4V7.4L12 3z"/><path d="M4.2 7.6L12 12l7.8-4.4M12 12v9"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="17" rx="3"/><path d="M9 4.5V3.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8v.7M9 11h6M9 15h4"/>',
  sliders: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.3"/><circle cx="8" cy="17" r="2.3"/>',
  more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  chevron: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronR: '<path d="M9.5 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  upload: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 19h14"/>',
  trash: '<path d="M4 7h16M10 4h4M6.5 7l.8 12.2A2 2 0 009.300 21h5.400a2 2 0 002-1.800L17.500 7M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L19 9a2.100 2.100 0 00-3-3L5 17v3z"/><path d="M14.500 7.500l2 2"/>',
  user: '<circle cx="12" cy="8.500" r="3.800"/><path d="M4.500 20.500c.6-4 3.700-6 7.500-6s6.900 2 7.500 6"/>',
  login: '<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 8l-4 4 4 4M6 12h10"/>',
  logout: '<path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M14 8l4 4-4 4M18 12H8"/>',
  phone: '<path d="M6.500 3.500h3l1.500 4-2 1.300a11 11 0 005.200 5.200l1.300-2 4 1.500v3a2 2 0 01-2.200 2A15 15 0 014.500 5.700 2 2 0 016.500 3.500z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.200l3.300 2"/>',
  alert: '<path d="M12 4l9 15.500H3L12 4z"/><path d="M12 10v4.500M12 17.500v.1"/>',
  moon: '<path d="M20 14.500A8 8 0 019.500 4 8.500 8.500 0 1020 14.500z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M18.400 5.600L17 7M7 17l-1.400 1.400"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2.500"/><path d="M8 10.500V8a4 4 0 018 0v2.500"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.500 6h.1M4.500 12h.1M4.500 18h.1"/>',
  home: '<path d="M4 11l8-7 8 7v8a2 2 0 01-2 2h-3.500v-6h-5v6H6a2 2 0 01-2-2v-8z"/>',
  sync: '<path d="M20 11a8 8 0 00-14-4.500L4 9M4 4v5h5M4 13a8 8 0 0014 4.500L20 15M20 20v-5h-5"/>',
  cloud: '<path d="M7 18a4.500 4.500 0 01-.6-8.960A6 6 0 0118 10.500 3.800 3.800 0 0117.500 18H7z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
