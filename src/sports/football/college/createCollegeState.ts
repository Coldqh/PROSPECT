import type { FootballCollegeState } from "./types";

export function createInitialCollegeState(): FootballCollegeState {
  return {
    moduleVersion: 1,
    status: "high-school",
    positionRoom: [],
  };
}
