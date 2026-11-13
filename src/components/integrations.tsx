'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { IntegrationStatus } from '@/lib/integration-status';
import './integrations.css';

const categories = [
  { id: 'all', label: 'Все интеграции' },
  { id: 'communication', label: 'Коммуникации' },
  { id: 'storage', label: 'Файлы и хранилища' },
] as const;

const services = [
  { id: 'telegram', name: 'Telegram', domain: 'telegram.org', category: 'communication', description: 'Сдача, правки и приёмка в чате команды.', details: 'Бот публикует номер задачи, событие и ссылку на карточку. Для настройки администратор сервера указывает токен бота и ID чата.' },
  { id: 'drive', name: 'Google Drive', domain: 'drive.google.com', category: 'storage', description: 'Копии принятых файлов в папке команды.', details: 'При приёмке сервер копирует файлы последней версии в выбранную папку. Для настройки нужны доступ к папке и авторизация Google Drive.' },
  { id: 'slack', name: 'Slack', domain: 'slack.com', category: 'communication', description: 'Сдача, правки и приёмка в выбранном канале.', details: 'Сообщение содержит номер задачи, событие и ссылку на карточку. Для настройки администратор сервера указывает входящий вебхук выбранного канала.' },
] as const;

export function Integrations({ status }: { status?: IntegrationStatus } = {}) {
  const [category, setCategory] = useState<(typeof categories)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<(typeof services)[number]>(services[0]);
  const dialog = useRef<HTMLDialogElement>(null);
  const term = query.trim().toLocaleLowerCase('ru');
  const visible = services.filter(service => (category === 'all' || service.category === category) &&
    `${service.name} ${service.domain} ${service.description}`.toLocaleLowerCase('ru').includes(term));
  const label = (id: keyof IntegrationStatus) => status ? status[id] ? 'Параметры заданы' : 'Не настроено' : 'Требуется сервер';

  return <section className="integration-catalog" aria-label="Каталог интеграций">
    <div className="integration-toolbar">
      <div className="integration-categories" role="group" aria-label="Категории интеграций">
        {categories.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
      </div>
      <label className="integration-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Поиск интеграций" placeholder="Поиск интеграций" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="integration-grid">
      {visible.map(service => <article key={service.id} className={`integration-node integration-${service.id}`}>
        <div className="integration-card-body">
          <div className="integration-card-heading"><div><h2>{service.name}</h2><span>{service.domain}</span></div><span className={`integration-logo ${service.id}`} aria-hidden="true" /></div>
          <p>{service.description}</p>
        </div>
        <footer><button type="button" className="button secondary" aria-label={`Подробнее о ${service.name}`} onClick={() => { setSelected(service); dialog.current?.showModal(); }}>Подробнее <ArrowUpRight size={13} aria-hidden="true" /></button><span className="integration-status">{label(service.id)}</span></footer>
      </article>)}
    </div>
    {!visible.length && <p className="integration-empty" role="status">Сервисы не найдены. Измените запрос или категорию.</p>}
    <dialog ref={dialog} className="integration-dialog" aria-labelledby="integration-details-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="integration-dialog-body">
        <header><span className={`integration-logo ${selected.id}`} aria-hidden="true" /><h2 id="integration-details-title">{selected.name}</h2><button type="button" aria-label="Закрыть" onClick={() => dialog.current?.close()}><X size={19} /></button></header>
        <span className="integration-status">{label(selected.id)}</span>
        <p>{selected.details}</p>
        {!status && <p>Демо хранит данные в браузере. Интеграции доступны в размещённой серверной версии.</p>}
      </div>
    </dialog>
  </section>;
}
