import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition, FootballRatings, SchoolIdentity } from "../career/types";
import type {
  FootballCoach,
  FootballRosterPlayer,
  FootballRosterPosition,
  FootballTeamStaff,
  PlayerYear,
  RosterUnit,
  TeamDynamics,
} from "./types";

const FIRST_NAMES = [
  "Avery", "Brandon", "Caleb", "Dante", "Eli", "Gavin", "Isaiah", "Jace", "Keon", "Leon",
  "Miles", "Noah", "Owen", "Quincy", "Rashad", "Sean", "Trey", "Victor", "Wes", "Zion",
] as const;
const LAST_NAMES = [
  "Adams", "Bennett", "Cross", "Dawson", "Ellis", "Fields", "Grant", "Harris", "Irvin", "James",
  "Knox", "Lewis", "Moore", "Nash", "Owens", "Price", "Ross", "Stone", "Turner", "Young",
] as const;

const POSITION_COUNTS: Record<FootballRosterPosition, number> = {
  QB: 3,
  RB: 4,
  WR: 7,
  TE: 3,
  OL: 8,
  DL: 7,
  LB: 6,
  CB: 6,
  S: 5,
  K: 1,
  P: 1,
};

const POSITION_STYLES: Record<FootballRosterPosition, readonly string[]> = {
  QB: ["pocket distributor", "vertical passer", "mobile creator"],
  RB: ["inside runner", "open-field slasher", "receiving back"],
  WR: ["route technician", "vertical threat", "possession target", "slot separator"],
  TE: ["inline blocker", "move tight end", "red-zone target"],
  OL: ["anchor blocker", "mobile lineman", "violent finisher"],
  DL: ["gap controller", "interior penetrator", "edge disruptor"],
  LB: ["run fitter", "coverage backer", "pressure specialist"],
  CB: ["press corner", "off-man technician", "ball hawk"],
  S: ["box safety", "deep-field eraser", "hybrid defender"],
  K: ["strong leg", "accuracy specialist"],
  P: ["hang-time specialist", "placement punter"],
};

const COACH_FIRST_NAMES = ["Andre", "Charles", "Derrick", "Frank", "Grant", "Harold", "Marcus", "Raymond"] as const;
const COACH_LAST_NAMES = ["Bishop", "Daniels", "Holloway", "Mercer", "Parker", "Sutton", "Wallace", "Whitaker"] as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function unitFor(position: FootballRosterPosition): RosterUnit {
  if (["QB", "RB", "WR", "TE", "OL"].includes(position)) return "offense";
  if (["DL", "LB", "CB", "S"].includes(position)) return "defense";
  return "special";
}

function yearBonus(year: PlayerYear): number {
  return { Freshman: -5, Sophomore: -2, Junior: 2, Senior: 5 }[year];
}

function createCoach(
  random: SeededRandom,
  id: string,
  role: FootballCoach["role"],
  school: SchoolIdentity,
  relationshipBase: number,
): FootballCoach {
  const archetype = random.pick(["builder", "disciplinarian", "strategist", "recruiter"] as const);
  const age = random.integer(role === "head-coach" ? 39 : 30, role === "head-coach" ? 63 : 56);
  const development = clamp(school.coaching + random.integer(-12, 11) + (archetype === "builder" ? 9 : 0));
  const tactics = clamp(school.coaching + random.integer(-10, 13) + (archetype === "strategist" ? 10 : 0));
  const discipline = clamp(school.discipline + random.integer(-10, 10) + (archetype === "disciplinarian" ? 11 : 0));
  const communication = clamp(57 + random.integer(-10, 19) + (archetype === "recruiter" ? 12 : 0));
  const youthPatience = clamp(school.youthTrust + random.integer(-12, 12) + (archetype === "builder" ? 10 : 0));
  const pressure = clamp(42 + school.prestige * 0.38 + random.integer(-8, 14));
  const summaries: Record<FootballCoach["archetype"], string> = {
    builder: "Даёт молодым повторения, но требует видимого прогресса каждую неделю.",
    disciplinarian: "Ценит порядок, выполнение задания и одинаковый стандарт для всей раздевалки.",
    strategist: "Меняет роли под соперника и доверяет игрокам, которые понимают схему.",
    recruiter: "Силен в отношениях и мотивации, но быстро теряет терпение к нестабильности.",
  };
  return {
    id,
    name: `${random.pick(COACH_FIRST_NAMES)} ${random.pick(COACH_LAST_NAMES)}`,
    role,
    age,
    archetype,
    development,
    tactics,
    discipline,
    communication,
    youthPatience,
    pressure,
    relationship: clamp(relationshipBase + random.integer(-7, 8)),
    summary: summaries[archetype],
  };
}

export function createTeamStaff(
  worldSeed: string,
  school: SchoolIdentity,
  position: FootballPosition,
  initialTrust: number,
): FootballTeamStaff {
  const root = new SeededRandom(worldSeed).fork("team-staff");
  return {
    headCoach: createCoach(root.fork("head"), `coach-${school.id}-head`, "head-coach", school, initialTrust - 4),
    positionCoach: createCoach(root.fork(`position-${position}`), `coach-${school.id}-${position.toLowerCase()}`, "position-coach", school, initialTrust + 5),
    offensiveCoordinator: createCoach(root.fork("oc"), `coach-${school.id}-oc`, "offensive-coordinator", school, initialTrust - 1),
    defensiveCoordinator: createCoach(root.fork("dc"), `coach-${school.id}-dc`, "defensive-coordinator", school, initialTrust - 1),
  };
}

function createRosterPlayer(
  worldSeed: string,
  school: SchoolIdentity,
  position: FootballRosterPosition,
  index: number,
): FootballRosterPlayer {
  const random = new SeededRandom(worldSeed).fork(`roster:${position}:${index}`);
  const year = random.pick(["Freshman", "Sophomore", "Junior", "Senior"] as const);
  const base = 51 + school.prestige * 0.22 + school.coaching * 0.08 + yearBonus(year);
  const overall = clamp(base + random.integer(-10, 12), 45, 91);
  const potential = clamp(overall + random.integer(2, 16) - Math.max(0, yearBonus(year)), overall, 96);
  const coachStanding = clamp(45 + overall * 0.38 + yearBonus(year) + random.integer(-10, 10));
  const health = clamp(92 + random.integer(-10, 8), 58, 100);
  const status: FootballRosterPlayer["status"] = health < 72
    ? "injured"
    : index === 0
      ? "starter"
      : index <= 2
        ? "rotation"
        : "backup";
  return {
    id: `player-${school.id}-${position.toLowerCase()}-${index}`,
    name: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
    position,
    unit: unitFor(position),
    year,
    overall,
    potential,
    style: random.pick(POSITION_STYLES[position]),
    coachStanding,
    health,
    status,
    depthRank: index + 1,
  };
}

function rankPositionRooms(roster: FootballRosterPlayer[]): FootballRosterPlayer[] {
  const positions = Object.keys(POSITION_COUNTS) as FootballRosterPosition[];
  const ranked = [...roster];
  for (const position of positions) {
    const room = ranked
      .filter((player) => player.position === position)
      .sort((left, right) => (right.overall * 0.72 + right.coachStanding * 0.28) - (left.overall * 0.72 + left.coachStanding * 0.28));
    room.forEach((player, index) => {
      player.depthRank = index + 1;
      player.status = player.health < 72 ? "injured" : index === 0 ? "starter" : index <= 2 ? "rotation" : "backup";
    });
  }
  return ranked;
}

export function createFootballRoster(
  worldSeed: string,
  school: SchoolIdentity,
  heroPosition: FootballPosition,
): FootballRosterPlayer[] {
  const roster: FootballRosterPlayer[] = [];
  for (const [positionKey, count] of Object.entries(POSITION_COUNTS)) {
    const position = positionKey as FootballRosterPosition;
    const npcCount = position === heroPosition ? Math.max(2, count - 1) : count;
    for (let index = 0; index < npcCount; index += 1) {
      roster.push(createRosterPlayer(worldSeed, school, position, index));
    }
  }
  return rankPositionRooms(roster);
}

export function createTeamDynamics(worldSeed: string, school: SchoolIdentity): TeamDynamics {
  const random = new SeededRandom(worldSeed).fork("team-dynamics");
  return {
    morale: clamp(61 + random.integer(-8, 12)),
    cohesion: clamp(58 + school.discipline * 0.18 + random.integer(-9, 10)),
    discipline: clamp(school.discipline + random.integer(-6, 7)),
    schemeMastery: clamp(52 + school.coaching * 0.23 + random.integer(-8, 9)),
  };
}

export function scoreRosterPlayer(player: FootballRosterPlayer): number {
  return player.overall * 0.72 + player.coachStanding * 0.2 + player.health * 0.08;
}

export function scoreHeroForDepthChart(
  ratings: FootballRatings,
  character: CharacterState,
  coachTrust: number,
): number {
  return ratings.overall * 0.62
    + coachTrust * 0.2
    + character.condition.health * 0.07
    + character.personality.discipline * 0.05
    + character.condition.confidence * 0.06
    - character.condition.fatigue * 0.06;
}
