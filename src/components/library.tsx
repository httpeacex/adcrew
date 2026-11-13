'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, FileImage, Search } from 'lucide-react';
import { fileHref } from '@/lib/client-runtime';
import { formatDate, formats, statuses, type Profile, type Task } from '@/lib/workflow';

export function Library({ tasks, person }: { tasks: Task[]; person: Profile }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase('ru');
  const visible = tasks.filter(task => {
    if (task.submittedAt === null || (person.role === 'buyer' && task.buyerId !== person.id)) return false;
    return `${task.offer} КР-${String(task.id).padStart(3, '0')}`.toLocaleLowerCase('ru').includes(term);
  }).sort((a, b) => b.submittedAt! - a.submittedAt! || b.id - a.id);

  return <div className="library-page">
    <header className="reference-heading">
      <div><h1>Библиотека</h1><p>Сданные креативы. Файлы и все версии доступны в задаче.</p></div>
      {person.role !== 'creative' && <Link className="button secondary" href="/templates">Шаблоны ТЗ</Link>}
    </header>
    <label className="library-search">
      <Search size={18} aria-hidden="true"/>
      <input type="search" aria-label="Поиск креативов" placeholder="Название или ID креатива" value={query} onChange={event => setQuery(event.target.value)}/>
    </label>
    <div className="library-grid">{visible.map(task => <Link className="library-result reference-panel" href={`/board?task=${task.id}`} key={task.id}>
      <div className="library-preview">
        {task.coverId ? <Image alt="" src={fileHref(task.coverId, true)} fill unoptimized sizes="(max-width: 650px) 85vw, (max-width: 1150px) 45vw, 30vw"/> : <FileImage size={32} aria-hidden="true"/>}
      </div>
      <div className="library-card-body">
        <div className="library-card-meta">
          <small>КР-{String(task.id).padStart(3, '0')} · {formats[task.format]}</small>
          <span className={`list-status ${task.status}`}>{statuses.find(status => status.id === task.status)?.label}</span>
        </div>
        <h2>{task.offer}</h2>
        <p>{task.buyerName} · {task.creativeName || 'Исполнитель не указан'}</p>
        <div className="library-card-footer">
          <small>{task.completedAt ? `Принято ${formatDate(task.completedAt, true)}` : `Сдано ${formatDate(task.submittedAt!, true)}`}</small>
          <ArrowUpRight size={17} aria-hidden="true"/>
        </div>
      </div>
    </Link>)}</div>
    {!visible.length && <p className="dashboard-empty">{term ? 'По вашему запросу ничего не найдено.' : 'После сдачи результата креатив появится здесь.'}</p>}
  </div>;
}
