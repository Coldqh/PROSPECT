import { toGameDateKey } from "../../../core/calendar/types";
import { isCollegeMatchAwaitingResolution } from "../../../sports/football/college/heroCareer";
import { resolveMatchDecision, startMatch } from "../../../sports/football/matches/simulateMatch";
import type { MatchParticipationMode } from "../../../sports/football/matches/types";
import {
  isProfessionalMatchAwaitingResolution,
  setProfessionalWeekFocus,
} from "../../../sports/football/pro/league";
import type { CareerSave } from "../../../storage/saves/schema";
import type { CareerMutationStore } from "../CareerMutationStore";

export class MatchCommands {
  constructor(private readonly store: CareerMutationStore) {}

  async start(careerId: string, mode: MatchParticipationMode, analysisMode: boolean): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "college-season") {
        if (!isCollegeMatchAwaitingResolution(current)) throw new Error("No college match is ready");
        return startMatch(current, mode, analysisMode);
      }

      if (current.meta.phase === "professional-career") {
        const weeklyPlan = current.football.professional.heroCareer?.weeklyPlan;
        const prepared = weeklyPlan && !weeklyPlan.resolved
          ? setProfessionalWeekFocus(current, weeklyPlan.focus)
          : current;
        if (!isProfessionalMatchAwaitingResolution(prepared)) {
          throw new Error("No professional match is ready");
        }
        return startMatch(prepared, mode, analysisMode);
      }

      if (current.meta.phase !== "high-school-preseason") {
        throw new Error("Interactive match mode is unavailable");
      }
      if (current.relationships.pendingEvent) {
        throw new Error("Relationship event must be resolved before the match");
      }
      if (toGameDateKey(current.meta.currentDate) !== toGameDateKey(current.football.match.scheduledDate)) {
        throw new Error("Match is not scheduled for today");
      }
      return startMatch(current, mode, analysisMode);
    });
  }

  async resolveDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveMatchDecision(current, optionId));
  }
}
