import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, name: 'Покупатель' | 'Руководитель') {
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
  await login(page, 'Покупатель');
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

test('version comments notify a real teammate and remain attached to the selected round', async ({ page }) => {
  await login(page, 'Покупатель');
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
  const discussion = page.locator('.task-collaboration > section');
  await discussion.getByLabel('Версия', { exact: true }).selectOption({ label: 'Версия 1' });
  const message = `Уточнить первый раунд ${Date.now()}`;
  await discussion.getByLabel('Комментарий', { exact: true }).fill(message);
  await discussion.getByText('Упомянуть участника', { exact: false }).click();
  await discussion.getByLabel('Саша Миронов', { exact: true }).check();
  await discussion.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(discussion.locator('.comment-entry').filter({ hasText: message })).toContainText('v1');
  await page.reload();
  await expect(discussion.locator('.comment-entry').filter({ hasText: message })).toContainText('Анна Волкова');
  await discussion.getByLabel('Версия', { exact: true }).selectOption({ label: 'Версия 2' });
  await expect(discussion.locator('.comment-entry').filter({ hasText: message })).toHaveCount(0);
  await discussion.getByLabel('Версия', { exact: true }).selectOption({ label: 'Версия 1' });
  await expect(discussion.locator('.comment-entry').filter({ hasText: message })).toBeVisible();
  await switchRole(page, 'Саша Миронов');
  await route(page, 'notifications');
  const notice = page.locator('.notice-row').filter({ hasText: message });
  await expect(notice).toHaveClass(/unread/);
  await expect(notice.getByRole('link', { name: 'Открыть задачу #14' })).toBeVisible();
  await notice.getByRole('button', { name: 'Прочитано', exact: true }).click();
  await expect(notice).not.toHaveClass(/unread/);
  await page.reload();
  await expect(notice).not.toHaveClass(/unread/);
  await expect(notice.getByRole('button', { name: 'Прочитано', exact: true })).toHaveCount(0);
});

test('lead assigns an actual task and creates a teammate who can sign in', async ({ page }) => {
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
  await route(page, 'team');
  const person = `Тест Участник ${Date.now()}`;
  const email = `member-${Date.now()}@example.test`;
  await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
  await page.getByLabel('Имя', { exact: true }).fill(person);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Роль', { exact: true }).selectOption('creative');
  await page.getByLabel('Пароль', { exact: true }).fill('ProductTest2026!');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  const row = page.locator('.team-member').filter({ hasText: email });
  await expect(row).toContainText(person);
  await expect(row).toContainText('Креативщик');
  await page.reload();
  await expect(row).toBeVisible();
  await page.locator('.profile-menu summary').click();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const loginDialog = page.getByRole('dialog', { name: 'Вход в AdCrew' });
  await loginDialog.getByLabel('Эл. почта', { exact: true }).fill(email);
  await loginDialog.getByLabel('Пароль', { exact: true }).fill('ProductTest2026!');
  await loginDialog.getByRole('button', { name: 'Войти в аккаунт', exact: true }).click();
  await expect(page.getByLabel(`Учётная запись: ${person}, Креативщик`)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`Учётная запись: ${person}, Креативщик`)).toBeVisible();
});

test('AI tariff converts real credits to rubles and budget persists', async ({ page }) => {
  await login(page, 'Руководитель');
  await route(page, 'ai-expenses');
  const serviceRow = page.locator('.product-table').getByRole('row').filter({ has: page.getByRole('cell', { name: 'Runway', exact: true }) });
  const rawCredits = await serviceRow.getByRole('cell').nth(1).innerText();
  const credits = Number(rawCredits.replace(/\s/g, '').replace(',', '.'));
  expect(credits).toBeGreaterThan(0);
  await expect(serviceRow).toContainText('Неизвестно');
  await page.getByLabel('Сервис', { exact: true }).selectOption('Runway');
  await page.getByLabel('₽ за кредит', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Сохранить тариф', exact: true }).click();
  const cost = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(credits * 2);
  await expect(serviceRow.getByRole('cell').nth(3)).toHaveText(cost);
  await page.getByLabel('Сумма, ₽', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Сохранить бюджет', exact: true }).click();
  await expect(page.locator('.product-stats article').nth(1).locator('strong')).toHaveText('500,00 ₽');
  await page.reload();
  await expect(page.getByLabel('Сумма, ₽', { exact: true })).toHaveValue('500');
  await expect(serviceRow.getByRole('cell').nth(3)).toHaveText(cost);
  await expect(page.locator('.product-stats article').first().locator('strong')).toHaveText(cost);
});
