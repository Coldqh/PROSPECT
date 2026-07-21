import type { SportDescriptor } from "../../core/sports/types";
import { createFootballCareerState } from "./career/createFootballCareer";
import type { FootballCareerSetup } from "./career/types";

export const descriptor: SportDescriptor = {
  id: "american-football",
  name: "American Football",
  shortName: "Football",
  status: "available",
  accent: "#c9182a",
  summary: "Школьный сезон, depth chart, матчи и рекрутинг колледжей.",
};

export function createInitialState(worldSeed: string, setup: unknown): unknown {
  return createFootballCareerState(worldSeed, setup as FootballCareerSetup);
}

export type { FootballCareerSetup, FootballCareerState, FootballPosition } from "./career/types";
