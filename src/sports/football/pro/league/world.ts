import type { GameDate } from "../../../../core/calendar/types";
import type { CareerSave } from "../../../../storage/saves/schema";
import { advanceFootballEcosystem } from "../../ecosystem/simulateEcosystem";
import { syncProfessionalCareerRegistry } from "../../ecosystem/lifecycle";
import { dateValue } from "./shared";

export function advanceBackgroundWorld(save: CareerSave, targetDate: GameDate): CareerSave {
  const days = Math.max(0, Math.round((dateValue(targetDate) - dateValue(save.world.lastUpdatedOn)) / 86_400_000));
  if (days === 0) return { ...save, meta: { ...save.meta, currentDate: targetDate } };
  const elapsed = save.life.dayIndex + days;
  return advanceFootballEcosystem({
    ...save,
    meta: { ...save.meta, currentDate: targetDate },
    life: {
      ...save.life,
      completedDays: save.life.completedDays + days,
      dayIndex: elapsed % 7,
      weekNumber: save.life.weekNumber + Math.floor(elapsed / 7),
    },
  });
}

export function syncProfessionalWorld(save: CareerSave): CareerSave {
  const league = save.football.professional.league;
  if (league.schedule.length === 0) return save;
  const careerRegistry = syncProfessionalCareerRegistry(
    save.world.careerRegistry,
    league.roster,
    league.freeAgents,
    league.transactions,
    league.seasonYear,
    league.week,
  );
  return { ...save, world: { ...save.world, careerRegistry } };
}
