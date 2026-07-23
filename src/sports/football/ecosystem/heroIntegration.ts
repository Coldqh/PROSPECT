import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import type { FootballCareerState } from "../career/types";
import type {
  EcosystemPlayer,
  EcosystemTeamSeasonRecord,
  FootballEcosystemState,
} from "./types";
import { createPlayerEligibility, refreshTeamCompliance, resolveWorldCycle } from "./constitution";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createTalentProfile } from "./talent";
import { careerArchetypeRole, createPlayerTacticalProfile, reevaluatePlayerTacticalProfile } from "./tactics";

function archiveCurrentSeason(world: FootballEcosystemState): EcosystemTeamSeasonRecord[] {
  return world.conferences.flatMap((conference) => {
    const ordered = conference.teamIds
      .map((id) => world.teams.find((team) => team.id === id))
      .filter((team): team is NonNullable<typeof team> => Boolean(team))
      .sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.rating - left.rating);
    return ordered.map((team, index) => {
      const headCoach = world.coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
      return {
        id: `${world.seasonYear}:${team.id}`,
        seasonYear: world.seasonYear,
        teamId: team.id,
        conferenceId: conference.id,
        wins: team.wins,
        losses: team.losses,
        conferenceWins: team.conferenceWins,
        conferenceLosses: team.conferenceLosses,
        finalRating: team.rating,
        finish: index + 1,
        conferenceChampion: conference.champions.some((champion) => champion.seasonYear === world.seasonYear && champion.teamId === team.id),
        ...(headCoach ? { headCoachId: headCoach.id } : {}),
      };
    });
  });
}

function currentHero(
  world: FootballEcosystemState,
  character: CharacterState,
  football: FootballCareerState,
  targetTeamId: string,
): EcosystemPlayer {
  const existing = world.players.find((player) => player.isHero);
  const targetTeam = world.teams.find((team) => team.id === targetTeamId);
  if (!targetTeam) throw new Error(`College ecosystem team not found: ${targetTeamId}`);
  return {
    ...(existing ?? {
      id: "hero",
      seed: `${football.worldSeed}:hero`,
      name: character.identity.fullName,
      nationalRank: 9999,
      recruitingStage: "committed" as const,
      eligibilityYears: 5,
      seasonsPlayed: 0,
      transferStatus: "none" as const,
      previousTeamIds: [],
      isHero: true,
      usagePlan: "developmental" as const,
      positionHistory: [],
      tactical: createPlayerTacticalProfile({ seed: `${football.worldSeed}:hero`, position: football.position, overall: football.ratings.overall, potential: football.ratings.overall + 8, classYear: "Freshman" }, targetTeam.tactical, new SeededRandom(`${football.worldSeed}:hero:tactical:${targetTeamId}`), careerArchetypeRole(football.position, football.archetypeId)),
      eligibility: createPlayerEligibility("college", character.identity.age, "Freshman", world.seasonYear, new SeededRandom(`${football.worldSeed}:hero:eligibility`), "full"),
    }),
    name: character.identity.fullName,
    teamId: targetTeamId,
    level: "college",
    age: character.identity.age,
    classYear: "Freshman",
    position: football.position,
    overall: football.ratings.overall,
    potential: Math.max(existing?.potential ?? 0, football.ratings.overall + 8),
    health: character.condition.health,
    form: character.condition.confidence,
    status: (football.college.depthRank ?? 3) === 1 ? "starter" : (football.college.depthRank ?? 3) === 2 ? "rotation" : "backup",
    depthRank: football.college.depthRank ?? 3,
    trajectory: "steady",
    committedTeamId: targetTeamId,
    eligibilityYears: 5,
    seasonsPlayed: 0,
    transferStatus: "none",
    previousTeamIds: existing && existing.teamId !== targetTeamId
      ? [...existing.previousTeamIds, existing.teamId].slice(-6)
      : existing?.previousTeamIds ?? [],
    isHero: true,
    eligibility: createPlayerEligibility("college", character.identity.age, "Freshman", Math.max(2027, world.seasonYear), new SeededRandom(`${football.worldSeed}:hero:eligibility:${targetTeamId}`), football.college.entryRoute === "preferred-walk-on" ? "none" : "full"),
    talent: existing?.talent ?? createTalentProfile({ level: "college", classYear: "Freshman", overall: football.ratings.overall, potential: Math.max(football.ratings.overall, football.ratings.overall + 8), nationalRank: 9999, isHero: true }, world.teams.find((team) => team.id === targetTeamId)?.stateCode ?? football.school.stateCode, Math.max(2027, world.seasonYear), new SeededRandom(`${football.worldSeed}:hero:talent:${targetTeamId}`)),
    usagePlan: (football.college.depthRank ?? 3) === 1 ? "starter" : (football.college.depthRank ?? 3) === 2 ? "rotation" : "developmental",
    positionHistory: existing?.positionHistory ?? [],
    tactical: existing
      ? reevaluatePlayerTacticalProfile(existing, targetTeam.tactical, Math.max(2027, world.seasonYear))
      : createPlayerTacticalProfile({ seed: `${football.worldSeed}:hero`, position: football.position, overall: football.ratings.overall, potential: football.ratings.overall + 8, classYear: "Freshman" }, targetTeam.tactical, new SeededRandom(`${football.worldSeed}:hero:tactical:${targetTeamId}`), careerArchetypeRole(football.position, football.archetypeId)),
  };
}

export function placeHeroInCollegeEcosystem(
  world: FootballEcosystemState,
  character: CharacterState,
  football: FootballCareerState,
  targetTeamId: string,
  arrivalDate: GameDate,
): FootballEcosystemState {
  const hero = currentHero(world, character, football, targetTeamId);
  const existingHero = world.players.find((player) => player.isHero);
  const advancedYear = arrivalDate.year > world.seasonYear;
  const history = advancedYear ? [...world.teamHistory, ...archiveCurrentSeason(world)].slice(-240) : world.teamHistory;
  const players = [...world.players.filter((player) => !player.isHero), hero];
  const teams = world.teams.map((team) => {
    const rosterIds = team.rosterIds.filter((id) => id !== hero.id);
    const nextRosterIds = team.id === targetTeamId ? [...rosterIds, hero.id] : rosterIds;
    if (!advancedYear || team.level !== "college") return { ...team, rosterIds: nextRosterIds };
    return {
      ...team,
      rosterIds: nextRosterIds,
      wins: 0,
      losses: 0,
      conferenceWins: 0,
      conferenceLosses: 0,
      streak: 0,
      trend: "stable" as const,
    };
  });
  const compliantTeams = teams.map((team) => ({
    ...team,
    compliance: refreshTeamCompliance(team, players, new SeededRandom(`${team.seed}:hero-arrival:${arrivalDate.year}`), world.constitution),
  }));
  const target = compliantTeams.find((team) => team.id === targetTeamId);
  const transactionId = `hero-enrolled:${arrivalDate.year}:${targetTeamId}`;
  const alreadyRecorded = world.transactions.some((transaction) => transaction.id === transactionId);
  const enrollmentTransaction = {
    id: transactionId,
    kind: "recruit-enrolled" as const,
    seasonYear: arrivalDate.year,
    week: 1,
    createdOn: arrivalDate,
    title: `${character.identity.fullName} прибыл в ${target?.shortName ?? "колледж"}`,
    detail: `Герой вошёл в реальную позиционную комнату ${target?.name ?? "программы"}; место теперь зависит от состава, трансферов и решений нового штаба.`,
    playerId: hero.id,
    ...(existingHero ? { fromTeamId: existingHero.teamId } : {}),
    toTeamId: targetTeamId,
    relatedToHero: true,
  };
  return {
    ...world,
    lastUpdatedOn: arrivalDate,
    cycle: resolveWorldCycle(arrivalDate),
    seasonYear: advancedYear ? arrivalDate.year : world.seasonYear,
    seasonWeek: advancedYear ? 1 : world.seasonWeek,
    phase: advancedYear ? "regular-season" : world.phase,
    lastOffseasonYear: advancedYear ? arrivalDate.year - 1 : world.lastOffseasonYear,
    teams: compliantTeams,
    players,
    teamHistory: history,
    transactions: alreadyRecorded
      ? world.transactions
      : [
          ...world.transactions,
          enrollmentTransaction,
        ].slice(-160),
  };
}
