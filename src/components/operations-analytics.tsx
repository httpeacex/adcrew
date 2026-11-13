'use client';
import Link from 'next/link';
import { duration, formatDate, reportPeriod, statuses, type Status, type Task, type Profile } from '@/lib/workflow';
import { operationsSummary, type RevisionEvent } from '@/lib/operations-report';
import type { WorkCalendar } from '@/lib/work-calendar';
import { FinancePage, usd } from './finance';
import type { ProductStore } from '@/lib/product-store';

function DailyChart({days}:{days:{day:string;created:number;completed:number}[]}) {
 const max=Math.max(4,Math.ceil(Math.max(0,...days.flatMap(d=>[d.created,d.completed]))/4)*4);
 const x=(i:number)=>42+i*560/Math.max(1,days.length-1);
 const y=(v:number)=>185-v/max*145;
 const points=(key:'created'|'completed')=>days.map((d,i)=>`${x(i)},${y(d[key])}`).join(' ');
 return <div className="operations-trend"><div className="operations-chart-legend"><span>Создано</span><span>Принято</span></div><svg viewBox="0 0 640 225" role="img" aria-label={days.map(d=>`${d.day}: создано ${d.created}, принято ${d.completed}`).join('; ')}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="42" x2="602" y1={40+i*36.25} y2={40+i*36.25}/><text x="24" y={44+i*36.25} textAnchor="end">{Math.round(max*(4-i)/4)}</text></g>)}
 <polyline className="trend-created" points={points('created')}/><polyline className="trend-completed" points={points('completed')}/>
 {days.map((d,i)=><g key={d.day}><circle className="trend-created-dot" cx={x(i)} cy={y(d.created)} r="3"><title>{d.day}: создано {d.created}</title></circle><circle className="trend-completed-dot" cx={x(i)} cy={y(d.completed)} r="3"><title>{d.day}: принято {d.completed}</title></circle>{(i%Math.max(1,Math.ceil(days.length/6))===0||i===days.length-1)&&<text x={x(i)} y="213" textAnchor="middle">{d.day.slice(8)}.{d.day.slice(5,7)}</text>}</g>)}
 </svg></div>;
}
function StatusChart({counts}:{counts:Record<Status, number>}) {
 const colors=['#5b4ce4','#8b7ff0','#e8b05d','#b5a8ed','#2e2375'];
 const total=Object.values(counts).reduce((sum,count)=>sum+count,0);
 const rows=statuses.map((s,i)=>{const count=counts[s.id];const begin=total?statuses.slice(0,i).reduce((sum,status)=>sum+counts[status.id],0)/total*100:0;const end=begin+(total?count/total*100:0);return {...s,count,color:colors[i],part:`${colors[i]} ${begin}% ${end}%`};});
 return <div className="operations-status-chart"><div className="operations-status-ring" style={{background:total?`conic-gradient(${rows.map(r=>r.part).join(',')})`:'var(--rule)'}} role="img" aria-label={rows.map(r=>`${r.label}: ${r.count}`).join(', ')}><div><strong>{total}</strong><span>задач</span></div></div><div className="operations-status-list">{rows.map(r=><div className="operations-status" key={r.id}><span><i style={{background:r.color}}/>{r.label}</span><b>{r.count}</b></div>)}</div></div>;
}

function OverdueTasks({ tasks }: { tasks: ReturnType<typeof operationsSummary>['overdue'] }) {
 return <section className="reference-panel operations-overdue" aria-labelledby="operations-overdue-title">
  <h2 id="operations-overdue-title">Просроченные задачи</h2>
  {tasks.map(task => <Link className="operations-overdue-row" href={`/board?task=${task.id}`} key={task.id}>
   <span><small>КР-{String(task.id).padStart(3, '0')}</small><strong className="operations-overdue-title">{task.offer}</strong></span>
   <span>{statuses.find(status => status.id === task.status)?.label}<small>{task.creativeName || 'Без исполнителя'}</small></span>
   <time dateTime={new Date(task.deadline).toISOString()}>До {formatDate(task.deadline, true)}</time>
   <strong>{duration(task.delay)} просрочки</strong>
  </Link>)}
  {!tasks.length && <p className="dashboard-empty">Просроченных задач за период нет.</p>}
 </section>;
}

type Snapshot=ReturnType<ProductStore['productSnapshot']>;
type Finance=ReturnType<ProductStore['financeReport']>;
export function OperationsAnalytics({tasks,events,snapshot,finance,person,start,end,now,calendar,members=snapshot.members,tab='overview'}:{tasks:Task[];events:RevisionEvent[];snapshot:Snapshot;finance:Finance;person:Profile;start:string;end:string;now:number;calendar?:WorkCalendar | null;members?:Profile[];tab?:string}){
 const {from,to}=reportPeriod(start,end),summary=operationsSummary(tasks,events,from,to,now,calendar);
 const query=`from=${start}&to=${end}`;
 const metrics=[['Задач за период',summary.created],['От старта до готовности',duration(summary.averageElapsed)],['Процент правок',summary.revisionPercent===null?'—':`${Math.round(summary.revisionPercent)}%`],['Просрочено',summary.overdue.length],['Средняя стоимость креатива',finance.averageCost===null?'—':usd(finance.averageCost)]];
 return <div className="operations-page"><nav className="operations-tabs" aria-label="Разделы аналитики">{[['overview','Обзор'],['employees','Сотрудники'],['ai','AI-сервисы']].map(([id,label])=><Link href={`/analytics?tab=${id}&${query}`} aria-current={tab===id?'page':undefined} key={id}>{label}</Link>)}</nav><form className="report-range" action="/analytics"><input type="hidden" name="tab" value={tab}/><label>Начало периода<input name="from" type="date" defaultValue={start} required/></label><label>Конец периода<input name="to" type="date" defaultValue={end} required/></label><button className="button primary">Показать</button></form>{tab==='ai'?<FinancePage snapshot={snapshot} report={finance} person={person} returnTo={`/analytics?tab=ai&${query}`}/>:tab==='employees'?<>{(['creative','buyer'] as const).map(role=><section className="reference-panel operations-employees" key={role}><h2>{role==='creative'?'Креативщики':'Байеры'}</h2><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Сотрудник</th>{role==='creative'?<><th>Загрузка сейчас</th><th>Ср. от старта до готовности</th></>:<th>ТЗ за период</th>}<th>Выполнено</th><th>% правок</th><th>Циклов правок</th>{role==='creative'&&<th>Просрочек</th>}<th>Расходы AI, USD</th></tr></thead><tbody>{members.filter(p=>p.role===role).map(p=>{const own=tasks.filter(t=>role==='creative'?t.creativeId===p.id:t.buyerId===p.id);const s=operationsSummary(own,events,from,to,now,calendar);const expense=finance.expenses.filter(e=>role==='creative'?e.creativeId===p.id:own.some(t=>t.id===e.taskId));const amount=expense.reduce((n,e)=>n+(e.cost??0),0);return <tr key={p.id}><td>{p.name}</td>{role==='creative'?<><td>{own.filter(t=>t.status!=='done' && t.deletedAt==null).length}</td><td>{duration(s.averageElapsed)}</td></>:<td>{s.created}</td>}<td>{s.completed}</td><td>{s.revisionPercent===null?'—':`${Math.round(s.revisionPercent)}%`}</td><td>{s.revisions}</td>{role==='creative'&&<td>{s.overdue.length}</td>}<td>{usd(amount)}{expense.some(e=>e.cost===null)?' + не оценено':''}</td></tr>;})}</tbody></table></div></section>)}</>:<><div className="operations-kpis">{metrics.map(([label,value])=><section className="reference-panel" key={label}><h2>{label}</h2><strong>{value}</strong></section>)}</div><details className="operations-definitions"><summary>Как считаются показатели</summary><p className="dashboard-hint">Задачи — по дате создания. Выполнено — по дате приёмки. Процент правок — среди принятых за период задач. Просрочки — по дедлайну в периоде. {calendar?.enabled ? 'Время рассчитано по текущему рабочему календарю. Просрочки показаны в календарном времени.' : 'Время показывает фактически прошедший интервал.'}</p></details><div className="operations-layout"><section className="reference-panel"><h2>Задачи по статусам</h2><p className="operations-panel-note">Созданные за период · статус на конец периода</p><StatusChart counts={summary.statuses}/></section><section className="reference-panel"><h2>Динамика по дням</h2><p className="operations-panel-note">Создание задач и приёмка результатов</p><DailyChart days={summary.days}/></section></div><OverdueTasks tasks={summary.overdue}/></>}</div>;
}
