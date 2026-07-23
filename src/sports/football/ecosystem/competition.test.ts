import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballEcosystem } from "./createEcosystem";
import { simulateCompetitionPostseason, simulateCompetitionWeek } from "./competition";

function createWorld(seed = "competition-test") {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  return createFootballEcosystem(seed, generated.character, generated.football, { year: 2026, month: 8, day: 17 });
}

describe("football competition ecosystem", () => {
  it("creates a coherent ten-week national schedule", () => {
    const world = createWorld();
    expect(world.competition.schedule).toHaveLength(120);
    for (let week = 1; week <= 10; week += 1) {
      const games = world.competition.schedule.filter((game) => game.week === week);
      const participants = games.flatMap((game) => [game.homeTeamId, game.awayTeamId]);
      expect(games).toHaveLength(12);
      expect(new Set(participants).size).toBe(24);
    }
    expect(world.competition.rivalries).toHaveLength(12);
    expect(world.competition.rankings).toHaveLength(24);
  });

  it("simulates one week with equal wins and losses and updates rankings", () => {
    const world = createWorld("competition-week");
    const result = simulateCompetitionWeek(
      world.competition,
      world.teams,
      world.players,
      world.coaches,
      2026,
      1,
      new SeededRandom("competition-week:round"),
    );
    const collegeTeams = result.teams.filter((team) => team.level === "college");
    expect(result.playedTeamIds).toHaveLength(24);
    expect(collegeTeams.reduce((sum, team) => sum + team.wins, 0)).toBe(12);
    expect(collegeTeams.reduce((sum, team) => sum + team.losses, 0)).toBe(12);
    expect(result.competition.rankings[0]?.week).toBe(1);
    expect(result.competition.awards.some((award) => award.kind === "player-of-week")).toBe(true);
    expect(result.competition.schedule.filter((game) => game.week === 1 && game.status === "complete")).toHaveLength(12);
  });

  it("runs conference championships and an eight-team playoff to a champion", () => {
    let world = createWorld("competition-postseason");
    let teams = world.teams;
    let coaches = world.coaches;
    let competition = world.competition;
    let conferences = world.conferences;

    for (let week = 1; week <= 10; week += 1) {
      const result = simulateCompetitionWeek(competition, teams, world.players, coaches, 2026, week, new SeededRandom(`regular:${week}`));
      competition = result.competition;
      teams = result.teams;
      coaches = result.coaches;
    }

    for (let stage = 0; stage < 4; stage += 1) {
      const result = simulateCompetitionPostseason(competition, teams, world.players, coaches, conferences, new SeededRandom(`postseason:${stage}`));
      competition = result.competition;
      teams = result.teams;
      coaches = result.coaches;
      conferences = result.conferences;
    }

    expect(competition.playoff.stage).toBe("complete");
    expect(competition.playoff.seedTeamIds).toHaveLength(8);
    expect(competition.playoff.championTeamId).toBeTruthy();
    expect(competition.schedule.filter((game) => game.kind === "conference-championship" && game.status === "complete")).toHaveLength(4);
    expect(competition.schedule.filter((game) => game.kind === "playoff" && game.status === "complete")).toHaveLength(7);
    expect(competition.schedule.filter((game) => game.kind === "bowl" && game.status === "complete")).toHaveLength(4);
    expect(conferences.every((conference) => conference.champions.some((champion) => champion.seasonYear === 2026))).toBe(true);
    expect(competition.awards.some((award) => award.kind === "national-player")).toBe(true);
    expect(competition.programLegacies.some((legacy) => legacy.nationalTitles === 1)).toBe(true);
  });

  it("is deterministic for the same world and seed", () => {
    const left = createWorld("competition-deterministic");
    const right = createWorld("competition-deterministic");
    const leftResult = simulateCompetitionWeek(left.competition, left.teams, left.players, left.coaches, 2026, 1, new SeededRandom("same"));
    const rightResult = simulateCompetitionWeek(right.competition, right.teams, right.players, right.coaches, 2026, 1, new SeededRandom("same"));
    expect(leftResult).toEqual(rightResult);
  });
});
