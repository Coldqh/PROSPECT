import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceFootballEcosystem } from "../ecosystem/simulateEcosystem";
import { registerProfessionalDraftClass, syncProfessionalCareerRegistry } from "../ecosystem/lifecycle";
import type { EcosystemPlayerCareerRecord } from "../ecosystem/types";
import { CAREER_FOOTBALL_POSITIONS, type FootballPosition } from "../career/types";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats, matchUnitForPosition } from "../matches/createMatchState";
import { buildMatchUsagePlan, createEmptyMatchUsageStats } from "../matches/usage";
import type { FootballMatchState, MatchStatLine } from "../matches/types";
import { PROFESSIONAL_SALARY_CAP } from "./createProfessionalState";
import { advanceProfessionalCoaching, applyProfessionalSchemeFit, professionalSchemeFit, professionalStaffRating, professionalTacticalModifier } from "./coaching";
import type {
  ProfessionalCampInvite,
  ProfessionalDraftSelection,
  ProfessionalGame,
  ProfessionalHeroCareer,
  ProfessionalLeagueState,
  ProfessionalProspect,
  ProfessionalRosterPlayer,
  ProfessionalTeam,
  ProfessionalTransaction,
  ProfessionalWeekFocus,
  ProfessionalWeeklyPlan,
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

function dateValue(date: GameDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function advanceBackgroundWorld(save: CareerSave, targetDate: GameDate): CareerSave {
  const days = Math.max(0, Math.round((dateValue(targetDate) - dateValue(save.world.lastUpdatedOn)) / 86_400_000));
  if (days === 0) return { ...save, meta: { ...save.meta, currentDate: targetDate } };
  const elapsed = save.life.dayIndex + days;
  return advanceFootballEcosystem({
    ...save,
    meta: { ...save.meta, currentDate: targetDate },
    life: {
      ...save.life,
      completedDays: save.life.completedDays + days,
      dayIndex: elapsed % 7,
      weekNumber: save.life.weekNumber + Math.floor(elapsed / 7),
    },
  });
}

function syncProfessionalWorld(save: CareerSave): CareerSave {
  const league = save.football.professional.league;
  if (league.schedule.length === 0) return save;
  const careerRegistry = syncProfessionalCareerRegistry(
    save.world.careerRegistry,
    league.roster,
    league.freeAgents,
    league.transactions,
    league.seasonYear,
    league.week,
  );
  return { ...save, world: { ...save.world, careerRegistry } };
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
    schemeFit: 60,
    depthRank: freeAgent ? 0 : index + 1,
    yearsRemaining: freeAgent ? 0 : random.integer(1, 4),
    annualSalary,
    guaranteedRemaining: freeAgent ? 0 : Math.round(annualSalary * random.integer(20, 75) / 100 / 10_000) * 10_000,
    status: freeAgent ? "free-agent" : "active",
    availability: "active",
    injuryWeeks: 0,
    isHero: false,
  };
}


function rookieFromProspect(
  prospect: ProfessionalProspect,
  teamId: string | undefined,
  seasonYear: number,
  round: number | null,
  overallPick: number | null,
): ProfessionalRosterPlayer {
  const random = new SeededRandom(`${prospect.id}:${seasonYear}:${teamId ?? "fa"}`);
  const annualSalary = round
    ? Math.max(760_000, Math.round((780_000 + Math.max(0, 8 - round) * 135_000 + Math.max(0, 120 - (overallPick ?? 120)) * 18_000) / 10_000) * 10_000)
    : Math.max(760_000, Math.round((740_000 + Math.max(0, prospect.overall - 55) * 90_000) / 10_000) * 10_000);
  return {
    id: `pro-rookie:${seasonYear}:${prospect.sourcePlayerId ?? prospect.id}`,
    sourcePlayerId: prospect.sourcePlayerId,
    collegeTeamId: prospect.collegeTeamId,
    collegeName: prospect.collegeName,
    draftYear: seasonYear,
    draftRound: round,
    draftPick: overallPick,
    name: prospect.name,
    ...(teamId ? { teamId } : {}),
    position: prospect.position,
    age: prospect.age,
    overall: clamp(prospect.overall * 0.78 + prospect.draftGrade * 0.22, 50, 96),
    potential: clamp(Math.max(prospect.potential, prospect.overall + random.integer(2, 8))),
    health: prospect.medicalScore,
    form: clamp(54 + prospect.production * 0.2 + random.integer(-5, 6)),
    schemeFit: 60,
    depthRank: teamId ? 6 : 0,
    yearsRemaining: teamId ? 4 : 0,
    annualSalary,
    guaranteedRemaining: teamId ? Math.round(annualSalary * (round && round <= 2 ? 1.8 : round && round <= 4 ? 0.9 : 0.35) / 10_000) * 10_000 : 0,
    status: teamId ? "active" : "free-agent",
    availability: "active",
    injuryWeeks: 0,
    isHero: false,
  };
}

function injectDraftClass(
  state: CareerSave["football"]["professional"],
  seasonYear: number,
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
): { roster: ProfessionalRosterPlayer[]; freeAgents: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  let nextRoster = [...roster];
  let nextFreeAgents = [...freeAgents];
  const transactions: ProfessionalTransaction[] = [];
  const prospectById = new Map(state.prospects.map((prospect) => [prospect.id, prospect]));
  for (const selection of state.draftResults.filter((pick) => !pick.isHero)) {
    const prospect = prospectById.get(selection.prospectId);
    if (!prospect) continue;
    const rookie = rookieFromProspect(prospect, selection.teamId, seasonYear, selection.round, selection.overallPick);
    const replacement = nextRoster
      .filter((player) => player.teamId === selection.teamId && player.position === rookie.position && player.status === "active" && !player.isHero)
      .sort((left, right) => left.overall - right.overall || right.age - left.age)[0];
    if (replacement) {
      nextRoster = nextRoster.filter((player) => player.id !== replacement.id);
      nextFreeAgents.push({ ...replacement, teamId: undefined, status: "free-agent", depthRank: 0, yearsRemaining: 0 });
    }
    nextRoster.push(rookie);
    transactions.push({
      id: `pro-tx:${seasonYear}:draft:${selection.overallPick}:${rookie.id}`,
      seasonYear,
      week: 0,
      kind: "signing",
      playerId: rookie.id,
      playerName: rookie.name,
      position: rookie.position,
      toTeamId: selection.teamId,
      value: rookie.annualSalary,
      summary: `${rookie.name} вошёл в состав после выбора №${selection.overallPick}.`,
    });
  }
  const selectedIds = new Set(state.draftResults.map((pick) => pick.prospectId));
  for (const prospect of state.prospects.filter((item) => !item.isHero && !selectedIds.has(item.id))) {
    nextFreeAgents.push(rookieFromProspect(prospect, undefined, seasonYear, null, null));
  }
  return { roster: nextRoster, freeAgents: nextFreeAgents, transactions };
}

function prospectFromCareerRecord(record: EcosystemPlayerCareerRecord): ProfessionalProspect {
  const production = clamp(record.overall * 0.68 + record.potential * 0.2 + 8);
  const athleticScore = clamp(record.overall * 0.7 + record.potential * 0.3);
  const medicalScore = clamp(78 + Math.max(-12, record.overall - 70) * 0.25);
  const interviewScore = clamp(58 + record.potential * 0.28);
  const draftGrade = clamp(record.overall * 0.48 + record.potential * 0.28 + production * 0.12 + athleticScore * 0.07 + medicalScore * 0.03 + interviewScore * 0.02);
  return {
    id: `prospect:${record.playerId}`,
    sourcePlayerId: record.playerId,
    collegeTeamId: record.collegeTeamIds.at(-1),
    previousTeamIds: [...record.highSchoolTeamIds, ...record.collegeTeamIds],
    seasonsPlayed: Math.max(1, record.events.filter((item) => item.kind === "enrolled").length),
    declaredEarly: false,
    name: record.name,
    position: record.position,
    collegeName: record.collegeTeamIds.at(-1)?.replace(/^college-/, "").toUpperCase() ?? "College",
    age: Math.max(20, record.age),
    overall: record.overall,
    potential: record.potential,
    production,
    athleticScore,
    medicalScore,
    interviewScore,
    draftGrade,
    projectedRound: draftGrade >= 88 ? 1 : draftGrade >= 81 ? 2 : draftGrade >= 75 ? 3 : draftGrade >= 69 ? 4 : draftGrade >= 64 ? 5 : draftGrade >= 59 ? 6 : draftGrade >= 54 ? 7 : null,
    isHero: record.isHero,
  };
}

function runLifecycleRookieDraft(
  save: CareerSave,
  seasonYear: number,
  teams: ProfessionalTeam[],
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
): {
  roster: ProfessionalRosterPlayer[];
  freeAgents: ProfessionalRosterPlayer[];
  transactions: ProfessionalTransaction[];
  selections: ProfessionalDraftSelection[];
  careerRegistry: CareerSave["world"]["careerRegistry"];
} {
  const pool = save.world.careerRegistry.records
    .filter((record) => record.currentStage === "draft-pool" && !record.isHero)
    .map(prospectFromCareerRecord)
    .sort((left, right) => right.draftGrade - left.draftGrade || left.id.localeCompare(right.id));
  if (pool.length === 0) {
    return { roster, freeAgents, transactions: [], selections: [], careerRegistry: save.world.careerRegistry };
  }
  const order = [...teams].sort((left, right) => left.wins - right.wins || left.rosterStrength - right.rosterStrength || left.id.localeCompare(right.id));
  let nextRoster = [...roster];
  const nextFreeAgents = [...freeAgents];
  const selections: ProfessionalDraftSelection[] = [];
  const transactions: ProfessionalTransaction[] = [];
  const remaining = [...pool];
  for (let round = 1; round <= 7 && remaining.length > 0; round += 1) {
    for (let index = 0; index < order.length && remaining.length > 0; index += 1) {
      const team = order[index]!;
      const prospect = [...remaining]
        .sort((left, right) => (right.draftGrade + team.needs[right.position] * 0.17) - (left.draftGrade + team.needs[left.position] * 0.17) || left.id.localeCompare(right.id))[0]!;
      remaining.splice(remaining.findIndex((item) => item.id === prospect.id), 1);
      const overallPick = (round - 1) * order.length + index + 1;
      const selection: ProfessionalDraftSelection = {
        id: `${seasonYear}:round-${round}:pick-${index + 1}:${prospect.id}`,
        sourcePlayerId: prospect.sourcePlayerId,
        round,
        pickInRound: index + 1,
        overallPick,
        teamId: team.id,
        prospectId: prospect.id,
        prospectName: prospect.name,
        position: prospect.position,
        collegeName: prospect.collegeName,
        grade: prospect.draftGrade,
        isHero: false,
      };
      selections.push(selection);
      const rookie = rookieFromProspect(prospect, team.id, seasonYear, round, overallPick);
      const replacement = nextRoster
        .filter((player) => player.teamId === team.id && player.position === rookie.position && player.status === "active" && !player.isHero)
        .sort((left, right) => left.overall - right.overall || right.age - left.age)[0];
      if (replacement) {
        nextRoster = nextRoster.filter((player) => player.id !== replacement.id);
        nextFreeAgents.push({ ...replacement, teamId: undefined, status: "free-agent", depthRank: 0, yearsRemaining: 0 });
      }
      nextRoster.push(rookie);
      transactions.push({
        id: `pro-tx:${seasonYear}:draft:${overallPick}:${rookie.id}`,
        seasonYear,
        week: 0,
        kind: "signing",
        playerId: rookie.id,
        playerName: rookie.name,
        position: rookie.position,
        toTeamId: team.id,
        value: rookie.annualSalary,
        summary: `${team.shortName} выбрали ${prospect.name} под №${overallPick}.`,
      });
    }
  }
  for (const prospect of remaining) nextFreeAgents.push(rookieFromProspect(prospect, undefined, seasonYear, null, null));
  const careerRegistry = registerProfessionalDraftClass(save.world.careerRegistry, pool, selections, nextRoster, seasonYear, 0);
  return { roster: nextRoster, freeAgents: nextFreeAgents, transactions, selections, careerRegistry };
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
  const roster = teams.flatMap((team) => {
    const players = CAREER_FOOTBALL_POSITIONS.flatMap((position) =>
      Array.from({ length: PROFESSIONAL_ROSTER_COUNTS[position] }, (_, index) => createPlayer(seed, team.id, position, index, false, "initial")),
    );
    return fitPayroll(players);
  });
  return applyProfessionalSchemeFit(teams, roster);
}

function generateFreeAgents(seed: string, seasonYear: number): ProfessionalRosterPlayer[] {
  const positions = CAREER_FOOTBALL_POSITIONS.flatMap((position) => [position, position, position, position]);
  return positions.map((position, index) => createPlayer(`${seed}:free-agency:${seasonYear}`, undefined, position, index, true, `fa:${seasonYear}`));
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

function runNpcFreeAgency(seed: string, seasonYear: number, teams: ProfessionalTeam[], roster: ProfessionalRosterPlayer[], freeAgents: ProfessionalRosterPlayer[], week = 0): {
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
        .map((player) => {
          const fit = professionalSchemeFit(currentTeam, player);
          return { player, fit, score: player.overall + currentTeam.needs[player.position] * 0.28 + fit * 0.16 - Math.max(0, player.annualSalary - maxSalary) / 1_000_000 * 2.4 };
        })
        .sort((a, b) => b.score - a.score || a.player.annualSalary - b.player.annualSalary || a.player.id.localeCompare(b.player.id))[0];
      if (!target) break;
      const candidate = target.player;
      const random = new SeededRandom(seed).fork(`fa:${seasonYear}:${team.id}:${candidate.id}`);
      const proposedSalary = Math.max(760_000, Math.round(candidate.annualSalary * (random.integer(92, 112) + Math.max(0, target.fit - 65) * .18) / 100 / 10_000) * 10_000);
      const salary = Math.max(760_000, Math.min(proposedSalary, Math.floor(maxSalary / 10_000) * 10_000));
      const depthRank = nextRoster.filter((player) => player.teamId === team.id && player.position === candidate.position && player.status === "active").length + 1;
      const signed: ProfessionalRosterPlayer = { ...candidate, teamId: team.id, schemeFit: target.fit, status: "active", depthRank, yearsRemaining: random.integer(1, 3), annualSalary: salary, guaranteedRemaining: Math.round(salary * 0.35 / 10_000) * 10_000 };
      nextRoster.push(signed);
      available.splice(available.findIndex((player) => player.id === candidate.id), 1);
      transactions.push({
        id: `pro-tx:${seasonYear}:w${week}:fa:${team.id}:${candidate.id}`,
        seasonYear,
        week,
        kind: "signing",
        playerId: candidate.id,
        playerName: candidate.name,
        position: candidate.position,
        toTeamId: team.id,
        value: salary,
        summary: `${team.shortName} подписали ${candidate.position} ${candidate.name} на ${Math.round(salary / 100_000) / 10}M в год.`,
      });
      nextTeams = recalculateTeams(nextTeams, nextRoster);
    }
  }
  return { teams: nextTeams, roster: nextRoster, freeAgents: available, transactions };
}

function heroRosterPlayer(save: CareerSave, teamId: string, status: "active" | "practice-squad", depthRank: number): ProfessionalRosterPlayer {
  const contract = save.football.professional.contract;
  const heroSourceId = save.football.professional.heroSelection?.sourcePlayerId
    ?? save.football.professional.prospects.find((prospect) => prospect.isHero)?.sourcePlayerId;
  return {
    id: "pro-player:hero",
    ...(heroSourceId ? { sourcePlayerId: heroSourceId } : {}),
    name: save.character.identity.fullName,
    teamId,
    position: save.football.position,
    age: Math.max(20, save.character.identity.age),
    overall: save.football.ratings.overall,
    potential: save.football.ratings.potentialBand === "national-ceiling" ? 96 : save.football.ratings.potentialBand === "high-upside" ? 90 : save.football.ratings.potentialBand === "starter" ? 84 : 77,
    health: save.character.condition.health,
    form: clamp(54 + save.character.condition.confidence * 0.3),
    schemeFit: save.football.professional.campInvites.find((invite) => invite.teamId === teamId)?.schemeFit ?? 60,
    depthRank,
    yearsRemaining: contract?.years ?? 1,
    annualSalary: contract?.salaryYearOne ?? 795_000,
    guaranteedRemaining: contract?.guaranteed ?? 0,
    status,
    availability: "active",
    injuryWeeks: 0,
    isHero: true,
  };
}

function roleFor(status: CareerSave["football"]["professional"]["status"], depthRank: number, availability: ProfessionalRosterPlayer["availability"] = "active"): ProfessionalHeroCareer["role"] {
  if (availability === "out" || availability === "injured-reserve") return "inactive";
  if (status === "practice-squad") return "practice-squad";
  if (status === "free-agent" || status === "cut") return "free-agent";
  if (depthRank <= 1) return "starter";
  if (depthRank <= 2) return "rotation";
  return "special-teams";
}

function defaultProfessionalWeekPlan(seasonYear: number, week: number): ProfessionalWeeklyPlan {
  return {
    seasonYear,
    week,
    focus: "playbook",
    resolved: false,
    readinessDelta: 0,
    coachTrustDelta: 0,
    healthDelta: 0,
    depthDelta: 0,
    injuryRisk: 0,
    summary: "План недели ещё не выбран.",
  };
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
    availability: "active",
    weeklyPlan: defaultProfessionalWeekPlan(save.football.professional.draftYear, 1),
  };
}

function playerDepthScore(player: ProfessionalRosterPlayer, heroCoachTrust = 0): number {
  const availabilityPenalty = player.availability === "active" ? 0 : player.availability === "questionable" ? 7 : 40;
  const heroBonus = player.isHero ? heroCoachTrust * 0.12 : 0;
  return player.overall * 0.64 + player.form * 0.16 + player.health * 0.08 + player.schemeFit * 0.12 + heroBonus - availabilityPenalty;
}

function rebuildProfessionalDepthCharts(roster: ProfessionalRosterPlayer[], heroCoachTrust = 0): ProfessionalRosterPlayer[] {
  const ranks = new Map<string, number>();
  const teamIds = [...new Set(roster.flatMap((player) => player.teamId ? [player.teamId] : []))];
  for (const teamId of teamIds) {
    for (const position of CAREER_FOOTBALL_POSITIONS) {
      const room = roster
        .filter((player) => player.teamId === teamId && player.position === position && player.status !== "practice-squad")
        .sort((left, right) => playerDepthScore(right, heroCoachTrust) - playerDepthScore(left, heroCoachTrust) || left.id.localeCompare(right.id));
      room.forEach((player, index) => ranks.set(player.id, index + 1));
    }
  }
  return roster.map((player) => ({ ...player, depthRank: ranks.get(player.id) ?? player.depthRank }));
}

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

function advanceProfessionalMedical(
  seed: string,
  seasonYear: number,
  currentWeek: number,
  roster: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
): { roster: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  const random = new SeededRandom(seed).fork(`professional-medical:${seasonYear}:${currentWeek}`);
  const nextTransactions = [...transactions];
  const nextRoster = roster.map((player) => {
    if (player.injuryWeeks > 0) {
      const injuryWeeks = Math.max(0, player.injuryWeeks - 1);
      const availability = injuryWeeks === 0 ? "active" as const : injuryWeeks === 1 ? "questionable" as const : injuryWeeks >= 5 ? "injured-reserve" as const : "out" as const;
      const status = player.status === "injured-reserve" && injuryWeeks === 0 ? "active" as const : availability === "injured-reserve" ? "injured-reserve" as const : player.status;
      return { ...player, injuryWeeks, availability, status, health: clamp(player.health + random.integer(2, 6)) };
    }
    if (player.isHero || player.status !== "active") return player;
    const injuryChance = .0035 + Math.max(0, 78 - player.health) * .00025;
    if (!random.chance(injuryChance)) return { ...player, health: clamp(player.health + random.integer(-2, 2)) };
    const injuryWeeks = random.integer(1, 7);
    const availability = injuryWeeks === 1 ? "questionable" as const : injuryWeeks >= 5 ? "injured-reserve" as const : "out" as const;
    nextTransactions.push({
      id: `pro-tx:${seasonYear}:w${currentWeek}:injury:${player.id}`,
      seasonYear,
      week: currentWeek,
      kind: "injury",
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      fromTeamId: player.teamId,
      value: injuryWeeks,
      summary: `${player.position} ${player.name} выбыл на ${injuryWeeks} нед.`,
    });
    return { ...player, injuryWeeks, availability, status: availability === "injured-reserve" ? "injured-reserve" as const : player.status, health: clamp(player.health - random.integer(4, 14)) };
  });
  return { roster: rebuildProfessionalDepthCharts(nextRoster), transactions: nextTransactions.slice(-600) };
}

function balanceProfessionalActiveRosters(
  seed: string,
  seasonYear: number,
  currentWeek: number,
  teams: ProfessionalTeam[],
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
): { teams: ProfessionalTeam[]; roster: ProfessionalRosterPlayer[]; freeAgents: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  let nextRoster = [...roster];
  let nextFreeAgents = [...freeAgents];
  let nextTransactions = [...transactions];

  for (const team of teams) {
    const active = nextRoster
      .filter((player) => player.teamId === team.id && player.status === "active")
      .sort((left, right) => playerDepthScore(left) - playerDepthScore(right) || right.annualSalary - left.annualSalary || left.id.localeCompare(right.id));
    let excess = Math.max(0, active.length - 53);
    for (const player of active) {
      if (excess <= 0) break;
      if (player.isHero) continue;
      nextRoster = nextRoster.filter((candidate) => candidate.id !== player.id);
      nextFreeAgents.push({ ...player, teamId: undefined, status: "free-agent", availability: "active", injuryWeeks: 0, depthRank: 0, yearsRemaining: 0, guaranteedRemaining: 0 });
      nextTransactions.push({
        id: `pro-tx:${seasonYear}:w${currentWeek}:roster-balance:${player.id}`,
        seasonYear,
        week: currentWeek,
        kind: "release",
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        fromTeamId: team.id,
        value: player.annualSalary,
        summary: `${team.shortName} освободили ${player.position} ${player.name} после возвращения игрока из списка травмированных.`,
      });
      excess -= 1;
    }
  }

  const market = runNpcFreeAgency(seed, seasonYear, recalculateTeams(teams, nextRoster), nextRoster, nextFreeAgents, currentWeek);
  return {
    teams: market.teams,
    roster: market.roster,
    freeAgents: market.freeAgents,
    transactions: [...nextTransactions, ...market.transactions].slice(-600),
  };
}

function runProfessionalTradeDeadline(
  seed: string,
  seasonYear: number,
  currentWeek: number,
  teams: ProfessionalTeam[],
  roster: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
): { teams: ProfessionalTeam[]; roster: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  if (currentWeek !== 8) return { teams, roster, transactions };
  const random = new SeededRandom(seed).fork(`professional-trade-deadline:${seasonYear}`);
  const buyers = [...teams].sort((left, right) => Math.max(...Object.values(right.needs)) - Math.max(...Object.values(left.needs)));
  const buyer = buyers[0];
  if (!buyer) return { teams, roster, transactions };
  const position = [...CAREER_FOOTBALL_POSITIONS].sort((left, right) => buyer.needs[right] - buyer.needs[left])[0];
  if (!position) return { teams, roster, transactions };
  const candidates = roster.filter((player) => !player.isHero && player.teamId && player.teamId !== buyer.id && player.position === position && player.status === "active" && player.depthRank >= 2 && player.availability === "active" && player.annualSalary <= buyer.capSpace);
  if (candidates.length === 0) return { teams, roster, transactions };
  const target = [...candidates].sort((left, right) => professionalSchemeFit(buyer, right) - professionalSchemeFit(buyer, left) || right.overall - left.overall || left.id.localeCompare(right.id))[0] ?? random.pick(candidates);
  if (!target.teamId) return { teams, roster, transactions };
  const seller = teams.find((team) => team.id === target.teamId);
  const moved = rebuildProfessionalDepthCharts(roster.map((player) => player.id === target.id ? { ...player, teamId: buyer.id, schemeFit: professionalSchemeFit(buyer, player) } : player));
  const nextTeams = recalculateTeams(teams, moved);
  return {
    teams: nextTeams,
    roster: moved,
    transactions: [...transactions, {
      id: `pro-tx:${seasonYear}:w${currentWeek}:trade:${target.id}`,
      seasonYear,
      week: currentWeek,
      kind: "trade" as const,
      playerId: target.id,
      playerName: target.name,
      position: target.position,
      fromTeamId: seller?.id,
      toTeamId: buyer.id,
      value: target.annualSalary,
      summary: `${seller?.shortName ?? "Клуб"} обменяли ${target.position} ${target.name} в ${buyer.shortName}.`,
    }].slice(-600),
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
  const specialist = save.football.position === "K" || save.football.position === "P";
  const totalEpisodes = specialist ? 18 : 120;
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
    rosterRole: role,
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
    tacticalMemory: { heroOffense: [], opponentOffense: [] },
    usagePlan: buildMatchUsagePlan(save, role),
    usageStats: createEmptyMatchUsageStats(),
  };
}

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

function simulationScore(seed: string, game: ProfessionalGame, home: ProfessionalTeam, away: ProfessionalTeam): { home: number; away: number } {
  const random = new SeededRandom(seed).fork(`pro-game:${game.id}`);
  const homePace = home.tactical?.tempo === "fast" ? 2 : home.tactical?.tempo === "controlled" ? -1 : 0;
  const awayPace = away.tactical?.tempo === "fast" ? 2 : away.tactical?.tempo === "controlled" ? -1 : 0;
  const homeBase = 17 + (home.rosterStrength - 65) * 0.46 + (professionalStaffRating(home) - 65) * .09 + professionalTacticalModifier(home, away) + homePace + random.integer(-9, 10) + 2;
  const awayBase = 17 + (away.rosterStrength - 65) * 0.46 + (professionalStaffRating(away) - 65) * .09 + professionalTacticalModifier(away, home) + awayPace + random.integer(-9, 10);
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

export function isProfessionalMatchAwaitingResolution(save: CareerSave): boolean {
  const state = save.football.professional;
  return save.meta.phase === "professional-career"
    && state.status === "roster"
    && state.heroCareer?.role !== "inactive"
    && Boolean(state.league.activeGameId)
    && state.league.activeGameId === save.football.match.gameId;
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

export function professionalStandings(teams: ProfessionalTeam[]): ProfessionalTeam[] {
  return [...teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.rosterStrength - a.rosterStrength || a.id.localeCompare(b.id));
}

export function emptyProfessionalStats(): MatchStatLine {
  return emptyStats();
}
