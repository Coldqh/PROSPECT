import type { GameDate } from "../../../core/calendar/types";
import type { ProjectedCollegeRole, RecruitingProgramTier } from "../recruiting/types";

export type CollegeTransitionStatus = "high-school" | "signed" | "orientation";
export type CollegeEntryRoute = "scholarship" | "preferred-walk-on";
export type CollegePromiseVerdict = "kept" | "uncertain" | "misleading";
export type CollegeOnboardingPriority = "compete-now" | "learn-system" | "academic-base";
export type CollegePlayerYear = "Freshman" | "Sophomore" | "Junior" | "Senior";

export interface CollegeProgramIdentity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stateCode: string;
  tier: RecruitingProgramTier;
  prestige: number;
  scheme: string;
  medicine: number;
  facilities: number;
  youthOpportunity: number;
  headCoachName: string;
  recruiterName: string;
}

export interface CollegePositionPlayer {
  id: string;
  name: string;
  year: CollegePlayerYear;
  overall: number;
  style: string;
  redshirt: boolean;
  depthRank: number;
  isHero: boolean;
}

export interface CollegeOffseasonSummary {
  startDate: GameDate;
  arrivalDate: GameDate;
  trainingGrade: "A" | "B" | "C" | "D";
  overallDelta: number;
  weightDelta: number;
  gpaDelta: number;
  healthDelta: number;
  confidenceDelta: number;
  summary: string;
}

export interface FootballCollegeState {
  moduleVersion: 1;
  status: CollegeTransitionStatus;
  entryRoute?: CollegeEntryRoute | undefined;
  signedProgramId?: string | undefined;
  signedDate?: GameDate | undefined;
  program?: CollegeProgramIdentity | undefined;
  positionRoom: CollegePositionPlayer[];
  depthRank?: number | undefined;
  projectedRole?: ProjectedCollegeRole | undefined;
  actualRole?: ProjectedCollegeRole | undefined;
  promiseVerdict?: CollegePromiseVerdict | undefined;
  promiseSummary?: string | undefined;
  offseason?: CollegeOffseasonSummary | undefined;
  arrivalDate?: GameDate | undefined;
  onboardingPriority?: CollegeOnboardingPriority | undefined;
}
