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
