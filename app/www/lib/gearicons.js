// Small line drawings for equipment types, 64x32, drawn with currentColor. gearIcon(type) picks one by name.
const P = {
  rifle: '<path d="M3 14h20M23 12h14v5H23zM37 11h10v8H37zM47 12l12-2v10l-12-1M39 19l-1 8h5l1-8M45 19l2 6M8 12v2"/>',
  sniper: '<path d="M3 15h20M23 13h14v5H23zM37 12h10v8H37zM47 13l12-2v10l-12-1M39 20l-1 7h5l1-7M26 6h14v4H26zM29 10v3M37 10v3"/>',
  lmg: '<path d="M3 14h16M19 11h28v8H19zM47 12l11 2v6l-11-1M30 19h10v8H30zM12 14l-5 13M12 14l5 13M24 11V7h12v4"/>',
  mmg: '<path d="M2 13h20M22 10h14v8H22zM36 9h14v10H36zM50 10l10 2v7l-10-2M37 19h12v8H37zM35 19q-4 3-9 1M14 13l-5 14M14 13l5 14M26 10V6h14v3"/>',
  grenade: '<path d="M32 12c-6 0-10 4-10 9s4 8 10 8 10-3 10-8-4-9-10-9zM29 12V7h6v5M35 8h7l2 4"/><circle cx="46" cy="16" r="3"/>',
  optic: '<path d="M8 12h40v8H8zM8 10v12M48 9v14M22 20v5h14v-5M48 14h8v4h-8"/>',
  binoculars: '<circle cx="20" cy="20" r="8"/><circle cx="44" cy="20" r="8"/><path d="M28 19h8M14 12h8M42 12h8M16 12l-2-6M48 12l2-6"/>',
  compass: '<circle cx="32" cy="16" r="12"/><path d="M32 7l3 9-3 9-3-9zM32 4v3M32 25v3"/>',
  knife: '<path d="M30 20h26v6H30zM30 20L8 22q-3 0 0-3l22-6zM38 20v6M46 20v6"/>',
  launcher: '<path d="M5 12h44v8H5zM49 9h9v14h-9zM24 20v8h6v-8M14 12V7h5v5"/>',
  helmet: '<path d="M12 22a20 14 0 0 1 40 0zM8 22h48M20 26h24"/>',
  vest: '<path d="M18 4l-8 8v18h44V12l-8-8-6 6h-16zM24 18h16M24 24h16"/>',
  boot: '<path d="M16 4h12v14l16 5v6H14zM14 29h30"/>',
  box: '<path d="M10 11l22-7 22 7v14l-22 6-22-6zM10 11l22 7 22-7M32 18v13"/>',
};

const RULES = [
  [/קלע/, 'sniper'], [/נגב/, 'lmg'], [/מאג/, 'mmg'], [/רימון/, 'grenade'], [/כוונת|אקילה|ליאור|מכבים|שחמ|עדי|זאבון/, 'optic'],
  [/משקפת/, 'binoculars'], [/מצפן/, 'compass'], [/אולר/, 'knife'], [/מטול/, 'launcher'], [/קסדה/, 'helmet'], [/וסט/, 'vest'], [/נעל/, 'boot'],
  [/נשק|M5|קנספ|טריג/, 'rifle'],
];

export const gearKind = (type) => { const r = RULES.find(([re]) => re.test(type || '')); return r ? r[1] : 'box'; };
export const gearIcon = (type, cls = '') => `<svg class="gico ${cls}" viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[gearKind(type)]}</svg>`;
