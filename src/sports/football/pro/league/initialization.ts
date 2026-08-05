import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { applyProfessionalSchemeFit } from "../coaching";
import type { ProfessionalCampInvite, ProfessionalHeroCareer, ProfessionalLeagueState, ProfessionalTransaction } from "../types";
import { injectDraftClass } from "./draftClass";
import { createProfessionalMatchState } from "./match";
import { runNpcFreeAgency } from "./market";
import { createHeroCareer, generateFreeAgents, generateLeagueRoster, heroRosterPlayer, recalculateTeams, roleFor } from "./roster";
import { findHeroGame, roundRobinSchedule } from "./schedule";
import { clamp } from "./shared";
import { advanceBackgroundWorld, syncProfessionalWorld } from "./world";

export function initializeProfessionalLeague(save: CareerSave): CareerSave {
  const state = save.football.professional;
  const seasonYear = state.draftYear;
  let roster = generateLeagueRoster(save.meta.worldSeed, state.teams);
  let freeAgents = generateFreeAgents(save.meta.worldSeed, seasonYear);
  const rookies = injectDraftClass(state, seasonYear, roster, freeAgents);
  roster = rookies.roster;
  freeAgents = rookies.freeAgents;
  let teams = recalculateTeams(state.teams.map((team) => ({ ...team, wins: 0, losses: 0 })), roster);
  const market = runNpcFreeAgency(save.meta.worldSeed, seasonYear, teams, roster, freeAgents);
  teams = market.teams;
  roster = applyProfessionalSchemeFit(teams, market.roster);
  freeAgents = market.freeAgents;
  let transactions = [...rookies.transactions, ...market.transactions];

  const teamId = state.status === "roster" || state.status === "practice-squad" ? state.contract?.teamId : undefined;
  if (teamId) {
    const practiceSquad = state.status === "practice-squad";
    const hero = heroRosterPlayer(save, teamId, practiceSquad ? "practice-squad" : "active", state.camp?.rosterRank ?? 4);
    const replacement = practiceSquad ? undefined : roster
      .filter((player) => player.teamId === teamId && player.position === hero.position && !player.isHero && player.status === "active")
      .sort((left, right) => left.overall - right.overall || right.depthRank - left.depthRank)[0];
    roster = roster.filter((player) => !player.isHero && player.id !== replacement?.id).concat(hero);
    if (replacement) {
      freeAgents = [...freeAgents, { ...replacement, teamId: undefined, status: "free-agent", depthRank: 0, yearsRemaining: 0 }];
      transactions = [...transactions, {
        id: `pro-tx:${seasonYear}:hero-roster-release:${replacement.id}`,
        seasonYear,
        week: 0,
        kind: "release",
        playerId: replacement.id,
        playerName: replacement.name,
        position: replacement.position,
        fromTeamId: teamId,
        value: replacement.guaranteedRemaining,
        summary: `${teams.find((team) => team.id === teamId)?.shortName ?? "Клуб"} освободили ${replacement.position} ${replacement.name}, чтобы открыть место новичку.`,
      }];
    }
    transactions = [...transactions, {
      id: `pro-tx:${seasonYear}:hero-signing:${teamId}`,
      seasonYear,
      week: 0,
      kind: "signing",
      playerId: hero.id,
      playerName: hero.name,
      position: hero.position,
      toTeamId: teamId,
      value: hero.annualSalary,
      summary: `${teams.find((team) => team.id === teamId)?.shortName ?? "Клуб"} зарегистрировали ${hero.position} ${hero.name} в ${practiceSquad ? "practice squad" : "активном составе"}.`,
    }];
    teams = recalculateTeams(teams, roster);
  }
  const schedule = roundRobinSchedule(teams.map((team) => team.id), seasonYear);
  const heroCareer = createHeroCareer(save, teamId);
  const league: ProfessionalLeagueState = {
    seasonYear,
    phase: "regular-season",
    week: 1,
    totalWeeks: 15,
    schedule,
    roster,
    freeAgents,
    transactions,
    playoffTeamIds: [],
  };
  const heroGame = findHeroGame(league, teamId, 1);
  const nextLeague = { ...league, ...(heroGame && state.status === "roster" ? { activeGameId: heroGame.id } : {}) };
  const nextMatch = heroGame && state.status === "roster" ? createProfessionalMatchState({ ...save, football: { ...save.football, professional: { ...state, league: nextLeague, heroCareer } } }, heroGame) : save.football.match;
  const initialized: CareerSave = {
    ...save,
    meta: { ...save.meta, currentDate: schedule[0]?.date ?? save.meta.currentDate },
    football: {
      ...save.football,
      match: nextMatch,
      professional: {
        ...state,
        teams,
        league: nextLeague,
        heroCareer,
        lastSummary: teamId
          ? `${state.contract?.teamName ?? "Клуб"}: календарь сформирован, первая неделя открыта.`
          : "Игрок вышел на рынок свободных агентов. Лига начала регулярный сезон.",
      },
    },
  };
  return syncProfessionalWorld(advanceBackgroundWorld(initialized, schedule[0]?.date ?? save.meta.currentDate));
}

export function createHeroFreeAgentOffers(save: CareerSave): ProfessionalCampInvite[] {
  const state = save.football.professional;
  return [...state.teams]
    .sort((a, b) => b.needs[save.football.position] - a.needs[save.football.position] || b.capSpace - a.capSpace)
    .slice(0, 4)
    .map((team, index) => {
      const random = new SeededRandom(save.meta.worldSeed).fork(`hero-fa:${state.draftYear}:${team.id}`);
      const fit = clamp(55 + team.needs[save.football.position] * 0.35 + random.integer(-8, 8));
      const opportunity = clamp(team.needs[save.football.position] * 0.58 + fit * 0.32 - index * 4);
      return {
        teamId: team.id,
        teamName: `${team.city} ${team.name}`,
        shortName: team.shortName,
        signingBonus: Math.max(15_000, Math.round((40_000 + opportunity * 1_900) / 5_000) * 5_000),
        rosterOpportunity: opportunity,
        positionCompetition: clamp(100 - team.needs[save.football.position] + random.integer(-6, 8)),
        schemeFit: fit,
        summary: opportunity >= 68 ? "Клуб предлагает место в активной ротации." : "Контракт без гарантированной роли, место решит первая неделя.",
      };
    });
}

export function acceptProfessionalFreeAgentOffer(save: CareerSave, teamId: string): CareerSave {
  const state = save.football.professional;
  if (state.status !== "free-agent" && state.status !== "cut") throw new Error("The player is not a free agent");
  const offer = state.campInvites.find((item) => item.teamId === teamId);
  const team = state.teams.find((item) => item.id === teamId);
  if (!offer || !team) throw new Error("Free-agent offer does not exist");
  const salary = Math.max(795_000, Math.round((650_000 + offer.rosterOpportunity * 24_000) / 10_000) * 10_000);
  const playerStatus = offer.rosterOpportunity >= 58 ? "active" as const : "practice-squad" as const;
  const professionalStatus = playerStatus === "active" ? "roster" as const : "practice-squad" as const;
  const depthRank = playerStatus === "active" ? Math.max(1, Math.min(5, Math.round((105 - offer.rosterOpportunity) / 18))) : 5;
  const contract = {
    teamId,
    teamName: offer.teamName,
    years: 1,
    totalValue: salary,
    guaranteed: offer.signingBonus,
    signingBonus: offer.signingBonus,
    salaryYearOne: salary,
    agentFee: Math.round(salary * (state.agents.find((agent) => agent.id === state.selectedAgentId)?.commission ?? 3) / 100 / 1_000) * 1_000,
    round: null,
    overallPick: null,
  };
  const contractedSave: CareerSave = {
    ...save,
    football: {
      ...save.football,
      professional: { ...state, status: professionalStatus, contract },
    },
  };
  if (state.league.schedule.length === 0) return initializeProfessionalLeague(contractedSave);

  const hero = heroRosterPlayer(contractedSave, teamId, playerStatus, depthRank);
  const replacement = playerStatus === "active" ? state.league.roster
    .filter((player) => player.teamId === teamId && player.position === hero.position && player.status === "active" && !player.isHero)
    .sort((left, right) => left.overall - right.overall || right.depthRank - left.depthRank)[0] : undefined;
  const roster = state.league.roster.filter((player) => !player.isHero && player.id !== replacement?.id).concat(hero);
  const freeAgents = replacement
    ? [...state.league.freeAgents, { ...replacement, teamId: undefined, status: "free-agent" as const, depthRank: 0, yearsRemaining: 0 }]
    : state.league.freeAgents;
  const transactions: ProfessionalTransaction[] = [
    ...state.league.transactions,
    ...(replacement ? [{
      id: `pro-tx:${state.league.seasonYear}:w${state.league.week}:hero-fa-release:${replacement.id}`,
      seasonYear: state.league.seasonYear,
      week: state.league.week,
      kind: "release" as const,
      playerId: replacement.id,
      playerName: replacement.name,
      position: replacement.position,
      fromTeamId: teamId,
      value: replacement.guaranteedRemaining,
      summary: `${team.shortName} освободили ${replacement.position} ${replacement.name}, чтобы открыть место в активном составе.`,
    }] : []),
    {
      id: `pro-tx:${state.league.seasonYear}:w${state.league.week}:hero-fa-signing:${teamId}`,
      seasonYear: state.league.seasonYear,
      week: state.league.week,
      kind: "signing",
      playerId: hero.id,
      playerName: hero.name,
      position: hero.position,
      toTeamId: teamId,
      value: salary,
      summary: `${team.shortName} подписали ${hero.position} ${hero.name} на один сезон.`,
    },
  ];
  const teams = recalculateTeams(state.teams, roster);
  const previousCareer = state.heroCareer;
  const heroCareer: ProfessionalHeroCareer = {
    ...(previousCareer ?? createHeroCareer(contractedSave, teamId)),
    teamId,
    seasonYear: state.league.seasonYear,
    week: state.league.week,
    role: playerStatus === "active" ? roleFor("roster", depthRank) : "practice-squad",
    depthRank,
  };
  const heroGame = playerStatus === "active" ? findHeroGame(state.league, teamId, state.league.week) : undefined;
  const league: ProfessionalLeagueState = {
    ...state.league,
    roster,
    freeAgents,
    transactions,
    activeGameId: heroGame?.id,
  };
  const professional = {
    ...state,
    status: professionalStatus,
    contract,
    teams,
    league,
    heroCareer,
    campInvites: [],
    lastSummary: `${offer.teamName}: однолетний контракт подписан.`,
  };
  const nextMatch = heroGame
    ? createProfessionalMatchState({ ...save, football: { ...save.football, professional } }, heroGame)
    : save.football.match;
  return {
    ...save,
    meta: { ...save.meta, currentDate: heroGame?.date ?? save.meta.currentDate },
    football: { ...save.football, match: nextMatch, professional },
  };
}
