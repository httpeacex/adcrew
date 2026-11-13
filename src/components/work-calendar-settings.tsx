'use client';

import { useState } from 'react';
import { RequestForm } from './forms';
import type { WorkCalendar } from '@/lib/work-calendar';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function WorkCalendarSettings({ calendar }: { calendar: WorkCalendar }) {
  const [days, setDays] = useState(calendar.days);
  return <section className="product-panel product-padding" aria-labelledby="work-calendar-title">
    <h2 id="work-calendar-title">Рабочий календарь</h2>
    <p className="product-muted">Один график для команды · UTC+5. Дедлайны и просрочки идут по календарному времени.</p>
    <RequestForm url="/api/settings/work-calendar" returnTo="/settings">{({ busy }) => <fieldset disabled={busy}>
      <label className="field">Подсчёт времени<select name="enabled" defaultValue={String(calendar.enabled)}>
        <option value="false">Календарное время</option><option value="true">Только рабочее время</option>
      </select></label>
      <fieldset className="work-calendar-days"><legend>Рабочие дни</legend>
        {weekdays.map((label, index) => <label className="check" key={label}><input type="checkbox" checked={days.includes(index + 1)} onChange={event => setDays(event.target.checked ? [...days, index + 1] : days.filter(day => day !== index + 1))} />{label}</label>)}
      </fieldset>
      <input type="hidden" name="days" value={days.join(',')} />
      <div className="product-form-grid">
        <label className="field">Начало рабочего дня<input name="start" type="time" defaultValue={calendar.start} required /></label>
        <label className="field">Конец рабочего дня<input name="end" type="time" defaultValue={calendar.end} required /></label>
      </div>
      <button type="submit" className="button primary">Сохранить календарь</button>
    </fieldset>}</RequestForm>
  </section>;
}
