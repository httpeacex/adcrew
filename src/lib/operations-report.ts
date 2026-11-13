import type { Store } from './store.ts';
import { intervals, localDay, type Task } from './workflow.ts';
export type RevisionEvent = {taskId:number;action:string;at:number};
export function operationsSummary(tasks:Task[],events:RevisionEvent[],from:number,to:number,now:number){
 const completed=tasks.filter(t=>t.status==='done'&&t.completedAt!==null&&t.completedAt>=from&&t.completedAt<to);
 const revisions=events.filter(e=>e.action==='revise'&&e.at>=from&&e.at<to&&tasks.some(t=>t.id===e.taskId));
 const revised=new Set(events.filter(e=>e.action==='revise').map(e=>e.taskId));
 const times=completed.filter(t=>t.claimedAt!==null).map(t=>t.completedAt!-t.claimedAt!);
 const overdue=tasks.filter(t=>(t.completedAt??now)>t.deadline&&t.deadline>=from&&t.deadline<to);
 const days: {day:string;created:number;completed:number}[]=[];
 for(let d=from;d<to;d+=86400000){const day=localDay(d);days.push({day,created:tasks.filter(t=>localDay(t.createdAt)===day).length,completed:completed.filter(t=>localDay(t.completedAt!)===day).length});}
 return {created:tasks.filter(t=>t.createdAt>=from&&t.createdAt<to).length,completed:completed.length,averageElapsed:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,revisions:revisions.length,revisionPercent:completed.length?completed.filter(t=>revised.has(t.id)).length/completed.length*100:null,overdue,days};
}

export function withTaskTimes(store:Store,actor:{id:number;role:ProfileRole},tasks:Task[],now:number):Task[]{
 return tasks.map(task=>{const detail=store.task(actor,task.id);if(!detail)return task;const end=task.completedAt??now;const history=detail.events.filter(e=>e.at<=end);const points=[...history,{toStatus:task.status,at:end}];const timing=intervals(points);let waiting=0;for(let i=1;i<points.length;i++)if(points[i-1].toStatus==='new')waiting+=Math.max(0,points[i].at-points[i-1].at);return {...task,timing:{production:timing.production,review:timing.review,waiting}};});
}
type ProfileRole='buyer'|'creative'|'lead';
