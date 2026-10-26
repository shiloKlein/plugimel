import { newId, HOUR, DAY, dayStart } from './util.js';

// Fake data for trying the app. Everything here can be deleted from Settings → נתונים.
const NAMES = ['דני לוי', 'יוסי כהן', 'אורי מזרחי', 'נועם פרץ', 'איתי ביטון', 'עומר דהן', 'רון אברהם', 'גיא שטרן', 'עידו חדד', 'תומר גולן', 'אלון פרידמן', 'שחר נחום',
  'מתן אזולאי', 'ליאור סבן', 'אמיר רוזן', 'יובל שמש', 'אביב מלכה', 'דור קפלן', 'בן אשכנזי', 'ניר עמר', 'טל וקנין', 'רועי בן דוד', 'ארז יוסף', 'עדי מור'];

export function makeDemo() {
  const now = Date.now(), today = dayStart(now);
  // 0 = מ"מ, 1 = סמל, then three squads of 7-8 with a מ"כ each
  const placeOf = (i) => (i === 0 ? 'מ"מ' : i === 1 ? 'סמל' : i < 9 ? 'כיתה א' : i < 16 ? 'כיתה ב' : 'כיתה ג');
  const jobOf = (i) => (i === 0 ? 'מ"מ' : i === 1 ? 'סמל' : [2, 9, 16].includes(i) ? 'מ"כ' : [3, 10, 17].includes(i) ? 'נגב' : [4, 11].includes(i) ? 'קלע' : i === 12 ? 'מטול' : i === 5 ? 'חובש' : 'לוחם');
  const soldiers = NAMES.map((name, i) => {
    const [first, ...rest] = name.split(' ');
    return { id: newId(), first, last: rest.join(' '), name, platoon: 'מחלקה 1', place: placeOf(i), job: jobOf(i), service: i === 19 ? 'student' : i === 20 ? 'part' : 'full', quals: [], phone: '0505550' + String(i).padStart(3, '0'), active: true, joinedAt: 0 };
  });
  const posts = [
    { id: newId(), name: 'שער ראשי', people: 2, shiftHours: 4, from: 0, to: 24, qual: '' },
    { id: newId(), name: 'מגדל תצפית', people: 1, shiftHours: 3, from: 0, to: 24, qual: '' },
    { id: newId(), name: 'מפקד תורן', people: 1, shiftHours: 8, from: 0, to: 24, qual: 'מפקד' },
  ];
  const absences = [
    { id: newId(), soldierId: soldiers[4].id, type: 'leave', from: today - DAY, to: today + 2 * DAY, note: '' },
    { id: newId(), soldierId: soldiers[9].id, type: 'leave', from: today, to: today + DAY, note: '' },
    { id: newId(), soldierId: soldiers[13].id, type: 'sick', from: today - DAY, to: today + DAY + 12 * HOUR, note: 'גימלים' },
    { id: newId(), soldierId: soldiers[17].id, type: 'course', from: today - 3 * DAY, to: today + 4 * DAY, note: 'קורס מכ"ים' },
  ];
  const equipment = [];
  const give = (type, label, n, every, serialBase) => {
    for (let i = 0; i < n; i++) {
      const holder = soldiers[i * every];
      equipment.push({ id: newId(), type, name: label, serial: String(serialBase + i * 7), condition: 'ok', holderId: holder ? holder.id : null, note: '', log: [] });
    }
  };
  give('נשק', 'M16', 26, 1, 4400100);
  give('משקפת', '', 4, 1, 330);
  give('קנספ', '', 3, 7, 910);
  give('רימון', '', 20, 1, 5100);
  equipment[3].condition = 'broken';
  // counted personal gear: one record per type and soldier
  for (const [type, qty] of [['וסט', 1], ['קסדה', 1], ['מחסניות', 7]]) {
    for (const s of soldiers) equipment.push({ id: newId(), type, name: '', serial: '', qty, condition: 'ok', holderId: s.id, note: '', log: [] });
  }
  const requests = [
    { id: newId(), soldierId: soldiers[2].id, type: 'break', from: today + 14 * HOUR, to: today + 16 * HOUR, note: 'שיחת טלפון משפחתית', status: 'pending', created: now },
    { id: newId(), soldierId: soldiers[6].id, type: 'leave', from: today + 2 * DAY, to: today + 4 * DAY, note: 'חתונה', status: 'pending', created: now },
  ];
  return { soldiers, posts, absences, equipment, requests };
}
