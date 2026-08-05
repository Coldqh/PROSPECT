import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { CAREER_FOOTBALL_POSITIONS, type FootballPosition } from "../../career/types";
import { PROFESSIONAL_SALARY_CAP } from "../createProfessionalState";
import { applyProfessionalSchemeFit } from "../coaching";
import type { ProfessionalHeroCareer, ProfessionalRosterPlayer, ProfessionalTeam, ProfessionalWeeklyPlan } from "../types";
import { FIRST_NAMES, LAST_NAMES, POSITION_MULTIPLIER, PROFESSIONAL_ROSTER_COUNTS, clamp } from "./shared";

export function salaryFor(position: FootballPosition, overall: number, random: SeededRandom): number {
  const base = 760_000 + Math.max(0, overall - 55) * 285_000 * POSITION_MULTIPLIER[position];
  return Math.max(760_000, Math.round((base + random.integer(-300_000, 650_000)) / 10_000) * 10_000);
}

export function createPlayer(seed: string, teamId: string | undefined, position: FootballPosition, index: number, freeAgent: boolean, namespace: string): ProfessionalRosterPlayer {
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

export function fitPayroll(players: ProfessionalRosterPlayer[], ceiling = PROFESSIONAL_SALARY_CAP * 0.82): ProfessionalRosterPlayer[] {
  const payroll = players.reduce((sum, player) => sum + player.annualSalary, 0);
  if (payroll <= ceiling) return players;
  const ratio = ceiling / payroll;
  return players.map((player) => ({
    ...player,
    annualSalary: Math.max(760_000, Math.round(player.annualSalary * ratio / 10_000) * 10_000),
    guaranteedRemaining: Math.round(player.guaranteedRemaining * ratio / 10_000) * 10_000,
  }));
}

export function generateLeagueRoster(seed: string, teams: ProfessionalTeam[]): ProfessionalRosterPlayer[] {
  const roster = teams.flatMap((team) => {
    const players = CAREER_FOOTBALL_POSITIONS.flatMap((position) =>
      Array.from({ length: PROFESSIONAL_ROSTER_COUNTS[position] }, (_, index) => createPlayer(seed, team.id, position, index, false, "initial")),
    );
    return fitPayroll(players);
  });
  return applyProfessionalSchemeFit(teams, roster);
}

export function generateFreeAgents(seed: string, seasonYear: number): ProfessionalRosterPlayer[] {
  const positions = CAREER_FOOTBALL_POSITIONS.flatMap((position) => [position, position, position, position]);
  return positions.map((position, index) => createPlayer(`${seed}:free-agency:${seasonYear}`, undefined, position, index, true, `fa:${seasonYear}`));
}


export function teamPayroll(teamId: string, roster: ProfessionalRosterPlayer[]): number {
  return roster.filter((player) => player.teamId === teamId && player.status !== "free-agent").reduce((sum, player) => sum + player.annualSalary, 0);
}

export function recalculateTeams(teams: ProfessionalTeam[], roster: ProfessionalRosterPlayer[]): ProfessionalTeam[] {
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

export function heroRosterPlayer(save: CareerSave, teamId: string, status: "active" | "practice-squad", depthRank: number): ProfessionalRosterPlayer {
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

export function roleFor(status: CareerSave["football"]["professional"]["status"], depthRank: number, availability: ProfessionalRosterPlayer["availability"] = "active"): ProfessionalHeroCareer["role"] {
  if (availability === "out" || availability === "injured-reserve") return "inactive";
  if (status === "practice-squad") return "practice-squad";
  if (status === "free-agent" || status === "cut") return "free-agent";
  if (depthRank <= 1) return "starter";
  if (depthRank <= 2) return "rotation";
  return "special-teams";
}

export function defaultProfessionalWeekPlan(seasonYear: number, week: number): ProfessionalWeeklyPlan {
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

export function createHeroCareer(save: CareerSave, teamId: string | undefined): ProfessionalHeroCareer {
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

export function playerDepthScore(player: ProfessionalRosterPlayer, heroCoachTrust = 0): number {
  const availabilityPenalty = player.availability === "active" ? 0 : player.availability === "questionable" ? 7 : 40;
  const heroBonus = player.isHero ? heroCoachTrust * 0.12 : 0;
  return player.overall * 0.64 + player.form * 0.16 + player.health * 0.08 + player.schemeFit * 0.12 + heroBonus - availabilityPenalty;
}

export function rebuildProfessionalDepthCharts(roster: ProfessionalRosterPlayer[], heroCoachTrust = 0): ProfessionalRosterPlayer[] {
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
