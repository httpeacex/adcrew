import { test, expect } from '@playwright/test';

test('approved workspace keeps account and alerts in the reference topbar without a board search input', async ({ page }) => {
  await page.setViewportSize({ width: 1664, height: 946 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Заказчик/ }).click();
  await page.waitForURL('**/#/board');
  await page.goto('./#/board');
  await expect(page.locator('.workspace-body > .reference-topbar .profile-menu')).toBeVisible();
  const workspace = page.locator('.reference-workspace');
  await expect(workspace).toHaveCSS('background-image', /radial-gradient/);
  const menu = page.getByRole('navigation', { name: 'Рабочее пространство' });
  const sectionTitles = menu.locator('.side-group-title');
  await expect(sectionTitles).toHaveText(['Меню', 'Общее']);
  await expect(sectionTitles.first()).toHaveCSS('font-size', '13px');
  await expect(sectionTitles.last()).toHaveCSS('font-size', '13px');
  const boardMenu = await menu.boundingBox();
  await menu.getByRole('link', { name: 'Дашборд', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Дашборд', exact: true })).toBeVisible();
  expect((await menu.boundingBox())?.y).toBe(boardMenu?.y);
  await menu.getByRole('link', { name: 'Библиотека', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Библиотека', exact: true })).toBeVisible();
  expect((await menu.boundingBox())?.y).toBe(boardMenu?.y);
  const promo = page.locator('.sidebar-promo');
  await expect(promo).toBeVisible();
  await expect.poll(() => promo.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const sidebarBox = (await page.locator('.sidebar').boundingBox())!;
  const promoBox = (await promo.boundingBox())!;
  const generalBox = (await sectionTitles.last().boundingBox())!;
  expect(generalBox.y).toBeGreaterThan(sidebarBox.y + sidebarBox.height / 2);
  expect(promoBox.y).toBeGreaterThan(generalBox.y);
  expect(sidebarBox.y + sidebarBox.height - promoBox.y - promoBox.height).toBeLessThan(25);
  await promo.getByRole('link', { name: 'Открыть задачи' }).click();
  await expect(page).toHaveURL(/#\/board\?task=none$/);
  await page.goto('./#/board');

  await expect(page.locator('.board-heading')).toHaveCount(0);
  const themes = page.getByRole('group', { name: 'Тема оформления' });
  await expect(themes.getByRole('button', { name: 'Включить светлую тему' })).toHaveAttribute('aria-pressed', 'true');
  await themes.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(themes.getByRole('button', { name: 'Включить светлую тему' })).toHaveAttribute('aria-pressed', 'true');
  const lightBackground = await workspace.evaluate(element => getComputedStyle(element).backgroundImage);
  await themes.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(workspace).toHaveCSS('background-image', /radial-gradient/);
  expect(await workspace.evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe(lightBackground);
  const workspaceColors = () => workspace.evaluate(element => ({
    canvas: getComputedStyle(element).background,
    sidebar: getComputedStyle(element.querySelector('.sidebar')!).background,
    logo: getComputedStyle(element.querySelector('.brand-mark')!).background,
    accent: getComputedStyle(element).getPropertyValue('--primary-face'),
  }));
  const boardColors = await workspaceColors();
  await menu.getByRole('link', { name: 'Дашборд', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Дашборд', exact: true })).toBeVisible();
  expect(await workspaceColors()).toEqual(boardColors);
  await page.goto('./#/board');
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

  await page.setViewportSize({ width: 820, height: 640 });
  await expect(promo).toBeHidden();
  await expect(menu.getByRole('link', { name: 'Настройки' })).toBeVisible();
  const rail = await page.locator('.sidebar').evaluate(element => ({
    width: element.clientWidth,
    contentWidth: element.scrollWidth,
  }));
  expect(rail.contentWidth).toBe(rail.width);
});
