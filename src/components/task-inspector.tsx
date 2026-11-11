'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDownToLine, ArrowUpRight, CalendarDays, File, FileText, GitCompareArrows, Sparkles, X } from 'lucide-react';
import type { ProductStore } from '@/lib/product-store';
import { actionsFor, actionLabels, formatDate, formats, isOverdue, priorities, statuses, type Event, type Profile, type Submission, type Task } from '@/lib/workflow';
import { fileHref } from '@/lib/client-runtime';
import { Avatar } from './board';
import { CopyTaskLink } from './drawer-tabs';
import { TaskAction } from './forms';
import { TaskCollaboration } from './product';
import { VersionComparison } from './version-comparison';

export type InspectorProps = {
  task: Task; events: Event[]; submissions: Submission[]; person: Profile; now: number;
  closeHref: string; currentHref: string; extras?: ReturnType<ProductStore['taskExtras']>;
};

export function TaskInspector({ task, events, submissions, person, now, closeHref, currentHref, extras }: InspectorProps) {
  const [tab, setTab] = useState('brief');
  const [selectedId, setSelectedId] = useState(submissions[0]?.id);
  const [compare, setCompare] = useState(false);
  const selected = submissions.find(item => item.id === selectedId) ?? submissions[0];
  const current = !selected || selected.id === submissions[0]?.id;
  const actions = actionsFor(person, task);
  const status = statuses.find(item => item.id === task.status)!;
  const files = selected?.files ?? [];
  const [fileId, setFileId] = useState<number>();
  const media = files.find(file => file.id === fileId) ?? files.find(file => file.type === 'video/mp4') ?? files.find(file => file.id === task.coverId) ?? files[0];
  return <aside className="task-drawer production-drawer approved-inspector" aria-labelledby="drawer-title">
    <header className="drawer-head">
      <div className="drawer-head-line"><div className="drawer-badges"><strong>КР-{String(task.id).padStart(3, '0')}</strong><span className={`status-pill ${status.id}`}>{status.label}</span></div><div className="drawer-head-tools">
        <CopyTaskLink href={currentHref} /><Link className="icon-link" href={`/tasks/${task.id}`} aria-label="Открыть полную карточку"><ArrowUpRight size={17} /></Link><Link className="icon-link" href={closeHref} scroll={false} aria-label="Закрыть карточку"><X size={18} /></Link>
      </div></div>
      <h2 className="drawer-title" id="drawer-title"><FileText className="inspector-document-icon" size={18} aria-hidden="true" />{task.offer}</h2>
      <p className="inspector-context">{task.geo} · {formats[task.format]} · {task.quantity} шт.</p>

    </header>
    <div className="drawer-scroll">
      <div className="drawer-tabs" aria-label="Разделы задачи">{[['result', 'Содержимое'], ['brief', 'Детали']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      <dl className="drawer-summary"><div><dt>Исполнитель</dt><dd>{task.creativeInitials && <Avatar initials={task.creativeInitials} color={task.creativeColor || 'violet'} size="tiny" />}{task.creativeName ?? 'Свободна'}</dd></div><div><dt><CalendarDays size={13} />Дедлайн</dt><dd className={isOverdue(task, now) && task.status !== 'done' ? 'drawer-late' : undefined}>{formatDate(task.deadline, true)}</dd></div></dl>
      <div className="drawer-tab-body">
        {task.creativeId === person.id && <Link className="button secondary inspector-studio" href={`/studio?task=${task.id}`}><Sparkles size={16} />Открыть в студии</Link>}
        {tab === 'result' && <>
          {selected ? <><div className="inspector-version"><select aria-label="Версия результата" value={selected.id} onChange={event => { setSelectedId(Number(event.target.value)); setFileId(undefined); }}>{submissions.map((item, index) => <option key={item.id} value={item.id}>Версия {item.round}{index === 0 ? ' · Текущая' : ''}</option>)}</select>{submissions.length > 1 && <button className="inspector-compare" type="button" aria-expanded={compare} onClick={() => setCompare(!compare)}><GitCompareArrows size={16} />Сравнить</button>}</div>
          {compare && <VersionComparison submissions={submissions} />}
          {media && <div className="inspector-media"><div className="drawer-hero">{media.type.startsWith('image/') ? <Image fill unoptimized src={fileHref(media.id, true)} alt={`Предпросмотр ${media.name}`} /> : <video key={media.id} controls preload="metadata" aria-label={`Предпросмотр ${media.name}`} src={fileHref(media.id, true)} />}</div><div className="inspector-file"><span>{media.name}</span><a href={fileHref(media.id)} download={media.name} aria-label={`Скачать ${media.name}`}><ArrowDownToLine size={18} /></a></div></div>}
          {files.length > 1 && <div className="inspector-files" aria-label="Файлы версии">{files.map(file => <button type="button" key={file.id} aria-pressed={media?.id === file.id} onClick={() => setFileId(file.id)}>{file.name}</button>)}</div>}
          {selected.reviewNote && <div className="revision-note"><strong>Замечания к версии</strong><p>{selected.reviewNote}</p></div>}
          <p className="inspector-usage">{selected.usage.length ? selected.usage.map(item => `${item.service} — ${item.units} кр.`).join(' · ') : 'Без AI'}</p>
          </> : <div className="empty-panel">Файлы появятся после первой сдачи.</div>}
          {extras && <div className="inspector-collaboration"><TaskCollaboration key={selected?.id ?? 'brief'} person={person} task={task} extras={extras} returnTo={currentHref} rounds={submissions.map(item => item.round)} fixedRound={selected?.round ?? null} compact /></div>}
        </>}
        {tab === 'brief' && <div className="drawer-overview"><details className="drawer-description"><summary>Техническое задание</summary><h3>Описание</h3><p>{task.description}</p></details><dl className="facts"><div><dt>Покупатель</dt><dd>{task.buyerName}</dd></div><div><dt>Приоритет</dt><dd>{priorities[task.priority]}</dd></div></dl><section className="inspector-detail-files"><h3>Метки</h3><div className="detail-labels"><span>{formats[task.format]}</span><span>{task.geo}</span><span>{task.quantity} шт.</span></div><h3>Вложения</h3>{files.length ? files.map(file=><a key={file.id} href={fileHref(file.id)} download={file.name}><File size={15}/><span>{file.name}</span><ArrowDownToLine size={15}/></a>) : <p className="muted">Файлы появятся после сдачи результата.</p>}</section><section className="drawer-references"><h3>Связанные документы</h3>{task.references.length ? <ul>{task.references.map((url, index) => <li key={`${index}-${url}`}><a href={url} target="_blank" rel="noreferrer">Ссылка {index + 1}<ArrowUpRight size={13} /></a></li>)}</ul> : <p className="muted">Ссылок пока нет.</p>}</section>{extras && <TaskCollaboration key="brief-discussion" person={person} task={task} extras={extras} returnTo={currentHref} fixedRound={null} compact checksOpen />}</div>}
        {tab === 'brief' && <details className="inspector-history"><summary>История задачи</summary><ol className="timeline">{events.toReversed().map(event => <li key={event.id}><span className={`status-dot ${event.toStatus}`} /><div><strong>{actionLabels[event.action]}{event.round ? ` · v${event.round}` : ''}</strong><small>{event.actorName} · {formatDate(event.at, true)}</small></div></li>)}</ol></details>}
        {actions.includes('submit') && <section className="drawer-results"><h3>Сдача результата</h3><TaskAction task={task.id} version={task.version} action="submit" returnTo={currentHref} /></section>}
      </div>
    </div>
    {actions.some(action => action !== 'submit') && <footer className="drawer-actions inspector-actions"><p>{current ? selected ? `Решение относится к версии ${selected.round}` : 'Действия с задачей' : 'Для принятия или правок выберите текущую версию'}</p>{current ? actions.filter(action => action !== 'submit').map(action => <TaskAction key={action} task={task.id} version={task.version} action={action} returnTo={currentHref} compact acceptRound={selected?.round} />) : <button type="button" className="button secondary" onClick={() => setSelectedId(submissions[0].id)}>К текущей версии</button>}</footer>}
  </aside>;
}
