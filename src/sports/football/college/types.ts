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
export type CollegeHeroDecisionKind = "coach-meeting" | "position-rivalry" | "transfer-window" | "transfer-destination";
export type CollegeHeroCareerStatus = "active" | "complete";

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
  spotlight?: string | undefined;
  stats?: {
    passingYards: number;
    rushingYards: number;
    receivingYards: number;
    touchdowns: number;
    turnovers: number;
    tackles: number;
    sacks: number;
    interceptions: number;
  } | undefined;
}

export interface CollegeHeroSeasonSummary {
  seasonYear: number;
  classYear: CollegePlayerYear;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  role: CollegeHeroRole;
  gamesPlayed: number;
  starts: number;
  snaps: number;
  averageGrade: "A" | "B" | "C" | "D";
  redshirted: boolean;
  overallStart: number;
  overallEnd: number;
  coachTrustEnd: number;
  awards: string[];
}

export interface CollegeTransferOffer {
  teamId: string;
  teamName: string;
  shortName: string;
  projectedRole: CollegeHeroRole;
  schemeFit: number;
  scholarship: boolean;
  summary: string;
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
  version: 2;
  status: CollegeHeroCareerStatus;
  teamId: string;
  seasonYear: number;
  classYear: CollegePlayerYear;
  eligibilityYears: number;
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
  careerSnaps: number;
  careerGames: number;
  careerStarts: number;
  seasonOverallStart: number;
  redshirtStatus: CollegeRedshirtStatus;
  transferIntent: CollegeTransferIntent;
  transferOffers: CollegeTransferOffer[];
  promises: CollegeHeroPromise[];
  pendingDecision?: CollegeHeroDecision | undefined;
  gameLog: CollegeHeroGameLog[];
  weekLog: CollegeHeroWeekLog[];
  seasonHistory: CollegeHeroSeasonSummary[];
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
