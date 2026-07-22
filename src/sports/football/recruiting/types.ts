import type { GameDate } from "../../../core/calendar/types";

export type RecruitingProgramTier = "national" | "power" | "regional" | "developmental";
export type RecruitingStage = "unaware" | "watchlist" | "evaluating" | "contact" | "priority" | "offered" | "cooled";
export type RecruitingActionId =
  | "send-film"
  | "coach-call"
  | "send-transcript"
  | "declare-interest"
  | "recruiter-call"
  | "schedule-visit";
export type ProjectedCollegeRole = "immediate-competition" | "rotation-path" | "developmental" | "long-shot";
export type OfficialVisitStatus = "none" | "invited" | "scheduled" | "completed";
export type RecruitingPromiseCategory = "role" | "development" | "scheme" | "stability";

export interface RecruitingOffer {
  id: string;
  issuedWeek: number;
  scholarship: "full";
  projectedRole: ProjectedCollegeRole;
  expiresAfterWeek: number;
}

export interface RecruitingPromise {
  id: string;
  category: RecruitingPromiseCategory;
  statement: string;
  credibility: number;
  source: "recruiter-call" | "official-visit";
  madeWeek: number;
}

export interface OfficialVisit {
  id: string;
  status: "scheduled" | "completed";
  scheduledWeek: number;
  scheduledDate: GameDate;
  dueCompletedDay: number;
  completedWeek?: number | undefined;
  completedDate?: GameDate | undefined;
  campusFit?: number | undefined;
  staffConnection?: number | undefined;
  roleClarity?: number | undefined;
  familyComfort?: number | undefined;
  overallImpression?: number | undefined;
  summary?: string | undefined;
  warning?: string | undefined;
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
  contactQuality: number;
  roleClarity: number;
  staffTrust: number;
  visitStatus: OfficialVisitStatus;
  officialVisit?: OfficialVisit | undefined;
  promises: RecruitingPromise[];
  playerRead: string;
  evaluation: string;
  lastUpdate: string;
  offer?: RecruitingOffer | undefined;
}

export interface RecruitingCommitment {
  programId: string;
  status: "verbal";
  committedWeek: number;
  committedDate: GameDate;
  confidence: number;
}

export interface RecruitingActivity {
  id: string;
  week: number;
  programId?: string | undefined;
  date: GameDate;
  kind: "evaluation" | "contact" | "action" | "offer" | "cooling" | "conversation" | "visit" | "commitment" | "expiration";
  title: string;
  detail: string;
}

export interface FootballRecruitingState {
  moduleVersion: 2;
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
  decommitments: number;
  commitment?: RecruitingCommitment | undefined;
  programs: RecruitingProgram[];
  activity: RecruitingActivity[];
}
