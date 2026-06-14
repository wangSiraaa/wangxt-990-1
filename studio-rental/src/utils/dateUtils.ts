export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateOrderNo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `ST${year}${random}`;
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return formatDate(d1) === formatDate(d2);
}

export function isOverlapping(
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
): boolean {
  const s1 = typeof start1 === 'string' ? new Date(start1).getTime() : start1.getTime();
  const e1 = typeof end1 === 'string' ? new Date(end1).getTime() : end1.getTime();
  const s2 = typeof start2 === 'string' ? new Date(start2).getTime() : start2.getTime();
  const e2 = typeof end2 === 'string' ? new Date(end2).getTime() : end2.getTime();
  
  return s1 < e2 && s2 < e1;
}

export function getDurationHours(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const e = typeof end === 'string' ? new Date(end).getTime() : end.getTime();
  return (e - s) / (1000 * 60 * 60);
}

export function addHours(date: Date | string, hours: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function isDateInRange(
  date: Date | string,
  start: Date | string,
  end: Date | string
): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  return d >= s && d <= e;
}

export function getWeeksOfMonth(year: number, month: number): (Date | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];
  
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }
  
  return weeks;
}

export function getMonthName(month: number): string {
  const months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];
  return months[month];
}

export function getWeekDayName(day: number): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[day];
}

export function getShortWeekDayName(day: number): string {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[day];
}
