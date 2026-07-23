import type { GameDate } from "../../../core/calendar/types";
import { addGameDays } from "./constitution";
import { advanceFootballEcosystem } from "./simulateEcosystem";
import type { EcosystemCoach, EcosystemPlayer, EcosystemTeam, FootballEcosystemState } from "./types";

type EcosystemSimulationSave = Parameters<typeof advanceFootballEcosystem>[0];

export type EcosystemInvariantCode =
  | "duplicate-id"
  | "missing-reference"
  | "roster-membership"
  | "coach-membership"
  | "coach-structure"
  | "conference-membership"
  | "roster-limit"
  | "scholarship-limit"
  | "invalid-number"
  | "invalid-range"
  | "competition-balance"
  | "competition-reference"
  | "history-bound";

export interface EcosystemInvariantIssue {
  code: EcosystemInvariantCode;
  scope: string;
  detail: string;
}

export interface EcosystemStabilityViolation extends EcosystemInvariantIssue {
  checkpoint: number;
  seasonYear: number;
}

export interface EcosystemSeasonSnapshot {
  checkpoint: number;
  seasonYear: number;
  date: GameDate;
  teams: number;
  collegeTeams: number;
  players: number;
  highSchoolPlayers: number;
  collegePlayers: number;
  coaches: number;
  activeNegotiations: number;
  portalPlayers: number;
  nationallyExposedProspects: number;
  programsUnderFinancialPressure: number;
  uniqueNationalChampions: number;
  totalNationalTitles: number;
  averageProgramReputation: number;
  averageCollegeRating: number;
  minCollegeRoster: number;
  maxCollegeRoster: number;
  hotSeatCoaches: number;
  movedCoaches: number;
  coachingChanges: number;
  transfers: number;
}

export interface EcosystemStabilityReport {
  requestedSeasons: number;
  completedSeasons: number;
  startDate: GameDate;
  endDate: GameDate;
  initialSeasonYear: number;
  finalSeasonYear: number;
  snapshots: EcosystemSeasonSnapshot[];
  violations: EcosystemStabilityViolation[];
  minPlayerPopulation: number;
  maxPlayerPopulation: number;
  uniqueNationalChampions: number;
  totalNationalTitles: number;
  totalCoachingChanges: number;
  totalTransfers: number;
}

export interface EcosystemStabilityResult<T extends EcosystemSimulationSave> {
  save: T;
  report: EcosystemStabilityReport;
}

function dateKey(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function daysBetween(left: GameDate, right: GameDate): number {
  const leftUtc = Date.UTC(left.year, left.month - 1, left.day);
  const rightUtc = Date.UTC(right.year, right.month - 1, right.day);
  return Math.round((rightUtc - leftUtc) / 86_400_000);
}

function uniqueIssues<T>(items: T[], id: (item: T) => string, scope: string): EcosystemInvariantIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    const value = id(item);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].map((value) => ({
    code: "duplicate-id",
    scope,
    detail: `${scope}: повторяется id ${value}.`,
  }));
}

function sameMembers(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return leftSet.size === right.length && right.every((value) => leftSet.has(value));
}

function finiteIssue(value: number, scope: string): EcosystemInvariantIssue | undefined {
  return Number.isFinite(value)
    ? undefined
    : { code: "invalid-number", scope, detail: `${scope}: получено нечисловое значение ${String(value)}.` };
}

function rangeIssue(value: number, min: number, max: number, scope: string): EcosystemInvariantIssue | undefined {
  const finite = finiteIssue(value, scope);
  if (finite) return finite;
  return value < min || value > max
    ? { code: "invalid-range", scope, detail: `${scope}: ${value} вне диапазона ${min}–${max}.` }
    : undefined;
}

function teamIssues(team: EcosystemTeam, players: EcosystemPlayer[], coaches: EcosystemCoach[]): EcosystemInvariantIssue[] {
  const issues: EcosystemInvariantIssue[] = [];
  const rosterIds = players.filter((player) => player.teamId === team.id).map((player) => player.id);
  const coachIds = coaches.filter((coach) => coach.teamId === team.id).map((coach) => coach.id);

  if (!sameMembers(team.rosterIds, rosterIds)) {
    issues.push({
      code: "roster-membership",
      scope: team.id,
      detail: `${team.shortName}: rosterIds не совпадает с фактическими игроками (${team.rosterIds.length}/${rosterIds.length}).`,
    });
  }
  if (!sameMembers(team.coachIds, coachIds)) {
    issues.push({
      code: "coach-membership",
      scope: team.id,
      detail: `${team.shortName}: coachIds не совпадает с фактическим штабом (${team.coachIds.length}/${coachIds.length}).`,
    });
  }
  const teamCoaches = coaches.filter((coach) => coach.teamId === team.id);
  const headCoaches = teamCoaches.filter((coach) => coach.role === "head-coach").length;
  const coordinators = teamCoaches.filter((coach) => coach.role === "coordinator").length;
  if (headCoaches !== 1 || coordinators !== 1) {
    issues.push({
      code: "coach-structure",
      scope: team.id,
      detail: `${team.shortName}: структура штаба нарушена, head-coach ${headCoaches}, coordinator ${coordinators}.`,
    });
  }
  if (rosterIds.length > team.compliance.rosterLimit || team.compliance.estimatedRosterSize > team.compliance.rosterLimit) {
    issues.push({
      code: "roster-limit",
      scope: team.id,
      detail: `${team.shortName}: состав ${rosterIds.length}, оценка ${team.compliance.estimatedRosterSize}, лимит ${team.compliance.rosterLimit}.`,
    });
  }
  if (team.compliance.scholarshipsUsed > team.compliance.fundedScholarships || team.compliance.fundedScholarships > team.compliance.scholarshipLimit) {
    issues.push({
      code: "scholarship-limit",
      scope: team.id,
      detail: `${team.shortName}: использовано ${team.compliance.scholarshipsUsed}, профинансировано ${team.compliance.fundedScholarships}, лимит ${team.compliance.scholarshipLimit}.`,
    });
  }

  const ranges: Array<[number, number, number, string]> = [
    [team.prestige, 0, 100, `${team.id}.prestige`],
    [team.rating, 0, 100, `${team.id}.rating`],
    [team.expectation, 0, 100, `${team.id}.expectation`],
    [team.resources.financialPressure, 0, 100, `${team.id}.financialPressure`],
    [team.resources.donorConfidence, 0, 100, `${team.id}.donorConfidence`],
    [team.resources.boardPatience, 0, 100, `${team.id}.boardPatience`],
    [team.tactical.installation, 0, 100, `${team.id}.installation`],
    [team.tactical.continuity, 0, 100, `${team.id}.continuity`],
  ];
  for (const [value, min, max, scope] of ranges) {
    const issue = rangeIssue(value, min, max, scope);
    if (issue) issues.push(issue);
  }

  const finiteResources: Array<[number, string]> = [
    [team.resources.annualBudget, `${team.id}.annualBudget`],
    [team.resources.currentBalance, `${team.id}.currentBalance`],
    [team.resources.recruitingBudget, `${team.id}.recruitingBudget`],
    [team.resources.recruitingCommitted, `${team.id}.recruitingCommitted`],
    [team.resources.nilCapacity, `${team.id}.nilCapacity`],
    [team.resources.nilCommitted, `${team.id}.nilCommitted`],
  ];
  for (const [value, scope] of finiteResources) {
    const issue = finiteIssue(value, scope);
    if (issue) issues.push(issue);
  }
  return issues;
}

function playerIssues(player: EcosystemPlayer): EcosystemInvariantIssue[] {
  const issues: EcosystemInvariantIssue[] = [];
  const ranges: Array<[number, number, number, string]> = [
    [player.overall, 0, 100, `${player.id}.overall`],
    [player.potential, 0, 100, `${player.id}.potential`],
    [player.health, 0, 100, `${player.id}.health`],
    [player.form, 0, 100, `${player.id}.form`],
    [player.tactical.schemeFit, 0, 100, `${player.id}.schemeFit`],
    [player.tactical.roleFit, 0, 100, `${player.id}.roleFit`],
  ];
  for (const [value, min, max, scope] of ranges) {
    const issue = rangeIssue(value, min, max, scope);
    if (issue) issues.push(issue);
  }
  return issues;
}

export function inspectEcosystemInvariants(world: FootballEcosystemState): EcosystemInvariantIssue[] {
  const issues: EcosystemInvariantIssue[] = [];
  const teamIds = new Set(world.teams.map((team) => team.id));
  const playerIds = new Set(world.players.map((player) => player.id));
  const coachIds = new Set(world.coaches.map((coach) => coach.id));

  issues.push(...uniqueIssues(world.teams, (team) => team.id, "teams"));
  issues.push(...uniqueIssues(world.players, (player) => player.id, "players"));
  issues.push(...uniqueIssues(world.coaches, (coach) => coach.id, "coaches"));
  issues.push(...uniqueIssues(world.competition.schedule, (game) => game.id, "competition.schedule"));

  for (const player of world.players) {
    if (!teamIds.has(player.teamId)) {
      issues.push({ code: "missing-reference", scope: player.id, detail: `${player.name}: отсутствует команда ${player.teamId}.` });
    }
    issues.push(...playerIssues(player));
  }

  for (const coach of world.coaches) {
    if (!teamIds.has(coach.teamId)) {
      issues.push({ code: "missing-reference", scope: coach.id, detail: `${coach.name}: отсутствует команда ${coach.teamId}.` });
    }
    const reputationIssue = rangeIssue(coach.reputation, 0, 100, `${coach.id}.reputation`);
    if (reputationIssue) issues.push(reputationIssue);
  }

  for (const team of world.teams) {
    issues.push(...teamIssues(team, world.players, world.coaches));
    for (const id of team.rosterIds) {
      if (!playerIds.has(id)) issues.push({ code: "missing-reference", scope: team.id, detail: `${team.shortName}: отсутствует игрок ${id}.` });
    }
    for (const id of team.coachIds) {
      if (!coachIds.has(id)) issues.push({ code: "missing-reference", scope: team.id, detail: `${team.shortName}: отсутствует тренер ${id}.` });
    }
  }

  const collegeTeams = world.teams.filter((team) => team.level === "college");
  const conferenceTeamIds = world.conferences.flatMap((conference) => conference.teamIds);
  const conferenceSet = new Set(conferenceTeamIds);
  if (conferenceTeamIds.length !== conferenceSet.size || !sameMembers(conferenceTeamIds, collegeTeams.map((team) => team.id))) {
    issues.push({
      code: "conference-membership",
      scope: "conferences",
      detail: `Конференции содержат ${conferenceTeamIds.length} мест для ${collegeTeams.length} программ и не дают уникальное полное покрытие.`,
    });
  }

  for (const conference of world.conferences) {
    for (const teamId of conference.teamIds) {
      const team = world.teams.find((item) => item.id === teamId);
      if (!team || team.level !== "college" || team.conferenceId !== conference.id) {
        issues.push({
          code: "conference-membership",
          scope: conference.id,
          detail: `${conference.shortName}: некорректная привязка программы ${teamId}.`,
        });
      }
    }
  }

  for (const game of world.competition.schedule) {
    if (!teamIds.has(game.homeTeamId) || !teamIds.has(game.awayTeamId) || game.homeTeamId === game.awayTeamId) {
      issues.push({
        code: "competition-reference",
        scope: game.id,
        detail: `${game.id}: некорректные участники ${game.awayTeamId}/${game.homeTeamId}.`,
      });
    }
  }

  const collegeWins = collegeTeams.reduce((sum, team) => sum + team.wins, 0);
  const collegeLosses = collegeTeams.reduce((sum, team) => sum + team.losses, 0);
  if (collegeWins !== collegeLosses) {
    issues.push({
      code: "competition-balance",
      scope: `season-${world.seasonYear}`,
      detail: `Победы и поражения не сбалансированы: ${collegeWins}/${collegeLosses}.`,
    });
  }

  const bounds: Array<[number, number, string]> = [
    [world.stories.length, 90, "stories"],
    [world.transactions.length, 220, "transactions"],
    [world.teamHistory.length, 240, "teamHistory"],
    [world.competition.rankingHistory.length, 50, "competition.rankingHistory"],
    [world.competition.awards.length, 160, "competition.awards"],
    [world.talentPipeline.classHistory.length, 20, "talentPipeline.classHistory"],
    [world.movementMarket.negotiations.length, 180, "movementMarket.negotiations"],
    [world.movementMarket.coachVacancies.length, 60, "movementMarket.coachVacancies"],
  ];
  for (const [actual, maximum, scope] of bounds) {
    if (actual > maximum) {
      issues.push({ code: "history-bound", scope, detail: `${scope}: ${actual}, лимит ${maximum}.` });
    }
  }

  return issues;
}

function snapshot(
  world: FootballEcosystemState,
  checkpoint: number,
  coachingChanges: number,
  transfers: number,
): EcosystemSeasonSnapshot {
  const collegeTeams = world.teams.filter((team) => team.level === "college");
  const rosterSizes = collegeTeams.map((team) => world.players.filter((player) => player.teamId === team.id).length);
  const uniqueNationalChampions = world.competition.programLegacies.filter((legacy) => legacy.nationalTitles > 0).length;
  const totalNationalTitles = world.competition.programLegacies.reduce((sum, legacy) => sum + legacy.nationalTitles, 0);
  return {
    checkpoint,
    seasonYear: world.seasonYear,
    date: world.lastUpdatedOn,
    teams: world.teams.length,
    collegeTeams: collegeTeams.length,
    players: world.players.length,
    highSchoolPlayers: world.players.filter((player) => player.level === "high-school").length,
    collegePlayers: world.players.filter((player) => player.level === "college").length,
    coaches: world.coaches.length,
    activeNegotiations: world.market.activeNegotiations,
    portalPlayers: world.market.portalPlayers,
    nationallyExposedProspects: world.market.nationallyExposedProspects,
    programsUnderFinancialPressure: world.market.programsUnderFinancialPressure,
    uniqueNationalChampions,
    totalNationalTitles,
    averageProgramReputation: Math.round(world.competition.programLegacies.reduce((sum, legacy) => sum + legacy.reputation, 0) / Math.max(1, world.competition.programLegacies.length) * 10) / 10,
    averageCollegeRating: Math.round(collegeTeams.reduce((sum, team) => sum + team.rating, 0) / Math.max(1, collegeTeams.length) * 10) / 10,
    minCollegeRoster: Math.min(...rosterSizes),
    maxCollegeRoster: Math.max(...rosterSizes),
    hotSeatCoaches: world.coaches.filter((coach) => coach.role === "head-coach" && coach.status === "hot-seat").length,
    movedCoaches: world.coaches.filter((coach) => coach.previousTeamIds.length > 0).length,
    coachingChanges,
    transfers,
  };
}

export function runAutonomousStabilitySimulation<T extends EcosystemSimulationSave>(
  initialSave: T,
  requestedSeasons = 20,
): EcosystemStabilityResult<T> {
  if (!Number.isInteger(requestedSeasons) || requestedSeasons < 1 || requestedSeasons > 100) {
    throw new Error(`requestedSeasons must be an integer from 1 to 100, received ${requestedSeasons}`);
  }

  const startDate = initialSave.world.lastUpdatedOn;
  const baseCompletedDays = initialSave.world.lastSimulatedDay;
  let save = initialSave;
  const snapshots: EcosystemSeasonSnapshot[] = [];
  const violations: EcosystemStabilityViolation[] = [];
  let totalCoachingChanges = 0;
  let totalTransfers = 0;
  const observedTransactionIds = new Set(initialSave.world.transactions.map((transaction) => transaction.id));

  for (let checkpoint = 1; checkpoint <= requestedSeasons; checkpoint += 1) {
    const checkpointDate: GameDate = {
      year: startDate.year + checkpoint,
      month: startDate.month,
      day: startDate.day,
    };
    const elapsedDays = daysBetween(startDate, checkpointDate);
    const completedDays = baseCompletedDays + elapsedDays;
    const nextInput = {
      ...save,
      meta: {
        ...save.meta,
        currentDate: checkpointDate,
        updatedAt: `${dateKey(checkpointDate)}T00:00:00.000Z`,
      },
      life: {
        ...save.life,
        completedDays,
        weekNumber: Math.floor(completedDays / 7) + 1,
        dayIndex: completedDays % 7,
      },
    } as T;

    save = advanceFootballEcosystem(nextInput);
    const newTransactions = save.world.transactions.filter((transaction) => !observedTransactionIds.has(transaction.id));
    for (const transaction of save.world.transactions) observedTransactionIds.add(transaction.id);
    const coachingChanges = newTransactions.filter((transaction) => transaction.kind === "coach-hired").length;
    const transfers = newTransactions.filter((transaction) => transaction.kind === "transfer").length;
    const seasonSnapshot = snapshot(save.world, checkpoint, coachingChanges, transfers);
    snapshots.push(seasonSnapshot);
    totalCoachingChanges += coachingChanges;
    totalTransfers += transfers;
    violations.push(...inspectEcosystemInvariants(save.world).map((issue) => ({
      ...issue,
      checkpoint,
      seasonYear: save.world.seasonYear,
    })));
  }

  const playerCounts = snapshots.map((item) => item.players);
  const finalSnapshot = snapshots.at(-1);
  return {
    save,
    report: {
      requestedSeasons,
      completedSeasons: snapshots.length,
      startDate,
      endDate: save.world.lastUpdatedOn,
      initialSeasonYear: initialSave.world.seasonYear,
      finalSeasonYear: save.world.seasonYear,
      snapshots,
      violations,
      minPlayerPopulation: Math.min(...playerCounts),
      maxPlayerPopulation: Math.max(...playerCounts),
      uniqueNationalChampions: finalSnapshot?.uniqueNationalChampions ?? 0,
      totalNationalTitles: finalSnapshot?.totalNationalTitles ?? 0,
      totalCoachingChanges,
      totalTransfers,
    },
  };
}

export function advanceDateBySeasons(date: GameDate, seasons: number): GameDate {
  const target = { year: date.year + seasons, month: date.month, day: date.day };
  return addGameDays(date, daysBetween(date, target));
}
