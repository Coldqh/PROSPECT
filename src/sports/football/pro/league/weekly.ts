import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import type { ProfessionalGame, ProfessionalHeroCareer, ProfessionalLeagueState, ProfessionalRosterPlayer, ProfessionalTeam, ProfessionalTransaction, ProfessionalWeekFocus, ProfessionalWeeklyPlan } from "../types";
import { createProfessionalMatchState, isProfessionalMatchAwaitingResolution } from "./match";
import { advanceProfessionalMedical } from "./medical";
import { balanceProfessionalActiveRosters, runProfessionalTradeDeadline } from "./market";
import { defaultProfessionalWeekPlan, rebuildProfessionalDepthCharts, recalculateTeams, roleFor } from "./roster";
import { applyGameRecords, buildPlayoffWeek, findHeroGame, resolveScheduledGame } from "./schedule";
import { clamp } from "./shared";
import { advanceBackgroundWorld, syncProfessionalWorld } from "./world";

function focusEffects(focus: ProfessionalWeekFocus, random: SeededRandom): Omit<ProfessionalWeeklyPlan, "seasonYear" | "week" | "focus" | "resolved" | "summary"> & { overallDelta: number } {
  if (focus === "technique") return { readinessDelta: random.integer(2, 5), coachTrustDelta: random.integer(0, 3), healthDelta: random.integer(-2, 0), depthDelta: random.integer(1, 4), injuryRisk: 8, overallDelta: random.integer(2, 6) / 10 };
  if (focus === "recovery") return { readinessDelta: random.integer(1, 3), coachTrustDelta: random.integer(-1, 1), healthDelta: random.integer(5, 9), depthDelta: random.integer(-1, 1), injuryRisk: 1, overallDelta: 0 };
  if (focus === "competition") return { readinessDelta: random.integer(4, 8), coachTrustDelta: random.integer(2, 6), healthDelta: random.integer(-4, -1), depthDelta: random.integer(2, 6), injuryRisk: 14, overallDelta: random.integer(1, 4) / 10 };
  return { readinessDelta: random.integer(3, 6), coachTrustDelta: random.integer(2, 5), healthDelta: random.integer(-1, 1), depthDelta: random.integer(0, 2), injuryRisk: 3, overallDelta: random.integer(0, 2) / 10 };
}

function focusSummary(focus: ProfessionalWeekFocus): string {
  if (focus === "technique") return "Неделя ушла в позиционную технику и исправление деталей.";
  if (focus === "recovery") return "Нагрузка снижена: лечение, сон и восстановление тела.";
  if (focus === "competition") return "Игрок атаковал depth chart и забрал максимум соревновательных повторений.";
  return "Игрок разобрал плейбук, установки и ключи соперника.";
}

export function setProfessionalWeekFocus(save: CareerSave, focus: ProfessionalWeekFocus, preserveCompletedMatch = false): CareerSave {
  const state = save.football.professional;
  const career = state.heroCareer;
  const league = state.league;
  if (save.meta.phase !== "professional-career" || !career?.teamId) throw new Error("Professional weekly planning is unavailable");
  if (career.weeklyPlan.resolved && career.weeklyPlan.seasonYear === league.seasonYear && career.weeklyPlan.week === league.week) throw new Error("This professional week is already prepared");

  const random = new SeededRandom(save.meta.worldSeed).fork(`professional-week-focus:${league.seasonYear}:${league.week}:${focus}`);
  const effects = focusEffects(focus, random);
  const currentHero = league.roster.find((player) => player.isHero);
  if (!currentHero) throw new Error("Hero professional roster player is missing");
  const health = clamp(currentHero.health + effects.healthDelta);
  const injuryChance = Math.min(.34, effects.injuryRisk / 100 + Math.max(0, 68 - health) * .004);
  const injured = currentHero.status === "active" && random.chance(injuryChance);
  const injuryWeeks = injured ? random.integer(1, focus === "competition" ? 5 : 3) : currentHero.injuryWeeks;
  const availability = injured ? (injuryWeeks >= 5 ? "injured-reserve" as const : injuryWeeks >= 2 ? "out" as const : "questionable" as const) : currentHero.availability;
  const status = availability === "injured-reserve" ? "injured-reserve" as const : currentHero.status;
  const coachTrust = clamp(career.coachTrust + effects.coachTrustDelta);
  const overall = clamp(currentHero.overall + effects.overallDelta, 0, 99);
  let roster = league.roster.map((player) => player.isHero ? {
    ...player,
    overall,
    health,
    form: clamp(player.form + effects.readinessDelta + effects.depthDelta * .35),
    availability,
    injuryWeeks,
    status,
  } : player);
  roster = rebuildProfessionalDepthCharts(roster, coachTrust);
  const hero = roster.find((player) => player.isHero)!;
  const role = roleFor(state.status, hero.depthRank, hero.availability);
  let transactions = league.transactions;
  if (injured) {
    transactions = [...transactions, {
      id: `pro-tx:${league.seasonYear}:w${league.week}:hero-injury`,
      seasonYear: league.seasonYear,
      week: league.week,
      kind: "injury" as const,
      playerId: hero.id,
      playerName: hero.name,
      position: hero.position,
      fromTeamId: hero.teamId,
      value: injuryWeeks,
      summary: `${hero.position} ${hero.name} получил повреждение. Прогноз: ${injuryWeeks} нед.`,
    }];
  }
  const weeklyPlan: ProfessionalWeeklyPlan = {
    seasonYear: league.seasonYear,
    week: league.week,
    focus,
    resolved: true,
    readinessDelta: effects.readinessDelta,
    coachTrustDelta: Math.round((coachTrust - career.coachTrust) * 10) / 10,
    healthDelta: effects.healthDelta,
    depthDelta: effects.depthDelta,
    injuryRisk: effects.injuryRisk,
    summary: injured ? `${focusSummary(focus)} Неделя закончилась повреждением.` : focusSummary(focus),
  };
  const eligible = state.status === "roster" && role !== "inactive";
  const activeGame = eligible ? findHeroGame({ ...league, roster }, career.teamId, league.week) : undefined;
  const activeGameId = preserveCompletedMatch ? league.activeGameId : activeGame?.id;
  const nextLeague: ProfessionalLeagueState = { ...league, roster, transactions, activeGameId };
  let next: CareerSave = {
    ...save,
    character: { ...save.character, condition: { ...save.character.condition, health } },
    football: {
      ...save.football,
      ratings: { ...save.football.ratings, overall },
      professional: {
        ...state,
        league: nextLeague,
        heroCareer: { ...career, coachTrust, depthRank: hero.depthRank, role, availability: hero.availability, weeklyPlan },
        lastSummary: weeklyPlan.summary,
      },
    },
  };
  if (!preserveCompletedMatch && activeGame && save.football.match.status === "upcoming") {
    next = { ...next, football: { ...next.football, match: createProfessionalMatchState(next, activeGame) } };
  }
  return next;
}

function advanceLeagueAfterWeek(save: CareerSave, resolvedSchedule: ProfessionalGame[], resultTeams: ProfessionalTeam[]): CareerSave {
  const state = save.football.professional;
  const league = state.league;
  const heroCareer = state.heroCareer;
  const currentWeek = league.week;
  let nextSchedule = resolvedSchedule;
  let nextWeek = currentWeek + 1;
  let phase = league.phase;
  let championTeamId = league.championTeamId;
  let playoffTeamIds = league.playoffTeamIds;

  if (currentWeek >= 15 && currentWeek < 18) {
    const newGames = buildPlayoffWeek({ ...league, schedule: nextSchedule }, resultTeams);
    if (newGames.length > 0) {
      nextSchedule = [...nextSchedule, ...newGames];
      phase = "playoffs";
      if (currentWeek === 15) playoffTeamIds = [...new Set(newGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]))];
    }
  }
  if (currentWeek === 18) {
    const title = nextSchedule.find((game) => game.week === 18 && game.status === "complete");
    championTeamId = title ? ((title.homeScore ?? 0) > (title.awayScore ?? 0) ? title.homeTeamId : title.awayTeamId) : undefined;
    phase = "complete";
    nextWeek = 18;
  }

  const medical = advanceProfessionalMedical(save.meta.worldSeed, league.seasonYear, currentWeek, league.roster, league.transactions);
  const deadline = runProfessionalTradeDeadline(save.meta.worldSeed, league.seasonYear, currentWeek, resultTeams, medical.roster, medical.transactions);
  const balanced = balanceProfessionalActiveRosters(save.meta.worldSeed, league.seasonYear, currentWeek, deadline.teams, deadline.roster, league.freeAgents, deadline.transactions);
  const roster = rebuildProfessionalDepthCharts(balanced.roster, heroCareer?.coachTrust ?? 0);
  const teams = recalculateTeams(balanced.teams, roster);
  const heroPlayer = roster.find((player) => player.isHero);
  const nextAvailability = heroPlayer?.availability ?? heroCareer?.availability ?? "active";
  const nextDepthRank = heroPlayer?.depthRank ?? heroCareer?.depthRank ?? 1;
  const nextRole = heroCareer ? roleFor(state.status, nextDepthRank, nextAvailability) : undefined;
  const nextHeroCareer = heroCareer ? {
    ...heroCareer,
    week: nextWeek,
    depthRank: nextDepthRank,
    availability: nextAvailability,
    ...(nextRole ? { role: nextRole } : {}),
    weeklyPlan: defaultProfessionalWeekPlan(league.seasonYear, nextWeek),
  } : undefined;

  const nextLeagueBase: ProfessionalLeagueState = {
    ...league,
    schedule: nextSchedule,
    roster,
    freeAgents: balanced.freeAgents,
    transactions: balanced.transactions,
    week: nextWeek,
    totalWeeks: phase === "playoffs" || phase === "complete" ? 18 : league.totalWeeks,
    phase,
    playoffTeamIds,
    ...(championTeamId ? { championTeamId } : {}),
  };
  const eligible = state.status === "roster" && nextRole !== "inactive";
  const nextHeroGame = phase !== "complete" && eligible ? findHeroGame(nextLeagueBase, nextHeroCareer?.teamId, nextWeek) : undefined;
  const nextLeague = { ...nextLeagueBase, activeGameId: nextHeroGame?.id };
  const professional = { ...state, teams, league: nextLeague, heroCareer: nextHeroCareer };
  const nextMatch = nextHeroGame
    ? createProfessionalMatchState({ ...save, football: { ...save.football, professional } }, nextHeroGame)
    : save.football.match;
  const inactiveNote = nextRole === "inactive" ? " Игрок недоступен для следующего матча." : "";
  const advanced: CareerSave = {
    ...save,
    meta: { ...save.meta, currentDate: nextHeroGame?.date ?? nextSchedule.find((game) => game.week === nextWeek)?.date ?? save.meta.currentDate },
    football: {
      ...save.football,
      match: nextMatch,
      professional: {
        ...professional,
        lastSummary: phase === "complete"
          ? `${teams.find((team) => team.id === championTeamId)?.city ?? "Лига"} завершили сезон чемпионами.`
          : `Неделя ${currentWeek} завершена. Следующая — ${nextWeek}.${inactiveNote}`,
      },
    },
  };
  const targetDate = nextHeroGame?.date ?? nextSchedule.find((game) => game.week === nextWeek)?.date ?? save.meta.currentDate;
  return syncProfessionalWorld(advanceBackgroundWorld(advanced, targetDate));
}

export function finalizeProfessionalMatch(save: CareerSave): CareerSave {
  const unresolvedPlan = save.football.professional.heroCareer?.weeklyPlan;
  const prepared = unresolvedPlan && !unresolvedPlan.resolved
    ? setProfessionalWeekFocus(save, unresolvedPlan.focus, true)
    : save;
  const state = prepared.football.professional;
  const match = prepared.football.match;
  if (state.league.activeGameId !== match.gameId || match.status !== "complete" || !match.finalResult) throw new Error("Professional match is not ready to finalize");
  const league = state.league;
  const game = league.schedule.find((item) => item.id === league.activeGameId);
  const career = state.heroCareer;
  if (!game || !career?.teamId) throw new Error("Professional game context is missing");
  const heroHome = game.homeTeamId === career.teamId;
  const forced = heroHome ? { home: match.heroScore, away: match.opponentScore } : { home: match.opponentScore, away: match.heroScore };
  const resolvedSchedule = league.schedule.map((item) => {
    if (item.week !== league.week || item.status === "complete") return item;
    return resolveScheduledGame(prepared.meta.worldSeed, item, state.teams, item.id === game.id ? forced : undefined);
  });
  const teams = applyGameRecords(state.teams, resolvedSchedule);
  const log = {
    seasonYear: league.seasonYear,
    gameId: game.id,
    week: game.week,
    opponentId: match.opponentId,
    won: match.finalResult.won,
    teamScore: match.heroScore,
    opponentScore: match.opponentScore,
    grade: match.finalResult.grade,
    performanceScore: match.finalResult.score,
    evaluationSummary: match.finalResult.evaluation?.summary,
    criterionScores: match.finalResult.evaluation?.criteria.map((item) => ({ id: item.id, label: item.label, score: item.score })),
    snaps: match.advancedStats.snaps,
    stats: match.stats,
    usage: match.finalResult.usage ?? match.usageStats,
  };
  const updated: CareerSave = {
    ...prepared,
    football: {
      ...prepared.football,
      professional: {
        ...state,
        heroCareer: {
          ...career,
          coachTrust: clamp(career.coachTrust + match.finalResult.coachTrustDelta),
          gamesPlayed: career.gamesPlayed + 1,
          starts: career.starts + (match.rosterRole === "starter" ? 1 : 0),
          snaps: career.snaps + match.advancedStats.snaps,
          gameLog: [...career.gameLog, log],
        },
      },
    },
  };
  return advanceLeagueAfterWeek(updated, resolvedSchedule, teams);
}

export function advanceProfessionalWeek(save: CareerSave): CareerSave {
  const inactiveForCurrentWeek = save.football.professional.heroCareer?.role === "inactive";
  const unresolvedPlan = save.football.professional.heroCareer?.weeklyPlan;
  if (unresolvedPlan && !unresolvedPlan.resolved && save.football.professional.heroCareer?.teamId) {
    save = setProfessionalWeekFocus(save, unresolvedPlan.focus);
  }
  const state = save.football.professional;
  if (save.meta.phase !== "professional-career" || state.league.phase === "complete") throw new Error("Professional season cannot advance");
  if (!inactiveForCurrentWeek && isProfessionalMatchAwaitingResolution(save)) throw new Error("The hero game must be played first");
  const league = state.league;
  const resolvedSchedule = league.schedule.map((game) => game.week === league.week && game.status === "scheduled" ? resolveScheduledGame(save.meta.worldSeed, game, state.teams) : game);
  let teams = applyGameRecords(state.teams, resolvedSchedule);
  let next = save;
  const career = state.heroCareer;
  if (career && state.status === "practice-squad") {
    const random = new SeededRandom(save.meta.worldSeed).fork(`practice-squad:${league.seasonYear}:${league.week}`);
    const development = random.integer(0, 2);
    const trust = clamp(career.coachTrust + random.integer(-1, 4));
    const promoted = trust >= 72 && random.chance(0.22);
    let roster = state.league.roster.map((player) => player.isHero ? { ...player, overall: clamp(player.overall + development, 0, 99), form: clamp(player.form + random.integer(-2, 5)), status: promoted ? "active" as const : player.status } : player);
    let freeAgents = state.league.freeAgents;
    let transactions = state.league.transactions;
    if (promoted && career.teamId) {
      const released = roster
        .filter((player) => player.teamId === career.teamId && player.position === save.football.position && player.status === "active" && !player.isHero)
        .sort((left, right) => left.overall - right.overall || right.depthRank - left.depthRank)[0];
      if (released) {
        roster = roster.filter((player) => player.id !== released.id);
        freeAgents = [...freeAgents, { ...released, teamId: undefined, status: "free-agent", depthRank: 0, yearsRemaining: 0 }];
        transactions = [...transactions, {
          id: `pro-tx:${league.seasonYear}:w${league.week}:promotion:${released.id}`,
          seasonYear: league.seasonYear,
          week: league.week,
          kind: "promotion",
          playerId: "pro-player:hero",
          playerName: save.character.identity.fullName,
          position: save.football.position,
          toTeamId: career.teamId,
          value: save.football.professional.contract?.salaryYearOne ?? 0,
          summary: `${state.teams.find((team) => team.id === career.teamId)?.shortName ?? "Клуб"} подняли ${save.football.position} ${save.character.identity.fullName} в активный состав и освободили ${released.name}.`,
        }];
      }
    }
    teams = recalculateTeams(teams, roster);
    next = {
      ...save,
      football: {
        ...save.football,
        ratings: { ...save.football.ratings, overall: clamp(save.football.ratings.overall + development * 0.35) },
        professional: {
          ...state,
          ...(promoted ? { status: "roster" as const } : {}),
          league: { ...state.league, roster, freeAgents, transactions },
          heroCareer: { ...career, coachTrust: trust, role: promoted ? "special-teams" : "practice-squad" },
          lastSummary: promoted ? "Штаб поднял игрока из тренировочного состава в активный ростер." : "Неделя тренировочного состава завершена.",
        },
      },
    };
  }
  return advanceLeagueAfterWeek(next, resolvedSchedule, teams);
}
