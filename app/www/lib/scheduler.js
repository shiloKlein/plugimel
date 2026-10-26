// Auto-roster. Pure functions over the state object (no DOM), so they can be tested in node.
//
// Shift = { id, postId, start, end, need, people: [soldierId], locked }
//
// Points: each shift is worth hours x weight (night > evening > day). A soldier's score for a new shift is the
// points of their shifts inside the rolling window before it, plus penalties for soft-rule problems
// (short rest, night after night, "not together" pairs). The lowest score gets the seat.
// Hard filters only: not absent, not on another shift at that time, has the post's qualification.
import { HOUR, DAY, dayStart, addDays, overlap, newId } from './util.js';
import { COMMANDER_JOBS, ABSENCE_TYPES } from './store.js';

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
// A qualification may list alternatives separated by commas ("סמל,מ"מ" = either). 'מפקד' is satisfied by any commander job.
const qualOne = (sol, q) => sol.job === q || (sol.quals || []).includes(q) || (q === 'מפקד' && COMMANDER_JOBS.includes(sol.job));
export const qualOk = (sol, qual) => !qual || String(qual).split(',').map((q) => q.trim()).filter(Boolean).some((q) => qualOne(sol, q));
export const hasQual = (sol, post, qual = post && post.qual) => !post || qualOk(sol, qual);

// Posts are guard posts (auto-filled), or patrols / missions (placed by hand; may have roles: [{label, qual, n}]).
export const postKind = (post) => (post && post.kind) || 'guard';
export const KINDS = { guard: 'שמירה', patrol: 'סיור', mission: 'יזומה' };
export const expandRoles = (post) => ((post && post.roles) || []).flatMap((r) => Array.from({ length: Math.max(1, +r.n || 1) }, () => ({ label: r.label || '', qual: r.qual || '' })));
export const roleCount = (post) => expandRoles(post).length;
// Role seats of a shift not yet filled (indexes into expandRoles). shift.roles maps soldierId -> role index.
export function openRoles(post, shift) {
  const all = expandRoles(post), used = new Set(Object.values(shift.roles || {}));
  return all.map((r, i) => ({ ...r, i })).filter((r) => !used.has(r.i));
}
const roleOf = (post, shift, sid) => { const r = shift.roles && shift.roles[sid]; return r == null ? null : expandRoles(post)[r] || null; };

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
export function rank(st, slot, working, { excludeId = null, qual } = {}) {
  const post = st.posts.find((p) => p.id === slot.postId);
  const seated = slot.people.filter((p) => p !== excludeId);
  const avg = windowAverage(st, slot, working);
  const out = [];
  for (const sol of st.soldiers) {
    if (sol.active === false || seated.includes(sol.id) || !hasQual(sol, post, qual === undefined ? post && post.qual : qual)) continue;
    if (!isAvailable(st, sol.id, slot.start, slot.end)) continue;
    const r = evaluate(st, sol, slot, working, seated, avg);
    if (r) out.push({ ...r, jitter: Math.random() });
  }
  return out.sort((a, b) => a.score - b.score || a.jitter - b.jitter);
}

// Everybody who could be placed on a shift, with the full picture, for a person doing it by hand. Nobody is hidden:
// `conflict` (absent, already on another shift, missing qualification) is a warning the user can override,
// `reasons` are softer problems (short rest, night after night, not together). Free soldiers first, lowest points first.
export function candidates(st, slot, { excludeId = null, qual } = {}) {
  const post = st.posts.find((p) => p.id === slot.postId);
  const q = qual === undefined ? post && post.qual : qual;
  const seated = slot.people.filter((p) => p !== excludeId);
  const avg = windowAverage(st, slot, st.roster);
  const nameOfPost = (x) => ((st.posts.find((p) => p.id === x.postId) || {}).name) || '';
  const out = [];
  for (const sol of st.soldiers) {
    if (sol.active === false || seated.includes(sol.id)) continue;
    const mine = st.roster.filter((x) => x.id !== slot.id && x.people.includes(sol.id));
    const prev = mine.filter((x) => x.end <= slot.start).sort((a, b) => b.end - a.end)[0] || null;
    const next = mine.filter((x) => x.start >= slot.end).sort((a, b) => a.start - b.start)[0] || null;
    const clash = mine.find((x) => overlap(x.start, x.end, slot.start, slot.end));
    const away = st.absences.find((a) => a.soldierId === sol.id && overlap(a.from, a.to, slot.start, slot.end));
    let conflict = null;
    if (away) conflict = `נעדר (${ABSENCE_TYPES[away.type] || away.type})`;
    else if (clash) conflict = `משובץ במקביל: ${nameOfPost(clash)}`;
    else if (!hasQual(sol, post, q)) conflict = `חסר ${q}`;
    const ev = clash ? null : evaluate(st, sol, slot, st.roster, seated, avg);
    const raw = windowPoints(st, sol.id, slot, st.roster);
    const dayMs = dayStart(slot.start);
    const today = mine.filter((x) => x.start < dayMs + DAY && x.end > dayMs).sort((a, b) => a.start - b.start);
    out.push({
      soldier: sol, conflict, reasons: ev ? ev.reasons : [], points: ev ? ev.points : raw, partial: ev ? ev.partial : false,
      prev: prev && { end: prev.end, post: nameOfPost(prev) }, next: next && { start: next.start, post: nameOfPost(next) },
      today: today.map((x) => ({ start: x.start, end: x.end, post: nameOfPost(x) })),
      score: ev ? ev.score : raw, jitter: Math.random(),
    });
  }
  const tier = (c) => (c.conflict ? 2 : c.reasons.length ? 1 : 0);
  return out.sort((a, b) => tier(a) - tier(b) || a.score - b.score || a.jitter - b.jitter);
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
    else {
      const role = roleOf(post, shift, sid), q = role ? role.qual : post && post.qual;
      if (!hasQual(sol, post, q)) conflict = `חסר ${q}`;
    }
    const ev = conflict ? null : evaluate(st, sol, shift, st.roster, shift.people.filter((p) => p !== sid), 0);
    out[sid] = { conflict, reasons: ev ? ev.reasons : [] };
  }
  return out;
}

export function buildSlots(st, from, to) {
  const slots = [];
  for (let day = dayStart(from); day < to; day = addDays(day, 1)) {
    for (const post of st.posts) {
      if (postKind(post) !== 'guard') continue;
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
