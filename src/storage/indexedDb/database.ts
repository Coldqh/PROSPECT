import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CareerIndexRecord, CareerSave } from "../saves/schema";

export type WorldSliceKind = "players" | "social" | "career-registry";

export interface WorldSliceRefs {
  players: string;
  social: string;
  careerRegistry: string;
}

export interface SnapshotRecord {
  id: string;
  careerId: string;
  revision: number;
  schemaVersion: number;
  checksum: string;
  createdAt: string;
  /**
   * Version 1 snapshots contain a complete CareerSave. Version 2 snapshots keep
   * the large autonomous-world collections in content-addressed slices.
   */
  state: unknown;
  worldSlices?: WorldSliceRefs | undefined;
}

export interface WorldSliceRecord {
  id: string;
  careerId: string;
  kind: WorldSliceKind;
  checksum: string;
  createdAt: string;
  data: unknown;
}

interface SettingsRecord {
  key: string;
  value: unknown;
}

interface MigrationLogRecord {
  id?: number;
  careerId: string;
  createdAt: string;
  status: "success" | "failure";
  message: string;
}

interface ProspectDatabase extends DBSchema {
  careerIndex: {
    key: string;
    value: CareerIndexRecord;
    indexes: { "by-updatedAt": string };
  };
  careerSnapshots: {
    key: string;
    value: SnapshotRecord;
    indexes: { "by-careerId": string; "by-career-revision": [string, number] };
  };
  autosaveBackups: {
    key: string;
    value: SnapshotRecord;
    indexes: { "by-careerId": string; "by-career-revision": [string, number] };
  };
  manualSaves: {
    key: string;
    value: SnapshotRecord;
    indexes: { "by-careerId": string; "by-career-revision": [string, number] };
  };
  careerWorldSlices: {
    key: string;
    value: WorldSliceRecord;
    indexes: { "by-careerId": string; "by-career-kind": [string, WorldSliceKind] };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
  migrationLog: {
    key: number;
    value: MigrationLogRecord;
    indexes: { "by-careerId": string };
  };
}

let databasePromise: Promise<IDBPDatabase<ProspectDatabase>> | undefined;

function createVersionOneStores(database: IDBPDatabase<ProspectDatabase>): void {
  const careerIndex = database.createObjectStore("careerIndex", { keyPath: "id" });
  careerIndex.createIndex("by-updatedAt", "updatedAt");

  const snapshots = database.createObjectStore("careerSnapshots", { keyPath: "id" });
  snapshots.createIndex("by-careerId", "careerId");
  snapshots.createIndex("by-career-revision", ["careerId", "revision"]);

  const backups = database.createObjectStore("autosaveBackups", { keyPath: "id" });
  backups.createIndex("by-careerId", "careerId");
  backups.createIndex("by-career-revision", ["careerId", "revision"]);

  const manualSaves = database.createObjectStore("manualSaves", { keyPath: "id" });
  manualSaves.createIndex("by-careerId", "careerId");
  manualSaves.createIndex("by-career-revision", ["careerId", "revision"]);

  database.createObjectStore("settings", { keyPath: "key" });

  const migrationLog = database.createObjectStore("migrationLog", {
    keyPath: "id",
    autoIncrement: true,
  });
  migrationLog.createIndex("by-careerId", "careerId");
}

export function getDatabase(): Promise<IDBPDatabase<ProspectDatabase>> {
  databasePromise ??= openDB<ProspectDatabase>("prospect-db", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) createVersionOneStores(database);
      if (oldVersion < 2) {
        const slices = database.createObjectStore("careerWorldSlices", { keyPath: "id" });
        slices.createIndex("by-careerId", "careerId");
        slices.createIndex("by-career-kind", ["careerId", "kind"]);
      }
    },
  });

  return databasePromise;
}

export type { ProspectDatabase };
