export type ProgressStatus = 'To do' | 'In progress' | 'Blocked' | 'Complete';
export type Member = { id: string; name: string; email: string; role: 'admin'|'team'; active: boolean; department: string; employeeType?: 'frontend'|'backend'; createdAt: string };
export type EventRecord = { id: string; title: string; date: string; endDate: string; location: string; type: string; status: 'Planning'|'Live'|'Complete'; description: string; createdAt: string };
export type PersonProgress = { status: ProgressStatus; updatedAt: string; completedAt: string|null };
export type Task = { id: string; title: string; description: string; eventId: string; kind: 'office'|'event'|'responsibility'; start: string; deadline: string; originalDeadline: string; priority: 'Low'|'Medium'|'High'; assigneeIds: string[]; assigneeNames: Record<string,string>; progress: Record<string,PersonProgress>; status: ProgressStatus; createdBy: string; createdAt: string; updatedAt: string; completedAt: string|null };
export type Client = {id:string; name:string; company:string; phone:string; email:string; createdAt:string};
export type Guest = {id:string;eventId:string;clientId:string;invited:boolean;rsvp:'Pending'|'Yes'|'No'|'Maybe';attendance:number;attendedAt:string|null;walkIn:boolean;updatedAt:string};
export type Expense = {id:string;eventId:string;description:string;amountPaise:number;date:string;category:string;paidBy:string;paidByName:string;createdAt:string};
export type Review = {id:string;eventId:string;kind:'Hit'|'Miss';text:string;authorName:string;authorId:string;createdAt:string};
export type Activity = {id:string;actorId:string;actorName:string;action:string;details:string;at:string};
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateLabel = (date:string) => date ? new Date(date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
export const timeLabel = (date:string) => date ? new Date(date).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}) : '—';
export const money = (paise:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(paise/100);
export const completion = (t:Task) => Math.round(t.assigneeIds.filter(id=>t.progress[id]?.status==='Complete').length/Math.max(1,t.assigneeIds.length)*100);
export const overdue = (t:Task) => t.status!=='Complete' && t.deadline<today();
export const initials = (name:string) => name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();

export const count = (n:number, one:string, many = one+'s') => n + ' ' + (n === 1 ? one : many);
