import { addGameDays, type GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { getRecruitingAdvice, recruitingDecisionSnapshot } from "./decisionSupport";
import type {
  OfficialVisit,
  RecruitingActivity,
  RecruitingProgram,
  RecruitingPromise,
  RecruitingPromiseCategory,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function gameDateKey(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function activity(
  save: CareerSave,
  kind: RecruitingActivity["kind"],
  title: string,
  detail: string,
  programId?: string,
): RecruitingActivity {
  return {
    id: `${save.meta.worldSeed}:recruiting:${save.life.completedDays}:${kind}:${programId ?? "global"}:${title}`,
    week: save.football.season.week,
    ...(programId ? { programId } : {}),
    date: save.meta.currentDate,
    kind,
    title,
    detail,
  };
}

function promiseCategory(program: RecruitingProgram, random: SeededRandom): RecruitingPromiseCategory {
  if (program.recruiterStyle === "analytical") return "development";
  if (program.recruiterStyle === "direct") return random.pick(["role", "scheme"] as const);
  if (program.recruiterStyle === "patient") return random.pick(["development", "stability"] as const);
  return random.pick(["role", "scheme", "stability"] as const);
}

function promiseStatement(program: RecruitingProgram, category: RecruitingPromiseCategory): string {
  if (category === "role") {
    return {
      "immediate-competition": "В лагере дадут реальные повторы с первой и второй группой.",
      "rotation-path": "В первый год видят путь через специальные команды и позиционную ротацию.",
      developmental: "Первый сезон будет посвящён набору тела и изучению системы.",
      "long-shot": "Место в составе придётся забирать без обещанного количества повторений.",
    }[program.projectedRole];
  }
  if (category === "development") return `Штаб обещает персональный план развития и регулярную работу с позиционным тренером.`;
  if (category === "scheme") return `Твой профиль хотят использовать в системе «${program.scheme}», а не менять позицию сразу после приезда.`;
  return "Рекрутер утверждает, что роль сохранится даже при изменении результата первых матчей сезона.";
}

export function createRecruiterPromise(
  program: RecruitingProgram,
  week: number,
  source: RecruitingPromise["source"],
  namespace: string,
): RecruitingPromise {
  const random = new SeededRandom(`${program.seed}:promise:${week}:${source}:${namespace}`);
  const category = promiseCategory(program, random);
  const styleBase = { direct: 78, patient: 72, analytical: 84, salesman: 44 }[program.recruiterStyle];
  const credibility = clamp(
    styleBase * 0.56 + program.staffTrust * 0.2 + program.roleClarity * 0.16 + (100 - program.depthCompetition) * 0.08 + random.integer(-7, 7),
  );
  return {
    id: `${program.id}:promise:${week}:${source}:${category}:${program.promises.length + 1}`,
    category,
    statement: promiseStatement(program, category),
    credibility,
    source,
    madeWeek: week,
  };
}

export function scheduleOfficialVisitForProgram(save: CareerSave, program: RecruitingProgram): RecruitingProgram {
  if (save.football.recruitment.commitment) throw new Error("Recruiting is closed by a verbal commitment");
  if (program.visitStatus !== "invited") throw new Error("Program has not offered an official visit");
  if (save.football.recruitment.programs.some((candidate) => candidate.id !== program.id && candidate.visitStatus === "scheduled")) {
    throw new Error("Another official visit is already scheduled");
  }
  const daysUntilSunday = save.life.dayIndex === 6 ? 7 : 6 - save.life.dayIndex;
  const scheduledDate = addGameDays(save.meta.currentDate, daysUntilSunday);
  const visit: OfficialVisit = {
    id: `${program.id}:visit:${save.football.season.week}`,
    status: "scheduled",
    scheduledWeek: save.football.season.week,
    scheduledDate,
    dueCompletedDay: save.life.completedDays + daysUntilSunday,
  };
  return {
    ...program,
    visitStatus: "scheduled",
    officialVisit: visit,
    contactQuality: clamp(program.contactQuality + 6),
    lastUpdate: `Официальный визит назначен на ${gameDateKey(scheduledDate)}.`,
    playerRead: "До поездки у тебя есть только слова рекрутера. Реальную атмосферу и роль ещё нужно проверить на месте.",
  };
}

function resolveOfficialVisit(save: CareerSave, program: RecruitingProgram): RecruitingProgram {
  const visit = program.officialVisit;
  if (!visit || visit.status !== "scheduled") return program;
  const random = new SeededRandom(`${program.seed}:official-visit:${visit.dueCompletedDay}`);
  const campusFit = clamp(program.facilities * 0.34 + program.prestige * 0.16 + save.character.personality.adaptability * 0.2 + random.integer(5, 22));
  const staffConnection = clamp(program.contactQuality * 0.34 + program.staffTrust * 0.24 + (program.recruiterStyle === "salesman" ? 8 : 18));
  const roleClarity = clamp(
    program.roleClarity * 0.4 + program.positionNeed * 0.27 + (100 - program.depthCompetition) * 0.18 + random.integer(4, 17),
  );
  const familyComfort = clamp(
    91 - program.distanceMiles / 21 + program.medicine * 0.18 + (program.academicEligible ? 8 : -18) + random.integer(-7, 7),
  );
  const warning =
    program.depthCompetition >= 84
      ? "В комнате уже несколько сильных игроков. Штаб не показал точный план распределения повторений."
      : program.recruiterStyle === "salesman" && roleClarity < 62
        ? "Подача рекрутера была яркой, но ответы по роли остались расплывчатыми."
        : program.medicalConcern
          ? "Медицинский штаб снова поднял вопрос о нагрузке и запросил дополнительные данные."
          : program.academicEligible === false
            ? "Спортивная часть визита прошла хорошо, но академический допуск всё ещё не закрыт."
            : "Критического красного флага не появилось.";
  const overallImpression = clamp(
    campusFit * 0.24 + staffConnection * 0.24 + roleClarity * 0.24 + familyComfort * 0.15 + program.fit * 0.13,
  );
  const promise = createRecruiterPromise(
    { ...program, roleClarity, staffTrust: clamp(program.staffTrust + (staffConnection - 50) * 0.18) },
    save.football.season.week,
    "official-visit",
    String(visit.dueCompletedDay),
  );
  const completedVisit: OfficialVisit = {
    ...visit,
    status: "completed",
    completedWeek: save.football.season.week,
    completedDate: save.meta.currentDate,
    campusFit,
    staffConnection,
    roleClarity,
    familyComfort,
    overallImpression,
    summary: `${program.shortName}: кампус ${Math.round(campusFit)}, связь со штабом ${Math.round(staffConnection)}, ясность роли ${Math.round(roleClarity)}.`,
    warning,
  };
  let offer = program.offer;
  let stage = program.stage;
  const interest = clamp(program.interest + (overallImpression - 55) * 0.12 + 4);
  const scoutingConfidence = clamp(program.scoutingConfidence + 8);
  if (
    !offer &&
    interest >= 79 &&
    scoutingConfidence >= 64 &&
    program.academicEligible &&
    !program.medicalConcern &&
    program.positionNeed >= 52 &&
    random.chance(program.tier === "national" ? 0.28 : program.tier === "power" ? 0.48 : 0.72)
  ) {
    offer = {
      id: `${program.id}:offer:visit:${save.football.season.week}`,
      issuedWeek: save.football.season.week,
      scholarship: "full",
      projectedRole: program.projectedRole,
      expiresAfterWeek: Math.max(save.football.season.week + 3, 8),
    };
    stage = "offered";
  }
  const next: RecruitingProgram = {
    ...program,
    interest,
    scoutingConfidence,
    stage,
    contactQuality: clamp(program.contactQuality + 12),
    roleClarity,
    staffTrust: clamp(program.staffTrust + (staffConnection - 50) * 0.2),
    visitStatus: "completed",
    officialVisit: completedVisit,
    promises: [...program.promises, promise].slice(-5),
    playerRead: `${completedVisit.summary} ${warning}`,
    lastUpdate: offer && !program.offer ? "После официального визита программа предложила полную стипендию." : "Официальный визит завершён. Теперь оценка опирается не только на рекрутинговую подачу.",
    ...(offer ? { offer } : {}),
  };
  return next;
}

function addNpcMemory(
  save: CareerSave,
  npcRole: "guardian" | "head-coach",
  summary: string,
  impact: number,
): CareerSave["relationships"] {
  return {
    ...save.relationships,
    npcs: save.relationships.npcs.map((npc) => {
      if (npc.role !== npcRole) return npc;
      return {
        ...npc,
        relationship: clamp(npc.relationship + impact, -100, 100),
        memories: [
          ...npc.memories,
          {
            id: `${save.meta.worldSeed}:memory:${npc.id}:${save.life.completedDays}:${summary}`,
            date: save.meta.currentDate,
            summary,
            impact,
            importance: 4 as const,
          },
        ].slice(-12),
      };
    }),
  };
}

export function advanceRecruitingWorld(save: CareerSave): CareerSave {
  const state = save.football.recruitment;
  const activities: RecruitingActivity[] = [];
  const history = [...save.history];
  let condition = save.character.condition;
  let relationships = save.relationships;
  const programs = state.programs.map((program) => {
    let next = program;
    if (
      next.offer &&
      state.commitment?.programId !== next.id &&
      save.football.season.week > next.offer.expiresAfterWeek
    ) {
      const expiration = activity(save, "expiration", `${next.shortName}: предложение истекло`, "Программа не стала держать стипендию открытой после внутреннего дедлайна.", next.id);
      activities.push(expiration);
      history.push({ id: expiration.id, occurredAt: save.meta.updatedAt, type: "recruiting-offer-expired", title: expiration.title, description: expiration.detail });
      next = { ...next, offer: undefined, stage: "cooled", lastUpdate: expiration.detail };
    }

    if (
      next.visitStatus === "scheduled" &&
      next.officialVisit?.dueCompletedDay !== undefined &&
      save.life.completedDays >= next.officialVisit.dueCompletedDay
    ) {
      const resolved = resolveOfficialVisit(save, next);
      const visitActivity = activity(save, "visit", `Визит в ${resolved.shortName} завершён`, resolved.playerRead, resolved.id);
      activities.push(visitActivity);
      history.push({ id: visitActivity.id, occurredAt: save.meta.updatedAt, type: "official-visit-completed", title: visitActivity.title, description: visitActivity.detail });
      condition = {
        ...condition,
        energy: clamp(condition.energy - Math.min(8, resolved.distanceMiles / 250)),
        fatigue: clamp(condition.fatigue + Math.min(7, resolved.distanceMiles / 280)),
        stress: clamp(condition.stress + (resolved.officialVisit?.overallImpression && resolved.officialVisit.overallImpression >= 72 ? -2 : 2)),
      };
      const familyImpact = resolved.officialVisit?.familyComfort && resolved.officialVisit.familyComfort >= 65 ? 2 : -1;
      relationships = addNpcMemory({ ...save, relationships }, "guardian", `Официальный визит в ${resolved.shortName}: ${resolved.officialVisit?.warning ?? "визит завершён"}`, familyImpact);
      return resolved;
    }

    if (
      !state.commitment &&
      save.life.dayIndex === 0 &&
      next.visitStatus === "none" &&
      (next.stage === "priority" || next.stage === "offered") &&
      next.interest >= 70 &&
      next.scoutingConfidence >= 52
    ) {
      const random = new SeededRandom(`${next.seed}:visit-invite:${save.football.season.week}`);
      const chance = next.offer ? 0.86 : next.tier === "national" ? 0.24 : next.tier === "power" ? 0.42 : 0.62;
      if (random.chance(chance)) {
        const invite = activity(save, "visit", `${next.shortName} пригласил на официальный визит`, "Программа готова оплатить поездку и провести встречу со штабом, игроками и академической службой.", next.id);
        activities.push(invite);
        history.push({ id: invite.id, occurredAt: save.meta.updatedAt, type: "official-visit-invited", title: invite.title, description: invite.detail });
        return { ...next, visitStatus: "invited" as const, lastUpdate: invite.detail };
      }
    }
    return next;
  });

  const interestedPrograms = programs.filter((program) => !["unaware", "cooled"].includes(program.stage)).length;
  const offers = programs.filter((program) => Boolean(program.offer)).length;
  return {
    ...save,
    character: { ...save.character, condition },
    relationships,
    football: {
      ...save.football,
      recruitment: {
        ...state,
        programs,
        interestedPrograms,
        offers,
        activity: [...activities, ...state.activity].slice(0, 60),
      },
    },
    history,
  };
}

export function commitToCollege(save: CareerSave, programId: string): CareerSave {
  const state = save.football.recruitment;
  if (state.commitment) throw new Error("Player already has a verbal commitment");
  const program = state.programs.find((candidate) => candidate.id === programId);
  if (!program?.offer) throw new Error("Program has not offered a scholarship");
  if (!program.academicEligible) throw new Error("Academic clearance is not complete");
  if (save.football.season.week > program.offer.expiresAfterWeek) throw new Error("Offer has expired");

  const snapshot = recruitingDecisionSnapshot(program);
  const advice = getRecruitingAdvice(save);
  const random = new SeededRandom(`${program.seed}:commit:${save.football.season.week}`);
  const programs = state.programs.map((candidate) => {
    if (candidate.id === programId) {
      return { ...candidate, lastUpdate: "Игрок дал программе устное согласие и закрыл активный рекрутинг." };
    }
    if (["unaware", "cooled"].includes(candidate.stage)) return candidate;
    const keepRecruiting = candidate.interest >= 72 && random.fork(candidate.id).chance(0.38);
    return keepRecruiting
      ? { ...candidate, interest: clamp(candidate.interest - 8), lastUpdate: "После устного коммита программа продолжает следить, но больше не контролирует процесс." }
      : { ...candidate, stage: "cooled" as const, interest: clamp(candidate.interest - 15), lastUpdate: "После устного коммита программа переключила стипендию на другого игрока." };
  });
  const commitment = {
    programId,
    status: "verbal" as const,
    committedWeek: save.football.season.week,
    committedDate: save.meta.currentDate,
    confidence: snapshot.overall,
  };
  const record = activity(save, "commitment", `Устный коммит в ${program.shortName}`, `Выбрана полная стипендия. Уверенность в решении: ${Math.round(snapshot.overall)}. ${snapshot.risk}`, program.id);
  let relationships = save.relationships;
  const guardianImpact = advice.guardian.programId === programId ? 3 : -1;
  const coachImpact = advice.coach.programId === programId ? 3 : 1;
  relationships = addNpcMemory({ ...save, relationships }, "guardian", `Выбор колледжа: ${program.shortName}. ${advice.guardian.title}`, guardianImpact);
  relationships = addNpcMemory({ ...save, relationships }, "head-coach", `Устный коммит в ${program.shortName}. ${advice.coach.title}`, coachImpact);

  return {
    ...save,
    character: {
      ...save.character,
      condition: {
        ...save.character.condition,
        stress: clamp(save.character.condition.stress - 5),
        confidence: clamp(save.character.condition.confidence + 3),
      },
    },
    relationships,
    football: {
      ...save.football,
      recruitment: {
        ...state,
        commitment,
        programs,
        interestedPrograms: programs.filter((candidate) => !["unaware", "cooled"].includes(candidate.stage)).length,
        activity: [record, ...state.activity].slice(0, 60),
      },
    },
    history: [
      ...save.history,
      { id: record.id, occurredAt: save.meta.updatedAt, type: "college-verbal-commitment", title: record.title, description: record.detail },
    ],
  };
}

export function withdrawCollegeCommitment(save: CareerSave): CareerSave {
  const state = save.football.recruitment;
  const commitment = state.commitment;
  if (!commitment) throw new Error("No commitment to withdraw");
  const program = state.programs.find((candidate) => candidate.id === commitment.programId);
  if (!program) throw new Error("Committed program is missing");
  const programs = state.programs.map((candidate) =>
    candidate.id === program.id
      ? { ...candidate, stage: "cooled" as const, offer: undefined, interest: clamp(candidate.interest - 28), lastUpdate: "После отказа программа закрыла набор на этой позиции." }
      : candidate,
  );
  const record = activity(save, "commitment", `Коммит в ${program.shortName} отозван`, "Решение вернуло игрока на рынок, но часть программ уже перераспределила стипендии.", program.id);
  let relationships = addNpcMemory(save, "guardian", `Устный коммит в ${program.shortName} был отозван.`, -3);
  relationships = addNpcMemory({ ...save, relationships }, "head-coach", `Игрок отозвал коммит в ${program.shortName}.`, -3);
  return {
    ...save,
    character: {
      ...save.character,
      condition: {
        ...save.character.condition,
        stress: clamp(save.character.condition.stress + 7),
        confidence: clamp(save.character.condition.confidence - 3),
      },
    },
    relationships,
    football: {
      ...save.football,
      recruitment: {
        ...state,
        commitment: undefined,
        decommitments: state.decommitments + 1,
        visibility: clamp(state.visibility - 6),
        coachRecommendation: clamp(state.coachRecommendation - 4),
        programs,
        interestedPrograms: programs.filter((candidate) => !["unaware", "cooled"].includes(candidate.stage)).length,
        offers: programs.filter((candidate) => Boolean(candidate.offer)).length,
        activity: [record, ...state.activity].slice(0, 60),
      },
    },
    history: [
      ...save.history,
      { id: record.id, occurredAt: save.meta.updatedAt, type: "college-decommitment", title: record.title, description: record.detail },
    ],
  };
}
