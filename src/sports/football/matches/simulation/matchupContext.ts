import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import type { FootballPosition } from "../../career/types";
import type { MatchTacticalProfile, MatchTeamSide } from "../types";
import type { SpecialistSnapshot, TeamRatings } from "./internalTypes";
import { clamp, clampInteger } from "./matchMath";

function ownTeamRatings(save: CareerSave): TeamRatings {
  const professionalCareer = save.meta.phase === "professional-career" ? save.football.professional.heroCareer : undefined;
  if (professionalCareer?.teamId) {
    const team = save.football.professional.teams.find((item) => item.id === professionalCareer.teamId);
    const roster = save.football.professional.league.roster.filter((player) => player.teamId === professionalCareer.teamId && player.status === "active");
    const offensePositions = new Set<FootballPosition>(["QB", "RB", "WR", "TE", "OT", "OG", "C"]);
    const defensePositions = new Set<FootballPosition>(["EDGE", "DT", "LB", "CB", "S"]);
    const average = (players: typeof roster, fallback: number) => players.length > 0
      ? players.reduce((sum, player) => sum + player.overall, 0) / players.length
      : fallback;
    const base = team?.rosterStrength ?? 72;
    return {
      offense: clamp(average(roster.filter((player) => offensePositions.has(player.position)), base) * .82 + base * .18),
      defense: clamp(average(roster.filter((player) => defensePositions.has(player.position)), base) * .82 + base * .18),
      coaching: clamp((team?.prestige ?? base) * .7 + professionalCareer.coachTrust * .3),
      cohesion: clamp(58 + professionalCareer.coachTrust * .28 + (team?.prestige ?? base) * .12),
    };
  }
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  if (collegeCareer) {
    const team = save.world.teams.find((item) => item.id === collegeCareer.teamId);
    const culture = save.world.social.teamCultures.find((item) => item.teamId === collegeCareer.teamId);
    const rating = team?.rating ?? 72;
    return {
      offense: clamp(rating + ((team?.tactical.installation ?? 62) - 60) * .12),
      defense: clamp(rating + ((team?.tactical.continuity ?? 60) - 60) * .1),
      coaching: clamp((team?.tactical.installation ?? 62) * .55 + (team?.prestige ?? rating) * .45),
      cohesion: culture?.cohesion ?? 58,
    };
  }
  const offenseRoster = save.football.roster.filter((player) => player.unit === "offense" && player.status !== "injured");
  const defenseRoster = save.football.roster.filter((player) => player.unit === "defense" && player.status !== "injured");
  const average = (values: number[], fallback: number) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
  const base = (save.football.school.prestige + save.football.school.coaching) / 2;
  return {
    offense: clamp(average(offenseRoster.map((player) => player.overall), base) * .72 + save.football.teamDynamics.schemeMastery * .28),
    defense: clamp(average(defenseRoster.map((player) => player.overall), base) * .72 + save.football.teamDynamics.schemeMastery * .28),
    coaching: save.football.school.coaching,
    cohesion: save.football.teamDynamics.cohesion,
  };
}

function opponentTeamRatings(save: CareerSave, opponentId: string): TeamRatings {
  if (save.meta.phase === "professional-career") {
    const team = save.football.professional.teams.find((item) => item.id === opponentId);
    const roster = save.football.professional.league.roster.filter((player) => player.teamId === opponentId && player.status === "active");
    const offensePositions = new Set<FootballPosition>(["QB", "RB", "WR", "TE", "OT", "OG", "C"]);
    const defensePositions = new Set<FootballPosition>(["EDGE", "DT", "LB", "CB", "S"]);
    const average = (players: typeof roster, fallback: number) => players.length > 0
      ? players.reduce((sum, player) => sum + player.overall, 0) / players.length
      : fallback;
    const base = team?.rosterStrength ?? 72;
    return {
      offense: clamp(average(roster.filter((player) => offensePositions.has(player.position)), base) * .84 + base * .16),
      defense: clamp(average(roster.filter((player) => defensePositions.has(player.position)), base) * .84 + base * .16),
      coaching: clamp((team?.prestige ?? base) * .82 + base * .18),
      cohesion: clamp(54 + (team?.prestige ?? base) * .34),
    };
  }
  if (save.meta.phase === "college-season") {
    const team = save.world.teams.find((item) => item.id === opponentId);
    const culture = save.world.social.teamCultures.find((item) => item.teamId === opponentId);
    const rating = team?.rating ?? 72;
    return {
      offense: clamp(rating + ((team?.tactical.installation ?? 60) - 60) * .1),
      defense: clamp(rating + ((team?.tactical.continuity ?? 60) - 60) * .1),
      coaching: clamp((team?.tactical.installation ?? 60) * .55 + (team?.prestige ?? rating) * .45),
      cohesion: culture?.cohesion ?? 55,
    };
  }
  const opponent = save.football.season.opponents.find((item) => item.id === opponentId);
  const rating = opponent?.rating ?? 72;
  return { offense: rating, defense: rating, coaching: clamp(rating + 2), cohesion: clamp(rating - 4) };
}

function defaultTacticalProfile(seed: string): MatchTacticalProfile {
  const random = new SeededRandom(`${seed}:default-tactics`);
  return {
    offenseSystem: "multiple",
    defenseSystem: "multiple-defense",
    runRate: 48 + random.integer(-3, 3),
    playActionRate: 18,
    screenRate: 12,
    deepShotRate: 20,
    blitzRate: 34 + random.integer(-3, 3),
    manCoverageRate: 42,
    disguiseRate: 56,
    fourthDownAggression: 50,
    adaptation: 55,
  };
}

export function tacticalProfileForSide(save: CareerSave, side: MatchTeamSide): MatchTacticalProfile {
  const teamId = side === "hero" ? heroTeamId(save) : save.football.match.opponentId;
  if (save.meta.phase === "professional-career") {
    const tactical = save.football.professional.teams.find((team) => team.id === teamId)?.tactical;
    return tactical ? { ...tactical } : defaultTacticalProfile(`${save.meta.worldSeed}:${teamId}:pro`);
  }
  const tactical = save.world.teams.find((team) => team.id === teamId)?.tactical;
  if (!tactical) return defaultTacticalProfile(`${save.meta.worldSeed}:${teamId}:world`);
  return {
    offenseSystem: tactical.offenseSystem,
    defenseSystem: tactical.defenseSystem,
    runRate: tactical.runRate ?? 48,
    playActionRate: tactical.playActionRate ?? 18,
    screenRate: tactical.screenRate ?? 12,
    deepShotRate: tactical.deepShotRate ?? 20,
    blitzRate: tactical.blitzRate ?? 34,
    manCoverageRate: tactical.manCoverageRate ?? 42,
    disguiseRate: tactical.disguiseRate ?? 56,
    fourthDownAggression: tactical.fourthDownAggression ?? 50,
    adaptation: tactical.adaptation ?? 55,
  };
}

export function ratingsForSide(save: CareerSave, side: MatchTeamSide): TeamRatings {
  return side === "hero" ? ownTeamRatings(save) : opponentTeamRatings(save, save.football.match.opponentId);
}

export function specialistForSide(
  save: CareerSave,
  side: MatchTeamSide,
  position: "K" | "P",
): SpecialistSnapshot {
  const teamId = side === "hero" ? heroTeamId(save) : save.football.match.opponentId;
  const professionalPlayer = save.meta.phase === "professional-career"
    ? save.football.professional.league.roster
      .filter((candidate) => candidate.teamId === teamId && candidate.position === position && candidate.status === "active")
      .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall)[0]
    : undefined;
  const player = professionalPlayer ?? save.world.players
    .filter((candidate) => candidate.teamId === teamId
      && candidate.position === position
      && candidate.status !== "injured"
      && candidate.eligibility.athleticallyEligible)
    .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall)[0]
    ?? save.world.players
      .filter((candidate) => candidate.teamId === teamId && candidate.position === position)
      .sort((left, right) => right.overall - left.overall)[0];
  const fallback = ratingsForSide(save, side);
  return {
    name: player?.name ?? (position === "K" ? "Кикер" : "Пантер"),
    overall: player?.overall ?? clamp((fallback.offense + fallback.coaching) / 2),
    health: player?.health ?? 88,
  };
}

export function fieldGoalChance(kicker: SpecialistSnapshot, distance: number, coaching: number): number {
  const distancePenalty = Math.max(0, distance - 31) * .0185;
  const specialistBonus = (kicker.overall - 65) * .0075 + (kicker.health - 85) * .002;
  const coachingBonus = (coaching - 65) * .0025;
  return Math.max(.12, Math.min(.96, .82 - distancePenalty + specialistBonus + coachingBonus));
}

export function puntNetYards(punter: SpecialistSnapshot, random: SeededRandom): number {
  return clampInteger(34 + (punter.overall - 60) * .24 + (punter.health - 80) * .04 + random.integer(-6, 7), 25, 52);
}

export function heroTeamId(save: CareerSave): string {
  if (save.meta.phase === "professional-career") {
    return save.football.professional.heroCareer?.teamId ?? save.football.professional.contract?.teamId ?? save.football.school.id;
  }
  return save.meta.phase === "college-season"
    ? save.football.college.heroCareer?.teamId ?? save.football.college.signedProgramId ?? save.football.school.id
    : save.football.school.id;
}

export function canHeroCheck(save: CareerSave): boolean {
  const professionalCareer = save.meta.phase === "professional-career" ? save.football.professional.heroCareer : undefined;
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const coachTrust = professionalCareer?.coachTrust ?? collegeCareer?.coachTrust ?? save.football.depthChart.coachTrust;
  const isStarter = professionalCareer
    ? professionalCareer.role === "starter"
    : collegeCareer ? collegeCareer.role === "starter" : save.football.depthChart.rank === 1;
  if (!isStarter) return false;

  if (save.football.position === "QB") {
    return save.football.ratings.footballIq >= 72 && coachTrust >= 68;
  }

  const defensiveCaptain = (save.football.position === "LB" || save.football.position === "S")
    && save.football.ratings.footballIq >= 80
    && coachTrust >= 82
    && (professionalCareer
      ? professionalCareer.coachTrust >= 84
      : collegeCareer
        ? collegeCareer.lockerRoomStanding >= 78
        : save.football.ratings.competitiveness >= 75);
  const lineCaller = save.football.position === "C"
    && save.football.ratings.footballIq >= 82
    && coachTrust >= 76;
  return defensiveCaptain || lineCaller;
}
