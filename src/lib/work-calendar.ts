import type { Store } from './store.ts';
import { InputError, type Actor } from './workflow.ts';

export type WorkCalendar = { enabled: boolean; days: number[]; start: string; end: string };
const key = 'work-calendar-v1';
const minute = 60_000;
const day = 86_400_000;
const zoneOffset = 5 * 3_600_000;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const defaultWorkCalendar: WorkCalendar = { enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };

export function readWorkCalendar(store: Store): WorkCalendar {
  const row = store.db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
  return row ? JSON.parse(String(row.value)) as WorkCalendar : defaultWorkCalendar;
}

export function saveWorkCalendar(store: Store, actor: Actor, fields: { enabled: string; days: string; start: string; end: string }) {
  if (actor.role !== 'lead') throw new InputError('Рабочий календарь настраивает руководитель.', 403);
  if (fields.enabled !== 'true' && fields.enabled !== 'false') throw new InputError('Выберите режим подсчёта времени.');
  const days = fields.days === '' ? [] : [...new Set(fields.days.split(',').map(Number))].sort();
  if (!days.length || days.some(value => !Number.isInteger(value) || value < 1 || value > 7)) throw new InputError('Выберите хотя бы один рабочий день.');
  if (!timePattern.test(fields.start) || !timePattern.test(fields.end) || fields.start >= fields.end) throw new InputError('Конец рабочего дня должен быть позже начала.');
  const calendar = { enabled: fields.enabled === 'true', days, start: fields.start, end: fields.end };
  store.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(calendar));
  return calendar;
}

function timeOfDay(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return (60 * hours + minutes) * minute;
}

export function measuredTime(from: number, to: number, calendar?: WorkCalendar | null): number {
  if (to <= from) return 0;
  if (!calendar?.enabled) return to - from;
  const start = timeOfDay(calendar.start);
  const end = timeOfDay(calendar.end);
  const first = Math.floor((from + zoneOffset) / day) * day - zoneOffset;
  let date = first;
  const last = Math.floor((to + zoneOffset) / day) * day - zoneOffset;
  let total = 0;
  const fullWeeks = Math.max(0, Math.floor((last - date - day) / (7 * day)));
  if (fullWeeks) total += fullWeeks * calendar.days.length * (end - start);
  for (; date <= last; date += day) {
    const weekday = new Date(date + zoneOffset).getUTCDay() || 7;
    if (calendar.days.includes(weekday)) total += Math.max(0, Math.min(date + end, to) - Math.max(date + start, from));
    if (date === first) date += fullWeeks * 7 * day;
  }
  return total;
}
