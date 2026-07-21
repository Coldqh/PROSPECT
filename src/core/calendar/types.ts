export interface GameDate {
  year: number;
  month: number;
  day: number;
}

export function formatGameDate(date: GameDate): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}
