'use client';

import { RequestForm } from './forms';
import { roles, type Profile } from '@/lib/workflow';
import './product.css';

type User = Profile & { active: number };
function Issue({ issue }: { issue?: { error: string } }) {
  return issue ? <p className="form-error" role="alert">{issue.error}</p> : null;
}
function UserFields({ user }: { user?: User }) {
  return <div className="product-form-grid">
    <label className="field">Имя<input name="name" defaultValue={user?.name} required minLength={2} maxLength={80} autoComplete="name" /></label>
    <label className="field">Email<input name="email" type="email" defaultValue={user?.email} required maxLength={254} autoComplete="email" /></label>
    <label className="field">Роль<select name="role" defaultValue={user?.role ?? 'creative'}>{Object.entries(roles).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
    <label className="field">{user ? 'Новый пароль' : 'Пароль'}<input name="password" type="password" required={!user} minLength={8} maxLength={200} autoComplete="new-password" />{user && <small>Оставьте пустым, чтобы сохранить текущий пароль.</small>}</label>
  </div>;
}

export function UserManagement({ person, users }: { person: Profile; users: User[] }) {
  if (person.role !== 'lead') return null;
  return <section className="product-page" aria-label="Управление пользователями">
    <header className="product-heading"><div><h2>Пользователи</h2><p>Участники команды, роли и доступ к сервису.</p></div></header>
    <details className="product-panel product-padding"><summary>Добавить пользователя</summary>
      <RequestForm url="/api/product/member" returnTo="/settings">{({ busy, issue }) => <fieldset disabled={busy}>
        <UserFields /><Issue issue={issue?.field ? issue : undefined} />
        <button className="button primary" type="submit">{busy ? 'Создаём…' : 'Добавить пользователя'}</button>
      </fieldset>}</RequestForm>
    </details>
    <div className="product-card-grid">{users.map(user => <article className="product-panel product-padding" key={user.id}>
      <h3>{user.name}</h3><p>{user.email}</p><p className="product-muted">{roles[user.role]} · {user.active ? 'Доступ открыт' : 'Доступ закрыт'}</p>
      {user.active === 1 && <>
        <details><summary>Изменить пользователя</summary>
          <RequestForm url="/api/users/edit" returnTo="/settings">{({ busy, issue }) => <fieldset disabled={busy}>
            <input name="id" type="hidden" value={user.id} /><UserFields user={user} />
            <Issue issue={issue?.field ? issue : undefined} /><button className="button primary" type="submit">{busy ? 'Сохраняем…' : 'Сохранить'}</button>
          </fieldset>}</RequestForm>
        </details>
        {user.id !== person.id && <RequestForm url="/api/users/deactivate" returnTo="/settings">{({ busy }) => <fieldset disabled={busy}>
          <input name="id" type="hidden" value={user.id} /><p className="product-muted">Удаление закрывает доступ. Задачи, файлы и расходы сохраняются.</p>
          <button className="button secondary" type="submit">{busy ? 'Закрываем доступ…' : 'Удалить пользователя'}</button>
        </fieldset>}</RequestForm>}
      </>}
    </article>)}</div>
  </section>;
}
