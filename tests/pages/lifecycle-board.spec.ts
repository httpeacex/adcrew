import { test, expect } from '@playwright/test';
test('dragging asks for required confirmation and preserves other creatives ownership',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.getByRole('button',{name:'Тестовый вход',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Креативщик/}).click();await page.waitForURL('**/#/board');await page.goto('./#/board?task=none');
 const other=page.locator('.task-card[href$="task=6"]');await expect(other).toHaveAttribute('draggable','false');
 const free=page.locator('.task-card[href$="task=1"]');await expect(free).toHaveAttribute('draggable','true');
 await free.dragTo(page.locator('.column.progress'),{targetPosition:{x:80,y:30}});
 const dialog=page.getByRole('dialog',{name:'Изменение статуса'});await expect(dialog).toBeVisible();await expect(dialog).toContainText('КР-001');await dialog.getByRole('button',{name:/Взять в работу/}).click();
 await expect(page.locator('.column.progress .task-card[href$="task=1"]')).toBeVisible();
 await page.locator('.column.progress .task-card[href$="task=1"]').click();
 await page.getByRole('button',{name:/Отказаться/}).click();
 await expect(page.locator('.column.new .task-card[href$="task=1"]')).toBeVisible();
});
