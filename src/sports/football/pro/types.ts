import type { GameDate } from "../../../core/calendar/types";
import type { FootballPosition } from "../career/types";
import type { MatchOutcomeGrade, MatchStatLine } from "../matches/types";

export type ProfessionalStatus =
  | "dormant"
  | "decision"
  | "agent-selection"
  | "evaluation"
  | "draft-ready"
  | "drafted"
  | "undrafted"
  | "training-camp"
  | "roster"
  | "practice-squad"
  | "free-agent"
  | "cut";

export type ProfessionalConference = "AFC" | "NFC";
export type ProfessionalCampApproach = "controlled" | "balanced" | "aggressive";
export type ProfessionalEvaluationFocus = "athletic" | "technical" | "interview";
export type ProfessionalRosterOutcome = "active-roster" | "practice-squad" | "released";
export type ProfessionalSeasonPhase = "preseason" | "regular-season" | "playoffs" | "complete";
export type ProfessionalContractStatus = "active" | "practice-squad" | "free-agent" | "injured-reserve";
export type ProfessionalAvailability = "active" | "questionable" | "out" | "injured-reserve";
export type ProfessionalWeekFocus = "playbook" | "technique" | "recovery" | "competition";
export type ProfessionalTransactionKind = "signing" | "release" | "waiver-claim" | "injury" | "promotion" | "trade" | "cap-move";

export interface ProfessionalTeam {
  id: string;
  city: string;
  name: string;
  shortName: string;
  conference: ProfessionalConference;
  prestige: number;
  rosterStrength: number;
  wins: number;
  losses: number;
  salaryCap: number;
  payroll: number;
  deadCap: number;
  capSpace: number;
  rosterSize: number;
  needs: Record<FootballPosition, number>;
}

export interface ProfessionalAgent {
  id: string;
  name: string;
  agency: string;
  reputation: number;
  negotiation: number;
  mediaReach: number;
  teamAccess: number;
  commission: number;
  risk: number;
  summary: string;
}

export interface ProfessionalProspect {
  id: string;
  name: string;
  position: FootballPosition;
  collegeName: string;
  age: number;
  overall: number;
  potential: number;
  production: number;
  athleticScore: number;
  medicalScore: number;
  interviewScore: number;
  draftGrade: number;
  projectedRound: number | null;
  isHero: boolean;
}

export interface ProfessionalDraftSlot {
  id: string;
  round: number;
  pickInRound: number;
  overallPick: number;
  originalTeamId: string;
  currentTeamId: string;
  traded: boolean;
}

export interface ProfessionalDraftSelection {
  id: string;
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  prospectId: string;
  prospectName: string;
  position: FootballPosition;
  collegeName: string;
  grade: number;
  isHero: boolean;
}

export interface ProfessionalEvaluationResult {
  completedOn: GameDate;
  focus: ProfessionalEvaluationFocus;
  fortyYard: number;
  shuttle: number;
  vertical: number;
  benchReps: number;
  positionDrill: number;
  medical: number;
  interview: number;
  overallScore: number;
  stockDelta: number;
  summary: string;
}

export interface ProfessionalCampInvite {
  teamId: string;
  teamName: string;
  shortName: string;
  signingBonus: number;
  rosterOpportunity: number;
  positionCompetition: number;
  schemeFit: number;
  summary: string;
}

export interface ProfessionalRookieContract {
  teamId: string;
  teamName: string;
  years: number;
  totalValue: number;
  guaranteed: number;
  signingBonus: number;
  salaryYearOne: number;
  agentFee: number;
  round: number | null;
  overallPick: number | null;
}

export interface ProfessionalCampSession {
  id: string;
  day: number;
  approach: ProfessionalCampApproach;
  grade: "A" | "B" | "C" | "D";
  performance: number;
  healthDelta: number;
  coachTrustDelta: number;
  summary: string;
}

export interface ProfessionalTrainingCamp {
  teamId: string;
  day: number;
  totalDays: number;
  coachTrust: number;
  rosterRank: number;
  playersAtPosition: number;
  sessions: ProfessionalCampSession[];
  outcome?: ProfessionalRosterOutcome | undefined;
}

export interface ProfessionalRosterPlayer {
  id: string;
  name: string;
  teamId?: string | undefined;
  position: FootballPosition;
  age: number;
  overall: number;
  potential: number;
  health: number;
  form: number;
  depthRank: number;
  yearsRemaining: number;
  annualSalary: number;
  guaranteedRemaining: number;
  status: ProfessionalContractStatus;
  availability: ProfessionalAvailability;
  injuryWeeks: number;
  isHero: boolean;
}

export interface ProfessionalGame {
  id: string;
  seasonYear: number;
  week: number;
  date: GameDate;
  homeTeamId: string;
  awayTeamId: string;
  status: "scheduled" | "complete";
  homeScore?: number | undefined;
  awayScore?: number | undefined;
  playoffRound?: "wild-card" | "conference" | "championship" | undefined;
}

export interface ProfessionalTransaction {
  id: string;
  seasonYear: number;
  week: number;
  kind: ProfessionalTransactionKind;
  playerId: string;
  playerName: string;
  position: FootballPosition;
  fromTeamId?: string | undefined;
  toTeamId?: string | undefined;
  value: number;
  summary: string;
}

export interface ProfessionalHeroGameLog {
  seasonYear: number;
  gameId: string;
  week: number;
  opponentId: string;
  won: boolean;
  teamScore: number;
  opponentScore: number;
  grade: MatchOutcomeGrade;
  snaps: number;
  stats: MatchStatLine;
}


export interface ProfessionalWeeklyPlan {
  seasonYear: number;
  week: number;
  focus: ProfessionalWeekFocus;
  resolved: boolean;
  readinessDelta: number;
  coachTrustDelta: number;
  healthDelta: number;
  depthDelta: number;
  injuryRisk: number;
  summary: string;
}

export interface ProfessionalHeroCareer {
  teamId?: string | undefined;
  seasonYear: number;
  week: number;
  role: "starter" | "rotation" | "special-teams" | "inactive" | "practice-squad" | "free-agent";
  depthRank: number;
  coachTrust: number;
  gamesPlayed: number;
  starts: number;
  snaps: number;
  gameLog: ProfessionalHeroGameLog[];
  availability: ProfessionalAvailability;
  weeklyPlan: ProfessionalWeeklyPlan;
}

export interface ProfessionalLeagueState {
  seasonYear: number;
  phase: ProfessionalSeasonPhase;
  week: number;
  totalWeeks: number;
  schedule: ProfessionalGame[];
  roster: ProfessionalRosterPlayer[];
  freeAgents: ProfessionalRosterPlayer[];
  transactions: ProfessionalTransaction[];
  playoffTeamIds: string[];
  championTeamId?: string | undefined;
  activeGameId?: string | undefined;
}

export interface FootballProfessionalState {
  version: 2;
  status: ProfessionalStatus;
  draftYear: number;
  declared: boolean;
  draftStock: number;
  projectedRound: number | null;
  projectedRange: string;
  agents: ProfessionalAgent[];
  selectedAgentId?: string | undefined;
  teams: ProfessionalTeam[];
  prospects: ProfessionalProspect[];
  draftOrder: ProfessionalDraftSlot[];
  evaluation?: ProfessionalEvaluationResult | undefined;
  draftResults: ProfessionalDraftSelection[];
  heroSelection?: ProfessionalDraftSelection | undefined;
  campInvites: ProfessionalCampInvite[];
  contract?: ProfessionalRookieContract | undefined;
  camp?: ProfessionalTrainingCamp | undefined;
  league: ProfessionalLeagueState;
  heroCareer?: ProfessionalHeroCareer | undefined;
  lastSummary: string;
}
