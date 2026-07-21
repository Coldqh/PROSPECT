import { careerSaveSchema, CURRENT_SCHEMA_VERSION, type CareerSave } from "./schema";

export interface MigrationResult {
  save: CareerSave;
  migratedFrom?: number;
}

export function migrateCareerSave(input: unknown): MigrationResult {
  if (!input || typeof input !== "object") {
    throw new Error("Save payload is not an object");
  }

  const schemaVersion = (input as { meta?: { schemaVersion?: unknown } }).meta?.schemaVersion;

  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    return { save: careerSaveSchema.parse(input) };
  }

  if (typeof schemaVersion !== "number") {
    throw new Error("Save has no schema version");
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error("Save was created by a newer PROSPECT version");
  }

  throw new Error(`No migration path from schema ${schemaVersion}`);
}
