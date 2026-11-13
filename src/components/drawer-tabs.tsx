'use client';

import { useState, type ReactNode } from 'react';
import { Check, Link2 } from 'lucide-react';
import { browserRuntime } from '@/lib/client-runtime';

const tabs = [
  { id: 'details', label: 'Обзор' }, { id: 'versions', label: 'Версии' },
  { id: 'history', label: 'История' },
] as const;

export function DrawerTabs({ details, versions, history }: Record<typeof tabs[number]['id'], ReactNode>) {
  const [tab, setTab] = useState<typeof tabs[number]['id']>('details');
  return <><div className="drawer-tabs" aria-label="Разделы задачи">{tabs.map(({ id, label }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div key={tab} className="drawer-tab-body">{{ details, versions, history }[tab]}</div></>;
}

export function CopyTaskLink({ href }: { href: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(new URL(browserRuntime() ? `#${href}` : href, window.location.href).href); setState('copied'); }
    catch { setState('error'); }
  }
  return <><button type="button" className="icon-link" aria-label="Скопировать ссылку на задачу" title="Скопировать ссылку на задачу" onClick={copy}>{state === 'copied' ? <Check size={17} /> : <Link2 size={17} />}</button><span className="sr-only" role="status">{state === 'copied' ? 'Ссылка скопирована' : state === 'error' ? 'Скопируйте адрес из строки браузера' : ''}</span></>;
}
