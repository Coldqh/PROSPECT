import { advanceLifeDay } from "../../../core/life/advanceLifeDay";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceFootballEcosystem } from "../ecosystem/simulateEcosystem";
import type { EcosystemCompetitionGame, EcosystemPlayer, EcosystemSocialBond } from "../ecosystem/types";
import { resolveTrainingDay } from "../training/resolveTrainingDay";
import type {
  CollegeHeroDecision,
  CollegeHeroGameLog,
  CollegeHeroRole,
  CollegeHeroWeekLog,
  CollegePositionPlayer,
  CollegePromiseStatus,
  CollegeRedshirtStatus,
  CollegeTransferIntent,
  FootballCollegeHeroCareer,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function calculateOverall(ratings: CareerSave["football"]["ratings"]): number {
  return clamp(
    ratings.athleticism * 0.34
      + ratings.technique * 0.31
      + ratings.footballIq * 0.2
      + ratings.competitiveness * 0.15,
    45,
    99,
  );
}

function roleForDepth(depthRank: number, available: boolean): CollegeHeroRole {
  if (!available) return "developmental";
  if (depthRank <= 1) return "starter";
  if (depthRank === 2) return "rotation";
  if (depthRank === 3) return "special-teams";
  return "developmental";
}

function usagePlanForRole(role: CollegeHeroRole): EcosystemPlayer["usagePlan"] {
  return role === "starter"
    ? "starter"
    : role === "rotation"
      ? "rotation"
      : role === "special-teams"
        ? "special-teams"
        : "developmental";
}

function gradeScore(grade: "A" | "B" | "C" | "D"): number {
  return { A: 4, B: 2, C: 0, D: -3 }[grade];
}

function gradeForScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 78) return "A";
  if (score >= 64) return "B";
  if (score >= 49) return "C";
  return "D";
}

function headCoachBond(save: CareerSave, teamId: string): EcosystemSocialBond | undefined {
  const headCoach = save.world.coaches.find((coach) => coach.teamId === teamId && coach.role === "head-coach");
  if (!headCoach) return undefined;
  return save.world.social.bonds.find((bond) => bond.active
    && bond.teamId === teamId
    && ((bond.entityAId === "hero" && bond.entityBId === headCoach.id) || (bond.entityBId === "hero" && bond.entityAId === headCoach.id)));
}

function lockerRoomStanding(save: CareerSave, teamId: string): number {
  const culture = save.world.social.teamCultures.find((item) => item.teamId === teamId);
  const bonds = save.world.social.bonds.filter((bond) => bond.active
    && bond.teamId === teamId
    && (bond.entityAId === "hero" || bond.entityBId === "hero")
    && bond.kind !== "coach-player");
  const respect = bonds.length > 0
    ? bonds.reduce((sum, bond) => sum + bond.respect * 0.55 + bond.trust * 0.25 + (100 - bond.tension) * 0.2, 0) / bonds.length
    : 50;
  return clamp(respect * 0.6 + (culture?.leadership ?? 50) * 0.18 + (culture?.cohesion ?? 50) * 0.22);
}

export function syncCollegePositionRoom(save: CareerSave): CollegePositionPlayer[] {
  const teamId = save.football.college.signedProgramId;
  if (!teamId) return save.football.college.positionRoom;
  const room = save.world.players
    .filter((player) => player.teamId === teamId && player.position === save.football.position)
    .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall)
    .map((player) => ({
      id: player.id,
      name: player.name,
      year: player.classYear,
      overall: round(player.overall, 1),
      style: player.tactical.archetype.replaceAll("-", " "),
      redshirt: player.usagePlan === "redshirt" || player.eligibility.redshirtUsed,
      depthRank: player.depthRank,
      isHero: player.isHero,
    }));
  return room.some((player) => player.isHero) ? room : save.football.college.positionRoom;
}

function createPromise(save: CareerSave): FootballCollegeHeroCareer["promises"] {
  const targetRole = save.football.college.projectedRole;
  if (!targetRole) return [];
  return [{
    id: `${save.meta.worldSeed}:college-promise:playing-time`,
    kind: "playing-time",
    targetRole,
    madeWeek: 1,
    deadlineWeek: targetRole === "immediate-competition" ? 4 : targetRole === "rotation-path" ? 6 : 8,
    status: "active",
    summary: save.football.college.promiseSummary ?? "Штаб будет оцениваться по реальному месту героя в ротации.",
  }];
}

export function createCollegeHeroCareer(save: CareerSave): FootballCollegeHeroCareer {
  const teamId = save.football.college.signedProgramId;
  if (!teamId) throw new Error("College program is missing");
  const hero = save.world.players.find((player) => player.isHero && player.teamId === teamId);
  if (!hero) throw new Error("Hero is not placed in the college ecosystem");
  const available = hero.status !== "injured" && hero.eligibility.athleticallyEligible;
  const role = roleForDepth(hero.depthRank, available);
  const coachBond = headCoachBond(save, teamId);
  const program = save.football.college.program;
  const coachTrust = clamp((coachBond?.trust ?? 50) * 0.72 + (program?.youthOpportunity ?? 50) * 0.28);
  return {
    version: 1,
    teamId,
    seasonYear: save.world.seasonYear,
    week: Math.max(1, save.world.seasonWeek),
    role,
    depthRank: hero.depthRank,
    coachTrust,
    lockerRoomStanding: lockerRoomStanding(save, teamId),
    practiceReps: role === "starter" ? 68 : role === "rotation" ? 48 : role === "special-teams" ? 28 : 14,
    weeklyPracticeGrade: "C",
    seasonSnaps: 0,
    gamesPlayed: 0,
    starts: 0,
    redshirtStatus: role === "developmental" ? "candidate" : "active",
    transferIntent: "stay",
    promises: createPromise(save),
    gameLog: [],
    weekLog: [],
    lastSummary: `Лагерь открыт. Герой занимает #${hero.depthRank} и начинает сезон в роли «${role}».`,
  };
}

function completedHeroGames(save: CareerSave, career: FootballCollegeHeroCareer): EcosystemCompetitionGame[] {
  const logged = new Set(career.gameLog.map((game) => game.id));
  return save.world.competition.schedule
    .filter((game) => game.status === "complete"
      && game.seasonYear === save.world.seasonYear
      && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId)
      && !logged.has(game.id))
    .sort((left, right) => left.week - right.week || left.id.localeCompare(right.id));
}

function gameLogFor(
  save: CareerSave,
  career: FootballCollegeHeroCareer,
  game: EcosystemCompetitionGame,
  hero: EcosystemPlayer,
): CollegeHeroGameLog {
  const random = new SeededRandom(`${save.meta.worldSeed}:hero-game:${game.id}`);
  const roleBase = { starter: 58, rotation: 28, "special-teams": 12, developmental: 0 }[career.role];
  const availability = hero.status === "injured" || !hero.eligibility.athleticallyEligible ? 0 : 1;
  const snaps = Math.max(0, Math.round((roleBase
    + (hero.form - 50) * 0.16
    + (career.coachTrust - 50) * 0.1
    + random.integer(-6, 7)) * availability));
  const heroHome = game.homeTeamId === career.teamId;
  const heroScore = heroHome ? game.homeScore ?? 0 : game.awayScore ?? 0;
  const opponentScore = heroHome ? game.awayScore ?? 0 : game.homeScore ?? 0;
  const opponentId = heroHome ? game.awayTeamId : game.homeTeamId;
  const opponent = save.world.teams.find((team) => team.id === opponentId);
  const performance = hero.overall * 0.34
    + hero.form * 0.3
    + career.coachTrust * 0.14
    + career.lockerRoomStanding * 0.08
    + Math.min(15, snaps * 0.18)
    + (heroScore > opponentScore ? 5 : -2)
    + random.integer(-10, 10);
  return {
    id: game.id,
    seasonYear: game.seasonYear,
    week: game.week,
    opponentId,
    opponentName: opponent?.shortName ?? opponentId,
    won: heroScore > opponentScore,
    score: `${heroScore}–${opponentScore}`,
    snaps,
    started: career.role === "starter" && snaps > 0,
    grade: snaps === 0 ? "D" : gradeForScore(performance),
    role: career.role,
  };
}

function promiseStatus(career: FootballCollegeHeroCareer): FootballCollegeHeroCareer["promises"] {
  const roleOrder: CollegeHeroRole[] = ["starter", "rotation", "special-teams", "developmental"];
  const targetOrder = { "immediate-competition": 1, "rotation-path": 2, developmental: 3, "long-shot": 4 } as const;
  return career.promises.map((promise) => {
    if (promise.status !== "active" || career.week < promise.deadlineWeek) return promise;
    const currentRank = roleOrder.indexOf(career.role) + 1;
    const targetRank = targetOrder[promise.targetRole];
    const kept = currentRank <= targetRank || career.seasonSnaps >= promise.deadlineWeek * 18;
    const status: CollegePromiseStatus = kept ? "kept" : "broken";
    return {
      ...promise,
      status,
      summary: kept
        ? "Штаб дал реальный путь к игровому времени и подтвердил слова действиями."
        : "К контрольной неделе обещанная роль не появилась. Доверие к штабу падает.",
    };
  });
}

function rivalryBond(save: CareerSave, teamId: string): EcosystemSocialBond | undefined {
  return save.world.social.bonds
    .filter((bond) => bond.active
      && bond.teamId === teamId
      && bond.kind === "position-rival"
      && (bond.entityAId === "hero" || bond.entityBId === "hero"))
    .sort((left, right) => right.tension - left.tension)[0];
}

function createDecision(save: CareerSave, career: FootballCollegeHeroCareer): CollegeHeroDecision | undefined {
  if (career.pendingDecision) return career.pendingDecision;
  const rival = rivalryBond(save, career.teamId);
  if (career.week >= 8 && career.depthRank >= 3 && career.transferIntent === "stay") {
    return {
      id: `${save.meta.worldSeed}:college-decision:transfer:${career.seasonYear}:${career.week}`,
      kind: "transfer-window",
      createdWeek: career.week,
      title: "Штаб не дал стабильную роль",
      detail: "Сезон уходит, а игровое время остаётся ограниченным. Нужно определить позицию до открытия портала.",
      options: [
        { id: "stay", label: "Остаться и драться", detail: "Закрыть тему перехода и продолжить борьбу внутри программы." },
        { id: "open-options", label: "Слушать варианты", detail: "Не подавать заявку, но начать оценивать другие программы." },
        { id: "request-portal", label: "Запросить портал", detail: "Официально сообщить штабу о намерении уйти." },
      ],
    };
  }
  if (rival && rival.tension >= 66) {
    return {
      id: `${save.meta.worldSeed}:college-decision:rival:${career.seasonYear}:${career.week}`,
      kind: "position-rivalry",
      createdWeek: career.week,
      title: "Позиционная комната закипела",
      detail: "Прямой конкурент считает, что штаб отдаёт герою лишние повторы. Напряжение уже замечают партнёры.",
      options: [
        { id: "compete", label: "Ответить работой", detail: "Не спорить и забрать следующий тренировочный блок." },
        { id: "deescalate", label: "Снять конфликт", detail: "Обсудить границы и не раскалывать комнату." },
        { id: "confront", label: "Пойти в лоб", detail: "Поставить конкурента на место при команде." },
      ],
    };
  }
  if (career.coachTrust < 52 || (career.week % 3 === 0 && career.depthRank >= 3)) {
    return {
      id: `${save.meta.worldSeed}:college-decision:coach:${career.seasonYear}:${career.week}`,
      kind: "coach-meeting",
      createdWeek: career.week,
      title: "Разговор о роли",
      detail: "Позиционный тренер готов объяснить текущий depth chart. От ответа зависит доверие и распределение повторов.",
      options: [
        { id: "ask-role", label: "Попросить конкретику", detail: "Узнать, что именно отделяет героя от следующей строки." },
        { id: "accept-plan", label: "Принять план", detail: "Выполнять требования штаба без спора о сроках." },
        { id: "demand-snaps", label: "Потребовать повторы", detail: "Давить на обещания рекрутинга и требовать игровое время." },
      ],
    };
  }
  return undefined;
}

function updateWorldHero(save: CareerSave, career: FootballCollegeHeroCareer, overall: number, health: number, form: number): CareerSave["world"] {
  return {
    ...save.world,
    players: save.world.players.map((player) => player.isHero
      ? {
          ...player,
          teamId: career.teamId,
          overall,
          potential: Math.max(player.potential, overall + 4),
          health,
          form,
          depthRank: career.depthRank,
          status: health < 55 ? "injured" : career.role === "starter" ? "starter" : career.role === "rotation" ? "rotation" : "backup",
          usagePlan: usagePlanForRole(career.role),
          transferStatus: career.transferIntent === "portal" ? "portal" : player.transferStatus,
        }
      : player),
  };
}

function synchronizeAfterWorld(save: CareerSave, previousCareer: FootballCollegeHeroCareer): CareerSave {
  const hero = save.world.players.find((player) => player.isHero);
  if (!hero) throw new Error("Hero disappeared from the football ecosystem");
  const available = hero.status !== "injured" && hero.eligibility.athleticallyEligible;
  let career: FootballCollegeHeroCareer = {
    ...previousCareer,
    seasonYear: save.world.seasonYear,
    week: Math.max(1, save.world.seasonWeek),
    depthRank: hero.depthRank,
    role: roleForDepth(hero.depthRank, available),
    coachTrust: clamp((headCoachBond(save, previousCareer.teamId)?.trust ?? previousCareer.coachTrust) * 0.72 + previousCareer.coachTrust * 0.28),
    lockerRoomStanding: lockerRoomStanding(save, previousCareer.teamId),
  };

  const newGames = completedHeroGames(save, career).map((game) => gameLogFor(save, career, game, hero));
  if (newGames.length > 0) {
    career = {
      ...career,
      gameLog: [...career.gameLog, ...newGames].slice(-40),
      seasonSnaps: career.seasonSnaps + newGames.reduce((sum, game) => sum + game.snaps, 0),
      gamesPlayed: career.gamesPlayed + newGames.filter((game) => game.snaps > 0).length,
      starts: career.starts + newGames.filter((game) => game.started).length,
      lastSummary: newGames.at(-1)?.snaps
        ? `${newGames.at(-1)?.opponentName}: ${newGames.at(-1)?.snaps} снэпов, оценка ${newGames.at(-1)?.grade}.`
        : `${newGames.at(-1)?.opponentName}: герой остался без игрового времени.`,
    };
  }

  const redshirtStatus: CollegeRedshirtStatus = career.gamesPlayed > save.world.constitution.legacyRedshirtGameLimit
    ? "used"
    : career.role === "developmental" || career.gamesPlayed <= 1
      ? "candidate"
      : "active";
  career = { ...career, redshirtStatus };
  career = { ...career, promises: promiseStatus(career) };

  const weekAdvanced = career.week > previousCareer.week || career.seasonYear > previousCareer.seasonYear;
  if (weekAdvanced) {
    const log: CollegeHeroWeekLog = {
      id: `${career.seasonYear}:${previousCareer.week}:hero-week`,
      seasonYear: previousCareer.seasonYear,
      week: previousCareer.week,
      role: previousCareer.role,
      depthRank: previousCareer.depthRank,
      coachTrust: round(previousCareer.coachTrust),
      lockerRoomStanding: round(previousCareer.lockerRoomStanding),
      practiceGrade: previousCareer.weeklyPracticeGrade,
      summary: previousCareer.lastSummary,
    };
    career = {
      ...career,
      weekLog: [...career.weekLog, log].slice(-30),
      practiceReps: career.role === "starter" ? 68 : career.role === "rotation" ? 48 : career.role === "special-teams" ? 28 : 14,
      weeklyPracticeGrade: "C",
    };
  }
  career = { ...career, pendingDecision: weekAdvanced ? createDecision(save, career) : career.pendingDecision };

  return {
    ...save,
    football: {
      ...save.football,
      college: {
        ...save.football.college,
        status: "active",
        depthRank: hero.depthRank,
        positionRoom: syncCollegePositionRoom(save),
        heroCareer: career,
      },
    },
  };
}

export function activateCollegeHeroCareer(save: CareerSave): CareerSave {
  const career = createCollegeHeroCareer(save);
  const activated: CareerSave = {
    ...save,
    meta: { ...save.meta, phase: "college-season" },
    football: {
      ...save.football,
      stage: "college-season",
      college: {
        ...save.football.college,
        status: "active",
        positionRoom: syncCollegePositionRoom(save),
        depthRank: career.depthRank,
        heroCareer: career,
      },
    },
    history: [
      ...save.history,
      {
        id: `${save.meta.worldSeed}:college-career-active`,
        occurredAt: save.meta.updatedAt,
        type: "college-career-activated",
        title: "Первый университетский сезон начался",
        description: `Герой вошёл в общий календарь ${save.football.college.program?.shortName ?? "программы"} как #${career.depthRank} в позиционной комнате.`,
      },
    ],
  };
  return { ...activated, world: updateWorldHero(activated, career, activated.football.ratings.overall, activated.character.condition.health, activated.character.condition.confidence) };
}

export function advanceCollegeCareerDay(save: CareerSave): CareerSave {
  const career = save.football.college.heroCareer;
  if (!career || save.meta.phase !== "college-season") throw new Error("College hero career is not active");
  if (career.pendingDecision) throw new Error("College decision must be resolved before advancing");

  const result = advanceLifeDay(save.character, save.life, save.meta.currentDate, save.meta.worldSeed);
  const weekday = save.life.dayIndex;
  const practiceFactor = [0.95, 1.08, 1.18, 1.08, 0.78, 0.35, 0.18][weekday] ?? 1;
  const trainingResolution = resolveTrainingDay(
    save.football,
    result.character,
    result.effects,
    save.meta.currentDate,
    save.meta.worldSeed,
    practiceFactor,
  );
  const nextRatings = {
    ...trainingResolution.ratings,
    overall: calculateOverall(trainingResolution.ratings),
  };
  const trustDelta = round((result.effects.trainingQuality - 55) * 0.03
    + trainingResolution.coachTrustDelta
    - Math.max(0, result.character.condition.fatigue - 75) * 0.025, 1);
  const standingDelta = round((result.effects.socialQuality - 50) * 0.018 + gradeScore(trainingResolution.session.grade) * 0.45, 1);
  const practiceReps = clamp(career.practiceReps
    + gradeScore(trainingResolution.session.grade) * 1.8
    + (career.coachTrust - 50) * 0.025
    - Math.max(0, trainingResolution.character.condition.fatigue - 72) * 0.04, 0, 100);
  const nextCareer: FootballCollegeHeroCareer = {
    ...career,
    coachTrust: clamp(career.coachTrust + trustDelta),
    lockerRoomStanding: clamp(career.lockerRoomStanding + standingDelta),
    practiceReps,
    weeklyPracticeGrade: trainingResolution.session.grade,
    lastSummary: `${trainingResolution.session.focusName}: ${trainingResolution.session.grade}. Повторы ${Math.round(practiceReps)}, доверие штаба ${Math.round(career.coachTrust + trustDelta)}.`,
  };
  const outcome = {
    ...result.outcome,
    highlights: [
      ...result.outcome.highlights,
      `${trainingResolution.session.focusName}: ${trainingResolution.session.grade}. Повторы в лагере: ${Math.round(practiceReps)}.`,
    ],
    deltas: {
      ...result.outcome.deltas,
      coachTrust: trustDelta,
      overall: round(nextRatings.overall - save.football.ratings.overall, 2),
    },
  };

  let nextSave: CareerSave = {
    ...save,
    meta: { ...save.meta, currentDate: result.nextDate },
    character: trainingResolution.character,
    life: { ...result.life, lastOutcome: outcome },
    football: {
      ...save.football,
      ratings: nextRatings,
      training: trainingResolution.training,
      college: { ...save.football.college, heroCareer: nextCareer },
    },
    history: [
      ...save.history,
      {
        id: trainingResolution.session.id,
        occurredAt: save.meta.updatedAt,
        type: "college-practice-completed",
        title: `${trainingResolution.session.focusName}: ${trainingResolution.session.grade}`,
        description: `${trainingResolution.session.note} Повторы: ${Math.round(practiceReps)}.`,
      },
    ],
  };
  nextSave = {
    ...nextSave,
    world: updateWorldHero(nextSave, nextCareer, nextRatings.overall, trainingResolution.character.condition.health, trainingResolution.character.condition.confidence),
  };
  return synchronizeAfterWorld(advanceFootballEcosystem(nextSave), nextCareer);
}

function adjustRivalryBond(save: CareerSave, tensionDelta: number, trustDelta: number, respectDelta: number): CareerSave["world"] {
  const career = save.football.college.heroCareer;
  if (!career) return save.world;
  const rival = rivalryBond(save, career.teamId);
  if (!rival) return save.world;
  return {
    ...save.world,
    social: {
      ...save.world.social,
      bonds: save.world.social.bonds.map((bond) => bond.id === rival.id
        ? {
            ...bond,
            tension: clamp(bond.tension + tensionDelta),
            trust: clamp(bond.trust + trustDelta),
            respect: clamp(bond.respect + respectDelta),
          }
        : bond),
    },
  };
}

export function resolveCollegeHeroDecision(save: CareerSave, optionId: string): CareerSave {
  const career = save.football.college.heroCareer;
  const decision = career?.pendingDecision;
  if (!career || !decision) throw new Error("No college decision is pending");
  if (!decision.options.some((option) => option.id === optionId)) throw new Error("Unknown college decision option");

  let coachTrustDelta = 0;
  let standingDelta = 0;
  let stressDelta = 0;
  let confidenceDelta = 0;
  let transferIntent: CollegeTransferIntent = career.transferIntent;
  let world = save.world;
  let outcome = "Решение принято.";

  if (decision.kind === "coach-meeting") {
    if (optionId === "ask-role") {
      coachTrustDelta = 3;
      stressDelta = 1;
      outcome = "Штаб назвал конкретные требования: техника, надёжность и качество каждого повтора.";
    } else if (optionId === "accept-plan") {
      coachTrustDelta = 5;
      standingDelta = 1;
      stressDelta = -2;
      outcome = "Тренер увидел готовность работать внутри плана и увеличил доверие.";
    } else {
      coachTrustDelta = -6;
      standingDelta = 2;
      stressDelta = 4;
      confidenceDelta = 3;
      outcome = "Требование услышали, но штаб воспринял его как давление на depth chart.";
    }
  } else if (decision.kind === "position-rivalry") {
    if (optionId === "compete") {
      coachTrustDelta = 1;
      standingDelta = 4;
      stressDelta = 2;
      world = adjustRivalryBond(save, 2, 0, 5);
      outcome = "Команда увидела ответ на поле. Конкуренция стала жёстче, уважение выросло.";
    } else if (optionId === "deescalate") {
      standingDelta = 2;
      stressDelta = -3;
      world = adjustRivalryBond(save, -9, 5, 2);
      outcome = "Конфликт не исчез, но перестал портить работу всей позиционной комнаты.";
    } else {
      standingDelta = 1;
      confidenceDelta = 3;
      stressDelta = 5;
      world = adjustRivalryBond(save, 9, -5, -1);
      outcome = "Столкновение стало публичным. Часть раздевалки поддержала героя, часть отвернулась.";
    }
  } else {
    if (optionId === "stay") {
      transferIntent = "stay";
      coachTrustDelta = 4;
      stressDelta = -2;
      outcome = "Герой закрыл тему портала и оставил штабу один вариант: честно оценивать работу.";
    } else if (optionId === "open-options") {
      transferIntent = "open";
      coachTrustDelta = -2;
      stressDelta = 2;
      outcome = "Официального запроса нет, но окружение начало оценивать доступные программы.";
    } else {
      transferIntent = "portal";
      coachTrustDelta = -10;
      confidenceDelta = 2;
      stressDelta = 5;
      outcome = "Штаб получил официальный запрос. Герой вошёл в трансферный портал.";
      world = {
        ...world,
        players: world.players.map((player) => player.isHero ? { ...player, transferStatus: "portal" } : player),
        transactions: [
          ...world.transactions,
          {
            id: `${save.world.seasonYear}:hero:portal:${save.life.completedDays}`,
            kind: "portal-entry" as const,
            seasonYear: save.world.seasonYear,
            week: Math.max(1, save.world.seasonWeek),
            createdOn: save.meta.currentDate,
            title: `${save.character.identity.fullName} запросил трансфер`,
            detail: `Герой официально вошёл в портал после сезона без устойчивой роли в ${save.football.college.program?.shortName ?? "программе"}.`,
            playerId: "hero",
            fromTeamId: career.teamId,
            relatedToHero: true,
          },
        ].slice(-220),
      };
    }
  }

  const nextCareer: FootballCollegeHeroCareer = {
    ...career,
    coachTrust: clamp(career.coachTrust + coachTrustDelta),
    lockerRoomStanding: clamp(career.lockerRoomStanding + standingDelta),
    transferIntent,
    pendingDecision: undefined,
    lastSummary: outcome,
  };
  return {
    ...save,
    world,
    character: {
      ...save.character,
      condition: {
        ...save.character.condition,
        stress: clamp(save.character.condition.stress + stressDelta),
        confidence: clamp(save.character.condition.confidence + confidenceDelta),
      },
    },
    football: {
      ...save.football,
      college: { ...save.football.college, heroCareer: nextCareer },
    },
    history: [
      ...save.history,
      {
        id: decision.id,
        occurredAt: save.meta.updatedAt,
        type: `college-${decision.kind}`,
        title: decision.title,
        description: outcome,
      },
    ],
  };
}
