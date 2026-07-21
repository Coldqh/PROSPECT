export type SportId = "american-football" | "basketball";

export interface SportDescriptor {
  id: SportId;
  name: string;
  shortName: string;
  status: "available" | "planned";
  accent: string;
  summary: string;
}

export interface SportModule {
  descriptor: SportDescriptor;
  createInitialState(worldSeed: string, setup: unknown): unknown;
}
