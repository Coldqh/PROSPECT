import type { FootballPosition } from "../../../sports/football/career/types";
import type { MatchStatLine } from "../../../sports/football/matches/types";
import type { MedicalStatus } from "../../../sports/football/training/types";
import type { CareerSave } from "../../../storage/saves/schema";
import type { WeeklyReport, WeeklyReportChange, WeeklyReportHeadline, WeeklyReportMatch, WeeklyReportMetric } from "./types";

function signedDelta(after: number, before: number): number | undefined {
  const value = Math.round((after - before) * 10) / 10;
  return value === 0 ? undefined : value;
}

function teamName(save: CareerSave): string {
  return save.football.professional.contract?.teamName
    ?? save.football.college.program?.shortName
    ?? save.football.school.shortName;
}

function role(save: CareerSave): string {
  return save.football.professional.heroCareer?.role
    ?? save.football.college.heroCareer?.role
    ?? save.football.depthChart.projectedRole;
}

function roleLabel(value: string): string {
  return {
    starter: "Стартер",
    rotation: "Ротация",
    "special-teams": "Спецкоманды",
    developmental: "Развитие",
    inactive: "Неактивен",
    "practice-squad": "Тренировочный состав",
    "free-agent": "Свободный агент",
    "first-team": "Первая команда",
    "second-team": "Вторая команда",
    reserve: "Резерв",
  }[value] ?? value;
}

function roleWeight(value: string): number {
  return {
    starter: 6,
    "first-team": 6,
    rotation: 5,
    "second-team": 4,
    "special-teams": 3,
    developmental: 2,
    reserve: 2,
    "practice-squad": 1,
    inactive: 0,
    "free-agent": 0,
  }[value] ?? 2;
}

function medicalLabel(status: MedicalStatus): string {
  return {
    cleared: "Допущен",
    questionable: "Под вопросом",
    limited: "Ограничен",
    out: "Вне состава",
  }[status];
}

function medicalWeight(status: MedicalStatus): number {
  return { cleared: 3, questionable: 2, limited: 1, out: 0 }[status];
}

function coachTrust(save: CareerSave): number {
  return save.football.professional.heroCareer?.coachTrust
    ?? save.football.college.heroCareer?.coachTrust
    ?? save.football.depthChart.coachTrust;
}

function record(save: CareerSave): string {
  const professional = save.football.professional;
  if (save.meta.phase === "professional-career" && professional.heroCareer?.teamId) {
    const team = professional.teams.find((item) => item.id === professional.heroCareer?.teamId);
    return team ? `${team.wins}–${team.losses}` : "0–0";
  }
  const college = save.football.college.heroCareer;
  if (college) {
    const team = save.world.teams.find((item) => item.id === college.teamId);
    return team ? `${team.wins}–${team.losses}` : "0–0";
  }
  return `${save.football.season.wins}–${save.football.season.losses}`;
}

function statSpotlight(position: FootballPosition, stats: MatchStatLine): string {
  const byPosition: Record<FootballPosition, string> = {
    QB: `${stats.completions}/${stats.passingAttempts}, ${stats.passingYards} ярдов, ${stats.touchdowns} TD, ${stats.turnovers} потерь`,
    RB: `${stats.rushingAttempts} выносов, ${stats.rushingYards} ярдов, ${stats.receptions} приёмов, ${stats.touchdowns} TD`,
    WR: `${stats.receptions}/${stats.targets}, ${stats.receivingYards} ярдов, ${stats.touchdowns} TD`,
    TE: `${stats.receptions}/${stats.targets}, ${stats.receivingYards} ярдов, ${stats.touchdowns} TD`,
    OT: `${stats.pancakes} pancakes, ${stats.pressuresAllowed} pressures, ${stats.sacksAllowed} sacks allowed`,
    OG: `${stats.pancakes} pancakes, ${stats.pressuresAllowed} pressures, ${stats.sacksAllowed} sacks allowed`,
    C: `${stats.pancakes} pancakes, ${stats.pressuresAllowed} pressures, ${stats.sacksAllowed} sacks allowed`,
    EDGE: `${stats.tackles} захватов, ${stats.tacklesForLoss} TFL, ${stats.sacks} sacks, ${stats.hurries} hurries`,
    DT: `${stats.tackles} захватов, ${stats.tacklesForLoss} TFL, ${stats.hurries} hurries`,
    LB: `${stats.tackles} захватов, ${stats.tacklesForLoss} TFL, ${stats.sacks} sacks`,
    CB: `${stats.tackles} захватов, ${stats.passBreakups} PBU, ${stats.interceptions} INT`,
    S: `${stats.tackles} захватов, ${stats.passBreakups} PBU, ${stats.interceptions} INT`,
    K: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted} FG, дальний ${stats.longestFieldGoal} ярдов`,
    P: `${stats.punts} пантов, ${stats.puntYards} ярдов, inside 20: ${stats.puntsInside20}`,
  };
  return byPosition[position];
}

function completedMatch(before: CareerSave, after: CareerSave): WeeklyReportMatch | undefined {
  if (before.meta.phase === "high-school-preseason") {
    const beforeComplete = new Set(before.football.season.schedule.filter((game) => game.status === "complete").map((game) => game.week));
    const game = after.football.season.schedule.find((item) => item.status === "complete" && !beforeComplete.has(item.week));
    if (!game || game.heroScore === undefined || game.opponentScore === undefined || game.won === undefined) return undefined;
    const spotlight = game.spotlight ?? after.football.match.finalResult?.spotlight;
    return {
      opponent: game.opponentName,
      score: `${game.heroScore}–${game.opponentScore}`,
      won: game.won,
      ...(game.heroGrade ? { grade: game.heroGrade } : {}),
      ...(spotlight ? { spotlight } : {}),
    };
  }
  if (before.meta.phase === "college-season") {
    const previous = before.football.college.heroCareer?.gameLog.length ?? 0;
    const game = after.football.college.heroCareer?.gameLog[previous];
    if (!game) return undefined;
    const spotlight = game.spotlight ?? (game.stats ? statSpotlight(after.football.position, game.stats) : undefined);
    return {
      opponent: game.opponentName,
      score: game.score,
      won: game.won,
      grade: game.grade,
      snaps: game.snaps,
      ...(spotlight ? { spotlight } : {}),
    };
  }
  const previous = before.football.professional.heroCareer?.gameLog.length ?? 0;
  const game = after.football.professional.heroCareer?.gameLog[previous];
  if (!game) return undefined;
  const opponent = after.football.professional.teams.find((team) => team.id === game.opponentId);
  return {
    opponent: opponent?.shortName ?? game.opponentId,
    score: `${game.teamScore}–${game.opponentScore}`,
    won: game.won,
    grade: game.grade,
    snaps: game.snaps,
    spotlight: statSpotlight(after.football.position, game.stats),
  };
}

function changes(before: CareerSave, after: CareerSave): WeeklyReportChange[] {
  const result: WeeklyReportChange[] = [];
  const beforeRole = role(before);
  const afterRole = role(after);
  if (beforeRole !== afterRole) {
    result.push({
      id: "role",
      label: "Роль",
      value: roleLabel(afterRole),
      detail: `${roleLabel(beforeRole)} → ${roleLabel(afterRole)}`,
      tone: roleWeight(afterRole) > roleWeight(beforeRole) ? "positive" : "negative",
    });
  }

  const beforeBody = before.football.training.body;
  const afterBody = after.football.training.body;
  const newIssue = afterBody.activeIssue && afterBody.activeIssue.id !== beforeBody.activeIssue?.id;
  if (newIssue) {
    result.push({
      id: "injury",
      label: "Медицина",
      value: afterBody.activeIssue!.diagnosis,
      detail: `${afterBody.activeIssue!.daysRemaining} дн. · ${medicalLabel(afterBody.medicalStatus)}`,
      tone: "negative",
    });
  } else if (beforeBody.medicalStatus !== afterBody.medicalStatus) {
    result.push({
      id: "medical",
      label: "Допуск",
      value: medicalLabel(afterBody.medicalStatus),
      detail: `${medicalLabel(beforeBody.medicalStatus)} → ${medicalLabel(afterBody.medicalStatus)}`,
      tone: medicalWeight(afterBody.medicalStatus) > medicalWeight(beforeBody.medicalStatus) ? "positive" : "negative",
    });
  }

  const overallDelta = signedDelta(after.football.ratings.overall, before.football.ratings.overall);
  if (overallDelta !== undefined) {
    result.push({
      id: "overall",
      label: "Развитие",
      value: `${overallDelta > 0 ? "+" : ""}${overallDelta} OVR`,
      detail: `${Math.round(before.football.ratings.overall)} → ${Math.round(after.football.ratings.overall)}`,
      tone: overallDelta > 0 ? "positive" : "negative",
    });
  }

  const beforeOffers = before.football.recruitment.programs.filter((program) => Boolean(program.offer)).length;
  const afterOffers = after.football.recruitment.programs.filter((program) => Boolean(program.offer)).length;
  if (afterOffers !== beforeOffers) {
    result.push({
      id: "offers",
      label: "Рекрутинг",
      value: afterOffers > beforeOffers ? `+${afterOffers - beforeOffers} оффер` : `${afterOffers} офферов`,
      detail: `Всего предложений: ${afterOffers}`,
      tone: afterOffers > beforeOffers ? "positive" : "neutral",
    });
  }

  if (result.length === 0) {
    result.push({
      id: "stable",
      label: "Статус",
      value: roleLabel(afterRole),
      detail: `${medicalLabel(afterBody.medicalStatus)} · без резких изменений`,
      tone: "neutral",
    });
  }
  return result.slice(0, 3);
}

function newHeadlines(before: CareerSave, after: CareerSave): WeeklyReportHeadline[] {
  const knownStories = new Set(before.world.stories.map((story) => story.id));
  const stories = after.world.stories
    .filter((story) => !knownStories.has(story.id))
    .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.importance - left.importance || right.week - left.week)
    .slice(0, 3)
    .map((story) => ({ id: story.id, title: story.title, detail: story.detail, importance: story.importance }));
  if (stories.length >= 3) return stories;
  const knownTransactions = new Set(before.football.professional.league.transactions.map((item) => item.id));
  const transactions = after.football.professional.league.transactions
    .filter((item) => !knownTransactions.has(item.id))
    .slice(-3)
    .reverse()
    .map((item) => ({ id: item.id, title: item.playerName, detail: item.summary, importance: 3 }));
  return [...stories, ...transactions].slice(0, 3);
}

export function buildWeeklyReport(before: CareerSave, after: CareerSave): WeeklyReport {
  const match = completedMatch(before, after);
  const beforeOffers = before.football.recruitment.programs.filter((program) => Boolean(program.offer)).length;
  const afterOffers = after.football.recruitment.programs.filter((program) => Boolean(program.offer)).length;
  const overallDelta = signedDelta(after.football.ratings.overall, before.football.ratings.overall);
  const trustDelta = signedDelta(coachTrust(after), coachTrust(before));
  const healthDelta = signedDelta(after.character.condition.health, before.character.condition.health);
  const metrics: WeeklyReportMetric[] = [
    { id: "overall", label: "OVR", value: Math.round(after.football.ratings.overall).toString(), ...(overallDelta !== undefined ? { delta: overallDelta } : {}) },
    { id: "coach-trust", label: "Доверие", value: Math.round(coachTrust(after)).toString(), ...(trustDelta !== undefined ? { delta: trustDelta } : {}) },
    { id: "health", label: "Здоровье", value: Math.round(after.character.condition.health).toString(), ...(healthDelta !== undefined ? { delta: healthDelta } : {}) },
    { id: "role", label: "Роль", value: roleLabel(role(after)) },
  ];
  if (afterOffers !== beforeOffers) metrics.push({ id: "offers", label: "Офферы", value: afterOffers.toString(), delta: afterOffers - beforeOffers });
  if (match?.snaps !== undefined) metrics.push({ id: "snaps", label: "Снэпы", value: match.snaps.toString() });
  const summary = match
    ? `${match.won ? "Победа" : "Поражение"} ${match.score}`
    : `Неделя завершена · ${teamName(after)} ${record(after)}`;
  return {
    id: `${after.meta.id}:weekly-report:${after.meta.revision}`,
    week: before.meta.phase === "professional-career" ? before.football.professional.league.week : before.life.weekNumber,
    startDate: before.meta.currentDate,
    endDate: after.meta.currentDate,
    teamName: teamName(after),
    record: record(after),
    summary,
    ...(match ? { match } : {}),
    metrics,
    changes: changes(before, after),
    headlines: newHeadlines(before, after),
  };
}
