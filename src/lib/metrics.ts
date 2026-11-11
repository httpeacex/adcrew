export function deliveryMetrics(tasks: { deadline: number; completedAt: number; quantity: number; rounds: number }[]) {
  const count = tasks.length;
  return {
    count,
    firstPass: count ? tasks.filter(task => task.rounds === 1).length * 100 / count : null,
    onTime: count ? tasks.filter(task => task.completedAt <= task.deadline).length * 100 / count : null,
    revisions: count ? tasks.reduce((sum, task) => sum + Math.max(0, task.rounds - 1), 0) / count : null,
    materials: tasks.reduce((sum, task) => sum + task.quantity, 0),
  };
}

type ProductionTask = { completedAt: number | null; createdAt: number; deadline: number; quantity: number; rounds: number };

export function productionMetrics(tasks: ProductionTask[], now: number) {
  const week = 7 * 86_400_000;
  const period = (end: number) => tasks.filter((task): task is ProductionTask & { completedAt: number } => task.completedAt !== null && task.completedAt > end - week && task.completedAt <= end);
  const summarize = (items: (ProductionTask & { completedAt: number })[]) => ({
    ...deliveryMetrics(items),
    cycle: items.length ? items.reduce((sum, task) => sum + task.completedAt - task.createdAt, 0) / items.length : null,
  });
  return { current: summarize(period(now)), previous: summarize(period(now - week)),
    trend: Array.from({ length: 7 }, (_, index) => period(now).filter(task => task.completedAt > now - (7 - index) * 86_400_000 && task.completedAt <= now - (6 - index) * 86_400_000).length) };
}
