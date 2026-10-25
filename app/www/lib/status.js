import { ABSENCE_TYPES } from './store.js';

// Where a soldier is right now: away (absence), on duty (current shift) or at base.
export function statusOf(st, sid, now = Date.now()) {
  const a = st.absences.filter((x) => x.soldierId === sid && x.from <= now && now < x.to).sort((p, q) => q.from - p.from)[0];
  if (a) return { kind: 'away', type: a.type, absence: a, label: ABSENCE_TYPES[a.type] || a.type, until: a.to };
  const sh = st.roster.find((x) => x.people.includes(sid) && x.start <= now && now < x.end);
  if (sh) {
    const post = st.posts.find((p) => p.id === sh.postId);
    return { kind: 'duty', label: 'בשמירה' + (post ? `: ${post.name}` : ''), until: sh.end, shift: sh };
  }
  return { kind: 'base', label: 'בבסיס' };
}

export const soldierName = (st, id) => (st.soldiers.find((s) => s.id === id) || { name: '?' }).name;

const DAY = 24 * 3600e3;
const noon = (t) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };

// Position of a day inside the service round: { inRound, n, total }
export function roundInfo(st, t = Date.now()) {
  const r = st.round, d0 = new Date(t).setHours(0, 0, 0, 0);
  const total = Math.round((r.end - r.start) / DAY) + 1;
  const n = Math.round((d0 - r.start) / DAY) + 1;
  return { inRound: n >= 1 && n <= total, n, total };
}

// Expected presence on a day (judged at noon): who is here, who is away.
export function presenceOn(st, t) {
  const at = noon(t);
  const present = [], away = [];
  for (const s of st.soldiers) {
    if (s.active === false) continue;
    const a = st.absences.find((x) => x.soldierId === s.id && x.from <= at && at < x.to);
    if (a) away.push({ s, a }); else present.push(s);
  }
  return { present, away };
}

// Per job: how many exist and how many are present. total>0 && here===0 means nobody covers that job.
export function jobCoverage(st, present) {
  const here = new Set(present.map((s) => s.id));
  const jobs = {};
  for (const s of st.soldiers) {
    if (s.active === false || !s.job) continue;
    const j = (jobs[s.job] ||= { job: s.job, total: 0, here: 0 });
    j.total++; if (here.has(s.id)) j.here++;
  }
  const rank = (j) => { const i = st.settings.jobs.indexOf(j.job); return i < 0 ? 99 : i; };
  return Object.values(jobs).sort((a, b) => rank(a) - rank(b));
}
