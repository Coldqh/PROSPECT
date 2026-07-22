import type { GameDate } from "../../../core/calendar/types";
import type { FootballPosition } from "../career/types";
import type { EcosystemPlayerEligibility, EcosystemTeamCompliance, WorldConstitution, WorldCycleState } from "./constitution";

export type EcosystemLevel = "high-school" | "college";
export type EcosystemPlayerStatus = "starter" | "rotation" | "backup" | "injured";
export type EcosystemPlayerTrajectory = "surging" | "steady" | "slipping";
export type EcosystemCoachRole = "head-coach" | "coordinator";
export type EcosystemCoachStatus = "secure" | "watched" | "hot-seat";
export type EcosystemSeasonPhase = "regular-season" | "postseason" | "offseason";
export type EcosystemTransferStatus = "none" | "portal" | "transferred";
export type EcosystemTalentRoute = "traditional" | "multi-sport" | "late-bloomer" | "juco" | "walk-on";
export type EcosystemExposureLevel = "hidden" | "local" | "regional" | "national";
export type EcosystemDevelopmentCurve = "early" | "steady" | "late";
export type EcosystemResourceTier = "local" | "regional" | "power" | "elite";
export type EcosystemSpendingPriority = "balanced" | "recruiting" | "development" | "medical" | "facilities";
export type EcosystemRosterStrategy = "contend" | "balanced" | "develop" | "rebuild";
export type EcosystemUsagePlan = "starter" | "rotation" | "special-teams" | "developmental" | "redshirt";
export type EcosystemStoryKind =
  | "breakout"
  | "injury"
  | "depth-change"
  | "commitment"
  | "coach-pressure"
  | "coach-move"
  | "upset"
  | "market-shift"
  | "conference-race"
  | "championship"
  | "transfer"
  | "graduation"
  | "enrollment"
  | "investment"
  | "budget-crunch"
  | "nil-battle"
  | "resource-shift"
  | "talent-class"
  | "camp-breakout"
  | "juco-route"
  | "walk-on-route"
  | "roster-plan"
  | "position-change"
  | "redshirt"
  | "scholarship";

export type EcosystemTransactionKind =
  | "portal-entry"
  | "transfer"
  | "coach-fired"
  | "coach-hired"
  | "graduation"
  | "recruit-enrolled"
  | "facility-investment"
  | "budget-cut"
  | "nil-commitment"
  | "juco-entry"
  | "walk-on-entry"
  | "talent-enrolled"
  | "position-change"
  | "scholarship-awarded"
  | "redshirt-assigned";

export interface EcosystemPositionNeeds {
  QB: number;
  RB: number;
  WR: number;
  LB: number;
  CB: number;
}


export interface EcosystemTalentProfile {
  regionId: string;
  homeState: string;
  graduationYear: number;
  route: EcosystemTalentRoute;
  developmentCurve: EcosystemDevelopmentCurve;
  physicalMaturity: number;
  scoutingGrade: number;
  campExposure: number;
  exposure: EcosystemExposureLevel;
  academicProjection: number;
  discoveredYear: number;
}

export interface EcosystemTalentRegion {
  id: string;
  name: string;
  stateCodes: string[];
  populationWeight: number;
  footballCulture: number;
  infrastructure: number;
  exposureBias: number;
  academicAccess: number;
  annualClassSize: number;
}

export interface EcosystemCamp {
  id: string;
  name: string;
  regionId: string;
  phase: "summer-recruiting" | "spring-development";
  phaseWeek: number;
  prestige: number;
  capacity: number;
  lastHeldSeasonYear: number;
}

export interface EcosystemIndependentProspect {
  id: string;
  seed: string;
  name: string;
  age: number;
  position: FootballPosition;
  route: "juco" | "walk-on";
  regionId: string;
  homeState: string;
  overall: number;
  potential: number;
  health: number;
  academicProjection: number;
  exposure: EcosystemExposureLevel;
  campExposure: number;
  graduationYear: number;
  yearsInRoute: number;
  status: "available" | "contacted" | "committed";
  committedTeamId?: string | undefined;
}

export interface EcosystemTalentClassRecord {
  seasonYear: number;
  generatedPlayers: number;
  traditionalPlayers: number;
  multiSportPlayers: number;
  lateBloomers: number;
  jucoEntries: number;
  walkOnEntries: number;
  topProspectIds: string[];
}

export interface EcosystemTalentPipeline {
  version: 1;
  generationYear: number;
  regions: EcosystemTalentRegion[];
  camps: EcosystemCamp[];
  independentProspects: EcosystemIndependentProspect[];
  classHistory: EcosystemTalentClassRecord[];
}

export interface EcosystemConferenceChampion {
  seasonYear: number;
  teamId: string;
}

export interface EcosystemConference {
  id: string;
  name: string;
  shortName: string;
  region: string;
  prestige: number;
  teamIds: string[];
  champions: EcosystemConferenceChampion[];
}



export interface EcosystemProgramResources {
  tier: EcosystemResourceTier;
  annualBudget: number;
  footballBudget: number;
  coachingBudget: number;
  recruitingBudget: number;
  medicalBudget: number;
  facilitiesBudget: number;
  academicBudget: number;
  nilCapacity: number;
  donorSupport: number;
  mediaRevenue: number;
  currentBalance: number;
  recruitingCommitted: number;
  medicalCommitted: number;
  nilCommitted: number;
  facilitiesLevel: number;
  medicalLevel: number;
  academicSupportLevel: number;
  donorConfidence: number;
  boardPatience: number;
  financialPressure: number;
  spendingPriority: EcosystemSpendingPriority;
  lastBudgetYear: number;
}


export interface EcosystemPositionProjection {
  position: FootballPosition;
  currentPlayers: number;
  returningNextYear: number;
  returningInTwoYears: number;
  projectedDepartures: number;
  scholarshipPlayers: number;
  averageOverall: number;
  bestOverall: number;
  averagePotential: number;
  needNow: number;
  needNextYear: number;
  targetAdds: number;
}

export interface EcosystemPositionChangePlan {
  playerId: string;
  fromPosition: FootballPosition;
  toPosition: FootballPosition;
  reason: string;
  applied: boolean;
}

export interface EcosystemScholarshipDecision {
  playerId: string;
  previousStatus: "none" | "partial" | "full";
  nextStatus: "partial" | "full";
  reason: string;
}

export interface EcosystemRosterPlan {
  version: 1;
  seasonYear: number;
  reviewedWeek: number;
  strategy: EcosystemRosterStrategy;
  planningHorizonYears: 3;
  targetClassSize: number;
  availableRosterSpots: number;
  availableScholarships: number;
  projectedDepartures: number;
  retentionRisk: number;
  redshirtPlayerIds: string[];
  developmentalPlayerIds: string[];
  positionChanges: EcosystemPositionChangePlan[];
  scholarshipDecisions: EcosystemScholarshipDecision[];
  positionProjections: Record<FootballPosition, EcosystemPositionProjection>;
  lastReviewReason: string;
}

export interface EcosystemTeam {
  id: string;
  seed: string;
  name: string;
  shortName: string;
  level: EcosystemLevel;
  stateCode: string;
  conferenceId?: string | undefined;
  prestige: number;
  rating: number;
  expectation: number;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  streak: number;
  championships: number;
  offenseStyle: string;
  defenseStyle: string;
  positionNeeds: EcosystemPositionNeeds;
  rosterIds: string[];
  coachIds: string[];
  trend: "rising" | "stable" | "falling";
  compliance: EcosystemTeamCompliance;
  resources: EcosystemProgramResources;
  rosterPlan: EcosystemRosterPlan;
}

export interface EcosystemPlayer {
  id: string;
  seed: string;
  name: string;
  teamId: string;
  level: EcosystemLevel;
  age: number;
  classYear: "Freshman" | "Sophomore" | "Junior" | "Senior";
  position: FootballPosition;
  overall: number;
  potential: number;
  health: number;
  form: number;
  status: EcosystemPlayerStatus;
  depthRank: number;
  trajectory: EcosystemPlayerTrajectory;
  nationalRank: number;
  recruitingStage: "unranked" | "tracked" | "offered" | "committed";
  committedTeamId?: string | undefined;
  eligibilityYears: number;
  seasonsPlayed: number;
  transferStatus: EcosystemTransferStatus;
  previousTeamIds: string[];
  isHero: boolean;
  eligibility: EcosystemPlayerEligibility;
  talent: EcosystemTalentProfile;
  usagePlan: EcosystemUsagePlan;
  positionHistory: FootballPosition[];
}

export interface EcosystemCoach {
  id: string;
  seed: string;
  name: string;
  teamId: string;
  role: EcosystemCoachRole;
  age: number;
  reputation: number;
  development: number;
  recruiting: number;
  pressure: number;
  jobSecurity: number;
  status: EcosystemCoachStatus;
  philosophy: string;
  tenureYears: number;
  careerWins: number;
  careerLosses: number;
  previousTeamIds: string[];
}

export interface EcosystemStory {
  id: string;
  kind: EcosystemStoryKind;
  createdOn: GameDate;
  week: number;
  title: string;
  detail: string;
  importance: 1 | 2 | 3 | 4 | 5;
  teamIds: string[];
  playerIds: string[];
  coachIds: string[];
  relatedToHero: boolean;
}

export interface EcosystemTeamSeasonRecord {
  id: string;
  seasonYear: number;
  teamId: string;
  conferenceId: string;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  finalRating: number;
  finish: number;
  conferenceChampion: boolean;
  headCoachId?: string | undefined;
}

export interface EcosystemTransaction {
  id: string;
  kind: EcosystemTransactionKind;
  seasonYear: number;
  week: number;
  createdOn: GameDate;
  title: string;
  detail: string;
  playerId?: string | undefined;
  coachId?: string | undefined;
  fromTeamId?: string | undefined;
  toTeamId?: string | undefined;
  relatedToHero: boolean;
}

export interface EcosystemMarketState {
  openScholarships: number;
  activeRecruitments: number;
  committedPlayers: number;
  coachingHotSeats: number;
  portalPlayers: number;
  coachOpenings: number;
  totalRecruitingBudget: number;
  totalNilCapacity: number;
  programsUnderFinancialPressure: number;
  annualProspects: number;
  jucoProspects: number;
  walkOnProspects: number;
  nationallyExposedProspects: number;
  plannedClassSpots: number;
  developmentalPlayers: number;
  plannedPositionChanges: number;
}

export interface FootballEcosystemState {
  moduleVersion: 6;
  constitution: WorldConstitution;
  cycle: WorldCycleState;
  lastSimulatedDay: number;
  currentWeek: number;
  lastUpdatedOn: GameDate;
  seasonYear: number;
  seasonWeek: number;
  phase: EcosystemSeasonPhase;
  lastOffseasonYear: number;
  conferences: EcosystemConference[];
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  stories: EcosystemStory[];
  digest: string[];
  market: EcosystemMarketState;
  teamHistory: EcosystemTeamSeasonRecord[];
  transactions: EcosystemTransaction[];
  talentPipeline: EcosystemTalentPipeline;
}
