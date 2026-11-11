import { test, expect } from '@playwright/test';

test('approved workspace keeps account and alerts in sidebar and searches task IDs inside board', async ({ page }) => {
  await page.setViewportSize({ width: 1664, height: 946 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Покупатель/ }).click();
  await page.goto('./#/board');
  await expect(page.locator('.sidebar .profile-menu')).toBeVisible();
  await expect(page.locator('.board-heading .profile-menu')).toHaveCount(0);
  await expect(page.locator('.board-heading a[href*="notifications"]')).toHaveCount(0);
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
