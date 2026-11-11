'use client';

import { useState, type ReactNode } from 'react';

const tabs = [
  { id: 'details', label: 'Детали' }, { id: 'activity', label: 'Активность' },
  { id: 'credits', label: 'AI-расходы' }, { id: 'history', label: 'История' },
] as const;

export function DrawerTabs({ details, activity, credits, history }: Record<typeof tabs[number]['id'], ReactNode>) {
  const [tab, setTab] = useState<typeof tabs[number]['id']>('details');
  return <><div className="drawer-tabs" aria-label="Разделы задачи">{tabs.map(({ id, label }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div key={tab} className="drawer-tab-body">{{ details, activity, credits, history }[tab]}</div></>;
}
