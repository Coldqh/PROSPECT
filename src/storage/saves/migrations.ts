import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import { careerSaveSchema, CURRENT_SCHEMA_VERSION, type CareerSave } from "./schema";

export interface MigrationResult {
  save: CareerSave;
  migratedFrom?: number;
}

interface HistoryEntry {
  id: string;
  occurredAt: string;
  type: string;
  title: string;
  description: string;
}

interface LegacyFoundationSave {
  meta: {
    id: string;
    schemaVersion: 1;
    sport: "american-football";
    worldSeed: string;
    createdAt: string;
    updatedAt: string;
    currentDate: { year: number; month: number; day: number };
    phase: "foundation";
    revision: number;
  };
  history: HistoryEntry[];
}

interface LegacyPlayerCreationSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 2 };
  character: CareerSave["character"];
  football: CareerSave["football"];
  history: HistoryEntry[];
}

function migrateVersionTwo(input: LegacyPlayerCreationSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: {
      ...input.meta,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    life: createInitialLifeState(),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v3`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Недельный цикл открыт",
        description: "Карьера получила календарь, недельный план, состояние дня и детерминированную симуляцию режима.",
      },
    ],
  });
}

function migrateVersionOne(input: LegacyFoundationSave): CareerSave {
  const setup = createLegacyFootballSetup(input.meta.worldSeed);
  const generated = createFootballCareerState(input.meta.worldSeed, setup);
  const versionTwo: LegacyPlayerCreationSave = {
    meta: {
      ...input.meta,
      schemaVersion: 2,
      phase: "high-school-preseason",
    },
    character: generated.character,
    football: generated.football,
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v2`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Карьера обновлена",
        description: "Техническое сохранение получило спортсмена, школу и стартовые условия школьного сезона.",
      },
    ],
  };
  return migrateVersionTwo(versionTwo);
}

export function migrateCareerSave(input: unknown): MigrationResult {
  if (!input || typeof input !== "object") {
    throw new Error("Save payload is not an object");
  }

  const schemaVersion = (input as { meta?: { schemaVersion?: unknown } }).meta?.schemaVersion;

  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    return { save: careerSaveSchema.parse(input) };
  }

  if (schemaVersion === 2) {
    return { save: migrateVersionTwo(input as LegacyPlayerCreationSave), migratedFrom: 2 };
  }

  if (schemaVersion === 1) {
    return { save: migrateVersionOne(input as LegacyFoundationSave), migratedFrom: 1 };
  }

  if (typeof schemaVersion !== "number") {
    throw new Error("Save has no schema version");
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error("Save was created by a newer PROSPECT version");
  }

  throw new Error(`No migration path from schema ${schemaVersion}`);
}
