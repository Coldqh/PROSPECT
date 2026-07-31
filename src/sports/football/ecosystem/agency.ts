import { SeededRandom } from "../../../core/random/SeededRandom";
import type { GameDate } from "../../../core/calendar/types";
import { POSITION_STARTER_TARGETS } from "../team/positions";
import type {
  EcosystemAgencyDecision,
  EcosystemAgencyState,
  EcosystemCoach,
  EcosystemConflict,
  EcosystemConflictKind,
  EcosystemConflictStage,
  EcosystemHistoryState,
  EcosystemObjective,
  EcosystemPlayer,
  EcosystemSocialState,
  EcosystemStory,
  EcosystemTeam,
  EcosystemTransaction,
} from "./types";

const MAX_CONFLICTS = 320;
const MAX_DECISIONS = 600;
const MAX_PROCESSED_DECISION_KEYS = 900;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function ordinal(seasonYear: number, week: number): number {
  return seasonYear * 32 + week;
}

function activeObjective(history: EcosystemHistoryState, ownerKind: EcosystemObjective["ownerKind"], ownerId: string): EcosystemObjective | undefined {
  return history.objectives.find((objective) => objective.ownerKind === ownerKind && objective.ownerId === ownerId && objective.status === "active");
}

function recentEvidence(history: EcosystemHistoryState, teamId: string, actorId: string): string[] {
  return history.facts
    .filter((fact) => fact.teamIds.includes(teamId) || fact.playerIds.includes(actorId) || fact.coachIds.includes(actorId))
    .slice(-6)
    .map((fact) => fact.id);
}

function conflictId(actorKind: EcosystemConflict["actorKind"], actorId: string, kind: EcosystemConflictKind, seasonYear: number, week: number, sequence: number): string {
  return `conflict:${actorKind}:${actorId}:${kind}:${seasonYear}:${week}:${sequence}`;
}

function canOpenConflict(
  conflicts: EcosystemConflict[],
  actorKind: EcosystemConflict["actorKind"],
  actorId: string,
  seasonYear: number,
  week: number,
): boolean {
  const latest = conflicts
    .filter((conflict) => conflict.actorKind === actorKind && conflict.actorId === actorId)
    .sort((left, right) => ordinal(right.lastSeasonYear, right.lastWeek) - ordinal(left.lastSeasonYear, left.lastWeek))[0];
  if (!latest) return true;
  if (latest.createdSeasonYear === seasonYear) return false;
  const cooldown = actorKind === "player" ? 6 : 10;
  return ordinal(seasonYear, week) - ordinal(latest.lastSeasonYear, latest.lastWeek) >= cooldown;
}

function initialConflict(input: {
  actorKind: EcosystemConflict["actorKind"];
  actorId: string;
  teamId: string;
  kind: EcosystemConflictKind;
  pressure: number;
  seasonYear: number;
  week: number;
  evidenceFactIds: string[];
  relatedToHero: boolean;
  sequence: number;
}): EcosystemConflict {
  return {
    id: conflictId(input.actorKind, input.actorId, input.kind, input.seasonYear, input.week, input.sequence),
    actorKind: input.actorKind,
    actorId: input.actorId,
    teamId: input.teamId,
    kind: input.kind,
    stage: "concern",
    pressure: clamp(input.pressure),
    createdSeasonYear: input.seasonYear,
    createdWeek: input.week,
    lastSeasonYear: input.seasonYear,
    lastWeek: input.week,
    evidenceFactIds: input.evidenceFactIds.slice(-8),
    decisionIds: [],
    relatedToHero: input.relatedToHero,
  };
}

function compactConflicts(conflicts: EcosystemConflict[]): EcosystemConflict[] {
  const retained: EcosystemConflict[] = [];
  const historicalKeys = new Set<string>();
  const activeActors = new Set<string>();
  for (const conflict of [...conflicts].reverse()) {
    const actorKey = `${conflict.actorKind}:${conflict.actorId}`;
    if (conflict.stage !== "resolved") {
      if (activeActors.has(actorKey)) continue;
      activeActors.add(actorKey);
      retained.push(conflict);
      continue;
    }
    const historicalKey = `${actorKey}:${conflict.createdSeasonYear}`;
    if (historicalKeys.has(historicalKey)) continue;
    historicalKeys.add(historicalKey);
    retained.push(conflict);
  }
  return retained.reverse().slice(-MAX_CONFLICTS);
}

export function createAgencyState(seasonYear: number, week: number): EcosystemAgencyState {
  return {
    version: 1,
    lastProcessedSeasonYear: seasonYear,
    lastProcessedWeek: week,
    conflicts: [],
    decisions: [],
    processedDecisionKeys: [],
    digest: ["Автономные участники оценивают роль, результаты, доверие и риск."],
  };
}

function playerEvaluation(player: EcosystemPlayer): number {
  return player.overall * 0.5
    + player.form * 0.18
    + player.health * 0.07
    + player.tactical.schemeFit * 0.15
    + player.tactical.roleFit * 0.1;
}

function playerHasAgencyLeverage(player: EcosystemPlayer, players: EcosystemPlayer[]): boolean {
  if (player.isHero) return true;
  const starterCount = POSITION_STARTER_TARGETS[player.position];
  if (player.depthRank <= starterCount + 3) return true;
  const room = players
    .filter((item) => item.teamId === player.teamId && item.position === player.position && item.transferStatus === "none")
    .sort((left, right) => left.depthRank - right.depthRank || playerEvaluation(right) - playerEvaluation(left));
  const starterCutoff = room[Math.max(0, starterCount - 1)];
  if (!starterCutoff) return true;
  return playerEvaluation(player) >= playerEvaluation(starterCutoff) - 6 || player.potential >= starterCutoff.potential + 5;
}

function playerPressure(player: EcosystemPlayer, team: EcosystemTeam, social: EcosystemSocialState, players: EcosystemPlayer[]): number {
  const culture = social.teamCultures.find((item) => item.teamId === team.id);
  const starterCount = POSITION_STARTER_TARGETS[player.position];
  const room = players
    .filter((item) => item.teamId === player.teamId && item.position === player.position && item.id !== player.id && item.transferStatus === "none")
    .sort((left, right) => left.depthRank - right.depthRank || playerEvaluation(right) - playerEvaluation(left));
  const playerAhead = [...room].filter((item) => item.depthRank < player.depthRank).sort((left, right) => right.depthRank - left.depthRank)[0];
  const meritGap = playerAhead ? playerEvaluation(player) - playerEvaluation(playerAhead) : 0;
  const roleMismatch = player.usagePlan === "starter" && player.depthRank > starterCount
    ? 30
    : player.usagePlan === "rotation" && player.depthRank > starterCount + 2
      ? 18
      : player.status === "backup" && player.depthRank <= starterCount + 3
        ? 12
        : 0;
  const careerUrgency = player.classYear === "Senior" ? 8 : player.classYear === "Junior" ? 5 : 1;
  return clamp(
    roleMismatch
      + Math.max(0, meritGap) * 1.8
      + Math.max(0, starterCount + 4 - player.depthRank) * 2.8
      + Math.max(0, 60 - player.tactical.schemeFit) * 0.72
      + Math.max(0, 55 - player.form) * 0.34
      + (culture?.conflict ?? 45) * 0.2
      + Math.max(0, 55 - (culture?.coachTrust ?? 55)) * 0.35
      + careerUrgency
      + (team.losses > team.wins ? 6 : 0),
  );
}

function teamPressure(team: EcosystemTeam, social: EcosystemSocialState): number {
  const culture = social.teamCultures.find((item) => item.teamId === team.id);
  return clamp(
    team.losses * 6.5
      - team.wins * 2.8
      + team.resources.financialPressure * 0.42
      + Math.max(0, team.expectation - team.rating) * 0.55
      + (culture?.conflict ?? 45) * 0.18
      + Math.max(0, 52 - (culture?.stability ?? 52)) * 0.32,
  );
}

function coachPressure(coach: EcosystemCoach, team: EcosystemTeam, social: EcosystemSocialState): number {
  const culture = social.teamCultures.find((item) => item.teamId === team.id);
  return clamp(
    coach.pressure * 0.38
      + (100 - coach.jobSecurity) * 0.46
      + team.losses * 5.2
      - team.wins * 2.2
      + Math.max(0, 55 - (culture?.coachTrust ?? 55)) * 0.38
      + (coach.status === "hot-seat" ? 12 : coach.status === "watched" ? 5 : 0),
  );
}

function playerConflictKind(player: EcosystemPlayer, social: EcosystemSocialState): EcosystemConflictKind {
  const culture = social.teamCultures.find((item) => item.teamId === player.teamId);
  if (player.tactical.schemeFit < 48) return "scheme-fit";
  if ((culture?.coachTrust ?? 55) < 42) return "trust";
  return "role";
}

function statusForDepth(player: EcosystemPlayer, depthRank: number): EcosystemPlayer["status"] {
  if (player.status === "injured") return "injured";
  const starterCount = POSITION_STARTER_TARGETS[player.position];
  if (depthRank <= starterCount) return "starter";
  if (depthRank <= starterCount + 2) return "rotation";
  return "backup";
}

function usageForDepth(player: EcosystemPlayer, depthRank: number): EcosystemPlayer["usagePlan"] {
  const starterCount = POSITION_STARTER_TARGETS[player.position];
  if (depthRank <= starterCount) return "starter";
  if (depthRank <= starterCount + 2) return "rotation";
  if (player.usagePlan === "redshirt") return "redshirt";
  if (depthRank === starterCount + 3 && player.form >= 62 && player.health >= 72) return "special-teams";
  return "developmental";
}

function promotePlayerOneSlot(players: EcosystemPlayer[], playerId: string): {
  players: EcosystemPlayer[];
  oldRank: number;
  newRank: number;
  displacedPlayerId?: string | undefined;
} {
  const player = players.find((item) => item.id === playerId);
  if (!player) return { players, oldRank: 0, newRank: 0 };
  const room = players
    .filter((item) => item.teamId === player.teamId && item.position === player.position)
    .sort((left, right) => left.depthRank - right.depthRank || playerEvaluation(right) - playerEvaluation(left) || left.id.localeCompare(right.id));
  const currentIndex = room.findIndex((item) => item.id === playerId);
  if (currentIndex < 0) return { players, oldRank: player.depthRank, newRank: player.depthRank };
  const ordered = [...room];
  let displacedPlayerId: string | undefined;
  if (currentIndex > 0) {
    const displaced = ordered[currentIndex - 1];
    const promoted = ordered[currentIndex];
    if (displaced && promoted) {
      ordered[currentIndex - 1] = promoted;
      ordered[currentIndex] = displaced;
      displacedPlayerId = displaced.id;
    }
  }
  const updates = new Map(ordered.map((item, index) => {
    const depthRank = index + 1;
    return [item.id, {
      ...item,
      depthRank,
      status: statusForDepth(item, depthRank),
      usagePlan: usageForDepth(item, depthRank),
      form: item.id === playerId ? clamp(item.form + 2) : item.form,
    } satisfies EcosystemPlayer];
  }));
  const nextPlayers = players.map((item) => updates.get(item.id) ?? item);
  const promoted = updates.get(playerId) ?? player;
  return {
    players: nextPlayers,
    oldRank: player.depthRank,
    newRank: promoted.depthRank,
    ...(displacedPlayerId ? { displacedPlayerId } : {}),
  };
}

function teamConflictKind(team: EcosystemTeam): EcosystemConflictKind {
  return team.resources.financialPressure >= 68 ? "finances" : "results";
}

function coachConflictKind(coach: EcosystemCoach, team: EcosystemTeam): EcosystemConflictKind {
  if (team.tactical.continuity < 46 || team.tactical.installation < 48) return "staff-direction";
  return coach.jobSecurity < 48 ? "trust" : "results";
}

function nextStage(conflict: EcosystemConflict, pressure: number, seasonYear: number, week: number): EcosystemConflictStage {
  if (pressure < 42) return "resolved";
  const age = ordinal(seasonYear, week) - ordinal(conflict.createdSeasonYear, conflict.createdWeek);
  if (conflict.stage === "concern" && pressure >= 68 && age >= 1) return "meeting";
  if (conflict.stage === "meeting" && pressure >= 80 && age >= 2) return "ultimatum";
  return conflict.stage;
}

function storyFromDecision(decision: EcosystemAgencyDecision, date: GameDate): EcosystemStory {
  const kind: EcosystemStory["kind"] = decision.kind === "player-role-push"
    ? "depth-change"
    : decision.kind === "player-portal-entry"
      ? "transfer"
      : decision.kind === "team-roster-reset"
        ? "roster-plan"
        : decision.kind === "team-tactical-shift"
          ? "tactical-change"
          : decision.kind === "coach-staff-reshuffle"
            ? "staff-friction"
            : "coach-pressure";
  return {
    id: `agency-story:${decision.id}`,
    kind,
    createdOn: date,
    week: decision.week,
    title: decision.title,
    detail: `${decision.detail} ${decision.consequence}`,
    importance: decision.kind === "player-portal-entry" || decision.kind === "coach-staff-reshuffle" ? 4 : 3,
    teamIds: decision.teamIds,
    playerIds: decision.playerIds,
    coachIds: decision.coachIds,
    relatedToHero: decision.relatedToHero,
  };
}

function transactionFromDecision(decision: EcosystemAgencyDecision, date: GameDate): EcosystemTransaction | undefined {
  if (decision.kind === "player-portal-entry") {
    return {
      id: `agency-transaction:${decision.id}`,
      kind: "portal-entry",
      seasonYear: decision.seasonYear,
      week: decision.week,
      createdOn: date,
      title: decision.title,
      detail: decision.consequence,
      playerId: decision.playerIds[0],
      fromTeamId: decision.teamId,
      relatedToHero: decision.relatedToHero,
    };
  }
  if (decision.kind === "team-tactical-shift" || decision.kind === "coach-staff-reshuffle") {
    return {
      id: `agency-transaction:${decision.id}`,
      kind: "tactical-change",
      seasonYear: decision.seasonYear,
      week: decision.week,
      createdOn: date,
      title: decision.title,
      detail: decision.consequence,
      coachId: decision.coachIds[0],
      fromTeamId: decision.teamId,
      toTeamId: decision.teamId,
      relatedToHero: decision.relatedToHero,
    };
  }
  return undefined;
}

function decisionBase(input: {
  kind: EcosystemAgencyDecision["kind"];
  conflict: EcosystemConflict;
  seasonYear: number;
  week: number;
  date: GameDate;
  title: string;
  detail: string;
  consequence: string;
  playerIds?: string[];
  coachIds?: string[];
  objective?: EcosystemObjective | undefined;
}): EcosystemAgencyDecision {
  return {
    id: `decision:${input.kind}:${input.conflict.id}:${input.seasonYear}:${input.week}`,
    kind: input.kind,
    actorKind: input.conflict.actorKind,
    actorId: input.conflict.actorId,
    teamId: input.conflict.teamId,
    seasonYear: input.seasonYear,
    week: input.week,
    createdOn: input.date,
    conflictId: input.conflict.id,
    ...(input.objective ? { sourceObjectiveId: input.objective.id } : {}),
    title: input.title,
    detail: input.detail,
    consequence: input.consequence,
    teamIds: [input.conflict.teamId],
    playerIds: input.playerIds ?? [],
    coachIds: input.coachIds ?? [],
    relatedToHero: input.conflict.relatedToHero,
  };
}

function applyCultureImpact(social: EcosystemSocialState, teamId: string, impact: { conflict?: number; morale?: number; coachTrust?: number; stability?: number; accountability?: number }): EcosystemSocialState {
  return {
    ...social,
    teamCultures: social.teamCultures.map((culture) => culture.teamId !== teamId ? culture : {
      ...culture,
      conflict: clamp(culture.conflict + (impact.conflict ?? 0)),
      morale: clamp(culture.morale + (impact.morale ?? 0)),
      coachTrust: clamp(culture.coachTrust + (impact.coachTrust ?? 0)),
      stability: clamp(culture.stability + (impact.stability ?? 0)),
      accountability: clamp(culture.accountability + (impact.accountability ?? 0)),
    }),
  };
}

interface ApplyDecisionContext {
  conflict: EcosystemConflict;
  stage: EcosystemConflictStage;
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  social: EcosystemSocialState;
  history: EcosystemHistoryState;
  seasonYear: number;
  week: number;
  date: GameDate;
  random: SeededRandom;
}

interface ApplyDecisionResult {
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  social: EcosystemSocialState;
  decision?: EcosystemAgencyDecision;
  resolvesConflict: boolean;
}

function applyDecision(context: ApplyDecisionContext): ApplyDecisionResult {
  let { teams, players, coaches, social } = context;
  const { conflict, stage, seasonYear, week, date } = context;
  if (stage !== "meeting" && stage !== "ultimatum") return { teams, players, coaches, social, resolvesConflict: false };

  if (conflict.actorKind === "player") {
    const player = players.find((item) => item.id === conflict.actorId);
    if (!player) return { teams, players, coaches, social, resolvesConflict: true };
    const objective = activeObjective(context.history, "player", player.id);
    if (stage === "ultimatum" && !player.isHero && player.level === "college" && player.eligibilityYears > 1 && player.transferStatus === "none") {
      players = players.map((item) => item.id === player.id ? { ...item, transferStatus: "portal" } : item);
      social = applyCultureImpact(social, player.teamId, { conflict: 8, morale: -3, coachTrust: -5, stability: -4 });
      return {
        teams,
        players,
        coaches,
        social,
        resolvesConflict: true,
        decision: decisionBase({
          kind: "player-portal-entry",
          conflict,
          seasonYear,
          week,
          date,
          title: `${player.name} выходит в трансферный портал`,
          detail: `Игрок не получил приемлемого ответа по роли и будущему в ${teams.find((team) => team.id === player.teamId)?.shortName ?? "программе"}.`,
          consequence: "Статус игрока изменён на portal; его место и рынок движения пересчитываются.",
          playerIds: [player.id],
          objective,
        }),
      };
    }
    const promotion = promotePlayerOneSlot(players, player.id);
    players = promotion.players;
    const promoted = players.find((item) => item.id === player.id) ?? player;
    const displaced = promotion.displacedPlayerId ? players.find((item) => item.id === promotion.displacedPlayerId) : undefined;
    social = applyCultureImpact(social, player.teamId, { conflict: -3, accountability: 3, coachTrust: 2 });
    return {
      teams,
      players,
      coaches,
      social,
      resolvesConflict: promoted.status === "starter",
      decision: decisionBase({
        kind: "player-role-push",
        conflict,
        seasonYear,
        week,
        date,
        title: `${player.name} добился пересмотра роли`,
        detail: "Игрок потребовал конкретных тренировочных репов и новой оценки в depth chart; штаб пересобрал всю позиционную комнату без дублирующихся мест.",
        consequence: promotion.newRank < promotion.oldRank
          ? `Глубина изменена с ${promotion.oldRank} на ${promotion.newRank}; ${displaced ? `${displaced.name} опустился на ${displaced.depthRank}.` : "соседняя роль пересчитана."}`
          : "После проверки depth chart остался без изменения; игрок получил только расширенные тренировочные повторы.",
        playerIds: [player.id, ...(displaced ? [displaced.id] : [])],
        objective,
      }),
    };
  }

  if (conflict.actorKind === "team") {
    const team = teams.find((item) => item.id === conflict.actorId);
    if (!team) return { teams, players, coaches, social, resolvesConflict: true };
    const objective = activeObjective(context.history, "team", team.id);
    if (stage === "meeting") {
      const strategy = conflict.kind === "finances" || team.losses >= team.wins + 3 ? "rebuild" : team.wins >= 6 ? "contend" : "balanced";
      teams = teams.map((item) => item.id === team.id ? {
        ...item,
        rosterPlan: {
          ...item.rosterPlan,
          strategy,
          reviewedWeek: week,
          retentionRisk: clamp(item.rosterPlan.retentionRisk + (strategy === "rebuild" ? 8 : -4)),
          lastReviewReason: `Автономное решение руководства после конфликта ${conflict.kind}.`,
        },
      } : item);
      social = applyCultureImpact(social, team.id, { stability: -3, accountability: 4, morale: strategy === "contend" ? 3 : -2 });
      return {
        teams,
        players,
        coaches,
        social,
        resolvesConflict: false,
        decision: decisionBase({
          kind: "team-roster-reset",
          conflict,
          seasonYear,
          week,
          date,
          title: `${team.shortName} меняет кадровый план`,
          detail: "Руководство связало результаты, бюджет и удержание состава в одно решение.",
          consequence: `Стратегия roster plan изменена на ${strategy}; риск удержания пересчитан.`,
          objective,
        }),
      };
    }
    const tempo = team.losses > team.wins ? "fast" : "controlled";
    const aggression = team.losses > team.wins ? "aggressive" : "conservative";
    teams = teams.map((item) => item.id === team.id ? {
      ...item,
      tactical: {
        ...item.tactical,
        tempo,
        offensiveAggression: aggression,
        defensiveAggression: aggression,
        installation: clamp(item.tactical.installation - 10),
        continuity: clamp(item.tactical.continuity - 12),
        adaptation: clamp(item.tactical.adaptation + 5),
        staffFingerprint: `${item.seed}:agency:${seasonYear}:${week}`,
      },
      offenseStyle: `${item.offenseStyle.split(" / ")[0]} / ${tempo}`,
      trend: item.losses > item.wins ? "falling" : item.trend,
    } : item);
    social = applyCultureImpact(social, team.id, { stability: -7, conflict: 4, coachTrust: -3 });
    const headCoach = coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    return {
      teams,
      players,
      coaches,
      social,
      resolvesConflict: true,
      decision: decisionBase({
        kind: "team-tactical-shift",
        conflict,
        seasonYear,
        week,
        date,
        title: `${team.shortName} меняет направление сезона`,
        detail: "Руководство потребовало немедленной корректировки темпа и риска.",
        consequence: `Темп — ${tempo}; агрессия — ${aggression}; installation и continuity получили краткосрочный штраф.`,
        coachIds: headCoach ? [headCoach.id] : [],
        objective,
      }),
    };
  }

  const coach = coaches.find((item) => item.id === conflict.actorId);
  const team = coach ? teams.find((item) => item.id === coach.teamId) : undefined;
  if (!coach || !team) return { teams, players, coaches, social, resolvesConflict: true };
  const objective = activeObjective(context.history, "coach", coach.id);
  if (stage === "meeting") {
    coaches = coaches.map((item) => item.id === coach.id ? {
      ...item,
      contractYears: Math.min(item.contractYears, 1),
      jobSecurity: clamp(item.jobSecurity - 6),
      pressure: clamp(item.pressure + 8),
      status: item.jobSecurity - 6 < 38 ? "hot-seat" : "watched",
    } : item);
    social = applyCultureImpact(social, team.id, { coachTrust: -4, stability: -3, accountability: 4 });
    return {
      teams,
      players,
      coaches,
      social,
      resolvesConflict: false,
      decision: decisionBase({
        kind: "coach-contract-ultimatum",
        conflict,
        seasonYear,
        week,
        date,
        title: `${coach.name} получает ультиматум руководства`,
        detail: "Контракт и полномочия тренера поставлены в зависимость от ближайших результатов.",
        consequence: "Контракт ограничен одним годом; job security снижен, pressure увеличен.",
        coachIds: [coach.id],
        objective,
      }),
    };
  }

  const coordinators = coaches.filter((item) => item.teamId === team.id && (item.role === "offensive-coordinator" || item.role === "defensive-coordinator"));
  const positionCoaches = coaches.filter((item) => item.teamId === team.id && item.role === "position-coach");
  const coordinator = [...coordinators].sort((left, right) => left.reputation + left.tactics - right.reputation - right.tactics)[0];
  const replacement = [...positionCoaches].sort((left, right) => right.reputation + right.tactics - left.reputation - left.tactics)[0];
  if (coordinator && replacement) {
    coaches = coaches.map((item) => item.id === coordinator.id
      ? { ...item, role: "position-coach", pressure: clamp(item.pressure + 6), jobSecurity: clamp(item.jobSecurity - 10) }
      : item.id === replacement.id
        ? { ...item, role: coordinator.role, pressure: clamp(item.pressure + 4), jobSecurity: clamp(item.jobSecurity + 8) }
        : item);
    teams = teams.map((item) => item.id === team.id ? {
      ...item,
      tactical: {
        ...item.tactical,
        installation: clamp(item.tactical.installation - 14),
        continuity: clamp(item.tactical.continuity - 16),
        adaptation: clamp(item.tactical.adaptation + 7),
        offensiveCoordinatorFingerprint: coordinator.role === "offensive-coordinator" ? replacement.seed : item.tactical.offensiveCoordinatorFingerprint,
        defensiveCoordinatorFingerprint: coordinator.role === "defensive-coordinator" ? replacement.seed : item.tactical.defensiveCoordinatorFingerprint,
        staffFingerprint: `${item.seed}:reshuffle:${replacement.id}:${seasonYear}:${week}`,
      },
    } : item);
    social = applyCultureImpact(social, team.id, { stability: -10, coachTrust: -6, conflict: 5 });
    return {
      teams,
      players,
      coaches,
      social,
      resolvesConflict: true,
      decision: decisionBase({
        kind: "coach-staff-reshuffle",
        conflict,
        seasonYear,
        week,
        date,
        title: `${team.shortName} перестраивает штаб`,
        detail: `${replacement.name} получает роль ${coordinator.role}; ${coordinator.name} возвращается к позиционной работе.`,
        consequence: "Роли координаторов изменены; installation и continuity снижены до адаптации штаба.",
        coachIds: [coach.id, coordinator.id, replacement.id],
        objective,
      }),
    };
  }

  coaches = coaches.map((item) => item.id === coach.id ? {
    ...item,
    contractYears: 1,
    jobSecurity: clamp(item.jobSecurity - 12),
    pressure: clamp(item.pressure + 10),
    status: "hot-seat",
  } : item);
  social = applyCultureImpact(social, team.id, { coachTrust: -5, stability: -5, conflict: 4 });
  return {
    teams,
    players,
    coaches,
    social,
    resolvesConflict: true,
    decision: decisionBase({
      kind: "coach-contract-ultimatum",
      conflict,
      seasonYear,
      week,
      date,
      title: `${coach.name} остаётся без гарантии будущего`,
      detail: "В штабе не нашлось готовой внутренней замены, поэтому руководство сохранило тренера до конца сезона.",
      consequence: "Контракт сокращён до одного года; тренер переведён в hot-seat.",
      coachIds: [coach.id],
      objective,
    }),
  };
}

export interface AdvanceWorldAgencyInput {
  agency: EcosystemAgencyState;
  history: EcosystemHistoryState;
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  social: EcosystemSocialState;
  seasonYear: number;
  week: number;
  date: GameDate;
  worldSeed: string;
}

export interface AdvanceWorldAgencyResult {
  agency: EcosystemAgencyState;
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  social: EcosystemSocialState;
  stories: EcosystemStory[];
  transactions: EcosystemTransaction[];
}

export function advanceWorldAgency(input: AdvanceWorldAgencyInput): AdvanceWorldAgencyResult {
  if (input.agency.lastProcessedSeasonYear === input.seasonYear && input.agency.lastProcessedWeek === input.week) {
    return { agency: input.agency, teams: input.teams, players: input.players, coaches: input.coaches, social: input.social, stories: [], transactions: [] };
  }

  let teams = input.teams;
  let players = input.players;
  let coaches = input.coaches;
  let social = input.social;
  const random = new SeededRandom(`${input.worldSeed}:agency:${input.seasonYear}:${input.week}`);
  const conflicts = [...input.agency.conflicts];
  let conflictSequence = conflicts.length;
  const activeKeys = new Set(conflicts.filter((conflict) => conflict.stage !== "resolved").map((conflict) => `${conflict.actorKind}:${conflict.actorId}`));

  for (const team of teams.filter((item) => item.level === "college")) {
    const candidate = players
      .filter((player) => player.teamId === team.id
        && player.level === "college"
        && player.transferStatus === "none"
        && player.status !== "injured"
        && player.eligibilityYears > 1
        && playerHasAgencyLeverage(player, players))
      .map((player) => ({ player, pressure: playerPressure(player, team, social, players) }))
      .sort((left, right) => right.pressure - left.pressure || right.player.overall - left.player.overall)[0];
    if (candidate && candidate.pressure >= 64 && !activeKeys.has(`player:${candidate.player.id}`) && canOpenConflict(conflicts, "player", candidate.player.id, input.seasonYear, input.week)) {
      conflicts.push(initialConflict({
        actorKind: "player",
        actorId: candidate.player.id,
        teamId: team.id,
        kind: playerConflictKind(candidate.player, social),
        pressure: candidate.pressure,
        seasonYear: input.seasonYear,
        week: input.week,
        evidenceFactIds: recentEvidence(input.history, team.id, candidate.player.id),
        relatedToHero: candidate.player.isHero,
        sequence: conflictSequence++,
      }));
      activeKeys.add(`player:${candidate.player.id}`);
    }

    const pressure = teamPressure(team, social);
    if (pressure >= 60 && !activeKeys.has(`team:${team.id}`) && canOpenConflict(conflicts, "team", team.id, input.seasonYear, input.week)) {
      conflicts.push(initialConflict({
        actorKind: "team",
        actorId: team.id,
        teamId: team.id,
        kind: teamConflictKind(team),
        pressure,
        seasonYear: input.seasonYear,
        week: input.week,
        evidenceFactIds: recentEvidence(input.history, team.id, team.id),
        relatedToHero: players.some((player) => player.teamId === team.id && player.isHero),
        sequence: conflictSequence++,
      }));
      activeKeys.add(`team:${team.id}`);
    }

    const headCoach = coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    if (headCoach) {
      const pressure = coachPressure(headCoach, team, social);
      if (pressure >= 60 && !activeKeys.has(`coach:${headCoach.id}`) && canOpenConflict(conflicts, "coach", headCoach.id, input.seasonYear, input.week)) {
        conflicts.push(initialConflict({
          actorKind: "coach",
          actorId: headCoach.id,
          teamId: team.id,
          kind: coachConflictKind(headCoach, team),
          pressure,
          seasonYear: input.seasonYear,
          week: input.week,
          evidenceFactIds: recentEvidence(input.history, team.id, headCoach.id),
          relatedToHero: players.some((player) => player.teamId === team.id && player.isHero),
          sequence: conflictSequence++,
        }));
        activeKeys.add(`coach:${headCoach.id}`);
      }
    }
  }

  const processed = new Set(input.agency.processedDecisionKeys);
  const newDecisions: EcosystemAgencyDecision[] = [];
  const updatedConflicts: EcosystemConflict[] = [];

  for (const original of conflicts) {
    if (original.stage === "resolved") {
      updatedConflicts.push(original);
      continue;
    }
    const actorPressure = original.actorKind === "player"
      ? (() => {
          const player = players.find((item) => item.id === original.actorId);
          const team = player ? teams.find((item) => item.id === player.teamId) : undefined;
          return player && team ? playerPressure(player, team, social, players) : 0;
        })()
      : original.actorKind === "team"
        ? (() => {
            const team = teams.find((item) => item.id === original.actorId);
            return team ? teamPressure(team, social) : 0;
          })()
        : (() => {
            const coach = coaches.find((item) => item.id === original.actorId);
            const team = coach ? teams.find((item) => item.id === coach.teamId) : undefined;
            return coach && team ? coachPressure(coach, team, social) : 0;
          })();
    const stage = nextStage(original, actorPressure, input.seasonYear, input.week);
    let conflict: EcosystemConflict = {
      ...original,
      stage,
      pressure: actorPressure,
      lastSeasonYear: input.seasonYear,
      lastWeek: input.week,
      evidenceFactIds: [...new Set([...original.evidenceFactIds, ...recentEvidence(input.history, original.teamId, original.actorId)])].slice(-8),
      ...(stage === "resolved" ? { resolvedSeasonYear: input.seasonYear, resolvedWeek: input.week } : {}),
    };

    const decisionKey = `${conflict.id}:${stage}`;
    if ((stage === "meeting" || stage === "ultimatum") && !processed.has(decisionKey)) {
      const result = applyDecision({
        conflict,
        stage,
        teams,
        players,
        coaches,
        social,
        history: input.history,
        seasonYear: input.seasonYear,
        week: input.week,
        date: input.date,
        random: random.fork(conflict.id),
      });
      teams = result.teams;
      players = result.players;
      coaches = result.coaches;
      social = result.social;
      if (result.decision) {
        newDecisions.push(result.decision);
        processed.add(decisionKey);
        conflict = {
          ...conflict,
          decisionIds: [...conflict.decisionIds, result.decision.id].slice(-6),
          ...(result.resolvesConflict ? { stage: "resolved", resolvedSeasonYear: input.seasonYear, resolvedWeek: input.week } : {}),
        };
      }
    }
    updatedConflicts.push(conflict);
  }

  const compactedConflicts = compactConflicts(updatedConflicts);
  const retainedConflictIds = new Set(compactedConflicts.map((conflict) => conflict.id));
  const decisions = [...input.agency.decisions, ...newDecisions]
    .filter((decision) => retainedConflictIds.has(decision.conflictId))
    .slice(-MAX_DECISIONS);
  const retainedDecisionIds = new Set(decisions.map((decision) => decision.id));
  const retainedFactIds = new Set(input.history.facts.map((fact) => fact.id));
  const boundedConflicts = compactedConflicts.map((conflict) => ({
    ...conflict,
    evidenceFactIds: conflict.evidenceFactIds.filter((id) => retainedFactIds.has(id)),
    decisionIds: conflict.decisionIds.filter((id) => retainedDecisionIds.has(id)),
  }));
  const stories = newDecisions.map((decision) => storyFromDecision(decision, input.date));
  const transactions = newDecisions.map((decision) => transactionFromDecision(decision, input.date)).filter((transaction): transaction is EcosystemTransaction => Boolean(transaction));
  const active = boundedConflicts.filter((conflict) => conflict.stage !== "resolved");
  const digest = [
    `${active.length} автономных конфликтов остаются открытыми.`,
    `${newDecisions.length} решений применены на этой неделе.`,
    ...newDecisions.slice(-3).map((decision) => decision.consequence),
  ].slice(0, 6);

  return {
    teams,
    players,
    coaches,
    social,
    stories,
    transactions,
    agency: {
      version: 1,
      lastProcessedSeasonYear: input.seasonYear,
      lastProcessedWeek: input.week,
      conflicts: boundedConflicts,
      decisions,
      processedDecisionKeys: [...processed]
        .filter((key) => boundedConflicts.some((conflict) => key.startsWith(`${conflict.id}:`)))
        .slice(-MAX_PROCESSED_DECISION_KEYS),
      digest,
    },
  };
}
