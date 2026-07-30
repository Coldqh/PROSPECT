import { SeededRandom } from "../../../core/random/SeededRandom";
import type { EcosystemDefenseSystem, EcosystemOffenseSystem } from "../ecosystem/types";
import type { FootballPosition } from "../career/types";
import type { ProfessionalCoach, ProfessionalCoachRole, ProfessionalRosterPlayer, ProfessionalTacticalIdentity, ProfessionalTeam } from "./types";

const FIRST_NAMES = ["Marcus", "Andre", "Caleb", "Derrick", "Grant", "Isaiah", "Julian", "Malcolm", "Nolan", "Victor", "Ethan", "Roman"] as const;
const LAST_NAMES = ["Bennett", "Carter", "Dawson", "Ellis", "Foster", "Hayes", "Jefferson", "Manning", "Porter", "Reed", "Sutton", "Walker"] as const;
const OFFENSE_SYSTEMS: readonly EcosystemOffenseSystem[] = ["air-raid", "west-coast", "power-run", "spread-option", "multiple"];
const DEFENSE_SYSTEMS: readonly EcosystemDefenseSystem[] = ["quarters-425", "multiple-34", "over-43", "nickel-match", "man-pressure", "multiple-defense"];

const OFFENSE_POSITION_FIT: Record<EcosystemOffenseSystem, Partial<Record<FootballPosition, number>>> = {
  "air-raid": { QB: 10, WR: 13, TE: 4, RB: -3, OT: 2, OG: -1, C: 1 },
  "west-coast": { QB: 9, WR: 8, TE: 8, RB: 6, OT: 2, OG: 2, C: 4 },
  "power-run": { QB: -1, WR: -4, TE: 10, RB: 13, OT: 9, OG: 11, C: 10 },
  "spread-option": { QB: 11, WR: 6, TE: 1, RB: 11, OT: 5, OG: 6, C: 5 },
  multiple: { QB: 5, WR: 5, TE: 5, RB: 5, OT: 5, OG: 5, C: 5 },
};

const DEFENSE_POSITION_FIT: Record<EcosystemDefenseSystem, Partial<Record<FootballPosition, number>>> = {
  "quarters-425": { EDGE: 4, DT: 2, LB: 7, CB: 10, S: 12 },
  "multiple-34": { EDGE: 12, DT: 8, LB: 11, CB: 3, S: 5 },
  "over-43": { EDGE: 9, DT: 11, LB: 9, CB: 4, S: 4 },
  "nickel-match": { EDGE: 7, DT: 3, LB: 6, CB: 12, S: 10 },
  "man-pressure": { EDGE: 11, DT: 4, LB: 9, CB: 11, S: 7 },
  "multiple-defense": { EDGE: 6, DT: 6, LB: 6, CB: 6, S: 6 },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function coachName(random: SeededRandom): string {
  return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
}

function createCoach(teamId: string, role: ProfessionalCoachRole, prestige: number, random: SeededRandom): ProfessionalCoach {
  const base = role === "head-coach" ? 74 : role === "position-coach" ? 61 : 68;
  const reputation = clamp(base + (prestige - 70) * .25 + random.integer(-10, 12));
  return {
    id: `${teamId}-${role}`,
    name: coachName(random),
    role,
    age: random.integer(role === "head-coach" ? 38 : 30, 69),
    reputation,
    tactics: clamp(reputation + random.integer(-10, 14)),
    development: clamp(reputation + random.integer(-12, 16)),
    adaptability: clamp(58 + random.integer(-12, 28)),
    gameManagement: clamp(60 + random.integer(-14, 25)),
    jobSecurity: clamp(62 + random.integer(-18, 26)),
    contractYears: random.integer(1, role === "head-coach" ? 5 : 3),
    annualSalary: Math.round((role === "head-coach" ? 7_500_000 : role === "position-coach" ? 1_250_000 : 3_100_000) * (.72 + reputation / 100)),
    offenseSystem: random.pick(OFFENSE_SYSTEMS),
    defenseSystem: random.pick(DEFENSE_SYSTEMS),
  };
}

export function createProfessionalStaff(teamId: string, prestige: number, seed: string): ProfessionalCoach[] {
  const random = new SeededRandom(seed);
  return (["head-coach", "offensive-coordinator", "defensive-coordinator", "position-coach"] as const)
    .map((role) => createCoach(teamId, role, prestige, random.fork(role)));
}

export function createProfessionalTacticalIdentity(staff: readonly ProfessionalCoach[], seed: string): ProfessionalTacticalIdentity {
  const random = new SeededRandom(seed);
  const head = staff.find((coach) => coach.role === "head-coach");
  const offense = staff.find((coach) => coach.role === "offensive-coordinator") ?? head;
  const defense = staff.find((coach) => coach.role === "defensive-coordinator") ?? head;
  const offenseSystem = offense?.offenseSystem ?? "multiple";
  const defenseSystem = defense?.defenseSystem ?? "multiple-defense";
  const runBase: Record<EcosystemOffenseSystem, number> = { "air-raid": 31, "west-coast": 42, "power-run": 61, "spread-option": 53, multiple: 47 };
  const blitzBase: Record<EcosystemDefenseSystem, number> = { "quarters-425": 25, "multiple-34": 42, "over-43": 29, "nickel-match": 32, "man-pressure": 52, "multiple-defense": 35 };
  const manBase: Record<EcosystemDefenseSystem, number> = { "quarters-425": 29, "multiple-34": 40, "over-43": 35, "nickel-match": 44, "man-pressure": 69, "multiple-defense": 42 };
  return {
    offenseSystem,
    defenseSystem,
    tempo: offenseSystem === "air-raid" || offenseSystem === "spread-option" ? "fast" : offenseSystem === "power-run" ? "controlled" : "balanced",
    offensiveAggression: offenseSystem === "air-raid" ? "aggressive" : offenseSystem === "power-run" ? "conservative" : "balanced",
    defensiveAggression: defenseSystem === "man-pressure" || defenseSystem === "multiple-34" ? "aggressive" : "balanced",
    runRate: clamp(runBase[offenseSystem] + random.integer(-4, 4)),
    playActionRate: clamp((offenseSystem === "power-run" ? 27 : offenseSystem === "spread-option" ? 24 : 17) + random.integer(-3, 4)),
    screenRate: clamp((offenseSystem === "air-raid" || offenseSystem === "west-coast" ? 18 : 11) + random.integer(-3, 4)),
    deepShotRate: clamp((offenseSystem === "air-raid" ? 27 : offenseSystem === "power-run" ? 14 : 20) + random.integer(-4, 4)),
    blitzRate: clamp(blitzBase[defenseSystem] + random.integer(-4, 4)),
    manCoverageRate: clamp(manBase[defenseSystem] + random.integer(-4, 4)),
    disguiseRate: clamp(35 + (defense?.adaptability ?? 55) * .5 + random.integer(-6, 6)),
    fourthDownAggression: clamp(30 + (head?.gameManagement ?? 55) * .45 + random.integer(-5, 5)),
    adaptation: clamp((head?.adaptability ?? 55) * .35 + (offense?.adaptability ?? 55) * .325 + (defense?.adaptability ?? 55) * .325),
  };
}

export function ensureProfessionalCoaching(teams: ProfessionalTeam[], seed: string): ProfessionalTeam[] {
  return teams.map((team) => {
    const staff = team.staff?.length === 4 ? team.staff : createProfessionalStaff(team.id, team.prestige, `${seed}:${team.id}:staff`);
    const tactical = team.tactical ?? createProfessionalTacticalIdentity(staff, `${seed}:${team.id}:tactical`);
    return { ...team, staff, tactical };
  });
}


export function professionalStaffRating(team: ProfessionalTeam): number {
  const staff = team.staff ?? [];
  if (staff.length === 0) return 50;
  const weights: Record<ProfessionalCoachRole, number> = {
    "head-coach": 1.35,
    "offensive-coordinator": 1,
    "defensive-coordinator": 1,
    "position-coach": .65,
  };
  const totalWeight = staff.reduce((sum, coach) => sum + weights[coach.role], 0);
  const total = staff.reduce((sum, coach) => {
    const value = coach.reputation * .2 + coach.tactics * .38 + coach.adaptability * .2 + coach.gameManagement * .12 + coach.development * .1;
    return sum + value * weights[coach.role];
  }, 0);
  return clamp(total / Math.max(1, totalWeight));
}

export function professionalTacticalModifier(team: ProfessionalTeam, opponent: ProfessionalTeam): number {
  const tactical = team.tactical;
  const opponentTactical = opponent.tactical;
  if (!tactical || !opponentTactical) return 0;
  const staff = professionalStaffRating(team);
  const execution = (staff - 65) * .055 + (tactical.adaptation - 55) * .025;
  const pressureAnswer = (tactical.screenRate - 12) * (opponentTactical.blitzRate - 35) * .0015;
  const runAnswer = (tactical.runRate - 48) * (opponentTactical.manCoverageRate - 42) * .0011;
  const explosiveRisk = (tactical.deepShotRate - opponentTactical.disguiseRate * .24) * .028;
  const opponentAdaptation = (opponentTactical.adaptation - 55) * .018;
  return Math.max(-5.5, Math.min(5.5, execution + pressureAnswer + runAnswer + explosiveRisk - opponentAdaptation));
}

export function advanceProfessionalCoaching(teams: ProfessionalTeam[], seasonYear: number, seed: string): ProfessionalTeam[] {
  const prepared = ensureProfessionalCoaching(teams, `${seed}:ensure`);
  return prepared.map((team) => {
    const random = new SeededRandom(`${seed}:${team.id}:${seasonYear}`);
    let changed = false;
    const staff = (team.staff ?? []).map((coach) => {
      const contractYears = Math.max(0, coach.contractYears - 1);
      const expectedWins = 6 + team.prestige / 15;
      const security = clamp(coach.jobSecurity + (team.wins - expectedWins) * (coach.role === "head-coach" ? 3.2 : 1.7) + random.fork(coach.id).integer(-4, 4));
      const replace = security < 26 || (contractYears === 0 && (security < 58 || random.fork(`${coach.id}:expiry`).chance(.28)));
      if (!replace) return { ...coach, age: Math.min(78, coach.age + 1), contractYears: Math.max(1, contractYears), jobSecurity: security };
      changed = true;
      return createCoach(team.id, coach.role, team.prestige, random.fork(`${coach.role}:replacement`));
    });
    const tactical = changed
      ? createProfessionalTacticalIdentity(staff, `${seed}:${team.id}:${seasonYear}:new-system`)
      : team.tactical ?? createProfessionalTacticalIdentity(staff, `${seed}:${team.id}:${seasonYear}:system`);
    return { ...team, staff, tactical };
  });
}


export function professionalSchemeFit(team: ProfessionalTeam, player: Pick<ProfessionalRosterPlayer, "id" | "position" | "age" | "potential">): number {
  const tactical = team.tactical;
  if (!tactical) return 60;
  const offenseBonus = OFFENSE_POSITION_FIT[tactical.offenseSystem][player.position] ?? 0;
  const defenseBonus = DEFENSE_POSITION_FIT[tactical.defenseSystem][player.position] ?? 0;
  const specialistBonus = player.position === "K" || player.position === "P" ? 5 : 0;
  const learningBonus = player.age <= 24 ? Math.max(0, player.potential - 70) * .12 : 0;
  const variance = new SeededRandom(`${team.id}:${player.id}:scheme-fit`).integer(-8, 8);
  return clamp(57 + offenseBonus + defenseBonus + specialistBonus + learningBonus + (tactical.adaptation - 55) * .08 + variance);
}

export function applyProfessionalSchemeFit(teams: readonly ProfessionalTeam[], players: readonly ProfessionalRosterPlayer[]): ProfessionalRosterPlayer[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  return players.map((player) => {
    const team = player.teamId ? teamById.get(player.teamId) : undefined;
    return { ...player, schemeFit: team ? professionalSchemeFit(team, player) : 60 };
  });
}
