import { test, expect } from '@playwright/test';

test('approved workspace keeps account and alerts in the reference topbar without a board search input', async ({ page }) => {
  await page.setViewportSize({ width: 1664, height: 946 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Заказчик/ }).click();
  await page.waitForURL('**/#/board');
  await page.goto('./#/board');
  await expect(page.locator('.workspace-body > .reference-topbar .profile-menu')).toBeVisible();
  await expect(page.locator('.board-heading')).toHaveCount(0);
  const themes = page.getByRole('group', { name: 'Тема оформления' });
  await expect(themes.getByRole('button', { name: 'Включить светлую тему' })).toHaveAttribute('aria-pressed', 'true');
  await themes.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(themes.getByRole('button', { name: 'Включить светлую тему' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.board-local-search')).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  const panel = page.locator('.task-drawer');
  await panel.getByRole('button', { name: 'Содержимое', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Содержимое', exact: true })).toBeVisible();
  await expect(panel.getByLabel('Версия результата')).toBeVisible();
  await panel.getByRole('button', { name: 'Детали', exact: true }).click();
  await panel.locator('.drawer-description summary').click();
  await expect(panel.getByRole('heading', { name: 'Описание', exact: true })).toBeVisible();
  await page.locator('.workspace-body > .reference-topbar .profile-menu summary').click();
  await expect(page.locator('.workspace-body > .reference-topbar .profile-popup')).toBeVisible();
});
