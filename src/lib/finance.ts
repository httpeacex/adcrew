import type { DatabaseSync } from 'node:sqlite';
import { aiServices, InputError, localDay, type Actor } from './workflow.ts';

export type Tariff = {
  service: string; kind: 'credits' | 'subscription'; price: number; credits: number | null;
  unitPrice: number | null; currency: 'USD'; updatedAt: number;
};
export type Expense = {
  submissionId: number; taskId: number; creativeId: number; creativeName: string; service: string;
  units: number; round: number; submittedAt: number; kind: string; cost: number | null; unitPrice: number | null;
};

type CreditPurchase = { id: number; service: string; credits: number; amount: number; at: number };
const dayMs = 86_400_000;
const round = (value: number) => Math.round((value + Number.EPSILON) * 1e6) / 1e6;
const monthStart = (at: number) => Date.parse(`${localDay(at).slice(0, 7)}-01T00:00:00+05:00`);

function validMoney(value: string | undefined) {
  if (!value?.trim()) throw new InputError('Укажите сумму в USD.');
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) throw new InputError('Проверьте сумму в USD.');
  return round(amount);
}

function validCredits(value: string | undefined) {
  const credits = Number(value);
  if (!value?.trim() || !Number.isFinite(credits) || credits < 0.001 || credits > 1e12) {
    throw new InputError('Количество кредитов должно быть больше нуля.');
  }
  return credits;
}

function validId(value: string | undefined) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new InputError('Выберите платёж и версию результата.');
  return id;
}

const financeCommands = new Set([
  '/api/product/usd-tariff', '/api/product/usd-budget', '/api/product/usd-charge',
  '/api/product/usd-credit-purchase', '/api/product/usd-subscription-allocation',
]);

export class FinanceLedger {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS usd_tariffs(service TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('credits','subscription')),price REAL NOT NULL,credits REAL,updatedAt INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS usd_budget(id INTEGER PRIMARY KEY,amount REAL NOT NULL) STRICT;
      INSERT OR IGNORE INTO usd_budget VALUES(1,0);
      CREATE TABLE IF NOT EXISTS usd_costs(submissionId INTEGER NOT NULL,service TEXT NOT NULL,kind TEXT NOT NULL,unitPrice REAL,cost REAL,PRIMARY KEY(submissionId,service)) STRICT;
      CREATE TABLE IF NOT EXISTS usd_subscription_charges(id INTEGER PRIMARY KEY,service TEXT NOT NULL,amount REAL NOT NULL,at INTEGER NOT NULL,actorId INTEGER NOT NULL,note TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS usd_subscription_allocations(chargeId INTEGER NOT NULL,submissionId INTEGER NOT NULL,amount REAL NOT NULL CHECK(amount > 0),at INTEGER NOT NULL,actorId INTEGER NOT NULL,PRIMARY KEY(chargeId,submissionId)) STRICT;
      CREATE TABLE IF NOT EXISTS usd_credit_opening(service TEXT PRIMARY KEY,credits REAL NOT NULL,at INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS usd_credit_purchases(id INTEGER PRIMARY KEY,service TEXT NOT NULL,credits REAL NOT NULL,amount REAL NOT NULL,at INTEGER NOT NULL,actorId INTEGER NOT NULL) STRICT;
      INSERT OR IGNORE INTO usd_credit_opening(service,credits,at) SELECT service,credits,updatedAt FROM usd_tariffs WHERE kind='credits';
    `);
  }

  tariffs(): Tariff[] {
    return this.db.prepare('SELECT * FROM usd_tariffs ORDER BY service').all().map(row => ({
      service: String(row.service), kind: row.kind as Tariff['kind'], price: Number(row.price),
      credits: row.credits === null ? null : Number(row.credits),
      unitPrice: row.kind === 'credits' ? Number(row.price) / Number(row.credits) : null,
      currency: 'USD', updatedAt: Number(row.updatedAt),
    }));
  }

  command(actor: Actor, route: string, fields: Record<string, string>, now: number) {
    if (!financeCommands.has(route)) return false;
    if (actor.role !== 'lead') throw new InputError('Действие доступно руководителю.', 403);

    if (route.endsWith('usd-budget')) {
      this.db.prepare('UPDATE usd_budget SET amount=? WHERE id=1').run(validMoney(fields.amount));
      return true;
    }
    if (route.endsWith('usd-subscription-allocation')) {
      this.allocateSubscription(actor, fields, now);
      return true;
    }

    const service = fields.service;
    if (!aiServices.some(item => item === service)) throw new InputError('Выберите AI-сервис.');
    const tariff = this.tariffs().find(item => item.service === service);
    if (route.endsWith('usd-charge')) {
      if (tariff?.kind !== 'subscription') throw new InputError('Выберите подписку без кредитов.');
      const note = (fields.note ?? '').trim();
      if (!note || note.length > 1000) throw new InputError('Укажите основание платежа.');
      this.db.prepare('INSERT INTO usd_subscription_charges(service,amount,at,actorId,note) VALUES(?,?,?,?,?)')
        .run(service, validMoney(fields.amount), now, actor.id, note);
      return true;
    }
    if (route.endsWith('usd-credit-purchase')) {
      if (tariff?.kind !== 'credits') throw new InputError('Выберите сервис с тарифом на кредиты.');
      this.db.prepare('INSERT INTO usd_credit_purchases(service,credits,amount,at,actorId) VALUES(?,?,?,?,?)')
        .run(service, validCredits(fields.credits), validMoney(fields.amount), now, actor.id);
      return true;
    }

    if (fields.kind !== 'credits' && fields.kind !== 'subscription') throw new InputError('Выберите вид тарифа.');
    const credits = fields.kind === 'credits' ? validCredits(fields.credits) : null;
    this.db.prepare(`INSERT INTO usd_tariffs VALUES(?,?,?,?,?) ON CONFLICT(service) DO UPDATE SET
      kind=excluded.kind,price=excluded.price,credits=excluded.credits,updatedAt=excluded.updatedAt`)
      .run(service, fields.kind, validMoney(fields.price), credits, now);
    if (credits !== null) this.db.prepare('INSERT OR IGNORE INTO usd_credit_opening VALUES(?,?,?)').run(service, credits, now);
    return true;
  }

  private allocateSubscription(actor: Actor, fields: Record<string, string>, now: number) {
    const chargeId = validId(fields.chargeId);
    const submissionId = validId(fields.submissionId);
    const amount = validMoney(fields.amount);
    if (amount <= 0) throw new InputError('Укажите положительную сумму распределения.');
    const charge = this.db.prepare(`SELECT c.service,c.amount,COALESCE(SUM(a.amount),0) AS assigned
      FROM usd_subscription_charges c LEFT JOIN usd_subscription_allocations a ON a.chargeId=c.id
      WHERE c.id=? GROUP BY c.id`).get(chargeId);
    if (!charge || !this.db.prepare("SELECT 1 FROM usd_costs WHERE submissionId=? AND service=? AND kind='subscription'")
      .get(submissionId, charge.service)) throw new InputError('В версии должно быть отмечено использование этой подписки.');
    if (this.db.prepare('SELECT 1 FROM usd_subscription_allocations WHERE chargeId=? AND submissionId=?').get(chargeId, submissionId)) {
      throw new InputError('Этот платёж уже распределён на выбранную версию.', 409);
    }
    if (amount > round(Number(charge.amount) - Number(charge.assigned))) throw new InputError('Сумма превышает остаток платежа.');
    this.db.prepare('INSERT INTO usd_subscription_allocations VALUES(?,?,?,?,?)').run(chargeId, submissionId, amount, now, actor.id);
  }

  validateUsage(usage: { service: string; units: number }[]) {
    const tariffs = this.tariffs();
    for (const item of usage) {
      const tariff = tariffs.find(entry => entry.service === item.service);
      if (item.units === 0 && tariff?.kind !== 'subscription') throw new InputError('Нулевой расход доступен только подписке без кредитов.');
      if (tariff?.kind === 'subscription' && item.units !== 0) throw new InputError('Для подписки без кредитов отметьте использование без ввода кредитов.');
    }
  }

  capture(submissionId: number) {
    const tariffs = this.tariffs();
    for (const row of this.db.prepare('SELECT service,units FROM ai_usage WHERE submissionId=?').all(submissionId)) {
      const tariff = tariffs.find(item => item.service === row.service);
      const unitPrice = tariff?.unitPrice ?? null;
      this.db.prepare('INSERT OR IGNORE INTO usd_costs VALUES(?,?,?,?,?)').run(
        submissionId, String(row.service), tariff?.kind ?? 'unknown', unitPrice,
        unitPrice === null ? null : round(Number(row.units) / 1000 * unitPrice),
      );
    }
  }

  private creditBalances(to: number) {
    return this.db.prepare(`SELECT o.service, o.credits AS openingCredits,
      (SELECT COALESCE(SUM(p.credits),0) FROM usd_credit_purchases p WHERE p.service=o.service AND p.at<?) AS purchasedCredits,
      (SELECT COALESCE(SUM(u.units),0)/1000.0 FROM ai_usage u JOIN submissions s ON s.id=u.submissionId
        WHERE u.service=o.service AND s.submittedAt>=o.at AND s.submittedAt<?) AS usedCredits
      FROM usd_credit_opening o WHERE o.at<? ORDER BY o.service`).all(to, to, to).map(row => {
      const openingCredits = Number(row.openingCredits);
      const purchasedCredits = Number(row.purchasedCredits);
      const usedCredits = Number(row.usedCredits);
      return { service: String(row.service), openingCredits, purchasedCredits, usedCredits,
        remainingCredits: round(openingCredits + purchasedCredits - usedCredits) };
    });
  }

  report(actor: Actor, from: number, to: number) {
    const lead = actor.role === 'lead';
    const scope = lead ? '' : actor.role === 'buyer' ? ' AND t.buyerId=?' : ' AND s.creativeId=?';
    const scopeParameters = lead ? [] : [actor.id];
    const expenses = this.db.prepare(`SELECT s.id AS submissionId,s.taskId,s.creativeId,p.name AS creativeName,
        u.service,u.units,s.round,s.submittedAt,COALESCE(c.kind,'legacy') AS kind,c.unitPrice,
        CASE WHEN c.kind='subscription' THEN (SELECT SUM(a.amount) FROM usd_subscription_allocations a
          JOIN usd_subscription_charges ch ON ch.id=a.chargeId WHERE a.submissionId=s.id AND ch.service=u.service) ELSE c.cost END AS cost
      FROM ai_usage u JOIN submissions s ON s.id=u.submissionId JOIN tasks t ON t.id=s.taskId
      JOIN profiles p ON p.id=s.creativeId LEFT JOIN usd_costs c ON c.submissionId=s.id AND c.service=u.service
      WHERE s.submittedAt>=? AND s.submittedAt<?${scope} ORDER BY s.submittedAt DESC,s.id DESC,u.service`)
      .all(from, to, ...scopeParameters).map(row => ({ ...row })) as Expense[];
    const charges = lead ? this.db.prepare(`SELECT c.*,COALESCE(SUM(a.amount),0) AS assigned FROM usd_subscription_charges c
      LEFT JOIN usd_subscription_allocations a ON a.chargeId=c.id WHERE c.at>=? AND c.at<?
      GROUP BY c.id ORDER BY c.at DESC,c.id DESC`).all(from, to).map(row => ({
        id: Number(row.id), service: String(row.service), amount: Number(row.amount), at: Number(row.at),
        note: String(row.note), remaining: round(Number(row.amount) - Number(row.assigned)),
      })) : [];
    const creditPurchases = lead ? this.db.prepare(`SELECT id,service,credits,amount,at FROM usd_credit_purchases
      WHERE at>=? AND at<? ORDER BY at DESC,id DESC`).all(from, to).map(row => ({ ...row })) as CreditPurchase[] : [];
    const creditBalances = lead ? this.creditBalances(to) : [];
    const allocated = round(expenses.reduce((sum, expense) => sum + (expense.cost ?? 0), 0));
    const creditSpent = expenses.filter(expense => expense.kind !== 'subscription').reduce((sum, expense) => sum + (expense.cost ?? 0), 0);
    const subscriptionSpent = round(charges.reduce((sum, charge) => sum + charge.amount, 0));
    const spent = lead ? round(creditSpent + subscriptionSpent) : allocated;
    const services = Array.from(new Set([...expenses.map(expense => expense.service), ...charges.map(charge => charge.service), ...creditPurchases.map(purchase => purchase.service)])).map(service => {
      const rows = expenses.filter(expense => expense.service === service);
      const payments = charges.filter(charge => charge.service === service);
      const usageCost = rows.filter(expense => !lead || expense.kind !== 'subscription').reduce((sum, expense) => sum + (expense.cost ?? 0), 0);
      return { service, spent: round(usageCost + payments.reduce((sum, charge) => sum + charge.amount, 0)), unallocated: rows.filter(expense => expense.cost === null).length };
    });
    const employees = Array.from(new Set(expenses.map(expense => expense.creativeId))).map(creativeId => {
      const rows = expenses.filter(expense => expense.creativeId === creativeId);
      return { creativeId, name: rows[0].creativeName, spent: round(rows.reduce((sum, expense) => sum + (expense.cost ?? 0), 0)), unallocated: rows.filter(expense => expense.cost === null).length };
    });
    const acceptanceScope = lead ? '' : actor.role === 'buyer' ? ' AND buyerId=?' : ' AND creativeId=?';
    const accepted = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM tasks WHERE completedAt>=? AND completedAt<?${acceptanceScope}`)
      .get(from, to, ...scopeParameters)!.count);
    const unallocated = expenses.filter(expense => expense.kind === 'subscription' && expense.cost === null).length;
    const unknown = expenses.filter(expense => expense.kind !== 'subscription' && expense.cost === null).length;
    const unallocatedPayments = round(charges.reduce((sum, charge) => sum + charge.remaining, 0));
    return {
      currency: 'USD' as const, from, to, spent, allocated, subscriptionSpent, unallocatedPayments, accepted,
      revisionSpent: round(expenses.filter(expense => expense.round > 1).reduce((sum, expense) => sum + (expense.cost ?? 0), 0)),
      averageCost: accepted && !unknown && !unallocated && !unallocatedPayments ? round(allocated / accepted) : null,
      unknown, unallocated, expenses, charges, services, employees, creditBalances, creditPurchases,
    };
  }

  private allocationOptions(actor: Actor) {
    if (actor.role !== 'lead') return { payments: [], submissions: [] };
    const payments = this.db.prepare(`SELECT c.id,c.service,c.note,c.at,c.amount-COALESCE(SUM(a.amount),0) AS remaining
      FROM usd_subscription_charges c LEFT JOIN usd_subscription_allocations a ON a.chargeId=c.id
      GROUP BY c.id HAVING ROUND(remaining,6)>0 ORDER BY c.at DESC,c.id DESC`).all().map(row => ({
      id: Number(row.id), service: String(row.service), note: String(row.note), at: Number(row.at), remaining: round(Number(row.remaining)),
    }));
    const submissions = payments.length ? this.db.prepare(`SELECT s.id,s.taskId,s.round,c.service,p.name AS creativeName,t.offer,
      (SELECT GROUP_CONCAT(a.chargeId) FROM usd_subscription_allocations a WHERE a.submissionId=s.id) AS allocatedChargeIds
      FROM usd_costs c JOIN submissions s ON s.id=c.submissionId JOIN tasks t ON t.id=s.taskId
      JOIN profiles p ON p.id=s.creativeId WHERE c.kind='subscription' ORDER BY s.submittedAt DESC,s.id DESC`).all().map(row => ({
      id: Number(row.id), taskId: Number(row.taskId), round: Number(row.round), service: String(row.service),
      creativeName: String(row.creativeName), offer: String(row.offer), allocatedChargeIds: String(row.allocatedChargeIds ?? '').split(',').filter(Boolean).map(Number),
    })) : [];
    return { payments, submissions };
  }

  budgetStatus(actor: Actor, now: number) {
    const amount = Number(this.db.prepare('SELECT amount FROM usd_budget WHERE id=1').get()!.amount);
    const month = monthStart(now);
    const report = this.report(actor, month, now + 1);
    const remaining = round(amount - report.spent);
    const overBudget = actor.role === 'lead' && amount > 0 && remaining < 0;
    return { amount, month, report, remaining, overBudget, excess: overBudget ? -remaining : 0 };
  }

  snapshot(actor: Actor, now: number) {
    const startToday = Date.parse(`${localDay(now)}T00:00:00+05:00`);
    const { amount, report: month, remaining, overBudget, excess } = this.budgetStatus(actor, now);
    const today = this.report(actor, startToday, now + 1);
    const week = this.report(actor, startToday - 6 * dayMs, now + 1);
    return {
      tariffs: this.tariffs(), allocationOptions: this.allocationOptions(actor), budget: { amount, currency: 'USD' as const },
      monthly: { ...month, remaining, overBudget, excess }, periodDetails: { today, week, month },
      periods: { today: today.spent, week: week.spent, month: month.spent },
    };
  }
}
