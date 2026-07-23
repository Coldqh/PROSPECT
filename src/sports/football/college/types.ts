import type { GameDate } from "../../../core/calendar/types";
import type { ProjectedCollegeRole, RecruitingProgramTier } from "../recruiting/types";

export type CollegeTransitionStatus = "high-school" | "signed" | "orientation" | "active";
export type CollegeEntryRoute = "scholarship" | "preferred-walk-on";
export type CollegePromiseVerdict = "kept" | "uncertain" | "misleading";
export type CollegeOnboardingPriority = "compete-now" | "learn-system" | "academic-base";
export type CollegePlayerYear = "Freshman" | "Sophomore" | "Junior" | "Senior";
export type CollegeHeroRole = "starter" | "rotation" | "special-teams" | "developmental";
export type CollegeTransferIntent = "stay" | "open" | "portal";
export type CollegeRedshirtStatus = "active" | "candidate" | "used";
export type CollegePromiseStatus = "active" | "kept" | "broken";
export type CollegeHeroDecisionKind = "coach-meeting" | "position-rivalry" | "transfer-window";

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

export interface CollegeHeroPromise {
  id: string;
  kind: "playing-time";
  targetRole: ProjectedCollegeRole;
  madeWeek: number;
  deadlineWeek: number;
  status: CollegePromiseStatus;
  summary: string;
}

export interface CollegeHeroDecisionOption {
  id: string;
  label: string;
  detail: string;
}

export interface CollegeHeroDecision {
  id: string;
  kind: CollegeHeroDecisionKind;
  createdWeek: number;
  title: string;
  detail: string;
  options: CollegeHeroDecisionOption[];
}

export interface CollegeHeroGameLog {
  id: string;
  seasonYear: number;
  week: number;
  opponentId: string;
  opponentName: string;
  won: boolean;
  score: string;
  snaps: number;
  started: boolean;
  grade: "A" | "B" | "C" | "D";
  role: CollegeHeroRole;
}

export interface CollegeHeroWeekLog {
  id: string;
  seasonYear: number;
  week: number;
  role: CollegeHeroRole;
  depthRank: number;
  coachTrust: number;
  lockerRoomStanding: number;
  practiceGrade: "A" | "B" | "C" | "D";
  summary: string;
}

export interface FootballCollegeHeroCareer {
  version: 1;
  teamId: string;
  seasonYear: number;
  week: number;
  role: CollegeHeroRole;
  depthRank: number;
  coachTrust: number;
  lockerRoomStanding: number;
  practiceReps: number;
  weeklyPracticeGrade: "A" | "B" | "C" | "D";
  seasonSnaps: number;
  gamesPlayed: number;
  starts: number;
  redshirtStatus: CollegeRedshirtStatus;
  transferIntent: CollegeTransferIntent;
  promises: CollegeHeroPromise[];
  pendingDecision?: CollegeHeroDecision | undefined;
  gameLog: CollegeHeroGameLog[];
  weekLog: CollegeHeroWeekLog[];
  lastSummary: string;
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
  heroCareer?: FootballCollegeHeroCareer | undefined;
}
