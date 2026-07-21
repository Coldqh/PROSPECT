import type { GameDate } from "../../../core/calendar/types";

export type RecruitingProgramTier = "national" | "power" | "regional" | "developmental";
export type RecruitingStage = "unaware" | "watchlist" | "evaluating" | "contact" | "priority" | "offered" | "cooled";
export type RecruitingActionId = "send-film" | "coach-call" | "send-transcript" | "declare-interest";
export type ProjectedCollegeRole = "immediate-competition" | "rotation-path" | "developmental" | "long-shot";

export interface RecruitingOffer {
  id: string;
  issuedWeek: number;
  scholarship: "full";
  projectedRole: ProjectedCollegeRole;
  expiresAfterWeek: number;
}

export interface RecruitingProgram {
  id: string;
  seed: string;
  name: string;
  shortName: string;
  city: string;
  stateCode: string;
  distanceMiles: number;
  tier: RecruitingProgramTier;
  prestige: number;
  conferenceLevel: number;
  scheme: string;
  academicStandard: number;
  medicine: number;
  facilities: number;
  youthOpportunity: number;
  positionNeed: number;
  depthCompetition: number;
  fit: number;
  interest: number;
  scoutingConfidence: number;
  stage: RecruitingStage;
  academicEligible: boolean;
  medicalConcern: boolean;
  projectedRole: ProjectedCollegeRole;
  recruiterName: string;
  recruiterStyle: "direct" | "patient" | "salesman" | "analytical";
  evaluation: string;
  lastUpdate: string;
  offer?: RecruitingOffer | undefined;
}

export interface RecruitingActivity {
  id: string;
  week: number;
  programId?: string | undefined;
  date: GameDate;
  kind: "evaluation" | "contact" | "action" | "offer" | "cooling";
  title: string;
  detail: string;
}

export interface FootballRecruitingState {
  moduleVersion: 1;
  visibility: number;
  filmGrade: number;
  consistency: number;
  healthConfidence: number;
  academicClearance: number;
  coachRecommendation: number;
  competitionLevel: number;
  regionalRankLabel: string;
  interestedPrograms: number;
  offers: number;
  actionWeek: number;
  actionsUsed: number;
  programs: RecruitingProgram[];
  activity: RecruitingActivity[];
}
