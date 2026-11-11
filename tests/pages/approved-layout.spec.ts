import { test, expect } from '@playwright/test';

test('approved workspace keeps account and alerts in sidebar and searches task IDs inside board', async ({ page }) => {
  await page.setViewportSize({ width: 1664, height: 946 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Покупатель/ }).click();
  await page.goto('./#/board');
  await expect(page.locator('.sidebar .profile-menu')).toBeVisible();
  await expect(page.locator('.board-heading')).toHaveCount(0);
  const themes = page.getByRole('group', { name: 'Тема оформления' });
  await expect(themes.getByRole('button', { name: 'Включить тёмную тему' })).toHaveAttribute('aria-pressed', 'true');
  await themes.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(themes.getByRole('button', { name: 'Включить светлую тему' })).toHaveAttribute('aria-pressed', 'true');
  const search = page.locator('.board-main').getByRole('searchbox');
  await search.fill('КР-009');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await expect(page.locator('.task-card')).toContainText('КР-009');
  await search.clear();
  const panel = page.locator('.task-drawer');
  await expect(panel.getByRole('button', { name: 'Результат', exact: true })).toBeVisible();
  await expect(panel.getByLabel('Версия результата')).toBeVisible();
  await panel.getByRole('button', { name: 'ТЗ', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Описание', exact: true })).toBeVisible();
  await page.locator('.sidebar .profile-menu summary').click();
  await expect(page.locator('.sidebar .profile-popup')).toBeVisible();
});
