import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTaskStyles(task: any) {
  const isCompleted = task.status === 'completed';
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(23, 59, 59, 999);
  
  let type = '';
  
  if (task.manualColor) {
    type = task.manualColor;
  } else if (isCompleted) {
    const completedAt = task.completedAt ? (task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt)) : new Date();
    if (completedAt <= dueDate) {
      type = 'green';
    } else {
      type = 'yellow';
    }
  } else {
    const now = new Date();
    if (now > dueDate) {
      type = 'red';
    } else {
      type = 'amber';
    }
  }
  
  switch (type) {
    case 'green':
      return {
        badge: 'bg-green-500/20 text-green-700 dark:text-green-400',
        bar: 'bg-green-500',
        label: 'Done (On Time)'
      };
    case 'yellow':
      return {
        badge: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
        bar: 'bg-yellow-500',
        label: 'Done (Late)'
      };
    case 'red':
      return {
        badge: 'bg-red-500/20 text-red-700 dark:text-red-400',
        bar: 'bg-red-500',
        label: 'Overdue'
      };
    case 'blue':
      return {
        badge: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
        bar: 'bg-blue-500',
        label: 'Custom Blue'
      };
    case 'purple':
      return {
        badge: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
        bar: 'bg-purple-500',
        label: 'Custom Purple'
      };
    case 'amber':
    default:
      return {
        badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
        bar: 'bg-amber-500',
        label: task.manualColor ? 'Custom Amber' : 'Pending'
      };
  }
}

export function groupEvents(events: any[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming: any[] = [];
  const past: any[] = [];

  events.forEach(ev => {
    if (!ev.eventDate) {
      upcoming.push(ev);
    } else {
      const d = ev.eventDate.toDate ? ev.eventDate.toDate() : new Date(ev.eventDate);
      if (d < now) {
        past.push(ev);
      } else {
        upcoming.push(ev);
      }
    }
  });

  // Sort upcoming ascending, past descending
  upcoming.sort((a, b) => {
    const da = a.eventDate ? (a.eventDate.toDate ? a.eventDate.toDate().getTime() : new Date(a.eventDate).getTime()) : Number.MAX_SAFE_INTEGER;
    const db = b.eventDate ? (b.eventDate.toDate ? b.eventDate.toDate().getTime() : new Date(b.eventDate).getTime()) : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  
  past.sort((a, b) => {
    const da = a.eventDate ? (a.eventDate.toDate ? a.eventDate.toDate().getTime() : new Date(a.eventDate).getTime()) : 0;
    const db = b.eventDate ? (b.eventDate.toDate ? b.eventDate.toDate().getTime() : new Date(b.eventDate).getTime()) : 0;
    return db - da; // Descending for past
  });

  return { upcoming, past };
}
