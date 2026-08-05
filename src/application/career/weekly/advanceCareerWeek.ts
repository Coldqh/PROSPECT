import { toGameDateKey } from "../../../core/calendar/types";
import { resolveCollegeHeroDecision, finalizeCollegeMatch, isCollegeMatchAwaitingResolution } from "../../../sports/football/college/heroCareer";
import { resolveMatchDecision, startMatch } from "../../../sports/football/matches/simulateMatch";
import { resolveRelationshipEvent } from "../../../sports/football/relationships/relationshipEvents";
import { advanceFootballCareerDay, updateTrainingPlan, updateWeeklyPlan } from "../../../sports/football/simulation/advanceFootballDay";
import { advanceProfessionalWeek, finalizeProfessionalMatch, isProfessionalMatchAwaitingResolution, setProfessionalWeekFocus } from "../../../sports/football/pro/league";
import type { ProfessionalWeekFocus } from "../../../sports/football/pro/types";
import type { CareerSave } from "../../../storage/saves/schema";
import type { TrainingFocusId } from "../../../sports/football/training/types";

function automaticTrainingPlan(save: CareerSave): CareerSave {
  const body = save.football.training.body;
  const condition = save.character.condition;
  const recovery = Boolean(body.activeIssue) || condition.health < 74 || condition.fatigue > 68 || body.readiness < 62;
  const ratings = save.football.ratings;
  const weakest = [
    { id: "position-craft" as const, value: ratings.technique },
    { id: "explosive-power" as const, value: ratings.athleticism },
    { id: "film-install" as const, value: ratings.footballIq },
  ].sort((left, right) => left.value - right.value)[0]!;
  const focusId: TrainingFocusId = recovery ? "recovery-reset" : weakest.id;
  const templateId = recovery ? "recovery" : focusId === "film-install" ? "film-room" : "balanced";
  const intensity = recovery ? "controlled" : "standard";
  return updateTrainingPlan(updateWeeklyPlan(save, templateId, intensity), focusId, intensity);
}

function resolveAutomaticRelationshipEvents(save: CareerSave): CareerSave {
  let current = save;
  let safety = 0;
  while (current.relationships.pendingEvent && safety < 6) {
    const selected = [...current.relationships.pendingEvent.options]
      .map((option) => ({
        option,
        score: option.effects.relationship * .35
          + (option.effects.coachTrust ?? 0) * .7
          + (option.effects.confidence ?? 0) * .35
          - (option.effects.stress ?? 0) * .4
          + (option.effects.energy ?? 0) * .2
          + (option.effects.gpa ?? 0) * .2
          + (option.effects.teamMorale ?? 0) * .25,
      }))
      .sort((left, right) => right.score - left.score || left.option.id.localeCompare(right.option.id))[0];
    if (!selected) break;
    current = resolveRelationshipEvent(current, selected.option.id);
    safety += 1;
  }
  return current;
}

function automaticCollegeDecisionId(save: CareerSave): string | undefined {
  const decision = save.football.college.heroCareer?.pendingDecision;
  if (!decision) return undefined;
  const preferred = {
    "coach-meeting": ["accept-plan", "ask-role"],
    "position-rivalry": ["compete", "deescalate"],
    "transfer-window": ["stay", "open-options"],
    "transfer-destination": ["stay-current"],
  }[decision.kind];
  return preferred.find((id) => decision.options.some((option) => option.id === id)) ?? decision.options[0]?.id;
}

function resolveAutomaticCollegeDecisions(save: CareerSave): CareerSave {
  let current = save;
  let safety = 0;
  while (current.football.college.heroCareer?.pendingDecision && safety < 4) {
    const optionId = automaticCollegeDecisionId(current);
    if (!optionId) break;
    current = resolveCollegeHeroDecision(current, optionId);
    safety += 1;
  }
  return current;
}

function completeCurrentMatch(save: CareerSave): CareerSave {
  let current = save;
  if (current.football.match.status === "upcoming") current = startMatch(current, "auto", false);
  let safety = 0;
  while (current.football.match.status === "in-progress" && current.football.match.currentEpisode && safety < 240) {
    const optionId = current.football.match.currentEpisode.options[0]?.id;
    if (!optionId) break;
    current = resolveMatchDecision(current, optionId);
    safety += 1;
  }
  if (current.football.match.status !== "complete") throw new Error("Automatic match simulation did not finish");
  return current;
}

function advanceHighSchoolWeek(save: CareerSave): CareerSave {
  let current = automaticTrainingPlan(resolveAutomaticRelationshipEvents(save));
  const targetWeek = current.life.weekNumber + 1;
  let safety = 0;
  while (current.life.weekNumber < targetWeek && safety < 10) {
    current = resolveAutomaticRelationshipEvents(current);
    const matchToday = toGameDateKey(current.meta.currentDate) === toGameDateKey(current.football.match.scheduledDate);
    if (matchToday && current.football.match.status !== "complete") current = completeCurrentMatch(current);
    current = advanceFootballCareerDay(current);
    safety += 1;
  }
  if (current.life.weekNumber < targetWeek) throw new Error("High-school week did not complete");
  return resolveAutomaticRelationshipEvents(current);
}

function advanceCollegeWeek(save: CareerSave): CareerSave {
  let current = automaticTrainingPlan(resolveAutomaticCollegeDecisions(save));
  const targetWeek = current.life.weekNumber + 1;
  let safety = 0;
  while (current.life.weekNumber < targetWeek && safety < 10) {
    current = resolveAutomaticCollegeDecisions(current);
    if (isCollegeMatchAwaitingResolution(current)) {
      current = completeCurrentMatch(current);
      current = finalizeCollegeMatch(current);
    }
    current = advanceFootballCareerDay(current);
    safety += 1;
  }
  if (current.life.weekNumber < targetWeek) throw new Error("College week did not complete");
  if (isCollegeMatchAwaitingResolution(current)) {
    current = completeCurrentMatch(current);
    current = finalizeCollegeMatch(current);
  }
  return resolveAutomaticCollegeDecisions(current);
}

function automaticProfessionalFocus(save: CareerSave): ProfessionalWeekFocus {
  const career = save.football.professional.heroCareer;
  const hero = save.football.professional.league.roster.find((player) => player.isHero);
  if (!career || !hero) return "playbook";
  if (hero.health < 78 || hero.availability !== "active") return "recovery";
  if (career.depthRank > 2) return "competition";
  if (hero.overall < 76) return "technique";
  return "playbook";
}

function advanceProfessionalCareerWeek(save: CareerSave): CareerSave {
  let current = save;
  const plan = current.football.professional.heroCareer?.weeklyPlan;
  if (plan && !plan.resolved && current.football.professional.heroCareer?.teamId) {
    current = setProfessionalWeekFocus(current, automaticProfessionalFocus(current));
  }
  if (isProfessionalMatchAwaitingResolution(current)) {
    current = completeCurrentMatch(current);
    return finalizeProfessionalMatch(current);
  }
  return advanceProfessionalWeek(current);
}

export function advanceCareerWeek(save: CareerSave): CareerSave {
  if (save.meta.phase === "high-school-preseason") return advanceHighSchoolWeek(save);
  if (save.meta.phase === "college-season") return advanceCollegeWeek(save);
  if (save.meta.phase === "professional-career") return advanceProfessionalCareerWeek(save);
  throw new Error("Weekly progression is unavailable in this career phase");
}
