import type { GameDate } from "../../../core/calendar/types";
import type { CareerSave } from "../../../storage/saves/schema";

export interface WeeklyReportMetric {
  id: "overall" | "coach-trust" | "health" | "role" | "offers" | "snaps";
  label: string;
  value: string;
  delta?: number;
}

export interface WeeklyReportMatch {
  opponent: string;
  score: string;
  won: boolean;
  grade?: "A" | "B" | "C" | "D";
  snaps?: number;
}

export interface WeeklyReportHeadline {
  id: string;
  title: string;
  detail: string;
  importance: number;
}

export interface WeeklyReport {
  id: string;
  week: number;
  startDate: GameDate;
  endDate: GameDate;
  teamName: string;
  record: string;
  summary: string;
  match?: WeeklyReportMatch;
  metrics: WeeklyReportMetric[];
  headlines: WeeklyReportHeadline[];
}

export interface CareerWeekAdvanceResult {
  save: CareerSave;
  report: WeeklyReport;
}
