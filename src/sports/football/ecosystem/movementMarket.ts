import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import {
  availableNilCapacity,
  availableRecruitingBudget,
  reserveRecruitingResources,
  resourceRecruitingPower,
} from "./resources";
import type {
  EcosystemCandidateKind,
  EcosystemCoach,
  EcosystemCoachVacancy,
  EcosystemIndependentProspect,
  EcosystemMarketNegotiation,
  EcosystemPlayer,
  EcosystemPromiseRole,
  EcosystemRosterOpening,
  EcosystemStory,
  EcosystemTalentPipeline,
  EcosystemTeam,
  EcosystemTransaction,
  EcosystemUnifiedMovementMarket,
} from "./types";

const POSITIONS = ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[];

interface MarketContext {
  seasonYear: number;
  week: number;
  day: number;
  date: GameDate;
  phase: "regular-season" | "postseason" | "offseason" | "preseason" | "winter-evaluation" | "spring-development" | "summer-recruiting";
  heroProgramId?: string | undefined;
  heroPosition: FootballPosition;
  relevantProgramIds: string[];
}

interface MarketCandidate {
  id: string;
  kind: EcosystemCandidateKind;
  name: string;
  position: FootballPosition;
  overall: number;
  potential: number;
  homeState: string;
  sourceTeamId?: string | undefined;
  playerId?: string | undefined;
  independentId?: string | undefined;
  nationalRank: number;
}

export interface UnifiedMarketResult {
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  talentPipeline: EcosystemTalentPipeline;
  movementMarket: EcosystemUnifiedMovementMarket;
  stories: EcosystemStory[];
  transactions: EcosystemTransaction[];
}

export interface CoachMarketReactionResult {
  players: EcosystemPlayer[];
  movementMarket: EcosystemUnifiedMovementMarket;
  stories: EcosystemStory[];
  transactions: EcosystemTransaction[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function story(
  context: MarketContext,
  kind: EcosystemStory["kind"],
  title: string,
  detail: string,
  importance: 1 | 2 | 3 | 4 | 5,
  teamIds: string[],
  playerIds: string[] = [],
  coachIds: string[] = [],
  relatedToHero = false,
): EcosystemStory {
  return {
    id: `market:${context.seasonYear}:${context.week}:${kind}:${teamIds[0] ?? playerIds[0] ?? coachIds[0] ?? title.length}`,
    kind,
    createdOn: context.date,
    week: Math.max(1, context.week),
    title,
    detail,
    importance,
    teamIds,
    playerIds,
    coachIds,
    relatedToHero,
  };
}

function transaction(
  context: MarketContext,
  input: Omit<EcosystemTransaction, "id" | "seasonYear" | "week" | "createdOn"> & { idPart: string },
): EcosystemTransaction {
  const { idPart, ...rest } = input;
  return {
    id: `market:${context.seasonYear}:${context.week}:${idPart}`,
    seasonYear: context.seasonYear,
    week: Math.max(1, context.week),
    createdOn: context.date,
    ...rest,
  };
}

function candidateKey(kind: EcosystemCandidateKind, id: string): string {
  return `${kind}:${id}`;
}

function openingId(seasonYear: number, teamId: string, position: FootballPosition): string {
  return `${seasonYear}:${teamId}:${position}`;
}

function roleForOpening(team: EcosystemTeam, position: FootballPosition): EcosystemPromiseRole {
  const projection = team.rosterPlan.positionProjections[position];
  if (projection.needNow >= 78 || projection.currentPlayers <= 1) return "starter-path";
  if (projection.needNow >= 48 || projection.returningNextYear <= 2) return "rotation";
  return "developmental";
}

function openingReason(team: EcosystemTeam, position: FootballPosition): string {
  const projection = team.rosterPlan.positionProjections[position];
  if (projection.projectedDepartures >= 2) return `${projection.projectedDepartures} игрока уходят из комнаты ${position} в ближайший год.`;
  if (projection.needNow >= 70) return `${position} — срочная позиционная потребность программы.`;
  if (projection.needNextYear >= 65) return `${position} станет дефицитной в горизонте двух сезонов.`;
  return `${position} входит в план набора на три года.`;
}

function committedCandidateIds(players: EcosystemPlayer[], teamId: string, position: FootballPosition): string[] {
  return players
    .filter((player) => player.level === "high-school" && player.position === position && player.committedTeamId === teamId)
    .map((player) => candidateKey("high-school", player.id));
}

export function createUnifiedMovementMarket(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  seasonYear: number,
): EcosystemUnifiedMovementMarket {
  const openings = buildOpenings(teams, players, seasonYear, []);
  return {
    version: 1,
    seasonYear,
    lastProcessedDay: 0,
    openings,
    negotiations: [],
    coachVacancies: [],
    acceptedMoves: 0,
    withdrawnOffers: 0,
    digest: [
      `${openings.filter((opening) => opening.status === "open").length} позиционных вакансий открыты на общем рынке.`,
      "Школьные рекруты, JUCO, walk-on и трансферы конкурируют за одни и те же места.",
    ],
  };
}

function buildOpenings(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  seasonYear: number,
  existing: EcosystemRosterOpening[],
): EcosystemRosterOpening[] {
  const previous = new Map(existing.map((opening) => [opening.id, opening]));
  return teams
    .filter((team) => team.level === "college")
    .flatMap((team) => POSITIONS.map((position) => {
      const id = openingId(seasonYear, team.id, position);
      const old = previous.get(id);
      const committed = committedCandidateIds(players, team.id, position);
      const filledByCandidateIds = [...new Set([...(old?.filledByCandidateIds ?? []), ...committed])];
      const targetAdds = team.rosterPlan.positionProjections[position].targetAdds;
      const slots = Math.max(0, Math.min(
        targetAdds,
        team.rosterPlan.targetClassSize,
        team.compliance.rosterLimit - team.compliance.estimatedRosterSize + filledByCandidateIds.length,
      ));
      const scholarshipSlots = Math.max(0, Math.min(
        slots,
        team.compliance.fundedScholarships - team.compliance.scholarshipsUsed + filledByCandidateIds.length,
      ));
      const remaining = Math.max(0, slots - filledByCandidateIds.length);
      return {
        id,
        teamId: team.id,
        position,
        seasonYear,
        slots,
        scholarshipSlots,
        nilAvailable: rounded(availableNilCapacity(team.resources)),
        recruitingAvailable: rounded(availableRecruitingBudget(team.resources)),
        filledByCandidateIds,
        status: slots <= 0 ? "closed" as const : remaining <= 0 ? "filled" as const : "open" as const,
        reason: openingReason(team, position),
      };
    }));
}

function candidatePool(
  players: EcosystemPlayer[],
  pipeline: EcosystemTalentPipeline,
  context: MarketContext,
): MarketCandidate[] {
  const highSchool = players
    .filter((player) => player.level === "high-school"
      && player.classYear === "Senior"
      && player.recruitingStage !== "committed"
      && player.overall >= 54)
    .map((player): MarketCandidate => ({
      id: player.id,
      kind: "high-school",
      name: player.name,
      position: player.position,
      overall: player.overall,
      potential: player.potential,
      homeState: player.talent.homeState,
      sourceTeamId: player.teamId,
      playerId: player.id,
      nationalRank: player.nationalRank,
    }));

  const transfers = (context.phase === "offseason" || context.phase === "winter-evaluation" || context.phase === "spring-development")
    ? players
      .filter((player) => player.level === "college"
        && !player.isHero
        && player.eligibilityYears > 1
        && (player.transferStatus === "portal" || player.depthRank >= 3 || player.usagePlan === "developmental")
        && player.overall >= 58)
      .map((player): MarketCandidate => ({
        id: player.id,
        kind: "transfer",
        name: player.name,
        position: player.position,
        overall: player.overall,
        potential: player.potential,
        homeState: player.talent.homeState,
        sourceTeamId: player.teamId,
        playerId: player.id,
        nationalRank: player.nationalRank,
      }))
    : [];

  const independent = (context.phase === "offseason" || context.phase === "winter-evaluation" || context.phase === "spring-development" || context.phase === "summer-recruiting")
    ? pipeline.independentProspects
      .filter((prospect) => prospect.status !== "committed")
      .map((prospect): MarketCandidate => ({
        id: prospect.id,
        kind: prospect.route,
        name: prospect.name,
        position: prospect.position,
        overall: prospect.overall,
        potential: prospect.potential,
        homeState: prospect.homeState,
        independentId: prospect.id,
        nationalRank: 9999,
      }))
    : [];

  return [...highSchool, ...transfers, ...independent];
}

function candidatePriority(candidate: MarketCandidate): number {
  const routeBoost = candidate.kind === "transfer" ? 12 : candidate.kind === "juco" ? 7 : candidate.kind === "walk-on" ? -4 : 0;
  return candidate.overall * 0.48 + candidate.potential * 0.31 + Math.max(0, 1800 - candidate.nationalRank) * 0.006 + routeBoost;
}

function scholarshipFor(candidate: MarketCandidate, opening: EcosystemRosterOpening): "none" | "partial" | "full" {
  if (opening.scholarshipSlots <= opening.filledByCandidateIds.length) return "none";
  if (candidate.kind === "walk-on" && candidate.overall < 72) return "none";
  if (candidate.overall >= 70 || candidate.kind === "transfer" || candidate.nationalRank <= 900) return "full";
  return candidate.overall >= 63 ? "partial" : "none";
}

function nilOfferFor(candidate: MarketCandidate, opening: EcosystemRosterOpening): number {
  const marketValue = candidate.kind === "transfer"
    ? Math.max(0.06, (candidate.overall - 60) * 0.021)
    : candidate.nationalRank <= 300
      ? 0.55
      : candidate.nationalRank <= 900
        ? 0.24
        : Math.max(0, (candidate.overall - 68) * 0.012);
  return rounded(Math.min(opening.nilAvailable, marketValue));
}

function offerScore(
  candidate: MarketCandidate,
  opening: EcosystemRosterOpening,
  team: EcosystemTeam,
  coaches: EcosystemCoach[],
  random: SeededRandom,
): number {
  const role = roleForOpening(team, candidate.position);
  const roleValue = role === "starter-path" ? 26 : role === "rotation" ? 15 : 6;
  const scholarship = scholarshipFor(candidate, opening);
  const aidValue = scholarship === "full" ? 14 : scholarship === "partial" ? 7 : 0;
  const coach = coaches.find((item) => item.teamId === team.id && item.role === "head-coach");
  const stability = (coach?.jobSecurity ?? 50) * 0.09 - (coach?.pressure ?? 50) * 0.05;
  const proximity = team.stateCode === candidate.homeState ? 8 : 0;
  const need = team.rosterPlan.positionProjections[candidate.position].needNow * 0.22;
  return clamp(
    roleValue
      + aidValue
      + nilOfferFor(candidate, opening) * 15
      + team.prestige * 0.13
      + resourceRecruitingPower(team.resources) * 0.11
      + need
      + stability
      + proximity
      + random.integer(-8, 8),
  );
}

function activeOfferExists(negotiations: EcosystemMarketNegotiation[], candidateId: string, teamId: string): boolean {
  return negotiations.some((item) => item.candidateId === candidateId && item.teamId === teamId && item.status === "offered");
}

function relevant(context: MarketContext, teamId: string, position: FootballPosition): boolean {
  return teamId === context.heroProgramId || (position === context.heroPosition && context.relevantProgramIds.includes(teamId));
}

function offerReason(candidate: MarketCandidate, team: EcosystemTeam, role: EcosystemPromiseRole, opening: EcosystemRosterOpening): string {
  const route = candidate.kind === "transfer" ? "опытный трансфер" : candidate.kind === "juco" ? "JUCO-игрок" : candidate.kind === "walk-on" ? "walk-on кандидат" : "школьный рекрут";
  const roleText = role === "starter-path" ? "путь к стартовой роли" : role === "rotation" ? "место в ротации" : "долгосрочное развитие";
  return `${team.shortName} рассматривает ${route}: ${opening.reason} Штаб предлагает ${roleText}.`;
}

function createOffers(
  candidates: MarketCandidate[],
  openings: EcosystemRosterOpening[],
  negotiations: EcosystemMarketNegotiation[],
  teams: EcosystemTeam[],
  coaches: EcosystemCoach[],
  context: MarketContext,
  random: SeededRandom,
): EcosystemMarketNegotiation[] {
  const next = [...negotiations];
  const maxCandidates = context.phase === "regular-season" ? 7 : 14;
  for (const candidate of [...candidates].sort((left, right) => candidatePriority(right) - candidatePriority(left)).slice(0, maxCandidates)) {
    const existingAccepted = next.some((item) => item.candidateId === candidateKey(candidate.kind, candidate.id) && item.status === "accepted");
    if (existingAccepted) continue;
    const candidateId = candidateKey(candidate.kind, candidate.id);
    const options = openings
      .filter((opening) => opening.position === candidate.position
        && (opening.status === "open" || (candidate.kind === "transfer" && opening.slots > 0))
        && (opening.filledByCandidateIds.length < opening.slots || candidate.kind === "transfer")
        && opening.recruitingAvailable >= 0.03
        && opening.teamId !== candidate.sourceTeamId)
      .map((opening) => {
        const team = teams.find((item) => item.id === opening.teamId);
        if (!team) return undefined;
        return { opening, team, score: offerScore(candidate, opening, team, coaches, random.fork(`${candidateId}:${opening.id}`)) };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);
    for (const option of options) {
      if (activeOfferExists(next, candidateId, option.team.id)) continue;
      const promisedRole = roleForOpening(option.team, candidate.position);
      next.push({
        id: `negotiation:${context.seasonYear}:${context.week}:${candidateId}:${option.team.id}`,
        candidateId,
        candidateKind: candidate.kind,
        candidateName: candidate.name,
        position: candidate.position,
        teamId: option.team.id,
        status: "offered",
        scholarship: scholarshipFor(candidate, option.opening),
        nilOffer: nilOfferFor(candidate, option.opening),
        promisedRole,
        score: option.score,
        createdWeek: context.week,
        expiresWeek: context.week + (candidate.kind === "transfer" ? 1 : 3),
        reason: offerReason(candidate, option.team, promisedRole, option.opening),
      });
    }
  }
  return next;
}

function candidateFromNegotiation(
  negotiation: EcosystemMarketNegotiation,
  players: EcosystemPlayer[],
  pipeline: EcosystemTalentPipeline,
): MarketCandidate | undefined {
  if (negotiation.candidateKind === "high-school" || negotiation.candidateKind === "transfer") {
    const id = negotiation.candidateId.replace(`${negotiation.candidateKind}:`, "");
    const player = players.find((item) => item.id === id);
    if (!player) return undefined;
    return {
      id: player.id,
      kind: negotiation.candidateKind,
      name: player.name,
      position: player.position,
      overall: player.overall,
      potential: player.potential,
      homeState: player.talent.homeState,
      sourceTeamId: player.teamId,
      playerId: player.id,
      nationalRank: player.nationalRank,
    };
  }
  const id = negotiation.candidateId.replace(`${negotiation.candidateKind}:`, "");
  const prospect = pipeline.independentProspects.find((item) => item.id === id);
  if (!prospect) return undefined;
  return {
    id: prospect.id,
    kind: negotiation.candidateKind,
    name: prospect.name,
    position: prospect.position,
    overall: prospect.overall,
    potential: prospect.potential,
    homeState: prospect.homeState,
    independentId: prospect.id,
    nationalRank: 9999,
  };
}

function shouldResolveImmediately(kind: EcosystemCandidateKind, context: MarketContext): boolean {
  return kind !== "high-school" || context.phase !== "regular-season";
}

function resolveOffers(
  negotiations: EcosystemMarketNegotiation[],
  playersInput: EcosystemPlayer[],
  teamsInput: EcosystemTeam[],
  pipelineInput: EcosystemTalentPipeline,
  openingsInput: EcosystemRosterOpening[],
  context: MarketContext,
  random: SeededRandom,
): {
  negotiations: EcosystemMarketNegotiation[];
  players: EcosystemPlayer[];
  teams: EcosystemTeam[];
  pipeline: EcosystemTalentPipeline;
  openings: EcosystemRosterOpening[];
  stories: EcosystemStory[];
  transactions: EcosystemTransaction[];
  accepted: number;
  withdrawn: number;
} {
  let players = [...playersInput];
  let teams = [...teamsInput];
  let pipeline = { ...pipelineInput, independentProspects: [...pipelineInput.independentProspects] };
  let openings = [...openingsInput];
  let next = negotiations.map((item) => item.status === "offered" && item.expiresWeek < context.week ? { ...item, status: "expired" as const } : item);
  const stories: EcosystemStory[] = [];
  const transactions: EcosystemTransaction[] = [];
  let accepted = 0;
  let withdrawn = next.filter((item, index) => negotiations[index]?.status === "offered" && item.status === "expired").length;
  const candidateIds = [...new Set(next.filter((item) => item.status === "offered").map((item) => item.candidateId))];

  for (const candidateId of candidateIds) {
    const offers = next
      .filter((item) => item.candidateId === candidateId && item.status === "offered")
      .sort((left, right) => right.score - left.score);
    const best = offers[0];
    if (!best) continue;
    const candidate = candidateFromNegotiation(best, players, pipeline);
    if (!candidate) continue;
    if (!shouldResolveImmediately(candidate.kind, context) && best.createdWeek >= context.week) continue;
    const candidateRandom = random.fork(`resolve:${candidateId}:${context.week}`);
    const acceptanceThreshold = candidate.kind === "high-school" ? 0.42 : candidate.kind === "transfer" ? 0.2 : 0.3;
    if (best.score < 75 && !candidateRandom.chance(Math.min(0.92, acceptanceThreshold + best.score / 170))) continue;
    const targetIndex = teams.findIndex((team) => team.id === best.teamId);
    const target = teams[targetIndex];
    const openingIndex = openings.findIndex((opening) => opening.teamId === best.teamId && opening.position === candidate.position);
    const opening = openings[openingIndex];
    if (!target || !opening || (opening.status !== "open" && candidate.kind !== "transfer") || (opening.filledByCandidateIds.length >= opening.slots && candidate.kind !== "transfer")) continue;

    const recruitingCost = candidate.kind === "transfer" ? 0.08 : candidate.kind === "juco" ? 0.06 : candidate.kind === "walk-on" ? 0.02 : candidate.nationalRank <= 300 ? 0.42 : candidate.nationalRank <= 900 ? 0.24 : 0.12;
    const nextResources = reserveRecruitingResources(target.resources, recruitingCost, best.nilOffer);
    const scholarshipAdd = best.scholarship === "none" ? 0 : 1;
    const nextNeeds = { ...target.positionNeeds, [candidate.position]: clamp(target.positionNeeds[candidate.position] - (candidate.kind === "transfer" ? 15 : 9)) };
    teams[targetIndex] = {
      ...target,
      positionNeeds: nextNeeds,
      resources: nextResources,
      rosterIds: candidate.kind === "transfer" && candidate.playerId && !target.rosterIds.includes(candidate.playerId)
        ? [...target.rosterIds, candidate.playerId]
        : target.rosterIds,
      compliance: {
        ...target.compliance,
        estimatedRosterSize: Math.min(target.compliance.rosterLimit, target.compliance.estimatedRosterSize + 1),
        scholarshipsUsed: Math.min(target.compliance.fundedScholarships, target.compliance.scholarshipsUsed + scholarshipAdd),
      },
    };

    if (candidate.kind === "transfer" && candidate.sourceTeamId && candidate.playerId) {
      const sourceIndex = teams.findIndex((team) => team.id === candidate.sourceTeamId);
      const sourceTeam = teams[sourceIndex];
      const sourcePlayer = players.find((player) => player.id === candidate.playerId);
      if (sourceTeam) {
        const sourceScholarship = sourcePlayer?.eligibility.scholarshipStatus === "none" ? 0 : 1;
        teams[sourceIndex] = {
          ...sourceTeam,
          rosterIds: sourceTeam.rosterIds.filter((id) => id !== candidate.playerId),
          compliance: {
            ...sourceTeam.compliance,
            estimatedRosterSize: Math.max(0, sourceTeam.compliance.estimatedRosterSize - 1),
            scholarshipsUsed: Math.max(0, sourceTeam.compliance.scholarshipsUsed - sourceScholarship),
          },
          positionNeeds: {
            ...sourceTeam.positionNeeds,
            [candidate.position]: clamp(sourceTeam.positionNeeds[candidate.position] + 12),
          },
        };
      }
    }

    if (candidate.playerId) {
      const playerIndex = players.findIndex((player) => player.id === candidate.playerId);
      const player = players[playerIndex];
      if (player) {
        if (candidate.kind === "transfer") {
          players[playerIndex] = {
            ...player,
            teamId: target.id,
            previousTeamIds: [...player.previousTeamIds, player.teamId].slice(-8),
            transferStatus: "transferred",
            depthRank: 3,
            status: "backup",
            form: clamp(player.form + 4),
            eligibility: {
              ...player.eligibility,
              scholarshipStatus: best.scholarship,
            },
          };
        } else {
          players[playerIndex] = {
            ...player,
            recruitingStage: "committed",
            committedTeamId: target.id,
          };
        }
      }
    } else if (candidate.independentId) {
      pipeline = {
        ...pipeline,
        independentProspects: pipeline.independentProspects.map((prospect) => prospect.id === candidate.independentId
          ? { ...prospect, status: "committed", committedTeamId: target.id }
          : prospect),
      };
    }

    openings[openingIndex] = {
      ...opening,
      filledByCandidateIds: [...opening.filledByCandidateIds, candidateId],
      status: opening.filledByCandidateIds.length + 1 >= opening.slots ? "filled" : "open",
      nilAvailable: rounded(Math.max(0, opening.nilAvailable - best.nilOffer)),
      recruitingAvailable: rounded(Math.max(0, opening.recruitingAvailable - recruitingCost)),
    };

    next = next.map((item) => {
      if (item.id === best.id) return { ...item, status: "accepted" as const };
      if (item.candidateId === candidateId && item.status === "offered") {
        withdrawn += 1;
        return { ...item, status: "withdrawn" as const, reason: `${candidate.name} выбрал другую программу.` };
      }
      if (item.teamId === target.id && item.position === candidate.position && item.status === "offered" && openings[openingIndex]?.status === "filled") {
        withdrawn += 1;
        return { ...item, status: "withdrawn" as const, reason: `${target.shortName} закрыл последнюю вакансию на позиции ${candidate.position}.` };
      }
      return item;
    });

    const relatedToHero = relevant(context, target.id, candidate.position) || candidate.playerId === "hero";
    const routeLabel = candidate.kind === "transfer" ? "трансфер" : candidate.kind === "juco" ? "JUCO" : candidate.kind === "walk-on" ? "walk-on" : "школьный рекрут";
    const detail = `${target.shortName} закрыл вакансию ${candidate.position}: ${candidate.name} (${routeLabel}) принял предложение. Это место, стипендия и NIL больше недоступны другим кандидатам.`;
    stories.push(story(context, "market-chain", `${target.shortName} закрыл позицию ${candidate.position}`, detail, relatedToHero ? 5 : candidate.overall >= 76 ? 4 : 3, [target.id, ...(candidate.sourceTeamId ? [candidate.sourceTeamId] : [])], candidate.playerId ? [candidate.playerId] : [], [], relatedToHero));
    transactions.push(transaction(context, {
      idPart: `accept:${candidateId}:${target.id}`,
      kind: candidate.kind === "transfer" ? "transfer" : "commitment",
      title: `${candidate.name} выбрал ${target.shortName}`,
      detail,
      ...(candidate.playerId ? { playerId: candidate.playerId } : {}),
      ...(candidate.sourceTeamId ? { fromTeamId: candidate.sourceTeamId } : {}),
      toTeamId: target.id,
      relatedToHero,
    }));
    accepted += 1;

    if (candidate.kind === "transfer") {
      const targetAdds = target.rosterPlan.positionProjections[candidate.position].targetAdds;
      const committed = players
        .filter((player) => player.level === "high-school" && player.position === candidate.position && player.committedTeamId === target.id)
        .sort((left, right) => left.overall - right.overall || right.nationalRank - left.nationalRank);
      if (committed.length >= Math.max(1, targetAdds)) {
        const displaced = committed[0];
        if (displaced) {
          players = players.map((player) => player.id === displaced.id
            ? { ...player, recruitingStage: "offered", committedTeamId: undefined }
            : player);
          const currentTarget = teams[targetIndex];
          if (currentTarget) {
            const lostScholarship = displaced.overall >= 65 || displaced.nationalRank <= 900 ? 1 : 0;
            teams[targetIndex] = {
              ...currentTarget,
              compliance: {
                ...currentTarget.compliance,
                estimatedRosterSize: Math.max(0, currentTarget.compliance.estimatedRosterSize - 1),
                scholarshipsUsed: Math.max(0, currentTarget.compliance.scholarshipsUsed - lostScholarship),
              },
            };
          }
          const displacedKey = candidateKey("high-school", displaced.id);
          next = next.map((item) => item.candidateId === displacedKey && item.status === "accepted"
            ? { ...item, status: "withdrawn" as const, reason: `${target.shortName} закрыл место опытным трансфером.` }
            : item);
          withdrawn += 1;
          const displacedRelated = relevant(context, target.id, displaced.position) || displaced.id === "hero";
          const displacedDetail = `${target.shortName} взял опытного ${candidate.position} и отозвал место у ${displaced.name}. Рекрут снова вышел на рынок.`;
          stories.push(story(context, "offer-withdrawn", `${displaced.name} потерял место в наборе`, displacedDetail, displacedRelated ? 5 : 4, [target.id, displaced.teamId], [displaced.id, ...(candidate.playerId ? [candidate.playerId] : [])], [], displacedRelated));
          transactions.push(transaction(context, {
            idPart: `withdraw:${displaced.id}:${target.id}`,
            kind: "offer-withdrawn",
            title: `${target.shortName} отозвал место`,
            detail: displacedDetail,
            playerId: displaced.id,
            fromTeamId: target.id,
            relatedToHero: displacedRelated,
          }));
        }
      }
    }
  }

  return { negotiations: next, players, teams, pipeline, openings, stories, transactions, accepted, withdrawn };
}

export function advanceUnifiedMovementMarket(input: {
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  talentPipeline: EcosystemTalentPipeline;
  movementMarket: EcosystemUnifiedMovementMarket;
  context: MarketContext;
  random: SeededRandom;
}): UnifiedMarketResult {
  const { context } = input;
  const baseMarket = input.movementMarket.seasonYear === context.seasonYear
    ? input.movementMarket
    : createUnifiedMovementMarket(input.teams, input.players, context.seasonYear);
  let openings = buildOpenings(input.teams, input.players, context.seasonYear, baseMarket.openings);
  let negotiations = baseMarket.negotiations
    .filter((item) => item.status === "accepted" || item.expiresWeek >= context.week - 6)
    .slice(-180);
  const candidates = candidatePool(input.players, input.talentPipeline, context);
  negotiations = createOffers(candidates, openings, negotiations, input.teams, input.coaches, context, input.random.fork("offers"));
  const resolved = resolveOffers(negotiations, input.players, input.teams, input.talentPipeline, openings, context, input.random.fork("resolve"));
  openings = buildOpenings(resolved.teams, resolved.players, context.seasonYear, resolved.openings);
  const offered = resolved.negotiations.filter((item) => item.status === "offered").length;
  const digest = [
    `${offered} активных предложений конкурируют за ${openings.filter((opening) => opening.status === "open").length} открытых вакансий.`,
    `${resolved.accepted} решений принято на этой фазе рынка; ${resolved.withdrawn} предложений закрыто или отозвано.`,
    `${resolved.players.filter((player) => player.transferStatus === "portal").length} игроков находятся в трансферном портале.`,
  ];
  return {
    teams: resolved.teams,
    players: resolved.players,
    talentPipeline: resolved.pipeline,
    movementMarket: {
      ...baseMarket,
      seasonYear: context.seasonYear,
      lastProcessedDay: context.day,
      openings,
      negotiations: resolved.negotiations.slice(-180),
      acceptedMoves: baseMarket.acceptedMoves + resolved.accepted,
      withdrawnOffers: baseMarket.withdrawnOffers + resolved.withdrawn,
      digest,
    },
    stories: resolved.stories,
    transactions: [
      ...resolved.transactions,
      ...resolved.negotiations
        .filter((item) => item.createdWeek === context.week && item.status === "offered")
        .map((item) => transaction(context, {
          idPart: `offer:${item.candidateId}:${item.teamId}`,
          kind: "offer-issued",
          title: `${item.candidateName} получил предложение`,
          detail: item.reason,
          toTeamId: item.teamId,
          relatedToHero: relevant(context, item.teamId, item.position) || item.candidateId.endsWith(":hero"),
        })),
    ],
  };
}

export function applyCoachMovementConsequences(input: {
  movementMarket: EcosystemUnifiedMovementMarket;
  coachTransactions: EcosystemTransaction[];
  players: EcosystemPlayer[];
  teams: EcosystemTeam[];
  coaches: EcosystemCoach[];
  context: MarketContext;
  random: SeededRandom;
}): CoachMarketReactionResult {
  let players = [...input.players];
  let vacancies = [...input.movementMarket.coachVacancies];
  const stories: EcosystemStory[] = [];
  const transactions: EcosystemTransaction[] = [];

  for (const move of input.coachTransactions) {
    if (move.kind === "coach-fired" && move.fromTeamId) {
      const team = input.teams.find((item) => item.id === move.fromTeamId);
      if (!team) continue;
      const id = `vacancy:${input.context.seasonYear}:${team.id}:head-coach`;
      const existing = vacancies.find((item) => item.id === id);
      const vacancy: EcosystemCoachVacancy = existing ?? {
        id,
        teamId: team.id,
        role: "head-coach",
        status: "open",
        openedSeasonYear: input.context.seasonYear,
        openedWeek: input.context.week,
        salaryBudget: rounded(team.resources.coachingBudget),
        reason: move.detail,
        ...(move.coachId ? { formerCoachId: move.coachId } : {}),
      };
      vacancies = [...vacancies.filter((item) => item.id !== id), vacancy];
      transactions.push(transaction(input.context, {
        idPart: `vacancy:${team.id}`,
        kind: "coach-vacancy",
        title: `${team.shortName} открыл тренерскую вакансию`,
        detail: move.detail,
        fromTeamId: team.id,
        relatedToHero: move.relatedToHero,
      }));

      const committed = players
        .filter((player) => player.level === "high-school" && player.committedTeamId === team.id)
        .sort((left, right) => left.overall - right.overall);
      const decommit = committed.find((player) => input.random.fork(`decommit:${player.id}:${team.id}`).chance(0.28));
      if (decommit) {
        players = players.map((player) => player.id === decommit.id
          ? { ...player, recruitingStage: "offered", committedTeamId: undefined }
          : player);
        const detail = `${decommit.name} открыл набор после увольнения штаба ${team.shortName}. Старые обещания больше не считаются надёжными.`;
        stories.push(story(input.context, "market-chain", `${decommit.name} отозвал коммит`, detail, move.relatedToHero || decommit.id === "hero" ? 5 : 4, [team.id, decommit.teamId], [decommit.id], move.coachId ? [move.coachId] : [], move.relatedToHero || decommit.id === "hero"));
        transactions.push(transaction(input.context, {
          idPart: `decommit:${decommit.id}:${team.id}`,
          kind: "offer-withdrawn",
          title: `${decommit.name} снова на рынке`,
          detail,
          playerId: decommit.id,
          fromTeamId: team.id,
          relatedToHero: move.relatedToHero || decommit.id === "hero",
        }));
      }

      players = players.map((player) => {
        if (player.teamId !== team.id || player.level !== "college" || player.isHero || player.depthRank < 3) return player;
        return input.random.fork(`portal-after-coach:${player.id}:${team.id}`).chance(0.2)
          ? { ...player, transferStatus: "portal" as const }
          : player;
      });
    }

    if (move.kind === "coach-hired" && move.toTeamId && move.coachId) {
      vacancies = vacancies.map((vacancy) => vacancy.teamId === move.toTeamId && vacancy.status === "open"
        ? { ...vacancy, status: "filled" as const, hiredCoachId: move.coachId }
        : vacancy);
    }
  }

  return {
    players,
    movementMarket: {
      ...input.movementMarket,
      coachVacancies: vacancies.slice(-60),
      digest: [
        ...input.movementMarket.digest.slice(0, 2),
        `${vacancies.filter((vacancy) => vacancy.status === "open").length} тренерских вакансий остаются незакрытыми.`,
      ],
    },
    stories,
    transactions,
  };
}
