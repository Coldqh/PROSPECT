import { describe, expect, it } from "vitest";
import { createCareerRegistry, registerProfessionalDraftClass, syncCareerRegistry } from "./lifecycle";
import type { EcosystemPlayer, EcosystemTeam, EcosystemTransaction } from "./types";
import type { ProfessionalDraftSelection, ProfessionalProspect, ProfessionalRosterPlayer } from "../pro/types";

function player(): EcosystemPlayer {
  return {
    id: "player-1", name: "Marcus Reed", position: "WR", age: 22, overall: 79, potential: 88,
    teamId: "college-a", previousTeamIds: ["hs-a"], level: "college", classYear: "Senior",
    eligibilityYears: 1, seasonsPlayed: 4, status: "starter", depthRank: 1, health: 96, form: 82,
    trajectory: "surging", isHero: false,
    eligibility: { athleticallyEligible: true },
    tactical: { schemeFit: 80, learning: 84, roleFit: 82 },
    talent: { graduationYear: 2029, regionId: "region-a" },
  } as unknown as EcosystemPlayer;
}

const team = { id: "college-a", shortName: "A State", rosterIds: ["player-1"] } as EcosystemTeam;

describe("persistent player lifecycle", () => {
  it("moves the same player id from college graduation into the draft pool", () => {
    const initial = createCareerRegistry([player()], [team], 2029);
    const graduation: EcosystemTransaction = {
      id: "graduation:2029:player-1", kind: "graduation", seasonYear: 2029, week: 16,
      createdOn: { year: 2029, month: 12, day: 20 }, title: "Graduated", detail: "Marcus Reed completed college eligibility.",
      playerId: "player-1", fromTeamId: "college-a", relatedToHero: false,
    };
    const synced = syncCareerRegistry(initial, [], [team], [graduation], 2029, 16);
    expect(synced.records[0]?.playerId).toBe("player-1");
    expect(synced.records[0]?.currentStage).toBe("draft-pool");
    expect(synced.draftPoolIds).toContain("player-1");
  });

  it("keeps identity and history when a real graduate becomes a professional", () => {
    const registry = syncCareerRegistry(
      createCareerRegistry([player()], [team], 2029), [], [team], [{
        id: "graduation:2029:player-1", kind: "graduation", seasonYear: 2029, week: 16,
        createdOn: { year: 2029, month: 12, day: 20 }, title: "Graduated", detail: "Graduated.",
        playerId: "player-1", fromTeamId: "college-a", relatedToHero: false,
      }], 2029, 16,
    );
    const prospect: ProfessionalProspect = {
      id: "prospect:player-1", sourcePlayerId: "player-1", collegeTeamId: "college-a", previousTeamIds: ["hs-a"],
      seasonsPlayed: 4, declaredEarly: false, name: "Marcus Reed", position: "WR", collegeName: "A State", age: 22,
      overall: 79, potential: 88, production: 80, athleticScore: 84, medicalScore: 92, interviewScore: 78,
      draftGrade: 81, projectedRound: 2, isHero: false,
    };
    const selection: ProfessionalDraftSelection = {
      id: "pick-17", sourcePlayerId: "player-1", round: 2, pickInRound: 1, overallPick: 17,
      teamId: "pro-a", prospectId: prospect.id, prospectName: prospect.name, position: "WR", collegeName: "A State", grade: 81, isHero: false,
    };
    const rosterPlayer = {
      id: "pro-rookie:2030:player-1", sourcePlayerId: "player-1", teamId: "pro-a", position: "WR", name: "Marcus Reed",
      age: 22, overall: 80, potential: 88, health: 92, form: 70, depthRank: 4, yearsRemaining: 4,
      annualSalary: 1100000, guaranteedRemaining: 1000000, status: "active", availability: "active", injuryWeeks: 0, isHero: false,
    } as ProfessionalRosterPlayer;
    const drafted = registerProfessionalDraftClass(registry, [prospect], [selection], [rosterPlayer], 2030);
    const record = drafted.records[0]!;
    expect(record.playerId).toBe("player-1");
    expect(record.currentStage).toBe("professional");
    expect(record.currentTeamId).toBe("pro-a");
    expect(record.collegeTeamIds).toContain("college-a");
    expect(record.events.some((event) => event.kind === "drafted")).toBe(true);
  });
});
