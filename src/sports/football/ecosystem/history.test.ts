import { describe, expect, it } from "vitest";
import { createStabilitySave } from "./stabilityTestUtils";
import { advanceWorldHistory } from "./history";
import type { EcosystemStory, EcosystemTransaction } from "./types";

describe("world history and emergent storylines", () => {
  it("turns only real simulation sources into facts, objectives and a persistent arc", () => {
    const save = createStabilitySave("world-history-facts");
    const player = save.world.players.find((item) => !item.isHero && item.depthRank <= 2)!;
    const team = save.world.teams.find((item) => item.id === player.teamId)!;
    const coach = save.world.coaches.find((item) => item.teamId === team.id && item.role === "head-coach")!;
    const date = save.meta.currentDate;
    const stories: EcosystemStory[] = [1, 2, 3].map((chapter) => ({
      id: `history-source:${chapter}`,
      kind: chapter === 1 ? "breakout" : chapter === 2 ? "depth-change" : "award",
      createdOn: date,
      week: chapter,
      title: `${player.name}: факт ${chapter}`,
      detail: `Подтверждённое событие ${chapter} для ${player.name}.`,
      importance: chapter === 3 ? 5 : 3,
      teamIds: [team.id],
      playerIds: [player.id],
      coachIds: [coach.id],
      relatedToHero: false,
    }));
    const transaction: EcosystemTransaction = {
      id: "history-transaction:1",
      kind: "scholarship-awarded",
      seasonYear: save.world.seasonYear,
      week: 3,
      createdOn: date,
      title: `${player.name} получил стипендию`,
      detail: "Решение зафиксировано рынком состава.",
      playerId: player.id,
      toTeamId: team.id,
      relatedToHero: false,
    };

    const first = advanceWorldHistory({
      history: save.world.worldHistory,
      teams: save.world.teams,
      players: save.world.players,
      coaches: save.world.coaches,
      stories,
      transactions: [transaction],
      seasonYear: save.world.seasonYear,
      week: 3,
      date,
    });

    expect(first.history.facts).toHaveLength(4);
    expect(first.history.facts.map((fact) => fact.sourceId)).toEqual([
      "history-source:1",
      "history-source:2",
      "history-source:3",
      "history-transaction:1",
    ]);
    const arc = first.history.arcs.find((item) => item.playerIds.includes(player.id) && item.kind === "player-rise");
    expect(arc?.chapters).toBe(4);
    expect(arc?.status).toBe("active");
    expect(arc?.summary).toContain(`${player.name}: факт 3`);
    expect(first.stories.some((story) => story.kind === "storyline" && story.playerIds.includes(player.id))).toBe(true);

    const repeated = advanceWorldHistory({
      history: first.history,
      teams: save.world.teams,
      players: save.world.players,
      coaches: save.world.coaches,
      stories,
      transactions: [transaction],
      seasonYear: save.world.seasonYear,
      week: 3,
      date,
    });
    expect(repeated.history.facts).toHaveLength(4);
    expect(repeated.stories).toHaveLength(0);
  });

  it("tracks autonomous goals for teams, head coaches and notable players", () => {
    const save = createStabilitySave("world-history-objectives");
    const objectives = save.world.worldHistory.objectives;
    expect(objectives.some((item) => item.ownerKind === "team")).toBe(true);
    expect(objectives.some((item) => item.ownerKind === "coach")).toBe(true);
    expect(objectives.some((item) => item.ownerKind === "player")).toBe(true);
    expect(new Set(objectives.map((item) => item.id)).size).toBe(objectives.length);
    expect(objectives.length).toBeLessThanOrEqual(420);
  });

  it("records one fact when a real move is emitted as both story and transaction", () => {
    const save = createStabilitySave("world-history-semantic-dedupe");
    const player = save.world.players.find((item) => item.level === "college" && !item.isHero)!;
    const team = save.world.teams.find((item) => item.id === player.teamId)!;
    const decisionId = "decision:player-portal-entry:test";
    const title = `${player.name} выходит в трансферный портал`;
    const story: EcosystemStory = {
      id: `agency-story:${decisionId}`,
      kind: "transfer",
      createdOn: save.meta.currentDate,
      week: 4,
      title,
      detail: "Игрок потребовал смену роли. Статус изменён на portal.",
      importance: 4,
      teamIds: [team.id],
      playerIds: [player.id],
      coachIds: [],
      relatedToHero: false,
    };
    const transaction: EcosystemTransaction = {
      id: `agency-transaction:${decisionId}`,
      kind: "portal-entry",
      seasonYear: save.world.seasonYear,
      week: 4,
      createdOn: save.meta.currentDate,
      title,
      detail: "Статус изменён на portal.",
      playerId: player.id,
      fromTeamId: team.id,
      relatedToHero: false,
    };
    const result = advanceWorldHistory({
      history: save.world.worldHistory,
      teams: save.world.teams,
      players: save.world.players,
      coaches: save.world.coaches,
      stories: [story],
      transactions: [transaction],
      seasonYear: save.world.seasonYear,
      week: 4,
      date: save.meta.currentDate,
    });
    expect(result.history.facts).toHaveLength(1);
    expect(result.history.facts[0]?.sourceType).toBe("transaction");
    expect(result.history.processedSourceIds).toContain(`story:${story.id}`);
    expect(result.history.processedSourceIds).toContain(`transaction:${transaction.id}`);
  });
});
