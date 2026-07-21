import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { SchoolIdentity } from "../career/types";
import type { MatchStatLine } from "../matches/types";
import type {
  FootballSeasonState,
  SeasonOpponentProfile,
  SeasonScheduleGame,
  SeasonStanding,
  SeasonTeamLeader,
} from "./types";

const PREFIXES = ["North Ridge", "Westlake", "Central", "East Harbor", "Pine Valley", "Redwood", "Lakeside", "South County", "Cedar Grove", "Ironwood", "Mesa Ridge", "River City"] as const;
const MASCOTS = ["Wolves", "Panthers", "Ravens", "Knights", "Bulls", "Falcons", "Tigers", "Warriors", "Hawks", "Mustangs", "Spartans", "Sharks"] as const;
const OFFENSES = ["spread tempo", "power run", "vertical passing", "option attack", "balanced pro-style", "quick-game spread"] as const;
const DEFENSES = ["aggressive man coverage", "two-high zone", "pressure front", "gap-control front", "hybrid nickel", "disciplined quarters"] as const;
const STRENGTHS = ["explosive perimeter speed", "physical offensive line", "experienced secondary", "deep pass rush", "disciplined tackling", "mobile quarterback"] as const;
const WEAKNESSES = ["thin defensive rotation", "slow linebackers in space", "young offensive line", "poor red-zone execution", "inconsistent deep coverage", "turnover-prone quarterback"] as const;
const KEY_POSITIONS = ["QB", "RB", "WR", "EDGE", "LB", "CB", "S"] as const;
const FIRST_NAMES = ["Andre", "Miles", "Jalen", "Chris", "Noah", "Trey", "Isaiah", "Damon", "Eli", "Marcus"] as const;
const LAST_NAMES = ["Coleman", "Bennett", "Price", "Grant", "Wells", "Foster", "Simmons", "Ward", "Parker", "Hughes"] as const;

export function emptyMatchStats(): MatchStatLine {
  return {
    passingAttempts: 0,
    completions: 0,
    passingYards: 0,
    rushingAttempts: 0,
    rushingYards: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    touchdowns: 0,
    turnovers: 0,
    tackles: 0,
    tacklesForLoss: 0,
    sacks: 0,
    passBreakups: 0,
    interceptions: 0,
  };
}

function addDays(date: GameDate, days: number): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}

function uniqueOpponent(random: SeededRandom, used: Set<string>, stateCode: string, week: number): SeasonOpponentProfile {
  let name = "";
  let prefix = "";
  let mascot = "";
  do {
    prefix = random.pick(PREFIXES);
    mascot = random.pick(MASCOTS);
    name = `${prefix} ${mascot}`;
  } while (used.has(name));
  used.add(name);
  const rating = random.integer(62, 88);
  const keyPosition = random.pick(KEY_POSITIONS);
  return {
    id: `opp-${week}-${slug(name)}`,
    name,
    shortName: prefix.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
    mascot,
    city: prefix,
    stateCode,
    rating,
    offenseStyle: random.pick(OFFENSES),
    defenseStyle: random.pick(DEFENSES),
    strength: random.pick(STRENGTHS),
    weakness: random.pick(WEAKNESSES),
    keyPlayer: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)} · ${keyPosition} · ${random.integer(Math.max(68, rating - 4), Math.min(94, rating + 7))} OVR`,
    scoutConfidence: random.integer(55, 92),
  };
}

function createLeaders(worldSeed: string): SeasonTeamLeader[] {
  const random = new SeededRandom(`${worldSeed}:season-leaders`);
  const categories = [
    ["Пас", "QB", `${random.integer(980, 1550)} YDS`],
    ["Вынос", "RB", `${random.integer(520, 930)} YDS`],
    ["Приём", "WR", `${random.integer(410, 820)} YDS`],
    ["Захваты", "LB", `${random.integer(54, 91)} TKL`],
  ] as const;
  return categories.map(([category, position, value], index) => ({
    id: `leader-${index}`,
    name: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
    position,
    category,
    value,
  }));
}

export function generateHighSchoolSeason(
  worldSeed: string,
  school: SchoolIdentity,
  currentDate: GameDate,
): FootballSeasonState {
  const random = new SeededRandom(`${worldSeed}:season:2026`);
  const used = new Set<string>([school.name]);
  const opponents = Array.from({ length: 8 }, (_, index) => uniqueOpponent(random.fork(`opponent-${index + 1}`), used, school.stateCode, index + 1));
  const daysUntilSaturday = (6 - new Date(Date.UTC(currentDate.year, currentDate.month - 1, currentDate.day)).getUTCDay() + 7) % 7;
  const firstSaturday = addDays(currentDate, daysUntilSaturday);
  const schedule: SeasonScheduleGame[] = opponents.map((opponent, index) => ({
    id: `season-game-${index + 1}-${opponent.id}`,
    week: index + 1,
    date: addDays(firstSaturday, index * 7),
    home: index % 2 === 0,
    opponentId: opponent.id,
    opponentName: opponent.name,
    opponentShortName: opponent.shortName,
    opponentRating: opponent.rating,
    status: "scheduled",
  }));
  const standings: SeasonStanding[] = [
    {
      teamId: school.id,
      name: `${school.shortName} ${school.mascot}`,
      shortName: school.shortName.slice(0, 3).toUpperCase(),
      rating: Math.round((school.prestige + school.coaching + school.facilities) / 3),
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      isHeroTeam: true,
    },
    ...opponents.map((opponent) => ({
      teamId: opponent.id,
      name: opponent.name,
      shortName: opponent.shortName,
      rating: opponent.rating,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      isHeroTeam: false,
    })),
  ];
  const first = opponents[0];
  if (!first) throw new Error("Season requires at least one opponent");
  return {
    year: 2026,
    phase: "regular-season",
    week: 0,
    wins: 0,
    losses: 0,
    nextOpponent: {
      id: first.id,
      name: first.name,
      record: "0–0",
      threat: first.defenseStyle,
    },
    totalWeeks: schedule.length,
    opponents,
    schedule,
    standings,
    heroTotals: emptyMatchStats(),
    awards: [],
    teamLeaders: createLeaders(worldSeed),
  };
}
