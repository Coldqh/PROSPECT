import type { SportDescriptor } from "../../core/sports/types";

export const descriptor: SportDescriptor = {
  id: "american-football",
  name: "American Football",
  shortName: "Football",
  status: "available",
  accent: "#d8ff3e",
  summary: "Школьный сезон, depth chart, матчи и рекрутинг колледжей.",
};

export interface FootballFoundationState {
  moduleVersion: 1;
  worldSeed: string;
  stage: "foundation";
}

export function createInitialState(worldSeed: string): FootballFoundationState {
  return {
    moduleVersion: 1,
    worldSeed,
    stage: "foundation",
  };
}
