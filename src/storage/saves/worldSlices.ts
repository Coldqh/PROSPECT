import type { CareerSave } from "./schema";
import { createChecksum } from "./checksum";
import type { WorldSliceKind, WorldSliceRecord, WorldSliceRefs } from "../indexedDb/database";

export interface CareerWorldSlices {
  players: CareerSave["world"]["players"];
  social: CareerSave["world"]["social"];
  careerRegistry: CareerSave["world"]["careerRegistry"];
}

export function extractCareerWorldSlices(save: CareerSave): CareerWorldSlices {
  return {
    players: save.world.players,
    social: save.world.social,
    careerRegistry: save.world.careerRegistry,
  };
}

export function compactCareerSave(save: CareerSave): unknown {
  return {
    ...save,
    world: {
      ...save.world,
      players: [],
      social: undefined,
      careerRegistry: undefined,
    },
  };
}

export function hydrateCareerSave(state: unknown, slices: CareerWorldSlices): CareerSave {
  const compact = state as CareerSave;
  return {
    ...compact,
    world: {
      ...compact.world,
      players: slices.players,
      social: slices.social,
      careerRegistry: slices.careerRegistry,
    },
  };
}

function sliceId(careerId: string, kind: WorldSliceKind, checksum: string): string {
  return `${careerId}:${kind}:${checksum}`;
}

export function createWorldSliceRecords(save: CareerSave): {
  refs: WorldSliceRefs;
  records: WorldSliceRecord[];
} {
  const slices = extractCareerWorldSlices(save);
  const definitions: Array<{ kind: WorldSliceKind; data: unknown }> = [
    { kind: "players", data: slices.players },
    { kind: "social", data: slices.social },
    { kind: "career-registry", data: slices.careerRegistry },
  ];
  const records = definitions.map(({ kind, data }) => {
    const checksum = createChecksum(data);
    return {
      id: sliceId(save.meta.id, kind, checksum),
      careerId: save.meta.id,
      kind,
      checksum,
      createdAt: save.meta.updatedAt,
      data,
    } satisfies WorldSliceRecord;
  });
  const byKind = new Map(records.map((record) => [record.kind, record.id]));
  return {
    refs: {
      players: byKind.get("players")!,
      social: byKind.get("social")!,
      careerRegistry: byKind.get("career-registry")!,
    },
    records,
  };
}

export function decodeWorldSlices(records: readonly WorldSliceRecord[]): CareerWorldSlices | undefined {
  const players = records.find((record) => record.kind === "players");
  const social = records.find((record) => record.kind === "social");
  const careerRegistry = records.find((record) => record.kind === "career-registry");
  if (!players || !social || !careerRegistry) return undefined;
  if (players.checksum !== createChecksum(players.data)) return undefined;
  if (social.checksum !== createChecksum(social.data)) return undefined;
  if (careerRegistry.checksum !== createChecksum(careerRegistry.data)) return undefined;
  return {
    players: players.data as CareerWorldSlices["players"],
    social: social.data as CareerWorldSlices["social"],
    careerRegistry: careerRegistry.data as CareerWorldSlices["careerRegistry"],
  };
}
