'use client';

import { useEffect, useState } from 'react';
import { measuredTime } from '@/lib/work-calendar';
import { duration, type Task } from '@/lib/workflow';

export function useLiveNow(sample: number, active = true) {
  const [now, setNow] = useState(sample);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return Math.max(now, sample);
}

function isRunning(status: Task['status'], key: 'waiting' | 'production' | 'review') {
  if (key === 'waiting') return status === 'new';
  if (key === 'review') return status === 'review';
  return status === 'progress' || status === 'revision';
}

export function taskTime(task: Task, key: 'waiting' | 'production' | 'review', now: number, fallback = 0) {
  const timing = task.timing;
  if (!timing) return fallback;
  const running = isRunning(task.status, key);
  return timing[key] + (running && timing.sampledAt !== undefined ? measuredTime(timing.sampledAt, now, timing.calendar) : 0);
}

export function LiveTaskTime({ task, kind, sample, fallback = 0 }: { task: Task; kind: 'waiting' | 'production' | 'review'; sample: number; fallback?: number }) {
  const now = useLiveNow(sample, isRunning(task.status, kind));
  return <>{duration(taskTime(task, kind, now, fallback))}</>;
}
