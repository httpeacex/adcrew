import { actionsFor, type Actor, type Task, type Status, type Action } from './workflow.ts';
export function boardDropAction(actor: Actor, task: Pick<Task,'status'|'buyerId'|'creativeId'>, target: Status): Action | null {
  const transitions: Partial<Record<Status,Action>> = {progress:'claim',review:'submit',revision:'revise',done:'accept',new:'release'};
  const action=transitions[target];
  return action && task.status!==target && actionsFor(actor,task).includes(action) ? action : null;
}
