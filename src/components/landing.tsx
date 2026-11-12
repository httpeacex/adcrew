'use client';

import Link from 'next/link';
import { useRef, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { DemoLogin, LoginCredentials } from './login-controls';
import { ThemeToggle } from './theme';
import './landing.css';

const artwork = [
  ['Мода в терракотовых тонах', 10.3, 55, -11],
  ['Сиреневые кроссовки', 23.1, 46.5, -9],
  ['Спортивная кампания', 35, 43, -5],
  ['Реклама лимонада', 49, 40.5, 0],
  ['Косметика на персиковом фоне', 63, 43.5, 6],
  ['Красный печатный портрет', 76.8, 48.5, 8],
  ['Мода в зелёных тонах', 90, 57, 11],
] as const;

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
          {artwork.map(([label, x, y, angle], index) => <div key={label} role="img" aria-label={label} className="landing-art" style={{ '--x': x, '--y': y, '--angle': `${angle}deg`, '--index': index } as CSSProperties}>
            <div className="landing-art-face"><div className="landing-art-image" /></div>
          </div>)}
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
