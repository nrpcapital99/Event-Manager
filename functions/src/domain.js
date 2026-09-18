export class DomainError extends Error { constructor(message,code='invalid-argument'){super(message);this.code=code;} }
export function requireAdmin(member){if(member.role!=='admin')throw new DomainError('Only admins can perform this action.','permission-denied');}
export function text(value,label,max=500,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new DomainError(`${label} is required and must be under ${max} characters.`);return value.trim();}
export function date(value,label){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new DomainError(`${label} must be a valid date.`);return value;}
export function choice(value,values,label){if(!values.includes(value))throw new DomainError(`Invalid ${label}.`);return value;}
export function overall(ids,progress){if(!ids.length)return 'To do';const statuses=ids.map(id=>progress[id]?.status||'To do');return statuses.every(s=>s==='Complete')?'Complete':statuses.includes('Blocked')?'Blocked':statuses.some(s=>s==='In progress'||s==='Complete')?'In progress':'To do';}
export function taskDraft(input,member,existing,people,at){
 if(existing)requireAdmin(member);
 const kind=choice(input.kind,['office','event','responsibility'],'task type');
 const ids=[...new Set(input.assigneeIds)];
 if(!ids.length||ids.length>30||ids.some(id=>typeof id!=='string'||!people[id]?.active))throw new DomainError('Assign 1–30 active team members.');
 if(member.role!=='admin'&&(kind!=='office'||ids.length!==1||ids[0]!==member.id))throw new DomainError('You can only create office tasks for yourself.','permission-denied');
 if(existing?.status==='Complete'&&(existing.assigneeIds.length!==ids.length||existing.assigneeIds.some(id=>!ids.includes(id))))throw new DomainError('Completed task assignments cannot be changed.');
 const start=date(input.start,'Start date'), deadline=date(input.deadline,'Deadline');if(start>deadline)throw new DomainError('Deadline must be on or after the start date.');
 const progress=Object.fromEntries(ids.map(id=>[id,existing?.progress[id]||{status:'To do',updatedAt:at,completedAt:null}]));
 return {title:text(input.title,'Task title',160),description:text(input.description||'','Description',5000,false),kind,eventId:kind==='office'?'':text(input.eventId,'Event',128),start,deadline,originalDeadline:existing?.originalDeadline||deadline,priority:choice(input.priority,['Low','Medium','High'],'priority'),assigneeIds:ids,assigneeNames:Object.fromEntries(ids.map(id=>[id,people[id].name])),progress,status:overall(ids,progress),createdBy:existing?.createdBy||member.id,createdAt:existing?.createdAt||at,updatedAt:at,completedAt:existing?.completedAt||null};
}
export function updateProgress(task,uid,status,at){
 if(!task.assigneeIds.includes(uid))throw new DomainError('You are not assigned to this task.','permission-denied');
 choice(status,['To do','In progress','Blocked','Complete'],'status');
 if(task.progress[uid]?.status==='Complete')throw new DomainError('Your part is already complete.');
 const progress={...task.progress,[uid]:{status,updatedAt:at,completedAt:status==='Complete'?at:null}};
 const aggregate=overall(task.assigneeIds,progress);
 return {progress,status:aggregate,updatedAt:at,completedAt:aggregate==='Complete'?at:null};
}
export function expenseAmount(amount){if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<=0||amount>1000000000)throw new DomainError('Enter an amount between ₹0.01 and ₹1 crore.');return amount;}
export function attendanceCount(count){if(!Number.isSafeInteger(count)||count<0||count>1000)throw new DomainError('Attendance must be a whole number from 0 to 1,000.');return count;}
