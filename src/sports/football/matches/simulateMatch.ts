import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { applyCompletedMatchToSeason } from "../season/updateSeason";
import { updateRecruitingAfterMatch } from "../recruiting/updateRecruiting";
import type { FootballPosition } from "../career/types";
import { callPlay, heroAssignment } from "./playbook";
import type {
  FootballMatchState,
  MatchDecisionOption,
  MatchEpisode,
  MatchEpisodeResult,
  MatchFinalResult,
  MatchOutcomeGrade,
  MatchStatLine,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function emptyDelta(): MatchStatLine {
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

function addStats(left: MatchStatLine, right: MatchStatLine): MatchStatLine {
  const result = { ...left };
  for (const key of Object.keys(result) as Array<keyof MatchStatLine>) result[key] += right[key];
  return result;
}

function option(
  id: string,
  label: string,
  detail: string,
  risk: MatchDecisionOption["risk"],
  focus: MatchDecisionOption["focus"],
  difficulty: number,
  upside: number,
  mistakeRisk: number,
): MatchDecisionOption {
  return { id, label, detail, risk, focus, difficulty, upside, mistakeRisk };
}

function quarterForSnap(index: number, total: number): 1 | 2 | 3 | 4 {
  const progress = index / Math.max(1, total);
  if (progress < .25) return 1;
  if (progress < .5) return 2;
  if (progress < .75) return 3;
  return 4;
}

function clockForSnap(index: number, total: number): number {
  const withinQuarter = (index / Math.max(1, total) * 4) % 1;
  return Math.max(24, Math.round(720 * (1 - withinQuarter)));
}

function episodeOptions(position: FootballPosition, variant: number): MatchDecisionOption[] {
  const catalog: Record<FootballPosition, MatchDecisionOption[][]> = {
    QB: [
      [
        option("qb-check", "Сбросить в короткую", "Быстро убрать мяч и сохранить владение.", "safe", "football-iq", 48, 8, 4),
        option("qb-window", "Атаковать окно", "Попасть между linebacker и safety.", "balanced", "technique", 62, 20, 12),
        option("qb-shot", "Глубокий пас", "Проверить cornerback один в один.", "aggressive", "competitiveness", 76, 42, 24),
      ],
      [
        option("qb-slide", "Сдвинуть защиту", "Сменить protection и сыграть по чтению.", "balanced", "football-iq", 58, 18, 9),
        option("qb-run", "Уйти ногами", "Взять свободные ярды до контакта.", "balanced", "athleticism", 60, 16, 10),
        option("qb-hero", "Держать розыгрыш", "Дождаться большого маршрута под давлением.", "aggressive", "competitiveness", 80, 38, 28),
      ],
    ],
    RB: [
      [
        option("rb-press", "Продавить назначенный гэп", "Довериться блокам и взять гарантированные ярды.", "safe", "technique", 50, 10, 5),
        option("rb-cut", "Резать назад", "Увидеть backside и сменить направление.", "balanced", "football-iq", 63, 22, 11),
        option("rb-bounce", "Вынести наружу", "Атаковать край до закрытия contain.", "aggressive", "athleticism", 75, 36, 22),
      ],
      [
        option("rb-secure", "Закрыть мяч", "Сохранить владение через плотный контакт.", "safe", "competitiveness", 52, 9, 3),
        option("rb-contact", "Пройти через контакт", "Понизить центр тяжести и закончить рывок.", "balanced", "competitiveness", 64, 19, 10),
        option("rb-jump", "Перепрыгнуть фронт", "Рискнуть ради first down у линии.", "aggressive", "athleticism", 79, 28, 20),
      ],
    ],
    WR: [
      [
        option("wr-stack", "Сложить защитника", "Выиграть внешнее плечо и держать вертикаль.", "balanced", "technique", 62, 24, 10),
        option("wr-zone", "Сесть в окно", "Остановиться между зонами и показать номер QB.", "safe", "football-iq", 50, 12, 4),
        option("wr-go", "Атаковать глубину", "Не сбрасывать скорость и потребовать дальний мяч.", "aggressive", "athleticism", 76, 42, 21),
      ],
      [
        option("wr-hands", "Страховать приём", "Поймать корпусом и сразу закрыть мяч.", "safe", "technique", 48, 10, 3),
        option("wr-separate", "Создать поздний отрыв", "Сломать темп перед выходом из маршрута.", "balanced", "technique", 64, 21, 9),
        option("wr-highpoint", "Забрать спорный мяч", "Атаковать высшую точку против контакта.", "aggressive", "competitiveness", 78, 35, 18),
      ],
    ],
    LB: [
      [
        option("lb-fit", "Закрыть свой гэп", "Не терять плечо и остановить вынос.", "safe", "football-iq", 50, 11, 4),
        option("lb-scrape", "Скользить за блоком", "Догнать бегущего к боковой линии.", "balanced", "athleticism", 62, 20, 9),
        option("lb-shoot", "Атаковать разрыв", "Пройти до формирования блока.", "aggressive", "competitiveness", 76, 34, 20),
      ],
      [
        option("lb-carry", "Унести маршрут", "Не отпустить tight end за спину.", "safe", "football-iq", 52, 12, 5),
        option("lb-rob", "Читать глаза QB", "Сесть под внутреннее окно передачи.", "balanced", "technique", 66, 24, 12),
        option("lb-blitz", "Давить через A-gap", "Отказаться от глубины ради давления.", "aggressive", "athleticism", 78, 36, 24),
      ],
    ],
    CB: [
      [
        option("cb-leverage", "Держать рычаг", "Не отдавать внутреннюю часть поля.", "safe", "football-iq", 50, 12, 4),
        option("cb-press", "Сбить релиз", "Навязать контакт на линии и нарушить тайминг.", "balanced", "technique", 64, 23, 10),
        option("cb-jump", "Прыгнуть маршрут", "Срезать передачу до выхода ресивера.", "aggressive", "competitiveness", 79, 40, 25),
      ],
      [
        option("cb-trail", "Играть из trail", "Сохранять позицию и атаковать руки поздно.", "safe", "technique", 52, 13, 5),
        option("cb-ball", "Повернуться к мячу", "Найти передачу и сыграть на breakup.", "balanced", "football-iq", 65, 24, 11),
        option("cb-pick", "Идти на перехват", "Оставить ресивера ради мяча.", "aggressive", "competitiveness", 80, 42, 27),
      ],
    ],
  };
  return catalog[position][variant % catalog[position].length] ?? catalog[position][0]!;
}

function assignmentOptions(
  position: FootballPosition,
  involvement: MatchEpisode["heroInvolvement"],
  playType: MatchEpisode["playCall"]["playType"],
  variant: number,
): MatchDecisionOption[] {
  if (position === "WR" && involvement !== "primary") {
    return [
      option("wr-stem", "Продать маршрут", "Сохранить темп и заставить защитника уважать глубину.", "balanced", "technique", 55, 12, 4),
      option("wr-window", "Держать окно", "Выполнить маршрут точно, даже если QB читает другую сторону.", "safe", "football-iq", 46, 8, 2),
      option("wr-block", playType === "run" ? "Закрыть периметр" : "Перестроиться под scramble", "Не искать мяч, а закончить назначение и помочь розыгрышу.", "aggressive", "competitiveness", 66, 15, 8),
    ];
  }
  if (position === "RB" && playType !== "run" && playType !== "screen") {
    return [
      option("rb-scan", "Проверить blitz", "Сначала найти свободного rusher, потом выйти в checkdown.", "safe", "football-iq", 48, 8, 3),
      option("rb-chip", "Помочь tackle", "Ударить edge и поздно выйти в маршрут.", "balanced", "technique", 60, 13, 7),
      option("rb-release", "Сразу выйти", "Рискнуть protection ради свободного игрока в короткой зоне.", "aggressive", "athleticism", 74, 22, 17),
    ];
  }
  if ((position === "LB" || position === "CB") && involvement === "assignment-only") {
    return [
      option("def-structure", "Держать структуру", "Не гнаться за мячом и закрыть назначенную зону.", "safe", "football-iq", 47, 8, 2),
      option("def-trigger", "Среагировать по ключу", "Атаковать только после подтверждённого чтения.", "balanced", "technique", 59, 14, 7),
      option("def-chase", "Сжать поле", "Покинуть назначение и попытаться повлиять на мяч.", "aggressive", "athleticism", 73, 24, 18),
    ];
  }
  return episodeOptions(position, variant);
}

function generateEpisode(save: CareerSave, match: FootballMatchState, index: number): MatchEpisode {
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:episode:${index}`);
  const variant = random.integer(0, 3);
  const quarter = quarterForSnap(index, match.totalEpisodes);
  const clockSeconds = clockForSnap(index, match.totalEpisodes);
  const coachTrust = save.meta.phase === "college-season"
    ? save.football.college.heroCareer?.coachTrust ?? save.football.depthChart.coachTrust
    : save.football.depthChart.coachTrust;
  const canCheck = (save.football.position === "QB" && save.football.ratings.footballIq >= 70 && coachTrust >= 68)
    || (save.football.position === "LB" && save.football.ratings.footballIq >= 76 && coachTrust >= 78);
  const playCall = callPlay(
    `${save.meta.worldSeed}:${match.gameId}:call:${index}`,
    match.heroUnit,
    match.driveDown,
    match.driveDistance,
    match.driveFieldPosition,
    canCheck,
  );
  const assignment = heroAssignment(save.football.position, playCall, `${save.meta.worldSeed}:${match.gameId}:assignment:${index}`);
  const side = playCall.strength === "middle" ? "по центру" : playCall.strength === "left" ? "влево" : "вправо";
  return {
    id: `${match.gameId}-ep-${index + 1}`,
    unit: match.heroUnit,
    position: save.football.position,
    quarter,
    clockSeconds,
    down: match.driveDown,
    distance: match.driveDistance,
    fieldPosition: match.driveFieldPosition,
    scoreMargin: match.heroScore - match.opponentScore,
    title: `${playCall.formation} · ${playCall.concept}`,
    situation: `${playCall.personnel} personnel, сила ${side}. Розыгрыш вызван штабом.`,
    assignment: assignment.role,
    read: canCheck ? "Ты имеешь право на ограниченный check по ключу защиты." : "Формацию и комбинацию выбрал штаб. Твоя задача — выполнить роль.",
    playCall,
    heroInvolvement: assignment.involvement,
    heroRole: assignment.role,
    options: assignmentOptions(save.football.position, assignment.involvement, playCall.playType, variant),
  };
}

function skillValue(save: CareerSave, option: MatchDecisionOption): number {
  const ratings = save.football.ratings;
  const heroTacticalFit = save.world.players.find((player) => player.isHero)?.tactical.schemeFit ?? 65;
  const coachTrust = save.meta.phase === "college-season"
    ? save.football.college.heroCareer?.coachTrust ?? save.football.depthChart.coachTrust
    : save.football.depthChart.coachTrust;
  const focus = {
    technique: ratings.technique,
    athleticism: ratings.athleticism,
    "football-iq": ratings.footballIq,
    competitiveness: ratings.competitiveness,
  }[option.focus];
  return (
    focus * 0.47 +
    ratings.technique * 0.14 +
    ratings.footballIq * 0.12 +
    save.character.condition.confidence * 0.1 +
    save.football.training.body.readiness * 0.07 +
    coachTrust * 0.06 +
    heroTacticalFit * 0.06
  );
}

function gradeFromScore(score: number): MatchOutcomeGrade {
  if (score >= 80) return "A";
  if (score >= 64) return "B";
  if (score >= 47) return "C";
  return "D";
}

function makeStatDelta(position: FootballPosition, episode: MatchEpisode, grade: MatchOutcomeGrade, yards: number, points: number, random: SeededRandom): { stats: MatchStatLine; involved: boolean } {
  const stats = emptyDelta();
  const success = grade === "A" || grade === "B";
  const primary = episode.heroInvolvement === "primary";
  const secondary = episode.heroInvolvement === "secondary";
  let involved = false;

  if (position === "QB") {
    if (episode.playCall.playType === "run") {
      involved = true;
    } else {
      involved = true;
      stats.passingAttempts = 1;
      stats.completions = success ? 1 : 0;
      stats.passingYards = success ? Math.max(0, yards) : 0;
      stats.touchdowns = points === 7 ? 1 : 0;
      stats.turnovers = grade === "D" && random.chance(0.28) ? 1 : 0;
    }
  } else if (position === "RB") {
    if (episode.playCall.playType === "run" && primary) {
      involved = true;
      stats.rushingAttempts = 1;
      stats.rushingYards = yards;
      stats.touchdowns = points === 7 ? 1 : 0;
      stats.turnovers = grade === "D" && random.chance(0.18) ? 1 : 0;
    } else if ((episode.playCall.playType === "screen" || episode.playCall.playType === "pass" || episode.playCall.playType === "play-action") && (primary || (secondary && random.chance(.36)))) {
      involved = true;
      stats.targets = 1;
      stats.receptions = success ? 1 : 0;
      stats.receivingYards = success ? Math.max(0, yards) : 0;
    }
  } else if (position === "WR") {
    const targeted = primary && episode.playCall.playType !== "run" && random.chance(.86);
    if (targeted) {
      involved = true;
      stats.targets = 1;
      stats.receptions = success ? 1 : 0;
      stats.receivingYards = success ? Math.max(0, yards) : 0;
      stats.touchdowns = points === 7 ? 1 : 0;
      stats.turnovers = grade === "D" && random.chance(0.05) ? 1 : 0;
    }
  } else if (position === "LB") {
    involved = primary || (secondary && random.chance(.44));
    if (involved) {
      stats.tackles = grade === "D" ? 0 : random.chance(.78) ? 1 : 0;
      stats.tacklesForLoss = grade === "A" && yards <= -2 && stats.tackles > 0 ? 1 : 0;
      stats.sacks = episode.playCall.playType === "blitz" && grade === "A" && random.chance(0.34) ? 1 : 0;
      stats.passBreakups = episode.playCall.playType === "coverage" && grade === "A" && random.chance(0.22) ? 1 : 0;
      stats.interceptions = episode.playCall.playType === "coverage" && grade === "A" && random.chance(0.08) ? 1 : 0;
    }
  } else {
    involved = primary || (secondary && random.chance(.32));
    if (involved) {
      stats.tackles = grade === "B" || grade === "C" ? 1 : 0;
      stats.passBreakups = grade === "A" || (grade === "B" && random.chance(0.28)) ? 1 : 0;
      stats.interceptions = grade === "A" && random.chance(0.18) ? 1 : 0;
    }
  }
  return { stats, involved };
}

function resultText(episode: MatchEpisode, grade: MatchOutcomeGrade, yards: number, turnover: boolean, involved: boolean): Pick<MatchEpisodeResult, "headline" | "description"> {
  if (!involved) {
    if (grade === "A") return { headline: "Назначение выполнено", description: `Мяч идёт в другую часть поля. Ты выполняешь роль: ${episode.heroRole}.` };
    if (grade === "B") return { headline: "Структура сохранена", description: "Ты не получаешь статистическое действие, но не ломаешь комбинацию команды." };
    if (grade === "C") return { headline: "Позднее выполнение", description: "Розыгрыш проходит без твоего касания мяча. Штаб фиксирует неточность в назначении." };
    return { headline: "Провал назначения", description: "Мяч идёт в другую сторону, но твоя ошибка открывает защитнику или атаке дополнительное пространство." };
  }
  if (episode.unit === "offense") {
    if (turnover) return { headline: "Потеря мяча", description: "Риск не прошёл. Защита забирает владение и штаб фиксирует ошибку." };
    if (grade === "A") return { headline: "Большой розыгрыш", description: `Комбинация приносит ${Math.max(1, yards)} ярдов. Твоя роль выполнена точно.` };
    if (grade === "B") return { headline: "Положительный розыгрыш", description: `Нападение получает ${Math.max(1, yards)} ярдов и остаётся в графике.` };
    if (grade === "C") return { headline: "Минимальный результат", description: `Розыгрыш не разваливается, но даёт только ${Math.max(0, yards)} ярда.` };
    return { headline: "Розыгрыш проигран", description: `Защита читает комбинацию. Нападение теряет ${Math.abs(Math.min(0, yards))} ярда.` };
  }
  if (grade === "A") return { headline: "Защита выигрывает снэп", description: yards < 0 ? `Атака остановлена за линией на ${Math.abs(yards)} ярда.` : "Назначение закрыто, атака теряет первое чтение." };
  if (grade === "B") return { headline: "Надёжная защита", description: `Атака ограничена ${Math.max(0, yards)} ярдами, структура сохранена.` };
  if (grade === "C") return { headline: "Поздний контакт", description: `Атака получает ${Math.max(1, yards)} ярдов без explosive play.` };
  return { headline: "Назначение проиграно", description: `Атака использует ошибку и забирает ${Math.max(8, yards)} ярдов.` };
}

function backgroundScore(match: FootballMatchState, save: CareerSave, index: number): { hero: number; opponent: number } {
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:background:${index}`);
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const opponentRating = collegeCareer
    ? save.world.teams.find((team) => team.id === match.opponentId)?.rating ?? 72
    : save.football.season.opponents.find((opponent) => opponent.id === match.opponentId)?.rating ?? 72;
  const collegeTeam = collegeCareer ? save.world.teams.find((team) => team.id === collegeCareer.teamId) : undefined;
  const collegeCulture = collegeCareer ? save.world.social.teamCultures.find((culture) => culture.teamId === collegeCareer.teamId) : undefined;
  const teamRating = collegeTeam
    ? collegeTeam.rating * 0.72 + collegeTeam.tactical.installation * 0.14 + (collegeCulture?.cohesion ?? 50) * 0.14
    : (save.football.school.prestige + save.football.school.coaching + save.football.teamDynamics.cohesion) / 3;
  const ratingEdge = (teamRating - opponentRating) / 100;
  const teamEdge = collegeTeam
    ? ((collegeCulture?.cohesion ?? 50) + collegeTeam.tactical.installation - 120) / 100 + ratingEdge
    : (save.football.teamDynamics.cohesion + save.football.teamDynamics.schemeMastery - 120) / 100 + ratingEdge;
  const heroChance = 0.075 + teamEdge * 0.05;
  const opponentChance = 0.07 - teamEdge * 0.04;
  const score = () => (random.chance(0.68) ? 7 : 3);
  return {
    hero: random.chance(heroChance) ? score() : 0,
    opponent: random.chance(opponentChance) ? score() : 0,
  };
}

function nextDriveState(match: FootballMatchState, episode: MatchEpisode, yards: number, points: number, turnover: boolean, random: SeededRandom): Pick<FootballMatchState, "driveDown" | "driveDistance" | "driveFieldPosition" | "driveNumber"> {
  const offenseGain = match.heroUnit === "offense" ? yards : Math.max(-5, yards);
  const nextField = Math.max(1, Math.min(99, episode.fieldPosition + offenseGain));
  const converted = offenseGain >= episode.distance;
  const driveEnds = points > 0 || turnover || nextField >= 99 || (episode.down === 4 && !converted);
  if (driveEnds) {
    return { driveDown: 1, driveDistance: 10, driveFieldPosition: random.integer(18, 34), driveNumber: match.driveNumber + 1 };
  }
  if (converted) {
    return { driveDown: 1, driveDistance: Math.max(1, Math.min(10, 100 - nextField)), driveFieldPosition: nextField, driveNumber: match.driveNumber };
  }
  return {
    driveDown: Math.min(4, episode.down + 1) as 1 | 2 | 3 | 4,
    driveDistance: Math.max(1, episode.distance - offenseGain),
    driveFieldPosition: nextField,
    driveNumber: match.driveNumber,
  };
}

function finalResult(match: FootballMatchState, save: CareerSave): MatchFinalResult {
  let heroScore = match.heroScore;
  let opponentScore = match.opponentScore;
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:final`);
  if (heroScore === opponentScore) {
    if (random.chance(0.52)) heroScore += 3;
    else opponentScore += 3;
  }
  const grade = gradeFromScore(match.coachGrade);
  const won = heroScore > opponentScore;
  const spotlight = save.football.position === "QB"
    ? `${match.stats.completions}/${match.stats.passingAttempts}, ${match.stats.passingYards} ярдов`
    : save.football.position === "RB"
      ? `${match.stats.rushingYards} ярдов на ${match.stats.rushingAttempts} выносах`
      : save.football.position === "WR"
        ? `${match.stats.receptions}/${match.stats.targets}, ${match.stats.receivingYards} ярдов`
        : save.football.position === "LB"
          ? `${match.stats.tackles} захватов, ${match.stats.tacklesForLoss} TFL, ${match.stats.sacks} sacks`
          : `${match.stats.tackles} захватов, ${match.stats.passBreakups} PBU, ${match.stats.interceptions} INT`;
  const coachTrustDelta = round((match.coachGrade - 55) * 0.11, 1);
  const visibilityDelta = round(Math.max(0, (match.coachGrade - 52) * 0.09) + (won ? 0.8 : 0), 1);
  const teamName = save.meta.phase === "college-season"
    ? save.football.college.program?.shortName ?? "Программа"
    : save.football.school.shortName;
  return {
    won,
    heroScore,
    opponentScore,
    grade,
    headline: won ? "Победа закрыта" : "Матч упущен",
    summary: `${teamName} ${won ? "побеждает" : "проигрывает"} ${heroScore}:${opponentScore}. Оценка штаба — ${grade}.`,
    spotlight,
    coachTrustDelta,
    visibilityDelta,
  };
}

export function startMatch(save: CareerSave): CareerSave {
  const match = save.football.match;
  if (match.status !== "upcoming") return save;
  const started: FootballMatchState = {
    ...match,
    status: "in-progress",
    heroScore: 0,
    opponentScore: 0,
    quarter: 1,
    clockSeconds: clockForSnap(0, match.totalEpisodes),
    heroFatigue: clamp(save.character.condition.fatigue * 0.16 + (100 - save.football.training.body.readiness) * 0.12, 3, 24),
    coachGrade: 55,
    episodeIndex: 0,
    driveDown: 1,
    driveDistance: 10,
    driveFieldPosition: match.driveFieldPosition || 24,
    driveNumber: 1,
    completedEpisodes: [],
    stats: emptyDelta(),
  };
  return {
    ...save,
    football: {
      ...save.football,
      match: { ...started, currentEpisode: generateEpisode(save, started, 0) },
    },
    history: [
      ...save.history,
      {
        id: `${match.gameId}-started`,
        occurredAt: save.meta.updatedAt,
        type: "match-started",
        title: `Матч против ${match.opponentName}`,
        description: `${save.football.position} выходит в ${match.heroUnit === "defense" ? "защите" : "атаке"}. Штаб вызывает формации, игрок выполняет назначение на каждом снэпе.`,
      },
    ],
  };
}

export function resolveMatchDecision(save: CareerSave, optionId: string): CareerSave {
  const match = save.football.match;
  const episode = match.currentEpisode;
  if (match.status !== "in-progress" || !episode) throw new Error("Match has no active episode");
  const selected = episode.options.find((item) => item.id === optionId);
  if (!selected) throw new Error("Unknown match decision");

  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:${episode.id}:${optionId}`);
  const fatiguePenalty = match.heroFatigue * 0.24 + save.character.condition.fatigue * 0.08;
  const painPenalty = save.football.training.body.pain * 0.1 + (save.football.training.body.medicalStatus === "limited" ? 6 : 0);
  const opponentRating = save.meta.phase === "college-season"
    ? save.world.teams.find((team) => team.id === match.opponentId)?.rating ?? 72
    : save.football.season.opponents.find((opponent) => opponent.id === match.opponentId)?.rating ?? 72;
  const opponentPenalty = Math.max(-3, Math.min(6, (opponentRating - 72) * 0.22));
  const rawScore = skillValue(save, selected) + random.integer(-17, 17) - selected.difficulty * 0.42 - fatiguePenalty - painPenalty - opponentPenalty + 31;
  const grade = gradeFromScore(rawScore);
  const offense = match.heroUnit === "offense";
  const yardsBase = selected.upside * (grade === "A" ? 1.05 : grade === "B" ? 0.58 : grade === "C" ? 0.18 : -0.22);
  const yards = Math.round(offense ? yardsBase + random.integer(-3, 5) : grade === "A" ? -random.integer(1, 5) : grade === "B" ? random.integer(0, 4) : grade === "C" ? random.integer(4, 9) : random.integer(10, 24));
  const mistake = grade === "D" && random.chance(selected.mistakeRisk / 100);
  const touchdown = offense && grade === "A" && (episode.fieldPosition + Math.max(0, yards) >= 100 || random.chance(selected.risk === "aggressive" ? 0.23 : 0.1));
  const points = touchdown ? 7 : 0;
  const statResolution = makeStatDelta(save.football.position, episode, grade, yards, points, random);
  const statDelta = statResolution.stats;
  if (mistake && statResolution.involved) statDelta.turnovers = Math.max(1, statDelta.turnovers);
  const coachDelta = round(grade === "A" ? 2.6 : grade === "B" ? 1.1 : grade === "C" ? -0.6 : -2.8, 1);
  const confidenceDelta = round(grade === "A" ? 1.4 : grade === "B" ? 0.6 : grade === "C" ? -0.3 : -1.2, 1);
  const fatigueDelta = round(1.2 + selected.difficulty * 0.016 + (selected.risk === "aggressive" ? 0.7 : 0), 1);
  const copy = resultText(episode, grade, yards, mistake, statResolution.involved);
  const outcome: MatchEpisodeResult = {
    id: `${episode.id}-result`,
    episodeId: episode.id,
    optionId,
    grade,
    ...copy,
    yards,
    points,
    coachDelta,
    confidenceDelta,
    fatigueDelta,
    assignmentScore: clamp(rawScore),
    involved: statResolution.involved,
    statDelta,
  };

  const background = backgroundScore(match, save, match.episodeIndex);
  let heroScore = match.heroScore + background.hero + points;
  let opponentScore = match.opponentScore + background.opponent;
  if (!offense && grade === "D" && random.chance(0.34)) opponentScore += 7;
  if (!offense && statDelta.interceptions > 0 && random.chance(0.25)) heroScore += 7;
  const nextIndex = match.episodeIndex + 1;
  const nextStats = addStats(match.stats, statDelta);
  const driveState = nextDriveState(match, episode, yards, points, mistake && statResolution.involved, random);
  const nextMatchBase: FootballMatchState = {
    ...match,
    heroScore,
    opponentScore,
    quarter: quarterForSnap(nextIndex, match.totalEpisodes),
    clockSeconds: clockForSnap(nextIndex, match.totalEpisodes),
    ...driveState,
    heroFatigue: clamp(match.heroFatigue + fatigueDelta, 0, 100),
    coachGrade: clamp(match.coachGrade + coachDelta, 0, 100),
    episodeIndex: nextIndex,
    completedEpisodes: [...match.completedEpisodes, outcome],
    stats: nextStats,
    currentEpisode: undefined,
  };

  let nextMatch: FootballMatchState;
  let nextFootball = save.football;
  let history = save.history;
  let nextCharacter = {
    ...save.character,
    condition: {
      ...save.character.condition,
      confidence: clamp(save.character.condition.confidence + confidenceDelta),
      fatigue: clamp(save.character.condition.fatigue + fatigueDelta * 0.36),
      energy: clamp(save.character.condition.energy - fatigueDelta * 0.28),
    },
  };

  if (nextIndex >= match.totalEpisodes) {
    const result = finalResult(nextMatchBase, save);
    nextMatch = {
      ...nextMatchBase,
      status: "complete",
      heroScore: result.heroScore,
      opponentScore: result.opponentScore,
      quarter: 4,
      clockSeconds: 0,
      finalResult: result,
    };
    if (save.meta.phase === "college-season" && save.football.college.heroCareer) {
      const career = save.football.college.heroCareer;
      nextFootball = {
        ...save.football,
        match: nextMatch,
        college: {
          ...save.football.college,
          heroCareer: {
            ...career,
            coachTrust: clamp(career.coachTrust + result.coachTrustDelta),
            lockerRoomStanding: clamp(career.lockerRoomStanding + (result.grade === "A" ? 3 : result.grade === "B" ? 1 : result.grade === "D" ? -2 : 0)),
            lastSummary: `${result.summary} ${result.spotlight}.`,
          },
        },
      };
    } else {
      const season = applyCompletedMatchToSeason(save, nextMatch);
      nextFootball = {
        ...save.football,
        match: nextMatch,
        season,
        depthChart: {
          ...save.football.depthChart,
          coachTrust: clamp(save.football.depthChart.coachTrust + result.coachTrustDelta),
        },
        recruitment: save.football.recruitment,
      };
      const recruitingSave: CareerSave = { ...save, character: nextCharacter, football: nextFootball };
      nextFootball = {
        ...nextFootball,
        recruitment: updateRecruitingAfterMatch(recruitingSave, nextMatch),
      };
    }
    history = [
      ...history,
      {
        id: `${match.gameId}-complete`,
        occurredAt: save.meta.updatedAt,
        type: "match-completed",
        title: `${result.won ? "Победа" : "Поражение"} ${result.heroScore}:${result.opponentScore}`,
        description: `${result.summary} ${result.spotlight}.`,
      },
    ];
  } else {
    nextMatch = { ...nextMatchBase, currentEpisode: generateEpisode(save, nextMatchBase, nextIndex) };
    nextFootball = { ...save.football, match: nextMatch };
  }

  return { ...save, character: nextCharacter, football: nextFootball, history };
}
