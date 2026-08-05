import type { CareerSave } from "../../../storage/saves/schema";
import type { CareerMutationStore } from "../CareerMutationStore";
import { advanceCareerWeek } from "../weekly/advanceCareerWeek";
import { buildWeeklyReport } from "../weekly/buildWeeklyReport";
import type { CareerWeekAdvanceResult } from "../weekly/types";

export class CareerWeekCommands {
  constructor(private readonly store: CareerMutationStore) {}

  async advance(careerId: string): Promise<CareerWeekAdvanceResult> {
    let before: CareerSave | undefined;
    const save = await this.store.mutate(careerId, (current) => {
      before = current;
      return advanceCareerWeek(current);
    });
    if (!before) throw new Error("Career week did not start");
    return { save, report: buildWeeklyReport(before, save) };
  }
}
