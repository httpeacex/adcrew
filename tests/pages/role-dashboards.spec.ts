import { test, expect } from '@playwright/test';
test('buyer sees adapted navigation, own dashboard, five board columns and accepted library',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');
 await page.getByRole('button',{name:'Тестовый вход',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:/Заказчик/}).click();
 await page.waitForURL('**/#/board');
 await page.goto('./#/dashboard');
 await expect(page.locator('.reference-dashboard')).toHaveAttribute('data-role','buyer');
 await page.screenshot({path:'test-results/adcrew-buyer-dashboard.png',fullPage:true});
 await expect(page.getByRole('heading',{name:'Ждут вашей проверки',exact:true})).toBeVisible();
 await expect(page.locator('.side-nav > .side-group > a, .side-nav > .side-group > .side-unavailable')).toHaveCount(6);
 await page.locator('.reference-stat').filter({hasText:'Ждут проверки'}).click();
 await expect(page.locator('.task-card')).toHaveCount(2);
 await page.locator('.task-card').first().click();
 await expect(page).toHaveURL(/status=review/);
 await page.getByRole('link',{name:'Закрыть карточку',exact:true}).click();
 await expect(page.locator('.task-card')).toHaveCount(2);
 await page.goto('./#/board?task=none');
 await expect(page.locator('.column-head h3')).toHaveText(['Новые','В работе','Правки','На проверке','Готово']);
 await page.getByRole('link',{name:'Библиотека',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Библиотека',exact:true})).toBeVisible();
 expect(await page.locator('.library-result').count()).toBeGreaterThan(2);
 await page.getByRole('searchbox',{name:'Поиск креативов'}).fill('нет такого креатива');
 await expect(page.locator('.library-result')).toHaveCount(0);
 await page.getByRole('searchbox',{name:'Поиск креативов'}).clear();
 await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.workspace-body > .reference-topbar .profile-menu summary')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const [role,label] of [['creative','Креативщик'],['lead','Руководитель']] as const) {
 test(`${role} dashboard has role-specific metrics and no page overflow`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');
  await page.getByRole('button',{name:'Тестовый вход',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:new RegExp(label)}).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.locator('.task-drawer')).toHaveCount(0);
  await expect(page.locator('.reference-dashboard')).toHaveAttribute('data-role',role);
  await expect(page.locator('.reference-stat')).toHaveCount(role==='creative'?5:4);
  await expect(page.getByRole('heading',{name:role==='creative'?'Свободные задачи':'Загрузка креативщиков',exact:true})).toBeVisible();
  if(role==='lead') await expect(page.locator('.dashboard-spend-row section')).toHaveCount(3);
  await page.screenshot({path:`test-results/adcrew-${role}-dashboard.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.workspace-body > .reference-topbar .profile-menu summary')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:`test-results/adcrew-${role}-mobile.png`,fullPage:true});
 });
}
