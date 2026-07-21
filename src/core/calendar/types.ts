export interface GameDate {
  year: number;
  month: number;
  day: number;
}

function toUtcDate(date: GameDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

export function addGameDays(date: GameDate, amount: number): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

export function formatGameDate(date: GameDate): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

export function formatShortGameDate(date: GameDate): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

export function formatWeekday(date: GameDate, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: style,
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

export function toGameDateKey(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
