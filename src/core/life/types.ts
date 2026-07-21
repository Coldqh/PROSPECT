import type { GameDate } from "../calendar/types";

export type WeeklyPlanTemplateId = "balanced" | "breakout" | "recovery" | "academic" | "film-room";
export type TrainingIntensity = "controlled" | "standard" | "aggressive";
export type DayGrade = "A" | "B" | "C" | "D";

export interface FocusAllocation {
  training: number;
  recovery: number;
  study: number;
  social: number;
}

export interface WeeklyPlanState {
  templateId: WeeklyPlanTemplateId;
  intensity: TrainingIntensity;
  focus: FocusAllocation;
  revision: number;
}

export interface DayDelta {
  energy: number;
  fatigue: number;
  stress: number;
  confidence: number;
  health: number;
  gpa: number;
  coachTrust: number;
  overall: number;
}

export interface DayOutcome {
  id: string;
  date: GameDate;
  grade: DayGrade;
  title: string;
  summary: string;
  highlights: string[];
  deltas: DayDelta;
}

export interface LifeState {
  moduleVersion: 1;
  weekNumber: number;
  dayIndex: number;
  completedDays: number;
  weeklyPlan: WeeklyPlanState;
  consistency: number;
  lastOutcome?: DayOutcome | undefined;
}

export type ScheduleActivityType = "school" | "football" | "recovery" | "study" | "personal";

export interface ScheduleActivity {
  id: string;
  time: string;
  durationMinutes: number;
  type: ScheduleActivityType;
  title: string;
  location: string;
  mandatory: boolean;
  impact: string;
}

export interface LifeDayEffects {
  trainingQuality: number;
  recoveryQuality: number;
  studyQuality: number;
  socialQuality: number;
  load: number;
}
