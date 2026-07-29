import type { GameDate } from "../../../core/calendar/types";
import type { FootballPosition } from "../career/types";

export type MatchUnit = "offense" | "defense" | "special";
export type MatchTeamSide = "hero" | "opponent";
export type MatchStatus = "upcoming" | "in-progress" | "complete";
export type MatchParticipationMode = "auto" | "key-moments" | "every-snap";
export type MatchHeroControlMode = "assisted" | "manual" | "spectator";
export type DecisionRisk = "safe" | "balanced" | "aggressive";
export type MatchOutcomeGrade = "A" | "B" | "C" | "D";
export type MatchPlayType = "run" | "pass" | "play-action" | "screen" | "blitz" | "coverage" | "field-goal" | "punt";
export type MatchHeroInvolvement = "primary" | "secondary" | "assignment-only";
export type MatchSnapResult =
  | "run"
  | "completion"
  | "incomplete"
  | "sack"
  | "turnover"
  | "touchdown"
  | "defensive-touchdown"
  | "penalty"
  | "punt"
  | "field-goal"
  | "missed-field-goal"
  | "turnover-on-downs";
export type MatchDriveOutcome =
  | "active"
  | "touchdown"
  | "defensive-touchdown"
  | "field-goal"
  | "missed-field-goal"
  | "punt"
  | "turnover"
  | "turnover-on-downs"
  | "end-half"
  | "end-game";
export type MatchAssignmentKind =
  | "handoff"
  | "carry"
  | "pass-read"
  | "route"
  | "run-block"
  | "pass-protection"
  | "rush"
  | "run-fit"
  | "zone-coverage"
  | "man-coverage"
  | "spy"
  | "contain"
  | "kick"
  | "punt"
  | "long-snap"
  | "kick-protection"
  | "return"
  | "return-coverage";

export interface MatchDecisionOption {
  id: string;
  label: string;
  detail: string;
  risk: DecisionRisk;
  focus: "technique" | "athleticism" | "football-iq" | "competitiveness";
  difficulty: number;
  upside: number;
  mistakeRisk: number;
}

export interface MatchPlayCall {
  id: string;
  formation: string;
  personnel: string;
  concept: string;
  playType: MatchPlayType;
  strength: "left" | "right" | "middle";
  calledBy: "head-coach" | "offensive-coordinator" | "defensive-coordinator";
  canCheck: boolean;
  aggression: number;
  primarySlot?: string | undefined;
  progression: string[];
  runLane?: string | undefined;
  tags: string[];
}

export interface MatchPoint {
  x: number;
  y: number;
}

export interface MatchPlayerAssignment {
  id: string;
  side: MatchTeamSide;
  unit: MatchUnit;
  slot: string;
  position: string;
  label: string;
  isHero: boolean;
  kind: MatchAssignmentKind;
  task: string;
  start: MatchPoint;
  end: MatchPoint;
  delayMs: number;
  matchupSlot?: string | undefined;
  playerId?: string | undefined;
  playerName?: string | undefined;
  overall?: number | undefined;
  health?: number | undefined;
  depthRank?: number | undefined;
}

export interface MatchEpisode {
  id: string;
  driveId: string;
  possession: MatchTeamSide;
  unit: MatchUnit;
  position: FootballPosition;
  quarter: 1 | 2 | 3 | 4;
  clockSeconds: number;
  playClockSeconds: number;
  down: 1 | 2 | 3 | 4;
  distance: number;
  fieldPosition: number;
  scoreMargin: number;
  title: string;
  situation: string;
  assignment: string;
  read: string;
  playCall: MatchPlayCall;
  opponentCall: MatchPlayCall;
  heroInvolvement: MatchHeroInvolvement;
  heroRole: string;
  heroSlot: string;
  assignments: MatchPlayerAssignment[];
  options: MatchDecisionOption[];
}

export interface MatchStatLine {
  passingAttempts: number;
  completions: number;
  passingYards: number;
  rushingAttempts: number;
  rushingYards: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  touchdowns: number;
  turnovers: number;
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
  passBreakups: number;
  interceptions: number;
  sacksAllowed: number;
  pressuresAllowed: number;
  pancakes: number;
  hurries: number;
  runStops: number;
  coverageSnaps: number;
  fieldGoalsAttempted: number;
  fieldGoalsMade: number;
  longestFieldGoal: number;
  punts: number;
  puntYards: number;
  puntsInside20: number;
  returnYardsAllowed: number;
}

export interface MatchAdvancedStatLine {
  snaps: number;
  assignmentWins: number;
  assignmentLosses: number;
  routeWins: number;
  separationWins: number;
  blocksWon: number;
  pressures: number;
  coverageWins: number;
  missedTackles: number;
  passProtectionWins: number;
  runBlockWins: number;
  doubleTeamWins: number;
  kickQuality: number;
  puntQuality: number;
}

export interface MatchEpisodeResult {
  id: string;
  episodeId: string;
  driveId: string;
  optionId: string;
  grade: MatchOutcomeGrade;
  snapResult: MatchSnapResult;
  headline: string;
  description: string;
  yards: number;
  points: number;
  scoringSide?: MatchTeamSide | undefined;
  coachDelta: number;
  confidenceDelta: number;
  fatigueDelta: number;
  assignmentScore: number;
  teamExecutionScore: number;
  involved: boolean;
  firstDown: boolean;
  driveEnded: boolean;
  startFieldPosition: number;
  endFieldPosition: number;
  pressureOccurred: boolean;
  grossPuntYards?: number | undefined;
  puntReturnYards?: number | undefined;
  kickDistance?: number | undefined;
  targetSlot?: string | undefined;
  ballCarrierSlot?: string | undefined;
  statDelta: MatchStatLine;
  advancedDelta: MatchAdvancedStatLine;
}

export interface MatchDriveSummary {
  id: string;
  offense: MatchTeamSide;
  startQuarter: 1 | 2 | 3 | 4;
  startClockSeconds: number;
  endQuarter: 1 | 2 | 3 | 4;
  endClockSeconds: number;
  startFieldPosition: number;
  endFieldPosition: number;
  plays: number;
  yards: number;
  points: number;
  outcome: MatchDriveOutcome;
  description: string;
  controlled: boolean;
}

export interface MatchFinalResult {
  won: boolean;
  heroScore: number;
  opponentScore: number;
  grade: MatchOutcomeGrade;
  headline: string;
  summary: string;
  spotlight: string;
  coachTrustDelta: number;
  visibilityDelta: number;
}

export interface FootballMatchState {
  moduleVersion: 1;
  gameId: string;
  status: MatchStatus;
  scheduledWeek: number;
  scheduledDate: GameDate;
  opponentId: string;
  opponentName: string;
  opponentRecord: string;
  opponentThreat: string;
  heroUnit: MatchUnit;
  heroScore: number;
  opponentScore: number;
  quarter: 1 | 2 | 3 | 4;
  clockSeconds: number;
  gameClockSeconds: number;
  playClockSeconds: number;
  possession: MatchTeamSide;
  openingKickoffReceiver: MatchTeamSide;
  participationMode: MatchParticipationMode;
  heroControlMode: MatchHeroControlMode;
  analysisMode: boolean;
  heroFatigue: number;
  coachGrade: number;
  episodeIndex: number;
  totalEpisodes: number;
  driveDown: 1 | 2 | 3 | 4;
  driveDistance: number;
  driveFieldPosition: number;
  driveNumber: number;
  currentDriveId: string;
  driveStartQuarter: 1 | 2 | 3 | 4;
  driveStartClockSeconds: number;
  driveStartFieldPosition: number;
  drivePlays: number;
  driveYards: number;
  timeoutsHero: number;
  timeoutsOpponent: number;
  currentEpisode?: MatchEpisode | undefined;
  lastResolvedEpisode?: MatchEpisode | undefined;
  lastResolvedResult?: MatchEpisodeResult | undefined;
  completedEpisodes: MatchEpisodeResult[];
  drives: MatchDriveSummary[];
  stats: MatchStatLine;
  advancedStats: MatchAdvancedStatLine;
  finalResult?: MatchFinalResult | undefined;
}
