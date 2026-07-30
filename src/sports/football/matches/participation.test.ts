import { describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballPosition } from "../career/types";
import { expectedHeroSnapShare, heroParticipationForSnap, type HeroParticipationRole } from "./participation";
import type { FootballMatchState, MatchPlayCall } from "./types";

const offenseCall: MatchPlayCall = {
  id: "offense-11",
  playType: "pass",
  formation: "Shotgun",
  personnel: "11",
  concept: "verticals",
  strength: "right",
  calledBy: "offensive-coordinator",
  canCheck: true,
  aggression: 55,
  progression: ["X", "Z", "TE", "RB"],
  tags: ["deep"],
};
const defenseCall: MatchPlayCall = {
  id: "defense-nickel",
  playType: "coverage",
  formation: "Nickel",
  personnel: "4-2-5",
  concept: "cover-3",
  strength: "middle",
  calledBy: "defensive-coordinator",
  canCheck: true,
  aggression: 45,
  progression: [],
  tags: ["zone"],
};

function state(position: FootballPosition, role: HeroParticipationRole, fatigue = 10): { save: CareerSave; match: FootballMatchState } {
  const save = {
    meta: { worldSeed: `participation-${position}-${role}`, phase: "professional-career" },
    football: {
      position,
      depthChart: { rank: role === "starter" ? 1 : role === "rotation" ? 2 : 3 },
      professional: { heroCareer: { role } },
    },
  } as unknown as CareerSave;
  const match = {
    gameId: `game-${position}-${role}`,
    rosterRole: role,
    quarter: 2,
    heroScore: 7,
    opponentScore: 7,
    heroFatigue: fatigue,
  } as FootballMatchState;
  return { save, match };
}

function activeSnaps(position: FootballPosition, role: HeroParticipationRole, count = 400): number {
  const { save, match } = state(position, role);
  let active = 0;
  for (let index = 0; index < count; index += 1) {
    active += Number(heroParticipationForSnap(save, match, offenseCall, defenseCall, true, index).active);
  }
  return active;
}

describe("dynamic match participation", () => {
  it("gives starters, rotations and deep reserves distinct package shares", () => {
    const starter = activeSnaps("WR", "starter");
    const rotation = activeSnaps("WR", "rotation");
    const reserve = activeSnaps("WR", "special-teams");
    expect(starter).toBeGreaterThan(rotation);
    expect(rotation).toBeGreaterThan(reserve);
    expect(reserve).toBeGreaterThan(0);
  });

  it("keeps inactive and practice-squad players out of every package", () => {
    expect(activeSnaps("EDGE", "inactive")).toBe(0);
    expect(activeSnaps("EDGE", "practice-squad")).toBe(0);
  });

  it("rests tired players without replacing role logic with a fixed quota", () => {
    const fresh = state("LB", "starter", 10);
    const tired = state("LB", "starter", 90);
    const freshShare = expectedHeroSnapShare(fresh.save, fresh.match, offenseCall, defenseCall, true);
    const tiredShare = expectedHeroSnapShare(tired.save, tired.match, offenseCall, defenseCall, true);
    expect(freshShare).toBeGreaterThan(tiredShare);
  });

  it("removes a player when the called personnel does not contain the position", () => {
    const { save, match } = state("TE", "starter");
    expect(heroParticipationForSnap(save, match, offenseCall, defenseCall, false, 1)).toMatchObject({ active: false, expectedShare: 0, reason: "package-mismatch" });
  });
});
