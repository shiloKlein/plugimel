import { dayStart, addDays } from './util.js';

// All data lives in one JSON object. Saved on the phone; Drive sync will plug in at persist()/onChange().
const KEY = 'platoon.v1';

export const DEFAULT_SETTINGS = {
  windowHours: 24,            // only shifts inside this window before a shift count for a soldier's points
  restHours: 8,               // shorter rest than this before/after a shift adds a penalty
  nightFrom: 22, nightTo: 6, eveningFrom: 18, eveningTo: 22,
  wNight: 2, wEvening: 1.3, wDay: 1,   // points per hour
  penRest: 30, penNightNight: 25, penPair: 60,
  separate: [],               // pairs of soldier ids that should not be on the same shift
  jobs: ['מ"מ', 'סמל', 'מ"כ', 'לוחם', 'קלע', 'נגב', 'מטול', 'מאג', 'חובש', 'קשר'],   // תפקיד
  places: ['מ"מ', 'סמל', 'כיתה א', 'כיתה ב', 'כיתה ג'],                                // מסגרת
  equipTypes: ['נשק', 'אופטיקה', 'נ"ג', 'קשר', 'אפוד', 'קסדה', 'אחר'],
};
export const ABSENCE_TYPES = { leave: 'חופשה', sick: 'גימלים', course: 'קורס', mission: 'משימה', appt: 'תור / פגישה', break: 'הפסקה', other: 'אחר' };
export const ROLES = { admin: 'מנהל', officer: 'קצין', sergeant: 'סמל' };
export const SERVICE = { full: 'מלא', part: 'חלקי', student: 'סטודנט' };
// Jobs that count as a commander for posts that require 'מפקד'
export const COMMANDER_JOBS = ['מ"מ', 'סמל', 'מ"כ'];
// Extra qualifications a soldier can have on top of the job
export const QUALS = ['מפקד', 'חובש', 'נהג', 'מקלען', 'קשר'];
export const CONDITIONS = { ok: 'תקין', broken: 'תקול', lost: 'אבד' };

// Who may do what. Soldiers (no login) can only view the board, roster, soldiers and equipment.
const PERMS = {
  viewRequests: ['admin', 'officer', 'sergeant'],
  editRoster: ['admin', 'officer'],
  editSoldiers: ['admin', 'officer'],
  editRequests: ['admin', 'officer'],
  editRules: ['admin', 'officer'],
  editEquipment: ['admin', 'sergeant'],
  manageUsers: ['admin'],
  manageData: ['admin'],
};
export const can = (user, perm) => !!user && (PERMS[perm] || []).includes(user.role);

let state = null;
const subs = new Set();

const defaultRound = () => { const t = dayStart(Date.now()); return { name: 'סבב 1', start: t, end: addDays(t, 27) }; };
const empty = () => ({ v: 1, round: defaultRound(), settings: { ...DEFAULT_SETTINGS }, users: [], soldiers: [], absences: [], posts: [], roster: [], equipment: [], requests: [], demo: false, updatedAt: 0 });

function normalize(s) {
  const base = empty();
  const out = { ...base, ...s, settings: { ...base.settings, ...(s && s.settings) } };
  for (const k of ['users', 'soldiers', 'absences', 'posts', 'roster', 'equipment', 'requests']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.round || !out.round.start) out.round = defaultRound();
  for (const s of out.soldiers) {          // older data: single name / squad
    if (s.first === undefined) { const [f, ...r] = String(s.name || '').split(' '); s.first = f || ''; s.last = r.join(' '); }
    if (s.place === undefined) s.place = s.squad || '';
    if (s.job === undefined) s.job = '';
    if (!s.service) s.service = 'full';
    s.name = [s.first, s.last].filter(Boolean).join(' ');
  }
  return out;
}

export function load() {
  try { const raw = localStorage.getItem(KEY); state = normalize(raw ? JSON.parse(raw) : {}); } catch { state = empty(); }
  return state;
}
export const get = () => state;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('save failed', e); } }
function emit() { subs.forEach((f) => f(state)); }

export function update(fn) { fn(state); state.updatedAt = Date.now(); persist(); emit(); }
export function replaceAll(s) { state = normalize(s); persist(); emit(); }
export const onChange = (f) => { subs.add(f); return () => subs.delete(f); };

// Start a new service round: soldiers, posts and rules stay.
export function newRound({ name, start, end, clearRoster, clearAbsences, clearRequests, unsign }) {
  update((s) => {
    s.round = { name, start, end };
    if (clearRoster) s.roster = [];
    if (clearAbsences) s.absences = [];
    if (clearRequests) s.requests = [];
    if (unsign) s.equipment.forEach((e) => { e.holderId = null; });
  });
}

// Remove people/equipment/roster data but keep users and rules.
export function clearData() {
  update((s) => { s.soldiers = []; s.absences = []; s.posts = []; s.roster = []; s.equipment = []; s.requests = []; s.settings.separate = []; s.demo = false; });
}
