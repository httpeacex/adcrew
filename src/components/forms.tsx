'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { browserRuntime } from '@/lib/client-runtime';
import { ArrowRight, ArrowUpRight, Check, CircleAlert, LoaderCircle, RotateCcw, UploadCloud } from 'lucide-react';
import { aiServices, fileTypes, formats, priorities, zoneLabel, type Action, type Brief } from '@/lib/workflow';

type FormError = { error: string; field?: string; status?: number };

function postForm(url: string, form: FormData, onProgress: (value: number) => void) {
  const runtime = browserRuntime();
  if (runtime) return runtime.post(url, form, onProgress);
  return new Promise<{ path: string }>((resolve, reject: (error: FormError) => void) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('x-kadr-form', '1');
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total)); };
    request.onload = () => {
      let data: { path?: string; error?: string; field?: string };
      try { data = JSON.parse(request.responseText); } catch { data = {}; }
      if (request.status >= 200 && request.status < 300 && data.path) resolve({ path: data.path });
      else reject({ error: data.error || 'Запрос не выполнен. Попробуйте снова.', field: data.field, status: request.status });
    };
    request.onerror = () => reject({ error: 'Соединение прервалось. Повторите отправку.' });
    request.ontimeout = () => reject({ error: 'Сервер долго отвечает. Повторите отправку.' });
    request.timeout = 180_000;
    request.send(form);
  });
}

export function RequestForm({ url, children, className, progress, returnTo }: {
  url: string; className?: string; progress?: boolean; returnTo?: string; children: (state: { busy: boolean; issue?: FormError }) => ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [issue, setIssue] = useState<FormError>();
  const key = useRef<string | undefined>(undefined);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const element = event.currentTarget;
    const form = new FormData(element, (event.nativeEvent as SubmitEvent).submitter);
    key.current ??= crypto.randomUUID();
    form.set('requestId', key.current);
    setPercent(0);
    setBusy(true);
    setIssue(undefined);
    try {
      const result = await postForm(url, form, setPercent);
      const path = returnTo ?? result.path;
      const runtime = browserRuntime();
      if (runtime) {
        runtime.navigate(path);
        key.current = undefined;
        submitting.current = false;
        setBusy(false);
        element.reset();
      } else window.location.assign(path);
    }
    catch (error) { setIssue(error as FormError); setBusy(false); submitting.current = false; }
  }
  return <form className={className} onSubmit={submit} onChange={() => { key.current = undefined; setIssue(undefined); }} aria-busy={busy}>
    {children({ busy, issue })}
    {progress && busy && <div className="upload-progress"><progress max="100" value={percent} aria-label="Загрузка файлов" /><span>{percent === 100 ? 'Сохраняем результат…' : `${percent}%`}</span></div>}
    {issue && !issue.field && <div className="form-error" role="alert"><CircleAlert size={17} /><span>{issue.error}{' '}
      {issue.status === 409 && <button type="button" className="inline-action" onClick={() => window.location.reload()}>Обновить</button>}{issue.status === 401 && url !== '/api/session' && <Link href="/login">Войти</Link>}
    </span></div>}
  </form>;
}

export function SessionForm({ children, className }: { children: ReactNode; className?: string }) {
  return <RequestForm url="/api/session" className={className}>{({ busy }) => <fieldset disabled={busy}>{children}</fieldset>}</RequestForm>;
}

function ErrorText({ issue, name }: { issue?: FormError; name: string }) {
  return issue?.field === name ? <span className="field-error" role="alert">{issue.error}</span> : null;
}

export function BriefForm({ initial }: { initial?: Brief } = {}) {
  return <RequestForm url="/api/tasks" className="brief-form">{({ busy, issue }) => <fieldset disabled={busy}>
    <div className="form-grid">
      <label className="field span-two">Оффер<input name="offer" defaultValue={initial?.offer} required minLength={2} maxLength={120} placeholder="Например, Neon Dash" aria-invalid={issue?.field === 'offer'} /><ErrorText issue={issue} name="offer" /></label>
      <label className="field">GEO<input name="geo" defaultValue={initial?.geo} required minLength={2} maxLength={40} placeholder="Например, DE" aria-invalid={issue?.field === 'geo'} /><ErrorText issue={issue} name="geo" /></label>
      <label className="field">Тип креатива<select name="format" defaultValue={initial?.format ?? 'image'}>{Object.entries(formats).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select><ErrorText issue={issue} name="format" /></label>
      <label className="field">Количество<input name="quantity" type="number" required min="1" max="999" defaultValue={initial?.quantity ?? 1} aria-invalid={issue?.field === 'quantity'} /><ErrorText issue={issue} name="quantity" /></label>
      <label className="field">Приоритет<select name="priority" defaultValue={initial?.priority ?? 'normal'}>{Object.entries(priorities).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select><ErrorText issue={issue} name="priority" /></label>
      <label className="field span-two">Дедлайн <small>Часовой пояс команды · {zoneLabel}</small><input name="deadline" type="datetime-local" required aria-invalid={issue?.field === 'deadline'} /><ErrorText issue={issue} name="deadline" /></label>
      <label className="field span-two">Описание<textarea name="description" defaultValue={initial?.description} required minLength={5} maxLength={6000} rows={5} placeholder="Что нужно сделать, какие требования к креативам и как проверить результат" aria-invalid={issue?.field === 'description'} /><ErrorText issue={issue} name="description" /></label>
      <label className="field span-two">Референсы <small>До 10 ссылок, каждая с новой строки</small><textarea name="references" defaultValue={initial?.references.join('\n')} rows={3} placeholder="https://…" aria-invalid={issue?.field === 'references'} /><ErrorText issue={issue} name="references" /></label>
    </div>
    <div className="form-footer"><Link className="button secondary" href="/board">Отмена</Link><button className="button primary" type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowUpRight size={17} />} Опубликовать ТЗ</button></div>
  </fieldset>}</RequestForm>;
}

const buttonText = { claim: 'Взять в работу', submit: 'Сдать результат', revise: 'Отправить на правки', accept: 'Принять работу' } as const;

export function TaskAction({ task, version, action, returnTo, compact = false }: { task: number; version: number; action: Action; returnTo?: string; compact?: boolean }) {
  const [noAi, setNoAi] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [review, setReview] = useState(false);
  if (action === 'revise' && !review) return <button type="button" className={`button secondary${compact ? ' review-revise' : ''}`} onClick={() => setReview(true)}>{compact && <RotateCcw size={15} aria-hidden="true" />}{compact ? 'На правки' : 'Запросить правки'}</button>;
  const compactAccept = compact && action === 'accept';
  return <RequestForm url={`/api/tasks/${task}/${action}`} returnTo={returnTo} className={action === 'submit' ? 'submission-form' : 'action-form'} progress={action === 'submit'}>{({ busy }) => <fieldset disabled={busy}>
    <input type="hidden" name="version" value={version} />
    {action === 'submit' && <>
      <label className="file-drop"><UploadCloud size={22} /><strong>{fileCount ? `Выбрано файлов: ${fileCount}` : 'Прикрепить файлы'}</strong><small>PNG, JPEG, WebP или MP4 · до 5 файлов по 25 МБ</small><input type="file" name="files" multiple required accept={fileTypes.join(',')} onChange={(event) => setFileCount(event.target.files?.length ?? 0)} /></label>
      <div className="expense-head"><h3>Расход AI-кредитов</h3><label className="check"><input type="checkbox" name="noAi" checked={noAi} onChange={(event) => setNoAi(event.target.checked)} /> Без AI</label></div>
      {!noAi && <div className="credit-fields">{aiServices.map((service) => <label className="field" key={service}>{service}<input name={`credit:${service}`} inputMode="decimal" placeholder="—" maxLength={12} /></label>)}</div>}
    </>}
    {action === 'revise' && <label className="field">Что нужно поправить<textarea name="note" autoFocus required maxLength={3000} rows={4} placeholder="Опишите правки к последней версии" /></label>}
    <div className="form-buttons">
      {action === 'revise' && <button type="button" className="button secondary" onClick={() => setReview(false)}>Отмена</button>}
      <button className={`button ${action === 'revise' ? 'secondary' : 'primary'}${compactAccept ? ' review-accept' : ''}`} type="submit">
        {compactAccept ? <>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} aria-hidden="true" />}Принять</> : <>{buttonText[action]} {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}</>}
      </button>
    </div>
  </fieldset>}</RequestForm>;
}
