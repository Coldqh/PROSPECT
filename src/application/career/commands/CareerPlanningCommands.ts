import type { TrainingIntensity, WeeklyPlanTemplateId } from "../../../core/life/types";
import {
  updateTrainingPlan as applyTrainingPlan,
  updateWeeklyPlan as applyWeeklyPlan,
} from "../../../sports/football/simulation/advanceFootballDay";
import type { TrainingFocusId } from "../../../sports/football/training/types";
import type { CareerSave } from "../../../storage/saves/schema";
import type { CareerMutationStore } from "../CareerMutationStore";

export class CareerPlanningCommands {
  constructor(private readonly store: CareerMutationStore) {}

  async updateWeeklyPlan(
    careerId: string,
    templateId: WeeklyPlanTemplateId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "college-orientation") {
        throw new Error("Weekly planning unlocks after college orientation");
      }
      return applyWeeklyPlan(current, templateId, intensity);
    });
  }

  async updateTrainingPlan(
    careerId: string,
    focusId: TrainingFocusId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "college-orientation") {
        throw new Error("Training planning unlocks after college orientation");
      }
      return applyTrainingPlan(current, focusId, intensity);
    });
  }
}
