import { describe, expect, it } from "vitest";
import { advanceWorldAgency } from "./agency";
import { createStabilitySave } from "./stabilityTestUtils";
import { careerSaveSchema } from "../../../storage/saves/schema";
import type { EcosystemAgencyState, EcosystemPlayer, EcosystemSocialState, EcosystemTeam } from "./types";

function date(day: number) {
  return { year: 2026, month: 9, day };
}

function stressedCulture(social: EcosystemSocialState, teamId: string): EcosystemSocialState {
  return {
    ...social,
    teamCultures: social.teamCultures.map((culture) => culture.teamId === teamId ? {
      ...culture,
      conflict: 100,
      coachTrust: 5,
      morale: 28,
      stability: 24,
    } : culture),
  };
}

function stressedPlayer(player: EcosystemPlayer): EcosystemPlayer {
  return {
    ...player,
    depthRank: 4,
    overall: Math.max(84, player.overall),
    potential: Math.max(92, player.potential),
    status: "backup",
    usagePlan: "developmental",
    form: 10,
    tactical: { ...player.tactical, schemeFit: 5, roleFit: 10 },
    transferStatus: "none",
    eligibilityYears: Math.max(2, player.eligibilityYears),
  };
}

function losingTeam(team: EcosystemTeam): EcosystemTeam {
  return {
    ...team,
    wins: 0,
    losses: 8,
    rating: Math.min(team.rating, 58),
    expectation: Math.max(team.expectation, 82),
    resources: { ...team.resources, financialPressure: 92, boardPatience: 18 },
    tactical: { ...team.tactical, installation: 35, continuity: 30 },
  };
}

describe("autonomous agency and consequences", () => {
  it("escalates a role conflict into a real portal entry for an NPC", () => {
    const save = createStabilitySave("agency-player-portal");
    const original = save.world.players.find((player) => player.level === "college" && !player.isHero && player.eligibilityYears > 1)!;
    const player = stressedPlayer(original);
    const team = save.world.teams.find((item) => item.id === player.teamId)!;
    let teams = save.world.teams.map((item) => item.id === team.id ? losingTeam(item) : item);
    let players = save.world.players.map((item) => item.id === player.id
      ? player
      : item.teamId === team.id
        ? { ...item, depthRank: 1, status: "starter" as const, usagePlan: "starter" as const, form: 92, tactical: { ...item.tactical, schemeFit: 96 } }
        : item);
    let coaches = save.world.coaches;
    let social = stressedCulture(save.world.social, team.id);
    let agency: EcosystemAgencyState = { ...save.world.agency, lastProcessedSeasonYear: 2026, lastProcessedWeek: 1 };

    const run = (week: number) => advanceWorldAgency({
      agency,
      history: save.world.worldHistory,
      teams,
      players,
      coaches,
      social,
      seasonYear: 2026,
      week,
      date: date(week),
      worldSeed: save.meta.worldSeed,
    });

    const concern = run(2);
    agency = concern.agency; teams = concern.teams; players = concern.players; coaches = concern.coaches; social = concern.social;
    expect(agency.conflicts.some((conflict) => conflict.actorId === player.id && conflict.stage === "concern")).toBe(true);

    const meeting = run(3);
    agency = meeting.agency; teams = meeting.teams; players = meeting.players; coaches = meeting.coaches; social = meeting.social;
    expect(meeting.agency.decisions.some((decision) => decision.actorId === player.id && decision.kind === "player-role-push")).toBe(true);
    expect(meeting.players.find((item) => item.id === player.id)?.depthRank).toBe(player.depthRank - 1);
    const roomRanks = meeting.players
      .filter((item) => item.teamId === player.teamId && item.position === player.position)
      .map((item) => item.depthRank)
      .sort((left, right) => left - right);
    expect(roomRanks).toEqual(roomRanks.map((_, index) => index + 1));

    const ultimatum = run(4);
    expect(ultimatum.agency.decisions.some((decision) => decision.actorId === player.id && decision.kind === "player-portal-entry")).toBe(true);
    expect(ultimatum.players.find((item) => item.id === player.id)?.transferStatus).toBe("portal");
    expect(ultimatum.transactions.some((transaction) => transaction.kind === "portal-entry" && transaction.playerId === player.id)).toBe(true);

    let sameSeason = ultimatum;
    for (const week of [5, 6, 7, 8]) {
      sameSeason = advanceWorldAgency({
        agency: sameSeason.agency,
        history: save.world.worldHistory,
        teams: sameSeason.teams,
        players: sameSeason.players,
        coaches: sameSeason.coaches,
        social: sameSeason.social,
        seasonYear: 2026,
        week,
        date: date(week),
        worldSeed: save.meta.worldSeed,
      });
    }
    expect(sameSeason.agency.conflicts.filter((conflict) => conflict.actorId === player.id && conflict.createdSeasonYear === 2026)).toHaveLength(1);
  });

  it("forces losing programs to change roster strategy and tactics", () => {
    const save = createStabilitySave("agency-team-direction");
    const selected = save.world.teams.find((team) => team.level === "college")!;
    let teams = save.world.teams.map((team) => team.id === selected.id ? losingTeam(team) : team);
    let players = save.world.players;
    let coaches = save.world.coaches;
    let social = stressedCulture(save.world.social, selected.id);
    let agency: EcosystemAgencyState = { ...save.world.agency, lastProcessedSeasonYear: 2026, lastProcessedWeek: 1 };

    for (const week of [2, 3, 4]) {
      const result = advanceWorldAgency({ agency, history: save.world.worldHistory, teams, players, coaches, social, seasonYear: 2026, week, date: date(week), worldSeed: save.meta.worldSeed });
      agency = result.agency; teams = result.teams; players = result.players; coaches = result.coaches; social = result.social;
    }

    const team = teams.find((item) => item.id === selected.id)!;
    expect(agency.decisions.some((decision) => decision.actorId === selected.id && decision.kind === "team-roster-reset")).toBe(true);
    expect(agency.decisions.some((decision) => decision.actorId === selected.id && decision.kind === "team-tactical-shift")).toBe(true);
    expect(team.rosterPlan.strategy).toBe("rebuild");
    expect(team.tactical.tempo).toBe("fast");
    expect(team.tactical.continuity).toBeLessThan(selected.tactical.continuity);
  });


  it("keeps absolute timeline weeks valid across long careers", () => {
    const save = createStabilitySave("agency-long-timeline");
    const record = save.world.careerRegistry.records[0]!;
    const parsed = careerSaveSchema.safeParse({
      ...save,
      world: {
        ...save.world,
        careerRegistry: {
          ...save.world.careerRegistry,
          records: save.world.careerRegistry.records.map((item, index) => index !== 0 ? item : {
            ...record,
            events: [...record.events, {
              id: "long-timeline-event",
              seasonYear: 2046,
              week: 640,
              kind: "transferred" as const,
              detail: "Долгая карьера сохраняет абсолютный номер недели.",
              fromTeamId: record.currentTeamId,
              toTeamId: record.currentTeamId,
            }],
          }),
        },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("is deterministic and never sends the hero into the portal automatically", () => {
    const save = createStabilitySave("agency-determinism");
    const hero = save.world.players.find((player) => player.isHero)!;
    const team = save.world.teams.find((item) => item.id === hero.teamId)!;
    const players = save.world.players.map((player) => player.id === hero.id ? stressedPlayer(player) : player);
    const teams = save.world.teams.map((item) => item.id === team.id ? losingTeam(item) : item);
    const social = stressedCulture(save.world.social, team.id);
    const run = () => advanceWorldAgency({
      agency: { ...save.world.agency, lastProcessedSeasonYear: 2026, lastProcessedWeek: 1 },
      history: save.world.worldHistory,
      teams,
      players,
      coaches: save.world.coaches,
      social,
      seasonYear: 2026,
      week: 2,
      date: date(2),
      worldSeed: save.meta.worldSeed,
    });
    expect(run()).toEqual(run());

    let result = run();
    for (const week of [3, 4, 5]) {
      result = advanceWorldAgency({
        agency: result.agency,
        history: save.world.worldHistory,
        teams: result.teams,
        players: result.players,
        coaches: result.coaches,
        social: result.social,
        seasonYear: 2026,
        week,
        date: date(week),
        worldSeed: save.meta.worldSeed,
      });
    }
    expect(result.players.find((player) => player.id === hero.id)?.transferStatus).not.toBe("portal");
    expect(result.agency.decisions.some((decision) => decision.actorId === hero.id && decision.kind === "player-portal-entry")).toBe(false);
  });
});
