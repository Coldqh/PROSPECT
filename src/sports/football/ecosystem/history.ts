import type { GameDate } from "../../../core/calendar/types";
import type {
  EcosystemCoach,
  EcosystemHistoryFact,
  EcosystemHistoryState,
  EcosystemObjective,
  EcosystemPlayer,
  EcosystemStory,
  EcosystemStoryArc,
  EcosystemTeam,
  EcosystemTransaction,
} from "./types";

const MAX_FACTS = 1200;
const MAX_OBJECTIVES = 420;
const MAX_ARCS = 180;
const MAX_PROCESSED_SOURCES = 1800;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function importance(value: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
}

function teamObjective(team: EcosystemTeam, seasonYear: number, week: number): EcosystemObjective {
  const target = team.expectation >= 82 ? 9 : team.expectation >= 70 ? 8 : team.expectation >= 58 ? 7 : 6;
  return {
    id: `objective:team:${team.id}:${seasonYear}`,
    ownerKind: "team",
    ownerId: team.id,
    kind: team.rosterPlan.strategy === "rebuild" ? "rebuild-program" : "win-target",
    status: "active",
    createdSeasonYear: seasonYear,
    createdWeek: week,
    targetSeasonYear: seasonYear,
    progress: team.rosterPlan.strategy === "rebuild" ? team.rating : team.wins,
    target: team.rosterPlan.strategy === "rebuild" ? Math.min(96, team.rating + 4) : target,
    title: team.rosterPlan.strategy === "rebuild" ? `${team.shortName}: перестройка состава` : `${team.shortName}: план на ${target} побед`,
    detail: team.rosterPlan.strategy === "rebuild"
      ? "Программа должна поднять качество состава и не сорвать долгосрочный план."
      : `Штаб и руководство ждут минимум ${target} побед в текущем сезоне.`,
    evidenceFactIds: [],
  };
}

function coachObjective(coach: EcosystemCoach, team: EcosystemTeam | undefined, seasonYear: number, week: number): EcosystemObjective {
  const underPressure = coach.status !== "secure" || coach.jobSecurity < 58;
  return {
    id: `objective:coach:${coach.id}:${seasonYear}`,
    ownerKind: "coach",
    ownerId: coach.id,
    kind: underPressure ? "protect-job" : "build-program",
    status: "active",
    createdSeasonYear: seasonYear,
    createdWeek: week,
    targetSeasonYear: seasonYear,
    progress: underPressure ? coach.jobSecurity : team?.rating ?? coach.reputation,
    target: underPressure ? 65 : Math.min(96, (team?.rating ?? coach.reputation) + 3),
    title: underPressure ? `${coach.name}: сохранить работу` : `${coach.name}: усилить программу`,
    detail: underPressure
      ? "Тренеру нужны результаты, стабильность штаба и рост доверия руководства."
      : "Тренер должен улучшить команду без разрушения состава и системы.",
    evidenceFactIds: [],
  };
}

function playerObjective(player: EcosystemPlayer, seasonYear: number, week: number): EcosystemObjective {
  const chasingRole = player.status !== "starter";
  return {
    id: `objective:player:${player.id}:${seasonYear}`,
    ownerKind: "player",
    ownerId: player.id,
    kind: chasingRole ? "earn-starting-role" : "breakout-season",
    status: "active",
    createdSeasonYear: seasonYear,
    createdWeek: week,
    targetSeasonYear: seasonYear,
    progress: chasingRole ? 0 : player.overall,
    target: chasingRole ? 1 : Math.min(98, player.overall + 4),
    title: chasingRole ? `${player.name}: пробиться в старт` : `${player.name}: выйти на новый уровень`,
    detail: chasingRole
      ? "Игроку нужны форма, здоровье и доверие штаба, чтобы изменить роль."
      : "Игрок должен закрепить статус через рост рейтинга, награды и ключевые матчи.",
    evidenceFactIds: [],
  };
}

function notablePlayers(teams: EcosystemTeam[], players: EcosystemPlayer[]): EcosystemPlayer[] {
  const selected = new Map<string, EcosystemPlayer>();
  for (const team of teams) {
    const candidates = players
      .filter((player) => player.teamId === team.id)
      .sort((left, right) => Number(right.isHero) - Number(left.isHero) || right.overall - left.overall || left.depthRank - right.depthRank)
      .slice(0, 2);
    for (const player of candidates) selected.set(player.id, player);
  }
  for (const player of players.filter((item) => item.isHero)) selected.set(player.id, player);
  return [...selected.values()];
}

export function createWorldHistory(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
): EcosystemHistoryState {
  const objectives = [
    ...teams.filter((team) => team.level === "college").map((team) => teamObjective(team, seasonYear, week)),
    ...coaches.filter((coach) => coach.role === "head-coach").map((coach) => coachObjective(coach, teams.find((team) => team.id === coach.teamId), seasonYear, week)),
    ...notablePlayers(teams, players).map((player) => playerObjective(player, seasonYear, week)),
  ].slice(0, MAX_OBJECTIVES);
  return {
    version: 1,
    lastProcessedSeasonYear: seasonYear,
    lastProcessedWeek: week,
    processedSourceIds: [],
    facts: [],
    objectives,
    arcs: [],
    digest: [
      `${objectives.length} долгосрочных целей активны в мире.`,
      "История будет собираться только из фактов симуляции.",
    ],
  };
}

function factFromStory(story: EcosystemStory): EcosystemHistoryFact | undefined {
  if (story.kind === "storyline") return undefined;
  return {
    id: `fact:story:${story.id}`,
    sourceType: "story",
    sourceId: story.id,
    seasonYear: story.createdOn.year,
    week: story.week,
    createdOn: story.createdOn,
    kind: story.kind,
    title: story.title,
    detail: story.detail,
    importance: story.importance,
    teamIds: story.teamIds,
    playerIds: story.playerIds,
    coachIds: story.coachIds,
    relatedToHero: story.relatedToHero,
  };
}

function factFromTransaction(transaction: EcosystemTransaction): EcosystemHistoryFact {
  return {
    id: `fact:transaction:${transaction.id}`,
    sourceType: "transaction",
    sourceId: transaction.id,
    seasonYear: transaction.seasonYear,
    week: transaction.week,
    createdOn: transaction.createdOn,
    kind: transaction.kind,
    title: transaction.title,
    detail: transaction.detail,
    importance: importance(transaction.kind.includes("coach") || transaction.kind === "transfer" ? 4 : 3),
    teamIds: [transaction.fromTeamId, transaction.toTeamId].filter((id): id is string => Boolean(id)),
    playerIds: transaction.playerId ? [transaction.playerId] : [],
    coachIds: transaction.coachId ? [transaction.coachId] : [],
    relatedToHero: transaction.relatedToHero,
  };
}

export function historyFactSemanticKey(fact: EcosystemHistoryFact): string {
  const agencyDecisionId = fact.sourceId.match(/^agency-(?:story|transaction):(decision:.+)$/)?.[1];
  if (agencyDecisionId) return `agency:${agencyDecisionId}`;
  const date = `${fact.createdOn.year}-${fact.createdOn.month}-${fact.createdOn.day}`;
  const teams = [...fact.teamIds].sort().join("+");
  const players = [...fact.playerIds].sort().join("+");
  const coaches = [...fact.coachIds].sort().join("+");
  return `${date}|${fact.title.trim()}|${fact.detail.trim()}|${teams}|${players}|${coaches}`;
}

function preferredFact(left: EcosystemHistoryFact, right: EcosystemHistoryFact): EcosystemHistoryFact {
  if (left.sourceType !== right.sourceType) return right.sourceType === "transaction" ? right : left;
  if (right.importance !== left.importance) return right.importance > left.importance ? right : left;
  return right.id.localeCompare(left.id) > 0 ? right : left;
}

function dedupeFacts(facts: EcosystemHistoryFact[]): EcosystemHistoryFact[] {
  const result: EcosystemHistoryFact[] = [];
  const semanticIndexes = new Map<string, number>();
  const idIndexes = new Map<string, number>();
  for (const fact of facts) {
    const key = historyFactSemanticKey(fact);
    const existingIndex = idIndexes.get(fact.id) ?? semanticIndexes.get(key);
    if (existingIndex === undefined) {
      semanticIndexes.set(key, result.length);
      idIndexes.set(fact.id, result.length);
      result.push(fact);
      continue;
    }
    const existing = result[existingIndex];
    if (existing) {
      const preferred = preferredFact(existing, fact);
      result[existingIndex] = preferred;
      semanticIndexes.set(historyFactSemanticKey(existing), existingIndex);
      semanticIndexes.set(key, existingIndex);
      idIndexes.set(existing.id, existingIndex);
      idIndexes.set(fact.id, existingIndex);
      idIndexes.set(preferred.id, existingIndex);
    }
  }
  return result;
}

function objectiveOwnerMatches(objective: EcosystemObjective, fact: EcosystemHistoryFact): boolean {
  if (objective.ownerKind === "team") return fact.teamIds.includes(objective.ownerId);
  if (objective.ownerKind === "player") return fact.playerIds.includes(objective.ownerId);
  return fact.coachIds.includes(objective.ownerId);
}

function updateObjective(
  objective: EcosystemObjective,
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  newFacts: EcosystemHistoryFact[],
  seasonYear: number,
  week: number,
): EcosystemObjective {
  if (objective.status !== "active") return objective;
  const evidence = newFacts.filter((fact) => objectiveOwnerMatches(objective, fact)).map((fact) => fact.id);
  let progress = objective.progress;
  let status: EcosystemObjective["status"] = objective.status;
  if (objective.ownerKind === "team") {
    const team = teams.find((item) => item.id === objective.ownerId);
    if (!team) status = "failed";
    else progress = objective.kind === "rebuild-program" ? team.rating : team.wins;
  } else if (objective.ownerKind === "coach") {
    const coach = coaches.find((item) => item.id === objective.ownerId);
    const team = coach ? teams.find((item) => item.id === coach.teamId) : undefined;
    if (!coach) status = "failed";
    else progress = objective.kind === "protect-job" ? coach.jobSecurity : team?.rating ?? coach.reputation;
  } else {
    const player = players.find((item) => item.id === objective.ownerId);
    if (!player) status = "failed";
    else progress = objective.kind === "earn-starting-role" ? (player.status === "starter" ? 1 : 0) : player.overall;
  }
  if (status === "active" && progress >= objective.target) status = "achieved";
  if (status === "active" && seasonYear > objective.targetSeasonYear) status = "failed";
  return {
    ...objective,
    status,
    progress: clamp(progress, 0, Math.max(100, objective.target)),
    evidenceFactIds: [...objective.evidenceFactIds, ...evidence].slice(-16),
    ...(status !== "active" ? { completedSeasonYear: seasonYear, completedWeek: week } : {}),
  };
}

function ensureCurrentObjectives(
  objectives: EcosystemObjective[],
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
): EcosystemObjective[] {
  const next = [...objectives];
  const activeKey = new Set(next.filter((item) => item.status === "active").map((item) => `${item.ownerKind}:${item.ownerId}:${item.targetSeasonYear}`));
  for (const team of teams.filter((item) => item.level === "college")) {
    const key = `team:${team.id}:${seasonYear}`;
    if (!activeKey.has(key)) next.push(teamObjective(team, seasonYear, week));
  }
  for (const coach of coaches.filter((item) => item.role === "head-coach")) {
    const key = `coach:${coach.id}:${seasonYear}`;
    if (!activeKey.has(key)) next.push(coachObjective(coach, teams.find((team) => team.id === coach.teamId), seasonYear, week));
  }
  for (const player of notablePlayers(teams, players)) {
    const key = `player:${player.id}:${seasonYear}`;
    if (!activeKey.has(key)) next.push(playerObjective(player, seasonYear, week));
  }
  return next.slice(-MAX_OBJECTIVES);
}

type ArcDraft = Pick<EcosystemStoryArc, "kind" | "title" | "teamIds" | "playerIds" | "coachIds" | "relatedToHero"> & { momentum: number; resolved?: boolean };

function arcDraft(fact: EcosystemHistoryFact): ArcDraft | undefined {
  const playerId = fact.playerIds[0];
  const coachId = fact.coachIds[0];
  const teamId = fact.teamIds[0];
  if (["breakout", "depth-change", "award", "scholarship", "scholarship-awarded", "commitment", "camp-breakout"].includes(fact.kind) && playerId) {
    return { kind: "player-rise", title: `Рост: ${fact.title}`, teamIds: fact.teamIds, playerIds: fact.playerIds, coachIds: fact.coachIds, momentum: 18 + fact.importance * 4, relatedToHero: fact.relatedToHero };
  }
  if (["injury", "transfer", "locker-room-conflict", "broken-promise", "position-change"].includes(fact.kind) && playerId) {
    return { kind: "career-crossroads", title: `Развилка: ${fact.title}`, teamIds: fact.teamIds, playerIds: fact.playerIds, coachIds: fact.coachIds, momentum: 12 + fact.importance * 5, relatedToHero: fact.relatedToHero };
  }
  if (["coach-pressure", "coach-move", "coach-fired", "coach-hired", "coach-vacancy", "staff-friction", "tactical-change"].includes(fact.kind) && (coachId || teamId)) {
    return { kind: "coach-tenure", title: `Штаб: ${fact.title}`, teamIds: fact.teamIds, playerIds: fact.playerIds, coachIds: fact.coachIds, momentum: 14 + fact.importance * 5, relatedToHero: fact.relatedToHero, resolved: fact.kind === "coach-fired" || fact.kind === "coach-move" };
  }
  if (["upset", "ranking", "playoff", "championship", "bowl", "conference-race"].includes(fact.kind) && teamId) {
    return { kind: "team-run", title: `Сезон: ${fact.title}`, teamIds: fact.teamIds, playerIds: fact.playerIds, coachIds: fact.coachIds, momentum: 16 + fact.importance * 5, relatedToHero: fact.relatedToHero, resolved: fact.kind === "championship" };
  }
  if (fact.kind === "rivalry" && fact.teamIds.length >= 2) {
    return { kind: "rivalry-era", title: `Rivalry: ${fact.title}`, teamIds: fact.teamIds, playerIds: fact.playerIds, coachIds: fact.coachIds, momentum: 20 + fact.importance * 4, relatedToHero: fact.relatedToHero };
  }
  if (["budget-crunch", "resource-shift", "investment", "roster-plan", "market-chain", "scheme-fit"].includes(fact.kind) && teamId) {
    return { kind: "program-rebuild", title: `Программа: ${fact.title}`, teamIds: fact.teamIds, playerIds: fact.playerIds, coachIds: fact.coachIds, momentum: 10 + fact.importance * 4, relatedToHero: fact.relatedToHero };
  }
  return undefined;
}

function primaryArcSubject(draft: ArcDraft): string {
  if (draft.playerIds[0]) return `player:${draft.playerIds[0]}`;
  if (draft.coachIds[0]) return `coach:${draft.coachIds[0]}`;
  return `team:${[...draft.teamIds].sort().join("+")}`;
}

function advanceArcs(
  arcs: EcosystemStoryArc[],
  newFacts: EcosystemHistoryFact[],
  allFacts: EcosystemHistoryFact[],
  seasonYear: number,
  week: number,
  date: GameDate,
): { arcs: EcosystemStoryArc[]; stories: EcosystemStory[] } {
  const next = [...arcs];
  const stories: EcosystemStory[] = [];
  for (const fact of newFacts) {
    const draft = arcDraft(fact);
    if (!draft) continue;
    const subject = primaryArcSubject(draft);
    const openIndex = next.findIndex((arc) => arc.kind === draft.kind && primaryArcSubject(arc) === subject && arc.status !== "resolved");
    const previous = openIndex >= 0 ? next[openIndex] : undefined;
    const id = previous?.id ?? `arc:${draft.kind}:${subject}:${fact.seasonYear}`;
    const index = openIndex;
    const factIds = [...(previous?.factIds ?? []), fact.id].slice(-16);
    const chapters = (previous?.chapters ?? 0) + 1;
    const arc: EcosystemStoryArc = {
      id,
      kind: draft.kind,
      status: draft.resolved ? "resolved" : chapters >= 2 ? "active" : "emerging",
      title: previous?.title ?? draft.title,
      summary: allFacts
        .filter((item) => factIds.includes(item.id))
        .slice(-3)
        .map((item) => item.title)
        .join(" → "),
      teamIds: [...new Set([...(previous?.teamIds ?? []), ...draft.teamIds])],
      playerIds: [...new Set([...(previous?.playerIds ?? []), ...draft.playerIds])],
      coachIds: [...new Set([...(previous?.coachIds ?? []), ...draft.coachIds])],
      startedSeasonYear: previous?.startedSeasonYear ?? fact.seasonYear,
      startedWeek: previous?.startedWeek ?? fact.week,
      lastSeasonYear: fact.seasonYear,
      lastWeek: fact.week,
      momentum: clamp((previous?.momentum ?? 0) + draft.momentum, -100, 100),
      chapters,
      factIds,
      relatedToHero: previous?.relatedToHero === true || draft.relatedToHero,
    };
    if (index >= 0) next[index] = arc;
    else next.push(arc);

    if (chapters === 3 || chapters === 6 || draft.resolved) {
      stories.push({
        id: `storyline:${id}:${seasonYear}:${week}:${chapters}`,
        kind: "storyline",
        createdOn: date,
        week,
        title: `${arc.title}: глава ${chapters}`,
        detail: arc.summary || fact.detail,
        importance: importance(Math.min(5, 2 + Math.floor(chapters / 2) + (arc.relatedToHero ? 1 : 0))),
        teamIds: arc.teamIds,
        playerIds: arc.playerIds,
        coachIds: arc.coachIds,
        relatedToHero: arc.relatedToHero,
      });
    }
  }
  return { arcs: next.slice(-MAX_ARCS), stories };
}

export interface AdvanceWorldHistoryInput {
  history: EcosystemHistoryState;
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  stories: EcosystemStory[];
  transactions: EcosystemTransaction[];
  seasonYear: number;
  week: number;
  date: GameDate;
}

export function advanceWorldHistory(input: AdvanceWorldHistoryInput): { history: EcosystemHistoryState; stories: EcosystemStory[] } {
  const processed = new Set(input.history.processedSourceIds);
  const candidateFacts = [
    ...input.stories.map(factFromStory).filter((fact): fact is EcosystemHistoryFact => Boolean(fact)),
    ...input.transactions.map(factFromTransaction),
  ];
  const pendingSources: EcosystemHistoryFact[] = [];
  for (const fact of candidateFacts) {
    const key = `${fact.sourceType}:${fact.sourceId}`;
    if (!processed.has(key)) pendingSources.push(fact);
  }
  const existingFacts = dedupeFacts(input.history.facts);
  const existingFactIds = new Set(existingFacts.map((fact) => fact.id));
  const existingSemanticKeys = new Set(existingFacts.map(historyFactSemanticKey));
  const pendingFacts = dedupeFacts(pendingSources);
  const newFacts = pendingFacts.filter((fact) => !existingFactIds.has(fact.id) && !existingSemanticKeys.has(historyFactSemanticKey(fact))).sort((left, right) => {
    const leftDate = left.createdOn.year * 10_000 + left.createdOn.month * 100 + left.createdOn.day;
    const rightDate = right.createdOn.year * 10_000 + right.createdOn.month * 100 + right.createdOn.day;
    return leftDate - rightDate || left.week - right.week || left.id.localeCompare(right.id);
  });
  const facts = dedupeFacts([...existingFacts, ...newFacts]).slice(-MAX_FACTS);
  const retainedFactIds = new Set(facts.map((fact) => fact.id));
  const processedSourceIds = [
    ...input.history.processedSourceIds,
    ...pendingSources.map((fact) => `${fact.sourceType}:${fact.sourceId}`),
  ].slice(-MAX_PROCESSED_SOURCES);
  const currentObjectives = ensureCurrentObjectives(input.history.objectives, input.teams, input.players, input.coaches, input.seasonYear, input.week);
  const objectives = currentObjectives
    .map((objective) => updateObjective(objective, input.teams, input.players, input.coaches, newFacts, input.seasonYear, input.week))
    .map((objective) => ({ ...objective, evidenceFactIds: objective.evidenceFactIds.filter((id) => retainedFactIds.has(id)) }))
    .slice(-MAX_OBJECTIVES);
  const arcResult = advanceArcs(input.history.arcs, newFacts, facts, input.seasonYear, input.week, input.date);
  const arcs = arcResult.arcs.map((arc) => ({ ...arc, factIds: arc.factIds.filter((id) => retainedFactIds.has(id)) }));
  const activeArcs = arcs.filter((arc) => arc.status === "active" || arc.status === "emerging");
  const activeObjectives = objectives.filter((objective) => objective.status === "active");
  const completedObjectives = objectives.filter((objective) => objective.completedSeasonYear === input.seasonYear && objective.completedWeek === input.week);
  const digest = [
    `${newFacts.length} новых фактов вошли в историю мира.`,
    `${activeArcs.length} сюжетных линий продолжаются.`,
    `${activeObjectives.length} целей остаются активными.`,
    ...(completedObjectives.length > 0 ? [`${completedObjectives.length} целей завершены на этой неделе.`] : []),
    ...activeArcs.sort((left, right) => right.momentum - left.momentum).slice(0, 2).map((arc) => arc.summary),
  ].filter(Boolean).slice(0, 6);
  return {
    history: {
      version: 1,
      lastProcessedSeasonYear: input.seasonYear,
      lastProcessedWeek: input.week,
      processedSourceIds,
      facts,
      objectives,
      arcs,
      digest,
    },
    stories: arcResult.stories,
  };
}
