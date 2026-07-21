import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballCareerState, FootballPosition, FootballRatings, SchoolIdentity } from "../career/types";
import type {
  FootballRecruitingState,
  ProjectedCollegeRole,
  RecruitingProgram,
  RecruitingProgramTier,
  RecruitingStage,
} from "./types";

const PROGRAM_PREFIXES = [
  "Great Lakes", "Redwood State", "Gulf Atlantic", "Capital Tech", "Piedmont", "North Valley",
  "Coastal Union", "Prairie State", "Metro Commonwealth", "Blue Ridge", "Lake Erie", "Sun Coast",
  "Western Plains", "Allegheny", "Lone Star Central", "Pacific Metro", "Midland State", "Cumberland",
  "Hudson Valley", "Desert State", "Carolina A&M", "Gateway", "Southern Lakes", "Rocky Mountain",
] as const;

const LOCATIONS = [
  ["Madison", "WI"], ["Sacramento", "CA"], ["Tampa", "FL"], ["Columbus", "OH"], ["Charlotte", "NC"], ["Boise", "ID"],
  ["Norfolk", "VA"], ["Wichita", "KS"], ["Richmond", "VA"], ["Roanoke", "VA"], ["Toledo", "OH"], ["Orlando", "FL"],
  ["Omaha", "NE"], ["Pittsburgh", "PA"], ["Dallas", "TX"], ["San Diego", "CA"], ["Indianapolis", "IN"], ["Nashville", "TN"],
  ["Albany", "NY"], ["Phoenix", "AZ"], ["Raleigh", "NC"], ["St. Louis", "MO"], ["Grand Rapids", "MI"], ["Denver", "CO"],
] as const;

const SCHEMES: Record<FootballPosition, readonly string[]> = {
  QB: ["West Coast timing", "Vertical spread", "RPO tempo", "Play-action pro style"],
  RB: ["Inside zone", "Wide zone", "Power gap", "Spread option"],
  WR: ["Air raid spacing", "Vertical spread", "West Coast timing", "Play-action shots"],
  LB: ["Multiple 3–4", "Aggressive 4–2–5", "Read-and-react 4–3", "Pressure package"],
  CB: ["Press-man", "Match quarters", "Cover 3 zone", "Multiple nickel"],
};

const RECRUITER_FIRST = ["Marcus", "Derek", "Andre", "Thomas", "Will", "Calvin", "Ray", "Julian", "Nate", "Bryce"] as const;
const RECRUITER_LAST = ["Holland", "Price", "Mercer", "Boone", "Caldwell", "Finch", "Sloan", "Keller", "Bishop", "Morrow"] as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function tierForIndex(index: number): RecruitingProgramTier {
  if (index < 4) return "national";
  if (index < 10) return "power";
  if (index < 18) return "regional";
  return "developmental";
}

function tierBase(tier: RecruitingProgramTier): number {
  return { national: 88, power: 79, regional: 68, developmental: 57 }[tier];
}

function projectedRole(interest: number, need: number, competition: number): ProjectedCollegeRole {
  const score = interest * 0.45 + need * 0.4 - competition * 0.25;
  if (score >= 55) return "immediate-competition";
  if (score >= 38) return "rotation-path";
  if (score >= 22) return "developmental";
  return "long-shot";
}

function stageForInterest(interest: number, confidence: number): RecruitingStage {
  if (interest >= 62 && confidence >= 48) return "contact";
  if (interest >= 45 && confidence >= 30) return "evaluating";
  if (interest >= 28) return "watchlist";
  return "unaware";
}

function evaluationText(program: RecruitingProgram): string {
  if (!program.academicEligible) return "Спортивный штаб заинтересован, но академическая служба пока не допускает движение дальше.";
  if (program.medicalConcern) return "Программа продолжает оценку, но медицинский штаб хочет больше данных по нагрузке и боли.";
  if (program.positionNeed >= 78 && program.fit >= 72) return "Позиция нужна уже в ближайшем наборе, а профиль хорошо ложится в схему.";
  if (program.depthCompetition >= 82) return "Талант признают, но позиционная комната уже переполнена сильными игроками.";
  if (program.fit >= 76) return "Скауты видят хорошее соответствие схеме, но ждут больше плёнки против сильных соперников.";
  return "Программа собирает материал и пока не готова делать окончательный вывод.";
}

export function createRecruitingState(
  worldSeed: string,
  character: CharacterState,
  football: Pick<FootballCareerState, "position" | "ratings" | "school" | "depthChart" | "training">,
): FootballRecruitingState {
  const random = new SeededRandom(worldSeed).fork("recruiting-programs");
  const baseVisibility = clamp(18 + football.ratings.overall * 0.3 + football.school.prestige * 0.15 + random.integer(-4, 5));
  const academic = clamp(character.education.gpa * 25 * 0.72 + character.education.attendance * 0.28);
  const health = clamp(character.condition.health * 0.5 + football.training.body.readiness * 0.35 - football.training.body.pain * 0.25 + 18);
  const coachRecommendation = clamp(football.depthChart.coachTrust * 0.72 + character.personality.coachability * 0.28);
  const competitionLevel = clamp(football.school.prestige * 0.7 + football.school.coaching * 0.3);
  const programs: RecruitingProgram[] = PROGRAM_PREFIXES.map((name, index) => {
    const tier = tierForIndex(index);
    const tierScore = tierBase(tier);
    const location = LOCATIONS[index];
    if (!location) throw new Error("Recruiting location catalog is incomplete");
    const localRandom = random.fork(String(index));
    const prestige = clamp(tierScore + localRandom.integer(-5, 5));
    const need = clamp(localRandom.integer(35, 92) + (index % 5 === 0 ? 7 : 0));
    const competition = clamp(prestige * 0.74 + localRandom.integer(-8, 13));
    const fit = clamp(52 + localRandom.integer(-13, 22) + football.ratings.footballIq * 0.08);
    const academicStandard = clamp(prestige * 0.65 + localRandom.integer(8, 26));
    const eligible = academic >= academicStandard - 6;
    const interest = clamp(
      baseVisibility * 0.32 + football.ratings.overall * 0.2 + fit * 0.17 + need * 0.19 + coachRecommendation * 0.08 - prestige * 0.13 + localRandom.integer(-8, 8),
    );
    const confidence = clamp(12 + baseVisibility * 0.25 + competitionLevel * 0.12 + localRandom.integer(-5, 7));
    const program: RecruitingProgram = {
      id: `college-${index + 1}-${name.toLowerCase().replaceAll(" ", "-")}`,
      seed: `${worldSeed}:college:${index}`,
      name: `${name} University`,
      shortName: name,
      city: location[0],
      stateCode: location[1],
      distanceMiles: localRandom.integer(45, 1900),
      tier,
      prestige,
      conferenceLevel: clamp(prestige + localRandom.integer(-4, 5)),
      scheme: localRandom.pick(SCHEMES[football.position]),
      academicStandard,
      medicine: clamp(prestige + localRandom.integer(-9, 9)),
      facilities: clamp(prestige + localRandom.integer(-8, 10)),
      youthOpportunity: clamp(100 - competition * 0.55 + need * 0.45 + localRandom.integer(-7, 7)),
      positionNeed: need,
      depthCompetition: competition,
      fit,
      interest,
      scoutingConfidence: confidence,
      stage: stageForInterest(interest, confidence),
      academicEligible: eligible,
      medicalConcern: health < 64,
      projectedRole: projectedRole(interest, need, competition),
      recruiterName: `${localRandom.pick(RECRUITER_FIRST)} ${localRandom.pick(RECRUITER_LAST)}`,
      recruiterStyle: localRandom.pick(["direct", "patient", "salesman", "analytical"] as const),
      evaluation: "",
      lastUpdate: "Предсезонная первичная оценка.",
    };
    return { ...program, evaluation: evaluationText(program) };
  });

  const interestedPrograms = programs.filter((program) => program.stage !== "unaware" && program.stage !== "cooled").length;
  return {
    moduleVersion: 1,
    visibility: baseVisibility,
    filmGrade: clamp(football.ratings.technique * 0.45 + football.ratings.footballIq * 0.25 + football.ratings.athleticism * 0.3),
    consistency: clamp(55 + character.personality.discipline * 0.28 + character.personality.composure * 0.17),
    healthConfidence: health,
    academicClearance: academic,
    coachRecommendation,
    competitionLevel,
    regionalRankLabel: football.ratings.overall >= 82 ? "regional top prospect" : football.ratings.overall >= 74 ? "regional watchlist" : football.ratings.overall >= 67 ? "local prospect" : "unrated",
    interestedPrograms,
    offers: 0,
    actionWeek: 0,
    actionsUsed: 0,
    programs,
    activity: [],
  };
}
