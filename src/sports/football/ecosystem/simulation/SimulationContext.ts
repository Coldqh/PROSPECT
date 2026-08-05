import type { EcosystemCoach, EcosystemPlayer, EcosystemTeam } from "../types";

export interface SimulationContext {
  teamById: ReadonlyMap<string, EcosystemTeam>;
  playerById: ReadonlyMap<string, EcosystemPlayer>;
  playersByTeamId: ReadonlyMap<string, readonly EcosystemPlayer[]>;
  coachesByTeamId: ReadonlyMap<string, readonly EcosystemCoach[]>;
  headCoachByTeamId: ReadonlyMap<string, EcosystemCoach>;
}

export function createSimulationContext(
  teams: readonly EcosystemTeam[],
  players: readonly EcosystemPlayer[],
  coaches: readonly EcosystemCoach[],
): SimulationContext {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const playersByTeamId = new Map<string, EcosystemPlayer[]>();
  const coachesByTeamId = new Map<string, EcosystemCoach[]>();
  const headCoachByTeamId = new Map<string, EcosystemCoach>();

  for (const player of players) {
    const roster = playersByTeamId.get(player.teamId);
    if (roster) roster.push(player);
    else playersByTeamId.set(player.teamId, [player]);
  }

  for (const coach of coaches) {
    const staff = coachesByTeamId.get(coach.teamId);
    if (staff) staff.push(coach);
    else coachesByTeamId.set(coach.teamId, [coach]);
    if (coach.role === "head-coach") headCoachByTeamId.set(coach.teamId, coach);
  }

  return { teamById, playerById, playersByTeamId, coachesByTeamId, headCoachByTeamId };
}
