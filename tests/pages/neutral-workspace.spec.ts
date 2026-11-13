import { test, expect } from '@playwright/test';

test('workspace keeps lead navigation and help, top account, theme and Settings tools', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Руководитель/ }).click();
  await page.waitForURL('**/#/dashboard');
  await page.goto('./#/board?task=10');
  const panel = page.locator('.task-drawer');
  await panel.getByRole('button', { name: 'Содержимое', exact: true }).click();
  await expect(panel.getByLabel('Комментарий', { exact: true })).toHaveCount(0);
  await expect(panel.locator('.mention-picker, .comment-compose')).toHaveCount(0);
  await expect(page.locator('.side-nav a')).toHaveCount(7);
  await expect(page.locator('.side-nav a')).toHaveText(['Дашборд', /Задачи/, 'Библиотека', 'Аналитика', 'Команда', 'Настройки', 'Справка']);
  await expect(page.locator('.reference-topbar .profile-menu summary')).toBeVisible();
  await expect(page.locator('.sidebar .profile-menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Использовать системную тему', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Использовать системную тему', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.side-nav').getByRole('link', { name: 'Команда', exact: true }).click();
  await expect(page.locator('.side-nav [aria-current=page]')).toHaveText('Команда');
  await page.getByRole('searchbox', { name: 'Поиск участника' }).fill('Никита');
  await expect(page.locator('.team-member')).toHaveCount(1);
  await page.locator('.team-member').click();
  await expect(page.locator('.team-detail header')).toContainText('Никита');
  await expect(page.locator('.member-tasks > a').first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Роль участника' }).selectOption('buyer');
  await expect(page.locator('.team-member')).toHaveCount(0);
  await page.goto('./#/notifications');
  const notices = page.locator('[data-view="notifications"]');
  await expect(notices.getByRole('button', { name: 'Прочитать всё', exact: true })).toHaveCount(0);
  await expect(notices.getByRole('button', { name: 'Прочитано', exact: true }).first()).toBeVisible();
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const offset = await notices.evaluate(panel => {
      const center = (rect: DOMRect) => rect.left + rect.width / 2;
      const outer = center(panel.getBoundingClientRect());
      return Math.max(...['.product-heading', '.notification-center'].map(selector =>
        Math.abs(center(panel.querySelector(selector)!.getBoundingClientRect()) - outer)
      ));
    });
    expect(offset).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Сегодня', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сегодня', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./#/settings');
  await expect(page.getByRole('region', { name: 'Управление пользователями' })).toBeVisible();
  const settings = page.locator('[data-view="settings"]');
  const calendarDays = settings.locator('.work-calendar-options .check');
  await expect(calendarDays).toHaveCount(7);
  expect(await calendarDays.evaluateAll(days => new Set(days.map(day => day.getBoundingClientRect().top)).size)).toBe(1);
  expect(await settings.evaluate(panel => panel.clientWidth)).toBeGreaterThan(900);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('navigation', { name: 'Инструменты рабочего пространства' }).getByRole('link', { name: 'Интеграции', exact: true }).click();
  await expect(page).toHaveURL(/#\/integrations/);
  await expect(page.locator('.integration-node')).toHaveCount(3);
  await expect(page.locator('.integration-node .integration-status')).toHaveText(['Требуется сервер', 'Требуется сервер', 'Требуется сервер']);
  await page.goto('./#/history');
  await expect(page.locator('.activity-task').first()).toBeVisible();
  await page.locator('.activity-task').first().click();
  await expect(page.locator('.task-drawer')).toBeVisible();
});
