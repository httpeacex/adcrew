import { expect, test, type Page } from '@playwright/test';
import { localDay } from '../../src/lib/workflow';

async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/session' && response.request().method() === 'POST'),
    page.getByRole('button', { name: new RegExp(role) }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL('/board');
}

async function expectCenteredWorkspace(page: Page) {
  const offset = await page.locator('#workspace-main').evaluate((main) => {
    const workspace = main.getBoundingClientRect();
    const content = main.firstElementChild!.getBoundingClientRect();
    return Math.abs(content.left + content.width / 2 - workspace.left - workspace.width / 2);
  });
  expect(offset).toBeLessThan(1);
}

test('brief, claim, two file submissions, review, analytics and role boundaries', async ({ browser, baseURL }) => {
  const buyer = await browser.newPage({ baseURL, viewport: { width: 1800, height: 900 } });
  const creative = await browser.newPage({ baseURL, viewport: { width: 1800, height: 900 } });
  const lead = await browser.newPage({ baseURL });
  const offer = `Тестовый оффер ${Date.now()}`;
  await login(buyer, 'Покупатель');
  const initialCount = (await buyer.locator('.column-count').allTextContents()).reduce((sum, count) => sum + Number(count), 0);
  const nav = buyer.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'Доска задач' }).locator('.side-count')).toHaveText(String(initialCount));
  await expect(nav.getByRole('link', { name: 'Мои задачи' })).toHaveCount(0);
  await expect(buyer.getByRole('region', { name: 'На проверке', exact: true }).getByRole('heading', { name: 'На проверке' })).toBeVisible();
  await buyer.getByRole('link', { name: 'Новая задача' }).click();
  await expect(buyer).toHaveURL('/tasks/new');
  await expectCenteredWorkspace(buyer);
  await buyer.getByLabel('Оффер', { exact: true }).fill(offer);
  await buyer.getByLabel('GEO').fill('NL');
  await buyer.getByLabel('Дедлайн').fill(`${localDay(Date.now() + 86_400_000)}T18:00`);
  await buyer.getByLabel('Описание').fill('Сделать тестовый креатив с двумя раундами согласования.');
  await buyer.getByRole('button', { name: 'Опубликовать ТЗ' }).click();
  await expect(buyer.getByRole('heading', { name: offer })).toBeVisible();
  const task = new URL(buyer.url()).pathname;
  expect(task).toMatch(/^\/tasks\/\d+$/);

  await login(creative, 'Креативщик');
  await expect(creative.getByRole('navigation').getByRole('link', { name: 'Мои задачи' })).toBeVisible();
  await creative.getByRole('searchbox').fill(offer);
  await creative.getByRole('link', { name: new RegExp(offer) }).click();
  await creative.getByRole('button', { name: 'Взять в работу' }).click();
  await expect(creative.locator('.status-pill')).toHaveText('В работе');
  await creative.locator('input[type=file]').setInputFiles('fixtures/creative.png');
  await creative.getByLabel('ChatGPT').fill('12');
  await creative.getByRole('button', { name: 'Сдать результат' }).click();
  await expect(creative).toHaveURL(`/board?task=${task.split('/').at(-1)}`);
  await creative.getByRole('link', { name: 'Открыть полную карточку', exact: true }).click();
  await expect(creative).toHaveURL(task);
  await expectCenteredWorkspace(creative);
  await expect(creative.locator('.status-pill')).toHaveText('На проверке');

  await buyer.goto(`/board?task=${task.split('/').at(-1)}`);
  await buyer.getByRole('button', { name: 'На правки' }).click();
  await buyer.getByLabel('Что нужно поправить').fill('Сделать крупнее заголовок.');
  await buyer.getByRole('button', { name: 'Отправить на правки' }).click();
  await expect(buyer.locator('.status-pill')).toHaveText('Правки');

  await creative.goto(`/board?task=${task.split('/').at(-1)}`);
  await creative.locator('input[type=file]').setInputFiles('fixtures/creative.mp4');
  await creative.getByLabel('ChatGPT').fill('3,5');
  await creative.getByRole('button', { name: 'Сдать результат' }).click();
  await expect(creative).toHaveURL(`/board?task=${task.split('/').at(-1)}`);
  await creative.getByRole('link', { name: 'Открыть полную карточку', exact: true }).click();
  await expect(creative).toHaveURL(task);
  await expect(creative.locator('.status-pill')).toHaveText('На проверке');
  await expect(creative.getByRole('heading', { name: 'Версия 2' })).toBeVisible();
  await expect(creative.getByText('Сделать крупнее заголовок.').first()).toBeVisible();

  await buyer.goto(`/board?task=${task.split('/').at(-1)}`);
  await buyer.getByRole('button', { name: 'Принять', exact: true }).click();
  await expect(buyer.locator('.status-pill')).toHaveText('Готово');
  await buyer.getByRole('link', { name: 'Открыть полную карточку' }).click();
  const file = buyer.getByRole('link', { name: 'Скачать creative.mp4' });
  const fileUrl = (await file.getAttribute('href'))!;
  const download = await buyer.request.get(fileUrl);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-type']).toBe('video/mp4');
  expect((await download.body()).length).toBeGreaterThan(200);
  expect((await buyer.goto('/analytics'))?.status()).toBe(404);

  await login(lead, 'Руководитель');
  const overview = lead.getByRole('region', { name: 'Сводка аналитики' });
  await expect(overview).toHaveCount(0);
  await lead.getByRole('link', { name: 'Аналитика' }).click();
  await expect(overview).toBeVisible();
  await expect(overview.getByText('AI-сервисов', { exact: true })).toBeVisible();
  await expect(overview.getByRole('listitem').filter({ hasText: 'ChatGPT' })).toContainText('15,5 кр.');
  await expect(lead.getByRole('row', { name: 'ChatGPT Лера Ким 15,5' })).toBeVisible();
  await expect(lead.getByRole('heading', { name: 'Загрузка команды' })).toBeVisible();
  await lead.goto(task);
  await expect(lead.getByRole('heading', { name: 'Версия 1' })).toBeVisible();
  await expect(lead.getByRole('heading', { name: 'Версия 2' })).toBeVisible();
  const preview = lead.getByRole('img', { name: 'Предпросмотр creative.png' });
  await preview.scrollIntoViewIfNeeded();
  await expect.poll(() => preview.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(lead.getByText('Работа принята')).toBeVisible();

  await buyer.goto('/board');
  await expect(nav.getByRole('link', { name: 'Доска задач' }).locator('.side-count')).toHaveText(String(initialCount + 1));
  await buyer.locator('.profile-menu summary').click();
  await buyer.getByRole('button', { name: /Макс Соколов/ }).click();
  await expect(buyer.getByLabel('Учётная запись: Макс Соколов, Покупатель')).toBeVisible();
  await buyer.goto(`/board?task=${task.split('/').at(-1)}`);
  await expect(buyer.getByRole('link', { name: new RegExp(offer) })).toHaveCount(0);
  await expect(buyer.getByRole('complementary', { name: offer })).toHaveCount(0);
  expect((await buyer.goto(task))?.status()).toBe(404);
  expect((await buyer.request.get(fileUrl)).status()).toBe(404);
  await Promise.all([buyer.close(), creative.close(), lead.close()]);
});

test('mobile board and history fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await login(page, 'Руководитель');
  await page.getByRole('button', { name: 'Фильтры', exact: true }).first().click();
  await page.getByLabel('Статус', { exact: true }).selectOption('review');
  const luma = page.getByRole('link', { name: /Видео для Dating/ });
  await expect(luma).toBeVisible();
  const cover = luma.locator('.card-cover img');
  await cover.scrollIntoViewIfNeeded();
  await expect.poll(() => cover.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: /Пакет креативов для WeightLoss/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Сбросить' }).click();
  await page.getByLabel('Статус', { exact: true }).selectOption('done');
  await expect(page.getByRole('region', { name: 'Новые', exact: true })).toBeHidden();
  await page.getByRole('link', { name: /Пакет креативов для WeightLoss/ }).click();
  const description = page.getByRole('region', { name: 'Описание задачи' }).locator('p');
  await expect(description).toBeVisible();
  const typography = await description.evaluate((element) => ({ width: element.getBoundingClientRect().width, fontWeight: Number(getComputedStyle(element).fontWeight) }));
  expect(typography.width).toBeGreaterThan(270);
  expect(typography.fontWeight).toBe(400);
  await page.getByRole('button', { name: 'История', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'История задачи' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('theme changes across the board, drawer and analytics and survives reload', async ({ page }) => {
  await login(page, 'Руководитель');
  const board = page.getByRole('region', { name: 'Kanban-доска' });
  await expect(board.getByRole('button', { name: /^(Все задачи|Мои|Просрочены|Все|Новые|В работе|На проверке|Правки|Готово) \d+$/ })).toHaveCount(0);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const darkBackground = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
  const darkCard = await page.locator('.task-card').first().evaluate(element => getComputedStyle(element).backgroundImage);
  await expect(page.getByRole('heading', { name: 'Доска задач', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: /Видео для Dating/ })).toBeVisible();
  await expect(page.locator('.drawer-summary > div')).toHaveCount(4);
  await expect(page.locator('.drawer-summary')).toContainText('Исполнитель');
  await expect(page.locator('.drawer-summary')).toContainText('Покупатель');
  await expect(page.locator('.drawer-hero')).toBeVisible();
  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(darkBackground);
  expect(await page.locator('.task-card').first().evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe(darkCard);
  await expect(page.getByRole('heading', { name: 'Доска задач', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Закрыть карточку' }).click();
  await expect(page.getByRole('complementary', { name: /Видео для Dating/ })).toHaveCount(0);
  const search = page.getByRole('searchbox');
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await search.fill('Dating');
  await expect(page.getByRole('link', { name: /Видео для Dating/ })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Очистить поиск' }).click({ timeout: 3000 });
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.locator('.board-view')).toHaveText(/^(\d+) из \1$/);
  await page.getByRole('button', { name: 'Фильтры', exact: true }).first().click();
  await page.getByLabel('Статус', { exact: true }).selectOption('review');
  await expect(board.getByRole('link', { name: /Видео для Dating/ })).toBeVisible();
  await expect(board.getByRole('link', { name: /Пакет креативов для WeightLoss/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Аналитика', exact: true }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('sidebar and header keep their geometry between sections', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await login(page, 'Руководитель');
  const measure = () => page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar')!.getBoundingClientRect();
    const header = document.querySelector('.board-heading')!.getBoundingClientRect();
    return [Math.round(sidebar.width), Math.round(header.left), Math.round(header.height)];
  });
  const nav = page.getByRole('navigation');
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Включить светлую тему' }).click();
    const geometry = await measure();
    for (const [label, path] of [['Аналитика', '/analytics'], ['Команда', '/team'], ['AI-расходы', '/ai-expenses'], ['История действий', '/history'], ['Настройки', '/settings'], ['Доска задач', '/board']]) {
      const link = nav.getByRole('link', { name: label, exact: true });
      await link.click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
      expect(await measure()).toEqual(geometry);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      if (path !== '/board') await expectCenteredWorkspace(page);
      if (path === '/team' || path === '/ai-expenses') {
        await link.click();
        await expect(page).toHaveURL(path);
      }
    }
  }
});

test('opening a task resizes the board progressively and keeps the panel inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await login(page, 'Руководитель');
  await page.goto('/board?task=none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const before = (await page.locator('.board-main').boundingBox())!.width;
  const samples = page.locator('.board-main').evaluate(async (main) => {
    const widths: number[] = [];
    const deadline = performance.now() + 1600;
    while (performance.now() < deadline) {
      widths.push(main.getBoundingClientRect().width);
      await new Promise(requestAnimationFrame);
    }
    return widths;
  });
  await page.locator('.task-card').first().click();
  await expect(page.locator('.task-drawer')).toBeVisible();
  const widths = await samples;
  const after = (await page.locator('.board-main').boundingBox())!.width;
  expect(before - after).toBeGreaterThan(300);
  expect(widths.filter(width => width < before - 2 && width > after + 2).length).toBeGreaterThan(3);
  const panel = (await page.locator('.task-drawer').boundingBox())!;
  expect(panel.x + panel.width).toBeLessThanOrEqual(1800);
  await page.getByRole('link', { name: 'Закрыть карточку', exact: true }).click();
  await expect.poll(async () => (await page.locator('.board-main').boundingBox())!.width).toBeCloseTo(before, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.task-card').first().click();
  await expect(page.locator('.task-drawer')).toBeVisible();
  expect(await page.locator('.task-drawer').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('the workflow guide opens from the board and follows the active theme', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await login(page, 'Руководитель');
  await page.getByRole('link', { name: 'Как это работает', exact: true }).click();
  await expect(page).toHaveURL('/how-it-works');
  await expect(page.getByRole('heading', { name: 'Как это работает', exact: true })).toBeVisible();
  const guide = page.getByRole('region', { name: 'От задачи до готового креатива' });
  await expectCenteredWorkspace(page);
  const dark = await guide.evaluate((el) => getComputedStyle(el).backgroundColor);
  await guide.getByRole('button', { name: /Правки/ }).click();
  await expect(guide.getByText('Креативщик сдаёт новую версию', { exact: false })).toBeVisible();
  await guide.getByRole('button', { name: 'AI-кредиты', exact: true }).click();
  await expect(guide.getByText('Креативщик записывает расход по каждому сервису', { exact: false })).toBeVisible();
  const chart = guide.getByRole('slider', { name: 'Этап' });
  await chart.press('End');
  await expect(chart).toHaveAttribute('aria-valuetext', 'Готово, 9 ч с момента создания');
  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => guide.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(dark);
  await page.setViewportSize({ width: 375, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
