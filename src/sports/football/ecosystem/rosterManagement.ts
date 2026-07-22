import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import type { WorldConstitution } from "./constitution";
import type {
  EcosystemCoach,
  EcosystemPlayer,
  EcosystemPositionChangePlan,
  EcosystemPositionProjection,
  EcosystemRosterPlan,
  EcosystemRosterStrategy,
  EcosystemScholarshipDecision,
  EcosystemTeam,
  EcosystemUsagePlan,
} from "./types";

const POSITIONS = ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[];

const POSITION_CHANGE_OPTIONS: Record<FootballPosition, readonly FootballPosition[]> = {
  QB: ["WR"],
  RB: ["WR", "LB"],
  WR: ["CB", "RB"],
  LB: ["RB"],
  CB: ["WR"],
};

export interface RosterManagementDraft {
  kind: "roster-plan" | "position-change" | "redshirt" | "scholarship";
  title: string;
  detail: string;
  importance: 1 | 2 | 3 | 4 | 5;
  teamId: string;
  playerId?: string | undefined;
}

export interface RosterManagementResult {
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  drafts: RosterManagementDraft[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function yearsRemaining(player: EcosystemPlayer, seasonYear: number): number {
  if (player.level !== "college") return player.classYear === "Senior" ? 0 : player.classYear === "Junior" ? 1 : player.classYear === "Sophomore" ? 2 : 3;
  return Math.max(0, player.eligibility.windowEndYear - seasonYear);
}

function playerScore(player: EcosystemPlayer): number {
  const availability = player.status === "injured" || !player.eligibility.athleticallyEligible ? -25 : 0;
  return player.overall * 0.58 + player.form * 0.2 + player.health * 0.1 + player.potential * 0.12 + availability;
}

function strategyFor(team: EcosystemTeam, players: EcosystemPlayer[], coach: EcosystemCoach | undefined): EcosystemRosterStrategy {
  if (team.level === "high-school") return "develop";
  const collegePlayers = players.filter((player) => player.teamId === team.id);
  const youngShare = collegePlayers.length > 0
    ? collegePlayers.filter((player) => player.classYear === "Freshman" || player.classYear === "Sophomore").length / collegePlayers.length
    : 0;
  const projectedDepartures = collegePlayers.filter((player) => yearsRemaining(player, team.rosterPlan.seasonYear) <= 1).length;
  const pressure = Math.max(coach?.pressure ?? 40, 100 - (coach?.jobSecurity ?? 60));
  if (pressure >= 68 || team.expectation >= 78) return "contend";
  if (team.rating + 8 < team.expectation || projectedDepartures >= Math.max(4, collegePlayers.length * 0.3)) return "rebuild";
  if (youngShare >= 0.55 && team.resources.facilitiesLevel >= 62) return "develop";
  return "balanced";
}

function emptyProjection(position: FootballPosition): EcosystemPositionProjection {
  return {
    position,
    currentPlayers: 0,
    returningNextYear: 0,
    returningInTwoYears: 0,
    projectedDepartures: 0,
    scholarshipPlayers: 0,
    averageOverall: 0,
    bestOverall: 0,
    averagePotential: 0,
    needNow: 50,
    needNextYear: 50,
    targetAdds: 1,
  };
}

export function createEmptyRosterPlan(team: Pick<EcosystemTeam, "level" | "compliance" | "positionNeeds">, seasonYear: number): EcosystemRosterPlan {
  const positionProjections = Object.fromEntries(POSITIONS.map((position) => [position, {
    ...emptyProjection(position),
    needNow: team.positionNeeds[position],
    needNextYear: team.positionNeeds[position],
  }])) as Record<FootballPosition, EcosystemPositionProjection>;
  return {
    version: 1,
    seasonYear,
    reviewedWeek: 0,
    strategy: team.level === "college" ? "balanced" : "develop",
    planningHorizonYears: 3,
    targetClassSize: team.level === "college" ? 18 : 10,
    availableRosterSpots: Math.max(0, team.compliance.rosterLimit - team.compliance.estimatedRosterSize),
    availableScholarships: Math.max(0, team.compliance.fundedScholarships - team.compliance.scholarshipsUsed),
    projectedDepartures: 0,
    retentionRisk: 0,
    redshirtPlayerIds: [],
    developmentalPlayerIds: [],
    positionChanges: [],
    scholarshipDecisions: [],
    positionProjections,
    lastReviewReason: "Первичный план состава ещё не пересмотрен штабом.",
  };
}

function positionProjection(
  team: EcosystemTeam,
  position: FootballPosition,
  room: EcosystemPlayer[],
  seasonYear: number,
  strategy: EcosystemRosterStrategy,
): EcosystemPositionProjection {
  const returningNextYear = room.filter((player) => yearsRemaining(player, seasonYear) >= 1).length;
  const returningInTwoYears = room.filter((player) => yearsRemaining(player, seasonYear) >= 2).length;
  const projectedDepartures = room.filter((player) => yearsRemaining(player, seasonYear) <= 1).length;
  const scholarshipPlayers = room.filter((player) => player.eligibility.scholarshipStatus !== "none").length;
  const averageOverall = average(room.map((player) => player.overall));
  const bestOverall = room.length > 0 ? Math.max(...room.map((player) => player.overall)) : 0;
  const averagePotential = average(room.map((player) => player.potential));
  const desiredDetailedDepth = team.level === "college" ? (position === "WR" || position === "CB" ? 4 : 3) : 2;
  const shortageNow = Math.max(0, desiredDetailedDepth - room.length);
  const shortageNext = Math.max(0, desiredDetailedDepth - returningNextYear);
  const qualityNeed = clamp((team.expectation - bestOverall) * 1.35 + (72 - averageOverall) * 0.7, 0, 65);
  const strategyBoost = strategy === "contend" ? 9 : strategy === "rebuild" ? 6 : strategy === "develop" ? 2 : 4;
  const needNow = clamp(team.positionNeeds[position] * 0.38 + shortageNow * 22 + qualityNeed * 0.44 + strategyBoost, 5, 98);
  const needNextYear = clamp(needNow * 0.48 + shortageNext * 27 + projectedDepartures * 12 + (78 - averagePotential) * 0.25, 5, 99);
  const targetAdds = Math.max(0, Math.min(3, Math.ceil((needNextYear - 30) / 25) + (shortageNext > 0 ? 1 : 0)));
  return {
    position,
    currentPlayers: room.length,
    returningNextYear,
    returningInTwoYears,
    projectedDepartures,
    scholarshipPlayers,
    averageOverall: clamp(averageOverall),
    bestOverall: clamp(bestOverall),
    averagePotential: clamp(averagePotential),
    needNow,
    needNextYear,
    targetAdds,
  };
}

function usageForPlayer(player: EcosystemPlayer, redshirtIds: Set<string>, developmentalIds: Set<string>): EcosystemUsagePlan {
  if (redshirtIds.has(player.id)) return "redshirt";
  if (developmentalIds.has(player.id)) return "developmental";
  if (player.depthRank === 1) return "starter";
  if (player.depthRank === 2) return "rotation";
  if (player.depthRank === 3 && player.form >= 62 && player.health >= 72) return "special-teams";
  return "developmental";
}

function choosePositionChanges(
  team: EcosystemTeam,
  players: EcosystemPlayer[],
  projections: Record<FootballPosition, EcosystemPositionProjection>,
  random: SeededRandom,
  excludedPlayerIds: ReadonlySet<string>,
): EcosystemPositionChangePlan[] {
  if (team.level !== "college") return [];
  const targets = POSITIONS
    .filter((position) => projections[position].needNextYear >= 62)
    .sort((left, right) => projections[right].needNextYear - projections[left].needNextYear);
  const plans: EcosystemPositionChangePlan[] = [];
  for (const target of targets) {
    const candidates = players
      .filter((player) => player.teamId === team.id
        && !player.isHero
        && !excludedPlayerIds.has(player.id)
        && player.depthRank >= 3
        && player.classYear !== "Senior"
        && POSITION_CHANGE_OPTIONS[player.position].includes(target)
        && projections[player.position].currentPlayers > Math.max(2, projections[player.position].targetAdds + 1))
      .sort((left, right) => (right.potential + right.form * 0.25) - (left.potential + left.form * 0.25));
    const candidate = candidates[0];
    if (!candidate || plans.some((plan) => plan.playerId === candidate.id)) continue;
    if (projections[target].needNextYear < 82 && !random.fork(`${candidate.id}:${target}`).chance(0.58)) continue;
    plans.push({
      playerId: candidate.id,
      fromPosition: candidate.position,
      toPosition: target,
      reason: `${candidate.position} перегружена, а ${target} теряет глубину в горизонте двух сезонов.`,
      applied: false,
    });
    if (plans.length >= 2) break;
  }
  return plans;
}

function scholarshipDecisions(
  team: EcosystemTeam,
  players: EcosystemPlayer[],
  availableScholarships: number,
): EcosystemScholarshipDecision[] {
  if (team.level !== "college" || availableScholarships <= 0) return [];
  return players
    .filter((player) => player.teamId === team.id
      && player.eligibility.scholarshipStatus !== "full"
      && player.eligibility.academicStanding !== "ineligible"
      && player.depthRank <= 2
      && player.overall >= 66)
    .sort((left, right) => playerScore(right) - playerScore(left))
    .slice(0, Math.min(2, availableScholarships))
    .map((player) => ({
      playerId: player.id,
      previousStatus: player.eligibility.scholarshipStatus,
      nextStatus: player.overall >= 74 || player.isHero ? "full" : "partial",
      reason: `${player.name} удерживает роль в верхней части depth chart и оправдывает вложение доступной стипендии.`,
    }));
}

export function buildRosterPlan(
  team: EcosystemTeam,
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
  random: SeededRandom,
  reason: string,
): EcosystemRosterPlan {
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const headCoach = coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
  const provisionalTeam = { ...team, rosterPlan: { ...team.rosterPlan, seasonYear } };
  const strategy = strategyFor(provisionalTeam, teamPlayers, headCoach);
  const positionProjections = Object.fromEntries(POSITIONS.map((position) => [
    position,
    positionProjection(team, position, teamPlayers.filter((player) => player.position === position), seasonYear, strategy),
  ])) as Record<FootballPosition, EcosystemPositionProjection>;
  const availableRosterSpots = Math.max(0, team.compliance.rosterLimit - team.compliance.estimatedRosterSize);
  const availableScholarships = Math.max(0, team.compliance.fundedScholarships - team.compliance.scholarshipsUsed);
  const projectedDepartures = teamPlayers.filter((player) => yearsRemaining(player, seasonYear) <= 1).length;
  const deepBackups = teamPlayers.filter((player) => player.depthRank >= 4 || (player.depthRank >= 3 && player.classYear !== "Freshman"));
  const retentionRisk = clamp(
    average(deepBackups.map((player) => 42 + Math.max(0, player.overall - 68) * 1.7 + Math.max(0, player.potential - player.overall) * 0.8))
      + team.resources.financialPressure * 0.18,
  );
  const redshirtPlayerIds = teamPlayers
    .filter((player) => player.level === "college"
      && player.eligibility.model === "legacy-four-in-five"
      && !player.eligibility.redshirtUsed
      && player.depthRank >= 3
      && player.classYear !== "Senior")
    .sort((left, right) => right.potential - left.potential)
    .slice(0, strategy === "develop" || strategy === "rebuild" ? 3 : 1)
    .map((player) => player.id);
  const developmentalPlayerIds = teamPlayers
    .filter((player) => player.level === "college"
      && player.eligibility.model === "age-based-five-year"
      && player.depthRank >= 3
      && player.classYear !== "Senior"
      && player.potential >= player.overall + 5)
    .sort((left, right) => right.potential - left.potential)
    .slice(0, strategy === "develop" || strategy === "rebuild" ? 4 : 2)
    .map((player) => player.id);
  const protectedDevelopmentIds = new Set([...redshirtPlayerIds, ...developmentalPlayerIds]);
  const positionChanges = choosePositionChanges(team, teamPlayers, positionProjections, random.fork("position-changes"), protectedDevelopmentIds);
  const scholarshipPlan = scholarshipDecisions(team, teamPlayers, availableScholarships);
  const rawClassSize = POSITIONS.reduce((sum, position) => sum + positionProjections[position].targetAdds, 0);
  const targetClassSize = Math.max(0, Math.min(
    team.level === "college" ? 28 : 15,
    rawClassSize + Math.ceil(projectedDepartures * 0.45),
    Math.max(0, availableRosterSpots + projectedDepartures),
  ));
  return {
    version: 1,
    seasonYear,
    reviewedWeek: week,
    strategy,
    planningHorizonYears: 3,
    targetClassSize,
    availableRosterSpots,
    availableScholarships,
    projectedDepartures,
    retentionRisk,
    redshirtPlayerIds,
    developmentalPlayerIds,
    positionChanges,
    scholarshipDecisions: scholarshipPlan,
    positionProjections,
    lastReviewReason: reason,
  };
}

export function reviewRosterManagement(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  constitution: WorldConstitution,
  seasonYear: number,
  week: number,
  random: SeededRandom,
  options: { applyOffseasonDecisions: boolean; reason: string },
): RosterManagementResult {
  let nextPlayers = [...players];
  const drafts: RosterManagementDraft[] = [];
  const nextTeams = teams.map((team) => {
    const plan = buildRosterPlan(team, nextPlayers, coaches, seasonYear, week, random.fork(team.id), options.reason);
    const classShift = Math.abs(plan.targetClassSize - team.rosterPlan.targetClassSize);
    const departureShift = Math.abs(plan.projectedDepartures - team.rosterPlan.projectedDepartures);
    if (team.level === "college" && (plan.strategy !== team.rosterPlan.strategy || classShift >= 4 || departureShift >= 3)) {
      const urgent = POSITIONS
        .map((position) => plan.positionProjections[position])
        .sort((left, right) => right.needNextYear - left.needNextYear)[0];
      drafts.push({
        kind: "roster-plan",
        title: `${team.shortName} пересмотрел план состава`,
        detail: `${team.name}: стратегия — ${plan.strategy}, целевой класс — ${plan.targetClassSize}, ожидаемые уходы — ${plan.projectedDepartures}. Главная будущая потребность: ${urgent?.position ?? "не определена"}.`,
        importance: plan.strategy !== team.rosterPlan.strategy ? 3 : 2,
        teamId: team.id,
      });
    }
    const redshirts = new Set(plan.redshirtPlayerIds);
    const developmental = new Set(plan.developmentalPlayerIds);

    nextPlayers = nextPlayers.map((player) => player.teamId === team.id
      ? { ...player, usagePlan: usageForPlayer(player, redshirts, developmental) }
      : player);

    if (options.applyOffseasonDecisions && team.level === "college") {
      for (const change of plan.positionChanges) {
        const index = nextPlayers.findIndex((player) => player.id === change.playerId && player.teamId === team.id);
        if (index < 0) continue;
        const player = nextPlayers[index]!;
        nextPlayers[index] = {
          ...player,
          position: change.toPosition,
          overall: clamp(player.overall - 1 + random.fork(`fit:${player.id}`).integer(-1, 2), 40, 99),
          depthRank: 4,
          status: "backup",
          usagePlan: "developmental",
          positionHistory: [...player.positionHistory, player.position].slice(-6),
        };
        change.applied = true;
        drafts.push({
          kind: "position-change",
          title: `${player.name} меняет позицию`,
          detail: `${team.shortName} переводит ${player.name} с ${player.position} на ${change.toPosition}. ${change.reason}`,
          importance: player.isHero ? 5 : 3,
          teamId: team.id,
          playerId: player.id,
        });
      }

      for (const decision of plan.scholarshipDecisions) {
        const index = nextPlayers.findIndex((player) => player.id === decision.playerId && player.teamId === team.id);
        if (index < 0) continue;
        const player = nextPlayers[index]!;
        nextPlayers[index] = {
          ...player,
          eligibility: { ...player.eligibility, scholarshipStatus: decision.nextStatus },
        };
        drafts.push({
          kind: "scholarship",
          title: `${player.name} получил спортивную помощь`,
          detail: `${team.shortName} повысил статус ${player.name}: ${decision.previousStatus} → ${decision.nextStatus}.`,
          importance: player.isHero ? 5 : 2,
          teamId: team.id,
          playerId: player.id,
        });
      }

      if (plan.redshirtPlayerIds.length > 0) {
        drafts.push({
          kind: "redshirt",
          title: `${team.shortName} сохраняет развитие молодых`,
          detail: `${team.name} ограничит участие ${plan.redshirtPlayerIds.length} legacy-игрок(ов), чтобы сохранить сезон eligibility. Новые пятилетние игроки получают developmental-year без продления окна.`,
          importance: 2,
          teamId: team.id,
        });
      }
    }

    const needs = { ...team.positionNeeds };
    for (const position of POSITIONS) {
      needs[position] = clamp(plan.positionProjections[position].needNextYear);
    }
    return { ...team, positionNeeds: needs, rosterPlan: plan };
  });

  const refreshedTeams = nextTeams.map((team) => ({
    ...team,
    compliance: team.level === "college"
      ? {
          ...team.compliance,
          estimatedRosterSize: Math.min(team.compliance.rosterLimit, Math.max(team.rosterIds.length, team.compliance.estimatedRosterSize)),
          scholarshipsUsed: Math.min(
            team.compliance.fundedScholarships,
            Math.round(nextPlayers.filter((player) => player.teamId === team.id).reduce((sum, player) => sum + (player.eligibility.scholarshipStatus === "full" ? 1 : player.eligibility.scholarshipStatus === "partial" ? 0.5 : 0), 0)),
          ),
          status: team.compliance.estimatedRosterSize > constitution.collegeRosterLimit ? "violation" : team.compliance.status,
        }
      : team.compliance,
  }));

  return { teams: refreshedTeams, players: nextPlayers, drafts };
}
