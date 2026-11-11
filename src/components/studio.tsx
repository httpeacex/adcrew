'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Download, ImagePlus, RotateCcw, Sparkles } from 'lucide-react';
import type { Task } from '@/lib/workflow';

export function Studio({ task }: { task?: Task }) {
  const [prompt, setPrompt] = useState(task?.description ?? '');
  const [headline, setHeadline] = useState(task?.offer ?? '');
  const [format, setFormat] = useState('9:16');
  const [size, setSize] = useState(72);
  const [background, setBackground] = useState('');
  const [alignment, setAlignment] = useState<CanvasTextAlign>('left');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fit, setFit] = useState('cover');
  const [notice, setNotice] = useState('');
  const [imageReady, setImageReady] = useState(true);
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
        const scale = (fit === 'cover' ? Math.max : Math.min)(width / image.width, height / image.height);
        ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2, image.width * scale, image.height * scale);
      }
      ctx.font = '700 ' + size + 'px system-ui';
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColor;
      ctx.textAlign = alignment;
      const x = alignment === 'center' ? width / 2 : alignment === 'right' ? width - 44 : 44;
      const lines: string[] = [];
      for (const paragraph of headline.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
          const candidate = line ? line + ' ' + word : word;
          if (line && ctx.measureText(candidate).width > width - 88) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        }
        lines.push(line);
      }
      lines.forEach((line, index) => ctx.fillText(line, x, 48 + index * size * 1.18, width - 88));
    };
    draw();
    if (background) {
      const image = new Image();
      image.onload = () => { if (!cancelled) { draw(image); setImageReady(true); } };
      image.onerror = () => { if (!cancelled) setNotice('Изображение не открылось. Выберите другой файл.'); };
      image.src = background;
    }
    return () => { cancelled = true; };
  }, [alignment, background, fit, format, headline, size, textColor]);

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
      <button type="button" className="button primary" onClick={download} disabled={!imageReady}><Download size={16} />Скачать PNG</button>
    </header>
    <div className="studio-grid">
      <section className="studio-panel"><h2>Запрос для ИИ</h2><label className="field">{task ? 'Запрос на основе брифа' : 'Запрос для генерации'}<textarea rows={8} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Опиши, что создать…" /></label><p className="muted">Генерация станет доступна после подключения ИИ-провайдера.</p><button className="button secondary" type="button" disabled={!prompt.trim()} onClick={async () => {
        try { await navigator.clipboard.writeText(prompt); setNotice('Запрос скопирован'); }
        catch { setNotice('Не удалось скопировать запрос. Выделите текст и скопируйте вручную.'); }
      }}><Copy size={15} />Копировать запрос</button></section>
      <section className="studio-panel studio-editor"><header><h2>Редактор</h2><label className="studio-upload"><ImagePlus size={16} />Загрузить изображение<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { setImageReady(false); setNotice(''); setBackground(URL.createObjectURL(file)); }
        event.currentTarget.value = ''; }} /></label></header><div className="studio-canvas"><canvas ref={canvas} width={format === '16:9' ? 1920 : 1080} height={format === '9:16' ? 1920 : 1080} aria-label="Превью креатива" /></div></section>
      <section className="studio-panel"><h2>Настройки креатива</h2><label className="field">Заголовок<textarea rows={2} value={headline} maxLength={180} onChange={event => setHeadline(event.target.value)} /></label><label className="field">Размер текста <input type="range" min="30" max="160" value={size} onChange={event => setSize(Number(event.target.value))} /></label><label className="field">Формат<select value={format} onChange={event => setFormat(event.target.value)}><option>9:16</option><option>1:1</option><option>16:9</option></select></label><label className="field">Выравнивание<select value={alignment} onChange={event => setAlignment(event.target.value as CanvasTextAlign)}><option value="left">По левому краю</option><option value="center">По центру</option><option value="right">По правому краю</option></select></label>
      <div className="studio-settings-row"><label className="field">Цвет текста<input type="color" value={textColor} onChange={event => setTextColor(event.target.value)} /></label>{background && <label className="field">Фото<select value={fit} onChange={event => setFit(event.target.value)}><option value="cover">Заполнить</option><option value="contain">Целиком</option></select></label>}</div>
      {background && <button type="button" className="button secondary" onClick={() => { setBackground(''); setImageReady(true); setNotice(''); }}><RotateCcw size={14} />Убрать изображение</button>}
      <div className="studio-assistant"><h2><Sparkles size={16} />Быстрые правки</h2><button type="button" className="button secondary" onClick={() => setSize(value => Math.min(160, Math.round(value * 1.15)))}>Увеличить заголовок на 15%</button></div></section>
    </div>
    {notice && <p className="studio-notice" role="status">{notice}</p>}
  </div>;
}
