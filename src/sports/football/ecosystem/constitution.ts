import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { EcosystemLevel, EcosystemPlayer, EcosystemTeam } from "./types";

export const WORLD_CONSTITUTION_VERSION = 1 as const;

export type WorldCyclePhase =
  | "summer-recruiting"
  | "preseason"
  | "regular-season"
  | "postseason"
  | "winter-evaluation"
  | "spring-development";

export type EligibilityModel = "high-school" | "legacy-four-in-five" | "age-based-five-year";
export type AcademicStanding = "good" | "warning" | "ineligible";
export type ScholarshipStatus = "none" | "partial" | "full";
export type ComplianceStatus = "clear" | "warning" | "violation";

export interface WorldConstitution {
  version: typeof WORLD_CONSTITUTION_VERSION;
  modernEligibilityStartYear: number;
  ageBasedEligibilityYears: number;
  legacyCompetitionSeasons: number;
  legacyEligibilityWindowYears: number;
  legacyRedshirtGameLimit: number;
  collegeRosterLimit: number;
  collegeScholarshipLimit: number;
  minimumTermCredits: number;
  degreeProgressBenchmarks: {
    endOfYearTwo: number;
    endOfYearThree: number;
    endOfYearFour: number;
  };
  simulationOrder: [
    "calendar",
    "eligibility",
    "rosters",
    "teams",
    "competition",
    "recruiting",
    "movement",
    "history",
  ];
}

export interface WorldCycleState {
  academicYear: number;
  seasonYear: number;
  phase: WorldCyclePhase;
  phaseWeek: number;
}

export interface EcosystemPlayerEligibility {
  model: EligibilityModel;
  initialEnrollmentYear: number;
  windowStartYear: number;
  windowEndYear: number;
  athleticallyEligible: boolean;
  academicStanding: AcademicStanding;
  termCredits: number;
  degreeProgress: number;
  gamesPlayedThisSeason: number;
  redshirtUsed: boolean;
  scholarshipStatus: ScholarshipStatus;
}

export interface EcosystemTeamCompliance {
  rosterLimit: number;
  scholarshipLimit: number;
  fundedScholarships: number;
  estimatedRosterSize: number;
  scholarshipsUsed: number;
  academicSupport: number;
  status: ComplianceStatus;
}

const CLASS_INDEX = { Freshman: 0, Sophomore: 1, Junior: 2, Senior: 3 } as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

export function createWorldConstitution(): WorldConstitution {
  return {
    version: WORLD_CONSTITUTION_VERSION,
    modernEligibilityStartYear: 2027,
    ageBasedEligibilityYears: 5,
    legacyCompetitionSeasons: 4,
    legacyEligibilityWindowYears: 5,
    legacyRedshirtGameLimit: 4,
    collegeRosterLimit: 105,
    collegeScholarshipLimit: 105,
    minimumTermCredits: 6,
    degreeProgressBenchmarks: {
      endOfYearTwo: 40,
      endOfYearThree: 60,
      endOfYearFour: 80,
    },
    simulationOrder: [
      "calendar",
      "eligibility",
      "rosters",
      "teams",
      "competition",
      "recruiting",
      "movement",
      "history",
    ],
  };
}

export function resolveWorldCycle(date: GameDate): WorldCycleState {
  const academicYear = date.month >= 7 ? date.year : date.year - 1;
  const seasonYear = date.month >= 7 ? date.year : date.year - 1;
  let phase: WorldCyclePhase;
  let phaseStartMonth: number;

  if (date.month === 7) {
    phase = "summer-recruiting";
    phaseStartMonth = 7;
  } else if (date.month === 8 && date.day < 22) {
    phase = "preseason";
    phaseStartMonth = 8;
  } else if ((date.month === 8 && date.day >= 22) || (date.month >= 9 && date.month <= 11)) {
    phase = "regular-season";
    phaseStartMonth = date.month === 8 ? 8 : 9;
  } else if (date.month === 12) {
    phase = "postseason";
    phaseStartMonth = 12;
  } else if (date.month === 1) {
    phase = "winter-evaluation";
    phaseStartMonth = 1;
  } else if (date.month >= 2 && date.month <= 5) {
    phase = "spring-development";
    phaseStartMonth = 2;
  } else {
    phase = "summer-recruiting";
    phaseStartMonth = 6;
  }

  let phaseWeek: number;
  if (phase === "regular-season") {
    const start = Date.UTC(date.year, 7, 22);
    const current = Date.UTC(date.year, date.month - 1, date.day);
    phaseWeek = Math.max(1, Math.floor((current - start) / 604_800_000) + 1);
  } else {
    const monthOffset = date.month >= phaseStartMonth ? date.month - phaseStartMonth : 0;
    phaseWeek = Math.max(1, monthOffset * 4 + Math.ceil(date.day / 7));
  }
  return { academicYear, seasonYear, phase, phaseWeek };
}

export function addGameDays(date: GameDate, days: number): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day));
  value.setUTCDate(value.getUTCDate() + days);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function createPlayerEligibility(
  level: EcosystemLevel,
  age: number,
  classYear: EcosystemPlayer["classYear"],
  seasonYear: number,
  random: SeededRandom,
  scholarshipStatus?: ScholarshipStatus,
): EcosystemPlayerEligibility {
  if (level === "high-school") {
    return {
      model: "high-school",
      initialEnrollmentYear: seasonYear + 1,
      windowStartYear: seasonYear,
      windowEndYear: seasonYear,
      athleticallyEligible: true,
      academicStanding: "good",
      termCredits: 0,
      degreeProgress: 0,
      gamesPlayedThisSeason: 0,
      redshirtUsed: false,
      scholarshipStatus: "none",
    };
  }

  const classIndex = CLASS_INDEX[classYear];
  const initialEnrollmentYear = seasonYear - classIndex;
  const model: EligibilityModel = initialEnrollmentYear >= 2027 ? "age-based-five-year" : "legacy-four-in-five";
  const windowEndYear = initialEnrollmentYear + 4;
  const degreeProgress = clamp(classIndex * 23 + random.integer(0, 12));
  const termCredits = random.integer(0, 3);
  const academicStanding: AcademicStanding = "good";

  return {
    model,
    initialEnrollmentYear,
    windowStartYear: initialEnrollmentYear,
    windowEndYear,
    athleticallyEligible: seasonYear <= windowEndYear && age <= 24,
    academicStanding,
    termCredits,
    degreeProgress,
    gamesPlayedThisSeason: 0,
    redshirtUsed: false,
    scholarshipStatus: scholarshipStatus ?? (random.chance(0.72) ? "full" : random.chance(0.45) ? "partial" : "none"),
  };
}

export function createTeamCompliance(
  team: Pick<EcosystemTeam, "level" | "prestige">,
  detailedRosterSize: number,
  random: SeededRandom,
  constitution = createWorldConstitution(),
): EcosystemTeamCompliance {
  if (team.level === "high-school") {
    return {
      rosterLimit: 85,
      scholarshipLimit: 0,
      fundedScholarships: 0,
      estimatedRosterSize: Math.max(detailedRosterSize, random.integer(42, 76)),
      scholarshipsUsed: 0,
      academicSupport: clamp(42 + team.prestige * 0.35 + random.integer(-8, 10)),
      status: "clear",
    };
  }

  const fundedScholarships = Math.round(clamp(66 + team.prestige * 0.38 + random.integer(-7, 7), 62, constitution.collegeScholarshipLimit));
  const estimatedRosterSize = Math.round(clamp(78 + team.prestige * 0.2 + random.integer(-6, 8), detailedRosterSize, constitution.collegeRosterLimit));
  const scholarshipsUsed = Math.min(fundedScholarships, Math.round(estimatedRosterSize * (0.72 + team.prestige * 0.0018)));
  const status: ComplianceStatus = estimatedRosterSize > constitution.collegeRosterLimit
    ? "violation"
    : estimatedRosterSize >= constitution.collegeRosterLimit - 2 || scholarshipsUsed > fundedScholarships
      ? "warning"
      : "clear";

  return {
    rosterLimit: constitution.collegeRosterLimit,
    scholarshipLimit: constitution.collegeScholarshipLimit,
    fundedScholarships,
    estimatedRosterSize,
    scholarshipsUsed,
    academicSupport: clamp(50 + team.prestige * 0.35 + random.integer(-10, 9)),
    status,
  };
}

export function refreshTeamCompliance(
  team: Pick<EcosystemTeam, "id" | "level" | "prestige" | "compliance">,
  players: Array<Pick<EcosystemPlayer, "teamId" | "eligibility">>,
  random: SeededRandom,
  constitution: WorldConstitution,
): EcosystemTeamCompliance {
  const detailed = players.filter((player) => player.teamId === team.id);
  const fullScholarships = detailed.filter((player) => player.eligibility.scholarshipStatus === "full").length;
  const partialScholarships = detailed.filter((player) => player.eligibility.scholarshipStatus === "partial").length * 0.5;
  const base = createTeamCompliance(team, detailed.length, random, constitution);
  const estimatedRosterSize = Math.max(detailed.length, base.estimatedRosterSize);
  const detailedAidShare = detailed.length > 0 ? (fullScholarships + partialScholarships) / detailed.length : 0;
  const scholarshipsUsed = Math.min(base.scholarshipLimit, Math.round(estimatedRosterSize * Math.max(0.55, detailedAidShare)));
  const status: ComplianceStatus = estimatedRosterSize > base.rosterLimit || scholarshipsUsed > base.fundedScholarships
    ? "violation"
    : estimatedRosterSize >= base.rosterLimit - 2 || scholarshipsUsed >= base.fundedScholarships - 2
      ? "warning"
      : "clear";
  return { ...base, estimatedRosterSize, scholarshipsUsed, status };
}

export function advanceAcademicWeek(
  player: EcosystemPlayer,
  team: EcosystemTeam | undefined,
  seasonWeek: number,
  seasonYear: number,
  random: SeededRandom,
  constitution: WorldConstitution,
): EcosystemPlayerEligibility {
  if (player.level !== "college") return player.eligibility;
  const support = team?.compliance.academicSupport ?? 55;
  const creditsGain = clamp(0.6 + support * 0.006 + random.next() * 0.65, 0.4, 1.8);
  const termCredits = clamp(player.eligibility.termCredits + creditsGain, 0, 24);
  const checkWeek = seasonWeek >= 6;
  const academicStanding: AcademicStanding = checkWeek && termCredits < constitution.minimumTermCredits
    ? "ineligible"
    : termCredits < constitution.minimumTermCredits + 2
      ? "warning"
      : "good";
  const athleticallyEligible = seasonYear <= player.eligibility.windowEndYear && academicStanding !== "ineligible";
  return { ...player.eligibility, termCredits, academicStanding, athleticallyEligible };
}

export function rollEligibilityIntoNextSeason(
  player: EcosystemPlayer,
  nextSeasonYear: number,
  random: SeededRandom,
  constitution: WorldConstitution,
): EcosystemPlayerEligibility {
  const previous = player.eligibility;
  if (player.level !== "college") return previous;
  const playedSeason = previous.gamesPlayedThisSeason > 0;
  const assignedRedshirt = player.usagePlan === "redshirt";
  const canRedshirt = previous.model === "legacy-four-in-five"
    && !previous.redshirtUsed
    && previous.gamesPlayedThisSeason <= constitution.legacyRedshirtGameLimit;
  const redshirtUsed = previous.redshirtUsed || (canRedshirt && (playedSeason || assignedRedshirt));
  const degreeProgress = clamp(previous.degreeProgress + random.integer(18, 28));
  const completedYear = player.seasonsPlayed + 1;
  const requiredProgress = completedYear >= 4
    ? constitution.degreeProgressBenchmarks.endOfYearFour
    : completedYear === 3
      ? constitution.degreeProgressBenchmarks.endOfYearThree
      : completedYear === 2
        ? constitution.degreeProgressBenchmarks.endOfYearTwo
        : 20;
  const academicStanding: AcademicStanding = degreeProgress + 8 < requiredProgress
    ? "ineligible"
    : degreeProgress < requiredProgress
      ? "warning"
      : "good";
  return {
    ...previous,
    athleticallyEligible: nextSeasonYear <= previous.windowEndYear && academicStanding !== "ineligible",
    academicStanding,
    termCredits: 0,
    degreeProgress,
    gamesPlayedThisSeason: 0,
    redshirtUsed,
  };
}

export function isPlayerAvailable(player: EcosystemPlayer): boolean {
  return player.status !== "injured" && player.eligibility.athleticallyEligible;
}
