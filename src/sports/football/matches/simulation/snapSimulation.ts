import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import type {
  FootballMatchState,
  MatchDecisionOption,
  MatchEpisode,
  MatchPlayerAssignment,
} from "../types";
import type { SnapSimulation } from "./internalTypes";
import { clamp, clampInteger, otherSide } from "./matchMath";
import { ratingsForSide } from "./matchupContext";

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

function chooseTarget(
  call: MatchEpisode["playCall"],
  random: SeededRandom,
  pressured: boolean,
  priorities: Record<string, number> = {},
  featuredOpenSlot?: string,
): string | undefined {
  const progression = call.progression;
  if (progression.length === 0) return call.primarySlot;
  if (progression.length === 1) return progression[0];
  const weights = progression.map((slot, index) => {
    const progressionWeight = pressured ? Math.max(.08, .62 - index * .17) : Math.max(.1, .44 - index * .09);
    const priority = Math.max(20, Math.min(100, priorities[slot] ?? (index === 0 ? 74 : 58)));
    const openWindowMultiplier = slot === featuredOpenSlot ? 5.4 : 1;
    return progressionWeight * Math.pow(priority / 60, 1.7) * openWindowMultiplier;
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

export function simulateSnap(
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
  const heroRouteSnap = passLike
    && match.heroUnit === "offense"
    && ["WR", "TE", "RB"].includes(save.football.position)
    && episode.assignments.some((assignment) => assignment.isHero && assignment.kind === "route");
  const heroPriority = episode.receiverPriorities?.[episode.heroSlot] ?? 0;
  const featuredConcept = episode.playCall.primarySlot === episode.heroSlot
    || (episode.heroUsageRole === "deep-threat" && (offenseCall.tags.includes("shot") || offenseCall.tags.includes("deep")))
    || (episode.heroUsageRole === "slot-option" && (offenseCall.tags.includes("quick") || offenseCall.tags.includes("man-beater")))
    || (episode.heroUsageRole === "red-zone-target" && episode.fieldPosition >= 78);
  const openChance = Math.max(.04, Math.min(.62,
    .025
      + Math.max(-12, assignmentScore - 60) * .0035
      + heroPriority * .0008
      + (episode.heroInvolvement === "primary" ? .03 : 0)
      + (featuredConcept ? .04 : 0)
      - match.usagePlan.shadowRisk * .00055
      - match.usagePlan.doubleTeamRisk * .00035,
  ));
  const heroOpenWindow = heroRouteSnap && random.chance(openChance);
  const heroSeparationYards = heroOpenWindow
    ? Math.max(2.2, Math.min(8.5, 2.5 + Math.max(0, assignmentScore - 58) * .045 + random.integer(0, 22) / 10))
    : 0;
  const targetPriorities = { ...(episode.receiverPriorities ?? {}) };
  if (heroOpenWindow) targetPriorities[episode.heroSlot] = Math.min(100, (targetPriorities[episode.heroSlot] ?? 60) + 34);
  const targetSlot = passLike
    ? chooseTarget(offenseCall, random, pressured, targetPriorities, heroOpenWindow ? episode.heroSlot : undefined)
    : undefined;
  const usageMetadata = { heroOpenWindow, heroSeparationYards };
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
      ...usageMetadata,
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
      return { snapResult: "turnover", yards, points: 0, turnover: true, firstDown: false, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: "Мяч выбит в контакте. Защита забирает владение.", ...usageMetadata };
    }
    if (episode.fieldPosition + yards >= 100) {
      return { snapResult: "touchdown", yards: 100 - episode.fieldPosition, points: 7, scoringSide: offenseSide, turnover: false, firstDown: true, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: "Вынос проходит до зачётной зоны.", ...usageMetadata };
    }
    return { snapResult: "run", yards, points: 0, turnover: false, firstDown: yards >= episode.distance, repeatDown: false, ballCarrierSlot, teamExecutionScore, description: yards < 0 ? "Фронт защиты выигрывает точку атаки." : `Вынос приносит ${yards} ярдов.`, ...usageMetadata };
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
      ...usageMetadata,
    };
  }

  const sackChance = pressured ? Math.max(.08, Math.min(.48, .22 - teamEdge * .008)) : Math.max(.01, .06 - teamEdge * .003);
  if (random.chance(sackChance)) {
    const yards = -random.integer(4, 10);
    return { snapResult: "sack", yards, points: 0, turnover: false, firstDown: false, repeatDown: false, targetSlot, teamExecutionScore, description: `Карман закрывается. Потеря ${Math.abs(yards)} ярдов.`, pressureOccurred: true, ...usageMetadata };
  }

  const depthPenalty = offenseCall.aggression >= 75 ? .12 : offenseCall.aggression >= 60 ? .06 : 0;
  const completionChance = Math.max(.24, Math.min(.86, .59 + teamEdge * .011 - depthPenalty + (offenseCall.playType === "screen" ? .16 : 0) - (pressured ? .14 : 0)));
  if (!random.chance(completionChance)) {
    return { snapResult: "incomplete", yards: 0, points: 0, turnover: false, firstDown: false, repeatDown: false, targetSlot, teamExecutionScore, description: pressured ? "Давление ломает тайминг, пас не завершён." : "Окно закрывается до прибытия мяча.", pressureOccurred: pressured, ...usageMetadata };
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
    return { snapResult: "touchdown", yards: 100 - episode.fieldPosition, points: 7, scoringSide: offenseSide, turnover: false, firstDown: true, repeatDown: false, targetSlot, teamExecutionScore, description: "Передача завершается в зачётной зоне.", pressureOccurred: pressured, ...usageMetadata };
  }
  return { snapResult: "completion", yards, points: 0, turnover: false, firstDown: yards >= episode.distance, repeatDown: false, targetSlot, teamExecutionScore, description: `Пас завершён на ${yards} ярдов.`, pressureOccurred: pressured, ...usageMetadata };
}
