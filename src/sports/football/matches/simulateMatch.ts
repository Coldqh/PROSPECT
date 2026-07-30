import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import { applyCompletedMatchToSeason } from "../season/updateSeason";
import { updateRecruitingAfterMatch } from "../recruiting/updateRecruiting";
import type { FootballPosition } from "../career/types";
import { FOOTBALL_ROSTER_POSITIONS } from "../team/positions";
import type { FootballRosterPosition } from "../team/types";
import { buildSnapAssignments, buildSpecialTeamsAssignments, callPlay, describeHeroAssignment } from "./playbook";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats } from "./createMatchState";
import { calculateDecisionForecast, decisionScoreCenter } from "./decisionForecast";
import { decodeLivePlayOutcome } from "./realTimeEngine";
import { aggregateMatchEvaluation, evaluateSnapPerformance, gradeFromPerformanceScore } from "./performanceEvaluation";
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
  MatchParticipationMode,
  MatchSnapResult,
  MatchStatLine,
  MatchTeamSide,
  MatchTacticalCall,
  MatchTacticalProfile,
} from "./types";

const GAME_SECONDS = 48 * 60;
const QUARTER_SECONDS = 12 * 60;

interface TeamRatings {
  offense: number;
  defense: number;
  coaching: number;
  cohesion: number;
}

interface SpecialistSnapshot {
  name: string;
  overall: number;
  health: number;
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
  pressureOccurred?: boolean;
  grossPuntYards?: number;
  puntReturnYards?: number;
  kickDistance?: number;
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
  return match.heroUnit === "defense" ? "opponent" : "hero";
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
  const target = result as Record<keyof MatchStatLine, number>;
  for (const key of Object.keys(result) as Array<keyof MatchStatLine>) {
    target[key] = key === "longestFieldGoal"
      ? Math.max(left[key], right[key])
      : left[key] + right[key];
  }
  return result;
}

function addAdvancedStats(left: MatchAdvancedStatLine, right: MatchAdvancedStatLine): MatchAdvancedStatLine {
  const result = { ...left };
  const target = result as Record<keyof MatchAdvancedStatLine, number>;
  for (const key of Object.keys(result) as Array<keyof MatchAdvancedStatLine>) {
    target[key] = left[key] + right[key];
  }
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
  void involvement;
  if (position === "QB") {
    if (hero.kind === "handoff") return [
      option("qb-give", "Отдать по вызову", "Держать mesh и передать мяч в назначенный гэп.", "safe", "football-iq", 46, 10, 3),
      option("qb-read", "Прочитать edge", "Оставить мяч RB или забрать по движению защитника.", "balanced", "football-iq", 62, 20, 10),
      option("qb-keep", "Оставить себе", "Атаковать backside до реакции contain.", "aggressive", "athleticism", 76, 34, 22),
    ];
    return [
      option("qb-rhythm", "Играть по таймингу", "Пройти progression и убрать мяч до давления.", "safe", "football-iq", 50, 12, 4),
      option("qb-window", "Атаковать окно", "Держать взгляд и бросить между уровнями защиты.", "balanced", "technique", 64, 24, 12),
      option("qb-extend", "Продлить розыгрыш", "Уйти из структуры ради глубокого чтения.", "aggressive", "competitiveness", 79, 40, 27),
    ];
  }
  if (position === "RB") {
    if (hero.kind === "carry") return [
      option("rb-track", "Держать трек", "Продавить назначенную точку и читать первый блок.", "safe", "technique", 49, 11, 4),
      option("rb-cut", "Сделать cutback", "Перенести трек после движения второго уровня.", "balanced", "football-iq", 63, 23, 11),
      option("rb-bounce", "Атаковать край", "Отказаться от гэпа и выйти на скорость.", "aggressive", "athleticism", 77, 38, 23),
    ];
    return [
      option("rb-scan", "Сначала protection", "Найти свободного rusher и только потом выйти.", "safe", "football-iq", 47, 9, 3),
      option("rb-chip", "Ударить edge", "Помочь tackle и выйти поздним checkdown.", "balanced", "technique", 60, 16, 8),
      option("rb-release", "Сразу выйти", "Освободиться в короткой зоне до blitz.", "aggressive", "athleticism", 73, 27, 19),
    ];
  }
  if (position === "WR" || position === "TE") {
    if (hero.kind === "run-block" || hero.kind === "pass-protection") return [
      option("receiver-position", "Занять leverage", "Зафиксировать внешнее плечо защитника.", "safe", "football-iq", 46, 8, 3),
      option("receiver-drive", "Вести блок", "Держать ноги и сопровождать защитника.", "balanced", "technique", 59, 16, 7),
      option("receiver-finish", "Закончить блок", "Убрать защитника из точки атаки.", "aggressive", "competitiveness", 72, 25, 16),
    ];
    return [
      option("receiver-timing", "Сохранить тайминг", "Выйти в точку по счёту шагов.", "safe", "technique", 49, 11, 4),
      option("receiver-leverage", "Выиграть leverage", "Сменить темп и открыть нужное плечо.", "balanced", "football-iq", 63, 23, 10),
      option("receiver-break", "Атаковать separation", "Резко изменить траекторию на вершине.", "aggressive", "athleticism", 77, 39, 22),
    ];
  }
  if (position === "OT" || position === "OG" || position === "C") return [
    option("ol-base", "Держать базу", "Не терять внутреннее плечо и глубину кармана.", "safe", "technique", 48, 10, 3),
    option("ol-key", position === "C" ? "Перестроить protection" : "Передать stunt", "Прочитать движение фронта и сохранить комбинацию.", "balanced", "football-iq", 63, 23, 10),
    option("ol-finish", "Доминировать в контакте", "Атаковать leverage и завершить блок.", "aggressive", "competitiveness", 77, 38, 22),
  ];
  if (position === "EDGE" || position === "DT") return [
    option("dl-control", "Контролировать гэп", "Сохранить плечи и не открыть линию выноса.", "safe", "football-iq", 48, 10, 4),
    option("dl-counter", "Собрать rush-план", "Связать первый приём с counter move.", "balanced", "technique", 64, 24, 11),
    option("dl-attack", "Атаковать первым шагом", "Рискнуть гэпом ради быстрого давления.", "aggressive", "athleticism", 78, 39, 24),
  ];
  if (position === "LB") {
    if (hero.kind === "rush" || hero.kind === "run-fit") return [
      option("lb-fit", "Закрыть назначение", "Сохранить плечо и не открыть cutback.", "safe", "football-iq", 48, 10, 4),
      option("lb-trigger", "Атаковать ключ", "Сработать после движения guard или back.", "balanced", "technique", 63, 22, 10),
      option("lb-shoot", "Прострелить гэп", "Пойти до подтверждения и разрушить розыгрыш.", "aggressive", "athleticism", 77, 37, 23),
    ];
    return [
      option("lb-depth", "Держать глубину", "Не открыть окно за спиной.", "safe", "football-iq", 48, 9, 3),
      option("lb-rob", "Читать QB", "Сжать внутренний маршрут после подтверждения.", "balanced", "technique", 64, 23, 11),
      option("lb-jump", "Прыгнуть окно", "Покинуть зону ради мяча.", "aggressive", "competitiveness", 79, 40, 26),
    ];
  }
  if (position === "CB" || position === "S") return [
    option("db-leverage", "Держать leverage", "Не отдавать свою часть поля.", "safe", "football-iq", 49, 10, 3),
    option("db-disrupt", "Сбить тайминг", "Сжать маршрут и остаться в позиции.", "balanced", "technique", 64, 24, 11),
    option("db-jump", "Прыгнуть маршрут", "Оставить безопасную позицию ради мяча.", "aggressive", "competitiveness", 80, 42, 27),
  ];
  if (position === "K") return [
    option("k-center", "Бить по центру", "Сохранить привычную траекторию и чистый контакт.", "safe", "technique", 50, 12, 4),
    option("k-drive", "Пробить жёстко", "Снизить траекторию ради дополнительной дальности.", "balanced", "athleticism", 64, 24, 12),
    option("k-shape", "Подкрутить удар", "Использовать ветер и целиться ближе к стойке.", "aggressive", "football-iq", 78, 38, 24),
  ];
  return [
    option("p-direction", "Бить к боковой", "Сократить поле для returner.", "safe", "technique", 49, 11, 4),
    option("p-hang", "Максимум hang time", "Дать coverage время закрыть коридоры.", "balanced", "football-iq", 63, 24, 10),
    option("p-power", "Пробить на дальность", "Рискнуть контролем ради смены позиции поля.", "aggressive", "athleticism", 77, 39, 22),
  ];
}

function ownTeamRatings(save: CareerSave): TeamRatings {
  const professionalCareer = save.meta.phase === "professional-career" ? save.football.professional.heroCareer : undefined;
  if (professionalCareer?.teamId) {
    const team = save.football.professional.teams.find((item) => item.id === professionalCareer.teamId);
    const roster = save.football.professional.league.roster.filter((player) => player.teamId === professionalCareer.teamId && player.status === "active");
    const offensePositions = new Set<FootballPosition>(["QB", "RB", "WR", "TE", "OT", "OG", "C"]);
    const defensePositions = new Set<FootballPosition>(["EDGE", "DT", "LB", "CB", "S"]);
    const average = (players: typeof roster, fallback: number) => players.length > 0
      ? players.reduce((sum, player) => sum + player.overall, 0) / players.length
      : fallback;
    const base = team?.rosterStrength ?? 72;
    return {
      offense: clamp(average(roster.filter((player) => offensePositions.has(player.position)), base) * .82 + base * .18),
      defense: clamp(average(roster.filter((player) => defensePositions.has(player.position)), base) * .82 + base * .18),
      coaching: clamp((team?.prestige ?? base) * .7 + professionalCareer.coachTrust * .3),
      cohesion: clamp(58 + professionalCareer.coachTrust * .28 + (team?.prestige ?? base) * .12),
    };
  }
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
  if (save.meta.phase === "professional-career") {
    const team = save.football.professional.teams.find((item) => item.id === opponentId);
    const roster = save.football.professional.league.roster.filter((player) => player.teamId === opponentId && player.status === "active");
    const offensePositions = new Set<FootballPosition>(["QB", "RB", "WR", "TE", "OT", "OG", "C"]);
    const defensePositions = new Set<FootballPosition>(["EDGE", "DT", "LB", "CB", "S"]);
    const average = (players: typeof roster, fallback: number) => players.length > 0
      ? players.reduce((sum, player) => sum + player.overall, 0) / players.length
      : fallback;
    const base = team?.rosterStrength ?? 72;
    return {
      offense: clamp(average(roster.filter((player) => offensePositions.has(player.position)), base) * .84 + base * .16),
      defense: clamp(average(roster.filter((player) => defensePositions.has(player.position)), base) * .84 + base * .16),
      coaching: clamp((team?.prestige ?? base) * .82 + base * .18),
      cohesion: clamp(54 + (team?.prestige ?? base) * .34),
    };
  }
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

function defaultTacticalProfile(seed: string): MatchTacticalProfile {
  const random = new SeededRandom(`${seed}:default-tactics`);
  return {
    offenseSystem: "multiple",
    defenseSystem: "multiple-defense",
    runRate: 48 + random.integer(-3, 3),
    playActionRate: 18,
    screenRate: 12,
    deepShotRate: 20,
    blitzRate: 34 + random.integer(-3, 3),
    manCoverageRate: 42,
    disguiseRate: 56,
    fourthDownAggression: 50,
    adaptation: 55,
  };
}

function tacticalProfileForSide(save: CareerSave, side: MatchTeamSide): MatchTacticalProfile {
  const teamId = side === "hero" ? heroTeamId(save) : save.football.match.opponentId;
  if (save.meta.phase === "professional-career") {
    const tactical = save.football.professional.teams.find((team) => team.id === teamId)?.tactical;
    return tactical ? { ...tactical } : defaultTacticalProfile(`${save.meta.worldSeed}:${teamId}:pro`);
  }
  const tactical = save.world.teams.find((team) => team.id === teamId)?.tactical;
  if (!tactical) return defaultTacticalProfile(`${save.meta.worldSeed}:${teamId}:world`);
  return {
    offenseSystem: tactical.offenseSystem,
    defenseSystem: tactical.defenseSystem,
    runRate: tactical.runRate ?? 48,
    playActionRate: tactical.playActionRate ?? 18,
    screenRate: tactical.screenRate ?? 12,
    deepShotRate: tactical.deepShotRate ?? 20,
    blitzRate: tactical.blitzRate ?? 34,
    manCoverageRate: tactical.manCoverageRate ?? 42,
    disguiseRate: tactical.disguiseRate ?? 56,
    fourthDownAggression: tactical.fourthDownAggression ?? 50,
    adaptation: tactical.adaptation ?? 55,
  };
}

function ratingsForSide(save: CareerSave, side: MatchTeamSide): TeamRatings {
  return side === "hero" ? ownTeamRatings(save) : opponentTeamRatings(save, save.football.match.opponentId);
}

function specialistForSide(
  save: CareerSave,
  side: MatchTeamSide,
  position: "K" | "P",
): SpecialistSnapshot {
  const teamId = side === "hero" ? heroTeamId(save) : save.football.match.opponentId;
  const professionalPlayer = save.meta.phase === "professional-career"
    ? save.football.professional.league.roster
      .filter((candidate) => candidate.teamId === teamId && candidate.position === position && candidate.status === "active")
      .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall)[0]
    : undefined;
  const player = professionalPlayer ?? save.world.players
    .filter((candidate) => candidate.teamId === teamId
      && candidate.position === position
      && candidate.status !== "injured"
      && candidate.eligibility.athleticallyEligible)
    .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall)[0]
    ?? save.world.players
      .filter((candidate) => candidate.teamId === teamId && candidate.position === position)
      .sort((left, right) => right.overall - left.overall)[0];
  const fallback = ratingsForSide(save, side);
  return {
    name: player?.name ?? (position === "K" ? "Кикер" : "Пантер"),
    overall: player?.overall ?? clamp((fallback.offense + fallback.coaching) / 2),
    health: player?.health ?? 88,
  };
}

function fieldGoalChance(kicker: SpecialistSnapshot, distance: number, coaching: number): number {
  const distancePenalty = Math.max(0, distance - 31) * .0185;
  const specialistBonus = (kicker.overall - 65) * .0075 + (kicker.health - 85) * .002;
  const coachingBonus = (coaching - 65) * .0025;
  return Math.max(.12, Math.min(.96, .82 - distancePenalty + specialistBonus + coachingBonus));
}

function puntNetYards(punter: SpecialistSnapshot, random: SeededRandom): number {
  return clampInteger(34 + (punter.overall - 60) * .24 + (punter.health - 80) * .04 + random.integer(-6, 7), 25, 52);
}

function gradeFromScore(score: number): MatchOutcomeGrade {
  return gradeFromPerformanceScore(score);
}

function heroTeamId(save: CareerSave): string {
  if (save.meta.phase === "professional-career") {
    return save.football.professional.heroCareer?.teamId ?? save.football.professional.contract?.teamId ?? save.football.school.id;
  }
  return save.meta.phase === "college-season"
    ? save.football.college.heroCareer?.teamId ?? save.football.college.signedProgramId ?? save.football.school.id
    : save.football.school.id;
}

function assignmentPosition(value: string): FootballRosterPosition | undefined {
  return (FOOTBALL_ROSTER_POSITIONS as readonly string[]).includes(value)
    ? value as FootballRosterPosition
    : undefined;
}

function bindRosterToAssignments(
  save: CareerSave,
  match: FootballMatchState,
  assignments: MatchPlayerAssignment[],
): MatchPlayerAssignment[] {
  const teamIds: Record<MatchTeamSide, string> = {
    hero: heroTeamId(save),
    opponent: match.opponentId,
  };
  const usedByRoom = new Map<string, number>();
  return assignments.map((assignment) => {
    const position = assignmentPosition(assignment.position);
    if (!position) return assignment;
    if (assignment.isHero) {
      const professionalHero = save.meta.phase === "professional-career"
        ? save.football.professional.league.roster.find((player) => player.isHero)
        : undefined;
      const hero = professionalHero ?? save.world.players.find((player) => player.isHero);
      return {
        ...assignment,
        playerId: hero?.id ?? "hero",
        playerName: save.character.identity.fullName,
        overall: hero?.overall ?? save.football.ratings.overall,
        health: hero?.health ?? save.character.condition.health,
        depthRank: hero?.depthRank ?? save.football.professional.heroCareer?.depthRank ?? save.football.depthChart.rank,
      };
    }
    const roomKey = `${assignment.side}:${position}`;
    const roomIndex = usedByRoom.get(roomKey) ?? 0;
    usedByRoom.set(roomKey, roomIndex + 1);
    const professionalRoom = save.meta.phase === "professional-career"
      ? save.football.professional.league.roster
        .filter((player) => player.teamId === teamIds[assignment.side]
          && player.position === position
          && !player.isHero
          && player.status === "active")
        .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall || right.form - left.form)
      : undefined;
    const worldRoom = save.world.players
      .filter((player) => player.teamId === teamIds[assignment.side]
        && player.position === position
        && !player.isHero
        && player.status !== "injured"
        && player.eligibility.athleticallyEligible)
      .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall || right.form - left.form);
    const room = professionalRoom ?? worldRoom;
    const player = room[roomIndex] ?? room[roomIndex % Math.max(1, room.length)] ?? (professionalRoom
      ? professionalRoom[roomIndex]
      : save.world.players
        .filter((candidate) => candidate.teamId === teamIds[assignment.side] && candidate.position === position && !candidate.isHero)
        .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall)[roomIndex]);
    if (!player) return assignment;
    return {
      ...assignment,
      playerId: player.id,
      playerName: player.name,
      overall: player.overall,
      health: player.health,
      depthRank: player.depthRank,
    };
  });
}

function canHeroCheck(save: CareerSave): boolean {
  const professionalCareer = save.meta.phase === "professional-career" ? save.football.professional.heroCareer : undefined;
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const coachTrust = professionalCareer?.coachTrust ?? collegeCareer?.coachTrust ?? save.football.depthChart.coachTrust;
  const isStarter = professionalCareer
    ? professionalCareer.role === "starter"
    : collegeCareer ? collegeCareer.role === "starter" : save.football.depthChart.rank === 1;
  if (!isStarter) return false;

  if (save.football.position === "QB") {
    return save.football.ratings.footballIq >= 72 && coachTrust >= 68;
  }

  const defensiveCaptain = (save.football.position === "LB" || save.football.position === "S")
    && save.football.ratings.footballIq >= 80
    && coachTrust >= 82
    && (professionalCareer
      ? professionalCareer.coachTrust >= 84
      : collegeCareer
        ? collegeCareer.lockerRoomStanding >= 78
        : save.football.ratings.competitiveness >= 75);
  const lineCaller = save.football.position === "C"
    && save.football.ratings.footballIq >= 82
    && coachTrust >= 76;
  return defensiveCaptain || lineCaller;
}

function specialPlayCall(position: "K" | "P", canCheck: boolean): MatchEpisode["playCall"] {
  return position === "K"
    ? { id: "special-field-goal", formation: "Field Goal", personnel: "FG", concept: "Field Goal", playType: "field-goal", strength: "middle", calledBy: "head-coach", canCheck, aggression: 48, progression: [], tags: ["special-teams", "scoring"] }
    : { id: "special-punt", formation: "Punt", personnel: "Punt", concept: "Directional Punt", playType: "punt", strength: "right", calledBy: "head-coach", canCheck, aggression: 38, progression: [], tags: ["special-teams", "field-position"] };
}

function generateSpecialEpisode(save: CareerSave, match: FootballMatchState, index: number): MatchEpisode {
  const position = save.football.position as "K" | "P";
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:special:${index}`);
  const fieldPosition = position === "K" ? random.integer(58, 91) : random.integer(18, 68);
  const distance = position === "K" ? 117 - fieldPosition : 10;
  const playCall = specialPlayCall(position, false);
  const opponentCall: MatchEpisode["opponentCall"] = {
    id: position === "K" ? "field-goal-block" : "punt-return",
    formation: position === "K" ? "FG Block" : "Punt Return",
    personnel: "Special",
    concept: position === "K" ? "Edge Block" : "Return Middle",
    playType: position === "K" ? "blitz" : "coverage",
    strength: "middle",
    calledBy: "defensive-coordinator",
    canCheck: false,
    aggression: position === "K" ? 72 : 44,
    progression: [],
    tags: ["special-teams"],
  };
  const assignments = bindRosterToAssignments(save, match, buildSpecialTeamsAssignments(position, "hero", `${save.meta.worldSeed}:${match.gameId}:special-assignments:${index}`));
  const hero = assignments.find((assignment) => assignment.isHero) ?? assignments[0]!;
  const role = position === "K" ? `Филд-гол с ${distance} ярдов` : "Пант с контролем return lane";
  return {
    id: `${match.gameId}-special-${index + 1}`,
    driveId: match.currentDriveId,
    possession: "hero",
    unit: "special",
    position,
    quarter: match.quarter,
    clockSeconds: match.clockSeconds,
    playClockSeconds: match.playClockSeconds,
    down: 4,
    distance,
    fieldPosition,
    scoreMargin: match.heroScore - match.opponentScore,
    title: position === "K" ? `Field Goal · ${distance} ярдов` : "Punt · контроль поля",
    situation: position === "K" ? `Штаб отправляет спецкоманду на удар с ${distance} ярдов.` : `Четвёртый даун. Мяч на отметке ${fieldPosition}.`,
    assignment: role,
    read: "Штаб выбирает юнит и тип удара. Ты управляешь только исполнением.",
    playCall,
    opponentCall,
    heroInvolvement: "primary",
    heroRole: role,
    heroSlot: hero.slot,
    assignments,
    options: assignmentOptions(position, hero, "primary"),
  };
}

function generateEpisode(save: CareerSave, match: FootballMatchState, index: number): MatchEpisode {
  if (match.heroUnit === "special") return generateSpecialEpisode(save, match, index);
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
    {
      profile: tacticalProfileForSide(save, offenseSide),
      recentOffense: offenseSide === "hero" ? match.tacticalMemory.heroOffense : match.tacticalMemory.opponentOffense,
    },
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
    {
      profile: tacticalProfileForSide(save, otherSide(offenseSide)),
      recentOffense: offenseSide === "hero" ? match.tacticalMemory.heroOffense : match.tacticalMemory.opponentOffense,
    },
  );
  const assignments = bindRosterToAssignments(save, match, buildSnapAssignments(
    offenseCall,
    defenseCall,
    offenseSide,
    match.heroUnit,
    save.football.position,
    `${save.meta.worldSeed}:${match.gameId}:assignments:${index}`,
  ));
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

function simulateSpecialTeamsSnap(
  episode: MatchEpisode,
  assignmentScore: number,
  selected: MatchDecisionOption,
  random: SeededRandom,
): SnapSimulation {
  if (episode.position === "K") {
    const distance = episode.distance;
    const accuracy = assignmentScore + (selected.id === "k-center" ? 5 : selected.id === "k-drive" ? (distance >= 48 ? 5 : -2) : 1);
    const chance = Math.max(.12, Math.min(.97, .88 - Math.max(0, distance - 30) * .018 + (accuracy - 65) * .0085 - selected.mistakeRisk * .0015));
    const made = random.chance(chance);
    return {
      snapResult: made ? "field-goal" : "missed-field-goal",
      yards: 0,
      points: made ? 3 : 0,
      scoringSide: made ? "hero" : undefined,
      turnover: false,
      firstDown: false,
      repeatDown: false,
      teamExecutionScore: clamp(accuracy),
      description: made ? `Удар с ${distance} ярдов проходит между стойками.` : `Удар с ${distance} ярдов уходит мимо створа.`,
      pressureOccurred: false,
      kickDistance: distance,
    };
  }
  const gross = clampInteger(34 + (assignmentScore - 55) * .28 + (selected.id === "p-power" ? 6 : selected.id === "p-hang" ? 1 : -1) + random.integer(-6, 7), 25, 62);
  const returnYards = clampInteger(12 - (assignmentScore - 55) * .13 + (selected.id === "p-hang" ? -4 : selected.id === "p-power" ? 3 : -2) + random.integer(-4, 7), 0, 24);
  const net = Math.max(18, gross - returnYards);
  return {
    snapResult: "punt",
    yards: net,
    points: 0,
    turnover: false,
    firstDown: false,
    repeatDown: false,
    teamExecutionScore: clamp(assignmentScore),
    description: `Пант летит на ${gross} ярдов, возврат — ${returnYards}. Чистая смена поля: ${net}.`,
    pressureOccurred: false,
    grossPuntYards: gross,
    puntReturnYards: returnYards,
  };
}

export function simulatedPassInterceptionChance(teamEdge: number, aggression: number, pressured: boolean): number {
  return Math.max(
    .002,
    Math.min(
      .045,
      .004
        + Math.max(0, -teamEdge) * .00075
        + aggression * .0001
        + (pressured ? .008 : 0),
    ),
  );
}

function simulateSnap(
  save: CareerSave,
  match: FootballMatchState,
  episode: MatchEpisode,
  assignmentScore: number,
  selected: MatchDecisionOption,
  random: SeededRandom,
): SnapSimulation {
  if (episode.unit === "special") return simulateSpecialTeamsSnap(episode, assignmentScore, selected, random);
  const offenseSide = episode.possession;
  const defenseSide = otherSide(offenseSide);
  const offenseRatings = ratingsForSide(save, offenseSide);
  const defenseRatings = ratingsForSide(save, defenseSide);
  const offenseCall = match.heroUnit === "offense" ? episode.playCall : episode.opponentCall;
  const defenseCall = match.heroUnit === "defense" ? episode.playCall : episode.opponentCall;
  const involvementWeight = episode.heroInvolvement === "primary" ? 1 : episode.heroInvolvement === "secondary" ? .62 : .34;
  const executionFactor = Math.max(-.65, Math.min(1, (assignmentScore - 52) / 38));
  const optionImpact = selected.upside * involvementWeight * executionFactor * .16;
  const heroInfluenceBase = (assignmentScore - 60) * (episode.heroInvolvement === "primary" ? .24 : episode.heroInvolvement === "secondary" ? .13 : .07) + optionImpact;
  const heroInfluence = match.heroUnit === "offense" ? heroInfluenceBase : -heroInfluenceBase;
  const fatiguePenalty = match.heroFatigue * .05;
  const offenseAssignments = episode.assignments.filter((assignment) => assignment.unit === "offense");
  const defenseAssignments = episode.assignments.filter((assignment) => assignment.unit === "defense");
  const lineupQuality = (items: MatchPlayerAssignment[]): number => items.length === 0
    ? 65
    : items.reduce((sum, assignment) => sum + (assignment.overall ?? 65) * .82 + (assignment.health ?? 82) * .18, 0) / items.length;
  const offenseLineup = lineupQuality(offenseAssignments);
  const defenseLineup = lineupQuality(defenseAssignments);
  const offenseExecution = offenseRatings.offense * .51 + offenseRatings.coaching * .16 + offenseRatings.cohesion * .13 + offenseLineup * .2 + random.integer(-14, 14);
  const defenseExecution = defenseRatings.defense * .51 + defenseRatings.coaching * .16 + defenseRatings.cohesion * .13 + defenseLineup * .2 + random.integer(-14, 14);
  const teamEdge = offenseExecution - defenseExecution + matchupModifier(offenseCall, defenseCall) + heroInfluence - fatiguePenalty * (match.heroUnit === "offense" ? 1 : -1);
  const teamExecutionScore = clamp(62 + teamEdge * 1.05);
  const passLike = offenseCall.playType === "pass" || offenseCall.playType === "play-action" || offenseCall.playType === "screen";
  const pressureBase = defenseCall.playType === "blitz" ? .31 + defenseCall.aggression * .003 : .11;
  const pressureChance = Math.max(.05, Math.min(.62, pressureBase - teamEdge * .006 + (offenseCall.playType === "screen" ? -.18 : 0)));
  const pressured = passLike && random.chance(pressureChance);
  const targetSlot = passLike ? chooseTarget(offenseCall, random, pressured) : undefined;
  let ballCarrierSlot = offenseCall.playType === "run" ? offenseCall.primarySlot ?? "RB" : undefined;
  if (offenseCall.concept.includes("Read") && random.chance(.21)) ballCarrierSlot = "QB";

  if (random.chance(.028 + selected.mistakeRisk * .00055)) {
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
    if (assignmentScore >= 68 && random.chance(Math.min(.38, selected.upside * .0038))) yards += random.integer(4, Math.max(5, Math.round(selected.upside * .22)));
    if (assignmentScore < 48 && selected.risk === "aggressive") yards -= random.integer(1, 5);
    const fumbleChance = Math.max(.008, .022 + Math.max(0, -teamEdge) * .0015 + selected.mistakeRisk * .0007);
    if (random.chance(fumbleChance)) {
      return { snapResult: "turnover", yards, points: 0, turnover: true, firstDown: false, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: "Мяч выбит в контакте. Защита забирает владение." };
    }
    if (episode.fieldPosition + yards >= 100) {
      return { snapResult: "touchdown", yards: 100 - episode.fieldPosition, points: 7, scoringSide: offenseSide, turnover: false, firstDown: true, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: "Вынос проходит до зачётной зоны." };
    }
    return { snapResult: "run", yards, points: 0, turnover: false, firstDown: yards >= episode.distance, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: yards < 0 ? "Фронт защиты выигрывает точку атаки." : `Вынос приносит ${yards} ярдов.` };
  }

  const interceptionChance = simulatedPassInterceptionChance(teamEdge, offenseCall.aggression, pressured);
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
      pressureOccurred: pressured,
    };
  }

  const sackChance = pressured ? Math.max(.08, Math.min(.48, .22 - teamEdge * .008)) : Math.max(.01, .06 - teamEdge * .003);
  if (random.chance(sackChance)) {
    const yards = -random.integer(4, 10);
    return { snapResult: "sack", yards, points: 0, turnover: false, firstDown: false, repeatDown: false, targetSlot, teamExecutionScore, description: `Карман закрывается. Потеря ${Math.abs(yards)} ярдов.`, pressureOccurred: true };
  }

  const depthPenalty = offenseCall.aggression >= 75 ? .12 : offenseCall.aggression >= 60 ? .06 : 0;
  const completionChance = Math.max(.24, Math.min(.86, .59 + teamEdge * .011 - depthPenalty + (offenseCall.playType === "screen" ? .16 : 0) - (pressured ? .14 : 0)));
  if (!random.chance(completionChance)) {
    return { snapResult: "incomplete", yards: 0, points: 0, turnover: false, firstDown: false, repeatDown: false, targetSlot, teamExecutionScore, description: pressured ? "Давление ломает тайминг, пас не завершён." : "Окно закрывается до прибытия мяча.", pressureOccurred: pressured };
  }

  const base = offenseCall.playType === "screen"
    ? random.integer(2, 12)
    : offenseCall.aggression >= 75
      ? random.integer(12, 28)
      : offenseCall.aggression >= 58
        ? random.integer(7, 18)
        : random.integer(3, 11);
  let yards = Math.max(-2, base + Math.round(teamEdge * .18) + random.integer(-3, 4));
  if (assignmentScore >= 68 && random.chance(Math.min(.42, selected.upside * .0042))) yards += random.integer(4, Math.max(6, Math.round(selected.upside * .24)));
  if (assignmentScore < 48 && selected.risk === "aggressive") yards = Math.max(-2, yards - random.integer(2, 7));
  if (episode.fieldPosition + yards >= 100) {
    return { snapResult: "touchdown", yards: 100 - episode.fieldPosition, points: 7, scoringSide: offenseSide, turnover: false, firstDown: true, repeatDown: false, targetSlot, teamExecutionScore, description: "Передача завершается в зачётной зоне.", pressureOccurred: pressured };
  }
  return { snapResult: "completion", yards, points: 0, turnover: false, firstDown: yards >= episode.distance, repeatDown: false, targetSlot, teamExecutionScore, description: `Пас завершён на ${yards} ярдов.`, pressureOccurred: pressured };
}

function makeAdvancedDelta(hero: MatchPlayerAssignment, grade: MatchOutcomeGrade, involved: boolean, pressureOccurred: boolean): MatchAdvancedStatLine {
  const won = grade === "A" || grade === "B";
  const doubleTeam = (hero.position === "OG" || hero.position === "C" || hero.position === "DT") && (hero.kind === "run-block" || hero.kind === "rush");
  return {
    snaps: 1,
    assignmentWins: won ? 1 : 0,
    assignmentLosses: grade === "D" ? 1 : 0,
    routeWins: hero.kind === "route" && won ? 1 : 0,
    separationWins: hero.kind === "route" && grade === "A" ? 1 : 0,
    blocksWon: (hero.kind === "run-block" || hero.kind === "pass-protection" || hero.kind === "kick-protection") && won ? 1 : 0,
    pressures: hero.kind === "rush" && pressureOccurred && grade === "A" ? 1 : 0,
    coverageWins: (hero.kind === "zone-coverage" || hero.kind === "man-coverage") && won ? 1 : 0,
    missedTackles: matchDefender(hero) && involved && grade === "D" ? 1 : 0,
    passProtectionWins: hero.kind === "pass-protection" && won ? 1 : 0,
    runBlockWins: hero.kind === "run-block" && won ? 1 : 0,
    doubleTeamWins: doubleTeam && won ? 1 : 0,
    kickQuality: hero.kind === "kick" ? Math.round(({ A: 4, B: 3, C: 2, D: 1 } as const)[grade]) : 0,
    puntQuality: hero.kind === "punt" ? Math.round(({ A: 4, B: 3, C: 2, D: 1 } as const)[grade]) : 0,
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

  if (save.football.position === "K") {
    involved = true;
    stats.fieldGoalsAttempted = 1;
    stats.fieldGoalsMade = simulation.snapResult === "field-goal" ? 1 : 0;
    stats.longestFieldGoal = stats.fieldGoalsMade ? simulation.kickDistance ?? episode.distance : 0;
  } else if (save.football.position === "P") {
    involved = true;
    stats.punts = 1;
    stats.puntYards = simulation.yards;
    stats.puntsInside20 = episode.fieldPosition + simulation.yards >= 80 ? 1 : 0;
    stats.returnYardsAllowed = simulation.puntReturnYards ?? 0;
  } else if (save.football.position === "QB") {
    if (simulation.ballCarrierSlot === hero.slot) {
      involved = true; stats.rushingAttempts = 1; stats.rushingYards = simulation.yards;
    } else if (episode.playCall.playType !== "run") {
      involved = true; stats.passingAttempts = 1; stats.completions = success ? 1 : 0; stats.passingYards = success ? Math.max(0, simulation.yards) : 0; stats.turnovers = simulation.turnover ? 1 : 0;
    }
  } else if (save.football.position === "RB") {
    if (simulation.ballCarrierSlot === hero.slot) {
      involved = true; stats.rushingAttempts = 1; stats.rushingYards = simulation.yards; stats.turnovers = simulation.turnover ? 1 : 0;
    }
    if (simulation.targetSlot === hero.slot) {
      involved = true; stats.targets = 1; stats.receptions = success ? 1 : 0; stats.receivingYards = success ? Math.max(0, simulation.yards) : 0;
    }
  } else if (save.football.position === "WR" || save.football.position === "TE") {
    if (simulation.targetSlot === hero.slot) {
      involved = true; stats.targets = 1; stats.receptions = success ? 1 : 0; stats.receivingYards = success ? Math.max(0, simulation.yards) : 0;
    }
    if (hero.kind === "run-block" || hero.kind === "pass-protection") {
      involved = true;
      stats.pancakes = grade === "A" && random.chance(.28) ? 1 : 0;
      stats.pressuresAllowed = hero.kind === "pass-protection" && simulation.pressureOccurred && (grade === "C" || grade === "D") ? 1 : 0;
    }
  } else if (save.football.position === "OT" || save.football.position === "OG" || save.football.position === "C") {
    involved = true;
    const passSnap = hero.kind === "pass-protection";
    stats.sacksAllowed = passSnap && simulation.snapResult === "sack" && (grade === "C" || grade === "D") ? 1 : 0;
    stats.pressuresAllowed = passSnap && simulation.pressureOccurred && (grade === "C" || grade === "D") ? 1 : 0;
    stats.pancakes = hero.kind === "run-block" && grade === "A" && random.chance(.35) ? 1 : 0;
  } else if (save.football.position === "EDGE" || save.football.position === "DT" || save.football.position === "LB") {
    const runContact = simulation.ballCarrierSlot !== undefined && (hero.kind === "run-fit" || hero.kind === "rush") && random.chance(grade === "A" ? .72 : grade === "B" ? .48 : .23);
    const sackShare = save.football.position === "EDGE" ? .34 : save.football.position === "DT" ? .22 : .16;
    const gradeShare = grade === "A" ? .18 : grade === "B" ? .08 : 0;
    const involvementShare = episode.heroInvolvement === "primary" ? .08 : episode.heroInvolvement === "secondary" ? .03 : 0;
    const pressureContact = simulation.snapResult === "sack"
      && hero.kind === "rush"
      && random.chance(Math.min(.68, sackShare + gradeShare + involvementShare));
    const targetContact = simulation.targetSlot !== undefined && hero.matchupSlot === simulation.targetSlot;
    involved = runContact || pressureContact || targetContact || hero.kind === "rush";
    stats.tackles = runContact || pressureContact ? 1 : targetContact && simulation.snapResult === "completion" ? 1 : 0;
    stats.tacklesForLoss = stats.tackles > 0 && simulation.yards < 0 ? 1 : 0;
    stats.sacks = pressureContact ? 1 : 0;
    stats.hurries = hero.kind === "rush" && simulation.pressureOccurred && stats.sacks === 0 && (grade === "A" || grade === "B") ? 1 : 0;
    stats.runStops = runContact && simulation.yards <= 2 ? 1 : 0;
    stats.passBreakups = targetContact && simulation.snapResult === "incomplete" && (grade === "A" || grade === "B") ? 1 : 0;
    stats.interceptions = targetContact && simulation.turnover && grade === "A" ? 1 : 0;
    stats.coverageSnaps = simulation.targetSlot !== undefined && (hero.kind === "zone-coverage" || hero.kind === "man-coverage") ? 1 : 0;
  } else {
    const targetContact = simulation.targetSlot !== undefined && hero.matchupSlot === simulation.targetSlot;
    const runContact = simulation.ballCarrierSlot !== undefined && random.chance(grade === "A" ? .32 : grade === "B" ? .18 : .08);
    involved = targetContact || runContact;
    stats.tackles = (targetContact && simulation.snapResult === "completion") || runContact ? 1 : 0;
    stats.passBreakups = targetContact && simulation.snapResult === "incomplete" && (grade === "A" || grade === "B") ? 1 : 0;
    stats.interceptions = targetContact && simulation.turnover && grade === "A" ? 1 : 0;
    stats.coverageSnaps = simulation.targetSlot !== undefined ? 1 : 0;
    stats.runStops = runContact && simulation.yards <= 2 ? 1 : 0;
  }

  if (simulation.points === 7 && simulation.scoringSide === "hero") {
    const directOffensiveScore = episode.possession === "hero" && (
      simulation.ballCarrierSlot === hero.slot || simulation.targetSlot === hero.slot || save.football.position === "QB" && episode.playCall.playType !== "run"
    );
    const directDefensiveScore = episode.possession === "opponent" && stats.interceptions > 0;
    if (directOffensiveScore || directDefensiveScore) stats.touchdowns = 1;
  }

  return { stats, advanced: makeAdvancedDelta(hero, grade, involved, Boolean(simulation.pressureOccurred)), involved };
}

function advanceDrive(episode: MatchEpisode, simulation: SnapSimulation): DriveAdvance {
  const nextFieldPosition = clampInteger(episode.fieldPosition + simulation.yards, 1, 99);
  if (simulation.snapResult === "field-goal") return { driveEnded: true, outcome: "field-goal", nextDown: 1, nextDistance: 10, nextFieldPosition: 25, firstDown: false };
  if (simulation.snapResult === "missed-field-goal") return { driveEnded: true, outcome: "missed-field-goal", nextDown: 1, nextDistance: 10, nextFieldPosition: episode.fieldPosition, firstDown: false };
  if (simulation.snapResult === "punt") return { driveEnded: true, outcome: "punt", nextDown: 1, nextDistance: 10, nextFieldPosition, firstDown: false };
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
    const kicker = specialistForSide(save, offenseSide, "K");
    const kickDistance = clampInteger(117 - clampInteger(startFieldPosition + yards, 1, 99), 18, 69);
    const made = random.chance(fieldGoalChance(kicker, kickDistance, offenseRatings.coaching));
    outcome = made ? "field-goal" : "missed-field-goal";
    points = made ? 3 : 0;
  } else if (edge <= -18 && random.chance(.62)) {
    outcome = "turnover";
  } else {
    outcome = "punt";
  }
  const heroScoreDelta = offenseSide === "hero" ? points : 0;
  const opponentScoreDelta = offenseSide === "opponent" ? points : 0;
  const punter = specialistForSide(save, offenseSide, "P");
  const nextControlledFieldPosition = outcome === "turnover"
    ? random.integer(38, 68)
    : outcome === "punt"
      ? clampInteger(100 - Math.min(99, startFieldPosition + yards + puntNetYards(punter, random)), 8, 45)
      : outcome === "missed-field-goal"
        ? clampInteger(100 - clampInteger(startFieldPosition + yards, 1, 99), 20, 75)
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
      description: outcome === "touchdown"
        ? "Автоматический драйв завершается тачдауном."
        : outcome === "field-goal"
          ? "Кикер автоматического юнита реализует филд-гол."
          : outcome === "missed-field-goal"
            ? "Кикер автоматического юнита не реализует филд-гол."
            : outcome === "turnover"
              ? "Защита забирает мяч на автоматическом драйве."
              : "Пантер автоматического юнита меняет позицию поля.",
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
  if (simulation.snapResult === "field-goal") return { headline: "Удар реализован", description: simulation.description };
  if (simulation.snapResult === "missed-field-goal") return { headline: "Промах", description: simulation.description };
  if (simulation.snapResult === "punt") return { headline: grade === "A" || grade === "B" ? "Поле перевёрнуто" : "Пант без преимущества", description: simulation.description };
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
  const evaluation = aggregateMatchEvaluation(
    save.football.position,
    match.completedEpisodes.map((item) => item.evaluation).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    match.stats,
    match.advancedStats,
  );
  const grade = evaluation.grade;
  const won = match.heroScore > match.opponentScore;
  const assignmentRate = match.advancedStats.snaps > 0
    ? Math.round(match.advancedStats.assignmentWins / match.advancedStats.snaps * 100)
    : 0;
  const spotlightByPosition: Record<FootballPosition, string> = {
    QB: `${match.stats.completions}/${match.stats.passingAttempts}, ${match.stats.passingYards} ярдов, задания ${assignmentRate}%`,
    RB: `${match.stats.rushingYards} ярдов, ${match.stats.receptions} приёмов, задания ${assignmentRate}%`,
    WR: `${match.stats.receptions}/${match.stats.targets}, ${match.stats.receivingYards} ярдов, route wins ${match.advancedStats.routeWins}`,
    TE: `${match.stats.receptions}/${match.stats.targets}, ${match.stats.receivingYards} ярдов, blocks ${match.advancedStats.blocksWon}`,
    OT: `${match.advancedStats.passProtectionWins} побед в pass pro, sacks allowed ${match.stats.sacksAllowed}, pancakes ${match.stats.pancakes}`,
    OG: `${match.advancedStats.runBlockWins} побед в выносе, pressures allowed ${match.stats.pressuresAllowed}, pancakes ${match.stats.pancakes}`,
    C: `${match.advancedStats.passProtectionWins + match.advancedStats.runBlockWins} выигранных блоков, pressures allowed ${match.stats.pressuresAllowed}, задания ${assignmentRate}%`,
    EDGE: `${match.stats.sacks} sacks, ${match.stats.hurries} hurries, ${match.stats.runStops} run stops`,
    DT: `${match.stats.tacklesForLoss} TFL, ${match.stats.hurries} hurries, ${match.stats.runStops} run stops`,
    LB: `${match.stats.tackles} захватов, ${match.stats.sacks} sacks, pressures ${match.advancedStats.pressures}`,
    CB: `${match.stats.tackles} захватов, ${match.stats.passBreakups} PBU, coverage wins ${match.advancedStats.coverageWins}`,
    S: `${match.stats.tackles} захватов, ${match.stats.interceptions} INT, coverage wins ${match.advancedStats.coverageWins}`,
    K: `${match.stats.fieldGoalsMade}/${match.stats.fieldGoalsAttempted} FG, дальний ${match.stats.longestFieldGoal} ярдов`,
    P: `${match.stats.punts} пантов, ${match.stats.puntYards} net yards, inside 20: ${match.stats.puntsInside20}`,
  };
  const spotlight = spotlightByPosition[save.football.position];
  const coachTrustDelta = round((evaluation.score - 68) * .08, 1);
  const visibilityDelta = round(Math.max(0, (evaluation.score - 62) * .07) + (won ? .8 : 0), 1);
  return {
    won,
    heroScore: match.heroScore,
    opponentScore: match.opponentScore,
    grade,
    headline: won ? "ПОБЕДА" : "ПОРАЖЕНИЕ",
    summary: `${Math.round(evaluation.score)}`,
    spotlight,
    coachTrustDelta,
    visibilityDelta,
    score: evaluation.score,
    evaluation,
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

function startMatchCore(save: CareerSave, participationMode: MatchParticipationMode, analysisMode: boolean): CareerSave {
  const match = save.football.match;
  if (match.status !== "upcoming") return save;
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:kickoff`);
  const controlledSide = controlledOffense(match);
  let started: FootballMatchState = {
    ...match,
    status: "in-progress",
    participationMode,
    analysisMode,
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
    tacticalMemory: { heroOffense: [], opponentOffense: [] },
    completedEpisodes: [],
    drives: [],
    stats: createEmptyMatchStats(),
    advancedStats: createEmptyAdvancedMatchStats(),
    finalResult: undefined,
    currentEpisode: undefined,
    lastResolvedEpisode: undefined,
    lastResolvedResult: undefined,
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
  const entryQuarter = match.entryQuarter ?? 1;
  if (entryQuarter > 1) {
    const targetClock = entryQuarter === 2 ? 33 * 60 : entryQuarter === 3 ? 21 * 60 : 9 * 60;
    let side: MatchTeamSide = started.possession;
    let driveNumber = started.driveNumber;
    while (started.gameClockSeconds > targetClock && driveNumber < 9) {
      const background = backgroundDrive(
        save,
        side,
        started.gameClockSeconds,
        25,
        driveNumber,
        `${save.meta.worldSeed}:${match.gameId}:bench:${driveNumber}`,
      );
      started = {
        ...started,
        heroScore: started.heroScore + background.heroScoreDelta,
        opponentScore: started.opponentScore + background.opponentScoreDelta,
        gameClockSeconds: background.gameClockSeconds,
        drives: [...started.drives, background.summary],
      };
      side = otherSide(side);
      driveNumber += 1;
    }
    started = startControlledDrive(started, Math.min(started.gameClockSeconds, targetClock), random.integer(20, 34), driveNumber);
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

function resolveOneMatchDecision(save: CareerSave, optionId: string): CareerSave {
  const match = save.football.match;
  const episode = match.currentEpisode;
  if (match.status !== "in-progress" || !episode) throw new Error("Match has no active episode");
  const liveOutcome = decodeLivePlayOutcome(optionId);
  const selected = liveOutcome
    ? episode.options.find((item) => item.risk === "balanced") ?? episode.options[0]
    : episode.options.find((item) => item.id === optionId);
  if (!selected) throw new Error("Unknown match decision");

  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:${episode.id}:${optionId}`);
  const assignmentScore = liveOutcome
    ? clamp(liveOutcome.assignmentScore)
    : clamp(decisionScoreCenter(save, match, selected) + random.integer(-16, 16));
  const preliminaryGrade = gradeFromScore(assignmentScore);
  const simulation: SnapSimulation = liveOutcome
    ? {
        snapResult: liveOutcome.snapResult,
        yards: liveOutcome.yards,
        points: liveOutcome.points,
        ...(liveOutcome.scoringSide ? { scoringSide: liveOutcome.scoringSide } : {}),
        turnover: liveOutcome.turnover,
        firstDown: liveOutcome.yards >= episode.distance,
        repeatDown: false,
        ...(liveOutcome.targetSlot ? { targetSlot: liveOutcome.targetSlot } : {}),
        ...(liveOutcome.ballCarrierSlot ? { ballCarrierSlot: liveOutcome.ballCarrierSlot } : {}),
        teamExecutionScore: liveOutcome.teamExecutionScore,
        description: liveOutcome.description,
        pressureOccurred: liveOutcome.pressureOccurred,
        ...(liveOutcome.grossPuntYards !== undefined ? { grossPuntYards: liveOutcome.grossPuntYards } : {}),
        ...(liveOutcome.puntReturnYards !== undefined ? { puntReturnYards: liveOutcome.puntReturnYards } : {}),
        ...(liveOutcome.kickDistance !== undefined ? { kickDistance: liveOutcome.kickDistance } : {}),
      }
    : simulateSnap(save, match, episode, assignmentScore, selected, random);
  const statResolution = liveOutcome
    ? { stats: liveOutcome.statDelta, advanced: liveOutcome.advancedDelta, involved: liveOutcome.heroInvolved }
    : makeStatDelta(save, episode, simulation, preliminaryGrade, random);
  const evaluation = evaluateSnapPerformance({
    position: save.football.position,
    episode,
    assignmentScore,
    teamExecutionScore: simulation.teamExecutionScore,
    snapResult: simulation.snapResult,
    yards: simulation.yards,
    involved: statResolution.involved,
    pressureOccurred: Boolean(simulation.pressureOccurred),
    statDelta: statResolution.stats,
    advancedDelta: statResolution.advanced,
    liveSignals: liveOutcome?.evaluationSignals,
  });
  const grade = evaluation.grade;
  const coachDelta = round((evaluation.score - 68) * .055, 1);
  const confidenceDelta = round((evaluation.score - 68) * .028, 1);
  const fatigueDelta = round(1 + selected.difficulty * .013 + (selected.risk === "aggressive" ? .65 : 0), 1);
  const snapTime = liveOutcome
    ? clampInteger(liveOutcome.elapsedSeconds + (simulation.snapResult === "incomplete" ? 8 : 24), 8, 42)
    : simulation.snapResult === "incomplete" || simulation.snapResult === "penalty"
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
    optionId: liveOutcome?.actionId ?? optionId,
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
    startFieldPosition: episode.fieldPosition,
    endFieldPosition: advance.nextFieldPosition,
    pressureOccurred: Boolean(simulation.pressureOccurred),
    grossPuntYards: simulation.grossPuntYards,
    puntReturnYards: simulation.puntReturnYards,
    kickDistance: simulation.kickDistance,
    targetSlot: simulation.targetSlot,
    ballCarrierSlot: simulation.ballCarrierSlot,
    statDelta: statResolution.stats,
    advancedDelta: statResolution.advanced,
    evaluation,
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
  let nextPossessionStartFieldPosition: number | undefined;
  if (episode.unit === "special") {
    nextPossessionStartFieldPosition = simulation.snapResult === "punt"
      ? clampInteger(100 - nextFieldPosition, 5, 80)
      : simulation.snapResult === "missed-field-goal"
        ? clampInteger(100 - episode.fieldPosition, 20, 75)
        : 25;
  }

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
      const punter = specialistForSide(save, episode.possession, "P");
      const netYards = Math.min(99 - nextFieldPosition, puntNetYards(punter, random));
      nextPossessionStartFieldPosition = clampInteger(100 - (nextFieldPosition + netYards), 8, 45);
      driveDescription = `${punter.name} выполняет пант на ${netYards} ярдов.`;
      gameClockSeconds = Math.max(0, gameClockSeconds - random.integer(8, 16));
    } else if (special === "field-goal") {
      driveEnded = true;
      const kickDistance = 117 - nextFieldPosition;
      const offenseRatings = ratingsForSide(save, episode.possession);
      const kicker = specialistForSide(save, episode.possession, "K");
      const made = random.chance(fieldGoalChance(kicker, kickDistance, offenseRatings.coaching));
      driveOutcome = made ? "field-goal" : "missed-field-goal";
      drivePoints = made ? 3 : 0;
      driveDescription = made
        ? `${kicker.name} реализует филд-гол с ${kickDistance} ярдов.`
        : `${kicker.name} не реализует филд-гол с ${kickDistance} ярдов.`;
      nextPossessionStartFieldPosition = made ? 25 : clampInteger(100 - nextFieldPosition, 20, 75);
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

  const offenseCallForMemory = match.heroUnit === "offense" ? episode.playCall : episode.opponentCall;
  const tacticalCall: MatchTacticalCall = {
    id: offenseCallForMemory.id,
    concept: offenseCallForMemory.concept,
    playType: offenseCallForMemory.playType,
    tags: [...offenseCallForMemory.tags],
    yards: outcome.yards,
    success: outcome.firstDown || outcome.points > 0 || outcome.yards >= Math.max(4, episode.distance),
  };
  const offenseMemoryKey = episode.possession === "hero" ? "heroOffense" : "opponentOffense";
  const tacticalMemory = {
    ...match.tacticalMemory,
    [offenseMemoryKey]: [...match.tacticalMemory[offenseMemoryKey], tacticalCall].slice(-16),
  };

  let nextMatch: FootballMatchState = {
    ...match,
    heroScore,
    opponentScore,
    quarter: clockParts(gameClockSeconds).quarter,
    clockSeconds: clockParts(gameClockSeconds).clockSeconds,
    gameClockSeconds,
    playClockSeconds: 25,
    heroFatigue: clamp(match.heroFatigue + fatigueDelta),
    coachGrade: round((match.completedEpisodes.reduce((sum, item) => sum + (item.evaluation?.score ?? item.assignmentScore), 0) + evaluation.score) / (match.completedEpisodes.length + 1), 1),
    episodeIndex: match.episodeIndex + 1,
    driveDown: nextDown,
    driveDistance: nextDistance,
    driveFieldPosition: nextFieldPosition,
    drivePlays,
    driveYards,
    tacticalMemory,
    completedEpisodes: [...match.completedEpisodes, { ...outcome, driveEnded }],
    lastResolvedEpisode: episode,
    lastResolvedResult: { ...outcome, driveEnded },
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
      const backgroundStart = nextPossessionStartFieldPosition
        ?? (driveOutcome === "turnover" || driveOutcome === "turnover-on-downs" || driveOutcome === "missed-field-goal"
          ? clampInteger(100 - nextFieldPosition, 20, 75)
          : 25);
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
    } else if (save.meta.phase === "professional-career") {
      nextFootball = { ...save.football, match: nextMatch };
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

function automaticDecisionId(save: CareerSave): string {
  const match = save.football.match;
  const episode = match.currentEpisode;
  if (!episode) throw new Error("Match has no active episode");
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:${episode.id}:auto-choice`);
  return [...episode.options]
    .map((optionValue) => {
      const forecast = calculateDecisionForecast(save, match, episode, optionValue);
      const personalityRisk = save.character.personality.riskTolerance;
      const riskFit = optionValue.risk === "aggressive"
        ? (personalityRisk - 50) * .08
        : optionValue.risk === "safe"
          ? (50 - personalityRisk) * .05
          : 2;
      const value = forecast.executionChance * .48
        + forecast.playImpact * .28
        + forecast.bigPlayChance * .12
        - forecast.mistakeChance * .36
        + riskFit
        + random.integer(-3, 3);
      return { id: optionValue.id, value };
    })
    .sort((left, right) => right.value - left.value)[0]!.id;
}

function isKeyMoment(match: FootballMatchState, episode: MatchEpisode): boolean {
  if (episode.unit === "special") return true;
  if (episode.down >= 3) return true;
  if (episode.fieldPosition >= 85 || episode.fieldPosition <= 5) return true;
  if (episode.quarter === 4 && episode.clockSeconds <= 300 && Math.abs(match.heroScore - match.opponentScore) <= 10) return true;

  const highRiskCall = episode.down >= 2 && Math.max(episode.playCall.aggression, episode.opponentCall.aggression) >= 90;
  const longYardage = episode.down >= 2 && episode.distance >= 8;
  const blitzRead = episode.playCall.playType === "blitz" || episode.opponentCall.playType === "blitz";
  const directPressureMoment = episode.heroInvolvement === "primary" && blitzRead && episode.down >= 2;
  const decisivePrimaryRole = episode.heroInvolvement === "primary" && (highRiskCall || longYardage);

  return directPressureMoment || decisivePrimaryRole;
}

function advanceAutomatic(save: CareerSave, stopAtKeyMoment: boolean): CareerSave {
  let current = save;
  let safety = 0;
  while (current.football.match.status === "in-progress" && current.football.match.currentEpisode && safety < 180) {
    if (stopAtKeyMoment && isKeyMoment(current.football.match, current.football.match.currentEpisode)) break;
    current = resolveOneMatchDecision(current, automaticDecisionId(current));
    safety += 1;
  }
  return current;
}

export function startMatch(
  save: CareerSave,
  participationMode: MatchParticipationMode = "key-moments",
  analysisMode = false,
): CareerSave {
  let started = startMatchCore(save, participationMode, analysisMode);
  if (participationMode === "auto") started = advanceAutomatic(started, false);
  if (participationMode === "key-moments") {
    started = advanceAutomatic(started, true);
    if (started.football.match.status === "in-progress") {
      started = {
        ...started,
        football: {
          ...started.football,
          match: { ...started.football.match, lastResolvedEpisode: undefined, lastResolvedResult: undefined },
        },
      };
    }
  }
  return started;
}

export function resolveMatchDecision(save: CareerSave, optionId: string): CareerSave {
  const resolved = resolveOneMatchDecision(save, optionId);
  const playbackEpisode = resolved.football.match.lastResolvedEpisode;
  const playbackResult = resolved.football.match.lastResolvedResult;
  if (resolved.football.match.status !== "in-progress" || resolved.football.match.participationMode === "every-snap") return resolved;
  const advanced = advanceAutomatic(resolved, resolved.football.match.participationMode === "key-moments");
  if (!playbackEpisode || !playbackResult) return advanced;
  return {
    ...advanced,
    football: {
      ...advanced.football,
      match: { ...advanced.football.match, lastResolvedEpisode: playbackEpisode, lastResolvedResult: playbackResult },
    },
  };
}

