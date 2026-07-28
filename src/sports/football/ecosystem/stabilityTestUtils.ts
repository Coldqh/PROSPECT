import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "./createEcosystem";

export function createStabilitySave(seed = "twenty-season-stability"): CareerSave {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const life = createInitialLifeState();
  const date = { year: 2026, month: 8, day: 17 };

  return {
    meta: {
      id: "stability-observer",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed: seed,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
      currentDate: date,
      phase: "high-school-preseason",
      revision: 1,
    },
    character: generated.character,
    football: generated.football,
    life,
    relationships: createFootballRelationships(seed, generated.character, generated.football),
    world: createFootballEcosystem(seed, generated.character, generated.football, date),
    history: [],
  };
}
