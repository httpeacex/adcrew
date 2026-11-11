'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { fileHref } from '@/lib/client-runtime';
import { Archive, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChartNoAxesColumnIncreasing, Columns3, Film, Flag, ImageIcon, Layers3, List, MessageSquare, MoreHorizontal, Paperclip, Play, Plus, Search, Shapes, SlidersHorizontal, TriangleAlert, Users, X } from 'lucide-react';
import { formatDate, formats, isOverdue, localDay, priorities, statuses, type Actor, type Format, type Status, type Task } from '@/lib/workflow';

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
  const statusLabel = statuses.find(status => status.id === task.status)!.label;
  return <Link className={`task-card task-${task.status}${task.coverId ? ' has-cover' : ' compact-card'}${overdue ? ' overdue-card' : ''}${selected ? ' is-selected' : ''}`} href={href} scroll={false} aria-current={selected ? 'true' : undefined}>
    <div className="card-body"><div className="card-top">
      <span className="task-code">КР-{String(task.id).padStart(3, '0')}</span><span className={`priority ${task.priority}`} title={`Приоритет: ${priorities[task.priority]}`}><Flag size={11} /> {priorities[task.priority]}</span></div>
    {task.coverId && <span className={`card-cover ${task.format}`}>
      <NextImage alt="" fill loading="lazy" unoptimized src={fileHref(task.coverId, true)} />
      <span className="card-cover-status">{statusLabel}</span>
      {task.format === 'video' ? <span className="cover-play" aria-hidden="true"><Play size={14} fill="currentColor" /></span> : null}
      {task.status === 'done' && <span className="cover-accepted"><Check size={12} aria-hidden="true" /></span>}
    </span>}
    <h3><ChartNoAxesColumnIncreasing size={14} className={`card-priority-mark ${task.priority}`} />{task.offer}</h3>
    <p className="card-description">{task.description}</p><div className="card-tags"><span className="card-format"><FormatMark format={task.format} />{formats[task.format]} · {task.quantity} шт.</span><span className="geo-tag">{task.geo}</span></div>
    {task.status === 'done' && <span className="card-approved"><Check size={13} aria-hidden="true" />Согласовано</span>}
    <div className="card-footer"><span className={`due ${overdue ? 'late' : ''}`} title={overdue ? 'Дедлайн просрочен' : 'Дедлайн'}>{overdue ? <TriangleAlert size={13} /> : <CalendarDays size={14} />}{formatDate(task.deadline)}</span>
    </div>
    <div className="card-counters" aria-label="Участники, материалы и обсуждение">
      <div className="card-participants" title={task.creativeName ? `${task.buyerName}, ${task.creativeName}` : `${task.buyerName} · без исполнителя`}>
        <Avatar initials={task.buyerName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()} color="violet" size="tiny" />
        {task.creativeInitials && <Avatar initials={task.creativeInitials} color={task.creativeColor || 'violet'} size="tiny" />}
      </div>
      <span title="Комментарии"><MessageSquare size={12} />{task.commentCount ?? 0}</span>
      <span title="Файлы"><Paperclip size={12} />{task.fileCount ?? 0}</span>
      <span title="Чек-лист приёмки"><i className="progress-ring" style={{ '--progress': `${(task.checkedCount ?? 0) / 3 * 100}%` } as React.CSSProperties} />{task.checkedCount ?? 0}/3</span><span className={`card-format-label format-${task.format}`}><i/>{formats[task.format]}</span>
    </div></div>
  </Link>;
}


function ProductionView({ view, tasks, now, boardPath }: { view: 'list' | 'calendar' | 'workload' | 'archive'; tasks: Task[]; now: number; boardPath: string }) {
  const [monthOffset, setMonthOffset] = useState(0);
  if (view === 'workload') {
    const active = tasks.filter(t => t.status !== 'done');
    const groups = [...new Map(active.map(t => [t.creativeId, t.creativeName ?? 'Без исполнителя'])).entries()];
    return <section className="production-workload"><h2>Загрузка команды</h2><p className="muted">Открытые задачи по исполнителям. Просроченные требуют внимания.</p><div>{groups.map(([id, name]) => {
      const items = active.filter(t => t.creativeId === id);
      return <article key={id ?? 'free'}><h3>{name}<span>{items.length}</span></h3><div className="workload-stages">{statuses.filter(s => s.id !== 'done').map(s => <span key={s.id}>{s.label}<b>{items.filter(t => t.status === s.id).length}</b></span>)}</div>{items.map(t => <Link key={t.id} href={`${boardPath}task=${t.id}`} scroll={false}><span>{t.offer}</span><small className={isOverdue(t, now) ? 'late' : ''}>{formatDate(t.deadline)}</small></Link>)}</article>;
    })}</div>{!groups.length && <p>Открытых задач нет.</p>}</section>;
  }
  if (view === 'calendar') {
    const [year, month] = localDay(now).split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
    const offset = (start.getUTCDay() + 6) % 7;
    return <section className="production-calendar"><header><h2>{start.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><div><button type="button" aria-label="Предыдущий месяц" onClick={() => setMonthOffset(monthOffset - 1)}><ChevronLeft size={18} /></button><button type="button" onClick={() => setMonthOffset(0)}>Сегодня</button><button type="button" aria-label="Следующий месяц" onClick={() => setMonthOffset(monthOffset + 1)}><ChevronRight size={18} /></button></div></header><div className="calendar-scroll"><div className="calendar-grid">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <strong key={day}>{day}</strong>)}{Array.from({ length: 42 }, (_, index) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), index - offset + 1));
      const day = date.toISOString().slice(0, 10);
      return <div key={day} className={`calendar-day${date.getUTCMonth() !== start.getUTCMonth() ? ' outside' : ''}${day === localDay(now) ? ' today' : ''}`}><time dateTime={day}>{date.getUTCDate()}</time>{tasks.filter(t => localDay(t.deadline) === day).map(t => <Link key={t.id} href={`${boardPath}task=${t.id}`} scroll={false} title={t.offer}><span className={`status-dot ${t.status}`} />{t.offer}</Link>)}</div>;
    })}</div></div></section>;
  }
  return <div className="production-list"><table><thead><tr><th>Задача</th><th>Статус</th><th>Формат / GEO</th><th>Исполнитель</th><th>Дедлайн</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id}><td><Link href={`${boardPath}task=${task.id}`} scroll={false}><small>КР-{String(task.id).padStart(3, '0')}</small>{task.offer}</Link></td><td><span className={`status-pill ${task.status}`}>{statuses.find(s => s.id === task.status)!.label}</span></td><td>{formats[task.format]} · {task.geo}</td><td>{task.creativeName ?? 'Свободна'}</td><td className={task.status !== 'done' && isOverdue(task, now) ? 'late' : ''}>{formatDate(task.deadline)}</td></tr>)}</tbody></table>{!tasks.length && <p className="empty-panel">{view === 'archive' ? 'Принятых работ пока нет.' : 'Задачи не найдены.'}</p>}</div>;
}

export function Board({ tasks, person, mine, now, selectedId, defaultDrawer, drawer }: {
  tasks: Task[]; person: Actor; mine: boolean; now: number; selectedId?: number; defaultDrawer: boolean; account: ReactNode; drawer: ReactNode; unread?: number;
}) {
  const [query, setQuery] = useState('');
  const [stages, setStages] = useState('production');
  const searchInput = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [lateOnly, setLateOnly] = useState(false);
  const [view, setView] = useState<'board' | 'list' | 'calendar' | 'workload' | 'archive'>('board');
  const [quick, setQuick] = useState<'all' | 'mine' | 'today'>('all');
  const [format, setFormat] = useState('');
  const [offer, setOffer] = useState('');
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
  const today = (task: Task) => task.status !== 'done' && localDay(task.deadline) === localDay(now);
  const own = (task: Task) => task.buyerId === person.id || task.creativeId === person.id;
  const filtered = scoped.filter((task) => (!term || `${task.offer} КР-${String(task.id).padStart(3, '0')}`.toLocaleLowerCase('ru').includes(term)) && (!geo || task.geo === geo) && (!format || task.format === format) && (!offer || task.offer === offer) && (quick !== 'mine' || own(task)) && (quick !== 'today' || today(task)) && (view !== 'archive' || task.status === 'done') &&
    (!priority || task.priority === priority) && (!assignee || (assignee === 'free' ? !task.creativeId : String(task.creativeId) === assignee)) && (!lateOnly || overdue(task)) && (!status || task.status === status));
  const boardPath = mine ? '/board?scope=mine&' : '/board?';
  const hasFilters = lateOnly || quick !== 'all' || !!(query || geo || priority || assignee || status || format || offer);
  function resetFilters() { setLateOnly(false); setQuick('all'); setQuery(''); setGeo(''); setPriority(''); setAssignee(''); setStatus(''); setFormat(''); setOffer(''); }
  const showAllStages = stages === 'all' || hasFilters || mine || scoped.some(task => task.id === selectedId && task.status === 'revision');
  const primaryStages: Status[] = ['new', 'progress', 'review', 'done'];
  const displayedStages = showAllStages ? statuses : primaryStages.map(id => statuses.find(stage => stage.id === id)!);
  return <div className={`board-layout${drawer ? ' with-drawer' : ''}${defaultDrawer ? ' default-drawer' : ''}`}>
    <div className="board-main">
    <header className="reference-topbar"><section className="board-intro" aria-label="Креативное производство">
      <div><p className="workspace-kicker">Производство</p><h1>{mine ? 'Мои задачи' : 'Доска задач'}</h1><p>Производство креативов</p></div>

    </section>
    <div className="production-views" aria-label="Представления задач">{([
      ['board', 'Канбан', Columns3], ['list', 'Список', List], ['calendar', 'Календарь', CalendarDays], ['workload', 'Загрузка', Users], ['archive', 'Архив', Archive],
    ] as const).map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={15} aria-hidden="true" />{label}</button>)}</div>
    <div className="board-stage-choice"><select aria-label="Колонки доски" value={stages} onChange={event=>setStages(event.target.value)}><option value="production">Производство</option><option value="all">Все статусы</option></select></div>
    <div className="board-quick-tabs production-filters" aria-label="Быстрые фильтры">
    <div className="board-local-search">        <div className="search" role="search" aria-label="Поиск по задачам">
          <Search className="search-icon" size={16} aria-hidden="true" />
          <input ref={searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск задач" aria-label="Поиск задач" aria-keyshortcuts="Control+K Meta+K" />
          {query ? <button className="search-clear" type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
            : <kbd className="search-shortcut" aria-hidden="true">Ctrl K</kbd>}
        </div>
</div>
      <button type="button" className={quick === 'all' && !lateOnly ? 'active' : ''} aria-pressed={quick === 'all' && !lateOnly} onClick={() => { setQuick('all'); setLateOnly(false); }}>Все задачи <span>{scoped.length}</span></button>
      <button type="button" className={quick === 'mine' ? 'active' : ''} aria-pressed={quick === 'mine'} onClick={() => { setQuick(quick === 'mine' ? 'all' : 'mine'); setLateOnly(false); }}>Мои <span>{scoped.filter(own).length}</span></button>
      <button type="button" className={quick === 'today' ? 'active' : ''} aria-pressed={quick === 'today'} onClick={() => { setQuick(quick === 'today' ? 'all' : 'today'); setLateOnly(false); }}>Сегодня <span>{scoped.filter(today).length}</span></button>
      <button type="button" className={lateOnly ? 'active' : ''} aria-pressed={lateOnly} onClick={() => { setLateOnly(!lateOnly); setQuick('all'); setStatus(''); }}>Просрочены <span>{scoped.filter(overdue).length}</span></button>
      <select aria-label="Оффер задач" value={offer} onChange={e => setOffer(e.target.value)}><option value="">Оффер</option>{[...new Set(scoped.map(t => t.offer))].sort().map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="GEO задач" value={geo} onChange={e => setGeo(e.target.value)}><option value="">ГЕО</option>{geos.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Формат задач" value={format} onChange={e => setFormat(e.target.value)}><option value="">Формат</option>{Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Исполнитель задач" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Все исполнители</option><option value="free">Без исполнителя</option>{[...new Map(scoped.filter(t => t.creativeId).map(t => [t.creativeId!, t.creativeName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <button type="button" className="quick-filter" aria-label="Настроить фильтры доски" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={14} />Фильтры</button>
    </div>
    <div className="reference-create">{isBuyer && <Link href="/tasks/new" className="button primary" aria-label="Создать задачу"><Plus size={16}/>Задача</Link>}</div></header>
    <section className={`board${isBuyer ? ' buyer-board' : ''}`} id="kanban" aria-label="Kanban-доска">
    <div className="board-toolbar" id="board-filters" hidden={!showFilters}>
        <div className="board-stage-filter"><select aria-label="Колонки доски" value={stages} onChange={event=>setStages(event.target.value)}><option value="production">Производство</option><option value="all">Все статусы</option></select></div><div className="board-view" aria-live="polite">{filtered.length} из {scoped.length}</div>
        <div className="board-filters">
          <select aria-label="GEO" value={geo} onChange={(event) => setGeo(event.target.value)}><option value="">Все GEO</option>{geos.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Исполнитель" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">Все исполнители</option><option value="free">Без исполнителя</option>{[...new Map(scoped.filter(task => task.creativeId).map(task => [task.creativeId!, task.creativeName])).entries()].map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>
          <select aria-label="Приоритет" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Приоритет</option>{Object.entries(priorities).map(([id, text]) => <option value={id} key={id}>{text}</option>)}</select>
          <select aria-label="Статус" value={status} onChange={(event) => { setStatus(event.target.value); if (event.target.value) setLateOnly(false); }}><option value="">Все статусы</option>{statuses.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}</select>
          {hasFilters && <button type="button" className="reset-filters" onClick={resetFilters}>Сбросить</button>}
        </div>
      </div>
      {view === 'board' ? <div className={`kanban${showAllStages ? ' all-stages' : ''}`}>{displayedStages.filter(stage => !status || stage.id === status).map(({ id, label, hint }) => {
        const column = filtered.filter((task) => task.status === id);
        const share = filtered.length ? (column.length / filtered.length) * 100 : 0;
        const shareLabel = `${label}: ${new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(share)}% (${column.length} из ${filtered.length} задач)`;
        const limit = 3;
        const shown = column.slice(0, limit);
        const selected = column.find((task) => task.id === selectedId);
        const visible = expanded[id] || hasFilters ? column : selected && !shown.includes(selected) ? [selected, ...shown.slice(0, limit - 1)] : shown;
        return <section className={`column ${id} ${status && status !== id ? 'mobile-hidden' : ''}`} key={id} aria-label={label}>
          <header className="column-head"><span className="column-dot" role="img" aria-label={shareLabel} title={shareLabel} style={{ '--column-share': `${share}%` } as React.CSSProperties} /><h3>{label}</h3><span className="column-count">{column.length}</span><div className="column-tools">
            <details className="column-menu">
              <summary aria-label={`Действия колонки ${label}`}><MoreHorizontal size={15} /></summary>
              <div className="column-menu-items">
                <button type="button" onClick={event => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  setStatus(status === id ? '' : id);
                }}>{status === id ? 'Показать все колонки' : 'Только эта колонка'}</button>
                <button type="button" disabled={hasFilters || column.length <= limit} onClick={event => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  setExpanded(previous => ({ ...previous, [id]: !previous[id] }));
                }}>{expanded[id] ? 'Свернуть задачи' : 'Развернуть задачи'}</button>
              </div>
            </details>
            {isBuyer && <Link href="/tasks/new" aria-label={`Создать задачу · ${label}`}><Plus size={15} /></Link>}
          </div></header>
          <div className="column-body">{visible.map((task) => <TaskCard key={task.id} task={task} now={now} href={`${boardPath}task=${task.id}`} selected={selectedId === task.id} />)}
            {column.length === 0 && <div className="empty-column"><span>Нет задач</span><small>{isBuyer && id === 'review' ? 'Здесь появятся задачи для вашей проверки' : hint}</small></div>}
            {!hasFilters && column.length > limit && <button className="column-more" type="button" aria-expanded={!!expanded[id]} onClick={() => setExpanded({ ...expanded, [id]: !expanded[id] })}>{expanded[id] ? 'Свернуть' : `Ещё ${column.length - limit}`}<ChevronDown size={13} aria-hidden="true" /></button>}
          </div>
        </section>;
      })}</div> : <ProductionView view={view} tasks={filtered} now={now} boardPath={boardPath} />}
      {hasFilters && !showFilters && <button type="button" className="reset-filters production-reset" onClick={resetFilters}>Сбросить фильтры</button>}
    </section>
    </div>{drawer && <Link className="drawer-backdrop" href={`${boardPath}task=none`} scroll={false} aria-hidden="true" tabIndex={-1} />}
    <div className="drawer-slot">{drawer}</div>
  </div>;
}

