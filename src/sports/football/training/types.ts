import type { GameDate } from "../../../core/calendar/types";
import type { TrainingIntensity } from "../../../core/life/types";

export type TrainingFocusId = "position-craft" | "explosive-power" | "film-install" | "recovery-reset";
export type MedicalStatus = "cleared" | "questionable" | "limited" | "out";
export type InjurySeverity = "minor" | "moderate";
export type BodyArea = "lower-body" | "upper-body" | "head-neck" | "back-core";

export interface TrainingPlanState {
  focusId: TrainingFocusId;
  intensity: TrainingIntensity;
  revision: number;
}

export interface ActiveHealthIssue {
  id: string;
  diagnosis: string;
  area: BodyArea;
  severity: InjurySeverity;
  daysRemaining: number;
  recurrenceRisk: number;
  startedOn: string;
}

export interface BodyStatus {
  readiness: number;
  acuteLoad: number;
  chronicLoad: number;
  soreness: number;
  pain: number;
  injuryRisk: number;
  medicalStatus: MedicalStatus;
  restriction: string;
  activeIssue?: ActiveHealthIssue | undefined;
}

export interface DevelopmentMomentum {
  technique: number;
  athleticism: number;
  footballIq: number;
  competitiveness: number;
}

export interface TrainingSessionResult {
  id: string;
  date: GameDate;
  focusId: TrainingFocusId;
  focusName: string;
  intensity: TrainingIntensity;
  grade: "A" | "B" | "C" | "D";
  load: number;
  readinessBefore: number;
  readinessAfter: number;
  sorenessDelta: number;
  riskAfter: number;
  gains: {
    technique: number;
    athleticism: number;
    footballIq: number;
    competitiveness: number;
  };
  note: string;
  issueOccurred?: string | undefined;
}

export interface FootballTrainingState {
  moduleVersion: 1;
  plan: TrainingPlanState;
  body: BodyStatus;
  momentum: DevelopmentMomentum;
  lastSession?: TrainingSessionResult | undefined;
}
