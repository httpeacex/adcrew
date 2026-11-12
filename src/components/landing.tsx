'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { X } from 'lucide-react';
import { DemoLogin, LoginCredentials } from './login-controls';
import { ThemeToggle } from './theme';
import './landing.css';

const artwork = [
  ['Мода в терракотовых тонах', '0% 24%, 16% 12%, 20% 89%, 4% 98%'],
  ['Сиреневые кроссовки', '15% 12%, 29% 4%, 31% 83%, 19% 90%'],
  ['Спортивная кампания', '28% 8%, 42% 4%, 42% 79%, 30% 84%'],
  ['Реклама лимонада', '41% 0%, 58% 0%, 56% 79%, 42% 80%'],
  ['Косметика на персиковом фоне', '57% 3%, 72% 7%, 69% 85%, 55% 79%'],
  ['Красный печатный портрет', '71% 8%, 86% 14%, 82% 91%, 69% 85%'],
  ['Мода в зелёных тонах', '85% 16%, 100% 24%, 95% 100%, 81% 91%'],
];

export function Landing({ demo, signedIn = false }: { demo: boolean; signedIn?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <main className="landing">
    <div className="landing-frame">
      <header className="landing-nav">
        <a className="landing-brand" href="#adcrew-home"><i aria-hidden="true" />AdCrew</a>
        {signedIn ? <Link href="/board">К рабочему пространству</Link> : <button type="button" onClick={() => dialog.current?.showModal()}>Войти</button>}
      </header>
      <section className="landing-hero" id="adcrew-home" aria-labelledby="landing-title">
        <h1 id="landing-title">Рекламные креативы<br />от ТЗ до запуска</h1>
        <div className="landing-gallery" aria-label="Примеры рекламных креативов">
          {artwork.map(([label, shape]) => <div key={label} role="img" aria-label={label} className="landing-art" style={{ clipPath: `polygon(${shape})` }} />)}
        </div>
        <p>Управление задачами и согласованием креативов.</p>
        <div className="landing-actions">
          {signedIn ? <Link className="landing-cta" href="/board">Открыть доску</Link> : <button className="landing-cta" type="button" onClick={() => dialog.current?.showModal()}>Открыть доску</button>}
          {demo && !signedIn && <div className="landing-demo"><DemoLogin /></div>}
        </div>
      </section>
      <div className="landing-theme"><ThemeToggle /></div>
    </div>
    {!signedIn && <dialog ref={dialog} className="landing-login" aria-labelledby="landing-login-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="landing-login-content">
        <header><h2 id="landing-login-title">Вход в AdCrew</h2><button type="button" aria-label="Закрыть окно входа" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        <LoginCredentials />
        {demo && <DemoLogin />}
      </div>
    </dialog>}
  </main>;
}
