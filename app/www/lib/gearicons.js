// Line drawings for equipment types. gearIcon(type) picks one by the Hebrew name; unknown types get the crate.
// Each entry: [viewBox, stroke width, svg content].
const WIDE = '0 0 48 32', SQ = '0 0 24 24';
const I = {
  rifle: [WIDE, 1.8, '<path d="M3 13H15L19 10H32L35 12H46V15H34L31 17H20L17 15H11L8 19H4L6 15H3Z"/><path d="M22 17L23 24H27L28 17M30 10V6H35V12"/><path d="M12 11V7H19V11M37 12V9H40"/>'],
  machine: [WIDE, 1.8, '<path d="M2 12H17L20 9H34L37 12H46V15H35L32 17H19L16 15H8L5 19H3Z"/><path d="M22 17V23H27L29 17M13 11V7H20V11"/><path d="M32 9V6H36V12M8 19V22"/>'],
  scope: [WIDE, 1.8, '<path d="M7 12H40V19H7Z"/><path d="M2 14H7M40 14H46M13 12V19M34 12V19"/><path d="M19 12V7H27V12M21 7V5H25V7"/>'],
  launcher: [WIDE, 1.8, '<path d="M4 11H36V17H4Z"/><path d="M36 12H43V16H36M8 11V8H13V11"/><path d="M16 17L17 24H21L22 17M4 14H1"/>'],
  binoculars: [WIDE, 1.8, '<circle cx="14" cy="19" r="7"/><circle cx="34" cy="19" r="7"/><path d="M10 12L8 6M18 12L20 6M30 12L28 6M38 12L40 6"/><path d="M21 16H27M21 20H27"/>'],
  grenade: [SQ, 1.6, '<path d="M9 7H15L17 10V18A5 5 0 0 1 7 18V10Z"/><path d="M9 7V4H15V7M15 4L19 3L20 6L16 8"/><path d="M8 12H16M8 15H16"/>'],
  compass: [SQ, 1.6, '<circle cx="12" cy="12" r="9"/><path d="M15.5 7.5L13 13L8.5 16.5L11 11Z"/><path d="M12 2V4M22 12H20"/>'],
  helmet: [SQ, 1.6, '<path d="M3 15A9 9 0 0 1 21 15"/><path d="M2 15H22V18H3L2 15Z"/><path d="M7 8L8 5M17 8L16 5"/>'],
  boots: [SQ, 1.6, '<path d="M4 3H10V13L15 16L21 17V20H3V17L4 13Z"/><path d="M4 17H15M10 13L14 15"/>'],
  vest: [SQ, 1.6, '<path d="M8 3H5L3 8V21H21V8L19 3H16L14 7H10Z"/><path d="M8 3L10 7H14L16 3M12 7V21"/><rect x="5" y="11" width="5" height="5"/><rect x="14" y="11" width="5" height="5"/>'],
  goggles: [SQ, 1.6, '<path d="M2 10L4 7H20L22 10"/><path d="M3 10L4 17H10L12 13L14 17H20L21 10"/><path d="M10 10H14"/>'],
  knife: [SQ, 1.6, '<path d="M3 15L14 4L19 3L17 8L8 17Z"/><path d="M3 15L8 17L6 21L2 19Z"/><path d="M8 17L17 8"/>'],
  sleepingBag: [SQ, 1.6, '<path d="M7 3H17L20 6V18L17 21H7L4 18V6Z"/><path d="M7 3L9 8H15L17 3M9 8V16M15 8V16"/><path d="M9 16H15"/>'],
  duffel: [SQ, 1.6, '<path d="M4 8H20L22 12V19H2V12Z"/><path d="M8 8V5A4 4 0 0 1 16 5V8"/><path d="M2 13H22M7 13V17M17 13V17"/>'],
  magazines: [SQ, 1.6, '<path d="M4 4H10V15L8 20H4Z"/><path d="M13 3H19V15L17 20H13Z"/><path d="M4 7H10M13 6H19"/>'],
  nvScope: [WIDE, 1.8, '<path d="M10 10H36V22H10Z"/><path d="M36 8H43V24H36Z"/><path d="M5 12H10V20H5Z"/><path d="M18 10V6H22V10M26 10V7H29V10"/><path d="M8 25H40M12 22V25M22 22V25M32 22V25"/>'],
  acog: [WIDE, 1.8, '<path d="M8 13H36V21H8Z"/><path d="M36 12H42V22H36Z"/><path d="M4 14H8V20H4Z"/><path d="M10 9H34V11H10Z"/><path d="M14 21V25H18V21M26 21V25H30V21M6 26H40"/>'],
  barrelBag: [WIDE, 1.8, '<path d="M4 12H44V22H4Z"/><path d="M7 17H41M41 17V20"/><path d="M16 12C16 5 32 5 32 12"/><path d="M44 14H47V20H44"/>'],
  dmr: [WIDE, 1.8, '<path d="M2 14H13L16 12H32L35 14H46V17H34L31 19H18L15 17H8L6 20H3Z"/><path d="M16 5H30V9H16ZM20 9V12M27 9V12"/><path d="M21 19L22 25H26L27 19"/><path d="M6 17L3 27M6 17L10 27"/>'],
  sling: [WIDE, 1.8, '<path d="M8 9C8 20 19 26 24 26C29 26 40 20 40 9"/><path d="M5 3H11V9H5ZM37 3H43V9H37Z"/><path d="M22 24V29H26V24"/>'],
  laser: [WIDE, 1.8, '<path d="M8 9H36V23H8Z"/><circle cx="16" cy="16" r="4"/><circle cx="28" cy="16" r="4"/><path d="M36 12H42V20H36Z"/><path d="M12 23V27H32V23"/>'],
  eoDevice: [WIDE, 1.8, '<path d="M6 8H34V18H6Z"/><path d="M34 9H41V17H34Z"/><circle cx="14" cy="13" r="3"/><path d="M14 18L13 28H22L23 18"/><path d="M26 11H30"/>'],
  thermal: [WIDE, 1.8, '<path d="M12 10H34V22H12Z"/><path d="M34 7H42V25H34Z"/><circle cx="38" cy="16" r="3"/><path d="M16 10V6H28V10M19 7H25"/><path d="M6 12H12V20H6Z"/><path d="M14 22V26H32V22"/>'],
  monocular: [WIDE, 1.8, '<path d="M6 12H30L40 9V23L30 20H6Z"/><path d="M2 13H6V19H2Z"/><path d="M14 12V20M18 12V20"/><path d="M20 20V26H26V20"/>'],
  nvSight: [WIDE, 1.8, '<path d="M3 11H9L11 13V19L9 21H3Z"/><path d="M11 11H34V21H11Z"/><path d="M34 10H40V22H34Z"/><circle cx="22" cy="7" r="3"/><path d="M14 21V25H30V21"/>'],
  rainSuit: [SQ, 1.6, '<path d="M8 2.5L4 5V11H7V9H17V11H20V5L16 2.5C16 5 8 5 8 2.5Z"/><path d="M7 12H17L18 22H13L12 16L11 22H6Z"/>'],
  uniform: [SQ, 1.6, '<path d="M7 2L3 4V9L6 10V12H18V10L21 9V4L17 2C16 4 8 4 7 2Z"/><path d="M6 13H18L19 22H13.5L12 16L10.5 22H5Z"/><path d="M12 4V12M4 6H7V8H4"/>'],
  bandage: [SQ, 1.6, '<circle cx="9" cy="12" r="6"/><circle cx="9" cy="12" r="2"/><path d="M15 12H21V18H13M18 12V18"/>'],
  tourniquet: [SQ, 1.6, '<path d="M4 8H20V19H4Z"/><path d="M12 3V13M10 3H14"/><path d="M7 14H17"/>'],
  kneePads: [SQ, 1.6, '<path d="M7 4H17V14C17 18 14 20 12 20C10 20 7 18 7 14Z"/><path d="M4 8H7M17 8H20M4 14H7M17 14H20"/><path d="M10 9H14V15H10Z"/>'],
  hydration: [SQ, 1.6, '<path d="M7 3H17V19A2 2 0 0 1 15 21H9A2 2 0 0 1 7 19Z"/><path d="M12 6C12 1 20 1 20 8V12M19 12H21V15H19Z"/><path d="M7 10H17"/>'],
  sensorHead: [SQ, 1.6, '<path d="M5 4H19V10H5Z"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="7" r="2"/><path d="M12 10V15M12 15L6 21M12 15L18 21M12 15V21"/>'],
  crate: [SQ, 1.6, '<path d="M3 7L12 3L21 7L12 11Z"/><path d="M3 7V17L12 21L21 17V7"/><path d="M12 11V21"/>'],
};

// Hebrew name -> icon. First match wins.
const RULES = [
  [/^משקפי/, 'goggles'], [/^משקפת/, 'binoculars'], [/^(נשק|m5)/i, 'rifle'], [/^קלע/, 'dmr'], [/^(מאג|נגב)/, 'machine'], [/^קנספ/, 'barrelBag'],
  [/^כוונת/, 'scope'], [/^אקילה/, 'nvScope'], [/^טריג/, 'acog'], [/^עדי/, 'thermal'], [/^שחמ/, 'monocular'], [/^ליאור/, 'nvSight'],
  [/^מכבימ/, 'sensorHead'], [/^זאבונ/, 'eoDevice'], [/^ציי(ר)?נ/, 'laser'], [/^מטול/, 'launcher'], [/^רימונ/, 'grenade'], [/^מצפנ/, 'compass'],
  [/^רצועה/, 'sling'], [/^וסט/, 'vest'], [/^קסדה/, 'helmet'], [/^נעל/, 'boots'], [/^אולר/, 'knife'], [/^שקש/, 'sleepingBag'], [/^קיטבג/, 'duffel'],
  [/^מחסני/, 'magazines'], [/^חלפס/, 'rainSuit'], [/^מדימ/, 'uniform'], [/^תא$/, 'bandage'], [/^חע$/, 'tourniquet'], [/^ברכיו/, 'kneePads'], [/^שלוקר/, 'hydration'],
];

// Final letters are folded (ם->מ, ן->נ ...) and quotes/dots dropped, so שק"ש, שקש, שחם and שחמ all match.
const FINAL = { 'ם': 'מ', 'ן': 'נ', 'ך': 'כ', 'ף': 'פ', 'ץ': 'צ' };
const norm = (t) => String(t || '').replace(/["'״׳.\s]/g, '').replace(/[םןךףץ]/g, (c) => FINAL[c]);

export const gearKind = (type) => { const t = norm(type); const r = RULES.find(([re]) => re.test(t)); return r ? r[1] : 'crate'; };
export const gearIcon = (type, cls = '') => {
  const [box, w, body] = I[gearKind(type)];
  return `<svg class="gico ${cls}" viewBox="${box}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
};
