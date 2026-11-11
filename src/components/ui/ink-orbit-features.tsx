'use client';

import { useId, useState, type PointerEvent } from 'react';
import { ClipboardList, Files, History, Sparkles } from 'lucide-react';
import { statuses } from '@/lib/workflow';
import styles from './ink-orbit-features.module.css';

const steps = [
  { id: 'new', role: 'Покупатель', description: 'Покупатель создаёт ТЗ. Он указывает оффер, формат, количество креативов и дедлайн.' },
  { id: 'progress', role: 'Креативщик', description: 'Креативщик берёт задачу. В карточке появляются исполнитель и время начала работы.' },
  { id: 'review', role: 'Креативщик и покупатель', description: 'Креативщик прикрепляет файлы и указывает AI-кредиты за эту версию. Покупатель проверяет результат.' },
  { id: 'revision', role: 'Покупатель и креативщик', description: 'Покупатель оставляет комментарий к правкам. Креативщик сдаёт новую версию, а предыдущая остаётся в истории.' },
  { id: 'done', role: 'Покупатель', description: 'Покупатель принимает работу. Задача переходит в «Готово», а время завершения сохраняется в истории.' },
] as const;

const materials = [
  { name: 'Техническое задание', icon: ClipboardList, description: 'Оффер, GEO, формат, количество креативов, референсы и дедлайн собраны в карточке.' },
  { name: 'Версии файлов', icon: Files, description: 'Каждая сдача сохраняется отдельной версией. Покупатель может открыть её файлы и комментарии.' },
  { name: 'AI-кредиты', icon: Sparkles, description: 'Креативщик записывает расход по каждому сервису при сдаче. Руководитель видит сводку в разделе AI-расходов.' },
  { name: 'История', icon: History, description: 'В журнале видны автор, время и действие для каждого перехода задачи.' },
] as const;

const timeline = [
  { label: 'Новые', hours: 0 }, { label: 'В работе', hours: 1 }, { label: 'На проверке', hours: 5 },
  { label: 'Правки', hours: 6 }, { label: 'Повторная проверка', hours: 8 }, { label: 'Готово', hours: 9 },
];

const routes = [
  'M128 46 C169 46 193 82 254 82', 'M128 84 H254', 'M128 122 C169 122 193 84 254 84',
  'M374 82 C422 82 443 66 493 66', 'M374 85 C422 85 443 101 493 101',
];

function chartPaths(values: number[], width: number, height: number, padding: number) {
  const lowest = Math.min(...values);
  const range = Math.max(...values) - lowest || 1;
  const points = values.map((value, index) => [
    padding + index / (values.length - 1) * (width - padding * 2),
    height - padding - (value - lowest) / range * (height - padding * 2),
  ] as const);
  const line = points.map(([x, y], index) => {
    if (index === 0) return `M${x},${y}`;
    const [previousX, previousY] = points[index - 1];
    const middle = (x + previousX) / 2;
    return `C${middle},${previousY} ${middle},${y} ${x},${y}`;
  }).join(' ');
  const area = `${line} L${points.at(-1)![0]},${height - padding} L${points[0][0]},${height - padding} Z`;
  return { points, line, area };
}

const chart = chartPaths(timeline.map(({ hours }) => hours), 320, 126, 14);

function Brackets() {
  return <span className={styles.brackets} aria-hidden="true"><i /><i /><i /><i /></span>;
}

function FlowDiagram({ label, stage }: { label: string; stage: number }) {
  const roles = [{ label: 'Покупатель', key: 'П' }, { label: 'Креативщик', key: 'К' }, { label: 'Руководитель', key: 'Р' }];
  return <svg viewBox="0 0 640 168" className={styles.flowDiagram} aria-hidden="true">
    {routes.map((route, index) => <g key={route}>
      <path d={route} className={styles.flowLine} />
      <path d={route} pathLength={100} className={styles.flowPacket} style={{ animationDelay: `${index * -.6}s` }} />
    </g>)}
    {roles.map(({ label: role, key }, index) => <g key={key} transform={`translate(18, ${32 + index * 38})`}>
      <rect width="110" height="28" rx="7" className={styles.node} />
      <circle cx="14" cy="14" r="7" className={styles.roleMark} />
      <text x="14" y="17" textAnchor="middle" className={styles.roleLetter}>{key}</text>
      <text x="26" y="18" className={styles.svgLabel}>{role}</text>
    </g>)}
    <g transform="translate(254 60)">
      <rect x="-4" y="-4" width="128" height="54" rx="12" className={styles.orbit} />
      <rect width="120" height="46" rx="9" className={styles.node} />
      <path d="M25 12 17 24h7l-1 10 11-14h-8l2-8z" className={styles.lightning} />
      <text x="43" y="28" className={styles.svgBrand}>AdCrew</text>
    </g>
    <g transform="translate(493 33)">
      <rect x="18" y="-12" width="106" height="88" rx="6" className={styles.stackBack} />
      <rect x="9" y="-6" width="106" height="88" rx="6" className={styles.stackBack} />
      <rect width="106" height="88" rx="6" className={styles.node} />
      <text x="10" y="18" className={styles.svgMeta}>ЗАДАЧА · 0{stage + 1}</text>
      <text x="10" y="37" className={styles.svgLabel}>{label}</text>
      <path d="M10 49h62m-62 9h78m-78 9h49" className={styles.sheetLines} />
    </g>
  </svg>;
}

function MaterialDiagram() {
  const [selected, setSelected] = useState(0);
  return <section className={styles.card} aria-labelledby="guide-materials">
    <Brackets />
    <h3 id="guide-materials">Что хранится в задаче</h3>
    <div className={styles.materialGrid}>
      {materials.map(({ name, icon: Icon }, index) => <button type="button" key={name} aria-pressed={selected === index} onClick={() => setSelected(index)}><Icon size={18} />{name}</button>)}
    </div>
    <p className={styles.explanation} aria-live="polite">{materials[selected].description}</p>
  </section>;
}

function TimingChart() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const [x, y] = chart.points[selected];
  const { label, hours } = timeline[selected];
  function scrub(event: PointerEvent<SVGSVGElement>) {
    const transform = event.currentTarget.getScreenCTM();
    if (!transform) return;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse()).x;
    const index = chart.points.reduce((nearest, [point], current) => Math.abs(point - position) < Math.abs(chart.points[nearest][0] - position) ? current : nearest, 0);
    setSelected(index);
  }
  return <section className={styles.card} aria-labelledby="guide-timing">
    <Brackets />
    <div className={styles.cardHeading}><h3 id="guide-timing">Время по этапам</h3><span>Пример</span></div>
    <svg viewBox="0 0 320 126" className={styles.chart} aria-hidden="true" onPointerMove={scrub} onPointerDown={scrub}>
      {[28, 56, 84, 112].map((line) => <path key={line} d={`M14 ${line}H306`} className={styles.gridLine} />)}
      <path d={chart.area} className={styles.chartArea} /><path d={chart.line} className={styles.chartLine} />
      <path d={`M${x} 12V112`} className={styles.chartMarker} /><circle cx={x} cy={y} r="4" className={styles.chartPoint} />
    </svg>
    <div className={styles.chartControl}><label htmlFor={id}>Этап</label><output htmlFor={id}>{label} · {hours} ч</output></div>
    <input id={id} type="range" min="0" max={timeline.length - 1} value={selected} onChange={(event) => setSelected(Number(event.target.value))} aria-valuetext={`${label}, ${hours} ч с момента создания`} className={styles.range} />
    <p className={styles.chartNote}>Время с момента создания примерной задачи.</p>
  </section>;
}

export default function InkOrbitFeatures() {
  const [selected, setSelected] = useState(0);
  const step = steps[selected];
  const label = statuses.find(({ id }) => id === step.id)!.label;
  const heading = useId();
  return <section className={styles.root} aria-labelledby={heading}>
    <div className={styles.head}><h2 id={heading}>От задачи до готового креатива</h2><p>Один рабочий процесс для покупателя, креативщика и руководителя.</p></div>
    <div className={styles.bento}>
      <section className={`${styles.card} ${styles.flowCard}`} aria-labelledby="guide-stages">
        <Brackets />
        <h3 id="guide-stages">Как задача проходит доску</h3>
        <FlowDiagram label={label} stage={selected} />
        <div className={styles.steps} aria-label="Этапы задачи">{steps.map(({ id }, index) => <button type="button" key={id} aria-pressed={selected === index} onClick={() => setSelected(index)}>{statuses.find((status) => status.id === id)!.label}</button>)}</div>
        <div className={styles.explanation} aria-live="polite"><strong>{step.role}</strong><p>{step.description}</p></div>
      </section>
      <MaterialDiagram />
      <TimingChart />
    </div>
  </section>;
}
