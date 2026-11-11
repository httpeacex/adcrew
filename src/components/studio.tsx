'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ImagePlus, Sparkles } from 'lucide-react';
import type { Task } from '@/lib/workflow';

export function Studio({ task }: { task?: Task }) {
  const [prompt, setPrompt] = useState(task?.description ?? '');
  const [headline, setHeadline] = useState(task?.offer ?? '');
  const [format, setFormat] = useState('9:16');
  const [size, setSize] = useState(72);
  const [background, setBackground] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => () => { if (background) URL.revokeObjectURL(background); }, [background]);

  useEffect(() => {
    const surface = canvas.current;
    const ctx = surface?.getContext('2d');
    if (!surface || !ctx) return;
    let cancelled = false;
    const draw = (image?: HTMLImageElement) => {
      if (cancelled) return;
      const { width, height } = surface;
      ctx.fillStyle = '#25202e';
      ctx.fillRect(0, 0, width, height);
      if (image) {
        const scale = Math.max(width / image.width, height / image.height);
        ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2, image.width * scale, image.height * scale);
      }
      ctx.font = '700 ' + size + 'px system-ui';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.fillText(headline, 44, 48, width - 88);
    };
    draw();
    if (background) {
      const image = new Image();
      image.onload = () => draw(image);
      image.src = background;
    }
    return () => { cancelled = true; };
  }, [background, format, headline, size]);

  function download() {
    canvas.current?.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = task ? 'creative-' + task.id + '.png' : 'creative.png';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  return <div className="studio-page">
    <header className="studio-header">
      <div>{task && <Link className="studio-back" href={'/board?task=' + task.id}><ArrowLeft size={15} />К задаче</Link>}<h1>{task?.offer ?? 'ИИ-студия'}</h1></div>
      <button type="button" className="button primary" onClick={download}><Download size={16} />Скачать PNG</button>
    </header>
    <div className="studio-grid">
      <section className="studio-panel"><h2>Чат</h2><label className="field">{task ? 'Запрос на основе брифа' : 'Запрос для генерации'}<textarea rows={8} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Опиши, что создать…" /></label><p className="muted">Для ответов и генерации изображений потребуется подключить ИИ.</p></section>
      <section className="studio-panel studio-editor"><header><h2>Редактор</h2><label className="studio-upload"><ImagePlus size={16} />Загрузить изображение<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) setBackground(URL.createObjectURL(file)); }} /></label></header><div className="studio-canvas"><canvas ref={canvas} width={format === '16:9' ? 1920 : 1080} height={format === '9:16' ? 1920 : 1080} aria-label="Превью креатива" /></div></section>
      <section className="studio-panel"><h2>Слои</h2><label className="field">Заголовок<input value={headline} maxLength={90} onChange={event => setHeadline(event.target.value)} /></label><label className="field">Размер текста <input type="range" min="30" max="160" value={size} onChange={event => setSize(Number(event.target.value))} /></label><label className="field">Формат<select value={format} onChange={event => setFormat(event.target.value)}><option>9:16</option><option>1:1</option><option>16:9</option></select></label><div className="studio-assistant"><h2><Sparkles size={16} />ИИ-помощник</h2><p className="muted">Быстрые правки</p><button type="button" className="button secondary" onClick={() => setSize(value => Math.min(160, Math.round(value * 1.15)))}>Увеличить заголовок на 15%</button></div></section>
    </div>
  </div>;
}
