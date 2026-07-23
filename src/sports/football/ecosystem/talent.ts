import { SeededRandom } from "../../../core/random/SeededRandom";
import { createPlayerTacticalProfile } from "./tactics";
import type { FootballPosition } from "../career/types";
import { createPlayerEligibility, refreshTeamCompliance, type WorldCycleState } from "./constitution";
import { availableNilCapacity, availableRecruitingBudget, reserveRecruitingResources } from "./resources";
import type {
  EcosystemCamp,
  EcosystemExposureLevel,
  EcosystemIndependentProspect,
  EcosystemPlayer,
  EcosystemStoryKind,
  EcosystemTalentPipeline,
  EcosystemTalentProfile,
  EcosystemTalentRegion,
  EcosystemTeam,
  EcosystemTransactionKind,
  FootballEcosystemState,
} from "./types";

const CORE_POSITIONS = ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[];
const FIRST_NAMES = [
  "Aiden", "Amari", "Bryson", "Cade", "Darius", "Devin", "Emmanuel", "Isaac", "Jayden", "Khalil",
  "Landon", "Marcus", "Mason", "Nico", "Roman", "Samir", "Tariq", "Tyson", "Wesley", "Zaire",
] as const;
const LAST_NAMES = [
  "Baker", "Banks", "Bryant", "Crawford", "Ellis", "Fields", "Green", "Henderson", "Jefferson", "King",
  "Lawson", "Morris", "Owens", "Price", "Richardson", "Scott", "Stewart", "Thomas", "Williams", "Wright",
] as const;

export interface TalentStoryDraft {
  kind: EcosystemStoryKind;
  title: string;
  detail: string;
  importance: 1 | 2 | 3 | 4 | 5;
  teamIds: string[];
  playerIds: string[];
  relatedToHero: boolean;
}

export interface TalentTransactionDraft {
  kind: EcosystemTransactionKind;
  title: string;
  detail: string;
  playerId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  relatedToHero: boolean;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function fullName(random: SeededRandom): string {
  return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
}

export function createTalentRegions(): EcosystemTalentRegion[] {
  return [
    { id: "southeast", name: "Southeast Belt", stateCodes: ["FL", "GA", "AL", "MS", "SC", "NC", "TN"], populationWeight: 94, footballCulture: 96, infrastructure: 88, exposureBias: 86, academicAccess: 62, annualClassSize: 118 },
    { id: "texas-plains", name: "Texas & Plains", stateCodes: ["TX", "OK", "KS", "NE"], populationWeight: 91, footballCulture: 98, infrastructure: 90, exposureBias: 89, academicAccess: 66, annualClassSize: 112 },
    { id: "great-lakes", name: "Great Lakes", stateCodes: ["OH", "MI", "PA", "IN", "IL", "WI", "MN"], populationWeight: 86, footballCulture: 84, infrastructure: 81, exposureBias: 77, academicAccess: 74, annualClassSize: 96 },
    { id: "mid-atlantic", name: "Mid-Atlantic", stateCodes: ["VA", "MD", "DC", "NJ", "NY", "DE", "WV"], populationWeight: 82, footballCulture: 76, infrastructure: 84, exposureBias: 81, academicAccess: 80, annualClassSize: 88 },
    { id: "west-coast", name: "West Coast", stateCodes: ["CA", "OR", "WA", "NV", "AZ", "HI"], populationWeight: 92, footballCulture: 79, infrastructure: 91, exposureBias: 92, academicAccess: 78, annualClassSize: 105 },
    { id: "mountain", name: "Mountain States", stateCodes: ["CO", "UT", "ID", "MT", "WY", "NM"], populationWeight: 58, footballCulture: 67, infrastructure: 66, exposureBias: 55, academicAccess: 71, annualClassSize: 58 },
    { id: "northeast", name: "Northeast", stateCodes: ["MA", "CT", "RI", "VT", "NH", "ME"], populationWeight: 54, footballCulture: 48, infrastructure: 76, exposureBias: 67, academicAccess: 90, annualClassSize: 52 },
    { id: "heartland", name: "Heartland", stateCodes: ["MO", "IA", "AR", "KY", "LA", "SD", "ND"], populationWeight: 71, footballCulture: 81, infrastructure: 70, exposureBias: 63, academicAccess: 67, annualClassSize: 74 },
  ];
}

export function regionForState(stateCode: string, regions = createTalentRegions()): EcosystemTalentRegion {
  return regions.find((region) => region.stateCodes.includes(stateCode)) ?? regions.find((region) => region.id === "heartland") ?? regions[0]!;
}

function exposureFor(value: number): EcosystemExposureLevel {
  if (value >= 82) return "national";
  if (value >= 60) return "regional";
  if (value >= 36) return "local";
  return "hidden";
}

export function createTalentProfile(
  player: Pick<EcosystemPlayer, "level" | "classYear" | "overall" | "potential" | "nationalRank" | "isHero">,
  stateCode: string,
  seasonYear: number,
  random: SeededRandom,
): EcosystemTalentProfile {
  const region = regionForState(stateCode);
  const classOffset = player.classYear === "Freshman" ? 3 : player.classYear === "Sophomore" ? 2 : player.classYear === "Junior" ? 1 : 0;
  const graduationYear = player.level === "high-school" ? seasonYear + classOffset : seasonYear - Math.max(0, 3 - classOffset);
  const route = player.isHero
    ? "traditional"
    : random.chance(0.13)
      ? "multi-sport"
      : random.chance(0.12)
        ? "late-bloomer"
        : "traditional";
  const developmentCurve = route === "late-bloomer" ? "late" : player.overall >= player.potential - 6 ? "early" : random.chance(0.58) ? "steady" : "late";
  const visibility = clamp(
    region.exposureBias * 0.38
      + Math.max(0, 94 - Math.min(94, player.nationalRank / 18)) * 0.34
      + player.overall * 0.22
      + random.integer(-14, 14),
  );
  return {
    regionId: region.id,
    homeState: stateCode,
    graduationYear,
    route,
    developmentCurve,
    physicalMaturity: clamp(player.overall * 0.55 + (developmentCurve === "early" ? 25 : developmentCurve === "late" ? 7 : 16) + random.integer(-8, 8)),
    scoutingGrade: clamp(player.overall * 0.66 + player.potential * 0.24 + visibility * 0.1 + random.integer(-6, 6)),
    campExposure: clamp(visibility * 0.22 + random.integer(0, 18)),
    exposure: exposureFor(visibility),
    academicProjection: clamp(region.academicAccess * 0.55 + random.integer(20, 48)),
    discoveredYear: player.level === "college" ? Math.max(graduationYear - 1, seasonYear - 2) : visibility >= 60 ? seasonYear : seasonYear + 1,
  };
}

function createCamps(regions: EcosystemTalentRegion[], seasonYear: number): EcosystemCamp[] {
  return regions.flatMap((region, index) => [
    {
      id: `${region.id}-summer-showcase`,
      name: `${region.name} Summer Showcase`,
      regionId: region.id,
      phase: "summer-recruiting" as const,
      phaseWeek: 2 + (index % 3),
      prestige: clamp(region.exposureBias * 0.7 + region.infrastructure * 0.3),
      capacity: Math.round(10 + region.populationWeight * 0.08),
      lastHeldSeasonYear: seasonYear - 1,
    },
    {
      id: `${region.id}-spring-combine`,
      name: `${region.name} Spring Combine`,
      regionId: region.id,
      phase: "spring-development" as const,
      phaseWeek: 4 + (index % 4),
      prestige: clamp(region.infrastructure * 0.72 + region.footballCulture * 0.28),
      capacity: Math.round(8 + region.populationWeight * 0.07),
      lastHeldSeasonYear: seasonYear - 1,
    },
  ]);
}

export function createTalentPipeline(
  players: Array<Pick<EcosystemPlayer, "id" | "level" | "talent">>,
  seasonYear: number,
): EcosystemTalentPipeline {
  const regions = createTalentRegions();
  return {
    version: 1,
    generationYear: seasonYear,
    regions,
    camps: createCamps(regions, seasonYear),
    independentProspects: [],
    classHistory: [{
      seasonYear,
      generatedPlayers: players.filter((player) => player.level === "high-school").length,
      traditionalPlayers: players.filter((player) => player.level === "high-school" && player.talent.route === "traditional").length,
      multiSportPlayers: players.filter((player) => player.level === "high-school" && player.talent.route === "multi-sport").length,
      lateBloomers: players.filter((player) => player.level === "high-school" && player.talent.route === "late-bloomer").length,
      jucoEntries: 0,
      walkOnEntries: 0,
      topProspectIds: [...players]
        .filter((player) => player.level === "high-school")
        .sort((left, right) => right.talent.scoutingGrade - left.talent.scoutingGrade)
        .slice(0, 8)
        .map((player) => player.id),
    }],
  };
}

export function simulateTalentCamps(
  pipeline: EcosystemTalentPipeline,
  players: EcosystemPlayer[],
  cycle: WorldCycleState,
  random: SeededRandom,
  heroTeamId: string,
): { pipeline: EcosystemTalentPipeline; players: EcosystemPlayer[]; stories: TalentStoryDraft[] } {
  const eligibleCamps = pipeline.camps.filter((camp) =>
    camp.phase === cycle.phase
      && camp.phaseWeek === cycle.phaseWeek
      && camp.lastHeldSeasonYear < cycle.seasonYear,
  );
  if (eligibleCamps.length === 0) return { pipeline, players, stories: [] };

  let nextPlayers = [...players];
  const stories: TalentStoryDraft[] = [];
  const updatedCamps = pipeline.camps.map((camp) => {
    if (!eligibleCamps.some((candidate) => candidate.id === camp.id)) return camp;
    const campRandom = random.fork(camp.id);
    const candidates = nextPlayers
      .filter((player) => player.level === "high-school"
        && player.talent.regionId === camp.regionId
        && (player.classYear === "Junior" || player.classYear === "Senior"))
      .sort((left, right) => {
        const leftScore = left.overall * 0.48 + left.potential * 0.28 + left.talent.campExposure * 0.12 + campRandom.fork(left.id).integer(-8, 8);
        const rightScore = right.overall * 0.48 + right.potential * 0.28 + right.talent.campExposure * 0.12 + campRandom.fork(right.id).integer(-8, 8);
        return rightScore - leftScore;
      })
      .slice(0, camp.capacity);

    let best: EcosystemPlayer | undefined;
    let bestPerformance = -1;
    for (const candidate of candidates) {
      const performanceRandom = campRandom.fork(`performance:${candidate.id}`);
      const performance = clamp(candidate.overall * 0.54 + candidate.potential * 0.2 + candidate.form * 0.12 + performanceRandom.integer(-14, 16));
      const exposureGain = clamp(8 + camp.prestige * 0.12 + Math.max(0, performance - 65) * 0.25, 6, 28);
      const index = nextPlayers.findIndex((player) => player.id === candidate.id);
      if (index < 0) continue;
      const current = nextPlayers[index]!;
      const scoutingGrade = clamp(current.talent.scoutingGrade * 0.72 + performance * 0.28);
      const campExposure = clamp(current.talent.campExposure + exposureGain);
      const lateGrowth = current.talent.developmentCurve === "late" && performance >= 78 ? 0.8 : 0;
      nextPlayers[index] = {
        ...current,
        overall: clamp(current.overall + lateGrowth, 40, 99),
        recruitingStage: current.recruitingStage === "unranked" && scoutingGrade >= 63 ? "tracked" : current.recruitingStage,
        talent: {
          ...current.talent,
          scoutingGrade,
          campExposure,
          exposure: exposureFor(campExposure * 0.58 + scoutingGrade * 0.42),
          discoveredYear: Math.min(current.talent.discoveredYear, cycle.seasonYear),
        },
      };
      if (performance > bestPerformance) {
        bestPerformance = performance;
        best = nextPlayers[index];
      }
    }

    if (best && bestPerformance >= 74) {
      const related = best.isHero || best.teamId === heroTeamId;
      stories.push({
        kind: "camp-breakout",
        title: `${best.name} поднялся после лагеря`,
        detail: `${best.name}, ${best.position}, выделился на ${camp.name}. Его оценка выросла, а программы получили больше подтверждённой информации.`,
        importance: related ? 4 : bestPerformance >= 86 ? 4 : 2,
        teamIds: [best.teamId],
        playerIds: [best.id],
        relatedToHero: related,
      });
    }
    return { ...camp, lastHeldSeasonYear: cycle.seasonYear };
  });

  return { pipeline: { ...pipeline, camps: updatedCamps }, players: nextPlayers, stories };
}

function independentFromSenior(
  player: EcosystemPlayer,
  random: SeededRandom,
  seasonYear: number,
): EcosystemIndependentProspect | undefined {
  const route = player.overall >= 61 && player.talent.academicProjection < 63
    ? "juco"
    : player.overall >= 55 || player.potential >= 72
      ? "walk-on"
      : undefined;
  if (!route) return undefined;
  return {
    id: `${route}:${seasonYear}:${player.id}`,
    seed: `${player.seed}:${route}:${seasonYear}`,
    name: player.name,
    age: 18,
    position: player.position,
    route,
    regionId: player.talent.regionId,
    homeState: player.talent.homeState,
    overall: clamp(player.overall + (route === "juco" ? random.integer(-1, 2) : random.integer(-2, 1))),
    potential: player.potential,
    health: player.health,
    academicProjection: player.talent.academicProjection,
    exposure: player.talent.exposure,
    campExposure: player.talent.campExposure,
    graduationYear: seasonYear,
    yearsInRoute: 0,
    status: "available",
  };
}

function chooseIndependentDestination(
  prospect: EcosystemIndependentProspect,
  teams: EcosystemTeam[],
  random: SeededRandom,
): EcosystemTeam | undefined {
  return teams
    .filter((team) => team.level === "college"
      && team.compliance.estimatedRosterSize < team.compliance.rosterLimit
      && availableRecruitingBudget(team.resources) > 0.04
      && (prospect.route === "walk-on" || availableNilCapacity(team.resources) > 0.02))
    .map((team) => ({
      team,
      score: team.positionNeeds[prospect.position] * 0.38
        + (100 - team.compliance.estimatedRosterSize / team.compliance.rosterLimit * 100) * 0.2
        + team.resources.facilitiesLevel * 0.12
        + team.resources.academicSupportLevel * 0.08
        + team.prestige * 0.14
        + random.fork(team.id).integer(-12, 12),
    }))
    .sort((left, right) => right.score - left.score)[0]?.team;
}

function createFreshman(
  team: EcosystemTeam,
  position: FootballPosition,
  seasonYear: number,
  pipeline: EcosystemTalentPipeline,
  random: SeededRandom,
  depthRank: number,
): EcosystemPlayer {
  const region = regionForState(team.stateCode, pipeline.regions);
  const cultureBoost = (region.footballCulture - 60) * 0.12;
  const infrastructureBoost = (region.infrastructure - 60) * 0.08;
  const route = random.chance(0.16) ? "multi-sport" : random.chance(0.13) ? "late-bloomer" : "traditional";
  const developmentCurve = route === "late-bloomer" ? "late" : random.chance(0.28) ? "early" : "steady";
  const overall = clamp(team.rating - 18 + cultureBoost + infrastructureBoost + random.integer(-8, 8), 42, 82);
  const potential = clamp(overall + random.integer(developmentCurve === "late" ? 11 : 6, developmentCurve === "late" ? 25 : 19), overall, 98);
  const id = `${team.id}-class-${seasonYear}-${position.toLowerCase()}-${depthRank}`;
  const exposureValue = clamp(region.exposureBias * 0.5 + team.prestige * 0.2 + random.integer(-18, 13));
  const eligibility = createPlayerEligibility("high-school", 15, "Freshman", seasonYear, random.fork("eligibility"));
  return {
    id,
    seed: `${team.seed}:class:${seasonYear}:${position}:${depthRank}`,
    name: fullName(random),
    teamId: team.id,
    level: "high-school",
    age: 15,
    classYear: "Freshman",
    position,
    overall,
    potential,
    health: clamp(91 + random.integer(-10, 8)),
    form: clamp(52 + random.integer(-13, 17)),
    status: depthRank === 1 ? "starter" : depthRank === 2 ? "rotation" : "backup",
    depthRank,
    trajectory: "steady",
    nationalRank: Math.max(1, Math.round(2400 - potential * 18 - exposureValue * 4 + random.integer(-120, 180))),
    recruitingStage: "unranked",
    eligibilityYears: 4,
    seasonsPlayed: 0,
    transferStatus: "none",
    previousTeamIds: [],
    isHero: false,
    eligibility,
    talent: {
      regionId: region.id,
      homeState: team.stateCode,
      graduationYear: seasonYear + 3,
      route,
      developmentCurve,
      physicalMaturity: clamp(overall * 0.62 + (developmentCurve === "early" ? 24 : developmentCurve === "late" ? 5 : 14) + random.integer(-8, 8)),
      scoutingGrade: clamp(overall * 0.62 + potential * 0.28 + exposureValue * 0.1 + random.integer(-7, 7)),
      campExposure: clamp(exposureValue * 0.16 + random.integer(0, 9)),
      exposure: exposureFor(exposureValue),
      academicProjection: clamp(region.academicAccess * 0.58 + random.integer(18, 45)),
      discoveredYear: seasonYear + (exposureValue >= 62 ? 1 : 2),
    },
    usagePlan: depthRank === 1 ? "starter" : depthRank === 2 ? "rotation" : "developmental",
    positionHistory: [],
    tactical: createPlayerTacticalProfile({ seed: `${team.seed}:class:${seasonYear}:${position}:${depthRank}`, position, overall, potential, classYear: "Freshman" }, team.tactical, random.fork("tactical")),
  };
}

function enrollIndependent(
  prospect: EcosystemIndependentProspect,
  target: EcosystemTeam,
  seasonYear: number,
  random: SeededRandom,
): EcosystemPlayer {
  const scholarshipStatus = prospect.route === "juco" && prospect.overall >= 72 ? "partial" : "none";
  const classYear = prospect.route === "juco" ? "Sophomore" : "Freshman";
  const age = prospect.route === "juco" ? 20 : 19;
  return {
    id: `independent-player:${prospect.id}`,
    seed: prospect.seed,
    name: prospect.name,
    teamId: target.id,
    level: "college",
    age,
    classYear,
    position: prospect.position,
    overall: prospect.overall,
    potential: prospect.potential,
    health: prospect.health,
    form: clamp(52 + random.integer(-8, 12)),
    status: "backup",
    depthRank: 3,
    trajectory: "steady",
    nationalRank: 9999,
    recruitingStage: "committed",
    committedTeamId: target.id,
    eligibilityYears: prospect.route === "juco" ? 3 : 5,
    seasonsPlayed: prospect.route === "juco" ? 1 : 0,
    transferStatus: "none",
    previousTeamIds: [],
    isHero: false,
    eligibility: createPlayerEligibility("college", age, classYear, seasonYear, random.fork("eligibility"), scholarshipStatus),
    talent: {
      regionId: prospect.regionId,
      homeState: prospect.homeState,
      graduationYear: prospect.graduationYear,
      route: prospect.route,
      developmentCurve: prospect.route === "juco" ? "late" : "steady",
      physicalMaturity: clamp(prospect.overall * 0.7 + random.integer(9, 20)),
      scoutingGrade: clamp(prospect.overall * 0.68 + prospect.potential * 0.22 + prospect.campExposure * 0.1),
      campExposure: prospect.campExposure,
      exposure: prospect.exposure,
      academicProjection: prospect.academicProjection,
      discoveredYear: seasonYear - 1,
    },
    usagePlan: "developmental",
    positionHistory: [],
    tactical: createPlayerTacticalProfile({ seed: prospect.seed, position: prospect.position, overall: prospect.overall, potential: prospect.potential, classYear }, target.tactical, random.fork("tactical")),
  };
}

export function processAnnualTalentFlow(
  world: FootballEcosystemState,
  currentPlayers: EcosystemPlayer[],
  currentTeams: EcosystemTeam[],
  unsignedSeniors: EcosystemPlayer[],
  nextSeasonYear: number,
  random: SeededRandom,
  heroProgramId?: string,
): {
  players: EcosystemPlayer[];
  teams: EcosystemTeam[];
  pipeline: EcosystemTalentPipeline;
  stories: TalentStoryDraft[];
  transactions: TalentTransactionDraft[];
} {
  if (world.talentPipeline.generationYear >= nextSeasonYear) {
    return { players: currentPlayers, teams: currentTeams, pipeline: world.talentPipeline, stories: [], transactions: [] };
  }

  const stories: TalentStoryDraft[] = [];
  const transactions: TalentTransactionDraft[] = [];
  let teams = [...currentTeams];
  let players = [...currentPlayers];
  const nextIndependent: EcosystemIndependentProspect[] = [];
  let jucoEntries = 0;
  let walkOnEntries = 0;

  for (const prospect of world.talentPipeline.independentProspects) {
    const routeRandom = random.fork(`independent:${prospect.id}`);
    if (prospect.status === "committed" && prospect.committedTeamId) {
      const targetIndex = teams.findIndex((team) => team.id === prospect.committedTeamId);
      if (targetIndex >= 0) {
        const target = teams[targetIndex]!;
        const enrolled = enrollIndependent(prospect, target, nextSeasonYear, routeRandom.fork("enroll"));
        players.push(enrolled);
        teams[targetIndex] = { ...target, rosterIds: [...target.rosterIds, enrolled.id] };
        transactions.push({
          kind: prospect.route === "juco" ? "juco-entry" : "walk-on-entry",
          title: `${prospect.name} прибыл в ${target.shortName}`,
          detail: `${prospect.name}, ${prospect.position}, вошёл в состав через ${prospect.route === "juco" ? "JUCO" : "preferred walk-on"} маршрут.`,
          playerId: enrolled.id,
          toTeamId: target.id,
          relatedToHero: target.id === heroProgramId && prospect.position === players.find((player) => player.isHero)?.position,
        });
        continue;
      }
    }

    const developed = {
      ...prospect,
      age: Math.min(22, prospect.age + 1),
      yearsInRoute: prospect.yearsInRoute + 1,
      overall: clamp(prospect.overall + routeRandom.next() * (prospect.route === "juco" ? 3.6 : 2.1), 45, 92),
      potential: clamp(prospect.potential + routeRandom.next() * 0.8, prospect.overall, 96),
      academicProjection: clamp(prospect.academicProjection + (prospect.route === "juco" ? routeRandom.integer(3, 10) : routeRandom.integer(0, 5))),
    };
    if (developed.yearsInRoute <= 2) {
      nextIndependent.push({ ...developed, status: "available", committedTeamId: undefined });
    }
  }

  for (const senior of unsignedSeniors.filter((player) => !player.isHero && !player.committedTeamId)) {
    const prospect = independentFromSenior(senior, random.fork(`unsigned:${senior.id}`), nextSeasonYear - 1);
    if (!prospect) continue;
    nextIndependent.push(prospect);
    if (prospect.route === "juco") jucoEntries += 1;
    else walkOnEntries += 1;
    const kind = prospect.route === "juco" ? "juco-route" : "walk-on-route";
    stories.push({
      kind,
      title: `${senior.name} продолжит искать путь`,
      detail: `${senior.name}, ${senior.position}, не получил подходящего прямого места и выбрал ${prospect.route === "juco" ? "JUCO-маршрут" : "путь walk-on"}. Карьера не завершилась после одного рекрутингового цикла.`,
      importance: senior.overall >= 70 ? 3 : 2,
      teamIds: [senior.teamId],
      playerIds: [senior.id],
      relatedToHero: senior.teamId === players.find((player) => player.isHero)?.teamId && senior.position === players.find((player) => player.isHero)?.position,
    });
  }

  const generated: EcosystemPlayer[] = [];
  for (const team of teams.filter((item) => item.level === "high-school")) {
    for (const position of CORE_POSITIONS) {
      const currentRoom = players.filter((player) => player.teamId === team.id && player.position === position);
      const depthRank = currentRoom.length + 1;
      generated.push(createFreshman(team, position, nextSeasonYear, world.talentPipeline, random.fork(`freshman:${team.id}:${position}:${nextSeasonYear}`), depthRank));
    }
  }
  players.push(...generated);

  const playerIdsByTeam = new Map<string, string[]>();
  for (const player of players) {
    const list = playerIdsByTeam.get(player.teamId) ?? [];
    list.push(player.id);
    playerIdsByTeam.set(player.teamId, list);
  }
  teams = teams.map((team) => {
    const rosterIds = playerIdsByTeam.get(team.id) ?? [];
    const provisional = { ...team, rosterIds };
    return {
      ...provisional,
      compliance: refreshTeamCompliance(provisional, players, random.fork(`compliance:${team.id}:${nextSeasonYear}`), world.constitution),
    };
  });

  const classRecord = {
    seasonYear: nextSeasonYear,
    generatedPlayers: generated.length,
    traditionalPlayers: generated.filter((player) => player.talent.route === "traditional").length,
    multiSportPlayers: generated.filter((player) => player.talent.route === "multi-sport").length,
    lateBloomers: generated.filter((player) => player.talent.route === "late-bloomer").length,
    jucoEntries,
    walkOnEntries,
    topProspectIds: [...generated]
      .sort((left, right) => right.talent.scoutingGrade - left.talent.scoutingGrade)
      .slice(0, 8)
      .map((player) => player.id),
  };
  stories.push({
    kind: "talent-class",
    title: `Поколение ${nextSeasonYear + 3} вошло в школьный футбол`,
    detail: `${generated.length} новых игроков распределены по региональным школам: ${classRecord.multiSportPlayers} пришли из нескольких видов спорта, ${classRecord.lateBloomers} имеют позднюю кривую развития.`,
    importance: 3,
    teamIds: teams.filter((team) => team.level === "high-school").map((team) => team.id),
    playerIds: classRecord.topProspectIds,
    relatedToHero: false,
  });

  return {
    players,
    teams,
    pipeline: {
      ...world.talentPipeline,
      generationYear: nextSeasonYear,
      independentProspects: nextIndependent,
      classHistory: [...world.talentPipeline.classHistory, classRecord].slice(-20),
    },
    stories,
    transactions,
  };
}
