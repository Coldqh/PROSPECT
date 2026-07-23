import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballEcosystem } from "./createEcosystem";
import {
  playerSocialDevelopmentMultiplier,
  playerTransferPressure,
  simulateSocialWeek,
  teamSocialGameModifier,
} from "./social";

function createWorld(seed = "social-test") {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  return createFootballEcosystem(seed, generated.character, generated.football, { year: 2026, month: 8, day: 17 });
}

describe("football social ecosystem", () => {
  it("creates persistent team cultures and relationships for every program", () => {
    const world = createWorld();
    expect(world.social.teamCultures).toHaveLength(world.teams.length);
    expect(world.social.bonds.length).toBeGreaterThan(world.teams.length);
    expect(world.social.bonds.every((bond) => bond.active && Boolean(bond.teamId))).toBe(true);
    expect(world.social.bonds.some((bond) => bond.kind === "mentor")).toBe(true);
    expect(world.social.bonds.some((bond) => bond.kind === "coach-player")).toBe(true);
  });

  it("turns severe tension into an actual locker-room incident", () => {
    const world = createWorld("social-conflict");
    const target = world.social.bonds.find((bond) => bond.kind === "position-rival");
    expect(target).toBeDefined();
    const social = {
      ...world.social,
      bonds: world.social.bonds.map((bond) => bond.id === target?.id
        ? { ...bond, tension: 100, trust: 10, chemistry: 15 }
        : bond),
    };
    const result = simulateSocialWeek(
      social,
      world.teams.map((team) => team.id === target?.teamId ? { ...team, trend: "falling" as const } : team),
      world.players,
      world.coaches,
      world.seasonYear,
      2,
      7,
      new SeededRandom("social-conflict:week"),
    );
    expect(result.social.incidents.some((incident) => incident.kind === "locker-room-conflict" && incident.teamId === target?.teamId)).toBe(true);
    expect(result.stories.some((story) => story.kind === "locker-room-conflict")).toBe(true);
  });

  it("support improves development while isolation raises transfer pressure", () => {
    const world = createWorld("social-pressure");
    const player = world.players.find((item) => item.level === "college" && !item.isHero);
    expect(player).toBeDefined();
    const supportive = {
      ...world.social,
      bonds: world.social.bonds.map((bond) => bond.entityAId === player?.id || bond.entityBId === player?.id
        ? { ...bond, trust: 90, respect: 90, chemistry: 88, tension: 5 }
        : bond),
    };
    const hostile = {
      ...world.social,
      bonds: world.social.bonds.map((bond) => bond.entityAId === player?.id || bond.entityBId === player?.id
        ? { ...bond, trust: 18, respect: 28, chemistry: 16, tension: 88 }
        : bond),
    };
    expect(playerSocialDevelopmentMultiplier(supportive, player?.id ?? "")).toBeGreaterThan(playerSocialDevelopmentMultiplier(hostile, player?.id ?? ""));
    expect(playerTransferPressure(hostile, player?.id ?? "")).toBeGreaterThan(playerTransferPressure(supportive, player?.id ?? ""));
  });

  it("team culture changes match strength", () => {
    const world = createWorld("social-game");
    const culture = world.social.teamCultures[0];
    expect(culture).toBeDefined();
    const strong = {
      ...world.social,
      teamCultures: world.social.teamCultures.map((item) => item.teamId === culture?.teamId
        ? { ...item, cohesion: 90, morale: 90, leadership: 85, conflict: 5 }
        : item),
    };
    const broken = {
      ...world.social,
      teamCultures: world.social.teamCultures.map((item) => item.teamId === culture?.teamId
        ? { ...item, cohesion: 20, morale: 20, leadership: 25, conflict: 90 }
        : item),
    };
    expect(teamSocialGameModifier(strong, culture?.teamId ?? "")).toBeGreaterThan(teamSocialGameModifier(broken, culture?.teamId ?? ""));
  });

  it("deactivates old team bonds after a transfer and builds new ones", () => {
    const world = createWorld("social-transfer");
    const player = world.players.find((item) => item.level === "college" && !item.isHero);
    const targetTeam = world.teams.find((team) => team.level === "college" && team.id !== player?.teamId);
    expect(player).toBeDefined();
    expect(targetTeam).toBeDefined();
    const movedPlayers = world.players.map((item) => item.id === player?.id ? { ...item, teamId: targetTeam?.id ?? item.teamId } : item);
    const result = simulateSocialWeek(
      world.social,
      world.teams,
      movedPlayers,
      world.coaches,
      world.seasonYear,
      3,
      14,
      new SeededRandom("social-transfer:week"),
    );
    expect(result.social.bonds.some((bond) => !bond.active && (bond.entityAId === player?.id || bond.entityBId === player?.id))).toBe(true);
    expect(result.social.bonds.some((bond) => bond.active && bond.teamId === targetTeam?.id && (bond.entityAId === player?.id || bond.entityBId === player?.id))).toBe(true);
  });
});
