import {
  finalizeCollegeMatch,
  isCollegeMatchAwaitingResolution,
  resolveCollegeHeroDecision,
} from "../../../sports/football/college/heroCareer";
import {
  reportToCollege,
  setCollegeOnboardingPriority,
  signCollegeAgreement,
} from "../../../sports/football/college/transition";
import type { CollegeEntryRoute, CollegeOnboardingPriority } from "../../../sports/football/college/types";
import { advanceFootballCareerDay } from "../../../sports/football/simulation/advanceFootballDay";
import type { CareerSave } from "../../../storage/saves/schema";
import type { CareerMutationStore } from "../CareerMutationStore";

export class CollegeCareerCommands {
  constructor(private readonly store: CareerMutationStore) {}

  async signCollegeAgreement(
    careerId: string,
    programId: string,
    route: CollegeEntryRoute,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => signCollegeAgreement(current, programId, route));
  }

  async reportToCollege(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, reportToCollege);
  }

  async setCollegeOnboardingPriority(
    careerId: string,
    priority: CollegeOnboardingPriority,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => setCollegeOnboardingPriority(current, priority));
  }

  async resolveCollegeHeroDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveCollegeHeroDecision(current, optionId));
  }

  async finalizeMatch(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, finalizeCollegeMatch);
  }

  async advanceDay(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase !== "college-season") {
        throw new Error("College career is not active");
      }
      if (isCollegeMatchAwaitingResolution(current)) {
        throw new Error(
          current.football.match.status === "complete"
            ? "College match must be finalized"
            : "College match must be played",
        );
      }
      return advanceFootballCareerDay(current);
    });
  }
}
