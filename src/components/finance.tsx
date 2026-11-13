'use client';

import { useState } from 'react';
import { RequestForm } from './forms';
import { aiServices, formatCredits, formatDate, type Profile } from '@/lib/workflow';
import type { ProductStore } from '@/lib/product-store';
import './product.css';

type Snapshot = ReturnType<ProductStore['productSnapshot']>;
type Report = ReturnType<ProductStore['financeReport']>;
export const usd = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);
const credits = (amount: number) => amount.toLocaleString('ru-RU', { maximumFractionDigits: 3 });

function AllocationForm({ options, returnTo }: { options: Snapshot['finance']['allocationOptions']; returnTo: string }) {
  const [paymentId, setPaymentId] = useState('');
  const payment = options.payments.find(item => String(item.id) === paymentId);
  const submissions = options.submissions.filter(item => item.service === payment?.service && !item.allocatedChargeIds.includes(payment.id));
  return <section className="product-panel product-padding">
    <h2>Распределение платежа за подписку</h2>
    <p className="product-muted">Выберите платёж, версию с этой подпиской и сумму. Расход будет отнесён к исполнителю версии и к правкам, если это повторная сдача.</p>
    {!options.payments.length ? <p className="product-muted">Нет платежей с доступным остатком.</p> :
      <RequestForm url="/api/product/usd-subscription-allocation" returnTo={returnTo}>{({ busy }) => <fieldset disabled={busy}>
        <label className="field">Платёж<select name="chargeId" value={payment?.id ?? ''} onChange={event => setPaymentId(event.target.value)} required>
          <option value="" disabled>Выберите платёж</option>
          {options.payments.map(item => <option key={item.id} value={item.id}>{item.service} · {item.note} · остаток {usd(item.remaining)}</option>)}
        </select></label>
        <label className="field">Версия креатива<select key={paymentId} name="submissionId" required disabled={!submissions.length} defaultValue="">
          <option value="" disabled>{payment && !submissions.length ? 'Нет подходящих версий' : 'Выберите версию'}</option>
          {submissions.map(item => <option key={item.id} value={item.id}>{item.offer} · КР-{String(item.taskId).padStart(3, '0')} · v{item.round} · {item.creativeName}</option>)}
        </select></label>
        <label className="field">Распределить, USD<input name="amount" type="number" min="0.01" step="0.01" max={payment?.remaining} required /></label>
        <button className="button primary" type="submit" disabled={busy || !submissions.length}>Распределить</button>
      </fieldset>}</RequestForm>}
  </section>;
}

export function FinanceSettings({ snapshot, person, returnTo = '/settings' }: { snapshot: Snapshot; person: Profile; returnTo?: string }) {
  const [kind, setKind] = useState('credits');
  const [price, setPrice] = useState('');
  const [includedCredits, setIncludedCredits] = useState('');
  if (person.role !== 'lead') return null;
  const subscriptions = snapshot.finance.tariffs.filter(tariff => tariff.kind === 'subscription');
  const creditTariffs = snapshot.finance.tariffs.filter(tariff => tariff.kind === 'credits');
  return <section className="finance-settings" aria-label="Настройки расходов AI">
    <h2 className="finance-settings-title">Расходы AI</h2>
    <div className="product-card-grid">
    <section className="product-panel product-padding">
      <h2>Тарифы AI в USD</h2>
      <p className="product-muted">Цена кредита вычисляется из стоимости тарифа. Новый тариф применяется к будущим сдачам.</p>
      <RequestForm url="/api/product/usd-tariff" returnTo={returnTo}>{({ busy }) => <fieldset disabled={busy}>
        <label className="field">Сервис<select name="service">{aiServices.map(service => <option key={service}>{service}</option>)}</select></label>
        <label className="field">Тип тарифа<select name="kind" value={kind} onChange={event => setKind(event.target.value)}>
          <option value="credits">Тариф с кредитами</option><option value="subscription">Подписка без кредитов</option>
        </select></label>
        <label className="field">Стоимость тарифа, USD<input name="price" type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} required /></label>
        {kind === 'credits' ? <>
          <label className="field">Кредитов в тарифе<input name="credits" type="number" min="0.001" step="0.001" value={includedCredits} onChange={event => setIncludedCredits(event.target.value)} required /></label>
          <p>Цена кредита: {Number(includedCredits) > 0 && price !== '' ? `${(Number(price) / Number(includedCredits)).toLocaleString('ru-RU', { maximumFractionDigits: 6 })} USD` : '—'}</p>
        </> : <p className="product-muted">Сначала внесите платёж за подписку, затем укажите, какую часть отнести к конкретным версиям.</p>}
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить тариф'}</button>
      </fieldset>}</RequestForm>
    </section>
    <section className="product-panel product-padding">
      <h2>Месячный бюджет, USD</h2>
      <p className="product-muted">При превышении руководитель получит уведомление. Сдача результата остаётся доступной.</p>
      <RequestForm url="/api/product/usd-budget" returnTo={returnTo}>{({ busy }) => <fieldset disabled={busy}>
        <label className="field">Сумма, USD<input name="amount" type="number" min="0" step="0.01" defaultValue={snapshot.finance.budget.amount} required /></label>
        <button className="button primary" type="submit" disabled={busy}>Сохранить бюджет</button>
      </fieldset>}</RequestForm>
    </section>
    <section className="product-panel product-padding">
      <h2>Платёж за подписку</h2>
      <RequestForm url="/api/product/usd-charge" returnTo={returnTo}>{({ busy }) => <fieldset disabled={busy}>
        <label className="field">Подписка<select name="service" required defaultValue=""><option value="" disabled>Выберите подписку</option>{subscriptions.map(tariff => <option key={tariff.service}>{tariff.service}</option>)}</select></label>
        <label className="field">Оплачено, USD<input name="amount" type="number" min="0" step="0.01" required /></label>
        <label className="field">Основание платежа<input name="note" required maxLength={1000} placeholder="Например, подписка за ноябрь" /></label>
        <button className="button primary" type="submit" disabled={busy}>Записать платёж</button>
      </fieldset>}</RequestForm>
    </section>
    <section className="product-panel product-padding">
      <h2>Докупка кредитов</h2>
      <p className="product-muted">Докупка увеличивает остаток сервиса. Цену будущих сдач можно обновить в тарифе.</p>
      <RequestForm url="/api/product/usd-credit-purchase" returnTo={returnTo}>{({ busy }) => <fieldset disabled={busy}>
        <label className="field">Сервис с кредитами<select name="service" required defaultValue=""><option value="" disabled>Выберите сервис</option>{creditTariffs.map(tariff => <option key={tariff.service}>{tariff.service}</option>)}</select></label>
        <label className="field">Куплено кредитов<input name="credits" type="number" min="0.001" step="0.001" required /></label>
        <label className="field">Стоимость докупки, USD<input name="amount" type="number" min="0" step="0.01" required /></label>
        <button className="button primary" type="submit" disabled={busy || !creditTariffs.length}>Записать докупку</button>
      </fieldset>}</RequestForm>
    </section>
    <AllocationForm options={snapshot.finance.allocationOptions} returnTo={returnTo} />
    </div>
  </section>;
}

export function FinancePage({ snapshot, report, person, settings = false, returnTo = '/analytics' }: {
  snapshot: Snapshot; report?: Report; person: Profile; settings?: boolean; returnTo?: string;
}) {
  const finance = report ?? snapshot.finance.monthly;
  const monthly = snapshot.finance.monthly;
  return <div className="product-page">
    <div className="product-stats">
      <article className="product-panel"><span>{finance.unknown ? 'Учтённая часть расходов AI' : 'Расходы AI'}</span><strong>{usd(finance.spent)}</strong><small>USD · по датам сдач и платежей{finance.unknown ? ' · без записей с неизвестной ценой' : ''}</small></article>
      <article className="product-panel"><span>На правки</span><strong>{usd(finance.revisionSpent)}</strong><small>По версиям начиная со второй</small></article>
      <article className="product-panel"><span>Средняя стоимость креатива</span><strong>{finance.averageCost === null ? '—' : usd(finance.averageCost)}</strong><small>{finance.averageCost === null && (finance.unknown || finance.unallocated || finance.unallocatedPayments) ? 'Есть расходы без цены или распределения' : `Принято за период: ${finance.accepted}`}</small></article>
      <article className="product-panel"><span>Остаток бюджета месяца</span><strong>{snapshot.finance.budget.amount > 0 ? usd(monthly.remaining) : 'Бюджет не задан'}</strong><small>{monthly.unknown ? 'Предварительно: бюджет минус известные расходы месяца' : 'Бюджет минус расходы текущего месяца'}</small></article>
    </div>
    {monthly.overBudget && <p className="form-error" role="status">Месячный AI-бюджет превышен на {usd(monthly.excess)}.</p>}
    {(finance.unknown > 0 || finance.unallocated > 0 || finance.unallocatedPayments > 0) && <p className="product-muted" role="status">
      {finance.unknown > 0 && <>Без оценки в USD: {finance.unknown} записей. </>}
      {finance.unallocated > 0 && <>Версий с подпиской без распределения: {finance.unallocated}. </>}
      {finance.unallocatedPayments > 0 && <>Остаток платежей к распределению: {usd(finance.unallocatedPayments)}.</>}
    </p>}
    <section className="product-panel"><div className="product-section-title"><h2>Расходы по сервисам</h2></div><div className="product-table-wrap">
      <table className="product-table"><thead><tr><th>Сервис</th><th>Расходы, USD</th><th>Без оценки</th></tr></thead><tbody>
        {finance.services.map(service => <tr key={service.service}><td>{service.service}</td><td>{usd(service.spent)}</td><td>{service.unallocated || '—'}</td></tr>)}
        {!finance.services.length && <tr><td colSpan={3}>Нет расходов за период</td></tr>}
      </tbody></table>
    </div></section>
    <section className="product-panel"><div className="product-section-title"><h2>Остаток кредитов по сервисам</h2></div><div className="product-table-wrap">
      <table className="product-table"><thead><tr><th>Сервис</th><th>Начислено</th><th>Докуплено</th><th>Использовано</th><th>Осталось</th></tr></thead><tbody>
        {finance.creditBalances.map(balance => <tr key={balance.service}><td>{balance.service}</td><td>{credits(balance.openingCredits)}</td><td>{credits(balance.purchasedCredits)}</td><td>{credits(balance.usedCredits)}</td><td>{credits(balance.remainingCredits)}</td></tr>)}
        {!finance.creditBalances.length && <tr><td colSpan={5}>Нет кредитных тарифов к концу периода</td></tr>}
      </tbody></table>
    </div></section>
    <section className="product-panel"><div className="product-section-title"><h2>Расходы по исполнителям</h2></div><div className="product-table-wrap">
      <table className="product-table"><thead><tr><th>Исполнитель</th><th>Расходы, USD</th><th>Без оценки</th></tr></thead><tbody>
        {finance.employees.map(employee => <tr key={employee.creativeId}><td>{employee.name}</td><td>{usd(employee.spent)}</td><td>{employee.unallocated || '—'}</td></tr>)}
        {!finance.employees.length && <tr><td colSpan={3}>Нет сдач с AI-расходами за период</td></tr>}
      </tbody></table>
    </div></section>
    <section className="product-panel"><div className="product-section-title"><h2>История расходов по версиям</h2></div><div className="product-table-wrap">
      <table className="product-table"><thead><tr><th>Креатив / версия</th><th>Дата</th><th>Сервис</th><th>Расход</th><th>Стоимость, USD</th></tr></thead><tbody>
        {finance.expenses.map(expense => <tr key={`${expense.submissionId}:${expense.service}`}><td>#{expense.taskId} · v{expense.round}{expense.round > 1 ? ' · правки' : ''}</td><td>{formatDate(expense.submittedAt, true)}</td><td>{expense.service}</td><td>{expense.kind === 'subscription' ? 'Подписка' : formatCredits(expense.units)}</td><td>{expense.cost === null ? expense.kind === 'subscription' ? 'Не распределено' : 'Без оценки в USD' : usd(expense.cost)}</td></tr>)}
        {!finance.expenses.length && <tr><td colSpan={5}>Нет записей за период</td></tr>}
      </tbody></table>
    </div></section>
    <section className="product-panel"><div className="product-section-title"><h2>Платежи и докупки</h2></div><div className="product-table-wrap">
      <table className="product-table"><thead><tr><th>Операция</th><th>Дата</th><th>Сервис</th><th>Оплачено, USD</th><th>Детали</th></tr></thead><tbody>
        {finance.charges.map(charge => <tr key={`charge:${charge.id}`}><td>Платёж за подписку</td><td>{formatDate(charge.at, true)}</td><td>{charge.service}</td><td>{usd(charge.amount)}</td><td>{charge.note} · к распределению {usd(charge.remaining)}</td></tr>)}
        {finance.creditPurchases.map(purchase => <tr key={`purchase:${purchase.id}`}><td>Докупка кредитов</td><td>{formatDate(purchase.at, true)}</td><td>{purchase.service}</td><td>{usd(purchase.amount)}</td><td>{credits(purchase.credits)} кр.</td></tr>)}
        {!finance.charges.length && !finance.creditPurchases.length && <tr><td colSpan={5}>Нет платежей за период</td></tr>}
      </tbody></table>
    </div></section>
    <section className="product-panel"><div className="product-section-title"><h2>Действующие тарифы</h2></div><div className="product-table-wrap">
      <table className="product-table"><thead><tr><th>Сервис</th><th>Стоимость тарифа, USD</th><th>Кредитов</th><th>USD за кредит</th></tr></thead><tbody>
        {snapshot.finance.tariffs.map(tariff => <tr key={tariff.service}><td>{tariff.service}</td><td>{usd(tariff.price)}</td><td>{tariff.credits ?? 'Подписка без кредитов'}</td><td>{tariff.unitPrice === null ? 'Не применяется' : tariff.unitPrice.toLocaleString('ru-RU', { maximumFractionDigits: 6 })}</td></tr>)}
        {!snapshot.finance.tariffs.length && <tr><td colSpan={4}>Руководитель ещё не задал тарифы в USD.</td></tr>}
      </tbody></table>
    </div></section>
    {settings && <FinanceSettings snapshot={snapshot} person={person} returnTo={returnTo} />}
    {(snapshot.rates.length > 0 || snapshot.budget.amount > 0) && <details className="product-panel product-padding">
      <summary>Сохранённые тарифы RUB · архив</summary>
      {snapshot.rates.map(rate => <p key={rate.service}>{rate.service}: {rate.price.toLocaleString('ru-RU')} RUB за кредит</p>)}
      <p>Архивный бюджет: {snapshot.budget.amount.toLocaleString('ru-RU')} RUB</p>
    </details>}
  </div>;
}
