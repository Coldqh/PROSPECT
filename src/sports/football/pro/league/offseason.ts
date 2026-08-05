import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { advanceProfessionalCoaching, applyProfessionalSchemeFit } from "../coaching";
import { PROFESSIONAL_SALARY_CAP } from "../createProfessionalState";
import type { ProfessionalHeroCareer, ProfessionalLeagueState, ProfessionalRosterPlayer, ProfessionalTransaction } from "../types";
import { runLifecycleRookieDraft } from "./draftClass";
import { createHeroFreeAgentOffers } from "./initialization";
import { createProfessionalMatchState } from "./match";
import { runNpcFreeAgency } from "./market";
import { createHeroCareer, defaultProfessionalWeekPlan, fitPayroll, recalculateTeams, roleFor } from "./roster";
import { findHeroGame, roundRobinSchedule } from "./schedule";
import { clamp } from "./shared";
import { advanceBackgroundWorld, syncProfessionalWorld } from "./world";

export function advanceProfessionalOffseason(save: CareerSave): CareerSave {
  const state = save.football.professional;
  const league = state.league;
  if (save.meta.phase !== "professional-career" || league.phase !== "complete") throw new Error("Professional offseason is not available");

  const seasonYear = league.seasonYear + 1;
  const random = new SeededRandom(save.meta.worldSeed).fork(`professional-offseason:${seasonYear}`);
  const releasedDeadCap = new Map<string, number>();
  let freeAgents = league.freeAgents
    .map((player) => ({ ...player, age: player.age + 1, form: clamp(player.form + random.integer(-7, 5)) }))
    .filter((player) => player.age <= 36);
  let transactions: ProfessionalTransaction[] = [...league.transactions];
  let roster: ProfessionalRosterPlayer[] = [];

  for (const player of league.roster.filter((candidate) => !candidate.isHero)) {
    const age = player.age + 1;
    const yearsRemaining = Math.max(0, player.yearsRemaining - 1);
    const decline = age >= 32 ? random.integer(0, 3) : age <= 25 ? -random.integer(0, 2) : random.integer(-1, 1);
    const updated = {
      ...player,
      age,
      yearsRemaining,
      overall: clamp(player.overall - decline + (player.schemeFit - 60) * .018, 45, 99),
      health: clamp(player.health + random.integer(-8, 4)),
      form: clamp(player.form + random.integer(-9, 7)),
    };
    const retired = age >= 35 && random.chance(Math.min(.82, .22 + (age - 35) * .18));
    if (retired) {
      transactions.push({
        id: `pro-tx:${seasonYear}:retirement:${player.id}`,
        seasonYear,
        week: 0,
        kind: "release",
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        fromTeamId: player.teamId,
        value: 0,
        summary: `${player.position} ${player.name} завершил карьеру.`,
      });
      continue;
    }
    if (yearsRemaining === 0) {
      if (player.teamId) releasedDeadCap.set(player.teamId, (releasedDeadCap.get(player.teamId) ?? 0) + Math.round(player.guaranteedRemaining * .28));
      freeAgents.push({ ...updated, teamId: undefined, status: "free-agent", depthRank: 0, guaranteedRemaining: 0 });
      transactions.push({
        id: `pro-tx:${seasonYear}:expired:${player.id}`,
        seasonYear,
        week: 0,
        kind: "release",
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        fromTeamId: player.teamId,
        value: player.guaranteedRemaining,
        summary: `Контракт ${player.position} ${player.name} истёк. Игрок вышел на рынок.`,
      });
      continue;
    }
    roster.push(updated);
  }

  const previousHero = league.roster.find((player) => player.isHero);
  const previousContract = state.contract;
  const heroContractYears = previousContract ? Math.max(0, previousContract.years - 1) : 0;
  const heroRemainsSigned = Boolean(previousHero && state.status !== "free-agent" && state.status !== "cut" && heroContractYears > 0);
  if (previousHero && heroRemainsSigned) {
    roster.push({
      ...previousHero,
      age: previousHero.age + 1,
      yearsRemaining: heroContractYears,
      health: save.character.condition.health,
      form: clamp(previousHero.form + random.integer(-5, 6)),
      overall: save.football.ratings.overall,
    });
  }

  const coachedTeams = advanceProfessionalCoaching(state.teams, seasonYear, `${save.meta.worldSeed}:professional-coaching`);
  const offseasonTeams = coachedTeams.map((team) => ({
    ...team,
    wins: 0,
    losses: 0,
    deadCap: Math.max(0, Math.round((team.deadCap * .42 + (releasedDeadCap.get(team.id) ?? 0)) / 10_000) * 10_000),
  }));
  roster = applyProfessionalSchemeFit(offseasonTeams, roster);
  roster = offseasonTeams.flatMap((team) => {
    const teamPlayers = roster.filter((player) => player.teamId === team.id);
    const activeCount = teamPlayers.filter((player) => player.status === "active").length;
    const reserve = Math.max(0, 53 - activeCount) * 760_000 + 2_000_000;
    return fitPayroll(teamPlayers, Math.max(20_000_000, PROFESSIONAL_SALARY_CAP - team.deadCap - reserve));
  });
  let teams = recalculateTeams(offseasonTeams, roster);
  const rookieDraft = runLifecycleRookieDraft(save, seasonYear, teams, roster, freeAgents);
  roster = applyProfessionalSchemeFit(teams, rookieDraft.roster);
  freeAgents = rookieDraft.freeAgents;
  transactions = [...transactions, ...rookieDraft.transactions];
  teams = recalculateTeams(teams, roster);
  const market = runNpcFreeAgency(save.meta.worldSeed, seasonYear, teams, roster, freeAgents);
  teams = market.teams;
  roster = applyProfessionalSchemeFit(teams, market.roster);
  freeAgents = market.freeAgents;
  transactions = [...transactions, ...market.transactions].slice(-600);

  const heroStatus = heroRemainsSigned
    ? state.status === "practice-squad" ? "practice-squad" as const : "roster" as const
    : "free-agent" as const;
  const heroTeamId = heroRemainsSigned ? previousHero?.teamId : undefined;
  const previousCareer = state.heroCareer;
  const nextAvailability = previousHero?.availability ?? "active";
  const heroCareer: ProfessionalHeroCareer = {
    ...(previousCareer ?? createHeroCareer(save, heroTeamId)),
    teamId: heroTeamId,
    seasonYear,
    week: 1,
    role: heroStatus === "roster" ? roleFor("roster", previousCareer?.depthRank ?? previousHero?.depthRank ?? 3, nextAvailability) : heroStatus === "practice-squad" ? "practice-squad" : "free-agent",
    depthRank: previousCareer?.depthRank ?? previousHero?.depthRank ?? 1,
    availability: nextAvailability,
    weeklyPlan: defaultProfessionalWeekPlan(seasonYear, 1),
  };
  const schedule = roundRobinSchedule(teams.map((team) => team.id), seasonYear);
  const baseLeague: ProfessionalLeagueState = {
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
  const heroGame = heroStatus === "roster" ? findHeroGame(baseLeague, heroTeamId, 1) : undefined;
  const nextLeague: ProfessionalLeagueState = { ...baseLeague, activeGameId: heroGame?.id };
  const contract = heroRemainsSigned && previousContract ? { ...previousContract, years: heroContractYears, totalValue: previousContract.salaryYearOne * heroContractYears } : undefined;
  let professional: CareerSave["football"]["professional"] = {
    ...state,
    status: heroStatus,
    teams,
    league: nextLeague,
    heroCareer,
    contract,
    campInvites: [],
    lastSummary: heroRemainsSigned
      ? `Сезон ${seasonYear} открыт. ${teams.find((team) => team.id === heroTeamId)?.shortName ?? "Клуб"} сохранили контракт игрока.`
      : `Контракт завершён. Перед сезоном ${seasonYear} игрок вышел на рынок свободных агентов.`,
  };
  let next: CareerSave = {
    ...save,
    world: { ...save.world, careerRegistry: rookieDraft.careerRegistry },
    meta: { ...save.meta, currentDate: schedule[0]?.date ?? save.meta.currentDate },
    character: {
      ...save.character,
      identity: { ...save.character.identity, age: save.character.identity.age + 1 },
    },
    football: {
      ...save.football,
      professional,
    },
    history: [...save.history, {
      id: `${save.meta.worldSeed}:professional-offseason:${seasonYear}`,
      occurredAt: save.meta.updatedAt,
      type: "professional-offseason",
      title: `Профессиональный сезон ${seasonYear}`,
      description: heroRemainsSigned ? "Лига обновила контракты, рынок, ростеры и календарь." : "Контракт героя истёк, а лига открыла новый рынок и календарь.",
    }],
  };
  if (!heroRemainsSigned) {
    professional = { ...professional, campInvites: createHeroFreeAgentOffers(next) };
    next = { ...next, football: { ...next.football, professional } };
  }
  if (heroGame) {
    const match = createProfessionalMatchState(next, heroGame);
    next = { ...next, meta: { ...next.meta, currentDate: heroGame.date }, football: { ...next.football, match } };
  }
  return syncProfessionalWorld(advanceBackgroundWorld(next, heroGame?.date ?? schedule[0]?.date ?? save.meta.currentDate));
}
