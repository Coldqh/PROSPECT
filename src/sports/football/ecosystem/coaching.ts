import { SeededRandom } from "../../../core/random/SeededRandom";
import { FOOTBALL_ROSTER_POSITIONS } from "../team/positions";
import type { FootballRosterPosition } from "../team/types";
import type {
  EcosystemCoach,
  EcosystemCoachRole,
  EcosystemDefenseSystem,
  EcosystemLevel,
  EcosystemOffenseSystem,
  EcosystemTeam,
} from "./types";

const FIRST_NAMES = ["Marcus", "Andre", "Cole", "Darius", "Grant", "Isaiah", "Julian", "Malcolm", "Nolan", "Victor", "Ethan", "Roman"] as const;
const LAST_NAMES = ["Bennett", "Carter", "Dawson", "Ellis", "Foster", "Hayes", "Jefferson", "Manning", "Porter", "Reed", "Sutton", "Walker"] as const;
const OFFENSE_SYSTEMS: readonly EcosystemOffenseSystem[] = ["air-raid", "west-coast", "power-run", "spread-option", "multiple"];
const DEFENSE_SYSTEMS: readonly EcosystemDefenseSystem[] = ["quarters-425", "multiple-34", "over-43", "nickel-match", "man-pressure", "multiple-defense"];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function roleBase(role: EcosystemCoachRole): number {
  if (role === "head-coach") return 68;
  if (role === "offensive-coordinator" || role === "defensive-coordinator") return 62;
  return 56;
}

function salary(level: EcosystemLevel, role: EcosystemCoachRole, reputation: number): number {
  const levelBase = level === "college" ? 900_000 : 85_000;
  const roleMultiplier = role === "head-coach" ? 4.5 : role === "position-coach" ? .72 : 1.75;
  return Math.round(levelBase * roleMultiplier * (.65 + reputation / 100));
}

function shuffled<T>(items: readonly T[], random: SeededRandom): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = random.integer(0, index);
    [next[index], next[target]] = [next[target]!, next[index]!];
  }
  return next;
}

function specialties(role: EcosystemCoachRole, random: SeededRandom): FootballRosterPosition[] {
  if (role === "offensive-coordinator") return shuffled(["QB", "WR", "RB", "TE", "OT", "OG", "C"] as FootballRosterPosition[], random).slice(0, 3);
  if (role === "defensive-coordinator") return shuffled(["EDGE", "DT", "LB", "CB", "S"] as FootballRosterPosition[], random).slice(0, 3);
  if (role === "position-coach") return shuffled([...FOOTBALL_ROSTER_POSITIONS], random).slice(0, 2);
  return shuffled([...FOOTBALL_ROSTER_POSITIONS], random).slice(0, 4);
}

export function createEcosystemCoach(
  team: Pick<EcosystemTeam, "id" | "level" | "prestige">,
  role: EcosystemCoachRole,
  random: SeededRandom,
  forcedName?: string,
): EcosystemCoach {
  const reputation = clamp(roleBase(role) + (team.prestige - 60) * .22 + random.integer(-15, 17));
  const jobSecurity = clamp(64 + random.integer(-18, 25));
  const name = forcedName ?? `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
  const offenseSystem = random.pick(OFFENSE_SYSTEMS);
  const defenseSystem = random.pick(DEFENSE_SYSTEMS);
  return {
    id: `${team.id}-${role}`,
    seed: `${team.id}:${role}`,
    name,
    teamId: team.id,
    role,
    age: random.integer(role === "head-coach" ? 36 : 29, 68),
    reputation,
    development: clamp(reputation + random.integer(-14, 16)),
    recruiting: clamp(reputation + random.integer(-18, 18)),
    pressure: clamp(100 - jobSecurity + random.integer(-8, 11)),
    jobSecurity,
    status: jobSecurity < 35 ? "hot-seat" : jobSecurity < 55 ? "watched" : "secure",
    philosophy: `${offenseSystem} / ${defenseSystem}`,
    tactics: clamp(reputation + random.integer(-12, 18)),
    adaptability: clamp(54 + random.integer(-16, 28)),
    gameManagement: clamp(58 + random.integer(-18, 24)),
    temperament: random.pick(["calm", "demanding", "volatile", "player-first"] as const),
    offenseSystem,
    defenseSystem,
    specialtyPositions: specialties(role, random.fork("specialties")),
    contractYears: random.integer(role === "head-coach" ? 2 : 1, role === "head-coach" ? 6 : 4),
    annualSalary: salary(team.level, role, reputation),
    tenureYears: random.integer(0, role === "head-coach" ? 10 : 5),
    careerWins: random.integer(team.level === "college" ? 8 : 2, team.level === "college" ? 128 : 58),
    careerLosses: random.integer(team.level === "college" ? 5 : 2, team.level === "college" ? 88 : 44),
    previousTeamIds: [],
  };
}

export function coachingStaffForTeam(coaches: EcosystemCoach[], teamId: string): EcosystemCoach[] {
  const order: Record<EcosystemCoachRole, number> = {
    "head-coach": 0,
    "offensive-coordinator": 1,
    "defensive-coordinator": 2,
    "position-coach": 3,
  };
  return coaches.filter((coach) => coach.teamId === teamId).sort((left, right) => order[left.role] - order[right.role]);
}

export function completeCoachingStaff(
  teams: EcosystemTeam[],
  coaches: EcosystemCoach[],
  seasonYear: number,
): { teams: EcosystemTeam[]; coaches: EcosystemCoach[] } {
  const normalized = coaches.map((coach) => normalizeCoach(coach, teams.find((team) => team.id === coach.teamId)));
  const next = [...normalized];
  const roles: readonly EcosystemCoachRole[] = ["head-coach", "offensive-coordinator", "defensive-coordinator", "position-coach"];
  for (const team of teams) {
    for (const role of roles) {
      if (next.some((coach) => coach.teamId === team.id && coach.role === role)) continue;
      next.push(createEcosystemCoach(team, role, new SeededRandom(`${team.seed}:staff:${seasonYear}:${role}`)));
    }
  }
  return {
    coaches: next,
    teams: teams.map((team) => ({ ...team, coachIds: coachingStaffForTeam(next, team.id).map((coach) => coach.id) })),
  };
}

function normalizeCoach(coach: EcosystemCoach, team?: EcosystemTeam): EcosystemCoach {
  const random = new SeededRandom(`${coach.seed}:staff-v12`);
  const normalizedRole: EcosystemCoachRole = coach.role === ("coordinator" as EcosystemCoachRole)
    ? random.pick(["offensive-coordinator", "defensive-coordinator"] as const)
    : coach.role;
  const level = team?.level ?? "college";
  const prestige = team?.prestige ?? coach.reputation;
  return {
    ...coach,
    role: normalizedRole,
    tactics: coach.tactics ?? clamp(coach.reputation + random.integer(-10, 16)),
    adaptability: coach.adaptability ?? clamp(56 + random.integer(-16, 24)),
    gameManagement: coach.gameManagement ?? clamp(58 + random.integer(-14, 22)),
    temperament: coach.temperament ?? random.pick(["calm", "demanding", "volatile", "player-first"] as const),
    offenseSystem: coach.offenseSystem ?? random.pick(OFFENSE_SYSTEMS),
    defenseSystem: coach.defenseSystem ?? random.pick(DEFENSE_SYSTEMS),
    specialtyPositions: coach.specialtyPositions?.length ? coach.specialtyPositions : specialties(normalizedRole, random.fork("specialties")),
    contractYears: coach.contractYears ?? random.integer(1, normalizedRole === "head-coach" ? 5 : 3),
    annualSalary: coach.annualSalary ?? salary(level, normalizedRole, prestige),
  };
}

export function staffRating(coaches: EcosystemCoach[], teamId: string): number {
  const staff = coachingStaffForTeam(coaches, teamId);
  if (staff.length === 0) return 50;
  const weighted = staff.reduce((sum, coach) => {
    const weight = coach.role === "head-coach" ? 1.35 : coach.role === "position-coach" ? .7 : 1;
    return sum + (coach.reputation * .25 + coach.tactics * .35 + coach.development * .2 + coach.adaptability * .2) * weight;
  }, 0);
  const weight = staff.reduce((sum, coach) => sum + (coach.role === "head-coach" ? 1.35 : coach.role === "position-coach" ? .7 : 1), 0);
  return clamp(weighted / Math.max(1, weight));
}
