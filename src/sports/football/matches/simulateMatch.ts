import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { applyCompletedMatchToSeason } from "../season/updateSeason";
import { updateRecruitingAfterMatch } from "../recruiting/updateRecruiting";
import type { FootballPosition } from "../career/types";
import { buildSnapAssignments, callPlay, describeHeroAssignment } from "./playbook";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats } from "./createMatchState";
import type {
  FootballMatchState,
  MatchAdvancedStatLine,
  MatchDecisionOption,
  MatchDriveOutcome,
  MatchDriveSummary,
  MatchEpisode,
  MatchEpisodeResult,
  MatchFinalResult,
  MatchOutcomeGrade,
  MatchPlayerAssignment,
  MatchSnapResult,
  MatchStatLine,
  MatchTeamSide,
} from "./types";

const GAME_SECONDS = 48 * 60;
const QUARTER_SECONDS = 12 * 60;

interface TeamRatings {
  offense: number;
  defense: number;
  coaching: number;
  cohesion: number;
}

interface SnapSimulation {
  snapResult: MatchSnapResult;
  yards: number;
  points: number;
  scoringSide?: MatchTeamSide | undefined;
  turnover: boolean;
  firstDown: boolean;
  repeatDown: boolean;
  targetSlot?: string | undefined;
  ballCarrierSlot?: string | undefined;
  teamExecutionScore: number;
  description: string;
}

interface DriveAdvance {
  driveEnded: boolean;
  outcome: MatchDriveOutcome;
  nextDown: 1 | 2 | 3 | 4;
  nextDistance: number;
  nextFieldPosition: number;
  firstDown: boolean;
}

interface BackgroundDriveResult {
  summary: MatchDriveSummary;
  heroScoreDelta: number;
  opponentScoreDelta: number;
  nextControlledFieldPosition: number;
  gameClockSeconds: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function otherSide(side: MatchTeamSide): MatchTeamSide {
  return side === "hero" ? "opponent" : "hero";
}

function controlledOffense(match: FootballMatchState): MatchTeamSide {
  return match.heroUnit === "offense" ? "hero" : "opponent";
}

function clockParts(gameClockSeconds: number): { quarter: 1 | 2 | 3 | 4; clockSeconds: number } {
  if (gameClockSeconds <= 0) return { quarter: 4, clockSeconds: 0 };
  const elapsed = GAME_SECONDS - Math.min(GAME_SECONDS, gameClockSeconds);
  const quarter = Math.min(4, Math.floor(elapsed / QUARTER_SECONDS) + 1) as 1 | 2 | 3 | 4;
  const clockSeconds = gameClockSeconds - (4 - quarter) * QUARTER_SECONDS;
  return { quarter, clockSeconds: clampInteger(clockSeconds, 0, QUARTER_SECONDS) };
}

function addStats(left: MatchStatLine, right: MatchStatLine): MatchStatLine {
  const result = { ...left };
  for (const key of Object.keys(result) as Array<keyof MatchStatLine>) result[key] += right[key];
  return result;
}

function addAdvancedStats(left: MatchAdvancedStatLine, right: MatchAdvancedStatLine): MatchAdvancedStatLine {
  const result = { ...left };
  for (const key of Object.keys(result) as Array<keyof MatchAdvancedStatLine>) result[key] += right[key];
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

function assignmentOptions(position: FootballPosition, hero: MatchPlayerAssignment, involvement: MatchEpisode["heroInvolvement"]): MatchDecisionOption[] {
  if (position === "QB") {
    if (hero.kind === "handoff") {
      return [
        option("qb-give", "Отдать по вызову", "Держать mesh и передать мяч в назначенный гэп.", "safe", "football-iq", 46, 10, 3),
        option("qb-read", "Прочитать edge", "Оставить мяч RB или забрать по движению защитника.", "balanced", "football-iq", 62, 20, 10),
        option("qb-keep", "Оставить себе", "Атаковать backside до реакции contain.", "aggressive", "athleticism", 76, 34, 22),
      ];
    }
    return [
      option("qb-rhythm", "Играть по таймингу", "Пройти progression и убрать мяч до давления.", "safe", "football-iq", 50, 12, 4),
      option("qb-window", "Атаковать окно", "Держать взгляд и бросить между уровнями защиты.", "balanced", "technique", 64, 24, 12),
      option("qb-extend", "Продлить розыгрыш", "Уйти из структуры ради глубокого чтения.", "aggressive", "competitiveness", 79, 40, 27),
    ];
  }
  if (position === "RB") {
    if (hero.kind === "carry") {
      return [
        option("rb-track", "Держать трек", "Продавить назначенную точку и читать первый блок.", "safe", "technique", 49, 11, 4),
        option("rb-cut", "Сделать cutback", "Перенести трек после движения второго уровня.", "balanced", "football-iq", 63, 23, 11),
        option("rb-bounce", "Атаковать край", "Отказаться от гэпа и выйти на скорость.", "aggressive", "athleticism", 77, 38, 23),
      ];
    }
    return [
      option("rb-scan", "Сначала protection", "Найти свободного rusher и только потом выйти.", "safe", "football-iq", 47, 9, 3),
      option("rb-chip", "Ударить edge", "Помочь tackle и выйти поздним checkdown.", "balanced", "technique", 60, 16, 8),
      option("rb-release", "Сразу выйти", "Освободиться в короткой зоне до blitz.", "aggressive", "athleticism", 73, 27, 19),
    ];
  }
  if (position === "WR") {
    if (hero.kind === "run-block") {
      return [
        option("wr-position", "Занять позицию", "Не дать cornerback войти внутрь розыгрыша.", "safe", "football-iq", 46, 8, 3),
        option("wr-stalk", "Вести stalk block", "Держать ноги и сопровождать защитника.", "balanced", "technique", 59, 15, 7),
        option("wr-finish", "Закончить блок", "Атаковать рычаг и убрать защитника с периметра.", "aggressive", "competitiveness", 72, 24, 16),
      ];
    }
    return [
      option("wr-timing", "Сохранить тайминг", "Продать stem и выйти в точку по счёту шагов.", "safe", "technique", 49, 11, 4),
      option("wr-leverage", "Выиграть leverage", "Сменить темп и открыть нужное плечо.", "balanced", "football-iq", 63, 23, 10),
      option("wr-break", "Сломать маршрут", "Резко изменить траекторию ради большого separation.", "aggressive", "athleticism", 77, 39, 22),
    ];
  }
  if (position === "LB") {
    if (hero.kind === "rush" || hero.kind === "run-fit") {
      return [
        option("lb-fit", "Закрыть назначение", "Сохранить плечо и не открыть cutback.", "safe", "football-iq", 48, 10, 4),
        option("lb-trigger", "Атаковать ключ", "Сработать после движения guard или back.", "balanced", "technique", 63, 22, 10),
        option("lb-shoot", "Прострелить гэп", "Пойти до подтверждения и разрушить розыгрыш.", "aggressive", "athleticism", 77, 37, 23),
      ];
    }
    return [
      option("lb-depth", "Держать глубину", "Не открыть окно за спиной.", "safe", "football-iq", 48, 9, 3),
      option("lb-rob", "Читать QB", "Сжать внутренний маршрут после подтверждения.", "balanced", "technique", 64, 23, 11),
      option("lb-jump", "Прыгнуть окно", "Покинуть зону ради мяча.", "aggressive", "competitiveness", 79, 40, 26),
    ];
  }
  return [
    option("cb-leverage", "Держать leverage", "Не отдавать внутреннюю часть поля.", "safe", "football-iq", 49, 10, 3),
    option("cb-disrupt", "Сбить тайминг", "Навязать контакт и остаться в позиции.", "balanced", "technique", 64, 24, 11),
    option("cb-jump", "Прыгнуть маршрут", "Оставить безопасную позицию ради мяча.", "aggressive", "competitiveness", 80, 42, 27),
  ];
}

function ownTeamRatings(save: CareerSave): TeamRatings {
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  if (collegeCareer) {
    const team = save.world.teams.find((item) => item.id === collegeCareer.teamId);
    const culture = save.world.social.teamCultures.find((item) => item.teamId === collegeCareer.teamId);
    const rating = team?.rating ?? 72;
    return {
      offense: clamp(rating + ((team?.tactical.installation ?? 62) - 60) * .12),
      defense: clamp(rating + ((team?.tactical.continuity ?? 60) - 60) * .1),
      coaching: clamp((team?.tactical.installation ?? 62) * .55 + (team?.prestige ?? rating) * .45),
      cohesion: culture?.cohesion ?? 58,
    };
  }
  const offenseRoster = save.football.roster.filter((player) => player.unit === "offense" && player.status !== "injured");
  const defenseRoster = save.football.roster.filter((player) => player.unit === "defense" && player.status !== "injured");
  const average = (values: number[], fallback: number) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
  const base = (save.football.school.prestige + save.football.school.coaching) / 2;
  return {
    offense: clamp(average(offenseRoster.map((player) => player.overall), base) * .72 + save.football.teamDynamics.schemeMastery * .28),
    defense: clamp(average(defenseRoster.map((player) => player.overall), base) * .72 + save.football.teamDynamics.schemeMastery * .28),
    coaching: save.football.school.coaching,
    cohesion: save.football.teamDynamics.cohesion,
  };
}

function opponentTeamRatings(save: CareerSave, opponentId: string): TeamRatings {
  if (save.meta.phase === "college-season") {
    const team = save.world.teams.find((item) => item.id === opponentId);
    const culture = save.world.social.teamCultures.find((item) => item.teamId === opponentId);
    const rating = team?.rating ?? 72;
    return {
      offense: clamp(rating + ((team?.tactical.installation ?? 60) - 60) * .1),
      defense: clamp(rating + ((team?.tactical.continuity ?? 60) - 60) * .1),
      coaching: clamp((team?.tactical.installation ?? 60) * .55 + (team?.prestige ?? rating) * .45),
      cohesion: culture?.cohesion ?? 55,
    };
  }
  const opponent = save.football.season.opponents.find((item) => item.id === opponentId);
  const rating = opponent?.rating ?? 72;
  return { offense: rating, defense: rating, coaching: clamp(rating + 2), cohesion: clamp(rating - 4) };
}

function ratingsForSide(save: CareerSave, side: MatchTeamSide): TeamRatings {
  return side === "hero" ? ownTeamRatings(save) : opponentTeamRatings(save, save.football.match.opponentId);
}

function heroSkillValue(save: CareerSave, optionValue: MatchDecisionOption): number {
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
  }[optionValue.focus];
  return (
    focus * .45 +
    ratings.technique * .14 +
    ratings.footballIq * .13 +
    save.character.condition.confidence * .09 +
    save.football.training.body.readiness * .08 +
    coachTrust * .05 +
    heroTacticalFit * .06
  );
}

function gradeFromScore(score: number): MatchOutcomeGrade {
  if (score >= 80) return "A";
  if (score >= 64) return "B";
  if (score >= 47) return "C";
  return "D";
}

function canHeroCheck(save: CareerSave): boolean {
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const coachTrust = collegeCareer?.coachTrust ?? save.football.depthChart.coachTrust;
  const isStarter = collegeCareer ? collegeCareer.role === "starter" : save.football.depthChart.rank === 1;
  if (!isStarter) return false;

  if (save.football.position === "QB") {
    return save.football.ratings.footballIq >= 72 && coachTrust >= 68;
  }

  const defensiveCaptain = save.football.position === "LB"
    && save.football.ratings.footballIq >= 80
    && coachTrust >= 82
    && (collegeCareer
      ? collegeCareer.lockerRoomStanding >= 78
      : save.football.ratings.competitiveness >= 75);
  return defensiveCaptain;
}

function generateEpisode(save: CareerSave, match: FootballMatchState, index: number): MatchEpisode {
  const offenseSide = controlledOffense(match);
  const scoreMargin = offenseSide === "hero"
    ? match.heroScore - match.opponentScore
    : match.opponentScore - match.heroScore;
  const offenseCanCheck = match.heroUnit === "offense" && canHeroCheck(save);
  const defenseCanCheck = match.heroUnit === "defense" && canHeroCheck(save);
  const offenseCall = callPlay(
    `${save.meta.worldSeed}:${match.gameId}:offense-call:${index}`,
    "offense",
    match.driveDown,
    match.driveDistance,
    match.driveFieldPosition,
    offenseCanCheck,
    scoreMargin,
    match.quarter,
    match.clockSeconds,
  );
  const defenseCall = callPlay(
    `${save.meta.worldSeed}:${match.gameId}:defense-call:${index}`,
    "defense",
    match.driveDown,
    match.driveDistance,
    match.driveFieldPosition,
    defenseCanCheck,
    -scoreMargin,
    match.quarter,
    match.clockSeconds,
  );
  const assignments = buildSnapAssignments(
    offenseCall,
    defenseCall,
    offenseSide,
    match.heroUnit,
    save.football.position,
    `${save.meta.worldSeed}:${match.gameId}:assignments:${index}`,
  );
  const heroAssignment = describeHeroAssignment(save.football.position, match.heroUnit, assignments, offenseCall, defenseCall);
  const hero = assignments.find((assignment) => assignment.isHero);
  const playCall = match.heroUnit === "offense" ? offenseCall : defenseCall;
  const opponentCall = match.heroUnit === "offense" ? defenseCall : offenseCall;
  const fieldZone = match.driveFieldPosition >= 80 ? "red zone" : match.driveFieldPosition <= 20 ? "глубоко на своей половине" : "между двадцатками";
  return {
    id: `${match.gameId}-snap-${index + 1}`,
    driveId: match.currentDriveId,
    possession: offenseSide,
    unit: match.heroUnit,
    position: save.football.position,
    quarter: match.quarter,
    clockSeconds: match.clockSeconds,
    playClockSeconds: match.playClockSeconds,
    down: match.driveDown,
    distance: match.driveDistance,
    fieldPosition: match.driveFieldPosition,
    scoreMargin: match.heroScore - match.opponentScore,
    title: `${offenseCall.formation} · ${offenseCall.concept}`,
    situation: `${match.driveDown} & ${match.driveDistance}, ${fieldZone}. Атака: ${offenseCall.personnel}. Защита: ${defenseCall.personnel}.`,
    assignment: heroAssignment.role,
    read: playCall.canCheck
      ? "Штаб разрешает ограниченный check. Ты меняешь только свой ключ, protection или сторону вызова."
      : "Вызов принадлежит штабу. Ты отвечаешь только за своё назначение после снэпа.",
    playCall,
    opponentCall,
    heroInvolvement: heroAssignment.involvement,
    heroRole: heroAssignment.role,
    heroSlot: heroAssignment.heroSlot,
    assignments,
    options: assignmentOptions(save.football.position, hero ?? assignments[0]!, heroAssignment.involvement),
  };
}

function matchupModifier(offenseCall: MatchEpisode["playCall"], defenseCall: MatchEpisode["opponentCall"]): number {
  const offense = offenseCall.playType === "blitz" || offenseCall.playType === "coverage" ? defenseCall : offenseCall;
  const defense = offenseCall.playType === "blitz" || offenseCall.playType === "coverage" ? offenseCall : defenseCall;
  let modifier = 0;
  if (defense.playType === "blitz") {
    if (offense.playType === "screen") modifier += 10;
    else if (offense.playType === "play-action") modifier -= 6;
    else if (offense.playType === "pass") modifier -= 2;
    else modifier -= 4;
  }
  if (defense.formation === "Dime" && offense.playType === "run") modifier += 9;
  if ((defense.formation === "Bear Front" || defense.formation === "Goal Line") && offense.playType === "run") modifier -= 9;
  if (defense.tags.includes("two-high") && offense.tags.includes("shot")) modifier -= 6;
  if (defense.tags.includes("quick-game") && offense.tags.includes("quick")) modifier -= 5;
  if (offense.tags.includes("pressure-answer") && defense.playType === "blitz") modifier += 7;
  return modifier;
}

function chooseTarget(call: MatchEpisode["playCall"], random: SeededRandom, pressured: boolean): string | undefined {
  const progression = call.progression;
  if (progression.length === 0) return call.primarySlot;
  if (progression.length === 1) return progression[0];
  const weights = progression.map((_, index) => {
    if (pressured) return Math.max(.08, .62 - index * .17);
    return Math.max(.1, .44 - index * .09);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = random.next() * total;
  for (let index = 0; index < progression.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return progression[index];
  }
  return progression[progression.length - 1];
}

function simulateSnap(
  save: CareerSave,
  match: FootballMatchState,
  episode: MatchEpisode,
  assignmentScore: number,
  selected: MatchDecisionOption,
  random: SeededRandom,
): SnapSimulation {
  const offenseSide = episode.possession;
  const defenseSide = otherSide(offenseSide);
  const offenseRatings = ratingsForSide(save, offenseSide);
  const defenseRatings = ratingsForSide(save, defenseSide);
  const offenseCall = match.heroUnit === "offense" ? episode.playCall : episode.opponentCall;
  const defenseCall = match.heroUnit === "defense" ? episode.playCall : episode.opponentCall;
  const heroInfluenceBase = (assignmentScore - 60) * (episode.heroInvolvement === "primary" ? .24 : episode.heroInvolvement === "secondary" ? .13 : .07);
  const heroInfluence = match.heroUnit === "offense" ? heroInfluenceBase : -heroInfluenceBase;
  const fatiguePenalty = match.heroFatigue * .05;
  const offenseExecution = offenseRatings.offense * .64 + offenseRatings.coaching * .19 + offenseRatings.cohesion * .17 + random.integer(-14, 14);
  const defenseExecution = defenseRatings.defense * .64 + defenseRatings.coaching * .19 + defenseRatings.cohesion * .17 + random.integer(-14, 14);
  const teamEdge = offenseExecution - defenseExecution + matchupModifier(offenseCall, defenseCall) + heroInfluence - fatiguePenalty * (match.heroUnit === "offense" ? 1 : -1);
  const teamExecutionScore = clamp(62 + teamEdge * 1.05);
  const passLike = offenseCall.playType === "pass" || offenseCall.playType === "play-action" || offenseCall.playType === "screen";
  const pressureBase = defenseCall.playType === "blitz" ? .31 + defenseCall.aggression * .003 : .11;
  const pressureChance = Math.max(.05, Math.min(.62, pressureBase - teamEdge * .006 + (offenseCall.playType === "screen" ? -.18 : 0)));
  const pressured = passLike && random.chance(pressureChance);
  const targetSlot = passLike ? chooseTarget(offenseCall, random, pressured) : undefined;
  let ballCarrierSlot = offenseCall.playType === "run" ? offenseCall.primarySlot ?? "RB" : undefined;
  if (offenseCall.concept.includes("Read") && random.chance(.21)) ballCarrierSlot = "QB";

  if (random.chance(.045)) {
    const offensePenalty = random.chance(.62);
    const yards = offensePenalty ? -5 : Math.min(10, episode.distance);
    return {
      snapResult: "penalty",
      yards,
      points: 0,
      turnover: false,
      firstDown: !offensePenalty && yards >= episode.distance,
      repeatDown: offensePenalty,
      targetSlot,
      ballCarrierSlot,
      teamExecutionScore,
      description: offensePenalty ? "Флаг против атаки. Пять ярдов назад, down повторяется." : "Защита нарушает правила. Атака получает ярды по штрафу.",
    };
  }

  if (offenseCall.playType === "run") {
    let yards: number;
    if (teamEdge <= -18) yards = random.integer(-4, 0);
    else if (teamEdge <= -6) yards = random.integer(0, 3);
    else if (teamEdge <= 8) yards = random.integer(2, 6);
    else if (teamEdge <= 20) yards = random.integer(5, 12);
    else yards = random.integer(10, 27);
    const fumbleChance = Math.max(.008, .022 + Math.max(0, -teamEdge) * .0015 + selected.mistakeRisk * .0007);
    if (random.chance(fumbleChance)) {
      return { snapResult: "turnover", yards, points: 0, turnover: true, firstDown: false, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: "Мяч выбит в контакте. Защита забирает владение." };
    }
    if (episode.fieldPosition + yards >= 100) {
      return { snapResult: "touchdown", yards: 100 - episode.fieldPosition, points: 7, scoringSide: offenseSide, turnover: false, firstDown: true, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: "Вынос проходит до зачётной зоны." };
    }
    return { snapResult: "run", yards, points: 0, turnover: false, firstDown: yards >= episode.distance, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: yards < 0 ? "Фронт защиты выигрывает точку атаки." : `Вынос приносит ${yards} ярдов.` };
  }

  const interceptionChance = Math.max(.008, Math.min(.19, .018 + Math.max(0, -teamEdge) * .003 + offenseCall.aggression * .00055 + (pressured ? .025 : 0)));
  if (random.chance(interceptionChance)) {
    const pickSix = random.chance(.08 + Math.max(0, -teamEdge) * .002);
    return {
      snapResult: pickSix ? "defensive-touchdown" : "turnover",
      yards: 0,
      points: pickSix ? 7 : 0,
      scoringSide: pickSix ? defenseSide : undefined,
      turnover: true,
      firstDown: false,
      repeatDown: false,
      targetSlot,
      teamExecutionScore,
      description: pickSix ? "Защитник читает бросок и возвращает перехват в тачдаун." : "Защита перехватывает передачу и меняет владение.",
    };
  }

  const sackChance = pressured ? Math.max(.08, Math.min(.48, .22 - teamEdge * .008)) : Math.max(.01, .06 - teamEdge * .003);
  if (random.chance(sackChance)) {
    const yards = -random.integer(4, 10);
    return { snapResult: "sack", yards, points: 0, turnover: false, firstDown: false, repeatDown: false, targetSlot, teamExecutionScore, description: `Карман закрывается. Потеря ${Math.abs(yards)} ярдов.` };
  }

  const depthPenalty = offenseCall.aggression >= 75 ? .12 : offenseCall.aggression >= 60 ? .06 : 0;
  const completionChance = Math.max(.24, Math.min(.86, .59 + teamEdge * .011 - depthPenalty + (offenseCall.playType === "screen" ? .16 : 0) - (pressured ? .14 : 0)));
  if (!random.chance(completionChance)) {
    return { snapResult: "incomplete", yards: 0, points: 0, turnover: false, firstDown: false, repeatDown: false, targetSlot, teamExecutionScore, description: pressured ? "Давление ломает тайминг, пас не завершён." : "Окно закрывается до прибытия мяча." };
  }

  const base = offenseCall.playType === "screen"
    ? random.integer(2, 12)
    : offenseCall.aggression >= 75
      ? random.integer(12, 28)
      : offenseCall.aggression >= 58
        ? random.integer(7, 18)
        : random.integer(3, 11);
  const yards = Math.max(-2, base + Math.round(teamEdge * .18) + random.integer(-3, 4));
  if (episode.fieldPosition + yards >= 100) {
    return { snapResult: "touchdown", yards: 100 - episode.fieldPosition, points: 7, scoringSide: offenseSide, turnover: false, firstDown: true, repeatDown: false, targetSlot, teamExecutionScore, description: "Передача завершается в зачётной зоне." };
  }
  return { snapResult: "completion", yards, points: 0, turnover: false, firstDown: yards >= episode.distance, repeatDown: false, targetSlot, teamExecutionScore, description: `Пас завершён на ${yards} ярдов.` };
}

function makeAdvancedDelta(hero: MatchPlayerAssignment, grade: MatchOutcomeGrade, involved: boolean): MatchAdvancedStatLine {
  const won = grade === "A" || grade === "B";
  return {
    snaps: 1,
    assignmentWins: won ? 1 : 0,
    assignmentLosses: grade === "D" ? 1 : 0,
    routeWins: hero.kind === "route" && won ? 1 : 0,
    separationWins: hero.kind === "route" && grade === "A" ? 1 : 0,
    blocksWon: (hero.kind === "run-block" || hero.kind === "pass-protection") && won ? 1 : 0,
    pressures: hero.kind === "rush" && grade === "A" ? 1 : 0,
    coverageWins: (hero.kind === "zone-coverage" || hero.kind === "man-coverage") && won ? 1 : 0,
    missedTackles: matchDefender(hero) && involved && grade === "D" ? 1 : 0,
  };
}

function matchDefender(hero: MatchPlayerAssignment): boolean {
  return hero.unit === "defense";
}

function makeStatDelta(
  save: CareerSave,
  episode: MatchEpisode,
  simulation: SnapSimulation,
  grade: MatchOutcomeGrade,
  random: SeededRandom,
): { stats: MatchStatLine; advanced: MatchAdvancedStatLine; involved: boolean } {
  const stats = createEmptyMatchStats();
  const hero = episode.assignments.find((assignment) => assignment.isHero);
  if (!hero) return { stats, advanced: createEmptyAdvancedMatchStats(), involved: false };
  const success = simulation.snapResult === "completion" || simulation.snapResult === "touchdown";
  let involved = false;

  if (save.football.position === "QB") {
    if (simulation.ballCarrierSlot === hero.slot) {
      involved = true;
      stats.rushingAttempts = 1;
      stats.rushingYards = simulation.yards;
    } else if (episode.playCall.playType !== "run") {
      involved = true;
      stats.passingAttempts = 1;
      stats.completions = success ? 1 : 0;
      stats.passingYards = success ? Math.max(0, simulation.yards) : 0;
      stats.turnovers = simulation.turnover ? 1 : 0;
    }
  } else if (save.football.position === "RB") {
    if (simulation.ballCarrierSlot === hero.slot) {
      involved = true;
      stats.rushingAttempts = 1;
      stats.rushingYards = simulation.yards;
      stats.turnovers = simulation.turnover ? 1 : 0;
    }
    if (simulation.targetSlot === hero.slot) {
      involved = true;
      stats.targets = 1;
      stats.receptions = success ? 1 : 0;
      stats.receivingYards = success ? Math.max(0, simulation.yards) : 0;
    }
  } else if (save.football.position === "WR") {
    if (simulation.targetSlot === hero.slot) {
      involved = true;
      stats.targets = 1;
      stats.receptions = success ? 1 : 0;
      stats.receivingYards = success ? Math.max(0, simulation.yards) : 0;
    }
  } else if (save.football.position === "LB") {
    const runContact = simulation.ballCarrierSlot !== undefined && (hero.kind === "run-fit" || hero.kind === "rush") && random.chance(grade === "A" ? .72 : grade === "B" ? .48 : .23);
    const pressureContact = simulation.snapResult === "sack" && hero.kind === "rush" && grade === "A";
    const targetContact = simulation.targetSlot !== undefined && hero.matchupSlot === simulation.targetSlot;
    involved = runContact || pressureContact || targetContact;
    stats.tackles = runContact || pressureContact ? 1 : targetContact && simulation.snapResult === "completion" ? 1 : 0;
    stats.tacklesForLoss = stats.tackles > 0 && simulation.yards < 0 ? 1 : 0;
    stats.sacks = pressureContact ? 1 : 0;
    stats.passBreakups = targetContact && simulation.snapResult === "incomplete" && (grade === "A" || grade === "B") ? 1 : 0;
    stats.interceptions = targetContact && simulation.turnover && grade === "A" ? 1 : 0;
  } else {
    const targetContact = simulation.targetSlot !== undefined && hero.matchupSlot === simulation.targetSlot;
    const runContact = simulation.ballCarrierSlot !== undefined && random.chance(grade === "A" ? .28 : .12);
    involved = targetContact || runContact;
    stats.tackles = (targetContact && simulation.snapResult === "completion") || runContact ? 1 : 0;
    stats.passBreakups = targetContact && simulation.snapResult === "incomplete" && (grade === "A" || grade === "B") ? 1 : 0;
    stats.interceptions = targetContact && simulation.turnover && grade === "A" ? 1 : 0;
  }

  if (simulation.points === 7 && simulation.scoringSide === "hero") {
    const directOffensiveScore = episode.possession === "hero" && (
      simulation.ballCarrierSlot === hero.slot || simulation.targetSlot === hero.slot || save.football.position === "QB" && episode.playCall.playType !== "run"
    );
    const directDefensiveScore = episode.possession === "opponent" && stats.interceptions > 0;
    if (directOffensiveScore || directDefensiveScore) stats.touchdowns = 1;
  }

  return { stats, advanced: makeAdvancedDelta(hero, grade, involved), involved };
}

function advanceDrive(episode: MatchEpisode, simulation: SnapSimulation): DriveAdvance {
  const nextFieldPosition = clampInteger(episode.fieldPosition + simulation.yards, 1, 99);
  if (simulation.snapResult === "touchdown") return { driveEnded: true, outcome: "touchdown", nextDown: 1, nextDistance: 10, nextFieldPosition: 25, firstDown: true };
  if (simulation.snapResult === "defensive-touchdown") return { driveEnded: true, outcome: "defensive-touchdown", nextDown: 1, nextDistance: 10, nextFieldPosition: 25, firstDown: false };
  if (simulation.turnover) {
    const turnoverSpot = clampInteger(episode.fieldPosition + simulation.yards, 1, 99);
    return { driveEnded: true, outcome: "turnover", nextDown: 1, nextDistance: 10, nextFieldPosition: turnoverSpot, firstDown: false };
  }
  if (simulation.repeatDown) return { driveEnded: false, outcome: "active", nextDown: episode.down, nextDistance: clampInteger(episode.distance - simulation.yards, 1, 99), nextFieldPosition, firstDown: false };
  const firstDown = simulation.yards >= episode.distance;
  if (firstDown) return { driveEnded: false, outcome: "active", nextDown: 1, nextDistance: Math.min(10, 100 - nextFieldPosition), nextFieldPosition, firstDown: true };
  if (episode.down === 4) return { driveEnded: true, outcome: "turnover-on-downs", nextDown: 1, nextDistance: 10, nextFieldPosition, firstDown: false };
  return {
    driveEnded: false,
    outcome: "active",
    nextDown: (episode.down + 1) as 2 | 3 | 4,
    nextDistance: clampInteger(episode.distance - simulation.yards, 1, 99),
    nextFieldPosition,
    firstDown: false,
  };
}

function specialTeamsDecision(match: FootballMatchState, scoreMargin: number): "punt" | "field-goal" | "go" {
  if (match.driveDown !== 4) return "go";
  const lateNeed = match.quarter === 4 && match.clockSeconds < 240 && scoreMargin < 0;
  if (lateNeed && match.driveDistance <= 7) return "go";
  if (match.driveFieldPosition >= 63 && match.driveDistance <= 9) return "field-goal";
  if (match.driveDistance <= 2 && match.driveFieldPosition >= 45) return "go";
  return "punt";
}

function driveSummary(
  match: FootballMatchState,
  endClock: { quarter: 1 | 2 | 3 | 4; clockSeconds: number },
  fieldPosition: number,
  outcome: MatchDriveOutcome,
  points: number,
  description: string,
): MatchDriveSummary {
  return {
    id: match.currentDriveId,
    offense: controlledOffense(match),
    startQuarter: match.driveStartQuarter,
    startClockSeconds: match.driveStartClockSeconds,
    endQuarter: endClock.quarter,
    endClockSeconds: endClock.clockSeconds,
    startFieldPosition: match.driveStartFieldPosition,
    endFieldPosition: fieldPosition,
    plays: match.drivePlays,
    yards: match.driveYards,
    points,
    outcome,
    description,
    controlled: true,
  };
}

function backgroundDrive(
  save: CareerSave,
  offenseSide: MatchTeamSide,
  gameClockSeconds: number,
  startFieldPosition: number,
  driveNumber: number,
  seed: string,
): BackgroundDriveResult {
  const random = new SeededRandom(seed);
  const defenseSide = otherSide(offenseSide);
  const offenseRatings = ratingsForSide(save, offenseSide);
  const defenseRatings = ratingsForSide(save, defenseSide);
  const edge = (offenseRatings.offense + offenseRatings.coaching * .25 + offenseRatings.cohesion * .15)
    - (defenseRatings.defense + defenseRatings.coaching * .25 + defenseRatings.cohesion * .15)
    + random.integer(-24, 24);
  const plays = clampInteger(5 + Math.round(edge / 12) + random.integer(-2, 3), 3, 12);
  const timeUsed = Math.min(gameClockSeconds, clampInteger(plays * random.integer(24, 37), 70, 390));
  const nextClock = Math.max(0, gameClockSeconds - timeUsed);
  const start = clockParts(gameClockSeconds);
  const end = clockParts(nextClock);
  let outcome: MatchDriveOutcome;
  let points = 0;
  let yards = clampInteger(28 + edge * 1.15 + random.integer(-18, 25), 4, 90);
  if (edge >= 18 || startFieldPosition + yards >= 100) {
    outcome = "touchdown";
    points = 7;
    yards = Math.min(100 - startFieldPosition, Math.max(yards, 35));
  } else if (edge >= 7 && startFieldPosition + yards >= 55) {
    outcome = "field-goal";
    points = 3;
  } else if (edge <= -18 && random.chance(.62)) {
    outcome = "turnover";
  } else {
    outcome = "punt";
  }
  const heroScoreDelta = offenseSide === "hero" ? points : 0;
  const opponentScoreDelta = offenseSide === "opponent" ? points : 0;
  const nextControlledFieldPosition = outcome === "turnover"
    ? random.integer(38, 68)
    : outcome === "punt"
      ? random.integer(18, 41)
      : 25;
  return {
    summary: {
      id: `drive-${driveNumber}-auto`,
      offense: offenseSide,
      startQuarter: start.quarter,
      startClockSeconds: start.clockSeconds,
      endQuarter: end.quarter,
      endClockSeconds: end.clockSeconds,
      startFieldPosition,
      endFieldPosition: clampInteger(startFieldPosition + yards, 1, 99),
      plays,
      yards,
      points,
      outcome,
      description: outcome === "touchdown" ? "Автоматический драйв завершается тачдауном." : outcome === "field-goal" ? "Автоматический драйв приносит филд-гол." : outcome === "turnover" ? "Защита забирает мяч на автоматическом драйве." : "Драйв заканчивается пантом.",
      controlled: false,
    },
    heroScoreDelta,
    opponentScoreDelta,
    nextControlledFieldPosition,
    gameClockSeconds: nextClock,
  };
}

function finalizeScores(save: CareerSave, match: FootballMatchState): FootballMatchState {
  let gameClock = match.gameClockSeconds;
  let heroScore = match.heroScore;
  let opponentScore = match.opponentScore;
  const drives = [...match.drives];
  const controlledSide = controlledOffense(match);
  const currentDriveArchived = drives.some((drive) => drive.id === match.currentDriveId);

  if (gameClock > 0 && !currentDriveArchived && match.drivePlays > 0) {
    const remainder = backgroundDrive(
      save,
      controlledSide,
      gameClock,
      match.driveFieldPosition,
      match.driveNumber,
      `${save.meta.worldSeed}:${match.gameId}:closing-current:${match.driveNumber}`,
    );
    gameClock = remainder.gameClockSeconds;
    heroScore += remainder.heroScoreDelta;
    opponentScore += remainder.opponentScoreDelta;
    drives.push({
      ...remainder.summary,
      id: match.currentDriveId,
      startQuarter: match.driveStartQuarter,
      startClockSeconds: match.driveStartClockSeconds,
      startFieldPosition: match.driveStartFieldPosition,
      plays: match.drivePlays + remainder.summary.plays,
      yards: match.driveYards + remainder.summary.yards,
      description: `Остаток управляемого владения доигран штабом. ${remainder.summary.description}`,
      controlled: true,
    });
  }

  let offense: MatchTeamSide = currentDriveArchived ? otherSide(controlledSide) : controlledSide;
  if (match.drivePlays > 0 && !currentDriveArchived) offense = otherSide(controlledSide);
  let counter = match.driveNumber + 1;
  while (gameClock > 0) {
    const drive = backgroundDrive(save, offense, gameClock, 25, counter, `${save.meta.worldSeed}:${match.gameId}:closing:${counter}`);
    gameClock = drive.gameClockSeconds;
    heroScore += drive.heroScoreDelta;
    opponentScore += drive.opponentScoreDelta;
    drives.push(drive.summary);
    offense = otherSide(offense);
    counter += 1;
  }
  if (heroScore === opponentScore) {
    const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:overtime`);
    if (random.chance(.5)) heroScore += 3;
    else opponentScore += 3;
  }
  return { ...match, heroScore, opponentScore, gameClockSeconds: 0, quarter: 4, clockSeconds: 0, drives };
}

function resultCopy(episode: MatchEpisode, simulation: SnapSimulation, grade: MatchOutcomeGrade, involved: boolean): Pick<MatchEpisodeResult, "headline" | "description"> {
  if (simulation.snapResult === "touchdown") return { headline: "Тачдаун", description: simulation.description };
  if (simulation.snapResult === "defensive-touchdown") return { headline: "Тачдаун защиты", description: simulation.description };
  if (simulation.turnover) return { headline: "Смена владения", description: simulation.description };
  if (simulation.snapResult === "sack") return { headline: "Сэк", description: simulation.description };
  if (simulation.snapResult === "penalty") return { headline: "Флаг", description: simulation.description };
  if (!involved) {
    return grade === "A" || grade === "B"
      ? { headline: "Назначение выполнено", description: `Мяч идёт в другую часть поля. ${episode.heroRole}. ${simulation.description}` }
      : { headline: "Ошибка без статистики", description: `Ты не касаешься мяча, но штаб фиксирует проблему в назначении. ${simulation.description}` };
  }
  if (episode.unit === "offense") {
    return simulation.yards >= episode.distance
      ? { headline: "Цепи двигаются", description: simulation.description }
      : simulation.yards > 0
        ? { headline: "Положительный снэп", description: simulation.description }
        : { headline: "Снэп проигран", description: simulation.description };
  }
  return simulation.yards <= 0
    ? { headline: "Защита выигрывает снэп", description: simulation.description }
    : simulation.yards < episode.distance
      ? { headline: "Атака остановлена до маркера", description: simulation.description }
      : { headline: "Защита отдаёт first down", description: simulation.description };
}

function finalResult(match: FootballMatchState, save: CareerSave): MatchFinalResult {
  const grade = gradeFromScore(match.coachGrade);
  const won = match.heroScore > match.opponentScore;
  const assignmentRate = match.advancedStats.snaps > 0
    ? Math.round(match.advancedStats.assignmentWins / match.advancedStats.snaps * 100)
    : 0;
  const spotlight = save.football.position === "QB"
    ? `${match.stats.completions}/${match.stats.passingAttempts}, ${match.stats.passingYards} ярдов, задания ${assignmentRate}%`
    : save.football.position === "RB"
      ? `${match.stats.rushingYards} ярдов, ${match.stats.receptions} приёмов, задания ${assignmentRate}%`
      : save.football.position === "WR"
        ? `${match.stats.receptions}/${match.stats.targets}, ${match.stats.receivingYards} ярдов, route wins ${match.advancedStats.routeWins}`
        : save.football.position === "LB"
          ? `${match.stats.tackles} захватов, ${match.stats.sacks} sacks, pressures ${match.advancedStats.pressures}`
          : `${match.stats.tackles} захватов, ${match.stats.passBreakups} PBU, coverage wins ${match.advancedStats.coverageWins}`;
  const coachTrustDelta = round((match.coachGrade - 55) * .11, 1);
  const visibilityDelta = round(Math.max(0, (match.coachGrade - 52) * .09) + (won ? .8 : 0), 1);
  const teamName = save.meta.phase === "college-season"
    ? save.football.college.program?.shortName ?? "Программа"
    : save.football.school.shortName;
  return {
    won,
    heroScore: match.heroScore,
    opponentScore: match.opponentScore,
    grade,
    headline: won ? "Победа закрыта" : "Матч упущен",
    summary: `${teamName} ${won ? "побеждает" : "проигрывает"} ${match.heroScore}:${match.opponentScore}. Штаб ставит ${grade}.`,
    spotlight,
    coachTrustDelta,
    visibilityDelta,
  };
}

function startControlledDrive(match: FootballMatchState, gameClockSeconds: number, fieldPosition: number, driveNumber: number): FootballMatchState {
  const clock = clockParts(gameClockSeconds);
  return {
    ...match,
    possession: controlledOffense(match),
    quarter: clock.quarter,
    clockSeconds: clock.clockSeconds,
    gameClockSeconds,
    playClockSeconds: 25,
    driveDown: 1,
    driveDistance: Math.min(10, 100 - fieldPosition),
    driveFieldPosition: fieldPosition,
    driveNumber,
    currentDriveId: `${match.gameId}-drive-${driveNumber}`,
    driveStartQuarter: clock.quarter,
    driveStartClockSeconds: clock.clockSeconds,
    driveStartFieldPosition: fieldPosition,
    drivePlays: 0,
    driveYards: 0,
  };
}

export function startMatch(save: CareerSave): CareerSave {
  const match = save.football.match;
  if (match.status !== "upcoming") return save;
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:kickoff`);
  const controlledSide = match.heroUnit === "offense" ? "hero" : "opponent";
  let started: FootballMatchState = {
    ...match,
    status: "in-progress",
    heroScore: 0,
    opponentScore: 0,
    quarter: 1,
    clockSeconds: QUARTER_SECONDS,
    gameClockSeconds: GAME_SECONDS,
    playClockSeconds: 25,
    possession: controlledSide,
    heroFatigue: clamp(save.character.condition.fatigue * .16 + (100 - save.football.training.body.readiness) * .12, 3, 24),
    coachGrade: 55,
    episodeIndex: 0,
    driveDown: 1,
    driveDistance: 10,
    driveFieldPosition: 25,
    driveNumber: 1,
    currentDriveId: `${match.gameId}-drive-1`,
    driveStartQuarter: 1,
    driveStartClockSeconds: QUARTER_SECONDS,
    driveStartFieldPosition: 25,
    drivePlays: 0,
    driveYards: 0,
    timeoutsHero: 3,
    timeoutsOpponent: 3,
    completedEpisodes: [],
    drives: [],
    stats: createEmptyMatchStats(),
    advancedStats: createEmptyAdvancedMatchStats(),
    finalResult: undefined,
    currentEpisode: undefined,
  };

  if (match.openingKickoffReceiver !== controlledSide) {
    const opening = backgroundDrive(save, match.openingKickoffReceiver, GAME_SECONDS, 25, 1, `${save.meta.worldSeed}:${match.gameId}:opening-drive`);
    started = {
      ...started,
      heroScore: opening.heroScoreDelta,
      opponentScore: opening.opponentScoreDelta,
      drives: [opening.summary],
    };
    started = startControlledDrive(started, opening.gameClockSeconds, opening.nextControlledFieldPosition, 2);
  } else {
    started = startControlledDrive(started, GAME_SECONDS, random.integer(22, 28), 1);
  }
  started = { ...started, currentEpisode: generateEpisode(save, started, 0) };

  return {
    ...save,
    football: { ...save.football, match: started },
    history: [
      ...save.history,
      {
        id: `${match.gameId}-started`,
        occurredAt: save.meta.updatedAt,
        type: "match-started",
        title: `Матч против ${match.opponentName}`,
        description: `Начался полный матчевый симулятор. Штаб вызывает обе стороны розыгрыша, а ${save.football.position} отвечает только за своё назначение.`,
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
  const fatiguePenalty = match.heroFatigue * .2 + save.character.condition.fatigue * .06;
  const painPenalty = save.football.training.body.pain * .09 + (save.football.training.body.medicalStatus === "limited" ? 6 : 0);
  const assignmentScore = clamp(heroSkillValue(save, selected) + random.integer(-16, 16) - selected.difficulty * .34 - fatiguePenalty - painPenalty + 24);
  const grade = gradeFromScore(assignmentScore);
  const simulation = simulateSnap(save, match, episode, assignmentScore, selected, random);
  const statResolution = makeStatDelta(save, episode, simulation, grade, random);
  const coachDelta = round(grade === "A" ? 2.4 : grade === "B" ? 1 : grade === "C" ? -.6 : -2.6, 1);
  const confidenceDelta = round(grade === "A" ? 1.3 : grade === "B" ? .5 : grade === "C" ? -.3 : -1.1, 1);
  const fatigueDelta = round(1 + selected.difficulty * .013 + (selected.risk === "aggressive" ? .65 : 0), 1);
  const snapTime = simulation.snapResult === "incomplete" || simulation.snapResult === "penalty"
    ? random.integer(7, 16)
    : random.integer(24, 39);
  let gameClockSeconds = Math.max(0, match.gameClockSeconds - snapTime);
  const clock = clockParts(gameClockSeconds);
  const advance = advanceDrive(episode, simulation);
  const copy = resultCopy(episode, simulation, grade, statResolution.involved);
  const outcome: MatchEpisodeResult = {
    id: `${episode.id}-result`,
    episodeId: episode.id,
    driveId: episode.driveId,
    optionId,
    grade,
    snapResult: simulation.snapResult,
    ...copy,
    yards: simulation.yards,
    points: simulation.points,
    scoringSide: simulation.scoringSide,
    coachDelta,
    confidenceDelta,
    fatigueDelta,
    assignmentScore,
    teamExecutionScore: simulation.teamExecutionScore,
    involved: statResolution.involved,
    firstDown: advance.firstDown,
    driveEnded: advance.driveEnded,
    targetSlot: simulation.targetSlot,
    ballCarrierSlot: simulation.ballCarrierSlot,
    statDelta: statResolution.stats,
    advancedDelta: statResolution.advanced,
  };

  let heroScore = match.heroScore + (simulation.scoringSide === "hero" ? simulation.points : 0);
  let opponentScore = match.opponentScore + (simulation.scoringSide === "opponent" ? simulation.points : 0);
  let driveEnded = advance.driveEnded;
  let driveOutcome = advance.outcome;
  let drivePoints = simulation.scoringSide === episode.possession ? simulation.points : 0;
  let driveDescription = simulation.description;
  let nextDown = advance.nextDown;
  let nextDistance = advance.nextDistance;
  let nextFieldPosition = advance.nextFieldPosition;
  let drivePlays = match.drivePlays + 1;
  let driveYards = match.driveYards + simulation.yards;
  let drives = [...match.drives];

  if (!driveEnded) {
    const temporary = {
      ...match,
      quarter: clock.quarter,
      clockSeconds: clock.clockSeconds,
      gameClockSeconds,
      driveDown: nextDown,
      driveDistance: nextDistance,
      driveFieldPosition: nextFieldPosition,
    };
    const offenseMargin = episode.possession === "hero" ? heroScore - opponentScore : opponentScore - heroScore;
    const special = specialTeamsDecision(temporary, offenseMargin);
    if (special === "punt") {
      driveEnded = true;
      driveOutcome = "punt";
      driveDescription = "После третьего down штаб выпускает punt unit.";
      gameClockSeconds = Math.max(0, gameClockSeconds - random.integer(8, 16));
    } else if (special === "field-goal") {
      driveEnded = true;
      const kickDistance = 117 - nextFieldPosition;
      const offenseRatings = ratingsForSide(save, episode.possession);
      const makeChance = Math.max(.28, Math.min(.92, .91 - Math.max(0, kickDistance - 32) * .018 + (offenseRatings.coaching - 65) * .004));
      const made = random.chance(makeChance);
      driveOutcome = made ? "field-goal" : "missed-field-goal";
      drivePoints = made ? 3 : 0;
      driveDescription = made ? `Кикер реализует филд-гол с ${kickDistance} ярдов.` : `Филд-гол с ${kickDistance} ярдов не проходит.`;
      if (made) {
        if (episode.possession === "hero") heroScore += 3;
        else opponentScore += 3;
      }
      gameClockSeconds = Math.max(0, gameClockSeconds - random.integer(5, 10));
    }
  }

  if (gameClockSeconds <= 0 && !driveEnded) {
    driveEnded = true;
    driveOutcome = "end-game";
    driveDescription = "Время матча истекло на текущем владении.";
  }

  let nextMatch: FootballMatchState = {
    ...match,
    heroScore,
    opponentScore,
    quarter: clockParts(gameClockSeconds).quarter,
    clockSeconds: clockParts(gameClockSeconds).clockSeconds,
    gameClockSeconds,
    playClockSeconds: 25,
    heroFatigue: clamp(match.heroFatigue + fatigueDelta),
    coachGrade: clamp(match.coachGrade + coachDelta),
    episodeIndex: match.episodeIndex + 1,
    driveDown: nextDown,
    driveDistance: nextDistance,
    driveFieldPosition: nextFieldPosition,
    drivePlays,
    driveYards,
    completedEpisodes: [...match.completedEpisodes, { ...outcome, driveEnded }],
    stats: addStats(match.stats, statResolution.stats),
    advancedStats: addAdvancedStats(match.advancedStats, statResolution.advanced),
    currentEpisode: undefined,
  };

  if (driveEnded) {
    const endClock = clockParts(gameClockSeconds);
    const controlledSummary = driveSummary(
      { ...nextMatch, drivePlays, driveYards },
      endClock,
      nextFieldPosition,
      driveOutcome,
      drivePoints,
      driveDescription,
    );
    drives.push(controlledSummary);

    if (gameClockSeconds <= 0) {
      nextMatch = { ...nextMatch, heroScore, opponentScore, drives };
    } else if (driveOutcome === "defensive-touchdown") {
      nextMatch = startControlledDrive(
        { ...nextMatch, heroScore, opponentScore, drives },
        gameClockSeconds,
        25,
        match.driveNumber + 1,
      );
    } else {
      const backgroundOffense = otherSide(episode.possession);
      const backgroundStart = driveOutcome === "turnover" || driveOutcome === "turnover-on-downs"
        ? clampInteger(100 - nextFieldPosition, 20, 75)
        : 25;
      const background = backgroundDrive(
        save,
        backgroundOffense,
        gameClockSeconds,
        backgroundStart,
        match.driveNumber + 1,
        `${save.meta.worldSeed}:${match.gameId}:background:${match.driveNumber + 1}`,
      );
      heroScore += background.heroScoreDelta;
      opponentScore += background.opponentScoreDelta;
      drives.push(background.summary);
      nextMatch = {
        ...nextMatch,
        heroScore,
        opponentScore,
        drives,
      };
      nextMatch = startControlledDrive(nextMatch, background.gameClockSeconds, background.nextControlledFieldPosition, match.driveNumber + 2);
    }
  } else {
    nextMatch = { ...nextMatch, drives };
  }

  const nextCharacter = {
    ...save.character,
    condition: {
      ...save.character.condition,
      confidence: clamp(save.character.condition.confidence + confidenceDelta),
      fatigue: clamp(save.character.condition.fatigue + fatigueDelta * .34),
      energy: clamp(save.character.condition.energy - fatigueDelta * .27),
    },
  };

  const shouldFinish = nextMatch.episodeIndex >= nextMatch.totalEpisodes || nextMatch.gameClockSeconds <= 0;
  let nextFootball = save.football;
  let history = save.history;

  if (shouldFinish) {
    const completedClock = nextMatch.gameClockSeconds <= 0
      ? nextMatch
      : finalizeScores(save, nextMatch);
    const result = finalResult(completedClock, save);
    nextMatch = {
      ...completedClock,
      status: "complete",
      heroScore: result.heroScore,
      opponentScore: result.opponentScore,
      quarter: 4,
      clockSeconds: 0,
      gameClockSeconds: 0,
      finalResult: result,
      currentEpisode: undefined,
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
      nextFootball = { ...nextFootball, recruitment: updateRecruitingAfterMatch(recruitingSave, nextMatch) };
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
    nextMatch = { ...nextMatch, currentEpisode: generateEpisode(save, nextMatch, nextMatch.episodeIndex) };
    nextFootball = { ...save.football, match: nextMatch };
  }

  return { ...save, character: nextCharacter, football: nextFootball, history };
}
