import type { GameDate } from "../../../core/calendar/types";
import type { FootballRosterPosition } from "../team/types";
import type { EcosystemPlayerEligibility, EcosystemTeamCompliance, WorldConstitution, WorldCycleState } from "./constitution";

export const ECOSYSTEM_MODULE_VERSION = 14 as const;

export type EcosystemLevel = "high-school" | "college";
export type EcosystemPlayerStatus = "starter" | "rotation" | "backup" | "injured";
export type EcosystemPlayerTrajectory = "surging" | "steady" | "slipping";
export type EcosystemCoachRole = "head-coach" | "offensive-coordinator" | "defensive-coordinator" | "position-coach";
export type EcosystemCoachTemperament = "calm" | "demanding" | "volatile" | "player-first";
export type EcosystemCoachStatus = "secure" | "watched" | "hot-seat";
export type EcosystemSeasonPhase = "regular-season" | "postseason" | "offseason";
export type EcosystemTransferStatus = "none" | "portal" | "transferred";
export type EcosystemTalentRoute = "traditional" | "multi-sport" | "late-bloomer" | "juco" | "walk-on";
export type EcosystemExposureLevel = "hidden" | "local" | "regional" | "national";
export type EcosystemDevelopmentCurve = "early" | "steady" | "late";
export type EcosystemResourceTier = "local" | "regional" | "power" | "elite";
export type EcosystemSpendingPriority = "balanced" | "recruiting" | "development" | "medical" | "facilities";
export type EcosystemRosterStrategy = "contend" | "balanced" | "develop" | "rebuild";
export type EcosystemOffenseSystem = "air-raid" | "west-coast" | "power-run" | "spread-option" | "multiple";
export type EcosystemDefenseSystem = "quarters-425" | "multiple-34" | "over-43" | "nickel-match" | "man-pressure" | "multiple-defense";
export type EcosystemTacticalTempo = "controlled" | "balanced" | "fast";
export type EcosystemTacticalAggression = "conservative" | "balanced" | "aggressive";
export type EcosystemPositionRole =
  | "pocket-distributor" | "dual-threat" | "field-general"
  | "zone-runner" | "power-back" | "receiving-back"
  | "separator" | "vertical-threat" | "possession-target"
  | "inline-receiver" | "seam-threat" | "move-tight-end"
  | "blindside-anchor" | "zone-tackle" | "power-tackle"
  | "pull-guard" | "phone-booth-guard" | "zone-guard"
  | "line-caller" | "reach-center" | "power-center"
  | "speed-rusher" | "power-rusher" | "edge-setter"
  | "nose-anchor" | "interior-penetrator" | "three-technique"
  | "run-anchor" | "coverage-backer" | "edge-blitzer"
  | "press-corner" | "zone-corner" | "ball-hawk"
  | "box-safety" | "center-fielder" | "match-safety"
  | "accuracy-kicker" | "power-kicker" | "clutch-kicker"
  | "directional-punter" | "hangtime-punter" | "field-position-punter";
export type EcosystemPlayerArchetype = EcosystemPositionRole;
export type EcosystemUsagePlan = "starter" | "rotation" | "special-teams" | "developmental" | "redshirt";
export type EcosystemCandidateKind = "high-school" | "juco" | "walk-on" | "transfer";
export type EcosystemNegotiationStatus = "offered" | "accepted" | "withdrawn" | "expired";
export type EcosystemPromiseRole = "starter-path" | "rotation" | "developmental";
export type EcosystemOpeningStatus = "open" | "filled" | "closed";
export type EcosystemCoachVacancyStatus = "open" | "filled" | "cancelled";
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
  | "scholarship"
  | "offer"
  | "offer-withdrawn"
  | "market-chain"
  | "coach-vacancy"
  | "tactical-change"
  | "scheme-fit"
  | "ranking"
  | "playoff"
  | "award"
  | "rivalry"
  | "bowl"
  | "mentorship"
  | "locker-room-conflict"
  | "leadership"
  | "reconciliation"
  | "staff-friction"
  | "broken-promise"
  | "storyline";

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
  | "redshirt-assigned"
  | "offer-issued"
  | "offer-withdrawn"
  | "commitment"
  | "coach-vacancy"
  | "tactical-change"
  | "scheme-fit";

export type EcosystemPositionNeeds = Record<FootballRosterPosition, number>;

export type EcosystemCareerStage = "high-school" | "college" | "draft-pool" | "professional" | "free-agent" | "retired" | "football-exit";
export type EcosystemCareerEventKind =
  | "created"
  | "enrolled"
  | "transferred"
  | "position-change"
  | "graduated"
  | "declared"
  | "drafted"
  | "signed"
  | "released"
  | "retired";

export interface EcosystemPlayerCareerEvent {
  id: string;
  seasonYear: number;
  week: number;
  kind: EcosystemCareerEventKind;
  detail: string;
  fromTeamId?: string | undefined;
  toTeamId?: string | undefined;
}

export interface EcosystemPlayerCareerRecord {
  playerId: string;
  name: string;
  position: FootballRosterPosition;
  age: number;
  overall: number;
  potential: number;
  currentStage: EcosystemCareerStage;
  currentTeamId?: string | undefined;
  highSchoolTeamIds: string[];
  collegeTeamIds: string[];
  professionalTeamIds: string[];
  isHero: boolean;
  draftYear?: number | undefined;
  draftRound?: number | undefined;
  draftPick?: number | undefined;
  retiredYear?: number | undefined;
  events: EcosystemPlayerCareerEvent[];
}

export interface EcosystemCareerRegistry {
  version: 1;
  records: EcosystemPlayerCareerRecord[];
  draftPoolIds: string[];
  retiredIds: string[];
  lastSyncedSeasonYear: number;
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
  position: FootballRosterPosition;
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


export interface EcosystemRosterOpening {
  id: string;
  teamId: string;
  position: FootballRosterPosition;
  seasonYear: number;
  slots: number;
  scholarshipSlots: number;
  nilAvailable: number;
  recruitingAvailable: number;
  filledByCandidateIds: string[];
  status: EcosystemOpeningStatus;
  reason: string;
}

export interface EcosystemMarketNegotiation {
  id: string;
  candidateId: string;
  candidateKind: EcosystemCandidateKind;
  candidateName: string;
  position: FootballRosterPosition;
  teamId: string;
  status: EcosystemNegotiationStatus;
  scholarship: "none" | "partial" | "full";
  nilOffer: number;
  promisedRole: EcosystemPromiseRole;
  score: number;
  createdWeek: number;
  expiresWeek: number;
  reason: string;
}

export interface EcosystemCoachVacancy {
  id: string;
  teamId: string;
  role: EcosystemCoachRole;
  status: EcosystemCoachVacancyStatus;
  openedSeasonYear: number;
  openedWeek: number;
  salaryBudget: number;
  reason: string;
  formerCoachId?: string | undefined;
  hiredCoachId?: string | undefined;
}

export interface EcosystemUnifiedMovementMarket {
  version: 1;
  seasonYear: number;
  lastProcessedDay: number;
  openings: EcosystemRosterOpening[];
  negotiations: EcosystemMarketNegotiation[];
  coachVacancies: EcosystemCoachVacancy[];
  acceptedMoves: number;
  withdrawnOffers: number;
  digest: string[];
}


export type EcosystemGameKind = "conference" | "nonconference" | "rivalry" | "conference-championship" | "playoff" | "bowl";
export type EcosystemGameStatus = "scheduled" | "complete";
export type EcosystemPostseasonStage = "regular-season" | "conference-championships" | "quarterfinals" | "semifinals" | "national-championship" | "complete";
export type EcosystemAwardKind = "player-of-week" | "conference-player" | "national-player" | "position-award" | "all-american";

export interface EcosystemCompetitionGame {
  id: string;
  seasonYear: number;
  week: number;
  kind: EcosystemGameKind;
  homeTeamId: string;
  awayTeamId: string;
  neutralSite: boolean;
  conferenceGame: boolean;
  rivalryId?: string | undefined;
  status: EcosystemGameStatus;
  homeScore?: number | undefined;
  awayScore?: number | undefined;
  winnerTeamId?: string | undefined;
  loserTeamId?: string | undefined;
  upset?: boolean | undefined;
}

export interface EcosystemNationalRanking {
  seasonYear: number;
  week: number;
  teamId: string;
  rank: number;
  previousRank?: number | undefined;
  score: number;
  strengthOfSchedule: number;
  qualityWins: number;
  pointDifferential: number;
}

export interface EcosystemRankingSnapshot {
  seasonYear: number;
  week: number;
  rankings: EcosystemNationalRanking[];
}

export interface EcosystemPlayoffState {
  seasonYear: number;
  stage: EcosystemPostseasonStage;
  seedTeamIds: string[];
  gameIds: string[];
  championTeamId?: string | undefined;
}

export interface EcosystemCompetitionAward {
  id: string;
  seasonYear: number;
  week?: number | undefined;
  kind: EcosystemAwardKind;
  playerId: string;
  teamId: string;
  title: string;
  detail: string;
}

export interface EcosystemRivalry {
  id: string;
  name: string;
  teamAId: string;
  teamBId: string;
  intensity: number;
  meetings: number;
  winsA: number;
  winsB: number;
  ties: number;
  streak: number;
  lastWinnerTeamId?: string | undefined;
}

export interface EcosystemProgramLegacy {
  teamId: string;
  allTimeWins: number;
  allTimeLosses: number;
  nationalTitles: number;
  playoffAppearances: number;
  bowlWins: number;
  rivalryWins: number;
  bestRank: number;
  reputation: number;
  eraLabel: "unknown" | "building" | "contender" | "power" | "dynasty" | "decline";
}

export interface EcosystemCompetitionState {
  version: 1;
  seasonYear: number;
  schedule: EcosystemCompetitionGame[];
  rankings: EcosystemNationalRanking[];
  rankingHistory: EcosystemRankingSnapshot[];
  playoff: EcosystemPlayoffState;
  awards: EcosystemCompetitionAward[];
  rivalries: EcosystemRivalry[];
  programLegacies: EcosystemProgramLegacy[];
  digest: string[];
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
  position: FootballRosterPosition;
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
  fromPosition: FootballRosterPosition;
  toPosition: FootballRosterPosition;
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
  positionProjections: Record<FootballRosterPosition, EcosystemPositionProjection>;
  lastReviewReason: string;
}

export interface EcosystemRolePriority {
  primary: EcosystemPositionRole;
  secondary: EcosystemPositionRole;
}

export interface EcosystemTacticalIdentity {
  version: 1;
  offenseSystem: EcosystemOffenseSystem;
  defenseSystem: EcosystemDefenseSystem;
  tempo: EcosystemTacticalTempo;
  offensiveAggression: EcosystemTacticalAggression;
  defensiveAggression: EcosystemTacticalAggression;
  complexity: number;
  installation: number;
  continuity: number;
  rotationDepth: number;
  headCoachFingerprint: string;
  offensiveCoordinatorFingerprint: string;
  defensiveCoordinatorFingerprint: string;
  staffFingerprint: string;
  runRate: number;
  playActionRate: number;
  screenRate: number;
  deepShotRate: number;
  blitzRate: number;
  manCoverageRate: number;
  disguiseRate: number;
  fourthDownAggression: number;
  adaptation: number;
  positionRoles: Record<FootballRosterPosition, EcosystemRolePriority>;
}

export interface EcosystemPlayerTacticalProfile {
  version: 1;
  archetype: EcosystemPlayerArchetype;
  preferredRole: EcosystemPositionRole;
  secondaryRole: EcosystemPositionRole;
  schemeFit: number;
  roleFit: number;
  learning: number;
  versatility: number;
  lastEvaluatedSeason: number;
  lastCoachFingerprint?: string | undefined;
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
  tactical: EcosystemTacticalIdentity;
}

export interface EcosystemPlayer {
  id: string;
  seed: string;
  name: string;
  teamId: string;
  level: EcosystemLevel;
  age: number;
  classYear: "Freshman" | "Sophomore" | "Junior" | "Senior";
  position: FootballRosterPosition;
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
  positionHistory: FootballRosterPosition[];
  tactical: EcosystemPlayerTacticalProfile;
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
  tactics: number;
  adaptability: number;
  gameManagement: number;
  temperament: EcosystemCoachTemperament;
  offenseSystem: EcosystemOffenseSystem;
  defenseSystem: EcosystemDefenseSystem;
  specialtyPositions: FootballRosterPosition[];
  contractYears: number;
  annualSalary: number;
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

export type EcosystemHistorySourceType = "story" | "transaction";
export type EcosystemObjectiveOwnerKind = "team" | "player" | "coach";
export type EcosystemObjectiveKind = "win-target" | "rebuild-program" | "protect-job" | "build-program" | "earn-starting-role" | "breakout-season";
export type EcosystemObjectiveStatus = "active" | "achieved" | "failed";
export type EcosystemStoryArcKind = "player-rise" | "career-crossroads" | "coach-tenure" | "team-run" | "rivalry-era" | "program-rebuild";
export type EcosystemStoryArcStatus = "emerging" | "active" | "resolved";

export interface EcosystemHistoryFact {
  id: string;
  sourceType: EcosystemHistorySourceType;
  sourceId: string;
  seasonYear: number;
  week: number;
  createdOn: GameDate;
  kind: EcosystemStoryKind | EcosystemTransactionKind;
  title: string;
  detail: string;
  importance: 1 | 2 | 3 | 4 | 5;
  teamIds: string[];
  playerIds: string[];
  coachIds: string[];
  relatedToHero: boolean;
}

export interface EcosystemObjective {
  id: string;
  ownerKind: EcosystemObjectiveOwnerKind;
  ownerId: string;
  kind: EcosystemObjectiveKind;
  status: EcosystemObjectiveStatus;
  createdSeasonYear: number;
  createdWeek: number;
  targetSeasonYear: number;
  progress: number;
  target: number;
  title: string;
  detail: string;
  evidenceFactIds: string[];
  completedSeasonYear?: number | undefined;
  completedWeek?: number | undefined;
}

export interface EcosystemStoryArc {
  id: string;
  kind: EcosystemStoryArcKind;
  status: EcosystemStoryArcStatus;
  title: string;
  summary: string;
  teamIds: string[];
  playerIds: string[];
  coachIds: string[];
  startedSeasonYear: number;
  startedWeek: number;
  lastSeasonYear: number;
  lastWeek: number;
  momentum: number;
  chapters: number;
  factIds: string[];
  relatedToHero: boolean;
}

export interface EcosystemHistoryState {
  version: 1;
  lastProcessedSeasonYear: number;
  lastProcessedWeek: number;
  processedSourceIds: string[];
  facts: EcosystemHistoryFact[];
  objectives: EcosystemObjective[];
  arcs: EcosystemStoryArc[];
  digest: string[];
}

export type EcosystemAgencyActorKind = "team" | "player" | "coach";
export type EcosystemConflictKind = "role" | "scheme-fit" | "trust" | "results" | "finances" | "staff-direction";
export type EcosystemConflictStage = "concern" | "meeting" | "ultimatum" | "resolved";
export type EcosystemDecisionKind =
  | "player-role-push"
  | "player-portal-entry"
  | "team-roster-reset"
  | "team-tactical-shift"
  | "coach-staff-reshuffle"
  | "coach-contract-ultimatum";

export interface EcosystemConflict {
  id: string;
  actorKind: EcosystemAgencyActorKind;
  actorId: string;
  teamId: string;
  kind: EcosystemConflictKind;
  stage: EcosystemConflictStage;
  pressure: number;
  createdSeasonYear: number;
  createdWeek: number;
  lastSeasonYear: number;
  lastWeek: number;
  evidenceFactIds: string[];
  decisionIds: string[];
  relatedToHero: boolean;
  resolvedSeasonYear?: number | undefined;
  resolvedWeek?: number | undefined;
}

export interface EcosystemAgencyDecision {
  id: string;
  kind: EcosystemDecisionKind;
  actorKind: EcosystemAgencyActorKind;
  actorId: string;
  teamId: string;
  seasonYear: number;
  week: number;
  createdOn: GameDate;
  conflictId: string;
  sourceObjectiveId?: string | undefined;
  title: string;
  detail: string;
  consequence: string;
  teamIds: string[];
  playerIds: string[];
  coachIds: string[];
  relatedToHero: boolean;
}

export interface EcosystemAgencyState {
  version: 1;
  lastProcessedSeasonYear: number;
  lastProcessedWeek: number;
  conflicts: EcosystemConflict[];
  decisions: EcosystemAgencyDecision[];
  processedDecisionKeys: string[];
  digest: string[];
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
  activeNegotiations: number;
  withdrawnOffers: number;
  transferCandidates: number;
  lowSchemeFitPlayers: number;
  programsInstallingNewSystems: number;
}


export type EcosystemSocialEntityKind = "player" | "coach";
export type EcosystemSocialBondKind = "teammate" | "position-rival" | "mentor" | "coach-player" | "staff";
export type EcosystemSocialIncidentKind = "mentorship" | "locker-room-conflict" | "leadership" | "reconciliation" | "staff-friction" | "broken-promise";

export interface EcosystemSocialBond {
  id: string;
  entityAId: string;
  entityBId: string;
  entityAKind: EcosystemSocialEntityKind;
  entityBKind: EcosystemSocialEntityKind;
  teamId?: string | undefined;
  kind: EcosystemSocialBondKind;
  trust: number;
  respect: number;
  chemistry: number;
  tension: number;
  influence: number;
  familiarityWeeks: number;
  active: boolean;
  lastSeasonYear: number;
  lastWeek: number;
}

export interface EcosystemTeamCulture {
  teamId: string;
  cohesion: number;
  accountability: number;
  coachTrust: number;
  leadership: number;
  conflict: number;
  morale: number;
  stability: number;
  lastSeasonYear: number;
  lastWeek: number;
}

export interface EcosystemSocialIncident {
  id: string;
  kind: EcosystemSocialIncidentKind;
  seasonYear: number;
  week: number;
  teamId: string;
  participantIds: string[];
  title: string;
  detail: string;
  impact: number;
}

export interface EcosystemSocialState {
  version: 1;
  seasonYear: number;
  lastProcessedDay: number;
  bonds: EcosystemSocialBond[];
  teamCultures: EcosystemTeamCulture[];
  incidents: EcosystemSocialIncident[];
  digest: string[];
}

export interface FootballEcosystemState {
  moduleVersion: typeof ECOSYSTEM_MODULE_VERSION;
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
  movementMarket: EcosystemUnifiedMovementMarket;
  competition: EcosystemCompetitionState;
  social: EcosystemSocialState;
  careerRegistry: EcosystemCareerRegistry;
  worldHistory: EcosystemHistoryState;
  agency: EcosystemAgencyState;
}

