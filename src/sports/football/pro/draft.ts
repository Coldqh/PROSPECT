import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballPosition } from "../career/types";
import type {
  FootballProfessionalState,
  ProfessionalAgent,
  ProfessionalCampApproach,
  ProfessionalCampInvite,
  ProfessionalDraftSelection,
  ProfessionalDraftSlot,
  ProfessionalEvaluationFocus,
  ProfessionalEvaluationResult,
  ProfessionalProspect,
  ProfessionalRookieContract,
  ProfessionalTeam,
  ProfessionalTrainingCamp,
} from "./types";

const FIRST_NAMES = ["Andre", "Caleb", "Micah", "Jordan", "Terrence", "Isaiah", "Roman", "Jalen", "Noah", "Damon", "Xavier", "Elijah"] as const;
const LAST_NAMES = ["Mercer", "Banks", "Holloway", "Bennett", "Cross", "Booker", "Hampton", "Maddox", "Jefferson", "Sutton", "Vaughn", "Mills"] as const;
const COLLEGES = ["Redwood State", "Lake Erie", "Central Plains", "Atlantic Tech", "Gulf Coast", "Capital University", "Mountain State", "Pacific Union"] as const;
const POSITIONS: FootballPosition[] = ["QB", "RB", "WR", "LB", "CB"];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function ageOnDate(birthDate: string, date: CareerSave["meta"]["currentDate"]): number {
  const [year = date.year - 18, month = 1, day = 1] = birthDate.split("-").map(Number);
  const birthdayPassed = date.month > month || (date.month === month && date.day >= day);
  return Math.max(18, date.year - year - (birthdayPassed ? 0 : 1));
}

function gradeLetter(value: number): "A" | "B" | "C" | "D" {
  return value >= 84 ? "A" : value >= 72 ? "B" : value >= 60 ? "C" : "D";
}

function projectedRound(stock: number): number | null {
  if (stock >= 91) return 1;
  if (stock >= 84) return 2;
  if (stock >= 78) return 3;
  if (stock >= 72) return 4;
  if (stock >= 66) return 5;
  if (stock >= 60) return 6;
  if (stock >= 55) return 7;
  return null;
}

function projectedRange(stock: number): string {
  const round = projectedRound(stock);
  if (round === 1) return stock >= 96 ? "Топ-10" : "1-й раунд";
  if (round) return `${round}-й раунд`;
  return stock >= 48 ? "Граница драфта" : "Приглашение свободного агента";
}

function productionScore(save: CareerSave): number {
  const career = save.football.college.heroCareer;
  if (!career) return 35;
  const games = Math.max(1, career.careerGames + career.gamesPlayed);
  const starts = career.careerStarts + career.starts;
  const snaps = career.careerSnaps + career.seasonSnaps;
  const recentStats = career.gameLog.reduce((sum, game) => sum + (game.stats
    ? game.stats.touchdowns * 7 + game.stats.passingYards * 0.025 + game.stats.rushingYards * 0.055
      + game.stats.receivingYards * 0.055 + game.stats.tackles * 0.75 + game.stats.sacks * 3.2
      + game.stats.interceptions * 4.2 - game.stats.turnovers * 4
    : 0), 0);
  const awardBoost = career.seasonHistory.reduce((sum, season) => sum + season.awards.length * 2.2, 0);
  return clamp(36 + Math.min(23, games * 1.1) + Math.min(14, starts * 0.75) + Math.min(11, snaps / 130)
    + Math.min(12, recentStats / Math.max(2, games)) + awardBoost);
}

function heroDraftStock(save: CareerSave): number {
  const career = save.football.college.heroCareer;
  const team = save.world.teams.find((item) => item.id === career?.teamId);
  const tactical = save.world.players.find((player) => player.isHero)?.tactical;
  const health = save.character.condition.health;
  const ratings = save.football.ratings;
  const age = ageOnDate(save.character.identity.birthDate, save.meta.currentDate);
  const ageModifier = age <= 21 ? 4 : age === 22 ? 1 : age >= 24 ? -7 : -2;
  return clamp(
    ratings.overall * 0.38
    + ratings.athleticism * 0.16
    + ratings.technique * 0.13
    + ratings.footballIq * 0.1
    + productionScore(save) * 0.16
    + (tactical?.schemeFit ?? 60) * 0.04
    + (team?.prestige ?? 60) * 0.03
    + (health - 70) * 0.08
    + ageModifier,
  );
}

function refreshProfessionalTeams(teams: ProfessionalTeam[], draftYear: number, seed: string): ProfessionalTeam[] {
  const positions: FootballPosition[] = ["QB", "RB", "WR", "LB", "CB"];
  return teams.map((team) => {
    const random = new SeededRandom(seed).fork(`pro-season:${draftYear}:${team.id}`);
    const rosterStrength = clamp(team.rosterStrength + random.integer(-6, 6));
    const wins = Math.max(2, Math.min(15, Math.round((rosterStrength - 56) / 3 + random.integer(-2, 2))));
    const needs = Object.fromEntries(positions.map((position) => {
      const inherited = team.needs[position] * 0.52;
      const annualPressure = random.fork(`need:${position}`).integer(28, 96) * 0.48;
      return [position, clamp(inherited + annualPressure + (rosterStrength < 70 ? 5 : 0))];
    })) as Record<FootballPosition, number>;
    return {
      ...team,
      rosterStrength,
      wins,
      losses: 17 - wins,
      capSpace: Math.max(8, Math.round(team.capSpace * 0.55 + random.integer(14, 82) * 0.45)),
      needs,
    };
  });
}

function createDraftOrder(teams: ProfessionalTeam[], year: number, seed: string): ProfessionalDraftSlot[] {
  const random = new SeededRandom(seed).fork(`pro-draft-order:${year}`);
  const base = [...teams].sort((left, right) => left.wins - right.wins || left.rosterStrength - right.rosterStrength || left.id.localeCompare(right.id));
  const slots: ProfessionalDraftSlot[] = [];
  for (let roundIndex = 1; roundIndex <= 7; roundIndex += 1) {
    base.forEach((team, index) => {
      let owner = team;
      let traded = false;
      if (random.fork(`${roundIndex}:${team.id}`).chance(roundIndex <= 3 ? 0.16 : 0.08)) {
        const candidates = teams.filter((candidate) => candidate.id !== team.id);
        owner = random.fork(`trade:${roundIndex}:${team.id}`).pick(candidates);
        traded = true;
      }
      slots.push({
        id: `${year}:round-${roundIndex}:pick-${index + 1}`,
        round: roundIndex,
        pickInRound: index + 1,
        overallPick: (roundIndex - 1) * base.length + index + 1,
        originalTeamId: team.id,
        currentTeamId: owner.id,
        traded,
      });
    });
  }
  return slots;
}

function npcProspectFromWorld(save: CareerSave, index: number): ProfessionalProspect | undefined {
  const candidates = save.world.players
    .filter((player) => !player.isHero && player.level === "college" && (player.classYear === "Senior" || player.eligibilityYears <= 1 || player.age >= 22))
    .sort((left, right) => right.overall - left.overall || right.potential - left.potential);
  const player = candidates[index];
  if (!player) return undefined;
  const team = save.world.teams.find((item) => item.id === player.teamId);
  const production = clamp(player.overall * 0.55 + player.form * 0.25 + (player.status === "starter" ? 14 : player.status === "rotation" ? 7 : 0));
  const athletic = clamp(player.overall * 0.65 + player.potential * 0.2 + player.form * 0.15);
  const medical = clamp(player.health * 0.88 + 10);
  const interview = clamp(player.tactical.learning * 0.42 + player.tactical.schemeFit * 0.28 + 25);
  const grade = clamp(player.overall * 0.36 + player.potential * 0.21 + production * 0.2 + athletic * 0.12 + medical * 0.06 + interview * 0.05);
  return {
    id: `prospect:${player.id}`,
    name: player.name,
    position: player.position,
    collegeName: team?.shortName ?? "College",
    age: player.age,
    overall: player.overall,
    potential: player.potential,
    production,
    athleticScore: athletic,
    medicalScore: medical,
    interviewScore: interview,
    draftGrade: grade,
    projectedRound: projectedRound(grade),
    isHero: false,
  };
}

function generatedProspect(save: CareerSave, index: number): ProfessionalProspect {
  const random = new SeededRandom(save.meta.worldSeed).fork(`generated-pro-prospect:${save.world.seasonYear}:${index}`);
  const position = random.pick(POSITIONS);
  const overall = random.integer(58, 88);
  const potential = clamp(overall + random.integer(3, 15));
  const production = random.integer(49, 94);
  const athleticScore = random.integer(53, 96);
  const medicalScore = random.integer(58, 98);
  const interviewScore = random.integer(48, 94);
  const draftGrade = clamp(overall * 0.33 + potential * 0.2 + production * 0.19 + athleticScore * 0.14 + medicalScore * 0.07 + interviewScore * 0.07);
  return {
    id: `generated-prospect:${save.world.seasonYear}:${index}`,
    name: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
    position,
    collegeName: random.pick(COLLEGES),
    age: random.integer(21, 24),
    overall,
    potential,
    production,
    athleticScore,
    medicalScore,
    interviewScore,
    draftGrade,
    projectedRound: projectedRound(draftGrade),
    isHero: false,
  };
}

function heroProspect(save: CareerSave, stock: number): ProfessionalProspect {
  const career = save.football.college.heroCareer;
  return {
    id: "hero",
    name: save.character.identity.fullName,
    position: save.football.position,
    collegeName: save.football.college.program?.shortName ?? "College",
    age: Math.min(25, ageOnDate(save.character.identity.birthDate, save.meta.currentDate)),
    overall: save.football.ratings.overall,
    potential: save.football.ratings.potentialBand === "national-ceiling" ? 96 : save.football.ratings.potentialBand === "high-upside" ? 90 : save.football.ratings.potentialBand === "starter" ? 83 : 75,
    production: productionScore(save),
    athleticScore: save.football.ratings.athleticism,
    medicalScore: save.character.condition.health,
    interviewScore: clamp(save.character.personality.composure * 0.34 + save.character.personality.coachability * 0.36 + save.football.ratings.footballIq * 0.3),
    draftGrade: stock,
    projectedRound: projectedRound(stock),
    isHero: true,
  };
}

function buildDraftClass(save: CareerSave, stock: number): ProfessionalProspect[] {
  const prospects: ProfessionalProspect[] = [];
  for (let index = 0; index < 70; index += 1) {
    const fromWorld = npcProspectFromWorld(save, index);
    prospects.push(fromWorld ?? generatedProspect(save, index));
  }
  for (let index = prospects.length; index < 135; index += 1) prospects.push(generatedProspect(save, index));
  prospects.push(heroProspect(save, stock));
  return prospects.sort((left, right) => right.draftGrade - left.draftGrade || left.id.localeCompare(right.id));
}

function updateHeroProspect(state: FootballProfessionalState, updater: (hero: ProfessionalProspect) => ProfessionalProspect): FootballProfessionalState {
  return { ...state, prospects: state.prospects.map((prospect) => prospect.isHero ? updater(prospect) : prospect) };
}

function selectedAgent(state: FootballProfessionalState): ProfessionalAgent | undefined {
  return state.agents.find((agent) => agent.id === state.selectedAgentId);
}

function evaluationResult(save: CareerSave, focus: ProfessionalEvaluationFocus): ProfessionalEvaluationResult {
  const state = save.football.professional;
  const agent = selectedAgent(state);
  if (!agent) throw new Error("An agent must be selected before evaluation");
  const random = new SeededRandom(save.meta.worldSeed).fork(`pro-evaluation:${state.draftYear}:${focus}:${agent.id}`);
  const physical = save.character.physical;
  const ratings = save.football.ratings;
  const focusAthletic = focus === "athletic" ? 7 : 0;
  const focusTechnical = focus === "technical" ? 8 : 0;
  const focusInterview = focus === "interview" ? 9 : 0;
  const speedIndex = clamp(physical.speed * 0.55 + physical.explosiveness * 0.27 + physical.agility * 0.18 + focusAthletic + random.integer(-5, 5));
  const fortyYard = round(5.18 - speedIndex * 0.0086, 2);
  const shuttle = round(4.92 - clamp(physical.agility * 0.66 + physical.speed * 0.22 + focusAthletic + random.integer(-4, 4)) * 0.0078, 2);
  const vertical = round(20 + clamp(physical.explosiveness * 0.7 + physical.strength * 0.16 + focusAthletic + random.integer(-5, 5)) * 0.23, 1);
  const benchReps = Math.max(4, Math.round(physical.strength * 0.27 + (save.football.position === "LB" || save.football.position === "RB" ? 4 : 0) + random.integer(-3, 3)));
  const positionDrill = clamp(ratings.technique * 0.46 + ratings.footballIq * 0.25 + ratings.competitiveness * 0.12 + focusTechnical + random.integer(3, 13));
  const medical = clamp(save.character.condition.health * 0.78 + save.character.physical.stamina * 0.14 + random.integer(-4, 6));
  const interview = clamp(save.character.personality.composure * 0.3 + save.character.personality.coachability * 0.27 + ratings.footballIq * 0.24 + agent.mediaReach * 0.06 + focusInterview + random.integer(-4, 5));
  const athleticScore = clamp(speedIndex * 0.43 + vertical * 0.75 + benchReps * 0.8 + (100 - shuttle * 15) * 0.15);
  const overallScore = clamp(athleticScore * 0.36 + positionDrill * 0.31 + medical * 0.15 + interview * 0.18);
  const stockDelta = round((overallScore - state.draftStock) * 0.22 + agent.teamAccess * 0.025 + agent.reputation * 0.018 - agent.risk * 0.018, 1);
  return {
    completedOn: save.meta.currentDate,
    focus,
    fortyYard,
    shuttle,
    vertical,
    benchReps,
    positionDrill,
    medical,
    interview,
    overallScore,
    stockDelta,
    summary: overallScore >= 84
      ? "Тесты подтвердили профессиональный атлетизм и сняли большую часть вопросов клубов."
      : overallScore >= 70
        ? "Оценка прошла ровно: сильные упражнения компенсировали отдельные ограничения."
        : "Клубы получили дополнительные вопросы к готовности и медицинскому профилю.",
  };
}

function rookieContract(selection: ProfessionalDraftSelection, team: ProfessionalTeam, agent: ProfessionalAgent): ProfessionalRookieContract {
  const pickScale = Math.max(0, 113 - selection.overallPick);
  const totalValue = Math.round((1_600_000 + pickScale * 92_000 + (selection.round === 1 ? 5_500_000 : 0)) / 10_000) * 10_000;
  const baseGuaranteedRatio = selection.round === 1 ? 0.82 : selection.round <= 3 ? 0.48 : selection.round <= 5 ? 0.24 : 0.12;
  const guaranteedRatio = Math.min(0.9, baseGuaranteedRatio + Math.max(-0.025, (agent.negotiation - 75) * 0.0012));
  const guaranteed = Math.round(totalValue * guaranteedRatio / 10_000) * 10_000;
  const signingBonus = Math.round(guaranteed * 0.68 / 10_000) * 10_000;
  return {
    teamId: team.id,
    teamName: `${team.city} ${team.name}`,
    years: 4,
    totalValue,
    guaranteed,
    signingBonus,
    salaryYearOne: Math.round((totalValue - signingBonus) / 4 / 10_000) * 10_000,
    agentFee: Math.round(totalValue * agent.commission / 100 / 1_000) * 1_000,
    round: selection.round,
    overallPick: selection.overallPick,
  };
}

function campInviteFor(save: CareerSave, team: ProfessionalTeam, index: number): ProfessionalCampInvite {
  const state = save.football.professional;
  const random = new SeededRandom(save.meta.worldSeed).fork(`camp-invite:${state.draftYear}:${team.id}`);
  const need = team.needs[save.football.position];
  const schemeFit = clamp((save.world.players.find((player) => player.isHero)?.tactical.schemeFit ?? 62) * 0.65 + random.integer(20, 38));
  const competition = clamp(100 - need + team.rosterStrength * 0.25 + random.integer(-7, 7));
  const opportunity = clamp(need * 0.48 + schemeFit * 0.3 + (100 - competition) * 0.22);
  return {
    teamId: team.id,
    teamName: `${team.city} ${team.name}`,
    shortName: team.shortName,
    signingBonus: Math.max(5_000, Math.round((55_000 + opportunity * 1_100 - index * 4_000) / 5_000) * 5_000),
    rosterOpportunity: opportunity,
    positionCompetition: competition,
    schemeFit,
    summary: opportunity >= 72
      ? "Клуб видит реальный путь в активный состав через спецкоманды и ротацию."
      : opportunity >= 58
        ? "Место придётся выигрывать в плотной позиционной комнате."
        : "Приглашение даёт вход в лигу, но гарантии роли нет.",
  };
}

function campState(save: CareerSave, teamId: string): ProfessionalTrainingCamp {
  const state = save.football.professional;
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) throw new Error("Professional team does not exist");
  const need = team.needs[save.football.position];
  const selection = state.heroSelection?.teamId === teamId ? state.heroSelection : undefined;
  const draftInvestment = selection
    ? selection.round === 1 ? 24 : selection.round === 2 ? 17 : selection.round <= 4 ? 11 : 6
    : 0;
  const rosterRank = selection
    ? selection.round === 1 ? 1 : selection.round <= 3 ? 2 : 3
    : need >= 76 ? 2 : need >= 58 ? 3 : 4;
  return {
    teamId,
    day: 1,
    totalDays: 4,
    coachTrust: clamp(42 + need * 0.2 + state.draftStock * 0.18 + draftInvestment),
    rosterRank,
    playersAtPosition: need >= 72 ? 4 : 5,
    sessions: [],
  };
}

export function openProfessionalDraftProcess(save: CareerSave): CareerSave {
  const career = save.football.college.heroCareer;
  if (!career) throw new Error("College career is required before the professional draft");
  if (save.meta.phase !== "college-season") throw new Error("Professional decision is unavailable in the current phase");
  const eligibleToDeclare = career.status === "complete" || career.classYear === "Junior" || career.classYear === "Senior" || career.seasonHistory.length >= 2;
  if (!eligibleToDeclare) throw new Error("The player is not yet eligible to declare for the draft");
  const stock = heroDraftStock(save);
  const draftYear = Math.max(save.world.seasonYear + 1, save.meta.currentDate.year);
  const teams = refreshProfessionalTeams(save.football.professional.teams, draftYear, save.meta.worldSeed);
  const professional: FootballProfessionalState = {
    ...save.football.professional,
    status: "decision",
    draftYear,
    declared: false,
    draftStock: stock,
    projectedRound: projectedRound(stock),
    projectedRange: projectedRange(stock),
    teams,
    prospects: buildDraftClass(save, stock),
    draftOrder: createDraftOrder(teams, draftYear, save.meta.worldSeed),
    evaluation: undefined,
    draftResults: [],
    heroSelection: undefined,
    campInvites: [],
    contract: undefined,
    camp: undefined,
    lastSummary: `Предварительная оценка: ${Math.round(stock)}. Диапазон — ${projectedRange(stock)}.`,
  };
  return {
    ...save,
    meta: { ...save.meta, phase: "professional-draft" },
    football: { ...save.football, stage: "professional-draft", professional },
    history: [...save.history, {
      id: `${save.meta.worldSeed}:pro-decision:${draftYear}`,
      occurredAt: save.meta.updatedAt,
      type: "professional-decision-opened",
      title: "Профессиональная оценка открыта",
      description: `Клубы выставили предварительный диапазон ${projectedRange(stock)} перед драфтом ${draftYear}.`,
    }],
  };
}

export function resolveProfessionalDeclaration(save: CareerSave, optionId: "return-college" | "declare"): CareerSave {
  const state = save.football.professional;
  if (save.meta.phase !== "professional-draft" || state.status !== "decision") throw new Error("Draft declaration is not awaiting a decision");
  const career = save.football.college.heroCareer;
  if (!career) throw new Error("College career is missing");
  if (optionId === "return-college") {
    if (career.status === "complete" || career.eligibilityYears <= 0) throw new Error("College eligibility is exhausted");
    return {
      ...save,
      meta: { ...save.meta, phase: "college-season" },
      football: {
        ...save.football,
        stage: "college-season",
        professional: { ...state, status: "dormant", declared: false, lastSummary: "Игрок отозвал документы и вернулся в колледж." },
      },
      history: [...save.history, {
        id: `${save.meta.worldSeed}:pro-return:${state.draftYear}`,
        occurredAt: save.meta.updatedAt,
        type: "college-return",
        title: "Возвращение в колледж",
        description: "Игрок сохранил eligibility и решил провести ещё один университетский сезон.",
      }],
    };
  }
  return {
    ...save,
    football: {
      ...save.football,
      college: {
        ...save.football.college,
        heroCareer: { ...career, status: "complete", eligibilityYears: 0, pendingDecision: undefined },
      },
      professional: { ...state, status: "agent-selection", declared: true, lastSummary: "Декларация подана. Следующий шаг — выбрать представителя." },
    },
    world: {
      ...save.world,
      players: save.world.players.map((player) => player.isHero ? {
        ...player,
        eligibilityYears: 0,
        eligibility: { ...player.eligibility, athleticallyEligible: false },
      } : player),
    },
    history: [...save.history, {
      id: `${save.meta.worldSeed}:pro-declared:${state.draftYear}`,
      occurredAt: save.meta.updatedAt,
      type: "draft-declaration",
      title: "Игрок вышел на драфт",
      description: `Eligibility закрыта, имя добавлено в официальный пул драфта ${state.draftYear}.`,
    }],
  };
}

export function selectProfessionalAgent(save: CareerSave, agentId: string): CareerSave {
  const state = save.football.professional;
  if (state.status !== "agent-selection") throw new Error("Agent selection is not available");
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) throw new Error("Agent does not exist");
  const stockDelta = round(agent.reputation * 0.025 + agent.teamAccess * 0.035 + agent.mediaReach * 0.015 - agent.risk * 0.025, 1);
  const nextStock = clamp(state.draftStock + stockDelta);
  const professional = updateHeroProspect({
    ...state,
    status: "evaluation",
    selectedAgentId: agent.id,
    draftStock: nextStock,
    projectedRound: projectedRound(nextStock),
    projectedRange: projectedRange(nextStock),
    lastSummary: `${agent.name} подписан. Представитель начал интервью с клубами.`,
  }, (hero) => ({ ...hero, draftGrade: nextStock, projectedRound: projectedRound(nextStock) }));
  return { ...save, football: { ...save.football, professional } };
}

export function completeProfessionalEvaluation(save: CareerSave, focus: ProfessionalEvaluationFocus): CareerSave {
  const state = save.football.professional;
  if (state.status !== "evaluation") throw new Error("Professional evaluation is not available");
  const evaluation = evaluationResult(save, focus);
  const nextStock = clamp(state.draftStock + evaluation.stockDelta);
  const professional = updateHeroProspect({
    ...state,
    status: "draft-ready",
    evaluation,
    draftStock: nextStock,
    projectedRound: projectedRound(nextStock),
    projectedRange: projectedRange(nextStock),
    lastSummary: `${evaluation.summary} Новый диапазон — ${projectedRange(nextStock)}.`,
  }, (hero) => ({
    ...hero,
    athleticScore: clamp((hero.athleticScore + evaluation.overallScore) / 2),
    medicalScore: evaluation.medical,
    interviewScore: evaluation.interview,
    draftGrade: nextStock,
    projectedRound: projectedRound(nextStock),
  }));
  return { ...save, football: { ...save.football, professional } };
}

function chooseProspect(team: ProfessionalTeam, remaining: ProfessionalProspect[], slot: ProfessionalDraftSlot, seed: string): ProfessionalProspect {
  const random = new SeededRandom(seed).fork(`selection:${slot.id}:${team.id}`);
  const ranked = remaining.map((prospect) => ({
    prospect,
    score: prospect.draftGrade
      + team.needs[prospect.position] * 0.18
      + prospect.potential * 0.05
      + (slot.round >= 4 ? prospect.athleticScore * 0.035 : prospect.production * 0.035)
      + random.fork(prospect.id).integer(-4, 4),
  })).sort((left, right) => right.score - left.score || right.prospect.draftGrade - left.prospect.draftGrade);
  const selected = ranked[0]?.prospect;
  if (!selected) throw new Error("Draft class was exhausted");
  return selected;
}

export function runProfessionalDraft(save: CareerSave): CareerSave {
  const state = save.football.professional;
  if (state.status !== "draft-ready") throw new Error("The player is not ready for the draft");
  const remaining = [...state.prospects];
  const teams = state.teams.map((team) => ({ ...team, needs: { ...team.needs } }));
  const results: ProfessionalDraftSelection[] = [];
  for (const slot of state.draftOrder) {
    const team = teams.find((item) => item.id === slot.currentTeamId);
    if (!team) throw new Error("Draft slot references a missing team");
    const prospect = chooseProspect(team, remaining, slot, save.meta.worldSeed);
    remaining.splice(remaining.findIndex((item) => item.id === prospect.id), 1);
    const needReduction = slot.round === 1 ? 38 : slot.round === 2 ? 31 : slot.round === 3 ? 25 : slot.round <= 5 ? 18 : 12;
    team.needs = {
      ...team.needs,
      [prospect.position]: clamp(team.needs[prospect.position] - needReduction),
    };
    team.rosterStrength = clamp(team.rosterStrength + Math.max(0, prospect.overall - team.rosterStrength) * 0.025);
    results.push({
      id: `${slot.id}:${prospect.id}`,
      round: slot.round,
      pickInRound: slot.pickInRound,
      overallPick: slot.overallPick,
      teamId: team.id,
      prospectId: prospect.id,
      prospectName: prospect.name,
      position: prospect.position,
      collegeName: prospect.collegeName,
      grade: prospect.draftGrade,
      isHero: prospect.isHero,
    });
  }
  const heroSelection = results.find((result) => result.isHero);
  if (heroSelection) {
    const team = state.teams.find((item) => item.id === heroSelection.teamId);
    if (!team) throw new Error("Drafted team is missing");
    const agent = selectedAgent(state);
    if (!agent) throw new Error("Drafted player has no representative");
    const contract = rookieContract(heroSelection, team, agent);
    const invite = campInviteFor(save, team, 0);
    return {
      ...save,
      football: {
        ...save.football,
        professional: {
          ...state,
          status: "drafted",
          teams,
          draftResults: results,
          heroSelection,
          contract,
          campInvites: [invite],
          lastSummary: `${team.city} ${team.name} выбрали игрока под общим №${heroSelection.overallPick} в ${heroSelection.round}-м раунде.`,
        },
      },
      history: [...save.history, {
        id: `${save.meta.worldSeed}:drafted:${state.draftYear}:${heroSelection.overallPick}`,
        occurredAt: save.meta.updatedAt,
        type: "professional-draft-selection",
        title: `Выбор №${heroSelection.overallPick}`,
        description: `${team.city} ${team.name} выбрали ${save.character.identity.fullName} в ${heroSelection.round}-м раунде.`,
      }],
    };
  }
  const invites = [...teams]
    .sort((left, right) => right.needs[save.football.position] - left.needs[save.football.position] || left.rosterStrength - right.rosterStrength)
    .slice(0, 5)
    .map((team, index) => campInviteFor(save, team, index));
  return {
    ...save,
    football: {
      ...save.football,
      professional: {
        ...state,
        status: "undrafted",
        teams,
        draftResults: results,
        campInvites: invites,
        lastSummary: "Семь раундов завершились без выбора. Клубы начали звонить сразу после драфта.",
      },
    },
    history: [...save.history, {
      id: `${save.meta.worldSeed}:undrafted:${state.draftYear}`,
      occurredAt: save.meta.updatedAt,
      type: "professional-undrafted",
      title: "Драфт завершён без выбора",
      description: "Игрок вышел на рынок незадрафтованных свободных агентов и получил приглашения в лагеря.",
    }],
  };
}

export function acceptProfessionalCampInvite(save: CareerSave, teamId: string): CareerSave {
  const state = save.football.professional;
  if (state.status !== "drafted" && state.status !== "undrafted") throw new Error("Training camp is not awaiting a team");
  const invite = state.campInvites.find((item) => item.teamId === teamId);
  if (!invite) throw new Error("Camp invite does not exist");
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) throw new Error("Professional team does not exist");
  const agent = selectedAgent(state);
  if (!agent) throw new Error("Professional contract requires an agent");
  const contract = state.contract ?? {
    teamId,
    teamName: invite.teamName,
    years: 3,
    totalValue: 2_850_000,
    guaranteed: invite.signingBonus,
    signingBonus: invite.signingBonus,
    salaryYearOne: 795_000,
    agentFee: Math.round(2_850_000 * agent.commission / 100 / 1_000) * 1_000,
    round: null,
    overallPick: null,
  } satisfies ProfessionalRookieContract;
  return {
    ...save,
    football: {
      ...save.football,
      professional: {
        ...state,
        status: "training-camp",
        contract,
        camp: campState(save, teamId),
        lastSummary: `${team.city} ${team.name}: контракт подписан, начинается борьба за состав.`,
      },
    },
    history: [...save.history, {
      id: `${save.meta.worldSeed}:camp-signed:${state.draftYear}:${teamId}`,
      occurredAt: save.meta.updatedAt,
      type: "professional-contract-signed",
      title: `Контракт с ${team.shortName}`,
      description: `Игрок подписал rookie contract и прибыл в тренировочный лагерь ${team.city} ${team.name}.`,
    }],
  };
}

export function advanceProfessionalTrainingCamp(save: CareerSave, approach: ProfessionalCampApproach): CareerSave {
  const state = save.football.professional;
  const camp = state.camp;
  if (state.status !== "training-camp" || !camp) throw new Error("Professional training camp is not active");
  const team = state.teams.find((item) => item.id === camp.teamId);
  if (!team) throw new Error("Camp team is missing");
  const random = new SeededRandom(save.meta.worldSeed).fork(`pro-camp:${state.draftYear}:${camp.teamId}:${camp.day}:${approach}`);
  const approachPerformance = approach === "aggressive" ? 7 : approach === "balanced" ? 3 : 0;
  const approachRisk = approach === "aggressive" ? 9 : approach === "balanced" ? 4 : 1;
  const basePerformance = save.football.ratings.overall * 0.35 + save.football.ratings.athleticism * 0.18
    + save.football.ratings.technique * 0.22 + save.football.ratings.footballIq * 0.15
    + save.character.personality.coachability * 0.1;
  const fatiguePenalty = Math.max(0, save.character.condition.fatigue - 58) * 0.16;
  const healthDelta = random.chance(clamp((approachRisk + Math.max(0, 72 - save.character.condition.health) * 0.2) / 100, 0, 0.35))
    ? -random.integer(3, approach === "aggressive" ? 12 : 7)
    : random.integer(0, 2);
  const performance = clamp(basePerformance + approachPerformance - fatiguePenalty + random.integer(-8, 8) + healthDelta * 0.35);
  const trustDelta = round((performance - 64) * 0.14 + (approach === "controlled" ? 1 : 0), 1);
  const session = {
    id: `${state.draftYear}:${camp.teamId}:camp-${camp.day}`,
    day: camp.day,
    approach,
    grade: gradeLetter(performance),
    performance,
    healthDelta,
    coachTrustDelta: trustDelta,
    summary: performance >= 84
      ? "Практика изменила расклад позиционной комнаты. Штаб дал повторы с первой группой."
      : performance >= 70
        ? "Надёжная работа сохранила место в борьбе за состав."
        : "Ошибки и скорость принятия решений усилили риск отчисления.",
  } as const;
  const nextTrust = clamp(camp.coachTrust + trustDelta);
  const averagePerformance = ([...camp.sessions, session].reduce((sum, item) => sum + item.performance, 0) / (camp.sessions.length + 1));
  const rankImprovement = performance >= 84 ? 1 : performance < 57 ? -1 : 0;
  const nextRank = Math.max(1, Math.min(camp.playersAtPosition, camp.rosterRank - rankImprovement));
  const isFinal = camp.day >= camp.totalDays;
  let status: FootballProfessionalState["status"] = state.status;
  let outcome: ProfessionalTrainingCamp["outcome"];
  if (isFinal) {
    const rosterScore = averagePerformance * 0.56 + nextTrust * 0.25 + state.draftStock * 0.14 + team.needs[save.football.position] * 0.05;
    outcome = rosterScore >= 74 || nextRank <= 2 ? "active-roster" : rosterScore >= 62 ? "practice-squad" : "released";
    status = outcome === "active-roster" ? "roster" : outcome === "practice-squad" ? "practice-squad" : "cut";
  }
  const nextCamp: ProfessionalTrainingCamp = {
    ...camp,
    day: isFinal ? camp.totalDays : camp.day + 1,
    coachTrust: nextTrust,
    rosterRank: nextRank,
    sessions: [...camp.sessions, session],
    ...(outcome ? { outcome } : {}),
  };
  const outcomeLabel = outcome === "active-roster" ? "активный состав" : outcome === "practice-squad" ? "тренировочный состав" : outcome === "released" ? "отчисление" : undefined;
  return {
    ...save,
    meta: { ...save.meta, ...(isFinal ? { phase: "professional-career" as const } : {}) },
    character: {
      ...save.character,
      condition: {
        ...save.character.condition,
        health: clamp(save.character.condition.health + healthDelta),
        fatigue: clamp(save.character.condition.fatigue + (approach === "aggressive" ? 8 : approach === "balanced" ? 5 : 2)),
        confidence: clamp(save.character.condition.confidence + (performance - 65) * 0.08),
      },
    },
    football: {
      ...save.football,
      ...(isFinal ? { stage: "professional-career" as const } : {}),
      professional: {
        ...state,
        status,
        camp: nextCamp,
        lastSummary: outcomeLabel ? `Решение штаба: ${outcomeLabel}.` : session.summary,
      },
    },
    history: [...save.history, ...(outcomeLabel ? [{
      id: `${save.meta.worldSeed}:camp-outcome:${state.draftYear}:${camp.teamId}`,
      occurredAt: save.meta.updatedAt,
      type: "professional-roster-decision",
      title: `Решение штаба: ${outcomeLabel}`,
      description: `После четырёх контрольных этапов игрок получил статус «${outcomeLabel}».`,
    }] : [])],
  };
}
