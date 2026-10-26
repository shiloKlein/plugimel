// Planning who is in/out by date. Pure functions over the state (no DOM), used inside store.update.
// An absence is { id, soldierId, type, from, to, note, requestId? }; whole days are [dayStart(from), dayStart(to) + DAY).
import { newId, dayStart, DAY } from './util.js';

// Mark soldier `sid` as `type` for the range [from, to). type 'present' only clears absences in that range.
// Overlapping absences are cut around the range (split in two when the range is inside one).
export function setPresence(d, sid, from, to, type, note = '') {
  const next = [];
  for (const a of d.absences) {
    if (a.soldierId !== sid || a.to <= from || a.from >= to) { next.push(a); continue; }
    if (a.from < from) next.push({ ...a, to: from });
    if (a.to > to) next.push({ ...a, id: a.from < from ? newId() : a.id, from: to });
  }
  d.absences = next;
  if (type !== 'present') d.absences.push({ id: newId(), soldierId: sid, type, from, to, note });
}

// First and last-day inputs (timestamps of any time of day) -> [from, to) covering whole days.
export const dayRange = (first, last) => [dayStart(first), dayStart(last) + DAY];

// Absences that still matter (not over yet), soonest first.
export const upcomingAbsences = (st, now = Date.now(), sids = null) =>
  st.absences.filter((a) => a.to > now && (!sids || !sids.length || sids.includes(a.soldierId))).sort((a, b) => a.from - b.from);
