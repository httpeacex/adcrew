import { test, expect, type Page } from '@playwright/test';
import { localDay } from '../../src/lib/workflow';

async function role(page: Page, name: string) {
  await page.locator('.profile-menu summary').click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByLabel(new RegExp(`Учётная запись: ${name}`))).toBeVisible();
}

test('Pages keeps a two-round task, files and credits after reloading and switching roles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('button', { name: /Руководитель/ }).click();
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  const tariff = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Тарифы AI в USD', exact: true }) });
  await tariff.getByRole('combobox', { name: 'Сервис', exact: true }).selectOption('ChatGPT');
  await tariff.getByLabel('Стоимость тарифа, USD').fill('20');
  await tariff.getByLabel('Кредитов в тарифе').fill('100');
  await tariff.getByRole('button', { name: 'Сохранить тариф', exact: true }).click();
  await expect(tariff.getByRole('button', { name: 'Сохранить тариф', exact: true })).toBeEnabled();
  await role(page, 'Анна Волкова');
  await page.getByRole('link', { name: 'Создать задачу', exact: true }).click();
  const offer = `Pages ${Date.now()}`;
  await page.getByLabel('Оффер', { exact: true }).fill(offer);
  await page.getByLabel('GEO').fill('NL');
  await page.getByLabel('Дедлайн').fill(`${localDay(Date.now() + 86_400_000)}T18:00`);
  await page.getByLabel('Описание').fill('Подготовить креатив и сохранить две версии результата.');
  await page.getByRole('button', { name: 'Опубликовать ТЗ' }).click();
  await expect(page.getByRole('heading', { name: offer, exact: true })).toBeVisible();
  const task = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: offer, exact: true })).toBeVisible();
  await role(page, 'Лера Ким');
  await page.goto(task);
  await page.getByRole('button', { name: 'Взять в работу', exact: true }).click();
  await expect(page.locator('.detail-title .status-pill')).toHaveText('В работе');
  await page.locator('input[type=file]').setInputFiles('fixtures/creative.png');
  await page.getByLabel('ChatGPT', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Сдать результат', exact: true }).click();
  await expect(page.locator('.detail-title .status-pill')).toHaveText('На проверке');
  await role(page, 'Анна Волкова');
  await page.goto(task);
  await page.getByRole('button', { name: 'Запросить правки', exact: true }).click();
  await page.getByLabel('Что нужно поправить').fill('Поднять контраст заголовка.');
  await page.getByRole('button', { name: 'Отправить на правки', exact: true }).click();
  await expect(page.locator('.detail-title .status-pill')).toHaveText('Правки');
  await role(page, 'Лера Ким');
  await page.goto(task);
  await expect(page.locator('.action-panel .revision-note')).toContainText('Поднять контраст');
  await page.locator('input[type=file]').setInputFiles('fixtures/creative.mp4');
  await page.getByLabel('ChatGPT', { exact: true }).fill('3,5');
  await page.getByRole('button', { name: 'Сдать результат', exact: true }).click();
  await expect(page.locator('.detail-title .status-pill')).toHaveText('На проверке');
  await role(page, 'Анна Волкова');
  await page.goto(task);
  const taskId = task.match(/tasks\/(\d+)/)![1];
  await page.goto(`./#/board?task=${taskId}`);
  const inspector = page.locator('.approved-inspector');
  await inspector.getByRole('button', { name: 'Содержимое', exact: true }).click();
  await inspector.getByLabel('Версия результата').selectOption({ label: 'Версия 1' });
  await expect(inspector.getByRole('button', { name: /^Принять v/ })).toHaveCount(0);
  await expect(inspector.locator('.inspector-usage')).toHaveText('ChatGPT — 12 кр.');
  await expect(inspector.locator('.revision-note')).toContainText('Поднять контраст заголовка.');
  await expect(inspector.getByRole('textbox', { name: 'Комментарий', exact: true })).toHaveCount(0);
  await inspector.getByRole('button', { name: 'К текущей версии', exact: true }).click();
  await expect(inspector.getByRole('button', { name: 'Принять v2', exact: true })).toBeVisible();
  await expect(inspector.locator('.inspector-usage')).toHaveText('ChatGPT — 3,5 кр.');
  await expect(inspector.locator('.revision-note')).toHaveCount(0);
  await page.goto(task);
  await page.getByRole('button', { name: 'Принять работу', exact: true }).click();
  await expect(page.locator('.detail-title .status-pill')).toHaveText('Готово');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Версия 2', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Версия 1', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Скачать creative.mp4', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('creative.mp4');
  await role(page, 'Саша Миронов');
  await page.getByRole('link', { name: 'Аналитика', exact: true }).click();
  await page.getByRole('link', { name: 'AI-сервисы', exact: true }).click();
  const history = page.locator('section').filter({ has: page.getByRole('heading', { name: 'История расходов по версиям', exact: true }) });
  await expect(history.getByRole('row').filter({ hasText: `#${taskId} · v1` })).toContainText('2,40');
  await expect(history.getByRole('row').filter({ hasText: `#${taskId} · v2` })).toContainText('0,70');
  const employees = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Расходы по исполнителям', exact: true }) });
  await expect(employees.getByRole('row').filter({ hasText: 'Лера Ким' })).toContainText('3,10');
  await page.getByLabel('Начало периода').fill('2020-01-01');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/#\/analytics\?tab=ai&from=2020-01-01/);
  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await role(page, 'Макс Соколов');
  await page.goto(task);
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Pages routes, covers and the mobile dialog fit the published project path', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('button', { name: /Руководитель/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.task-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.locator('.task-drawer').evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.locator('[inert]').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1800, height: 1000 });
  for (const name of ['Дашборд', 'Библиотека', 'Аналитика', 'Настройки']) {
    await page.getByRole('navigation', { name: 'Рабочее пространство' }).getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  for (const name of ['Команда', 'Тарифы и бюджет', 'История действий']) {
    await page.getByRole('navigation', { name: 'Рабочее пространство' }).getByRole('link', { name: 'Настройки', exact: true }).click();
    await page.getByRole('navigation', { name: 'Инструменты рабочего пространства' }).getByRole('link', { name, exact: true }).click();
    if (name === 'Тарифы и бюджет') await expect(page.getByRole('heading', { name: 'Действующие тарифы', exact: true })).toBeVisible();
    else await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('navigation', { name: 'Рабочее пространство' }).getByRole('link', { name: 'Доска задач', exact: true }).click();
  const cover = page.locator('.card-cover img').first();
  await expect(cover).toHaveAttribute('src', /.+/);
  expect(await cover.evaluate(async image => (await fetch((image as HTMLImageElement).src)).ok)).toBe(true);
  await expect(page.locator('.card-assignees').first()).toBeVisible();
  await page.locator('.profile-menu summary').click();
  await page.locator('.profile-popup').getByRole('link', { name: 'Как это работает', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Как это работает', exact: true })).toBeVisible();
  expect(failed).toEqual([]);
});

test('Pages keeps existing file links usable after a rejected submission', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('button', { name: /Креативщик/ }).click();
  await expect(page.getByLabel('Учётная запись: Лера Ким, Креативщик')).toBeVisible();
  await page.goto('./#/tasks/12');
  const existingFile = page.locator('.file-download').first();
  await expect(existingFile).toBeVisible();
  const before = await existingFile.getAttribute('href');
  expect(await page.evaluate(async href => (await fetch(href!)).ok, before)).toBe(true);

  await page.locator('input[type=file]').setInputFiles('fixtures/creative.png');
  await page.getByLabel('ChatGPT', { exact: true }).fill('invalid');
  await page.getByRole('button', { name: 'Сдать результат', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const href = await existingFile.getAttribute('href');
  expect(await page.evaluate(async url => {
    try { return (await fetch(url!)).ok; } catch { return false; }
  }, href)).toBe(true);
});

test('Pages serializes delayed cross-tab refreshes with task mutations', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('button', { name: /Заказчик/ }).click();
  await expect(page.getByRole('button', { name: /^Принять v\d+$/ })).toBeVisible();

  // Hold one already-read snapshot at the IndexedDB callback boundary, as can
  // happen when background tab work overlaps a task mutation in this tab.
  await page.evaluate(() => {
    const state = window as typeof window & { releaseSnapshot?: () => void; refreshChannel?: BroadcastChannel };
    const original = IDBObjectStore.prototype.get;
    let delayNextRead = true;
    IDBObjectStore.prototype.get = function (query) {
      const request = original.call(this, query);
      if (delayNextRead) {
        delayNextRead = false;
        const descriptor = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')!;
        Object.defineProperty(request, 'onsuccess', {
          set(handler) {
            descriptor.set!.call(request, (event: Event) => {
              state.releaseSnapshot = () => handler.call(request, event);
            });
          },
          get() { return descriptor.get!.call(request); },
        });
      }
      return request;
    };
    const base = new URL('.', location.href).pathname;
    state.refreshChannel = new BroadcastChannel(`adcrew-changes:${base}`);
    state.refreshChannel.postMessage('updated');
  });
  await page.waitForFunction(() => typeof (window as typeof window & { releaseSnapshot?: () => void }).releaseSnapshot === 'function');
  await page.getByRole('button', { name: /^Принять v\d+$/ }).click();
  // A correct implementation queues the mutation behind the refresh. The
  // original implementation completes it while the old snapshot is held.
  await page.waitForFunction(async () => {
    const done = document.querySelector('.task-drawer .status-pill')?.textContent?.includes('Готово');
    return done || (await navigator.locks.query()).pending!.length > 0;
  });
  await page.evaluate(async () => {
    const state = window as typeof window & { releaseSnapshot?: () => void; refreshChannel?: BroadcastChannel };
    state.releaseSnapshot!();
    state.refreshChannel?.close();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect(page.locator('.task-drawer .status-pill')).toHaveText('Готово');
  await page.reload();
  await expect(page.locator('.task-drawer .status-pill')).toHaveText('Готово');
});
