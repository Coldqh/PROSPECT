import { SeededRandom } from "../../../core/random/SeededRandom";
import type { EcosystemStory, EcosystemTransaction } from "./types";
import { addGameDays, isPlayerAvailable, resolveWorldCycle } from "./constitution";
import { simulateTalentCamps } from "./talent";
import { syncCareerRegistry } from "./lifecycle";
import { advanceWorldHistory } from "./history";
import { advanceWorldAgency } from "./agency";
import { reviewRosterManagement } from "./rosterManagement";
import { advanceUnifiedMovementMarket } from "./movementMarket";
import { simulateCompetitionPostseason, simulateCompetitionWeek } from "./competition";
import { resetSocialLookupCache, simulateSocialWeek } from "./social";
import type { EcosystemCareerState } from "./simulation/EcosystemCareerState";
import { createSimulationContext } from "./simulation/SimulationContext";
import { story } from "./simulation/story";
import { advanceTacticalInstallation, recalculateTeamStrength, reorderDepthCharts, syncEcosystemIntoFootball, syncHeroSeasonTeams, updatePlayersDaily, updateProgramResourcesWeekly } from "./simulation/dailySystems";
import { processOffseason, resetForNewSeason } from "./simulation/offseasonSystems";
import { buildDigest, market, updateHeroPrograms } from "./simulation/marketSystems";

export function advanceFootballEcosystem<T extends EcosystemCareerState>(save: T): T {
  resetSocialLookupCache();
  let world = save.world;
  let talentPipeline = world.talentPipeline;
  let programs = save.football.recruitment.programs;
  let movementMarket = world.movementMarket;
  let competition = world.competition;
  let social = world.social;
  let worldHistory = world.worldHistory;
  let agency = world.agency;
  const generatedStories: EcosystemStory[] = [];
  const generatedTransactions: EcosystemTransaction[] = [];
  const targetDay = save.life.completedDays;
  const startDay = world.lastSimulatedDay;
  const startDate = world.lastUpdatedOn;

  for (let day = startDay + 1; day <= targetDay; day += 1) {
    const simulatedDate = addGameDays(startDate, day - startDay);
    const cycle = resolveWorldCycle(simulatedDate);
    const random = new SeededRandom(`${save.meta.worldSeed}:ecosystem-day:${day}`);
    const daySave: EcosystemCareerState = {
      ...save,
      meta: { ...save.meta, currentDate: simulatedDate },
      world,
    };
    let teams = syncHeroSeasonTeams(world.teams, daySave);
    let conferences = world.conferences;
    let coaches = world.coaches;
    let simulationContext = createSimulationContext(teams, world.players, coaches);
    const dailyPlayers = updatePlayersDaily(world.players, simulationContext, daySave, random.fork("players"), day);
    let players = dailyPlayers.players;
    generatedStories.push(...dailyPlayers.stories);
    simulationContext = createSimulationContext(teams, players, coaches);
    const tacticalProgress = advanceTacticalInstallation(teams, players, simulationContext, day);
    teams = tacticalProgress.teams;
    players = tacticalProgress.players;

    if (day % 7 === 0) {
      const campResult = simulateTalentCamps(
        talentPipeline,
        players,
        cycle,
        random.fork("talent-camps"),
        save.football.college.signedProgramId ?? save.football.school.id,
      );
      talentPipeline = campResult.pipeline;
      players = campResult.players;
      generatedStories.push(...campResult.stories.map((draft) => story(
        daySave,
        day,
        draft.kind,
        draft.title,
        draft.detail,
        draft.importance,
        draft.teamIds,
        draft.playerIds,
        [],
        draft.relatedToHero,
      )));

      simulationContext = createSimulationContext(teams, players, coaches);
      const depth = reorderDepthCharts(players, simulationContext, daySave, day);
      players = depth.players;
      generatedStories.push(...depth.stories);

      const rosterReview = reviewRosterManagement(
        teams,
        players,
        coaches,
        world.constitution,
        cycle.seasonYear,
        cycle.phaseWeek,
        random.fork("roster-review"),
        { applyOffseasonDecisions: false, reason: `Недельный аудит: ${cycle.phase}, неделя ${cycle.phaseWeek}.` },
      );
      teams = rosterReview.teams;
      players = rosterReview.players;
      generatedStories.push(...rosterReview.drafts.map((draft) => story(
        daySave,
        day,
        draft.kind,
        draft.title,
        draft.detail,
        draft.teamId === save.football.college.signedProgramId ? 4 : draft.importance,
        [draft.teamId],
        draft.playerId ? [draft.playerId] : [],
        [],
        draft.teamId === save.football.college.signedProgramId || draft.playerId === "hero",
      )));

      simulationContext = createSimulationContext(teams, players, coaches);
      const resourceUpdate = updateProgramResourcesWeekly(
        teams,
        simulationContext,
        daySave,
        random.fork("resources"),
        day,
        cycle.phase,
      );
      teams = resourceUpdate.teams;
      generatedStories.push(...resourceUpdate.stories);

      const unifiedMarket = advanceUnifiedMovementMarket({
        teams,
        players,
        coaches,
        talentPipeline,
        movementMarket,
        context: {
          seasonYear: cycle.seasonYear,
          week: Math.max(1, cycle.phaseWeek),
          day,
          date: simulatedDate,
          phase: cycle.phase,
          heroProgramId: save.football.college.signedProgramId,
          heroPosition: save.football.position,
          relevantProgramIds: save.football.recruitment.programs.filter((program) => program.interest >= 25).map((program) => program.id),
        },
        random: random.fork("unified-movement-market"),
      });
      teams = unifiedMarket.teams;
      players = unifiedMarket.players;
      talentPipeline = unifiedMarket.talentPipeline;
      movementMarket = unifiedMarket.movementMarket;
      generatedStories.push(...unifiedMarket.stories);
      generatedTransactions.push(...unifiedMarket.transactions);

      const socialWeek = simulateSocialWeek(
        social,
        teams,
        players,
        coaches,
        cycle.seasonYear,
        Math.max(1, cycle.phaseWeek),
        day,
        random.fork("social-week"),
      );
      social = socialWeek.social;
      players = socialWeek.players;
      generatedStories.push(...socialWeek.stories.map((draft) => {
        const related = draft.teamIds.includes(save.football.college.signedProgramId ?? "")
          || draft.playerIds.some((playerId) => players.find((player) => player.id === playerId)?.isHero);
        return story(daySave, day, draft.kind, draft.title, draft.detail, related ? 5 : draft.importance, draft.teamIds, draft.playerIds, draft.coachIds, related);
      }));

      if (cycle.phase === "regular-season" && world.seasonYear === cycle.seasonYear && world.seasonWeek <= 10) {
        const interactiveMatch = save.football.college.heroCareer
          && save.football.match.status === "complete"
          && save.football.match.finalResult
          && save.football.college.heroCareer?.teamId
          ? save.football.match
          : undefined;
        const interactiveGame = interactiveMatch
          ? competition.schedule.find((game) => game.id === interactiveMatch.gameId && game.status === "scheduled")
          : undefined;
        const heroTeamId = save.football.college.heroCareer?.teamId;
        const overrides = interactiveGame && interactiveMatch?.finalResult && heroTeamId
          ? [{
              gameId: interactiveGame.id,
              homeScore: interactiveGame.homeTeamId === heroTeamId
                ? interactiveMatch.finalResult.heroScore
                : interactiveMatch.finalResult.opponentScore,
              awayScore: interactiveGame.awayTeamId === heroTeamId
                ? interactiveMatch.finalResult.heroScore
                : interactiveMatch.finalResult.opponentScore,
            }]
          : [];
        const round = simulateCompetitionWeek(
          competition,
          teams,
          players,
          coaches,
          cycle.seasonYear,
          world.seasonWeek,
          random.fork("competition-week"),
          social,
          overrides,
        );
        competition = round.competition;
        teams = round.teams;
        coaches = round.coaches;
        const played = new Set(round.playedTeamIds);
        players = players.map((player) => player.level === "college"
          && played.has(player.teamId)
          && (player.usagePlan === "starter" || player.usagePlan === "rotation" || player.usagePlan === "special-teams")
          && isPlayerAvailable(player)
          ? { ...player, eligibility: { ...player.eligibility, gamesPlayedThisSeason: player.eligibility.gamesPlayedThisSeason + 1 } }
          : player);
        generatedStories.push(...round.stories.map((draft) => story(daySave, day, draft.kind, draft.title, draft.detail, draft.importance, draft.teamIds, draft.playerIds, [], draft.teamIds.includes(save.football.college.signedProgramId ?? ""))));
        simulationContext = createSimulationContext(teams, players, coaches);
        teams = recalculateTeamStrength(teams, simulationContext);
        world = { ...world, seasonWeek: Math.min(11, world.seasonWeek + 1), phase: world.seasonWeek >= 10 ? "postseason" : "regular-season" };
      } else if (cycle.phase === "postseason" && competition.playoff.stage !== "complete") {
        const postseason = simulateCompetitionPostseason(competition, teams, players, coaches, conferences, random.fork(`postseason:${competition.playoff.stage}`), social);
        competition = postseason.competition;
        teams = postseason.teams;
        coaches = postseason.coaches;
        conferences = postseason.conferences;
        const played = new Set(postseason.playedTeamIds);
        players = players.map((player) => player.level === "college"
          && played.has(player.teamId)
          && (player.usagePlan === "starter" || player.usagePlan === "rotation" || player.usagePlan === "special-teams")
          && isPlayerAvailable(player)
          ? { ...player, eligibility: { ...player.eligibility, gamesPlayedThisSeason: player.eligibility.gamesPlayedThisSeason + 1 } }
          : player);
        generatedStories.push(...postseason.stories.map((draft) => story(daySave, day, draft.kind, draft.title, draft.detail, draft.importance, draft.teamIds, draft.playerIds, [], draft.teamIds.includes(save.football.college.signedProgramId ?? ""))));
        world = { ...world, conferences, phase: postseason.complete ? "offseason" : "postseason", seasonWeek: postseason.complete ? 15 : world.seasonWeek + 1 };
      } else if (cycle.phase === "winter-evaluation" && world.lastOffseasonYear < cycle.seasonYear) {
        const offseasonWorld = processOffseason({ ...world, teams, players, coaches, movementMarket }, daySave, random.fork("offseason"), day);
        teams = offseasonWorld.teams;
        players = offseasonWorld.players;
        coaches = offseasonWorld.coaches;
        world = offseasonWorld;
        talentPipeline = offseasonWorld.talentPipeline;
        movementMarket = offseasonWorld.movementMarket;
        competition = offseasonWorld.competition;
        social = offseasonWorld.social;
        conferences = offseasonWorld.conferences;
      } else if (cycle.phase === "preseason" && world.seasonYear < cycle.seasonYear) {
        world = resetForNewSeason({ ...world, teams, players, coaches }, cycle.seasonYear);
        teams = world.teams;
        players = world.players;
        coaches = world.coaches;
        movementMarket = world.movementMarket;
        competition = world.competition;
        social = world.social;
        conferences = world.conferences;
      }

      const agencyResult = advanceWorldAgency({
        agency,
        history: worldHistory,
        teams,
        players,
        coaches,
        social,
        seasonYear: world.seasonYear,
        week: Math.max(1, world.seasonWeek),
        date: simulatedDate,
        worldSeed: save.meta.worldSeed,
      });
      agency = agencyResult.agency;
      teams = agencyResult.teams;
      players = agencyResult.players;
      coaches = agencyResult.coaches;
      social = agencyResult.social;
      generatedStories.push(...agencyResult.stories);
      generatedTransactions.push(...agencyResult.transactions);
    }

    world = {
      ...world,
      lastSimulatedDay: day,
      currentWeek: save.life.weekNumber,
      lastUpdatedOn: simulatedDate,
      cycle,
      teams,
      players,
      coaches,
      conferences,
      talentPipeline,
      movementMarket,
      competition,
      social,
      agency,
      market: market(players, coaches, teams, talentPipeline, movementMarket),
    };
  }

  programs = updateHeroPrograms(programs, world.teams, world.players, { ...save, world });
  const synchronizedFootball = syncEcosystemIntoFootball(
    {
      ...save.football,
      recruitment: { ...save.football.recruitment, programs },
    },
    save.character,
    world,
    save.meta.currentDate,
  );
  const sourceStories = [...world.stories, ...generatedStories];
  const transactions = [...world.transactions, ...generatedTransactions].slice(-800);
  const careerRegistry = syncCareerRegistry(
    world.careerRegistry,
    world.players,
    world.teams,
    transactions,
    world.seasonYear,
    Math.max(1, world.seasonWeek),
  );
  const historyResult = advanceWorldHistory({
    history: worldHistory,
    teams: world.teams,
    players: world.players,
    coaches: world.coaches,
    stories: sourceStories,
    transactions,
    seasonYear: world.seasonYear,
    week: Math.max(1, world.seasonWeek),
    date: world.lastUpdatedOn,
  });
  worldHistory = historyResult.history;
  const retainedAgencyFactIds = new Set(worldHistory.facts.map((fact) => fact.id));
  const retainedAgencyDecisionIds = new Set(agency.decisions.map((decision) => decision.id));
  agency = {
    ...agency,
    conflicts: agency.conflicts.map((conflict) => ({
      ...conflict,
      evidenceFactIds: conflict.evidenceFactIds.filter((id) => retainedAgencyFactIds.has(id)),
      decisionIds: conflict.decisionIds.filter((id) => retainedAgencyDecisionIds.has(id)),
    })),
  };
  const stories = [...sourceStories, ...historyResult.stories].slice(-90);
  const digestSource = [...generatedStories, ...historyResult.stories];
  world = {
    ...world,
    stories,
    transactions,
    careerRegistry,
    worldHistory,
    agency,
    digest: historyResult.history.digest.length > 0
      ? historyResult.history.digest
      : buildDigest(digestSource.length > 0 ? digestSource : world.stories.slice(-12), world),
  };
  const important = [...generatedStories, ...historyResult.stories].filter((item) => item.relatedToHero && item.importance >= 4).slice(-3);

  return {
    ...save,
    world,
    football: synchronizedFootball,
    history: [
      ...save.history,
      ...important.map((item) => ({
        id: item.id,
        occurredAt: save.meta.updatedAt,
        type: `ecosystem-${item.kind}`,
        title: item.title,
        description: item.detail,
      })),
    ],
  } as T;
}
