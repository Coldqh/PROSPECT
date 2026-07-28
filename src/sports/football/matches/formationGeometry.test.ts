import { describe, expect, it } from "vitest";
import { buildSnapAssignments } from "./playbook";
import { createLivePlayEngine, liveFieldViewport, liveWorldToFieldYard } from "./realTimeEngine";
import type { MatchEpisode, MatchPlayCall } from "./types";

function offenseCall(formation: string): MatchPlayCall {
  return {
    id: `offense-${formation}`,
    formation,
    personnel: "11",
    concept: "Mesh",
    playType: "pass",
    strength: "middle",
    calledBy: "offensive-coordinator",
    canCheck: false,
    aggression: 50,
    primarySlot: "H",
    progression: ["H", "Y", "RB", "X", "Z"],
    tags: ["short"],
  };
}

function defenseCall(formation: string): MatchPlayCall {
  return {
    id: `defense-${formation}`,
    formation,
    personnel: "Nickel",
    concept: "Cover 2 Man",
    playType: "coverage",
    strength: "middle",
    calledBy: "defensive-coordinator",
    canCheck: false,
    aggression: 50,
    progression: [],
    tags: ["man", "two-high"],
  };
}

function episode(assignments: ReturnType<typeof buildSnapAssignments>): MatchEpisode {
  return {
    id: "geometry-episode",
    driveId: "geometry-drive",
    possession: "opponent",
    unit: "defense",
    position: "S",
    quarter: 1,
    clockSeconds: 441,
    playClockSeconds: 25,
    down: 3,
    distance: 10,
    fieldPosition: 48,
    scoreMargin: 0,
    title: "Formation geometry",
    situation: "3rd & 10",
    assignment: "Keep the roof",
    read: "Read QB",
    playCall: offenseCall("Gun Doubles"),
    opponentCall: defenseCall("Dime"),
    heroInvolvement: "secondary",
    heroRole: "Deep half",
    heroSlot: "FS",
    assignments,
    options: [],
  };
}

describe("real-yard formation geometry", () => {
  it("places every unit at realistic depth from the line of scrimmage", () => {
    const offenseFormations = ["Gun Trips", "Gun Doubles", "Singleback Ace", "Pistol Strong", "Empty", "Goal Line"];
    const defenseFormations = ["4–3 Over", "4–3 Under", "Nickel 4–2–5", "3–4 Odd", "Dime", "Bear Front", "Goal Line"];

    for (const offenseFormation of offenseFormations) {
      for (const defenseFormation of defenseFormations) {
        const assignments = buildSnapAssignments(
          offenseCall(offenseFormation),
          defenseCall(defenseFormation),
          "opponent",
          "defense",
          "S",
          `${offenseFormation}-${defenseFormation}`,
        );
        const center = assignments.find((player) => player.unit === "offense" && player.slot === "C");
        const quarterback = assignments.find((player) => player.unit === "offense" && player.slot === "QB");
        expect(center).toBeDefined();
        expect(quarterback).toBeDefined();
        const lineY = center!.start.y;

        for (const lineman of assignments.filter((player) => player.unit === "offense" && ["OT", "OG", "C"].includes(player.position))) {
          expect(Math.abs(lineman.start.y - lineY)).toBeLessThanOrEqual(0.4);
        }
        expect(quarterback!.start.y - lineY).toBeGreaterThanOrEqual(0.7);
        expect(quarterback!.start.y - lineY).toBeLessThanOrEqual(5.2);

        for (const defender of assignments.filter((player) => player.unit === "defense")) {
          const depth = lineY - defender.start.y;
          if (["EDGE", "DT"].includes(defender.position)) {
            expect(depth).toBeGreaterThanOrEqual(0.4);
            expect(depth).toBeLessThanOrEqual(1.1);
          } else if (defender.position === "LB") {
            expect(depth).toBeGreaterThanOrEqual(3.2);
            expect(depth).toBeLessThanOrEqual(6);
          } else if (defender.position === "CB") {
            expect(depth).toBeGreaterThanOrEqual(1.2);
            expect(depth).toBeLessThanOrEqual(4.8);
          } else if (defender.position === "S") {
            expect(depth).toBeGreaterThanOrEqual(9);
            expect(depth).toBeLessThanOrEqual(15);
          }
        }
      }
    }
  });

  it("centers the pre-snap camera on the play instead of a deep defender", () => {
    const assignments = buildSnapAssignments(
      offenseCall("Gun Doubles"),
      defenseCall("Dime"),
      "opponent",
      "defense",
      "S",
      "camera-geometry",
    );
    const state = createLivePlayEngine(episode(assignments), "S", "camera-geometry");
    const viewport = liveFieldViewport(state);
    const quarterback = state.players.find((player) => player.slot === "QB" && player.unit === "offense");
    const hero = state.players.find((player) => player.isHero);
    expect(quarterback).toBeDefined();
    expect(hero).toBeDefined();
    for (const player of [quarterback!, hero!]) {
      const fieldYard = liveWorldToFieldYard(state, player.y);
      expect(fieldYard).toBeGreaterThanOrEqual(viewport.lowFieldYard);
      expect(fieldYard).toBeLessThanOrEqual(viewport.highFieldYard);
    }
  });
});
