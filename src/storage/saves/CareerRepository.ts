import { createSeed } from "../../core/random/createSeed";
import { loadSportModule } from "../../core/sports/sportRegistry";
import { createChecksum } from "./checksum";
import { migrateCareerSave } from "./migrations";
import {
  CURRENT_SCHEMA_VERSION,
  type CareerIndexRecord,
  type CareerSave,
} from "./schema";
import { getDatabase, type SnapshotRecord } from "../indexedDb/database";

const MAX_AUTOSAVE_BACKUPS = 5;

function snapshotId(careerId: string, revision: number): string {
  return `${careerId}:${revision.toString().padStart(8, "0")}`;
}

function toIndexRecord(save: CareerSave): CareerIndexRecord {
  return {
    id: save.meta.id,
    displayName: "Новый проспект",
    sport: save.meta.sport,
    phase: save.meta.phase,
    currentDate: `${save.meta.currentDate.year}-${String(save.meta.currentDate.month).padStart(2, "0")}-${String(save.meta.currentDate.day).padStart(2, "0")}`,
    updatedAt: save.meta.updatedAt,
    revision: save.meta.revision,
  };
}

function toSnapshot(save: CareerSave): SnapshotRecord {
  return {
    id: snapshotId(save.meta.id, save.meta.revision),
    careerId: save.meta.id,
    revision: save.meta.revision,
    schemaVersion: save.meta.schemaVersion,
    checksum: createChecksum(save),
    createdAt: save.meta.updatedAt,
    state: save,
  };
}

async function pruneBackups(careerId: string): Promise<void> {
  const database = await getDatabase();
  const records = await database.getAllFromIndex("autosaveBackups", "by-careerId", careerId);
  records.sort((left, right) => right.revision - left.revision);

  const obsolete = records.slice(MAX_AUTOSAVE_BACKUPS);
  const transaction = database.transaction("autosaveBackups", "readwrite");
  await Promise.all(obsolete.map((record) => transaction.store.delete(record.id)));
  await transaction.done;
}

export class CareerRepository {
  async list(): Promise<CareerIndexRecord[]> {
    const database = await getDatabase();
    const records = await database.getAll("careerIndex");
    return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createFootballCareer(): Promise<CareerSave> {
    const careerId = crypto.randomUUID();
    const worldSeed = createSeed("football");
    const now = new Date().toISOString();
    const footballModule = await loadSportModule("american-football");

    const save: CareerSave = {
      meta: {
        id: careerId,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sport: "american-football",
        worldSeed,
        createdAt: now,
        updatedAt: now,
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "foundation",
        revision: 0,
      },
      football: footballModule.createInitialState(worldSeed) as CareerSave["football"],
      history: [
        {
          id: crypto.randomUUID(),
          occurredAt: now,
          type: "career-created",
          title: "Карьера создана",
          description: "Футбольный мир получил постоянный seed и первое безопасное сохранение.",
        },
      ],
    };

    return this.save(save);
  }

  async save(input: CareerSave): Promise<CareerSave> {
    const now = new Date().toISOString();
    const save: CareerSave = {
      ...input,
      meta: {
        ...input.meta,
        updatedAt: now,
        revision: input.meta.revision + 1,
      },
    };

    const database = await getDatabase();
    const snapshot = toSnapshot(save);
    const previous = await this.readLatestSnapshot(save.meta.id);
    const transaction = database.transaction(
      ["careerIndex", "careerSnapshots", "autosaveBackups"],
      "readwrite",
    );

    if (previous) {
      await transaction.objectStore("autosaveBackups").put(previous);
    }

    await transaction.objectStore("careerSnapshots").put(snapshot);
    await transaction.objectStore("careerIndex").put(toIndexRecord(save));
    await transaction.done;
    await pruneBackups(save.meta.id);

    return save;
  }

  async load(careerId: string): Promise<CareerSave> {
    const latest = await this.readLatestSnapshot(careerId);

    if (latest && latest.checksum === createChecksum(latest.state)) {
      return migrateCareerSave(latest.state).save;
    }

    const database = await getDatabase();
    const backups = await database.getAllFromIndex("autosaveBackups", "by-careerId", careerId);
    backups.sort((left, right) => right.revision - left.revision);

    for (const backup of backups) {
      if (backup.checksum !== createChecksum(backup.state)) {
        continue;
      }

      return migrateCareerSave(backup.state).save;
    }

    throw new Error("Career save is missing or corrupted");
  }

  async remove(careerId: string): Promise<void> {
    const database = await getDatabase();
    const transaction = database.transaction(
      ["careerIndex", "careerSnapshots", "autosaveBackups", "manualSaves"],
      "readwrite",
    );

    await transaction.objectStore("careerIndex").delete(careerId);

    for (const storeName of ["careerSnapshots", "autosaveBackups", "manualSaves"] as const) {
      const store = transaction.objectStore(storeName);
      const records = await store.index("by-careerId").getAll(careerId);
      await Promise.all(records.map((record) => store.delete(record.id)));
    }

    await transaction.done;
  }

  async export(careerId: string): Promise<Blob> {
    const save = await this.load(careerId);
    return new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  }

  async import(file: File): Promise<CareerSave> {
    const raw = JSON.parse(await file.text()) as unknown;
    const imported = migrateCareerSave(raw).save;
    const now = new Date().toISOString();
    const save: CareerSave = {
      ...imported,
      meta: {
        ...imported.meta,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        revision: 0,
      },
      history: [
        ...imported.history,
        {
          id: crypto.randomUUID(),
          occurredAt: now,
          type: "career-imported",
          title: "Карьера импортирована",
          description: "Импорт создан как отдельная карьера и не перезаписал исходное сохранение.",
        },
      ],
    };

    return this.save(save);
  }

  private async readLatestSnapshot(careerId: string): Promise<SnapshotRecord | undefined> {
    const database = await getDatabase();
    const records = await database.getAllFromIndex("careerSnapshots", "by-careerId", careerId);
    records.sort((left, right) => right.revision - left.revision);
    return records[0];
  }
}

export const careerRepository = new CareerRepository();
