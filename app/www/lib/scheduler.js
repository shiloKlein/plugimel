// Auto-roster. Pure functions over the state object (no DOM), so they can be tested in node.
//
// Shift = { id, postId, start, end, need, people: [soldierId], locked }
//
// Points: each shift is worth hours x weight (night > evening > day). A soldier's score for a new shift is the
// points of their shifts inside the rolling window before it, plus penalties for soft-rule problems
// (short rest, night after night, "not together" pairs). The lowest score gets the seat.
// Hard filters only: not absent, not on another shift at that time, has the post's qualification.
import { HOUR, DAY, dayStart, addDays, overlap, newId } from './util.js';
import { COMMANDER_JOBS } from './store.js';

const STEP = 15 * 60e3;

const inNight = (h, s) => (s.nightFrom > s.nightTo ? h >= s.nightFrom || h < s.nightTo : h >= s.nightFrom && h < s.nightTo);
const inEvening = (h, s) => h >= s.eveningFrom && h < s.eveningTo;
export function hourWeight(h, s) { return inNight(h, s) ? s.wNight : inEvening(h, s) ? s.wEvening : s.wDay; }

export function shiftPoints(start, end, s) {
  let p = 0;
  for (let t = start; t < end; t += STEP) p += hourWeight(new Date(t).getHours(), s) * (Math.min(end, t + STEP) - t) / HOUR;
  return p;
}
export function isNight(start, end, s) {
  let n = 0;
  for (let t = start; t < end; t += STEP) if (inNight(new Date(t).getHours(), s)) n += Math.min(end, t + STEP) - t;
  return n * 2 >= end - start;
}

export const isAvailable = (st, sid, start, end) => !st.absences.some((a) => a.soldierId === sid && overlap(a.from, a.to, start, end));
export const hasQual = (sol, post) => !post || !post.qual || sol.job === post.qual || (sol.quals || []).includes(post.qual) || (post.qual === 'מפקד' && COMMANDER_JOBS.includes(sol.job));

// Absent for part of the window, or joined inside it: should not look "free" just because they have few points.
const isPartial = (st, sol, t) => {
  const from = t - st.settings.windowHours * HOUR;
  return (sol.joinedAt || 0) > from || st.absences.some((a) => a.soldierId === sol.id && overlap(a.from, a.to, from, t));
};

function windowPoints(st, sid, slot, working) {
  const from = slot.start - st.settings.windowHours * HOUR;
  let p = 0;
  for (const x of working) if (x.id !== slot.id && x.people.includes(sid) && x.end > from && x.start < slot.start) p += shiftPoints(x.start, x.end, st.settings);
  return p;
}

function windowAverage(st, slot, working) {
  const full = st.soldiers.filter((s) => s.active !== false && !isPartial(st, s, slot.start));
  if (!full.length) return 0;
  return full.reduce((a, s) => a + windowPoints(st, s.id, slot, working), 0) / full.length;
}

// Score of one soldier for one shift. null = hard conflict (overlaps another of their shifts).
function evaluate(st, sol, slot, working, seated, avg) {
  const cfg = st.settings, sid = sol.id;
  const mine = working.filter((x) => x.id !== slot.id && x.people.includes(sid));
  if (mine.some((x) => overlap(x.start, x.end, slot.start, slot.end))) return null;

  let lastEnd = -Infinity, nextStart = Infinity, nightRecent = false;
  for (const x of mine) {
    if (x.end <= slot.start) {
      if (x.end > lastEnd) lastEnd = x.end;
      if (x.end > slot.start - DAY && isNight(x.start, x.end, cfg)) nightRecent = true;
    } else if (x.start < nextStart) nextStart = x.start;
  }
  const raw = windowPoints(st, sid, slot, working);
  const partial = isPartial(st, sol, slot.start);
  const points = partial ? Math.max(raw, avg) : raw;

  let pen = 0; const reasons = [];
  const gap = Math.min((slot.start - lastEnd) / HOUR, (nextStart - slot.end) / HOUR);
  if (gap < cfg.restHours) { pen += cfg.penRest * (1 - gap / cfg.restHours); reasons.push(`מנוחה קצרה (${Math.round(gap * 10) / 10} ש׳)`); }
  if (nightRecent && isNight(slot.start, slot.end, cfg)) { pen += cfg.penNightNight; reasons.push('לילה אחרי לילה'); }
  if (cfg.separate.some(([a, b]) => (a === sid && seated.includes(b)) || (b === sid && seated.includes(a)))) { pen += cfg.penPair; reasons.push('מוגדרים כלא יחד'); }
  return { soldier: sol, points, raw, partial, pen, score: points + pen, reasons };
}

// Eligible soldiers for a shift, best first. excludeId = the person being replaced (shown as a candidate again).
export function rank(st, slot, working, { excludeId = null } = {}) {
  const post = st.posts.find((p) => p.id === slot.postId);
  const seated = slot.people.filter((p) => p !== excludeId);
  const avg = windowAverage(st, slot, working);
  const out = [];
  for (const sol of st.soldiers) {
    if (sol.active === false || seated.includes(sol.id) || !hasQual(sol, post)) continue;
    if (!isAvailable(st, sol.id, slot.start, slot.end)) continue;
    const r = evaluate(st, sol, slot, working, seated, avg);
    if (r) out.push({ ...r, jitter: Math.random() });
  }
  return out.sort((a, b) => a.score - b.score || a.jitter - b.jitter);
}

// Live check of an existing shift: conflicts (red) and soft problems (yellow) per person.
export function assess(st, shift) {
  const out = {};
  const post = st.posts.find((p) => p.id === shift.postId);
  for (const sid of shift.people) {
    const sol = st.soldiers.find((s) => s.id === sid);
    if (!sol) { out[sid] = { conflict: 'לא קיים', reasons: [] }; continue; }
    let conflict = null;
    if (sol.active === false) conflict = 'לא פעיל';
    else if (!isAvailable(st, sid, shift.start, shift.end)) conflict = 'נעדר';
    else if (st.roster.some((x) => x.id !== shift.id && x.people.includes(sid) && overlap(x.start, x.end, shift.start, shift.end))) conflict = 'משובץ במקביל';
    else if (!hasQual(sol, post)) conflict = `חסר ${post.qual}`;
    const ev = conflict ? null : evaluate(st, sol, shift, st.roster, shift.people.filter((p) => p !== sid), 0);
    out[sid] = { conflict, reasons: ev ? ev.reasons : [] };
  }
  return out;
}

export function buildSlots(st, from, to) {
  const slots = [];
  for (let day = dayStart(from); day < to; day = addDays(day, 1)) {
    for (const post of st.posts) {
      const open = day + post.from * HOUR;
      const close = day + (post.to <= post.from ? post.to + 24 : post.to) * HOUR;
      for (let t = open; t < close; t += post.shiftHours * HOUR) {
        if (t < from || t >= to) continue;
        slots.push({ postId: post.id, start: t, end: Math.min(t + post.shiftHours * HOUR, close), need: post.people });
      }
    }
  }
  return slots;
}

// Fills [from, to). Unlocked shifts starting in the range are replaced; locked (hand-edited) ones stay and count.
// Returns the new roster array.
export function generate(st, from, to) {
  const keep = st.roster.filter((sh) => sh.locked || sh.start < from || sh.start >= to);
  const working = [...keep];
  const slots = buildSlots(st, from, to)
    .filter((sl) => !keep.some((k) => k.postId === sl.postId && k.start === sl.start))
    .sort((a, b) => a.start - b.start || shiftPoints(b.start, b.end, st.settings) / (b.end - b.start) - shiftPoints(a.start, a.end, st.settings) / (a.end - a.start));
  for (const sl of slots) {
    const shift = { id: newId(), postId: sl.postId, start: sl.start, end: sl.end, need: sl.need, people: [], locked: false };
    working.push(shift);
    while (shift.people.length < shift.need) {
      const best = rank(st, shift, working)[0];
      if (!best) break;
      shift.people.push(best.soldier.id);
    }
  }
  return working;
}
