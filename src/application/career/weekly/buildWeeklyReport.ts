import type { CareerSave } from "../../../storage/saves/schema";
import type { WeeklyReport, WeeklyReportHeadline, WeeklyReportMatch, WeeklyReportMetric } from "./types";

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

function completedMatch(before: CareerSave, after: CareerSave): WeeklyReportMatch | undefined {
  if (before.meta.phase === "high-school-preseason") {
    const beforeComplete = new Set(before.football.season.schedule.filter((game) => game.status === "complete").map((game) => game.week));
    const game = after.football.season.schedule.find((item) => item.status === "complete" && !beforeComplete.has(item.week));
    if (!game || game.heroScore === undefined || game.opponentScore === undefined || game.won === undefined) return undefined;
    return {
      opponent: game.opponentName,
      score: `${game.heroScore}–${game.opponentScore}`,
      won: game.won,
      ...(game.heroGrade ? { grade: game.heroGrade } : {}),
    };
  }
  if (before.meta.phase === "college-season") {
    const previous = before.football.college.heroCareer?.gameLog.length ?? 0;
    const game = after.football.college.heroCareer?.gameLog[previous];
    return game ? { opponent: game.opponentName, score: game.score, won: game.won, grade: game.grade, snaps: game.snaps } : undefined;
  }
  const previous = before.football.professional.heroCareer?.gameLog.length ?? 0;
  const game = after.football.professional.heroCareer?.gameLog[previous];
  if (!game) return undefined;
  const opponent = after.football.professional.teams.find((team) => team.id === game.opponentId);
  return { opponent: opponent?.shortName ?? game.opponentId, score: `${game.teamScore}–${game.opponentScore}`, won: game.won, grade: game.grade, snaps: game.snaps };
}

function newHeadlines(before: CareerSave, after: CareerSave): WeeklyReportHeadline[] {
  const knownStories = new Set(before.world.stories.map((story) => story.id));
  const stories = after.world.stories
    .filter((story) => !knownStories.has(story.id))
    .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.importance - left.importance || right.week - left.week)
    .slice(0, 4)
    .map((story) => ({ id: story.id, title: story.title, detail: story.detail, importance: story.importance }));
  if (stories.length >= 3) return stories;
  const knownTransactions = new Set(before.football.professional.league.transactions.map((item) => item.id));
  const transactions = after.football.professional.league.transactions
    .filter((item) => !knownTransactions.has(item.id))
    .slice(-4)
    .reverse()
    .map((item) => ({ id: item.id, title: item.playerName, detail: item.summary, importance: 3 }));
  return [...stories, ...transactions].slice(0, 4);
}

export function buildWeeklyReport(before: CareerSave, after: CareerSave): WeeklyReport {
  const match = completedMatch(before, after);
  const beforeOffers = before.football.recruitment.programs.filter((program) => Boolean(program.offer)).length;
  const afterOffers = after.football.recruitment.programs.filter((program) => Boolean(program.offer)).length;
  const metrics: WeeklyReportMetric[] = [
    { id: "overall", label: "OVR", value: Math.round(after.football.ratings.overall).toString(), ...(signedDelta(after.football.ratings.overall, before.football.ratings.overall) !== undefined ? { delta: signedDelta(after.football.ratings.overall, before.football.ratings.overall)! } : {}) },
    { id: "coach-trust", label: "Доверие", value: Math.round(coachTrust(after)).toString(), ...(signedDelta(coachTrust(after), coachTrust(before)) !== undefined ? { delta: signedDelta(coachTrust(after), coachTrust(before))! } : {}) },
    { id: "health", label: "Здоровье", value: Math.round(after.character.condition.health).toString(), ...(signedDelta(after.character.condition.health, before.character.condition.health) !== undefined ? { delta: signedDelta(after.character.condition.health, before.character.condition.health)! } : {}) },
    { id: "role", label: "Роль", value: role(after) },
  ];
  if (afterOffers !== beforeOffers) metrics.push({ id: "offers", label: "Офферы", value: afterOffers.toString(), delta: afterOffers - beforeOffers });
  if (match?.snaps !== undefined) metrics.push({ id: "snaps", label: "Снэпы", value: match.snaps.toString() });
  const summary = match
    ? `${match.won ? "Победа" : "Поражение"} ${match.score} против ${match.opponent}.`
    : `Неделя завершена. ${teamName(after)} продолжает сезон с результатом ${record(after)}.`;
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
    headlines: newHeadlines(before, after),
  };
}
