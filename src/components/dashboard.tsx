import type { ProductStore } from '@/lib/product-store';
import Link from 'next/link';
import { ArrowUpRight, Plus, CheckCheck } from 'lucide-react';
import { formatDate, localDay, duration, priorities, statuses, type Profile, type Task } from '@/lib/workflow';
import { dashboardData } from '@/lib/dashboard';
import { Avatar } from './board';

const dollars = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(amount);

function TaskRows({ tasks, creative = false, now, moreHref, empty = 'Задач пока нет.' }: { tasks: Task[]; creative?: boolean; now: number; moreHref: string; empty?: string }) {
  return <div className="dashboard-task-list">{tasks.length ? tasks.slice(0,5).map(t => <div className={`dashboard-task${creative ? ' dashboard-task-creative' : ''}`} key={t.id}>
    <Link href={`/board?task=${t.id}`}><small>КР-{String(t.id).padStart(3,'0')}</small><strong>{t.offer}</strong></Link>
    <span className="dashboard-task-person">
      <Avatar personId={creative ? t.buyerId : t.creativeId} initials={(creative ? t.buyerName : t.creativeName)?.split(/\s+/).map(word => word[0]).slice(0,2).join('') || '–'} color={t.creativeColor || 'violet'} size="tiny" />
      <span>{creative ? t.buyerName : t.creativeName || 'Без исполнителя'}</span>
    </span>
    {creative ? <><span>{formatDate(t.deadline,true)}<small>{priorities[t.priority]}</small></span><span>{t.claimedAt ? `В работе: ${duration(t.timing?.production ?? Math.max(0, (t.completedAt ?? now)-t.claimedAt))}` : 'Ещё не начата'}</span>{(t.status === 'progress' || t.status === 'revision') && <Link className="button secondary" href={`/board?task=${t.id}`}>Сдать</Link>}</> : <span className={`list-status ${t.status}`}>{statuses.find(s=>s.id===t.status)?.label}</span>}
  </div>) : <p className="dashboard-empty">{empty}</p>}{tasks.length > 5 && <Link className="dashboard-more" href={moreHref}>Смотреть все задачи ({tasks.length}) <ArrowUpRight size={14}/></Link>}</div>;
}

export function Dashboard({ tasks, person, now, finance }: { tasks: Task[]; person: Profile; now: number; finance: ReturnType<ProductStore['productSnapshot']>['finance'] }) {
  const data = dashboardData(tasks, person, now);
  const {counts} = data;
  const lead = person.role === 'lead';
  const creative = person.role === 'creative';
  const metrics: [string, number, string][] = lead
    ? [['Задачи — все',counts.total,''],['Активные задачи',counts.active,'active'],['В работе',counts.progress,'progress'],['Завершено',counts.done,'done']]
    : creative ? [['Свободные задачи',counts.free,'free'],['В работе',counts.progress,'progress'],['Правки',counts.revision,'revision'],['Ждут проверки',counts.review,'review'],['Выполнены',counts.done,'done']]
      : [['Активные задачи',counts.active,'active'],['В работе',counts.progress,'progress'],['Ждут проверки',counts.review,'review'],['Готовы',counts.done,'done']];
  const days = Array.from({length:7},(_,i)=>now-(6-i)*86400000);
  const values = days.map(d=>data.tasks.filter(t=>t.status==='done' && t.completedAt!==null && localDay(t.completedAt)===localDay(d)).length);
  const max = Math.max(1,...values);
  const percent = counts.total ? Math.round(counts.done/counts.total*100) : 0;
  const people = Array.from(new Map(tasks.filter(t=>t.creativeId!==null).map(t=>[t.creativeId,t])).values());
  return <div className="reference-dashboard" data-role={person.role}>
    <header className="reference-heading"><div><h1>Дашборд</h1><p>{lead ? 'Задачи, загрузка команды и контроль расходов.' : creative ? 'Ваши задачи, правки и свободные креативы.' : 'Ваши креативы и результаты на проверке.'}</p></div><Link className="button primary" href={person.role==='buyer'?'/tasks/new':'/board?task=none'}><Plus size={17}/>{person.role==='buyer'?'Создать задачу':'Открыть задачи'}</Link></header>
    <div className={`reference-stats${creative?' five-stats':''}`}>{metrics.map(([label,value,status],i)=><Link className={`reference-stat${i===0?' featured':''}`} href={`/board?task=none${creative && status!=='free' ? '&scope=mine' : ''}${status?`&status=${status}`:''}`} key={label}><div>{label}<span className="stat-arrow"><ArrowUpRight size={15}/></span></div><strong>{value}</strong><small>{status==='done'?'Принятые результаты':'Текущее состояние'}</small></Link>)}</div>
    {lead && <div className="dashboard-spend-row">{([['Сегодня','today'],['Последние 7 дней','week'],['Текущий месяц','month']] as const).map(([label,key])=><section className="reference-panel" key={label}><h2>Расходы на ИИ · {label}</h2><strong>{finance.periodDetails[key].unknown && finance.periods[key]===0 ? '—' : new Intl.NumberFormat('ru-RU',{style:'currency',currency:'USD'}).format(finance.periods[key])}</strong><p>{finance.periodDetails[key].unknown ? 'Учтённая часть; есть расходы без оценки в USD.' : 'По зафиксированным расходам.'}</p></section>)}</div>}
    <div className="reference-grid dashboard-role-grid">
      <section className={lead ? "reference-panel dashboard-main-list dashboard-crew-panel" : "reference-panel dashboard-main-list"}><header><h2>{lead?'Загрузка креативщиков':'Мои задачи'}</h2><Link href={lead ? '/team' : creative ? '/board?task=none&scope=mine&status=active' : '/board?task=none&status=active'}>{lead?'Команда':'Все задачи'}<ArrowUpRight size={13}/></Link></header>{lead ? <div className="dashboard-workload"><div className="dashboard-workload-head"><span>Сотрудник</span><span>В работе</span><span>На проверке</span><span>Готово сегодня</span></div>{people.map(t=><div key={t.creativeId}><span><Avatar personId={t.creativeId} initials={t.creativeInitials||'?'} color={t.creativeColor||'violet'}/>{t.creativeName}</span><b>{tasks.filter(x=>x.creativeId===t.creativeId&&x.status==='progress').length}</b><b>{tasks.filter(x=>x.creativeId===t.creativeId&&x.status==='review').length}</b><b>{data.completedToday.filter(x=>x.creativeId===t.creativeId).length}</b></div>)}{!people.length&&<p className="dashboard-empty">Назначенных исполнителей пока нет.</p>}</div> : <TaskRows now={now} tasks={data.mine} creative={creative} moreHref={creative ? '/board?task=none&scope=mine&status=active' : '/board?task=none&status=active'}/>}</section>
      <section className="reference-panel dashboard-attention"><header><h2>Требуют внимания</h2></header><p className="dashboard-hint">Риск за 2 часа до дедлайна</p>{data.attention.length?data.attention.slice(0,5).map(({task,reason})=><Link className="reference-task-row" href={`/board?task=${task.id}`} key={task.id}><span className="reference-task-icon"><CheckCheck size={18}/></span><span><strong>КР-{String(task.id).padStart(3,'0')} · {task.offer}</strong><small className={reason==='Просрочено'?'late':''}>{reason} · {formatDate(task.deadline,true)}</small></span></Link>):<p className="dashboard-empty">Задач с риском срыва срока нет.</p>}</section>
      <section className="reference-panel dashboard-queue"><header><h2>{creative?'Свободные задачи':lead?'AI-бюджеты месяца':'Ждут вашей проверки'}</h2></header>{lead ? <div className="dashboard-budget">
        <strong>{finance.budget.amount > 0 ? dollars(finance.budget.amount) : 'Бюджет не задан'}</strong>
        <dl>
          <div><dt>Учтено за месяц</dt><dd>{finance.monthly.unknown && finance.monthly.spent === 0 ? '—' : dollars(finance.monthly.spent)}</dd></div>
          {finance.budget.amount > 0 && <div><dt>{finance.monthly.unknown ? 'Остаток по учтённым расходам' : 'Остаток'}</dt><dd>{dollars(finance.monthly.remaining)}</dd></div>}
        </dl>
        {finance.monthly.unknown > 0 && <p>Часть расходов без оценки в USD.</p>}
        <Link href="/settings">Настроить бюджет <ArrowUpRight size={14}/></Link>
      </div> : <TaskRows now={now} tasks={creative?data.free:data.review} moreHref={creative ? '/board?task=none&status=free' : '/board?task=none&status=review'} empty={creative?'Свободных задач пока нет.':'Все результаты проверены.'}/>}</section>
      <section className="reference-panel reference-bars"><h2>Выполнено за 7 дней</h2><div className="reference-bar-chart" role="img" aria-label={days.map((d,i)=>`${formatDate(d)}: ${values[i]}`).join(', ')}>{days.map((day,i)=><div className="reference-bar-column" key={day}><div className="reference-bar-track"><div style={{height:`${values[i]?25+values[i]/max*65:0}%`}}>{values[i]>0&&<span className="bar-ring"/>}</div></div><small>{new Intl.DateTimeFormat('ru',{weekday:'short',timeZone:'Asia/Yekaterinburg'}).format(day)}</small><small>{values[i]}</small></div>)}</div></section>
      <section className="reference-panel reference-completion"><h2>Прогресс задач</h2><div className="reference-gauge"><svg viewBox="0 0 220 120" aria-hidden="true"><path d="M20 105 A90 90 0 0 1 200 105" className="gauge-track"/>{percent > 0 && <path d="M20 105 A90 90 0 0 1 200 105" className="gauge-value" pathLength="100" strokeDasharray={`${percent} 100`}/>}</svg><div><strong>{percent}%</strong><small>Принято</small></div></div><div className="reference-legend"><span>Завершены</span><span>Активны</span></div></section>
    </div>
  </div>;
}
