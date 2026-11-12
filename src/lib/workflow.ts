export const statuses = [
  { id: 'new', label: 'Новые', hint: 'Можно взять в работу' },
  { id: 'progress', label: 'В работе', hint: 'Креативы в производстве' },
  { id: 'review', label: 'На проверке', hint: 'Ждут решения заказчика' },
  { id: 'revision', label: 'Правки', hint: 'Требуют доработки' },
  { id: 'done', label: 'Готово', hint: 'Работа принята' },
] as const;

export const formats = { image: 'Статика', video: 'Видео', animation: 'Анимация', other: 'Другой формат' } as const;
export const priorities = { low: 'Низкий', normal: 'Обычный', high: 'Высокий', urgent: 'Срочно' } as const;
export const roles = { buyer: 'Заказчик', creative: 'Креативщик', lead: 'Руководитель' } as const;
export const actionLabels = { create: 'Создана задача', claim: 'Взята в работу', submit: 'Сдан результат', revise: 'Запрошены правки', accept: 'Работа принята', assign: 'Назначен исполнитель' } as const;
export const aiServices = ['Midjourney', 'Runway', 'Kling', 'Adobe Firefly', 'ElevenLabs', 'ChatGPT', 'Другой сервис'] as const;
export const fileTypes = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'];
export const maxFileBytes = 25 * 1024 * 1024;
export const maxFiles = 5;
export const zoneLabel = 'UTC+5';
const zoneOffset = 5 * 3_600_000;
const day = 86_400_000;

export type Status = typeof statuses[number]['id'];
export type Format = keyof typeof formats;
export type Priority = keyof typeof priorities;
export type Role = keyof typeof roles;
export type Action = Exclude<keyof typeof actionLabels, 'create' | 'assign'>;
export type Actor = { id: number; role: Role };
export type Profile = Actor & { name: string; initials: string; color: string; email: string };
export type Brief = { offer: string; geo: string; format: Format; quantity: number; description: string; references: string[]; priority: Priority; deadline: number };
export type Task = Brief & {
  id: number; status: Status; buyerId: number; creativeId: number | null; version: number;
  createdAt: number; claimedAt: number | null; submittedAt: number | null; completedAt: number | null;
  buyerName: string; creativeName: string | null; creativeInitials: string | null; creativeColor: string | null;
  coverId?: number | null;
  commentCount?: number; fileCount?: number; checkedCount?: number;
};
export type Event = { id: number; actorName: string; action: keyof typeof actionLabels; fromStatus: Status | null; toStatus: Status; at: number; round: number | null };
export type ResultFile = { id: number; name: string; type: string; size: number };
export type Usage = { service: string; units: number };
export type Submission = { id: number; round: number; submittedAt: number; reviewNote: string | null; files: ResultFile[]; usage: Usage[] };

export class InputError extends Error {
  readonly status: number;
  readonly field?: string;
  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export function canRead(actor: Actor, task: Pick<Task, 'status' | 'buyerId' | 'creativeId'>) {
  if (actor.role === 'lead') return true;
  if (actor.role === 'buyer') return actor.id === task.buyerId;
  return task.status === 'new' || actor.id === task.creativeId;
}

export function actionsFor(actor: Actor, task: Pick<Task, 'status' | 'buyerId' | 'creativeId'>): Action[] {
  if (actor.role === 'buyer' && actor.id === task.buyerId && task.status === 'review') return ['revise', 'accept'];
  if (actor.role !== 'creative') return [];
  if (task.status === 'new') return ['claim'];
  if (actor.id === task.creativeId && (task.status === 'progress' || task.status === 'revision')) return ['submit'];
  return [];
}

export function localDay(time = Date.now()) {
  return new Date(time + zoneOffset).toISOString().slice(0, 10);
}

function parseDay(value: string) {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00+05:00`) : NaN;
  if (!Number.isFinite(time) || localDay(time) !== value) throw new InputError('Укажите корректную дату.');
  return time;
}

export function reportPeriod(start: string, end: string) {
  const from = parseDay(start);
  const to = parseDay(end) + day;
  if (from >= to) throw new InputError('Дата начала должна предшествовать дате окончания или совпадать с ней.');
  return { from, to };
}

function required(value: unknown, min: number, max: number, label: string, field: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max) throw new InputError(`${label} — от ${min} до ${max} символов.`, 400, field);
  return text;
}

export function validateBrief(data: Record<string, unknown>, now = Date.now()): Brief {
  const offer = required(data.offer, 2, 120, 'Оффер', 'offer');
  const geo = required(data.geo, 2, 40, 'GEO', 'geo').toUpperCase();
  const description = required(data.description, 5, 6000, 'Описание', 'description');
  if (typeof data.format !== 'string' || !Object.hasOwn(formats, data.format)) throw new InputError('Выберите формат.', 400, 'format');
  if (typeof data.priority !== 'string' || !Object.hasOwn(priorities, data.priority)) throw new InputError('Выберите приоритет.', 400, 'priority');
  const quantity = typeof data.quantity === 'string' && /^\d+$/.test(data.quantity) ? Number(data.quantity) : NaN;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new InputError('Укажите целое количество от 1 до 999.', 400, 'quantity');
  const date = typeof data.deadline === 'string' ? data.deadline : '';
  const deadline = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(date) ? Date.parse(`${date}:00+05:00`) : NaN;
  if (!Number.isFinite(deadline) || localDay(deadline) !== date.slice(0, 10) || deadline <= now) throw new InputError('Укажите будущую дату и время.', 400, 'deadline');
  const references = typeof data.references === 'string' ? data.references.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
  if (references.length > 10 || references.some((item) => {
    if (item.length > 2048) return true;
    try { const url = new URL(item); return !['http:', 'https:'].includes(url.protocol) || !!(url.username || url.password); } catch { return true; }
  })) throw new InputError('Добавьте до десяти ссылок http/https, по одной на строку.', 400, 'references');
  return { offer, geo, description, quantity, format: data.format as Format, priority: data.priority as Priority, deadline, references };
}

export function creditUnits(text: string) {
  const value = text.trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,3})?$/.test(value)) throw new InputError('Введите положительный расход с точностью до 0,001.');
  const [whole, fraction = ''] = value.split('.');
  const units = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (!units) throw new InputError('Введите расход больше нуля или отметьте «Без AI».');
  return units;
}

export function intervals(events: Pick<Event, 'toStatus' | 'at'>[]) {
  let production = 0;
  let review = 0;
  for (let index = 1; index < events.length; index++) {
    const previous = events[index - 1];
    const elapsed = Math.max(0, events[index].at - previous.at);
    if (previous.toStatus === 'progress' || previous.toStatus === 'revision') production += elapsed;
    if (previous.toStatus === 'review') review += elapsed;
  }
  return { cycle: events.length ? Math.max(0, events.at(-1)!.at - events[0].at) : 0, production, review };
}

export function isOverdue(task: Pick<Task, 'deadline' | 'completedAt'>, now = Date.now()) {
  return (task.completedAt ?? now) > task.deadline;
}

export function formatDate(time: number, full = false) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Yekaterinburg', day: 'numeric', month: 'short', ...(full && { hour: '2-digit', minute: '2-digit' }) }).format(time);
}

export function duration(time: number | null) {
  if (time === null) return '—';
  const minutes = Math.round(time / 60_000);
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`;
}

export function formatCredits(units: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(units / 1000);
}
