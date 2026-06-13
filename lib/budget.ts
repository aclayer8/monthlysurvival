const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function lastBusinessDay(year: number, monthIndex: number): Date {
  const date = new Date(year, monthIndex + 1, 0);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

export function budgetMonthForDate(dateText: string): string {
  const date = toDate(dateText);
  const payday = lastBusinessDay(date.getFullYear(), date.getMonth());
  const budgetDate = date >= payday ? new Date(date.getFullYear(), date.getMonth() + 1, 1) : new Date(date.getFullYear(), date.getMonth(), 1);
  return `${MONTH_LABELS[budgetDate.getMonth()]} Budget`;
}

export function budgetPeriod(label: string, referenceYear = 2026): { start: string; end: string } {
  const monthIndex = MONTH_LABELS.findIndex((month) => `${month} Budget` === label);
  if (monthIndex < 0) return { start: `${referenceYear}-01-01`, end: `${referenceYear}-01-31` };
  const start = lastBusinessDay(referenceYear, monthIndex - 1);
  const nextPayday = lastBusinessDay(referenceYear, monthIndex);
  const end = new Date(nextPayday);
  end.setDate(end.getDate() - 1);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function daysLeftInPeriod(label: string, todayText: string): number {
  const { end } = budgetPeriod(label);
  const today = toDate(todayText);
  const endDate = toDate(end);
  const ms = endDate.getTime() - today.getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}
