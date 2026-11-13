'use client';
import { useState } from 'react';
import { RequestForm } from './forms';
import { aiServices, formatCredits, formatDate, type Profile } from '@/lib/workflow';
import type { ProductStore } from '@/lib/product-store';
import './product.css';
type Snapshot=ReturnType<ProductStore['productSnapshot']>;
type Report=ReturnType<ProductStore['financeReport']>;
export const usd=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export function FinanceSettings({snapshot,person,returnTo='/settings'}:{snapshot:Snapshot;person:Profile;returnTo?:string}){
 const [kind,setKind]=useState('credits'),[price,setPrice]=useState(''),[credits,setCredits]=useState('');
 if(person.role!=='lead')return null;
 return <div className="product-card-grid"><section className="product-panel product-padding"><h2>Тарифы AI в USD</h2><p className="product-muted">Цена кредита вычисляется из стоимости тарифа. Новый тариф применяется только к будущим сдачам.</p><RequestForm url="/api/product/usd-tariff" returnTo={returnTo}>{({busy})=><fieldset disabled={busy}><label className="field">Сервис<select name="service">{aiServices.map(s=><option key={s}>{s}</option>)}</select></label><label className="field">Тип тарифа<select name="kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="credits">Тариф с кредитами</option><option value="subscription">Подписка без кредитов</option></select></label><label className="field">Стоимость тарифа, USD<input name="price" type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required /></label>{kind==='credits'?<><label className="field">Кредитов в тарифе<input name="credits" type="number" min="0.001" step="0.001" value={credits} onChange={e=>setCredits(e.target.value)} required /></label><p>Цена кредита: {Number(credits)>0&&price!==''?`${(Number(price)/Number(credits)).toLocaleString('ru-RU',{maximumFractionDigits:6})} USD`:'—'}</p></>:<p className="product-muted">Стоимость не распределяется между задачами и сотрудниками. Платежи вносятся отдельно вручную.</p>}<button className="button primary" type="submit" disabled={busy}>{busy?'Сохраняем…':'Сохранить тариф'}</button></fieldset>}</RequestForm></section><section className="product-panel product-padding"><h2>Месячный бюджет, USD</h2><p className="product-muted">Ориентир бюджета рабочего пространства. Сумма не блокирует сдачу работы; старый бюджет в RUB сохранён отдельно.</p><RequestForm url="/api/product/usd-budget" returnTo={returnTo}>{({busy})=><fieldset disabled={busy}><label className="field">Сумма, USD<input name="amount" type="number" min="0" step="0.01" defaultValue={snapshot.finance.budget.amount} required /></label><button className="button primary" type="submit" disabled={busy}>Сохранить бюджет</button></fieldset>}</RequestForm><h2>Платёж за подписку</h2><p className="product-muted">Записывается сегодняшней датой без привязки к сотруднику, задаче или правкам.</p><RequestForm url="/api/product/usd-charge" returnTo={returnTo}>{({busy})=><fieldset disabled={busy}><label className="field">Подписка<select name="service" required defaultValue=""><option value="" disabled>Выберите подписку</option>{snapshot.finance.tariffs.filter(t=>t.kind==='subscription').map(t=><option key={t.service}>{t.service}</option>)}</select></label><label className="field">Оплачено, USD<input name="amount" type="number" min="0" step="0.01" required /></label><label className="field">Основание платежа<input name="note" required maxLength={1000} placeholder="Например, подписка за ноябрь" /></label><button className="button primary" type="submit" disabled={busy}>Записать платёж</button></fieldset>}</RequestForm></section></div>;
}
function ExpenseTable({ title, label, rows, empty }: {
  title: string;
  label: string;
  rows: { key: string | number; name: string; spent: number; unallocated: number; known: boolean }[];
  empty: string;
}) {
  return <section className="product-panel">
    <div className="product-section-title"><h2>{title}</h2></div>
    <div className="product-table-wrap">
      <table className="product-table expense-summary-table" aria-label={title}>
        <colgroup><col/><col className="expense-amount"/><col className="expense-unknown"/></colgroup>
        <thead><tr><th scope="col">{label}</th><th scope="col">Расходы, USD</th><th scope="col">Без оценки</th></tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.key}>
            <th scope="row">{row.name}</th>
            <td>{row.known ? usd(row.spent) : '—'}</td>
            <td>{row.unallocated || '—'}</td>
          </tr>)}
          {!rows.length && <tr><td colSpan={3}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

export function FinancePage({snapshot,report,person,settings=false,returnTo='/analytics'}:{snapshot:Snapshot;report?:Report;person:Profile;settings?:boolean;returnTo?:string}){
 const f=report??snapshot.finance.monthly;
 return <div className="product-page"><div className="product-stats"><article className="product-panel"><span>{f.unknown>0?'Учтённая часть расходов AI':'Расходы AI'}</span><strong>{f.unknown > 0 && !f.expenses.some(expense => expense.cost !== null) && !f.charges.length ? '—' : usd(f.spent)}</strong><small>USD · по датам сдач и платежей{f.unknown>0?' · без записей с неизвестной ценой':''}</small></article><article className="product-panel"><span>На правки</span><strong>{usd(f.revisionSpent)}</strong><small>По версиям начиная со второй</small></article><article className="product-panel"><span>Средняя стоимость креатива</span><strong>{f.averageCost===null?'—':usd(f.averageCost)}</strong><small>{f.averageCost===null&&(f.unknown>0||f.unallocated>0||f.charges.length>0)?'Недоступно: есть неоценённые расходы или нераспределённые подписки':'По сданным за период креативам'}</small></article><article className="product-panel"><span>Остаток бюджета месяца</span><strong>{snapshot.finance.budget.amount>0?usd(snapshot.finance.monthly.remaining):'Бюджет не задан'}</strong><small>{snapshot.finance.monthly.unknown>0?'Предварительно: бюджет минус известные расходы месяца':'Бюджет минус расходы текущего месяца'}</small></article></div>{(f.unknown>0||f.unallocated>0||f.subscriptionSpent>0)&&<p className="product-muted" role="status">{f.unknown>0&&<>Не оценено в USD: {f.unknown} записей. Исторические RUB не пересчитываются автоматически. </>}{(f.unallocated>0||f.subscriptionSpent>0)&&<>Использование подписок без кредитов: {f.unallocated} записей. Платежи {usd(f.subscriptionSpent)} включены в расходы сервиса; распределение на задачи, сотрудников и правки не задано.</>}</p>}<ExpenseTable title="Расходы по сервисам" label="Сервис" empty="Нет расходов за период"
  rows={f.services.map(service => ({ ...service, key: service.service, name: service.service,
    known: f.charges.some(charge => charge.service === service.service) || f.expenses.some(expense => expense.service === service.service && expense.cost !== null),
  }))}/>
<ExpenseTable title="Расходы по исполнителям" label="Исполнитель" empty="Нет сдач с AI-расходами за период"
  rows={f.employees.map(employee => ({ ...employee, key: employee.creativeId,
    known: f.expenses.some(expense => expense.creativeId === employee.creativeId && expense.cost !== null),
  }))}/>
<section className="product-panel"><div className="product-section-title"><h2>История расходов по версиям</h2></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Креатив / версия</th><th>Дата</th><th>Сервис</th><th>Расход</th><th>Стоимость, USD</th></tr></thead><tbody>{f.expenses.map(e=><tr key={`${e.submissionId}:${e.service}`}><td>#{e.taskId} · v{e.round}{e.round>1?' · правки':''}</td><td>{formatDate(e.submittedAt,true)}</td><td>{e.service}</td><td>{e.kind==='subscription'?'Подписка':formatCredits(e.units)}</td><td>{e.cost===null?'Не распределено / нет USD-тарифа':usd(e.cost)}</td></tr>)}{f.charges.map(c=><tr key={`charge:${c.id}`}><td>Платёж за подписку</td><td>{formatDate(c.at,true)}</td><td>{c.service}</td><td>{c.note}</td><td>{usd(c.amount)}</td></tr>)}{!f.expenses.length&&!f.charges.length&&<tr><td colSpan={5}>Нет записей за период</td></tr>}</tbody></table></div></section><section className="product-panel"><div className="product-section-title"><h2>Действующие тарифы</h2></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Сервис</th><th>Стоимость тарифа, USD</th><th>Кредитов</th><th>USD за кредит</th></tr></thead><tbody>{snapshot.finance.tariffs.map(t=><tr key={t.service}><td>{t.service}</td><td>{usd(t.price)}</td><td>{t.credits??'Подписка без кредитов'}</td><td>{t.unitPrice===null?'Не применяется':t.unitPrice.toLocaleString('ru-RU',{maximumFractionDigits:6})}</td></tr>)}{!snapshot.finance.tariffs.length&&<tr><td colSpan={4}>Руководитель ещё не задал тарифы в USD.</td></tr>}</tbody></table></div></section>{settings&&<FinanceSettings snapshot={snapshot} person={person} returnTo={returnTo} />}{snapshot.rates.length>0&&<details className="product-panel product-padding"><summary>Сохранённые тарифы RUB · архив</summary><p className="product-muted">Не используются в USD-расчётах. Валюта исходных данных сохранена.</p>{snapshot.rates.map(r=><p key={r.service}>{r.service}: {r.price.toLocaleString('ru-RU')} RUB за кредит</p>)}<p>Архивный бюджет: {snapshot.budget.amount.toLocaleString('ru-RU')} RUB</p></details>}</div>;
}
