import Link from 'next/link';

export default function NotFound() {
  return <main className="not-found"><p className="section-label">404</p><h1>Страница недоступна</h1><p>Проверьте ссылку или вернитесь к своим задачам.</p><Link className="button primary" href="/board">К доске задач</Link></main>;
}
