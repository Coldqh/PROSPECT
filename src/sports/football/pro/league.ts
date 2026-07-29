import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { CAREER_FOOTBALL_POSITIONS, type FootballPosition } from "../career/types";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats, matchUnitForPosition } from "../matches/createMatchState";
import type { FootballMatchState, MatchStatLine } from "../matches/types";
import { PROFESSIONAL_SALARY_CAP } from "./createProfessionalState";
import type {
  ProfessionalCampInvite,
  ProfessionalGame,
  ProfessionalHeroCareer,
  ProfessionalLeagueState,
  ProfessionalRosterPlayer,
  ProfessionalTeam,
  ProfessionalTransaction,
} from "./types";

const FIRST_NAMES = ["Marcus", "Devin", "Cole", "Darius", "Tre", "Nate", "Malik", "Grant", "Jamal", "Ty", "Victor", "Owen", "Rashad", "Luke", "Cam", "Evan"] as const;
const LAST_NAMES = ["Hayes", "Morris", "Foster", "Reed", "Carter", "Coleman", "Price", "Woods", "Bishop", "Tate", "Grant", "Pierce", "Stone", "Harris", "Gibson", "West"] as const;
const PROFESSIONAL_ROSTER_COUNTS: Record<FootballPosition, number> = {
  QB: 3, RB: 4, WR: 5, TE: 3, OT: 5, OG: 4, C: 2,
  EDGE: 4, DT: 4, LB: 5, CB: 5, S: 4, K: 1, P: 1,
};

const POSITION_MULTIPLIER: Record<FootballPosition, number> = {
  QB: 1.8, RB: 0.8, WR: 1.12, TE: 0.86, OT: 1.2, OG: 0.86, C: 0.82,
  EDGE: 1.28, DT: 1.0, LB: 0.88, CB: 1.16, S: 0.92, K: 0.48, P: 0.45,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function addDays(date: GameDate, days: number): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function seasonStart(year: number): GameDate {
  const septemberFirst = new Date(Date.UTC(year, 8, 1));
  const daysToSunday = (7 - septemberFirst.getUTCDay()) % 7;
  return addDays({ year, month: 9, day: 1 }, daysToSunday);
}

function salaryFor(position: FootballPosition, overall: number, random: SeededRandom): number {
  const base = 760_000 + Math.max(0, overall - 55) * 285_000 * POSITION_MULTIPLIER[position];
  return Math.max(760_000, Math.round((base + random.integer(-300_000, 650_000)) / 10_000) * 10_000);
}

function createPlayer(seed: string, teamId: string | undefined, position: FootballPosition, index: number, freeAgent: boolean, namespace: string): ProfessionalRosterPlayer {
  const random = new SeededRandom(seed).fork(`${teamId ?? "fa"}:${position}:${index}`);
  const overall = freeAgent ? random.integer(55, 80) : random.integer(59, 91);
  const age = random.integer(21, 34);
  const annualSalary = salaryFor(position, overall, random);
  return {
    id: `pro-player:${namespace}:${teamId ?? "fa"}:${position}:${index}`,
    name: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
    ...(teamId ? { teamId } : {}),
    position,
    age,
    overall,
    potential: clamp(overall + random.integer(age <= 25 ? 2 : -5, age <= 25 ? 11 : 4)),
    health: random.integer(72, 100),
    form: random.integer(48, 82),
    depthRank: freeAgent ? 0 : index + 1,
    yearsRemaining: freeAgent ? 0 : random.integer(1, 4),
    annualSalary,
    guaranteedRemaining: freeAgent ? 0 : Math.round(annualSalary * random.integer(20, 75) / 100 / 10_000) * 10_000,
    status: freeAgent ? "free-agent" : "active",
    isHero: false,
  };
}

function fitPayroll(players: ProfessionalRosterPlayer[], ceiling = PROFESSIONAL_SALARY_CAP * 0.82): ProfessionalRosterPlayer[] {
  const payroll = players.reduce((sum, player) => sum + player.annualSalary, 0);
  if (payroll <= ceiling) return players;
  const ratio = ceiling / payroll;
  return players.map((player) => ({
    ...player,
    annualSalary: Math.max(760_000, Math.round(player.annualSalary * ratio / 10_000) * 10_000),
    guaranteedRemaining: Math.round(player.guaranteedRemaining * ratio / 10_000) * 10_000,
  }));
}

function generateLeagueRoster(seed: string, teams: ProfessionalTeam[]): ProfessionalRosterPlayer[] {
  return teams.flatMap((team) => {
    const players = CAREER_FOOTBALL_POSITIONS.flatMap((position) =>
      Array.from({ length: PROFESSIONAL_ROSTER_COUNTS[position] }, (_, index) => createPlayer(seed, team.id, position, index, false, "initial")),
    );
    return fitPayroll(players);
  });
}

function generateFreeAgents(seed: string, seasonYear: number): ProfessionalRosterPlayer[] {
  const positions = CAREER_FOOTBALL_POSITIONS.flatMap((position) => [position, position, position, position]);
  return positions.map((position, index) => createPlayer(`${seed}:free-agency:${seasonYear}`, undefined, position, index, true, `fa:${seasonYear}`));
}

function generateRookieFreeAgents(seed: string, seasonYear: number): ProfessionalRosterPlayer[] {
  return CAREER_FOOTBALL_POSITIONS.flatMap((position) => Array.from({ length: 12 }, (_, index) => {
    const random = new SeededRandom(seed).fork(`pro-rookie:${seasonYear}:${position}:${index}`);
    const player = createPlayer(`${seed}:rookies:${seasonYear}`, undefined, position, index, true, `rookie:${seasonYear}`);
    const overall = random.integer(55, 79);
    return {
      ...player,
      age: random.integer(21, 23),
      overall,
      potential: clamp(overall + random.integer(4, 16)),
      form: random.integer(48, 72),
      annualSalary: Math.max(760_000, Math.round((720_000 + Math.max(0, overall - 55) * 115_000) / 10_000) * 10_000),
    };
  }));
}

function roundRobinSchedule(teamIds: string[], year: number): ProfessionalGame[] {
  const rotation = [...teamIds];
  const games: ProfessionalGame[] = [];
  const start = seasonStart(year);
  for (let week = 1; week <= teamIds.length - 1; week += 1) {
    for (let index = 0; index < teamIds.length / 2; index += 1) {
      const left = rotation[index]!;
      const right = rotation[rotation.length - 1 - index]!;
      const swap = (week + index) % 2 === 0;
      const homeTeamId = swap ? right : left;
      const awayTeamId = swap ? left : right;
      games.push({
        id: `pro:${year}:w${week}:${awayTeamId}:${homeTeamId}`,
        seasonYear: year,
        week,
        date: addDays(start, (week - 1) * 7),
        homeTeamId,
        awayTeamId,
        status: "scheduled",
      });
    }
    const fixed = rotation[0]!;
    const moving = rotation.slice(1);
    moving.unshift(moving.pop()!);
    rotation.splice(0, rotation.length, fixed, ...moving);
  }
  return games;
}

function teamPayroll(teamId: string, roster: ProfessionalRosterPlayer[]): number {
  return roster.filter((player) => player.teamId === teamId && player.status !== "free-agent").reduce((sum, player) => sum + player.annualSalary, 0);
}

function recalculateTeams(teams: ProfessionalTeam[], roster: ProfessionalRosterPlayer[]): ProfessionalTeam[] {
  return teams.map((team) => {
    const contractedPlayers = roster.filter((player) => player.teamId === team.id && player.status !== "free-agent");
    const activePlayers = contractedPlayers.filter((player) => player.status === "active");
    const payroll = teamPayroll(team.id, roster);
    const starters = CAREER_FOOTBALL_POSITIONS.map((position) => activePlayers.filter((player) => player.position === position).sort((a, b) => b.overall - a.overall)[0]).filter(Boolean) as ProfessionalRosterPlayer[];
    const rosterStrength = starters.length ? starters.reduce((sum, player) => sum + player.overall, 0) / starters.length : team.rosterStrength;
    const needs = { ...team.needs };
    for (const position of CAREER_FOOTBALL_POSITIONS) {
      const room = activePlayers.filter((player) => player.position === position).sort((a, b) => b.overall - a.overall);
      const top = room[0]?.overall ?? 45;
      needs[position] = clamp(104 - top + Math.max(0, 2 - room.length) * 18);
    }
    return {
      ...team,
      salaryCap: PROFESSIONAL_SALARY_CAP,
      payroll,
      capSpace: Math.max(0, PROFESSIONAL_SALARY_CAP - payroll - team.deadCap),
      rosterSize: activePlayers.length,
      rosterStrength: clamp(rosterStrength),
      needs,
    };
  });
}

function runNpcFreeAgency(seed: string, seasonYear: number, teams: ProfessionalTeam[], roster: ProfessionalRosterPlayer[], freeAgents: ProfessionalRosterPlayer[]): {
  teams: ProfessionalTeam[];
  roster: ProfessionalRosterPlayer[];
  freeAgents: ProfessionalRosterPlayer[];
  transactions: ProfessionalTransaction[];
} {
  let nextRoster = [...roster];
  let nextTeams = recalculateTeams(teams, nextRoster);
  const available = [...freeAgents].sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const transactions: ProfessionalTransaction[] = [];
  for (const team of [...nextTeams].sort((a, b) => b.capSpace - a.capSpace)) {
    let safety = 0;
    while ((nextTeams.find((item) => item.id === team.id)?.rosterSize ?? 53) < 53 && safety < 60) {
      safety += 1;
      const currentTeam = nextTeams.find((item) => item.id === team.id)!;
      const spotsLeft = 53 - currentTeam.rosterSize;
      const maxSalary = currentTeam.capSpace - Math.max(0, spotsLeft - 1) * 760_000;
      if (maxSalary < 760_000) break;
      const target = available
        .map((player) => ({ player, score: player.overall + currentTeam.needs[player.position] * 0.32 - Math.max(0, player.annualSalary - maxSalary) / 1_000_000 * 2.4 }))
        .sort((a, b) => b.score - a.score || a.player.annualSalary - b.player.annualSalary || a.player.id.localeCompare(b.player.id))[0]?.player;
      if (!target) break;
      const random = new SeededRandom(seed).fork(`fa:${seasonYear}:${team.id}:${target.id}`);
      const proposedSalary = Math.max(760_000, Math.round(target.annualSalary * random.integer(95, 118) / 100 / 10_000) * 10_000);
      const salary = Math.max(760_000, Math.min(proposedSalary, Math.floor(maxSalary / 10_000) * 10_000));
      const depthRank = nextRoster.filter((player) => player.teamId === team.id && player.position === target.position && player.status === "active").length + 1;
      const signed: ProfessionalRosterPlayer = { ...target, teamId: team.id, status: "active", depthRank, yearsRemaining: random.integer(1, 3), annualSalary: salary, guaranteedRemaining: Math.round(salary * 0.35 / 10_000) * 10_000 };
      nextRoster.push(signed);
      available.splice(available.findIndex((player) => player.id === target.id), 1);
      transactions.push({
        id: `pro-tx:${seasonYear}:fa:${team.id}:${target.id}`,
        seasonYear,
        week: 0,
        kind: "signing",
        playerId: target.id,
        playerName: target.name,
        position: target.position,
        toTeamId: team.id,
        value: salary,
        summary: `${team.shortName} подписали ${target.position} ${target.name} на ${Math.round(salary / 100_000) / 10}M в год.`,
      });
      nextTeams = recalculateTeams(nextTeams, nextRoster);
    }
  }
  return { teams: nextTeams, roster: nextRoster, freeAgents: available, transactions };
}

function heroRosterPlayer(save: CareerSave, teamId: string, status: "active" | "practice-squad", depthRank: number): ProfessionalRosterPlayer {
  const contract = save.football.professional.contract;
  return {
    id: "pro-player:hero",
    name: save.character.identity.fullName,
    teamId,
    position: save.football.position,
    age: Math.max(20, save.character.identity.age),
    overall: save.football.ratings.overall,
    potential: save.football.ratings.potentialBand === "national-ceiling" ? 96 : save.football.ratings.potentialBand === "high-upside" ? 90 : save.football.ratings.potentialBand === "starter" ? 84 : 77,
    health: save.character.condition.health,
    form: clamp(54 + save.character.condition.confidence * 0.3),
    depthRank,
    yearsRemaining: contract?.years ?? 1,
    annualSalary: contract?.salaryYearOne ?? 795_000,
    guaranteedRemaining: contract?.guaranteed ?? 0,
    status,
    isHero: true,
  };
}

function roleFor(status: CareerSave["football"]["professional"]["status"], depthRank: number): ProfessionalHeroCareer["role"] {
  if (status === "practice-squad") return "practice-squad";
  if (status === "free-agent" || status === "cut") return "free-agent";
  if (depthRank <= 1) return "starter";
  if (depthRank <= 2) return "rotation";
  return "special-teams";
}

function createHeroCareer(save: CareerSave, teamId: string | undefined): ProfessionalHeroCareer {
  const camp = save.football.professional.camp;
  const depthRank = camp?.rosterRank ?? 4;
  return {
    ...(teamId ? { teamId } : {}),
    seasonYear: save.football.professional.draftYear,
    week: 1,
    role: roleFor(save.football.professional.status, depthRank),
    depthRank,
    coachTrust: camp?.coachTrust ?? 48,
    gamesPlayed: 0,
    starts: 0,
    snaps: 0,
    gameLog: [],
  };
}

function findHeroGame(league: ProfessionalLeagueState, heroTeamId: string | undefined, week = league.week): ProfessionalGame | undefined {
  if (!heroTeamId) return undefined;
  return league.schedule.find((game) => game.week === week && game.status === "scheduled" && (game.homeTeamId === heroTeamId || game.awayTeamId === heroTeamId));
}

export function createProfessionalMatchState(save: CareerSave, game: ProfessionalGame): FootballMatchState {
  const career = save.football.professional.heroCareer;
  const teamId = career?.teamId;
  if (!teamId || (game.homeTeamId !== teamId && game.awayTeamId !== teamId)) throw new Error("Professional game does not include the hero team");
  const opponentId = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
  const opponent = save.football.professional.teams.find((team) => team.id === opponentId);
  const random = new SeededRandom(save.meta.worldSeed).fork(`professional-match:${game.id}`);
  const role = career.role;
  const totalEpisodes = save.football.position === "K" || save.football.position === "P"
    ? role === "starter" ? 10 : role === "rotation" || role === "special-teams" ? 7 : 4
    : role === "starter" ? 96 : role === "rotation" ? 48 : 26;
  const openingFieldPosition = random.integer(18, 34);
  return {
    moduleVersion: 1,
    gameId: game.id,
    status: "upcoming",
    scheduledWeek: game.week,
    scheduledDate: game.date,
    opponentId,
    opponentName: opponent?.shortName ?? opponentId,
    opponentRecord: opponent ? `${opponent.wins}–${opponent.losses}` : "0–0",
    opponentThreat: opponent ? `OVR ${Math.round(opponent.rosterStrength)} · CAP ${Math.round(opponent.capSpace / 1_000_000)}M` : "Нет данных",
    heroUnit: matchUnitForPosition(save.football.position),
    heroScore: 0,
    opponentScore: 0,
    quarter: 1,
    clockSeconds: 12 * 60,
    gameClockSeconds: 48 * 60,
    playClockSeconds: 25,
    possession: matchUnitForPosition(save.football.position) === "defense" ? "opponent" : "hero",
    openingKickoffReceiver: random.chance(0.5) ? "hero" : "opponent",
    participationMode: "key-moments",
    analysisMode: false,
    heroFatigue: random.integer(5, 14),
    coachGrade: Math.max(44, Math.min(74, Math.round((career.coachTrust ?? 55) * 0.38 + 35))),
    episodeIndex: 0,
    totalEpisodes,
    driveDown: 1,
    driveDistance: 10,
    driveFieldPosition: openingFieldPosition,
    driveNumber: 1,
    currentDriveId: `pro-drive-${game.week}-1`,
    driveStartQuarter: 1,
    driveStartClockSeconds: 12 * 60,
    driveStartFieldPosition: openingFieldPosition,
    drivePlays: 0,
    driveYards: 0,
    timeoutsHero: 3,
    timeoutsOpponent: 3,
    completedEpisodes: [],
    drives: [],
    stats: createEmptyMatchStats(),
    advancedStats: createEmptyAdvancedMatchStats(),
  };
}

export function initializeProfessionalLeague(save: CareerSave): CareerSave {
  const state = save.football.professional;
  const seasonYear = state.draftYear;
  let roster = generateLeagueRoster(save.meta.worldSeed, state.teams);
  let freeAgents = generateFreeAgents(save.meta.worldSeed, seasonYear);
  let teams = recalculateTeams(state.teams.map((team) => ({ ...team, wins: 0, losses: 0 })), roster);
  const market = runNpcFreeAgency(save.meta.worldSeed, seasonYear, teams, roster, freeAgents);
  teams = market.teams;
  roster = market.roster;
  freeAgents = market.freeAgents;
  let transactions = [...market.transactions];

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
  return {
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

function simulationScore(seed: string, game: ProfessionalGame, home: ProfessionalTeam, away: ProfessionalTeam): { home: number; away: number } {
  const random = new SeededRandom(seed).fork(`pro-game:${game.id}`);
  const homeBase = 17 + (home.rosterStrength - 65) * 0.52 + random.integer(-10, 12) + 2;
  const awayBase = 17 + (away.rosterStrength - 65) * 0.52 + random.integer(-10, 12);
  let homeScore = Math.max(3, Math.round(homeBase));
  let awayScore = Math.max(3, Math.round(awayBase));
  if (homeScore === awayScore) {
    if (random.chance(0.5)) homeScore += 3;
    else awayScore += 3;
  }
  return { home: homeScore, away: awayScore };
}

function resolveScheduledGame(seed: string, game: ProfessionalGame, teams: ProfessionalTeam[], forced?: { home: number; away: number }): ProfessionalGame {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  if (!home || !away) throw new Error("Professional schedule references a missing team");
  const score = forced ?? simulationScore(seed, game, home, away);
  return { ...game, status: "complete", homeScore: score.home, awayScore: score.away };
}

function applyGameRecords(teams: ProfessionalTeam[], games: ProfessionalGame[]): ProfessionalTeam[] {
  const records = new Map(teams.map((team) => [team.id, { wins: 0, losses: 0 }]));
  for (const game of games.filter((item) => item.status === "complete" && !item.playoffRound)) {
    const home = records.get(game.homeTeamId)!;
    const away = records.get(game.awayTeamId)!;
    if ((game.homeScore ?? 0) > (game.awayScore ?? 0)) home.wins += 1, away.losses += 1;
    else away.wins += 1, home.losses += 1;
  }
  return teams.map((team) => ({ ...team, ...records.get(team.id)! }));
}

function emptyStats(): MatchStatLine {
  return createEmptyMatchStats();
}

function buildPlayoffWeek(league: ProfessionalLeagueState, teams: ProfessionalTeam[]): ProfessionalGame[] {
  const year = league.seasonYear;
  if (league.week === 15) {
    const qualifiers = (["AFC", "NFC"] as const).flatMap((conference) => teams.filter((team) => team.conference === conference).sort((a, b) => b.wins - a.wins || b.rosterStrength - a.rosterStrength).slice(0, 4));
    const games = (["AFC", "NFC"] as const).flatMap((conference) => {
      const seeds = qualifiers.filter((idOrTeam): idOrTeam is ProfessionalTeam => typeof idOrTeam !== "string" && idOrTeam.conference === conference);
      return [[seeds[0], seeds[3]], [seeds[1], seeds[2]]].map(([home, away], index) => ({
        id: `pro:${year}:w16:${conference}:${index}`,
        seasonYear: year,
        week: 16,
        date: addDays(seasonStart(year), 15 * 7),
        homeTeamId: home!.id,
        awayTeamId: away!.id,
        status: "scheduled" as const,
        playoffRound: "wild-card" as const,
      }));
    });
    return games;
  }
  const currentWeekGames = league.schedule.filter((game) => game.week === league.week && game.status === "complete");
  if (league.week === 16) {
    return (["AFC", "NFC"] as const).map((conference) => {
      const conferenceGames = currentWeekGames.filter((game) => teams.find((team) => team.id === game.homeTeamId)?.conference === conference);
      const winners = conferenceGames.map((game) => (game.homeScore ?? 0) > (game.awayScore ?? 0) ? game.homeTeamId : game.awayTeamId);
      return {
        id: `pro:${year}:w17:${conference}`,
        seasonYear: year,
        week: 17,
        date: addDays(seasonStart(year), 16 * 7),
        homeTeamId: winners[0]!,
        awayTeamId: winners[1]!,
        status: "scheduled" as const,
        playoffRound: "conference" as const,
      };
    });
  }
  if (league.week === 17) {
    const winners = currentWeekGames.map((game) => (game.homeScore ?? 0) > (game.awayScore ?? 0) ? game.homeTeamId : game.awayTeamId);
    return [{
      id: `pro:${year}:w18:championship`,
      seasonYear: year,
      week: 18,
      date: addDays(seasonStart(year), 17 * 7),
      homeTeamId: winners[0]!,
      awayTeamId: winners[1]!,
      status: "scheduled",
      playoffRound: "championship",
    }];
  }
  return [];
}

function advanceLeagueAfterWeek(save: CareerSave, resolvedSchedule: ProfessionalGame[], teams: ProfessionalTeam[]): CareerSave {
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
    const newGames = buildPlayoffWeek({ ...league, schedule: nextSchedule }, teams);
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

  const nextLeagueBase: ProfessionalLeagueState = {
    ...league,
    schedule: nextSchedule,
    week: nextWeek,
    totalWeeks: phase === "playoffs" || phase === "complete" ? 18 : league.totalWeeks,
    phase,
    playoffTeamIds,
    ...(championTeamId ? { championTeamId } : {}),
  };
  const nextHeroGame = phase !== "complete" ? findHeroGame(nextLeagueBase, heroCareer?.teamId, nextWeek) : undefined;
  const heroActive = state.status === "roster" && Boolean(nextHeroGame);
  const nextLeague = { ...nextLeagueBase, activeGameId: heroActive ? nextHeroGame!.id : undefined };
  const nextMatch = heroActive ? createProfessionalMatchState({ ...save, football: { ...save.football, professional: { ...state, teams, league: nextLeague } } }, nextHeroGame!) : save.football.match;
  return {
    ...save,
    meta: { ...save.meta, currentDate: nextHeroGame?.date ?? nextSchedule.find((game) => game.week === nextWeek)?.date ?? save.meta.currentDate },
    football: {
      ...save.football,
      match: nextMatch,
      professional: {
        ...state,
        teams,
        league: nextLeague,
        heroCareer: heroCareer ? { ...heroCareer, week: nextWeek } : undefined,
        lastSummary: phase === "complete"
          ? `${teams.find((team) => team.id === championTeamId)?.city ?? "Лига"} завершили сезон чемпионами.`
          : `Неделя ${currentWeek} завершена. Следующая — ${nextWeek}.`,
      },
    },
  };
}

export function isProfessionalMatchAwaitingResolution(save: CareerSave): boolean {
  const state = save.football.professional;
  return save.meta.phase === "professional-career"
    && state.status === "roster"
    && Boolean(state.league.activeGameId)
    && state.league.activeGameId === save.football.match.gameId;
}

export function finalizeProfessionalMatch(save: CareerSave): CareerSave {
  const state = save.football.professional;
  const match = save.football.match;
  if (!isProfessionalMatchAwaitingResolution(save) || match.status !== "complete" || !match.finalResult) throw new Error("Professional match is not ready to finalize");
  const league = state.league;
  const game = league.schedule.find((item) => item.id === league.activeGameId);
  const career = state.heroCareer;
  if (!game || !career?.teamId) throw new Error("Professional game context is missing");
  const heroHome = game.homeTeamId === career.teamId;
  const forced = heroHome ? { home: match.heroScore, away: match.opponentScore } : { home: match.opponentScore, away: match.heroScore };
  const resolvedSchedule = league.schedule.map((item) => {
    if (item.week !== league.week || item.status === "complete") return item;
    return resolveScheduledGame(save.meta.worldSeed, item, state.teams, item.id === game.id ? forced : undefined);
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
    snaps: match.advancedStats.snaps,
    stats: match.stats,
  };
  const updated: CareerSave = {
    ...save,
    football: {
      ...save.football,
      professional: {
        ...state,
        heroCareer: {
          ...career,
          coachTrust: clamp(career.coachTrust + match.finalResult.coachTrustDelta),
          gamesPlayed: career.gamesPlayed + 1,
          starts: career.starts + (career.role === "starter" ? 1 : 0),
          snaps: career.snaps + match.advancedStats.snaps,
          gameLog: [...career.gameLog, log],
        },
      },
    },
  };
  return advanceLeagueAfterWeek(updated, resolvedSchedule, teams);
}

export function advanceProfessionalWeek(save: CareerSave): CareerSave {
  const state = save.football.professional;
  if (save.meta.phase !== "professional-career" || state.league.phase === "complete") throw new Error("Professional season cannot advance");
  if (isProfessionalMatchAwaitingResolution(save)) throw new Error("The hero game must be played first");
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
      overall: clamp(player.overall - decline, 45, 99),
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

  const offseasonTeams = state.teams.map((team) => ({
    ...team,
    wins: 0,
    losses: 0,
    deadCap: Math.max(0, Math.round((team.deadCap * .42 + (releasedDeadCap.get(team.id) ?? 0)) / 10_000) * 10_000),
  }));
  roster = offseasonTeams.flatMap((team) => {
    const teamPlayers = roster.filter((player) => player.teamId === team.id);
    const activeCount = teamPlayers.filter((player) => player.status === "active").length;
    const reserve = Math.max(0, 53 - activeCount) * 760_000 + 2_000_000;
    return fitPayroll(teamPlayers, Math.max(20_000_000, PROFESSIONAL_SALARY_CAP - team.deadCap - reserve));
  });
  freeAgents = [...freeAgents, ...generateRookieFreeAgents(save.meta.worldSeed, seasonYear)];
  let teams = recalculateTeams(offseasonTeams, roster);
  const market = runNpcFreeAgency(save.meta.worldSeed, seasonYear, teams, roster, freeAgents);
  teams = market.teams;
  roster = market.roster;
  freeAgents = market.freeAgents;
  transactions = [...transactions, ...market.transactions].slice(-600);

  const heroStatus = heroRemainsSigned
    ? state.status === "practice-squad" ? "practice-squad" as const : "roster" as const
    : "free-agent" as const;
  const heroTeamId = heroRemainsSigned ? previousHero?.teamId : undefined;
  const previousCareer = state.heroCareer;
  const heroCareer: ProfessionalHeroCareer = {
    ...(previousCareer ?? createHeroCareer(save, heroTeamId)),
    teamId: heroTeamId,
    seasonYear,
    week: 1,
    role: heroStatus === "roster" ? roleFor("roster", previousCareer?.depthRank ?? previousHero?.depthRank ?? 3) : heroStatus === "practice-squad" ? "practice-squad" : "free-agent",
    depthRank: previousCareer?.depthRank ?? previousHero?.depthRank ?? 1,
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
  return next;
}

export function professionalStandings(teams: ProfessionalTeam[]): ProfessionalTeam[] {
  return [...teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.rosterStrength - a.rosterStrength || a.id.localeCompare(b.id));
}

export function emptyProfessionalStats(): MatchStatLine {
  return emptyStats();
}
