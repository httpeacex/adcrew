'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { fileHref } from '@/lib/client-runtime';
import { FileImage, Search } from 'lucide-react';
import { formatDate, formats, type Profile, type Task } from '@/lib/workflow';

export function Library({ tasks, person }: { tasks: Task[]; person: Profile }) {
  const [query,setQuery] = useState('');
  const accepted = tasks.filter(t=>t.submittedAt!==null && (person.role==='lead'||(person.role==='buyer'?t.buyerId===person.id:true)));
  const term = query.trim().toLocaleLowerCase('ru');
  const visible = accepted.filter(t=>`${t.offer} КР-${String(t.id).padStart(3,'0')}`.toLocaleLowerCase('ru').includes(term));
  return <div className="library-page"><header className="reference-heading"><div><h1>Библиотека</h1><p>Сданные креативы. Файлы и все версии доступны в задаче.</p></div>{person.role !== 'creative' && <Link className="button secondary" href="/templates">Шаблоны ТЗ</Link>}</header><label className="library-search"><Search size={18}/><input type="search" aria-label="Поиск креативов" placeholder="Название или ID креатива" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="library-grid">{visible.map(t=><Link className="library-result reference-panel" href={`/board?task=${t.id}`} key={t.id}><div className="library-preview">{t.coverId?<Image alt={t.offer} src={fileHref(t.coverId,true)} fill unoptimized/>:<FileImage size={36}/>}</div><small>КР-{String(t.id).padStart(3,'0')} · {formats[t.format]}</small><h2>{t.offer}</h2><p>{t.buyerName} · {t.creativeName||'Исполнитель не указан'}</p><small>{t.completedAt?`Принято ${formatDate(t.completedAt,true)}`:`Сдано ${formatDate(t.submittedAt!,true)}`}</small></Link>)}</div>{!visible.length&&<p className="dashboard-empty">{term?'По вашему запросу ничего не найдено.':'После сдачи результата креатив появится здесь.'}</p>}</div>;
}
