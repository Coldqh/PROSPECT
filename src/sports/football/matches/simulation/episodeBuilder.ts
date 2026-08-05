import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import type { FootballPosition } from "../../career/types";
import { FOOTBALL_ROSTER_POSITIONS } from "../../team/positions";
import type { FootballRosterPosition } from "../../team/types";
import { buildSnapAssignments, buildSpecialTeamsAssignments, callPlay, describeHeroAssignment } from "../playbook";
import { heroParticipationForSnap } from "../participation";
import { receiverPriorityMap } from "../usage";
import type {
  FootballMatchState,
  MatchDecisionOption,
  MatchEpisode,
  MatchPlayerAssignment,
  MatchTeamSide,
} from "../types";
import { controlledOffense, otherSide } from "./matchMath";
import { canHeroCheck, heroTeamId, tacticalProfileForSide } from "./matchupContext";

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

function specialPlayCall(position: "K" | "P", canCheck: boolean): MatchEpisode["playCall"] {
  return position === "K"
    ? { id: "special-field-goal", formation: "Field Goal", personnel: "FG", concept: "Field Goal", playType: "field-goal", strength: "middle", calledBy: "head-coach", canCheck, aggression: 48, progression: [], tags: ["special-teams", "scoring"] }
    : { id: "special-punt", formation: "Punt", personnel: "Punt", concept: "Directional Punt", playType: "punt", strength: "right", calledBy: "head-coach", canCheck, aggression: 38, progression: [], tags: ["special-teams", "field-position"] };
}

function generateSpecialEpisode(save: CareerSave, match: FootballMatchState, index: number): MatchEpisode {
  const position = save.football.position as "K" | "P";
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:special:${index}`);
  const fieldPosition = match.driveFieldPosition;
  const distance = position === "K" ? 117 - fieldPosition : match.driveDistance;
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
  const participation = heroParticipationForSnap(save, match, playCall, opponentCall, true, index);
  const assignments = bindRosterToAssignments(save, match, buildSpecialTeamsAssignments(
    position,
    "hero",
    `${save.meta.worldSeed}:${match.gameId}:special-assignments:${index}`,
    participation.active,
  ));
  const hero = assignments.find((assignment) => assignment.isHero) ?? assignments[0]!;
  const role = position === "K" ? `FG ${distance}` : "PUNT";
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
    heroActive: participation.active,
    heroRole: role,
    heroSlot: hero.slot,
    assignments,
    options: assignmentOptions(position, hero, "primary"),
  };
}

export function generateEpisode(save: CareerSave, match: FootballMatchState, index: number): MatchEpisode {
  if (match.heroUnit === "special") return generateSpecialEpisode(save, match, index);
  const offenseSide = controlledOffense(match);
  const scoreMargin = offenseSide === "hero"
    ? match.heroScore - match.opponentScore
    : match.opponentScore - match.heroScore;
  const offenseCanCheck = match.heroUnit === "offense" && canHeroCheck(save);
  const defenseCanCheck = match.heroUnit === "defense" && canHeroCheck(save);
  const heroOffenseGameplan = offenseSide === "hero" && match.heroUnit === "offense" ? match.usagePlan : undefined;
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
      featuredRole: heroOffenseGameplan?.role,
      featuredPriority: heroOffenseGameplan?.targetPriority ?? heroOffenseGameplan?.touchPriority,
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
  const assignmentSeed = `${save.meta.worldSeed}:${match.gameId}:assignments:${index}`;
  const naturalAssignments = buildSnapAssignments(
    offenseCall,
    defenseCall,
    offenseSide,
    match.heroUnit,
    save.football.position,
    assignmentSeed,
    false,
  );
  const naturalPackageFit = naturalAssignments.some((assignment) =>
    assignment.side === "hero"
      && assignment.unit === match.heroUnit
      && assignment.position === save.football.position,
  );
  const participation = heroParticipationForSnap(
    save,
    match,
    offenseCall,
    defenseCall,
    naturalPackageFit,
    index,
  );
  const assignments = bindRosterToAssignments(save, match, buildSnapAssignments(
    offenseCall,
    defenseCall,
    offenseSide,
    match.heroUnit,
    save.football.position,
    assignmentSeed,
    participation.active,
  ));
  const heroAssignment = describeHeroAssignment(save.football.position, match.heroUnit, assignments, offenseCall, defenseCall);
  const hero = assignments.find((assignment) => assignment.isHero);
  const receiverPriorities = receiverPriorityMap(
    match.usagePlan,
    match.usageStats,
    offenseCall,
    heroAssignment.heroSlot,
    save.football.position,
    match.driveFieldPosition,
  );
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
    heroActive: participation.active,
    heroRole: heroAssignment.role,
    heroSlot: heroAssignment.heroSlot,
    receiverPriorities,
    heroUsageRole: match.usagePlan.role,
    assignments,
    options: assignmentOptions(save.football.position, hero ?? assignments[0]!, heroAssignment.involvement),
  };
}
