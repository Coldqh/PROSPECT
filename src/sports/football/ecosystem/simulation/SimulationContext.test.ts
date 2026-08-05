import { describe, expect, it } from "vitest";
import { createFootballCareerState, createLegacyFootballSetup } from "../../career/createFootballCareer";
import { createFootballEcosystem } from "../createEcosystem";
import { createSimulationContext } from "./SimulationContext";

describe("SimulationContext", () => {
  it("indexes teams, rosters and staffs without changing source order", () => {
    const seed = "simulation-context";
    const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
    const world = createFootballEcosystem(
      seed,
      generated.character,
      generated.football,
      { year: 2026, month: 8, day: 17 },
    );
    const context = createSimulationContext(world.teams, world.players, world.coaches);

    expect(context.teamById.size).toBe(world.teams.length);
    expect(context.playerById.size).toBe(world.players.length);

    for (const team of world.teams) {
      const expectedPlayers = world.players.filter((player) => player.teamId === team.id);
      const expectedCoaches = world.coaches.filter((coach) => coach.teamId === team.id);
      expect(context.playersByTeamId.get(team.id)).toEqual(expectedPlayers);
      expect(context.coachesByTeamId.get(team.id)).toEqual(expectedCoaches);
      expect(context.headCoachByTeamId.get(team.id)).toEqual(
        expectedCoaches.find((coach) => coach.role === "head-coach"),
      );
    }
  });
});
