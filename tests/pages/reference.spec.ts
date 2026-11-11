import {test,expect} from '@playwright/test';
test('reference reproduction fits its 1600 by 921 canvas and retains exact content',async({page})=>{
 await page.setViewportSize({width:1600,height:921});
 await page.goto('./#/reference');
 await expect(page.locator('.px-column')).toHaveCount(3);
 await expect(page.locator('.px-card')).toHaveCount(7);
 await expect(page.locator('.px-card.selected h3')).toContainText('Forma Studio');
 await expect(page.locator('.px-detail h2')).toHaveText('Forma Studio');
 await expect(page.locator('.px-checks input:checked')).toHaveCount(2);
 const geometry=await page.locator('.px-detail-body').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.client);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1600);
 await page.getByRole('button',{name:'Нравится 👌',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Комментарий',exact:true})).toHaveValue('Нравится 👌');
 await page.getByRole('button',{name:'Отправить',exact:true}).click();
 await expect(page.locator('.px-sent')).toHaveText('Нравится 👌');
 await page.screenshot({path:'test-results/reference-1600x921.png',animations:'disabled'});
});
