import { test, expect } from '@playwright/test';

test('production views and quick filters use the same tasks in both themes', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Руководитель/ }).click();
  await page.goto('./#/board?task=none');
  await expect(page.getByRole('region', { name: 'Показатели производства' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Список', exact: true }).click();
  await expect(page.locator('.production-list tbody tr')).toHaveCount(17);
  await page.getByLabel('Формат задач', { exact: true }).selectOption('image');
  const imageCount = await page.locator('.production-list tbody tr').count();
  expect(imageCount).toBeGreaterThan(0);
  expect(imageCount).toBeLessThan(17);
  await page.getByLabel('Формат задач', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Календарь', exact: true }).click();
  await expect(page.locator('.production-calendar')).toBeVisible();
  await page.getByRole('button', { name: 'Загрузка', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Загрузка команды', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Архив', exact: true }).click();
  await expect(page.locator('.production-list tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('board wraps columns without horizontal scrolling at phone tablet and desktop sizes',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'Тестовый вход',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Руководитель/}).click();await page.waitForURL(/#\/board$/);
 for(const task of ['none','9']) {
  await page.goto(`./#/board?task=${task}`);
  for(const width of [320,390,768,1024,1440,1920]) {
   await page.setViewportSize({width,height:1000});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   const size=await page.locator('.kanban').evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.client);
  }
 }
 await expect(page.locator('.board-local-search, .task-card .card-cover')).toHaveCount(0);
 await expect(page.locator('.ref-card-identity .generated-avatar').first()).toBeVisible();
 await page.goto('./#/board?task=none');await page.setViewportSize({width:390,height:844});
 for(const name of ['Список','Календарь','Загрузка','Архив']) {
  await page.getByRole('button',{name,exact:true}).click();
  const scrollbars=await page.locator('.board-main').evaluate(root=>[...root.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+3&&['auto','scroll'].includes(getComputedStyle(e).overflowX)).map(e=>e.className));
  expect(scrollbars).toEqual([]);
 }

});
