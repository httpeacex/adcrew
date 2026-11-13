import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, name: 'Заказчик' | 'Руководитель') {
  await page.goto('./');
  await page.getByRole('button', { name: 'Тестовый вход', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.locator('.profile-menu')).toBeVisible();
}
async function switchRole(page: Page, name: string) {
  await page.locator('.profile-menu summary').click();
  await page.locator('.profile-menu').getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByLabel(new RegExp(`Учётная запись: ${name}`))).toBeVisible();
}
async function route(page: Page, path: string) {
  await page.goto(`./#/${path}`);
  await expect(page).toHaveURL(new RegExp(`#/${path.replace(/[?]/g, '\\?')}`));
}

test('buyer saves a reusable brief, duplicates it, and checks acceptance persistently', async ({ page }) => {
  await login(page, 'Заказчик');
  await route(page, 'tasks/1');
  const template = `Запуск ${Date.now()}`;
  const taskTitle = await page.locator('.detail-title h1').innerText();
  await page.getByLabel('Название шаблона').fill(template);
  await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить шаблон', exact: true })).toBeEnabled();
  await route(page, 'templates');
  const card = page.locator('.template-card').filter({ has: page.getByRole('heading', { name: template, exact: true }) });
  await expect(card).toBeVisible();
  await page.reload();
  await card.getByRole('link', { name: 'Использовать' }).click();
  await expect(page).toHaveURL(/#\/tasks\/new\?template=\d+/);
  await expect(page.getByLabel('Оффер', { exact: true })).toHaveValue(taskTitle);
  await expect(page.getByLabel('Описание')).not.toHaveValue('');
  await expect(page.getByLabel('Дедлайн')).toHaveValue('');
  await route(page, 'tasks/1');
  const check = page.getByRole('button', { name: 'Соответствует брифу', exact: true });
  await expect(check).toHaveAttribute('aria-pressed', 'false');
  await check.click();
  await expect(check).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(check).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Дублировать задачу' }).click();
  await expect(page).toHaveURL(/#\/tasks\/new\?source=1/);
  await expect(page.getByLabel('Оффер', { exact: true })).toHaveValue(taskTitle);
  await expect(page.getByLabel('Дедлайн')).toHaveValue('');
});

test('versions retain files and revision remarks without a general discussion composer', async ({ page }) => {
  await login(page, 'Заказчик');
  await route(page, 'tasks/14');
  const comparison = page.getByRole('region', { name: 'Сравнение версий' });
  await expect(comparison).toBeVisible();
  const first = comparison.getByLabel('Первая версия', { exact: true });
  const second = comparison.getByLabel('Вторая версия', { exact: true });
  expect(await first.inputValue()).not.toBe(await second.inputValue());
  await expect(comparison.locator('.comparison-version')).toHaveCount(2);
  for (const side of await comparison.locator('.comparison-version').all()) await expect(side.locator('figure')).not.toHaveCount(0);
  await first.selectOption(await second.inputValue());
  await expect(first).toHaveValue(await second.inputValue());
  await expect(page.locator('.submission')).toHaveCount(2);
  const firstVersion = page.locator('.submission').filter({ has: page.getByRole('heading', { name: 'Версия 1', exact: true }) });
  const remarks = 'Сократить первый экран и оставить один призыв к действию. Поднять контраст текста.';
  await expect(firstVersion.locator('.revision-note')).toContainText(remarks);
  await expect(firstVersion.getByRole('link', { name: /^Скачать / }).first()).toBeVisible();
  await expect(page.getByLabel('Комментарий', { exact: true })).toHaveCount(0);
  await expect(page.locator('.mention-picker, .comment-compose')).toHaveCount(0);
  await page.reload();
  await expect(firstVersion.locator('.revision-note')).toContainText(remarks);
  await expect(page.locator('.submission')).toHaveCount(2);
});

test('lead assigns an actual task and manages user access in Settings', async ({ page }) => {
  await login(page, 'Руководитель');
  await route(page, 'tasks/1');
  await page.getByLabel('Креативщик', { exact: true }).selectOption({ label: 'Лера Ким' });
  await page.getByRole('button', { name: 'Назначить', exact: true }).click();
  await expect(page.locator('.detail-title .status-pill')).toHaveText('В работе');
  await page.reload();
  await expect(page.getByLabel('Креативщик', { exact: true })).toHaveValue('3');
  await switchRole(page, 'Лера Ким');
  await route(page, 'tasks/1');
  await expect(page.getByRole('button', { name: 'Сдать результат', exact: true })).toBeVisible();
  await switchRole(page, 'Саша Миронов');
  await route(page, 'settings');
  const users = page.getByRole('region', { name: 'Управление пользователями' });
  await users.locator('summary').filter({ hasText: 'Добавить пользователя' }).click();
  const create = users.locator('form').filter({ has: page.getByRole('button', { name: 'Добавить пользователя', exact: true }) });
  const person = `Тест Участник ${Date.now()}`;
  const email = `member-${Date.now()}@example.test`;
  const updated = `${person} Новый`;
  await create.getByLabel('Имя', { exact: true }).fill(person);
  await create.getByLabel('Email', { exact: true }).fill(email);
  await create.getByRole('combobox', { name: /^Роль/ }).selectOption('creative');
  await create.getByLabel('Пароль', { exact: true }).fill('ProductTest2026!');
  await create.getByRole('button', { name: 'Добавить пользователя', exact: true }).click();
  const user = users.locator('article').filter({ has: page.getByRole('heading', { name: person, exact: true }) });
  await expect(user).toContainText(email);
  await user.locator('summary').filter({ hasText: 'Изменить пользователя' }).click();
  await user.getByLabel('Имя', { exact: true }).fill(updated);
  await user.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const edited = users.locator('article').filter({ has: page.getByRole('heading', { name: updated, exact: true }) });
  await expect(edited).toContainText(email);
  await page.reload();
  await expect(edited).toContainText('Доступ открыт');
  await page.locator('.profile-menu summary').click();
  await page.locator('.side-nav').getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const loginDialog = page.getByRole('dialog', { name: 'Вход в AdCrew' });
  await loginDialog.getByLabel('Эл. почта', { exact: true }).fill(email);
  await loginDialog.getByLabel('Пароль', { exact: true }).fill('ProductTest2026!');
  await loginDialog.getByRole('button', { name: 'Войти в аккаунт', exact: true }).click();
  await expect(page.getByLabel(`Учётная запись: ${updated}, Креативщик`)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`Учётная запись: ${updated}, Креативщик`)).toBeVisible();
  await switchRole(page, 'Саша Миронов');
  await route(page, 'settings');
  await edited.getByRole('button', { name: 'Удалить пользователя', exact: true }).click();
  await expect(edited).toContainText('Доступ закрыт');
  await page.reload();
  await expect(edited).toContainText('Доступ закрыт');
  await expect(edited.getByRole('button', { name: 'Удалить пользователя', exact: true })).toHaveCount(0);
});

test('library includes submitted versions and creatives can read every buyer while buyers see their own', async ({ page }) => {
  await login(page, 'Заказчик');
  await route(page, 'library');
  await expect(page.locator('.library-result')).toHaveCount(5);
  await expect(page.locator('.library-result[href*="task=9"]')).toBeVisible();
  await expect(page.locator('.library-result[href*="task=12"]')).toBeVisible();
  await expect(page.locator('.library-result[href*="task=10"]')).toHaveCount(0);
  await switchRole(page, 'Лера Ким');
  await route(page, 'library');
  await expect(page.locator('.library-result')).toHaveCount(9);
  await page.locator('.library-result[href*="task=13"]').click();
  await expect(page).toHaveURL(/#\/library\?task=13$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const panel = dialog.locator('.task-drawer');
  await expect(panel.locator('.drawer-scroll')).toHaveCSS('scrollbar-width', 'thin');
  await expect(panel.locator('.drawer-scroll')).toHaveCSS('scrollbar-color', /rgba\(0, 0, 0, 0\)/);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Сдать результат', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Содержимое', exact: true }).click();
  await expect(panel.getByLabel('Версия результата')).toBeVisible();
  await expect(panel.locator('.revision-note')).toContainText('Поднять контраст текста.');
  await expect(panel.getByRole('link', { name: /^Скачать / }).first()).toBeVisible();
  const centered = await dialog.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { square: Math.abs(width - height) < 1, centered: Math.abs(x * 2 + width - innerWidth) < 2 && Math.abs(y * 2 + height - innerHeight) < 2 };
  });
  expect(centered).toEqual({ square: true, centered: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await dialog.boundingBox())!.width).toBeLessThan(390);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/library$/);
});
