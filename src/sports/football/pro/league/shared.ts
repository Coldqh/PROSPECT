import type { GameDate } from "../../../../core/calendar/types";
import type { FootballPosition } from "../../career/types";

export const FIRST_NAMES = ["Marcus", "Devin", "Cole", "Darius", "Tre", "Nate", "Malik", "Grant", "Jamal", "Ty", "Victor", "Owen", "Rashad", "Luke", "Cam", "Evan"] as const;
export const LAST_NAMES = ["Hayes", "Morris", "Foster", "Reed", "Carter", "Coleman", "Price", "Woods", "Bishop", "Tate", "Grant", "Pierce", "Stone", "Harris", "Gibson", "West"] as const;
export const PROFESSIONAL_ROSTER_COUNTS: Record<FootballPosition, number> = {
  QB: 3, RB: 4, WR: 5, TE: 3, OT: 5, OG: 4, C: 2,
  EDGE: 4, DT: 4, LB: 5, CB: 5, S: 4, K: 1, P: 1,
};

export const POSITION_MULTIPLIER: Record<FootballPosition, number> = {
  QB: 1.8, RB: 0.8, WR: 1.12, TE: 0.86, OT: 1.2, OG: 0.86, C: 0.82,
  EDGE: 1.28, DT: 1.0, LB: 0.88, CB: 1.16, S: 0.92, K: 0.48, P: 0.45,
};

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

export function addDays(date: GameDate, days: number): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function dateValue(date: GameDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function seasonStart(year: number): GameDate {
  const septemberFirst = new Date(Date.UTC(year, 8, 1));
  const daysToSunday = (7 - septemberFirst.getUTCDay()) % 7;
  return addDays({ year, month: 9, day: 1 }, daysToSunday);
}
