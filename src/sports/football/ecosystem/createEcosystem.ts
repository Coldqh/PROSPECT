import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballCareerState, FootballPosition } from "../career/types";
import type {
  EcosystemCoach,
  EcosystemLevel,
  EcosystemPlayer,
  EcosystemPositionNeeds,
  EcosystemTeam,
  FootballEcosystemState,
} from "./types";

const FIRST_NAMES = [
  "Andre", "Cam", "Dylan", "Elijah", "Isaiah", "Jalen", "Jordan", "Malik", "Micah", "Noah",
  "Quincy", "Rashad", "Trey", "Xavier", "Zion", "Cole", "Bryce", "Damon", "Keon", "Miles",
] as const;
const LAST_NAMES = [
  "Anderson", "Bennett", "Brooks", "Carter", "Coleman", "Davis", "Foster", "Grant", "Hall", "Harris",
  "Jackson", "Lewis", "Mitchell", "Moore", "Parker", "Reed", "Robinson", "Turner", "Walker", "Young",
] as const;
const COACH_FIRST_NAMES = ["Aaron", "Caleb", "Derek", "Eric", "Frank", "Grant", "Henry", "Marcus", "Ray", "Victor"] as const;
const COACH_LAST_NAMES = ["Bishop", "Caldwell", "Dunn", "Fletcher", "Holloway", "McBride", "Porter", "Sloan", "Walsh", "Webb"] as const;
const OFFENSE_STYLES = ["Air raid", "Spread option", "Power run", "West coast", "Multiple"] as const;
const DEFENSE_STYLES = ["4-2-5 pressure", "3-4 multiple", "4-3 quarters", "Nickel match", "Man pressure"] as const;
const PHILOSOPHIES = [
  "Развитие через конкуренцию",
  "Старшие игроки получают первый шанс",
  "Схема важнее громких имён",
  "Высокий темп и глубокая ротация",
  "Жёсткая дисциплина и контроль ошибок",
] as const;
const CORE_POSITIONS = ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[];
const CLASS_YEARS = ["Freshman", "Sophomore", "Junior", "Senior"] as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fullName(random: SeededRandom): string {
  return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
}

function coachName(random: SeededRandom): string {
  return `${random.pick(COACH_FIRST_NAMES)} ${random.pick(COACH_LAST_NAMES)}`;
}

function createNeeds(random: SeededRandom, level: EcosystemLevel): EcosystemPositionNeeds {
  const floor = level === "college" ? 22 : 16;
  return {
    QB: random.integer(floor, 88),
    RB: random.integer(floor, 88),
    WR: random.integer(floor, 88),
    LB: random.integer(floor, 88),
    CB: random.integer(floor, 88),
  };
}

function createCoach(
  teamId: string,
  role: EcosystemCoach["role"],
  level: EcosystemLevel,
  random: SeededRandom,
  forcedName?: string,
): EcosystemCoach {
  const reputation = clamp((level === "college" ? 58 : 45) + random.integer(-14, 24));
  const jobSecurity = clamp(66 + random.integer(-18, 24));
  const pressure = clamp(100 - jobSecurity + random.integer(-8, 12));
  return {
    id: `${teamId}-${role}`,
    seed: `${teamId}:${role}`,
    name: forcedName ?? coachName(random),
    teamId,
    role,
    age: random.integer(role === "head-coach" ? 35 : 29, 67),
    reputation,
    development: clamp(reputation + random.integer(-16, 16)),
    recruiting: clamp(reputation + random.integer(-18, 18)),
    pressure,
    jobSecurity,
    status: jobSecurity < 35 ? "hot-seat" : jobSecurity < 55 ? "watched" : "secure",
    philosophy: random.pick(PHILOSOPHIES),
  };
}

function createGeneratedPlayer(
  team: EcosystemTeam,
  position: FootballPosition,
  depthRank: number,
  random: SeededRandom,
): EcosystemPlayer {
  const levelBoost = team.level === "college" ? 8 : 0;
  const classYear = random.pick(CLASS_YEARS);
  const classBoost = CLASS_YEARS.indexOf(classYear) * 2;
  const overall = clamp(team.rating - 10 + levelBoost + classBoost + random.integer(-9, 8), 45, 94);
  const potential = clamp(overall + random.integer(3, 18), overall, 98);
  const health = clamp(88 + random.integer(-13, 11));
  const form = clamp(56 + random.integer(-16, 21));
  return {
    id: `${team.id}-player-${position.toLowerCase()}-${depthRank}`,
    seed: `${team.seed}:${position}:${depthRank}`,
    name: fullName(random),
    teamId: team.id,
    level: team.level,
    age: team.level === "college" ? random.integer(18, 22) : random.integer(15, 18),
    classYear,
    position,
    overall,
    potential,
    health,
    form,
    status: health < 62 ? "injured" : depthRank === 1 ? "starter" : depthRank === 2 ? "rotation" : "backup",
    depthRank,
    trajectory: form >= 72 ? "surging" : form <= 42 ? "slipping" : "steady",
    nationalRank: team.level === "high-school" ? random.integer(75, 1800) : random.integer(1, 9999),
    recruitingStage: team.level === "high-school" && classYear === "Senior"
      ? random.pick(["tracked", "tracked", "offered", "unranked"] as const)
      : "unranked",
  };
}

function createTeamPlayers(team: EcosystemTeam, random: SeededRandom): EcosystemPlayer[] {
  const players: EcosystemPlayer[] = [];
  for (const position of CORE_POSITIONS) {
    const roomSize = random.integer(1, team.level === "college" ? 3 : 2);
    for (let rank = 1; rank <= roomSize; rank += 1) {
      players.push(createGeneratedPlayer(team, position, rank, random.fork(`${position}-${rank}`)));
    }
  }
  return players;
}

function createHeroTeamPlayers(
  team: EcosystemTeam,
  football: FootballCareerState,
  random: SeededRandom,
): EcosystemPlayer[] {
  const players: EcosystemPlayer[] = [];
  for (const position of CORE_POSITIONS) {
    const room = football.roster
      .filter((player) => player.position === position)
      .sort((left, right) => left.depthRank - right.depthRank)
      .slice(0, 2);
    if (room.length === 0) {
      players.push(createGeneratedPlayer(team, position, 1, random.fork(position)));
      continue;
    }
    room.forEach((player, index) => {
      players.push({
        id: player.id,
        seed: `${team.seed}:${player.id}`,
        name: player.name,
        teamId: team.id,
        level: "high-school",
        age: player.year === "Senior" ? 18 : player.year === "Junior" ? 17 : player.year === "Sophomore" ? 16 : 15,
        classYear: player.year,
        position,
        overall: player.overall,
        potential: player.potential,
        health: player.health,
        form: clamp(player.coachStanding),
        status: player.status,
        depthRank: index + 1,
        trajectory: player.coachStanding >= 72 ? "surging" : player.coachStanding <= 42 ? "slipping" : "steady",
        nationalRank: random.integer(90, 1500),
        recruitingStage: player.year === "Senior" ? random.pick(["tracked", "offered", "unranked"] as const) : "unranked",
      });
    });
  }
  return players;
}

function createHighSchoolTeams(football: FootballCareerState): EcosystemTeam[] {
  return football.season.standings.map((standing) => {
    const opponent = football.season.opponents.find((item) => item.id === standing.teamId);
    const isHero = standing.isHeroTeam;
    const random = new SeededRandom(`${football.worldSeed}:ecosystem:team:${standing.teamId}`);
    return {
      id: standing.teamId,
      seed: `${football.worldSeed}:${standing.teamId}`,
      name: isHero ? football.school.name : standing.name,
      shortName: isHero ? football.school.shortName : standing.shortName,
      level: "high-school",
      stateCode: isHero ? football.school.stateCode : opponent?.stateCode ?? football.school.stateCode,
      prestige: isHero ? football.school.prestige : clamp(standing.rating + random.integer(-10, 9)),
      rating: standing.rating,
      expectation: clamp(standing.rating + random.integer(-7, 10)),
      wins: standing.wins,
      losses: standing.losses,
      streak: standing.streak,
      offenseStyle: opponent?.offenseStyle ?? random.pick(OFFENSE_STYLES),
      defenseStyle: opponent?.defenseStyle ?? random.pick(DEFENSE_STYLES),
      positionNeeds: createNeeds(random.fork("needs"), "high-school"),
      rosterIds: [],
      coachIds: [],
      trend: standing.streak >= 2 ? "rising" : standing.streak <= -2 ? "falling" : "stable",
    };
  });
}

function createCollegeTeams(football: FootballCareerState): EcosystemTeam[] {
  return football.recruitment.programs.map((program) => {
    const random = new SeededRandom(`${football.worldSeed}:ecosystem:college:${program.id}`);
    return {
      id: program.id,
      seed: program.seed,
      name: program.name,
      shortName: program.shortName,
      level: "college",
      stateCode: program.stateCode,
      prestige: program.prestige,
      rating: clamp(program.prestige * 0.5 + program.conferenceLevel * 0.28 + program.facilities * 0.12 + random.integer(-6, 6)),
      expectation: clamp(program.prestige + random.integer(-5, 12)),
      wins: random.integer(0, 2),
      losses: random.integer(0, 2),
      streak: 0,
      offenseStyle: program.scheme,
      defenseStyle: random.pick(DEFENSE_STYLES),
      positionNeeds: {
        ...createNeeds(random.fork("needs"), "college"),
        [football.position]: program.positionNeed,
      },
      rosterIds: [],
      coachIds: [],
      trend: "stable",
    };
  });
}

function calculateMarket(players: EcosystemPlayer[], coaches: EcosystemCoach[]) {
  const seniors = players.filter((player) => player.level === "high-school" && player.classYear === "Senior");
  return {
    openScholarships: Math.max(0, 240 - seniors.filter((player) => player.recruitingStage === "committed").length),
    activeRecruitments: seniors.filter((player) => player.recruitingStage === "tracked" || player.recruitingStage === "offered").length,
    committedPlayers: seniors.filter((player) => player.recruitingStage === "committed").length,
    coachingHotSeats: coaches.filter((coach) => coach.status === "hot-seat").length,
  };
}

export function createFootballEcosystem(
  worldSeed: string,
  character: CharacterState,
  football: FootballCareerState,
  currentDate: GameDate,
  completedDays = 0,
): FootballEcosystemState {
  const teams = [...createHighSchoolTeams(football), ...createCollegeTeams(football)];
  const players: EcosystemPlayer[] = [];
  const coaches: EcosystemCoach[] = [];

  for (const team of teams) {
    const random = new SeededRandom(`${worldSeed}:ecosystem:${team.id}`);
    const isHeroTeam = team.id === football.school.id;
    const teamPlayers = isHeroTeam
      ? createHeroTeamPlayers(team, football, random.fork("players"))
      : createTeamPlayers(team, random.fork("players"));
    const headCoach = createCoach(
      team.id,
      "head-coach",
      team.level,
      random.fork("head-coach"),
      isHeroTeam ? football.staff.headCoach.name : undefined,
    );
    const coordinator = createCoach(team.id, "coordinator", team.level, random.fork("coordinator"));
    team.rosterIds = teamPlayers.map((player) => player.id);
    team.coachIds = [headCoach.id, coordinator.id];
    players.push(...teamPlayers);
    coaches.push(headCoach, coordinator);
  }

  const heroContext = `${character.identity.fullName} входит в сезон как ${football.position}, но рынок уже движется без него.`;
  return {
    moduleVersion: 1,
    lastSimulatedDay: completedDays,
    currentWeek: Math.max(1, football.season.week),
    lastUpdatedOn: currentDate,
    teams,
    players,
    coaches,
    stories: [],
    digest: [
      heroContext,
      `${teams.filter((team) => team.level === "college").length} колледжей одновременно следят за рынком и закрывают собственные потребности.`,
      `${players.filter((player) => player.level === "high-school" && player.classYear === "Senior").length} выпускников конкурируют за предложения.`,
    ],
    market: calculateMarket(players, coaches),
  };
}
