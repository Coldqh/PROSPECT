import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import { careerSaveSchema, CURRENT_SCHEMA_VERSION, type CareerSave } from "./schema";

export interface MigrationResult {
  save: CareerSave;
  migratedFrom?: number;
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
  history: Array<{
    id: string;
    occurredAt: string;
    type: string;
    title: string;
    description: string;
  }>;
}

function migrateVersionOne(input: LegacyFoundationSave): CareerSave {
  const setup = createLegacyFootballSetup(input.meta.worldSeed);
  const generated = createFootballCareerState(input.meta.worldSeed, setup);
  const migrated: CareerSave = {
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
  return careerSaveSchema.parse(migrated);
}

export function migrateCareerSave(input: unknown): MigrationResult {
  if (!input || typeof input !== "object") {
    throw new Error("Save payload is not an object");
  }

  const schemaVersion = (input as { meta?: { schemaVersion?: unknown } }).meta?.schemaVersion;

  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    return { save: careerSaveSchema.parse(input) };
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
