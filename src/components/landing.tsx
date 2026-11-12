'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { X } from 'lucide-react';
import { DemoLogin, LoginCredentials } from './login-controls';
import { ThemeToggle } from './theme';
import './landing.css';

const artwork = [
  ['Мода в терракотовых тонах', '1% 27%, 2% 25%, 16% 16%, 19% 86%, 6% 94%, 4.8% 94%, 4.4% 92%'],
  ['Сиреневые кроссовки', '15.6% 14%, 16.4% 12.5%, 28.5% 6.5%, 29% 8%, 30.6% 81%, 19% 87%'],
  ['Спортивная кампания', '28.1% 13%, 28.6% 10%, 42% 5.5%, 42% 77.5%, 31% 81%, 30.1% 79.5%'],
  ['Реклама лимонада', '41.5% 5%, 42.4% 1.8%, 56.7% 1.8%, 57.8% 4%, 56% 78.8%, 42.3% 79%, 41.7% 76%'],
  ['Косметика на персиковом фоне', '57% 6%, 58% 3.8%, 71.3% 8.7%, 72% 11%, 69% 84%, 55.2% 78.5%, 54.8% 76%'],
  ['Красный печатный портрет', '71.2% 10%, 72% 8.8%, 84.5% 14.6%, 85% 16.5%, 81% 88.7%, 69.1% 83.8%, 68.6% 82%'],
  ['Мода в зелёных тонах', '84.8% 17%, 98.5% 26.7%, 99.3% 29.2%, 95.2% 96.6%, 94.4% 97.8%, 80.9% 88.1%'],
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
