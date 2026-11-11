'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { fileHref } from '@/lib/client-runtime';
import { Bell, Check, ChevronDown, Clock3, Film, Flag, ImageIcon, Layers3, Play, Plus, Search, Shapes, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import { formatDate, formats, isOverdue, priorities, statuses, type Actor, type Format, type Status, type Task } from '@/lib/workflow';
import { ThemeToggle } from './theme';

const icons = { image: ImageIcon, video: Film, animation: Shapes, other: Layers3 };

export function FormatMark({ format }: { format: Format }) {
  const Icon = icons[format];
  return <span className={`format-mark ${format}`}><Icon size={14} aria-hidden="true" /></span>;
}

export function Avatar({ initials, color, size = '' }: { initials: string; color: string; size?: string }) {
  return <span className={`avatar ${color} ${size}`}>{initials}</span>;
}

function TaskCard({ task, now, href, selected }: { task: Task; now: number; href: string; selected: boolean }) {
  const overdue = isOverdue(task, now) && task.status !== 'done';
  return <Link className={`task-card${overdue ? ' overdue-card' : ''}${selected ? ' is-selected' : ''}`} href={href} scroll={false} aria-current={selected ? 'true' : undefined}>
    <div className="card-body"><div className="card-top">
      <span className="task-code">КР-{String(task.id).padStart(3, '0')}</span><span className={`priority ${task.priority}`} title={`Приоритет: ${priorities[task.priority]}`}><Flag size={11} /> {priorities[task.priority]}</span></div>
    <h3>{task.offer}</h3>
    {task.coverId && <span className={`card-cover ${task.format}`}>
      <NextImage alt="" fill loading="lazy" unoptimized src={fileHref(task.coverId, true)} />
      {task.format === 'video' ? <span className="cover-play" aria-hidden="true"><Play size={14} fill="currentColor" /></span> : null}
      {task.status === 'done' && <span className="cover-accepted"><Check size={12} aria-hidden="true" /></span>}
    </span>}
    <div className="card-tags"><FormatMark format={task.format} /><span>{formats[task.format]}</span><span className="card-separator" /><span>{task.quantity} шт.</span><span className="geo-tag">{task.geo}</span></div>
    <div className="card-footer"><span className={`due ${overdue ? 'late' : ''}`} title={overdue ? 'Дедлайн просрочен' : 'Дедлайн'}>{overdue ? <TriangleAlert size={13} /> : <Clock3 size={13} />}{formatDate(task.deadline)}</span>
      {task.creativeInitials ? <span className="card-person" title={task.creativeName || undefined}><span>{task.creativeName?.split(' ')[0]}</span><Avatar initials={task.creativeInitials} color={task.creativeColor || 'violet'} size="tiny" /></span> : <span className="empty-avatar" title="Без исполнителя">Свободна</span>}
    </div></div>
  </Link>;
}


export function Board({ tasks, person, mine, now, selectedId, defaultDrawer, account, drawer, unread = 0 }: {
  tasks: Task[]; person: Actor; mine: boolean; now: number; selectedId?: number; defaultDrawer: boolean; account: ReactNode; drawer: ReactNode; unread?: number;
}) {
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [lateOnly, setLateOnly] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<Status, boolean>>>({});
  const restored = useRef(false);
  const storageKey = `adcrew-board:${person.id}:${mine ? 'mine' : 'all'}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved) {
        // Restore browser-only preferences after hydration.
        /* eslint-disable react-hooks/set-state-in-effect */
        setQuery(typeof saved.query === 'string' ? saved.query : '');
        setGeo(typeof saved.geo === 'string' ? saved.geo : '');
        setAssignee(typeof saved.assignee === 'string' ? saved.assignee : '');
        setPriority(Object.hasOwn(priorities, saved.priority) ? saved.priority : '');
        setStatus(statuses.some(item => item.id === saved.status) ? saved.status : '');
        setLateOnly(saved.lateOnly === true);
        setShowFilters(saved.showFilters === true);
        setExpanded(saved.expanded && typeof saved.expanded === 'object' ? saved.expanded : {});
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch { /* Storage can be disabled or cleared by the browser. */ }
    restored.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (!restored.current) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ query, geo, priority, assignee, status, lateOnly, showFilters, expanded })); } catch { /* Browsing remains available without storage. */ }
  }, [storageKey, query, geo, priority, assignee, status, lateOnly, showFilters, expanded]);
  const isBuyer = person.role === 'buyer';
  const hasTaskDrawer = !!drawer && !defaultDrawer;
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k') return;
      if (hasTaskDrawer && window.matchMedia('(max-width: 1199px)').matches) return;
      event.preventDefault();
      searchInput.current?.focus();
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [hasTaskDrawer]);
  useEffect(() => {
    if (!hasTaskDrawer) return;
    const media = window.matchMedia('(max-width: 1199px)');
    let release = () => {};
    function activate() {
      release();
      release = () => {};
      if (!media.matches) return;
      const panel = document.querySelector<HTMLElement>('.task-drawer');
      if (!panel) return;
      const trigger = document.querySelector<HTMLElement>('.task-card.is-selected');
      const hidden: HTMLElement[] = [];
      let current: HTMLElement = panel;
      while (current.parentElement && current !== document.body) {
        for (const sibling of current.parentElement.children) {
          if (sibling instanceof HTMLElement && sibling !== current && !sibling.classList.contains('drawer-backdrop') && !sibling.inert) {
            sibling.inert = true; hidden.push(sibling);
          }
        }
        current = current.parentElement;
      }
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const focusable = () => [...panel.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')].filter(e => e.getClientRects().length);
      focusable()[0]?.focus();
      function onKey(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          event.preventDefault(); panel!.querySelector<HTMLElement>('[aria-label="Закрыть карточку"]')?.click();
        }
        if (event.key === 'Tab') {
          const items = focusable();
          if (!items.length) return;
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || !panel!.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || !panel!.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', onKey);
      release = () => {
        document.removeEventListener('keydown', onKey);
        hidden.forEach(e => { e.inert = false; });
        panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
        document.body.style.overflow = previousOverflow;
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      };
    }
    activate();
    media.addEventListener('change', activate);
    return () => { media.removeEventListener('change', activate); release(); };
  }, [hasTaskDrawer, selectedId]);
  const scoped = mine ? tasks.filter((task) => task.buyerId === person.id || task.creativeId === person.id) : tasks;
  const geos = [...new Set(scoped.map((task) => task.geo))].sort();
  const term = query.trim().toLocaleLowerCase('ru');
  const overdue = (task: Task) => task.status !== 'done' && isOverdue(task, now);
  const filtered = scoped.filter((task) => (!term || task.offer.toLocaleLowerCase('ru').includes(term)) && (!geo || task.geo === geo) &&
    (!priority || task.priority === priority) && (!assignee || (assignee === 'free' ? !task.creativeId : String(task.creativeId) === assignee)) && (!lateOnly || overdue(task)) && (!status || task.status === status));
  const boardPath = mine ? '/board?scope=mine&' : '/board?';
  const hasFilters = lateOnly || !!(query || geo || priority || assignee || status);
  function resetFilters() { setLateOnly(false); setQuery(''); setGeo(''); setPriority(''); setAssignee(''); setStatus(''); }
  return <div className={`board-layout${drawer ? ' with-drawer' : ''}${defaultDrawer ? ' default-drawer' : ''}`}>
    <header className="board-heading" role="banner">
      <div className="header-toolbar">
        <div className="search" role="search" aria-label="Поиск по задачам">
          <Search className="search-icon" size={16} aria-hidden="true" />
          <input ref={searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск задач" aria-label="Поиск по офферу" aria-keyshortcuts="Control+K Meta+K" />
          {query ? <button className="search-clear" type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
            : <kbd className="search-shortcut" aria-hidden="true">Ctrl K</kbd>}
        </div>
        <div className="board-header-actions">
          <div className="header-tools">
            <button type="button" className="theme-toggle" title="Фильтры" aria-label="Фильтры" aria-expanded={showFilters} aria-controls="board-filters" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={17} /></button>
            <button type="button" className="theme-toggle alert-button" title="Просроченные задачи" aria-label="Просроченные задачи" aria-pressed={lateOnly} onClick={() => { setLateOnly(!lateOnly); setStatus(''); }}><Clock3 size={18} />{scoped.some(overdue) && <i />}</button>
            <Link className="theme-toggle notification-trigger" href="/notifications" aria-label={`Уведомления${unread ? `: ${unread} непрочитанных` : ''}`} title="Уведомления"><Bell size={18} />{unread > 0 && <i />}</Link>
            <ThemeToggle />
            {isBuyer && <Link href="/tasks/new" className="theme-toggle header-create" title="Новая задача" aria-label="Новая задача"><Plus size={20} /></Link>}
          </div>
          <div className="board-account">{account}</div>
        </div>
      </div>
    </header>
    <div className="board-main">
    <section className="board-intro" aria-label="Креативное производство">
      <div><p className="workspace-kicker">Рабочее пространство</p><h1>{mine ? 'Мои задачи' : 'Доска задач'}</h1><p>Производство, согласование и результаты в одном месте.</p></div>
      <div className="board-intro-actions"><Link href="/how-it-works" className="button secondary guide-link"><Play size={13} /> Как это работает</Link>{isBuyer && <Link href="/tasks/new" className="button primary"><Plus size={16} />Создать задачу</Link>}</div>
    </section>
    <div className="board-quick-tabs" aria-label="Представления доски">
      <Link href="/board?task=none" className={!mine && !lateOnly ? 'active' : ''}>Все задачи <span>{tasks.length}</span></Link>
      {person.role === 'creative' && <Link href="/board?scope=mine&task=none" className={mine && !lateOnly ? 'active' : ''}>Мои <span>{tasks.filter(task => task.creativeId === person.id).length}</span></Link>}
      <button type="button" className={lateOnly ? 'active' : ''} aria-pressed={lateOnly} onClick={() => { setLateOnly(!lateOnly); setStatus(''); }}>Просрочены <span>{scoped.filter(overdue).length}</span></button>
      <button type="button" className="quick-filter" aria-label="Настроить фильтры доски" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={14} />Фильтры</button>
    </div>
    <section className={`board${isBuyer ? ' buyer-board' : ''}`} id="kanban" aria-label="Kanban-доска">
    <div className="board-toolbar" id="board-filters" hidden={!showFilters}>
        <div className="board-view" aria-live="polite">{filtered.length} из {scoped.length}</div>
        <div className="board-filters">
          <select aria-label="GEO" value={geo} onChange={(event) => setGeo(event.target.value)}><option value="">Все GEO</option>{geos.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Исполнитель" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">Все исполнители</option><option value="free">Без исполнителя</option>{[...new Map(scoped.filter(task => task.creativeId).map(task => [task.creativeId!, task.creativeName])).entries()].map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>
          <select aria-label="Приоритет" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Приоритет</option>{Object.entries(priorities).map(([id, text]) => <option value={id} key={id}>{text}</option>)}</select>
          <select aria-label="Статус" value={status} onChange={(event) => { setStatus(event.target.value); if (event.target.value) setLateOnly(false); }}><option value="">Все статусы</option>{statuses.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}</select>
          {hasFilters && <button type="button" className="reset-filters" onClick={resetFilters}>Сбросить</button>}
        </div>
      </div>
      <div className="kanban">{statuses.map(({ id, label, hint }) => {
        const column = filtered.filter((task) => task.status === id);
        const limit = column[0]?.coverId && !hasFilters ? 1 : 2;
        const shown = column.slice(0, limit);
        const selected = column.find((task) => task.id === selectedId);
        const visible = expanded[id] || hasFilters ? column : selected && !shown.includes(selected) ? [selected, ...shown.slice(0, limit - 1)] : shown;
        return <section className={`column ${id} ${status && status !== id ? 'mobile-hidden' : ''}`} key={id} aria-label={label}>
          <header className="column-head"><span className="column-dot" aria-hidden="true" /><h3>{label}</h3><span className="column-count">{column.length}</span></header>
          <div className="column-body">{visible.map((task) => <TaskCard key={task.id} task={task} now={now} href={`${boardPath}task=${task.id}`} selected={selectedId === task.id} />)}
            {column.length === 0 && <div className="empty-column"><span>Нет задач</span><small>{isBuyer && id === 'review' ? 'Здесь появятся задачи для вашей проверки' : hint}</small></div>}
            {!hasFilters && column.length > limit && <button className="column-more" type="button" aria-expanded={!!expanded[id]} onClick={() => setExpanded({ ...expanded, [id]: !expanded[id] })}>{expanded[id] ? 'Свернуть' : `Ещё ${column.length - limit}`}<ChevronDown size={13} aria-hidden="true" /></button>}
          </div>
        </section>;
      })}</div>
    </section>
    </div>{drawer && <Link className="drawer-backdrop" href={`${boardPath}task=none`} scroll={false} aria-hidden="true" tabIndex={-1} />}
    <div className="drawer-slot">{drawer}</div>
  </div>;
}
