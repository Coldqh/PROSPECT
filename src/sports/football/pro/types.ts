import type { GameDate } from "../../../core/calendar/types";
import type { FootballPosition } from "../career/types";

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
  | "cut";

export type ProfessionalConference = "AFC" | "NFC";
export type ProfessionalCampApproach = "controlled" | "balanced" | "aggressive";
export type ProfessionalEvaluationFocus = "athletic" | "technical" | "interview";
export type ProfessionalRosterOutcome = "active-roster" | "practice-squad" | "released";

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
  capSpace: number;
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

export interface FootballProfessionalState {
  version: 1;
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
  lastSummary: string;
}
