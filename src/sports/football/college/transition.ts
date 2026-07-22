import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import type { RelationshipNpc } from "../../../core/relationships/types";
import type { ProjectedCollegeRole, RecruitingProgram } from "../recruiting/types";
import type {
  CollegeEntryRoute,
  CollegeOnboardingPriority,
  CollegePlayerYear,
  CollegePositionPlayer,
  CollegeProgramIdentity,
  FootballCollegeState,
} from "./types";

const FIRST_NAMES = ["Andre", "Caleb", "Micah", "Tre", "Jalen", "Isaiah", "Noah", "Cam", "Derrick", "Eli", "Khalil", "Mason"] as const;
const LAST_NAMES = ["Bennett", "Holloway", "Graves", "Parker", "Sutton", "Banks", "Morris", "Fields", "Wright", "Dawson", "Harris", "Pierce"] as const;
const STYLES = ["Explosive athlete", "Technical specialist", "Physical finisher", "Reliable assignment player", "High-upside project", "Experienced role player"] as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function isOfferActive(save: CareerSave, program: RecruitingProgram): boolean {
  return Boolean(program.offer && program.offer.expiresAfterWeek >= save.football.season.week);
}

export function collegeEntryRouteFor(save: CareerSave, program: RecruitingProgram): CollegeEntryRoute | undefined {
  if (!program.academicEligible || program.stage === "cooled") return undefined;
  if (isOfferActive(save, program)) return "scholarship";
  if (["contact", "priority", "offered"].includes(program.stage) && program.interest >= 55 && program.scoutingConfidence >= 45) {
    return "preferred-walk-on";
  }
  return undefined;
}

export function collegeDecisionPrograms(save: CareerSave): RecruitingProgram[] {
  return [...save.football.recruitment.programs]
    .filter((program) => Boolean(collegeEntryRouteFor(save, program)))
    .sort((left, right) => {
      const leftRoute = collegeEntryRouteFor(save, left);
      const rightRoute = collegeEntryRouteFor(save, right);
      const leftScore = (leftRoute === "scholarship" ? 500 : 0) + left.interest * 2 + left.fit + left.positionNeed - left.depthCompetition * 0.5;
      const rightScore = (rightRoute === "scholarship" ? 500 : 0) + right.interest * 2 + right.fit + right.positionNeed - right.depthCompetition * 0.5;
      return rightScore - leftScore;
    });
}

function programIdentity(program: RecruitingProgram): CollegeProgramIdentity {
  return {
    id: program.id,
    name: program.name,
    shortName: program.shortName,
    city: program.city,
    stateCode: program.stateCode,
    tier: program.tier,
    prestige: program.prestige,
    scheme: program.scheme,
    medicine: program.medicine,
    facilities: program.facilities,
    youthOpportunity: program.youthOpportunity,
    headCoachName: `Coach ${program.recruiterName.split(" ").at(-1) ?? program.recruiterName}`,
    recruiterName: program.recruiterName,
  };
}

function appendMemory(npc: RelationshipNpc, save: CareerSave, summary: string, impact: number): RelationshipNpc {
  return {
    ...npc,
    relationship: clamp(npc.relationship + impact, -100, 100),
    currentSituation: summary,
    status: impact >= 0 ? "hopeful" : "concerned",
    memories: [
      ...npc.memories,
      {
        id: `${save.meta.worldSeed}:college:${npc.id}:${save.life.completedDays}:${summary}`,
        date: save.meta.currentDate,
        summary,
        impact,
        importance: 5 as const,
      },
    ].slice(-12),
  };
}

export function signCollegeAgreement(save: CareerSave, programId: string, route: CollegeEntryRoute): CareerSave {
  if (save.football.season.phase !== "complete") throw new Error("High school season must be complete before signing");
  if (save.football.college.status !== "high-school") throw new Error("College agreement is already signed");
  const program = save.football.recruitment.programs.find((candidate) => candidate.id === programId);
  if (!program) throw new Error("Unknown college program");
  const availableRoute = collegeEntryRouteFor(save, program);
  if (availableRoute !== route) throw new Error("College entry route is no longer available");
  const commitment = save.football.recruitment.commitment;
  if (commitment && commitment.programId !== programId) throw new Error("Withdraw the current verbal commitment before signing elsewhere");

  const title = route === "scholarship" ? `Стипендия ${program.shortName} подписана` : `${program.shortName}: место preferred walk-on принято`;
  const detail = route === "scholarship"
    ? `Формальное соглашение закрепило полную спортивную стипендию и завершило школьный рекрутинг.`
    : `Игрок принял место без гарантированной спортивной стипендии. Состав и помощь придётся забирать в лагере.`;
  const guardianImpact = route === "scholarship" ? 5 : program.distanceMiles > 900 ? -2 : 1;
  const coachImpact = program.fit >= 65 ? 4 : 1;

  return {
    ...save,
    football: {
      ...save.football,
      college: {
        ...save.football.college,
        status: "signed",
        entryRoute: route,
        signedProgramId: program.id,
        signedDate: save.meta.currentDate,
        program: programIdentity(program),
        projectedRole: program.projectedRole,
      },
      recruitment: {
        ...save.football.recruitment,
        commitment: {
          programId: program.id,
          status: "signed",
          committedWeek: commitment?.committedWeek ?? save.football.season.week,
          committedDate: commitment?.committedDate ?? save.meta.currentDate,
          confidence: commitment?.confidence ?? clamp(program.interest * 0.55 + program.staffTrust * 0.25 + program.roleClarity * 0.2),
          signedDate: save.meta.currentDate,
          entryRoute: route,
        },
        activity: [
          {
            id: `${save.meta.worldSeed}:signing:${program.id}:${save.life.completedDays}`,
            week: save.football.season.week,
            programId: program.id,
            date: save.meta.currentDate,
            kind: "signing" as const,
            title,
            detail,
          },
          ...save.football.recruitment.activity,
        ].slice(0, 40),
      },
    },
    relationships: {
      ...save.relationships,
      pendingEvent: undefined,
      npcs: save.relationships.npcs.map((npc) => {
        if (npc.role === "guardian") return appendMemory(npc, save, `${save.character.identity.fullName} формально выбрал ${program.shortName}.`, guardianImpact);
        if (npc.role === "head-coach") return appendMemory(npc, save, `Школьный тренер завершил рекрутинг игрока после выбора ${program.shortName}.`, coachImpact);
        return npc;
      }),
    },
    history: [
      ...save.history,
      {
        id: `${save.meta.worldSeed}:college-signing:${program.id}`,
        occurredAt: save.meta.updatedAt,
        type: "college-signed",
        title,
        description: detail,
      },
    ],
  };
}

function roleScore(role: ProjectedCollegeRole): number {
  return { "immediate-competition": 18, "rotation-path": 9, developmental: 1, "long-shot": -7 }[role];
}

function actualRole(rank: number): ProjectedCollegeRole {
  if (rank <= 2) return "immediate-competition";
  if (rank === 3) return "rotation-path";
  if (rank <= 5) return "developmental";
  return "long-shot";
}

function createPositionRoom(save: CareerSave, program: RecruitingProgram, heroOverall: number): CollegePositionPlayer[] {
  const random = new SeededRandom(`${save.meta.worldSeed}:college-room:${program.id}:${save.football.position}`);
  const size = Math.max(4, Math.min(7, 4 + Math.round(program.depthCompetition / 33)));
  const years: CollegePlayerYear[] = ["Senior", "Junior", "Sophomore", "Freshman"];
  const room: CollegePositionPlayer[] = [];
  for (let index = 0; index < size; index += 1) {
    const experience = size - index;
    const base = 52 + program.prestige * 0.24 + program.depthCompetition * 0.17 + experience * 1.8;
    room.push({
      id: `${program.id}:room:${save.football.position}:${index}`,
      name: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
      year: years[Math.min(years.length - 1, index)] ?? "Freshman",
      overall: clamp(base + random.integer(-7, 7), 48, 92),
      style: random.pick(STYLES),
      redshirt: index === size - 1 && random.chance(0.45),
      depthRank: 0,
      isHero: false,
    });
  }
  room.push({
    id: "hero",
    name: save.character.identity.fullName,
    year: "Freshman",
    overall: clamp(heroOverall),
    style: save.football.archetypeName,
    redshirt: false,
    depthRank: 0,
    isHero: true,
  });
  const projected = program.projectedRole;
  const heroScore = heroOverall + roleScore(projected) * (program.roleClarity / 100) + program.youthOpportunity * 0.06;
  return room
    .map((player) => ({ player, score: player.isHero ? heroScore : player.overall + (player.year === "Senior" ? 6 : player.year === "Junior" ? 4 : player.year === "Sophomore" ? 2 : 0) }))
    .sort((left, right) => right.score - left.score)
    .map(({ player }, index) => ({ ...player, depthRank: index + 1 }));
}

function promiseAssessment(program: RecruitingProgram, projected: ProjectedCollegeRole, actual: ProjectedCollegeRole): { verdict: "kept" | "uncertain" | "misleading"; summary: string } {
  const order: ProjectedCollegeRole[] = ["immediate-competition", "rotation-path", "developmental", "long-shot"];
  const projectedIndex = order.indexOf(projected);
  const actualIndex = order.indexOf(actual);
  const credibility = program.promises.length > 0
    ? program.promises.reduce((sum, promise) => sum + promise.credibility, 0) / program.promises.length
    : program.staffTrust;
  if (actualIndex <= projectedIndex && credibility >= 55) {
    return { verdict: "kept", summary: "Первые повторы совпадают с тем, что штаб обещал во время рекрутинга." };
  }
  if (actualIndex <= projectedIndex + 1 || credibility >= 62) {
    return { verdict: "uncertain", summary: "Штаб не отказался от обещаний, но реальный путь оказался длиннее и зависит от лагеря." };
  }
  return { verdict: "misleading", summary: "После приезда глубина состава выглядит хуже, чем её описывали во время рекрутинга." };
}

function offseasonGrade(score: number): "A" | "B" | "C" | "D" {
  if (score >= 78) return "A";
  if (score >= 64) return "B";
  if (score >= 49) return "C";
  return "D";
}

function dateAfterBirthday(birthDate: string, date: GameDate): number {
  const [yearText, monthText, dayText] = birthDate.split("-");
  const birthYear = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  let age = date.year - birthYear;
  if (date.month < month || (date.month === month && date.day < day)) age -= 1;
  return age;
}

export function reportToCollege(save: CareerSave): CareerSave {
  const college = save.football.college;
  if (college.status !== "signed" || !college.signedProgramId || !college.entryRoute) throw new Error("College agreement must be signed first");
  const program = save.football.recruitment.programs.find((candidate) => candidate.id === college.signedProgramId);
  if (!program) throw new Error("Signed college program is missing");
  const arrivalDate: GameDate = { year: 2027, month: 8, day: 9 };
  const random = new SeededRandom(`${save.meta.worldSeed}:offseason:${program.id}`);
  const discipline = save.character.personality.discipline;
  const healthBase = save.football.training.body.medicalStatus === "cleared" ? 8 : save.football.training.body.medicalStatus === "questionable" ? 2 : -5;
  const trainingScore = clamp(discipline * 0.42 + save.football.staff.positionCoach.development * 0.22 + save.character.condition.health * 0.18 + random.integer(-10, 11));
  const grade = offseasonGrade(trainingScore);
  const overallDelta = round(Math.max(0.3, (trainingScore - 42) * 0.035), 1);
  const weightDelta = random.integer(-2, 7) + (save.football.position === "LB" || save.football.position === "RB" ? 2 : 0);
  const gpaDelta = round((save.character.personality.discipline - 55) * 0.002 + random.integer(-4, 6) / 100, 2);
  const healthDelta = round(healthBase + random.integer(-3, 4), 1);
  const confidenceDelta = round((grade === "A" ? 5 : grade === "B" ? 2 : grade === "D" ? -3 : 0) + random.integer(-1, 2), 1);
  const nextOverall = clamp(save.football.ratings.overall + overallDelta, 45, 99);
  const room = createPositionRoom(save, program, nextOverall);
  const hero = room.find((player) => player.isHero);
  if (!hero) throw new Error("College position room has no hero");
  const role = actualRole(hero.depthRank);
  const assessment = promiseAssessment(program, program.projectedRole, role);
  const summary = grade === "A"
    ? "Выпускной семестр прошёл собранно: тело стало крепче, оценки удержаны, на кампус игрок приехал готовым к нагрузке."
    : grade === "B"
      ? "Межсезонье прошло ровно. Прогресс есть, но колледж сразу показывает более высокий темп и плотность конкуренции."
      : grade === "C"
        ? "Подготовка была неровной. Игрок приехал без критических проблем, но часть преимущества потеряна ещё до лагеря."
        : "Переход получился тяжёлым: режим распался, физическая готовность отстаёт, а штаб не собирается ждать репутацию школьной звезды.";

  const nextCollege: FootballCollegeState = {
    ...college,
    status: "orientation",
    program: programIdentity(program),
    positionRoom: room,
    depthRank: hero.depthRank,
    actualRole: role,
    promiseVerdict: assessment.verdict,
    promiseSummary: assessment.summary,
    offseason: {
      startDate: save.meta.currentDate,
      arrivalDate,
      trainingGrade: grade,
      overallDelta,
      weightDelta,
      gpaDelta,
      healthDelta,
      confidenceDelta,
      summary,
    },
    arrivalDate,
  };

  return {
    ...save,
    meta: {
      ...save.meta,
      phase: "college-orientation",
      currentDate: arrivalDate,
    },
    character: {
      ...save.character,
      identity: {
        ...save.character.identity,
        age: dateAfterBirthday(save.character.identity.birthDate, arrivalDate),
      },
      physical: {
        ...save.character.physical,
        weightLbs: Math.max(130, Math.min(360, save.character.physical.weightLbs + weightDelta)),
      },
      education: {
        ...save.character.education,
        gpa: Math.max(0, Math.min(4, round(save.character.education.gpa + gpaDelta, 2))),
        eligibilityStatus: save.character.education.gpa + gpaDelta >= 2.5 ? "clear" : save.character.education.gpa + gpaDelta >= 2.1 ? "watch" : "at-risk",
      },
      condition: {
        ...save.character.condition,
        energy: clamp(82 + random.integer(-5, 6)),
        fatigue: clamp(16 + random.integer(-4, 7)),
        stress: clamp(35 + program.prestige * 0.12 + random.integer(-6, 6)),
        confidence: clamp(save.character.condition.confidence + confidenceDelta),
        health: clamp(save.character.condition.health + healthDelta),
        sleepHours: round(7.1 + random.integer(-5, 5) / 10, 1),
      },
    },
    life: {
      ...save.life,
      weekNumber: 1,
      dayIndex: 0,
      lastOutcome: undefined,
    },
    football: {
      ...save.football,
      stage: "college-orientation",
      ratings: {
        ...save.football.ratings,
        overall: nextOverall,
        athleticism: clamp(save.football.ratings.athleticism + overallDelta * 0.55),
        technique: clamp(save.football.ratings.technique + overallDelta * 0.25),
        footballIq: clamp(save.football.ratings.footballIq + overallDelta * 0.2),
      },
      college: nextCollege,
    },
    relationships: {
      ...save.relationships,
      pendingEvent: undefined,
      queuedEvents: [],
      npcs: save.relationships.npcs.map((npc) => {
        if (npc.role === "guardian") return appendMemory(npc, save, `${save.character.identity.fullName} уехал в ${program.city} и начал первый год в ${program.shortName}.`, program.distanceMiles > 1000 ? -1 : 3);
        if (npc.role === "head-coach") return appendMemory(npc, save, `Школьная работа завершена: игрок прибыл в ${program.shortName}.`, 3);
        return npc;
      }),
    },
    history: [
      ...save.history,
      {
        id: `${save.meta.worldSeed}:high-school-complete`,
        occurredAt: save.meta.updatedAt,
        type: "high-school-completed",
        title: `Школьная карьера завершена: ${save.football.season.wins}–${save.football.season.losses}`,
        description: `Последний сезон завершён. ${save.football.season.awards.length} наград, итоговая оценка плёнки ${Math.round(save.football.recruitment.filmGrade)}.`,
      },
      {
        id: `${save.meta.worldSeed}:college-arrival:${program.id}`,
        occurredAt: save.meta.updatedAt,
        type: "college-arrival",
        title: `Прибытие в ${program.shortName}`,
        description: `${summary} Стартовое место в позиционной комнате: #${hero.depthRank}. ${assessment.summary}`,
      },
    ],
  };
}

export function setCollegeOnboardingPriority(save: CareerSave, priority: CollegeOnboardingPriority): CareerSave {
  if (save.meta.phase !== "college-orientation" || save.football.college.status !== "orientation") throw new Error("College orientation is not active");
  if (save.football.college.onboardingPriority) throw new Error("College onboarding priority is already locked");
  const effects = {
    "compete-now": { confidence: 3, stress: 4, footballIq: 0.2, gpa: 0, label: "Сразу бороться за повторы" },
    "learn-system": { confidence: 1, stress: -1, footballIq: 0.8, gpa: 0, label: "Сначала выучить систему" },
    "academic-base": { confidence: 0, stress: -2, footballIq: 0.2, gpa: 0.06, label: "Закрепить учебный фундамент" },
  }[priority];
  return {
    ...save,
    character: {
      ...save.character,
      education: { ...save.character.education, gpa: Math.min(4, round(save.character.education.gpa + effects.gpa, 2)) },
      condition: {
        ...save.character.condition,
        confidence: clamp(save.character.condition.confidence + effects.confidence),
        stress: clamp(save.character.condition.stress + effects.stress),
      },
    },
    football: {
      ...save.football,
      ratings: { ...save.football.ratings, footballIq: clamp(save.football.ratings.footballIq + effects.footballIq) },
      college: { ...save.football.college, onboardingPriority: priority },
    },
    history: [
      ...save.history,
      {
        id: `${save.meta.worldSeed}:college-priority:${priority}`,
        occurredAt: save.meta.updatedAt,
        type: "college-priority-set",
        title: effects.label,
        description: "Игрок определил первый приоритет перед началом университетского лагеря.",
      },
    ],
  };
}
