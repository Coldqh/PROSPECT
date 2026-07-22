import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballCareerState, FootballPosition } from "../career/types";
import type {
  EcosystemCoach,
  EcosystemLevel,
  EcosystemPlayer,
  EcosystemConference,
  EcosystemPositionNeeds,
  EcosystemTeam,
  FootballEcosystemState,
} from "./types";
import { createPlayerEligibility, createTeamCompliance, createWorldConstitution, refreshTeamCompliance, resolveWorldCycle } from "./constitution";

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
    tenureYears: random.integer(0, role === "head-coach" ? 9 : 5),
    careerWins: random.integer(level === "college" ? 12 : 4, level === "college" ? 118 : 54),
    careerLosses: random.integer(level === "college" ? 8 : 3, level === "college" ? 82 : 42),
    previousTeamIds: [],
  };
}

function createGeneratedPlayer(
  team: EcosystemTeam,
  position: FootballPosition,
  depthRank: number,
  random: SeededRandom,
  seasonYear: number,
): EcosystemPlayer {
  const levelBoost = team.level === "college" ? 8 : 0;
  const classYear = random.pick(CLASS_YEARS);
  const classBoost = CLASS_YEARS.indexOf(classYear) * 2;
  const overall = clamp(team.rating - 10 + levelBoost + classBoost + random.integer(-9, 8), 45, 94);
  const potential = clamp(overall + random.integer(3, 18), overall, 98);
  const health = clamp(88 + random.integer(-13, 11));
  const form = clamp(56 + random.integer(-16, 21));
  const age = team.level === "college" ? random.integer(18, 22) : random.integer(15, 18);
  const eligibility = createPlayerEligibility(team.level, age, classYear, seasonYear, random.fork("eligibility"));
  return {
    id: `${team.id}-player-${position.toLowerCase()}-${depthRank}`,
    seed: `${team.seed}:${position}:${depthRank}`,
    name: fullName(random),
    teamId: team.id,
    level: team.level,
    age,
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
    eligibilityYears: team.level === "college" ? (eligibility.model === "age-based-five-year" ? Math.max(1, eligibility.windowEndYear - seasonYear + 1) : Math.max(1, 4 - CLASS_YEARS.indexOf(classYear))) : 4,
    seasonsPlayed: team.level === "college" ? CLASS_YEARS.indexOf(classYear) : 0,
    transferStatus: "none",
    previousTeamIds: [],
    isHero: false,
    eligibility,
  };
}

function createTeamPlayers(team: EcosystemTeam, random: SeededRandom, seasonYear: number): EcosystemPlayer[] {
  const players: EcosystemPlayer[] = [];
  for (const position of CORE_POSITIONS) {
    const roomSize = random.integer(1, team.level === "college" ? 3 : 2);
    for (let rank = 1; rank <= roomSize; rank += 1) {
      players.push(createGeneratedPlayer(team, position, rank, random.fork(`${position}-${rank}`), seasonYear));
    }
  }
  return players;
}

function createHeroTeamPlayers(
  team: EcosystemTeam,
  football: FootballCareerState,
  random: SeededRandom,
  seasonYear: number,
): EcosystemPlayer[] {
  const players: EcosystemPlayer[] = [];
  for (const position of CORE_POSITIONS) {
    const room = football.roster
      .filter((player) => player.position === position)
      .sort((left, right) => left.depthRank - right.depthRank)
      .slice(0, 2);
    if (room.length === 0) {
      players.push(createGeneratedPlayer(team, position, 1, random.fork(position), seasonYear));
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
        eligibilityYears: 4,
        seasonsPlayed: 0,
        transferStatus: "none",
        previousTeamIds: [],
        isHero: false,
        eligibility: createPlayerEligibility("high-school", player.year === "Senior" ? 18 : player.year === "Junior" ? 17 : player.year === "Sophomore" ? 16 : 15, player.year, seasonYear, random.fork(`eligibility:${player.id}`)),
      });
    });
  }
  players.push({
    id: "hero",
    seed: `${team.seed}:hero`,
    name: "PLAYER",
    teamId: team.id,
    level: "high-school",
    age: 17,
    classYear: "Senior",
    position: football.position,
    overall: football.ratings.overall,
    potential: Math.max(football.ratings.overall, football.ratings.overall + 8),
    health: football.training.body.readiness,
    form: football.depthChart.coachTrust,
    status: football.depthChart.rank === 1 ? "starter" : football.depthChart.rank === 2 ? "rotation" : "backup",
    depthRank: football.depthChart.rank,
    trajectory: football.depthChart.evaluation.trend === "rising" ? "surging" : football.depthChart.evaluation.trend === "falling" ? "slipping" : "steady",
    nationalRank: 9999,
    recruitingStage: football.recruitment.offers > 0 ? "offered" : football.recruitment.interestedPrograms > 0 ? "tracked" : "unranked",
    eligibilityYears: 4,
    seasonsPlayed: 0,
    transferStatus: "none",
    previousTeamIds: [],
    isHero: true,
    eligibility: createPlayerEligibility("high-school", 17, "Senior", seasonYear, random.fork("eligibility:hero")),
  });
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
      conferenceWins: 0,
      conferenceLosses: 0,
      streak: standing.streak,
      offenseStyle: opponent?.offenseStyle ?? random.pick(OFFENSE_STYLES),
      championships: 0,
      defenseStyle: opponent?.defenseStyle ?? random.pick(DEFENSE_STYLES),
      positionNeeds: createNeeds(random.fork("needs"), "high-school"),
      rosterIds: [],
      coachIds: [],
      compliance: createTeamCompliance({ level: "high-school", prestige: isHero ? football.school.prestige : clamp(standing.rating + random.integer(-10, 9)) }, 0, random.fork("compliance")),
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
      wins: 0,
      losses: 0,
      conferenceWins: 0,
      conferenceLosses: 0,
      streak: 0,
      offenseStyle: program.scheme,
      championships: 0,
      defenseStyle: random.pick(DEFENSE_STYLES),
      positionNeeds: {
        ...createNeeds(random.fork("needs"), "college"),
        [football.position]: program.positionNeed,
      },
      rosterIds: [],
      coachIds: [],
      compliance: createTeamCompliance({ level: "college", prestige: program.prestige }, 0, random.fork("compliance")),
      trend: "stable",
    };
  });
}

const CONFERENCE_CATALOG = [
  { id: "atlantic-crown", name: "Atlantic Crown Conference", shortName: "ACC", region: "Atlantic" },
  { id: "great-lakes-union", name: "Great Lakes Union", shortName: "GLU", region: "Great Lakes" },
  { id: "heartland-athletic", name: "Heartland Athletic Conference", shortName: "HAC", region: "Heartland" },
  { id: "frontier-pacific", name: "Frontier Pacific League", shortName: "FPL", region: "Frontier" },
] as const;

const STATE_CONFERENCE: Record<string, string> = {
  FL: "atlantic-crown", NC: "atlantic-crown", VA: "atlantic-crown", PA: "atlantic-crown", NY: "atlantic-crown",
  WI: "great-lakes-union", OH: "great-lakes-union", IN: "great-lakes-union", MI: "great-lakes-union",
  KS: "heartland-athletic", NE: "heartland-athletic", TX: "heartland-athletic", TN: "heartland-athletic", MO: "heartland-athletic",
  CA: "frontier-pacific", ID: "frontier-pacific", AZ: "frontier-pacific", CO: "frontier-pacific",
};

export function assignCollegeConferences(teams: EcosystemTeam[]): { teams: EcosystemTeam[]; conferences: EcosystemConference[] } {
  const collegeTeams = teams.filter((team) => team.level === "college");
  const allocations = new Map<string, string[]>(CONFERENCE_CATALOG.map((item) => [item.id, [] as string[]]));
  const ordered = [...collegeTeams].sort((left, right) => right.prestige - left.prestige || left.id.localeCompare(right.id));
  for (const team of ordered) {
    const preferred = STATE_CONFERENCE[team.stateCode] ?? CONFERENCE_CATALOG[0].id;
    const preferredMembers = allocations.get(preferred) ?? [];
    const target = preferredMembers.length < 6
      ? preferred
      : [...allocations.entries()].sort((left, right) => left[1].length - right[1].length)[0]?.[0] ?? preferred;
    allocations.get(target)?.push(team.id);
  }
  const conferences: EcosystemConference[] = CONFERENCE_CATALOG.map((item) => {
    const teamIds = allocations.get(item.id) ?? [];
    const members = collegeTeams.filter((team) => teamIds.includes(team.id));
    return {
      ...item,
      prestige: clamp(members.reduce((sum, team) => sum + team.prestige, 0) / Math.max(1, members.length)),
      teamIds,
      champions: [],
    };
  });
  const conferenceByTeam = new Map(conferences.flatMap((conference) => conference.teamIds.map((teamId) => [teamId, conference.id] as const)));
  return {
    teams: teams.map((team) => {
      if (team.level !== "college") return team;
      const conferenceId = conferenceByTeam.get(team.id);
      return conferenceId ? { ...team, conferenceId } : team;
    }),
    conferences,
  };
}

function calculateMarket(players: EcosystemPlayer[], coaches: EcosystemCoach[], teams: EcosystemTeam[]) {
  const seniors = players.filter((player) => player.level === "high-school" && player.classYear === "Senior");
  return {
    openScholarships: teams.filter((team) => team.level === "college").reduce((sum, team) => sum + Math.max(0, team.compliance.fundedScholarships - team.compliance.scholarshipsUsed), 0),
    activeRecruitments: seniors.filter((player) => player.recruitingStage === "tracked" || player.recruitingStage === "offered").length,
    committedPlayers: seniors.filter((player) => player.recruitingStage === "committed").length,
    coachingHotSeats: coaches.filter((coach) => coach.status === "hot-seat").length,
    portalPlayers: players.filter((player) => player.transferStatus === "portal").length,
    coachOpenings: 0,
  };
}

export function createFootballEcosystem(
  worldSeed: string,
  character: CharacterState,
  football: FootballCareerState,
  currentDate: GameDate,
  completedDays = 0,
): FootballEcosystemState {
  const constitution = createWorldConstitution();
  const cycle = resolveWorldCycle(currentDate);
  const initialTeams = [...createHighSchoolTeams(football), ...createCollegeTeams(football)];
  const conferenceSetup = assignCollegeConferences(initialTeams);
  const teams = conferenceSetup.teams;
  const players: EcosystemPlayer[] = [];
  const coaches: EcosystemCoach[] = [];

  for (const team of teams) {
    const random = new SeededRandom(`${worldSeed}:ecosystem:${team.id}`);
    const isHeroTeam = team.id === football.school.id;
    const teamPlayers = isHeroTeam
      ? createHeroTeamPlayers(team, football, random.fork("players"), cycle.seasonYear).map((player) => player.isHero ? { ...player, name: character.identity.fullName, age: character.identity.age, overall: football.ratings.overall, potential: Math.max(football.ratings.overall, football.ratings.overall + 8), nationalRank: football.ratings.overall >= 82 ? 120 : football.ratings.overall >= 74 ? 420 : 1100 } : player)
      : createTeamPlayers(team, random.fork("players"), cycle.seasonYear);
    const headCoach = createCoach(
      team.id,
      "head-coach",
      team.level,
      random.fork("head-coach"),
      isHeroTeam ? football.staff.headCoach.name : undefined,
    );
    const coordinator = createCoach(team.id, "coordinator", team.level, random.fork("coordinator"));
    team.rosterIds = teamPlayers.map((player) => player.id);
    team.compliance = refreshTeamCompliance(team, teamPlayers, random.fork("compliance-final"), constitution);
    team.coachIds = [headCoach.id, coordinator.id];
    players.push(...teamPlayers);
    coaches.push(headCoach, coordinator);
  }

  const heroContext = `${character.identity.fullName} входит в сезон как ${football.position}, но рынок уже движется без него.`;
  return {
    moduleVersion: 3,
    constitution,
    cycle,
    lastSimulatedDay: completedDays,
    currentWeek: Math.max(1, football.season.week),
    lastUpdatedOn: currentDate,
    seasonYear: cycle.seasonYear,
    seasonWeek: Math.max(1, Math.min(10, football.season.week)),
    phase: "regular-season",
    lastOffseasonYear: cycle.seasonYear - 1,
    conferences: conferenceSetup.conferences,
    teams,
    players,
    coaches,
    stories: [],
    digest: [
      heroContext,
      `${teams.filter((team) => team.level === "college").length} колледжей одновременно следят за рынком и закрывают собственные потребности.`,
      `${players.filter((player) => player.level === "high-school" && player.classYear === "Senior").length} выпускников конкурируют за предложения.`,
    ],
    market: calculateMarket(players, coaches, teams),
    teamHistory: [],
    transactions: [],
  };
}
