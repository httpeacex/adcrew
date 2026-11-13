'use client';

import avatarAtlas from '../../public/avatars/team-atlas.png';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { boardDropAction } from '@/lib/board-moves';
import { TaskAction } from './forms';
import { Archive, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Columns3, Film, Flag, ImageIcon, Layers3, List, MoreHorizontal, Clock3, Hourglass, Eye, Plus, Shapes, SlidersHorizontal, TriangleAlert, Users } from 'lucide-react';
import { duration, formatDate, formats, isOverdue, localDay, priorities, statuses, type Actor, type Format, type Status, type Task } from '@/lib/workflow';

const icons = { image: ImageIcon, video: Film, animation: Shapes, other: Layers3 };

export function FormatMark({ format }: { format: Format }) {
  const Icon = icons[format];
  return <span className={`format-mark ${format}`}><Icon size={14} aria-hidden="true" /></span>;
}

const avatarPositions: Record<number,string> = {1:'0% 0%',2:'50% 0%',3:'100% 0%',4:'0% 100%',5:'50% 100%'};
export function Avatar({ initials, color, size = '', personId }: { initials: string; color: string; size?: string; personId?: number | null }) {
 const position=personId ? avatarPositions[personId] : undefined;
 const src=typeof avatarAtlas==='string'?avatarAtlas:avatarAtlas.src;
 return <span className={`avatar ${color} ${size}${position?' generated-avatar':''}`} style={position?{backgroundImage:`url(${src})`,backgroundSize:'300% 200%',backgroundPosition:position}:undefined} aria-hidden="true">{position?null:initials}</span>;
}

function TaskCard({ task, now, href, selected, draggable, onDragStart, onDragEnd }: { task: Task; now: number; href: string; selected: boolean; draggable?: boolean; onDragStart?: React.DragEventHandler<HTMLAnchorElement>; onDragEnd?: React.DragEventHandler<HTMLAnchorElement> }) {
  const overdue = isOverdue(task, now) && task.status !== 'done';
  const initials=task.creativeInitials || task.buyerName.split(/\s+/).map(p=>p[0]).slice(0,2).join('');
  return <Link className={`task-card reference-task-card task-${task.status}${overdue ? ' overdue-card' : ''}${selected ? ' is-selected' : ''}`} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} href={href} scroll={false} aria-current={selected ? 'true' : undefined}>
    <div className="ref-card-identity"><Avatar personId={task.creativeId ?? task.buyerId} initials={initials} color={task.creativeColor || 'violet'}/><div><span className="ref-card-code">КР-{String(task.id).padStart(3,'0')}</span><span className={`ref-card-priority ${task.priority}`}><Flag size={10}/>{priorities[task.priority]}</span></div></div>
    <div className="ref-card-heading"><div><h3>{task.offer}</h3><p>{formats[task.format]} · {task.geo}</p></div><span className="ref-card-format" title={formats[task.format]}><FormatMark format={task.format}/></span></div>
    <div className="card-assignees ref-card-people"><span><small>Заказчик</small>{task.buyerName}</span><span><small>Исполнитель</small>{task.creativeName || 'Не назначен'}</span></div>
    <div className="ref-card-metrics"><div><Hourglass size={14}/><strong>{duration(task.timing?.waiting ?? Math.max(0,(task.claimedAt??now)-task.createdAt))}</strong><small>Ожидание</small></div><div><Clock3 size={14}/><strong>{duration(task.timing?.production ?? 0)}</strong><small>{task.status==='done'?'Потрачено':'В работе'}</small></div><div><Eye size={14}/><strong>{duration(task.timing?.review ?? 0)}</strong><small>Проверка</small></div></div>
    <small className="ref-card-created">Создана {formatDate(task.createdAt,true)}</small>
    <div className={`ref-card-deadline${overdue?' late':''}${task.status==='done'?' accepted':''}`}>{overdue?<TriangleAlert size={13}/>:task.status==='done'?<Check size={13}/>:<CalendarDays size={13}/>}<span>{overdue?`Просрочка ${duration(now-task.deadline)}`:task.status==='done'?`Готово ${formatDate(task.completedAt!,true)}`:`До ${formatDate(task.deadline,true)}`}</span></div>
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

export function Board({ tasks, person, mine, now, selectedId, defaultDrawer, drawer, initialStatus = '' }: {
  initialStatus?: string; tasks: Task[]; person: Actor; mine: boolean; now: number; selectedId?: number; defaultDrawer: boolean; account: ReactNode; drawer: ReactNode; unread?: number;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [drop, setDrop] = useState<{task:Task; action:NonNullable<ReturnType<typeof boardDropAction>>} | null>(null);
  const [moveNotice,setMoveNotice] = useState('');
  useEffect(()=>{
    if(drop && tasks.find(task=>task.id===drop.task.id)?.version !== drop.task.version) {
      // A successful save supplies a new task version and completes the modal action.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrop(null);
    }
  },[drop,tasks]);
  const [stages, setStages] = useState('all');
  const [geo, setGeo] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [lateOnly, setLateOnly] = useState(false);
  const [view, setView] = useState<'board' | 'list' | 'calendar' | 'workload' | 'archive'>('board');
  const [quick, setQuick] = useState<'all' | 'mine' | 'today'>('all');
  const [format, setFormat] = useState('');
  const [offer, setOffer] = useState('');
  const [scopeFilter, setScopeFilter] = useState(initialStatus === 'active' || initialStatus === 'free' ? initialStatus : '');
  const [status, setStatus] = useState<string>(statuses.some(s=>s.id===initialStatus) ? initialStatus : '');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<Status, boolean>>>({});
  const restored = useRef(false);
  const storageKey = `adcrew-board:${person.id}:${mine ? 'mine' : 'all'}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && !initialStatus) {
        // Restore browser-only preferences after hydration.
        /* eslint-disable react-hooks/set-state-in-effect */
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
  }, [storageKey, initialStatus]);
  useEffect(() => {
    if (!restored.current || initialStatus) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ geo, priority, assignee, status, lateOnly, showFilters, expanded })); } catch { /* Browsing remains available without storage. */ }
  }, [storageKey, initialStatus, geo, priority, assignee, status, lateOnly, showFilters, expanded]);
  const isBuyer = person.role === 'buyer';
  const hasTaskDrawer = !!drawer && !defaultDrawer;
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
  const overdue = (task: Task) => task.status !== 'done' && isOverdue(task, now);
  const today = (task: Task) => task.status !== 'done' && localDay(task.deadline) === localDay(now);
  const own = (task: Task) => task.buyerId === person.id || task.creativeId === person.id;
  const filtered = scoped.filter((task) => (!geo || task.geo === geo) && (!format || task.format === format) && (!offer || task.offer === offer) && (quick !== 'mine' || own(task)) && (quick !== 'today' || today(task)) && (view !== 'archive' || task.status === 'done') &&
    (scopeFilter !== 'active' || task.status !== 'done') && (scopeFilter !== 'free' || (task.status === 'new' && task.creativeId === null)) && (!priority || task.priority === priority) && (!assignee || (assignee === 'free' ? !task.creativeId : String(task.creativeId) === assignee)) && (!lateOnly || overdue(task)) && (!status || task.status === status));
  const boardStatus = status || scopeFilter;
  const boardPath = `${mine ? '/board?scope=mine&' : '/board?'}${boardStatus ? `status=${encodeURIComponent(boardStatus)}&` : ''}`;
  const hasFilters = !!scopeFilter || lateOnly || quick !== 'all' || !!(geo || priority || assignee || status || format || offer);
  function resetFilters() { setScopeFilter(''); setLateOnly(false); setQuick('all'); setGeo(''); setPriority(''); setAssignee(''); setStatus(''); setFormat(''); setOffer(''); }
  const showAllStages = true;
  const displayedStages = statuses;
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
        return <section className={`column ${id} ${status && status !== id ? 'mobile-hidden' : ''}`} key={id} aria-label={label} onDragOver={event=>{const t=tasks.find(t=>t.id===dragged);if(t&&boardDropAction(person,t,id)){event.preventDefault();event.dataTransfer.dropEffect='move';}}} onDrop={event=>{event.preventDefault();const t=tasks.find(t=>t.id===dragged);const action=t&&boardDropAction(person,t,id);if(t&&action){setDrop({task:t,action});setMoveNotice('Подтвердите действие. Статус изменится после сохранения.');}setDragged(null);}}>
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
          <div className="column-body">{visible.map((task) => <TaskCard draggable={statuses.some(stage=>boardDropAction(person,task,stage.id)!==null)} onDragStart={event=>{setDragged(task.id);event.dataTransfer.setData('text/plain',String(task.id));event.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDragged(null)} key={task.id} task={task} now={now} href={`${boardPath}task=${task.id}`} selected={selectedId === task.id} />)}
            {column.length === 0 && <div className="empty-column"><span>Нет задач</span><small>{isBuyer && id === 'review' ? 'Здесь появятся задачи для вашей проверки' : hint}</small></div>}
            {!hasFilters && column.length > limit && <button className="column-more" type="button" aria-expanded={!!expanded[id]} onClick={() => setExpanded({ ...expanded, [id]: !expanded[id] })}>{expanded[id] ? 'Свернуть' : `Ещё ${column.length - limit}`}<ChevronDown size={13} aria-hidden="true" /></button>}
          </div>
        </section>;
      })}</div> : <ProductionView view={view} tasks={filtered} now={now} boardPath={boardPath} />}
      {hasFilters && !showFilters && <button type="button" className="reset-filters production-reset" onClick={resetFilters}>Сбросить фильтры</button>}
    </section>
    </div>{drop && <div className="board-move-backdrop"><dialog ref={node=>{if(node&&!node.open)node.showModal();}} onCancel={()=>{setDrop(null);setMoveNotice('');}} aria-label="Изменение статуса" className="board-move-dialog"><button autoFocus className="button secondary" onClick={()=>{setDrop(null);setMoveNotice('');}}>Закрыть</button><h2>КР-{String(drop.task.id).padStart(3,'0')} · {drop.task.offer}</h2><p>{moveNotice}</p><TaskAction key={`${drop.task.id}:${drop.action}`} task={drop.task.id} version={drop.task.version} action={drop.action} returnTo="/board?task=none"/></dialog></div>}{drawer && <Link className="drawer-backdrop" href={`${boardPath}task=none`} scroll={false} aria-hidden="true" tabIndex={-1} />}
    <div className="drawer-slot">{drawer}</div>
  </div>;
}

