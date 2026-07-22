import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballEcosystem } from "./createEcosystem";
import { reviewRosterManagement } from "./rosterManagement";
import type { EcosystemPlayer, EcosystemTeam } from "./types";

function createFixture(seed = "roster-management") {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const world = createFootballEcosystem(seed, generated.character, generated.football, { year: 2026, month: 8, day: 17 });
  const team = world.teams.find((candidate) => candidate.level === "college");
  if (!team) throw new Error("No college team generated");
  return { world, team };
}

function criticalRoomFixture(team: EcosystemTeam, players: EcosystemPlayer[]) {
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const scholarshipCandidate = teamPlayers[0];
  const redshirtCandidate = teamPlayers[1];
  const changeCandidate = teamPlayers[2];
  const surplusIds = new Set(teamPlayers.slice(2, 7).map((player) => player.id));
  if (!scholarshipCandidate || !redshirtCandidate || !changeCandidate) throw new Error("Roster fixture lacks candidates");

  const nextPlayers = players
    .filter((player) => player.teamId !== team.id || player.position !== "CB")
    .map((player) => {
      if (player.id === scholarshipCandidate.id) {
        return {
          ...player,
          position: "WR" as const,
          overall: 82,
          depthRank: 1,
          status: "starter" as const,
          eligibility: { ...player.eligibility, scholarshipStatus: "none" as const },
        };
      }
      if (player.id === redshirtCandidate.id) {
        return {
          ...player,
          position: "RB" as const,
          classYear: "Freshman" as const,
          depthRank: 3,
          eligibility: {
            ...player.eligibility,
            model: "legacy-four-in-five" as const,
            redshirtUsed: false,
            athleticallyEligible: true,
          },
        };
      }
      if (surplusIds.has(player.id)) {
        return {
          ...player,
          position: "WR" as const,
          classYear: "Sophomore" as const,
          depthRank: player.id === changeCandidate.id ? 4 : Math.max(3, player.depthRank),
          potential: player.id === changeCandidate.id ? 90 : player.potential,
          form: player.id === changeCandidate.id ? 78 : player.form,
        };
      }
      return player;
    });

  const detailedRoster = nextPlayers.filter((player) => player.teamId === team.id);
  const nextTeam: EcosystemTeam = {
    ...team,
    rosterIds: detailedRoster.map((player) => player.id),
    compliance: {
      ...team.compliance,
      fundedScholarships: Math.max(10, team.compliance.fundedScholarships),
      estimatedRosterSize: Math.min(team.compliance.rosterLimit - 8, detailedRoster.length + 70),
      scholarshipsUsed: 0,
      status: "clear",
    },
  };
  return { nextPlayers, nextTeam, scholarshipCandidate, redshirtCandidate, changeCandidate };
}

describe("multi-year roster management", () => {
  it("builds the same three-year plan for the same world seed", () => {
    const { world } = createFixture("stable-roster-plan");
    const run = () => reviewRosterManagement(
      world.teams,
      world.players,
      world.coaches,
      world.constitution,
      2026,
      3,
      new SeededRandom("stable-roster-plan:review"),
      { applyOffseasonDecisions: false, reason: "Плановая оценка состава." },
    );
    expect(run()).toEqual(run());
    expect(run().teams.filter((team) => team.level === "college").every((team) => team.rosterPlan.planningHorizonYears === 3)).toBe(true);
  });

  it("reserves class space and applies redshirt, aid and a critical position change", () => {
    const { world, team } = createFixture("critical-roster-plan");
    const fixture = criticalRoomFixture(team, world.players);
    const teams = world.teams.map((candidate) => candidate.id === team.id ? fixture.nextTeam : candidate);
    const result = reviewRosterManagement(
      teams,
      fixture.nextPlayers,
      world.coaches,
      world.constitution,
      2027,
      1,
      new SeededRandom("critical-roster-plan:offseason"),
      { applyOffseasonDecisions: true, reason: "Зимняя оценка перед новым набором." },
    );
    const plannedTeam = result.teams.find((candidate) => candidate.id === team.id);
    if (!plannedTeam) throw new Error("Planned team missing");
    const appliedChange = plannedTeam.rosterPlan.positionChanges.find((change) => change.applied);
    const changed = appliedChange ? result.players.find((player) => player.id === appliedChange.playerId) : undefined;
    const scholar = result.players.find((player) => player.id === fixture.scholarshipCandidate.id);
    const redshirted = result.players.filter((player) => plannedTeam.rosterPlan.redshirtPlayerIds.includes(player.id));

    expect(plannedTeam.rosterPlan.positionProjections.CB.targetAdds).toBeGreaterThan(0);
    expect(plannedTeam.rosterPlan.targetClassSize).toBeGreaterThan(0);
    expect(appliedChange?.toPosition).toBe("CB");
    expect(changed?.position).toBe("CB");
    expect(changed?.positionHistory).toContain(appliedChange?.fromPosition);
    expect(scholar?.eligibility.scholarshipStatus).toBe("full");
    expect(redshirted.length).toBeGreaterThan(0);
    expect(redshirted.every((player) => player.usagePlan === "redshirt")).toBe(true);
    expect(result.drafts.some((draft) => draft.kind === "position-change")).toBe(true);
    expect(result.drafts.some((draft) => draft.kind === "scholarship")).toBe(true);
    expect(result.drafts.some((draft) => draft.kind === "redshirt")).toBe(true);
  });
});
