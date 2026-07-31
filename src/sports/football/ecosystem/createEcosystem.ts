import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballCareerState } from "../career/types";
import { FOOTBALL_ROSTER_POSITIONS, POSITION_ROOM_TARGETS, POSITION_STARTER_TARGETS, normalizeLegacyRosterPosition } from "../team/positions";
import type { FootballRosterPosition } from "../team/types";
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
import { createProgramResources } from "./resources";
import { createTalentPipeline, createTalentProfile } from "./talent";
import { createEmptyRosterPlan, reviewRosterManagement } from "./rosterManagement";
import { createUnifiedMovementMarket } from "./movementMarket";
import { careerArchetypeRole, createPlayerTacticalProfile, createTacticalIdentity } from "./tactics";
import { createCompetitionState } from "./competition";
import { createSocialEcosystem } from "./social";
import { createCareerRegistry } from "./lifecycle";
import { createWorldHistory } from "./history";
import { createAgencyState } from "./agency";

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
const CORE_POSITIONS = FOOTBALL_ROSTER_POSITIONS;
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
  return Object.fromEntries(
    CORE_POSITIONS.map((position) => [position, random.integer(floor, 88)]),
  ) as EcosystemPositionNeeds;
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
    tactics: clamp(reputation + random.integer(-12, 18)),
    adaptability: clamp(56 + random.integer(-16, 26)),
    gameManagement: clamp(58 + random.integer(-16, 24)),
    temperament: random.pick(["calm", "demanding", "volatile", "player-first"] as const),
    offenseSystem: random.pick(["air-raid", "west-coast", "power-run", "spread-option", "multiple"] as const),
    defenseSystem: random.pick(["quarters-425", "multiple-34", "over-43", "nickel-match", "man-pressure", "multiple-defense"] as const),
    specialtyPositions: role === "offensive-coordinator"
      ? ["QB", "WR", "RB"]
      : role === "defensive-coordinator"
        ? ["EDGE", "LB", "CB"]
        : role === "position-coach"
          ? [random.pick(FOOTBALL_ROSTER_POSITIONS)]
          : ["QB", "LB"],
    contractYears: random.integer(1, role === "head-coach" ? 6 : 4),
    annualSalary: Math.round((level === "college" ? 650_000 : 70_000) * (role === "head-coach" ? 4.2 : role === "position-coach" ? .75 : 1.6) * (.7 + reputation / 100)),
    tenureYears: random.integer(0, role === "head-coach" ? 9 : 5),
    careerWins: random.integer(level === "college" ? 12 : 4, level === "college" ? 118 : 54),
    careerLosses: random.integer(level === "college" ? 8 : 3, level === "college" ? 82 : 42),
    previousTeamIds: [],
  };
}

function createGeneratedPlayer(
  team: EcosystemTeam,
  position: FootballRosterPosition,
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
  const talent = createTalentProfile({ level: team.level, classYear, overall, potential, nationalRank: team.level === "high-school" ? 900 : 9999, isHero: false }, team.stateCode, seasonYear, random.fork("talent"));
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
    status: health < 62 ? "injured" : depthRank <= POSITION_STARTER_TARGETS[position] ? "starter" : depthRank <= POSITION_STARTER_TARGETS[position] + 2 ? "rotation" : "backup",
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
    talent,
    usagePlan: depthRank <= POSITION_STARTER_TARGETS[position] ? "starter" : depthRank <= POSITION_STARTER_TARGETS[position] + 2 ? "rotation" : "developmental",
    positionHistory: [],
    tactical: createPlayerTacticalProfile({ seed: `${team.seed}:${position}:${depthRank}`, position, overall, potential, classYear }, team.tactical, random.fork("tactical")),
  };
}

function createTeamPlayers(team: EcosystemTeam, random: SeededRandom, seasonYear: number): EcosystemPlayer[] {
  const players: EcosystemPlayer[] = [];
  for (const position of CORE_POSITIONS) {
    const roomSize = POSITION_ROOM_TARGETS[team.level][position];
    for (let rank = 1; rank <= roomSize; rank += 1) {
      players.push(createGeneratedPlayer(team, position, rank, random.fork(`${position}-${rank}`), seasonYear));
    }
  }
  return players;
}

function normalizePositionRoomDepth(players: EcosystemPlayer[]): EcosystemPlayer[] {
  const normalized = new Map<string, EcosystemPlayer>();
  for (const position of CORE_POSITIONS) {
    const room = players
      .filter((player) => player.position === position)
      .sort((left, right) => left.depthRank - right.depthRank || Number(right.isHero) - Number(left.isHero) || right.overall - left.overall || left.id.localeCompare(right.id));
    for (const [index, player] of room.entries()) {
      const depthRank = index + 1;
      const starterCount = POSITION_STARTER_TARGETS[position];
      normalized.set(player.id, {
        ...player,
        depthRank,
        status: player.health < 62 ? "injured" : depthRank <= starterCount ? "starter" : depthRank <= starterCount + 2 ? "rotation" : "backup",
        usagePlan: depthRank <= starterCount ? "starter" : depthRank <= starterCount + 2 ? "rotation" : player.usagePlan === "redshirt" ? "redshirt" : "developmental",
      });
    }
  }
  return players.map((player) => normalized.get(player.id) ?? player);
}

function createHeroTeamPlayers(
  team: EcosystemTeam,
  football: FootballCareerState,
  random: SeededRandom,
  seasonYear: number,
): EcosystemPlayer[] {
  const players: EcosystemPlayer[] = football.roster.map((player, index) => {
    const position = normalizeLegacyRosterPosition(player.position, player.id);
    const age = player.year === "Senior" ? 18 : player.year === "Junior" ? 17 : player.year === "Sophomore" ? 16 : 15;
    const nationalRank = random.fork(`rank:${player.id}`).integer(90, 2200);
    return {
      id: player.id,
      seed: `${team.seed}:${player.id}`,
      name: player.name,
      teamId: team.id,
      level: "high-school",
      age,
      classYear: player.year,
      position,
      overall: player.overall,
      potential: player.potential,
      health: player.health,
      form: clamp(player.coachStanding),
      status: player.status,
      depthRank: player.depthRank,
      trajectory: player.coachStanding >= 72 ? "surging" : player.coachStanding <= 42 ? "slipping" : "steady",
      nationalRank,
      recruitingStage: player.year === "Senior" ? random.fork(`recruiting:${player.id}`).pick(["tracked", "offered", "unranked"] as const) : "unranked",
      eligibilityYears: 4,
      seasonsPlayed: 0,
      transferStatus: "none",
      previousTeamIds: [],
      isHero: false,
      eligibility: createPlayerEligibility("high-school", age, player.year, seasonYear, random.fork(`eligibility:${player.id}`)),
      talent: createTalentProfile({ level: "high-school", classYear: player.year, overall: player.overall, potential: player.potential, nationalRank, isHero: false }, team.stateCode, seasonYear, random.fork(`talent:${player.id}`)),
      usagePlan: player.depthRank === 1 ? "starter" : player.depthRank <= 2 ? "rotation" : index % 4 === 0 ? "special-teams" : "developmental",
      positionHistory: [],
      tactical: createPlayerTacticalProfile({ seed: `${team.seed}:${player.id}`, position, overall: player.overall, potential: player.potential, classYear: player.year }, team.tactical, random.fork(`tactical:${player.id}`)),
    };
  });

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
    talent: createTalentProfile({ level: "high-school", classYear: "Senior", overall: football.ratings.overall, potential: Math.max(football.ratings.overall, football.ratings.overall + 8), nationalRank: 9999, isHero: true }, team.stateCode, seasonYear, random.fork("talent:hero")),
    usagePlan: football.depthChart.rank === 1 ? "starter" : football.depthChart.rank === 2 ? "rotation" : "developmental",
    positionHistory: [],
    tactical: createPlayerTacticalProfile({ seed: `${team.seed}:hero`, position: football.position, overall: football.ratings.overall, potential: Math.max(football.ratings.overall, football.ratings.overall + 8), classYear: "Senior" }, team.tactical, random.fork("tactical:hero"), careerArchetypeRole(football.position, football.archetypeId)),
  });
  return normalizePositionRoomDepth(players);
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
      resources: createProgramResources({ level: "high-school", prestige: isHero ? football.school.prestige : clamp(standing.rating + random.integer(-10, 9)), offenseStyle: opponent?.offenseStyle ?? random.pick(OFFENSE_STYLES), defenseStyle: opponent?.defenseStyle ?? random.pick(DEFENSE_STYLES) }, random.fork("resources"), 2026),
      rosterPlan: createEmptyRosterPlan({ level: "high-school", compliance: createTeamCompliance({ level: "high-school", prestige: isHero ? football.school.prestige : standing.rating }, 0, random.fork("plan-compliance")), positionNeeds: createNeeds(random.fork("plan-needs"), "high-school") }, 2026),
      tactical: createTacticalIdentity({ seed: `${football.worldSeed}:${standing.teamId}`, offenseStyle: opponent?.offenseStyle ?? random.pick(OFFENSE_STYLES), defenseStyle: opponent?.defenseStyle ?? random.pick(DEFENSE_STYLES), level: "high-school", prestige: isHero ? football.school.prestige : clamp(standing.rating + random.integer(-10, 9)) }, undefined, random.fork("tactical")),
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
      resources: createProgramResources({ level: "college", prestige: program.prestige, offenseStyle: program.scheme, defenseStyle: random.pick(DEFENSE_STYLES) }, random.fork("resources"), 2026),
      rosterPlan: createEmptyRosterPlan({ level: "college", compliance: createTeamCompliance({ level: "college", prestige: program.prestige }, 0, random.fork("plan-compliance")), positionNeeds: { ...createNeeds(random.fork("plan-needs"), "college"), [football.position]: program.positionNeed } }, 2026),
      tactical: createTacticalIdentity({ seed: program.seed, offenseStyle: program.scheme, defenseStyle: random.pick(DEFENSE_STYLES), level: "college", prestige: program.prestige }, undefined, random.fork("tactical")),
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

export function assignCollegeConferences<T extends Pick<EcosystemTeam, "id" | "level" | "prestige" | "stateCode">>(teams: T[]): { teams: T[]; conferences: EcosystemConference[] } {
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

function calculateMarket(players: EcosystemPlayer[], coaches: EcosystemCoach[], teams: EcosystemTeam[], talentPipeline: FootballEcosystemState["talentPipeline"]) {
  const seniors = players.filter((player) => player.level === "high-school" && player.classYear === "Senior");
  const collegeTeams = teams.filter((team) => team.level === "college");
  return {
    openScholarships: collegeTeams.reduce((sum, team) => sum + Math.max(0, team.compliance.fundedScholarships - team.compliance.scholarshipsUsed), 0),
    activeRecruitments: seniors.filter((player) => player.recruitingStage === "tracked" || player.recruitingStage === "offered").length,
    committedPlayers: seniors.filter((player) => player.recruitingStage === "committed").length,
    coachingHotSeats: coaches.filter((coach) => coach.status === "hot-seat").length,
    portalPlayers: players.filter((player) => player.transferStatus === "portal").length,
    coachOpenings: 0,
    totalRecruitingBudget: Math.round(collegeTeams.reduce((sum, team) => sum + team.resources.recruitingBudget, 0) * 100) / 100,
    totalNilCapacity: Math.round(collegeTeams.reduce((sum, team) => sum + team.resources.nilCapacity, 0) * 100) / 100,
    programsUnderFinancialPressure: collegeTeams.filter((team) => team.resources.financialPressure >= 65).length,
    annualProspects: players.filter((player) => player.level === "high-school" && player.talent.graduationYear >= talentPipeline.generationYear).length,
    jucoProspects: talentPipeline.independentProspects.filter((prospect) => prospect.route === "juco").length,
    walkOnProspects: talentPipeline.independentProspects.filter((prospect) => prospect.route === "walk-on").length,
    nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    plannedClassSpots: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.targetClassSize, 0),
    developmentalPlayers: players.filter((player) => player.usagePlan === "developmental" || player.usagePlan === "redshirt").length,
    plannedPositionChanges: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.positionChanges.filter((change) => !change.applied).length, 0),
    activeNegotiations: 0,
    withdrawnOffers: 0,
    transferCandidates: players.filter((player) => player.level === "college" && player.depthRank >= 3 && player.eligibilityYears > 1).length,
    lowSchemeFitPlayers: players.filter((player) => player.level === "college" && player.tactical.schemeFit < 55).length,
    programsInstallingNewSystems: collegeTeams.filter((team) => team.tactical.installation < 58 || team.tactical.continuity < 48).length,
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
  let teams = conferenceSetup.teams;
  let players: EcosystemPlayer[] = [];
  const coaches: EcosystemCoach[] = [];

  for (const team of teams) {
    const random = new SeededRandom(`${worldSeed}:ecosystem:${team.id}`);
    const isHeroTeam = team.id === football.school.id;
    const headCoach = createCoach(
      team.id,
      "head-coach",
      team.level,
      random.fork("head-coach"),
      isHeroTeam ? football.staff.headCoach.name : undefined,
    );
    const offensiveCoordinator = createCoach(team.id, "offensive-coordinator", team.level, random.fork("offensive-coordinator"));
    const defensiveCoordinator = createCoach(team.id, "defensive-coordinator", team.level, random.fork("defensive-coordinator"));
    const positionCoach = createCoach(team.id, "position-coach", team.level, random.fork("position-coach"));
    const staff = [headCoach, offensiveCoordinator, defensiveCoordinator, positionCoach];
    team.tactical = createTacticalIdentity(team, headCoach, random.fork("tactical-final"), staff);
    const teamPlayers = isHeroTeam
      ? createHeroTeamPlayers(team, football, random.fork("players"), cycle.seasonYear).map((player) => player.isHero ? { ...player, name: character.identity.fullName, age: character.identity.age, overall: football.ratings.overall, potential: Math.max(football.ratings.overall, football.ratings.overall + 8), nationalRank: football.ratings.overall >= 82 ? 120 : football.ratings.overall >= 74 ? 420 : 1100 } : player)
      : createTeamPlayers(team, random.fork("players"), cycle.seasonYear);
    team.rosterIds = teamPlayers.map((player) => player.id);
    team.compliance = refreshTeamCompliance(team, teamPlayers, random.fork("compliance-final"), constitution);
    team.resources = createProgramResources(team, random.fork("resources-final"), cycle.seasonYear);
    team.coachIds = staff.map((coach) => coach.id);
    players.push(...teamPlayers);
    coaches.push(...staff);
  }

  const initialPlanning = reviewRosterManagement(
    teams,
    players,
    coaches,
    constitution,
    cycle.seasonYear,
    Math.max(1, football.season.week),
    new SeededRandom(`${worldSeed}:initial-roster-plans`),
    { applyOffseasonDecisions: false, reason: "Стартовый аудит состава и трёхлетний прогноз." },
  );
  teams = initialPlanning.teams;
  players = initialPlanning.players;

  const heroContext = `${character.identity.fullName} входит в сезон как ${football.position}, но рынок уже движется без него.`;
  const talentPipeline = createTalentPipeline(players, cycle.seasonYear);
  return {
    moduleVersion: 14,
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
    market: calculateMarket(players, coaches, teams, talentPipeline),
    teamHistory: [],
    transactions: [],
    talentPipeline,
    movementMarket: createUnifiedMovementMarket(teams, players, cycle.seasonYear),
    competition: createCompetitionState(cycle.seasonYear, conferenceSetup.conferences, teams, new SeededRandom(`${worldSeed}:competition:${cycle.seasonYear}`)),
    social: createSocialEcosystem(teams, players, coaches, cycle.seasonYear, new SeededRandom(`${worldSeed}:social:${cycle.seasonYear}`), completedDays),
    careerRegistry: createCareerRegistry(players, teams, cycle.seasonYear),
    worldHistory: createWorldHistory(teams, players, coaches, cycle.seasonYear, Math.max(1, football.season.week)),
    agency: createAgencyState(cycle.seasonYear, Math.max(1, football.season.week)),
  };
}
