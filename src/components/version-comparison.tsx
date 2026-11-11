'use client';

import { useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { fileHref } from '@/lib/client-runtime';
import { formatDate, type Submission } from '@/lib/workflow';

export function VersionComparison({ submissions }: { submissions: Submission[] }) {
  const [left, setLeft] = useState(submissions[1]?.id);
  const [right, setRight] = useState(submissions[0]?.id);
  if (submissions.length < 2) return null;
  return <section className="panel version-comparison" aria-label="Сравнение версий">
    <div className="panel-title"><GitCompareArrows size={19} /><h2>Сравнение версий</h2></div>
    <p className="muted">Выберите два раунда сдачи. Файлы и замечания остаются привязаны к своей версии.</p>
    <div className="comparison-grid">{[{ value: left, set: setLeft, label: 'Первая версия' }, { value: right, set: setRight, label: 'Вторая версия' }].map(({ value, set, label }) => {
      const submission = submissions.find(item => item.id === value) ?? submissions[0];
      return <div key={label} className="comparison-version">
        <label className="field">{label}<select aria-label={label} value={submission.id} onChange={event => set(Number(event.target.value))}>
          {submissions.map(item => <option key={item.id} value={item.id}>Версия {item.round} · {formatDate(item.submittedAt)}</option>)}
        </select></label>
        <div className="comparison-files">{submission.files.map(file => <figure key={file.id}>
          {file.type.startsWith('image/')
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={fileHref(file.id, true)} alt={`Версия ${submission.round}: ${file.name}`} loading="lazy" />
            : <video src={fileHref(file.id, true)} controls preload="none" aria-label={`Версия ${submission.round}: ${file.name}`} />}
          <figcaption><a href={fileHref(file.id)} download={file.name}>{file.name}</a></figcaption>
        </figure>)}</div>
        {submission.reviewNote && <div className="revision-note"><strong>Замечания к версии</strong><p>{submission.reviewNote}</p></div>}
      </div>;
    })}</div>
  </section>;
}
