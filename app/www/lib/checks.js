// Daily equipment checks (e.g. grenades, צל"מ). No DOM, so it can be tested in node.
//
// A check lists equipment types. Every signed item of those types must be accounted for each day:
//   ok      - the holder (or the sergeant) confirmed it is there
//   away    - it is with the soldier outside the base (home, leave...), with a note
//   missing - not found
// state.checkLog[day][checkId] = { expected: [itemId], marks: { [itemId]: { s, h, at, by, note } } }
import { dayStart } from './util.js';

const p2 = (n) => String(n).padStart(2, '0');
export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

export const defaultChecks = (equipTypes) => [
  { id: 'grenades', name: 'רימונים', types: ['רימון'] },
  { id: 'tzlm', name: 'צל"מ', types: equipTypes.filter((t) => t !== 'רימון') },
];

export const checksEnabled = (st) => !!st.settings.checksFrom;
const signed = (st, check) => st.equipment.filter((i) => check.types.includes(i.type) && i.holderId);

// Items that must be accounted for on a day. Today: what is signed now. A past day: what was expected when it was first touched.
export function expectedIds(st, ts, check) {
  const rec = st.checkLog[dayKey(ts)] && st.checkLog[dayKey(ts)][check.id];
  const ids = new Set((rec && rec.expected) || []);
  Object.keys((rec && rec.marks) || {}).forEach((id) => ids.add(id));
  if (!rec || ts >= dayStart(Date.now())) signed(st, check).forEach((i) => ids.add(i.id));
  return [...ids].filter((id) => st.equipment.some((i) => i.id === id));
}

// { state: 'none' | 'ok' | 'bad' | 'pending', done, total, ok, away, missing }
export function dayStatus(st, ts, check) {
  const today = dayStart(Date.now());
  if (!checksEnabled(st) || ts < dayStart(st.settings.checksFrom) || ts > today) return { state: 'none', done: 0, total: 0, ok: 0, away: 0, missing: 0 };
  const rec = st.checkLog[dayKey(ts)] && st.checkLog[dayKey(ts)][check.id];
  const marks = (rec && rec.marks) || {};
  const ids = expectedIds(st, ts, check);
  let ok = 0, away = 0, missing = 0;
  for (const id of ids) { const m = marks[id]; if (!m) continue; if (m.s === 'ok') ok++; else if (m.s === 'away') away++; else missing++; }
  const total = ids.length, done = ok + away;
  const state = total === 0 ? 'none' : missing > 0 ? 'bad' : done === total ? 'ok' : ts < today ? 'bad' : 'pending';
  return { state, done, total, ok, away, missing };
}

// One status for a whole day across all checks: the worst one.
export function dayOverall(st, ts) {
  const all = st.settings.checks.map((c) => dayStatus(st, ts, c).state).filter((s) => s !== 'none');
  if (!all.length) return 'none';
  return all.includes('bad') ? 'bad' : all.includes('pending') ? 'pending' : 'ok';
}

// Expected items grouped by who holds them: [{ soldier, items: [{ item, mark }] }]
export function groups(st, ts, check) {
  const rec = st.checkLog[dayKey(ts)] && st.checkLog[dayKey(ts)][check.id];
  const marks = (rec && rec.marks) || {};
  const by = {};
  for (const id of expectedIds(st, ts, check)) {
    const item = st.equipment.find((i) => i.id === id), mark = marks[id];
    const holder = (mark && mark.h) || item.holderId;
    if (!holder) continue;
    (by[holder] ||= []).push({ item, mark });
  }
  const placeRank = (s) => { const i = st.settings.places.indexOf(s.place); return i < 0 ? 99 : i; };
  return Object.entries(by)
    .map(([sid, items]) => ({ soldier: st.soldiers.find((s) => s.id === sid) || { id: sid, name: '?', place: '' }, items }))
    .sort((a, b) => placeRank(a.soldier) - placeRank(b.soldier) || a.soldier.name.localeCompare(b.soldier.name, 'he'));
}

// ---- changes (call inside store.update) ----
function ensure(d, ts, check) {
  const k = dayKey(ts);
  const day = (d.checkLog[k] ||= {});
  return (day[check.id] ||= { expected: d.equipment.filter((i) => check.types.includes(i.type) && i.holderId).map((i) => i.id), marks: {} });
}

// s: 'ok' | 'away' | 'missing' | 'clear'
export function mark(d, ts, check, itemId, s, { note = '', by = '' } = {}) {
  const rec = ensure(d, ts, check), item = d.equipment.find((i) => i.id === itemId);
  if (!item) return;
  if (s === 'clear') delete rec.marks[itemId];
  else rec.marks[itemId] = { s, h: item.holderId || null, at: Date.now(), by, note };
}

export function markAll(d, ts, check, soldierId, s, opts) {
  for (const g of groups(d, ts, check)) if (g.soldier.id === soldierId) g.items.forEach(({ item }) => mark(d, ts, check, item.id, s, opts));
}

// Soldiers who still have unaccounted items: [{ soldier, items }]
export function pendingGroups(st, ts, check) {
  return groups(st, ts, check)
    .map((g) => ({ soldier: g.soldier, items: g.items.filter((x) => !x.mark || x.mark.s === 'missing') }))
    .filter((g) => g.items.length);
}
