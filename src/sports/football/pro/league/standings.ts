import type { ProfessionalTeam } from "../types";

export function professionalStandings(teams: ProfessionalTeam[]): ProfessionalTeam[] {
  return [...teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.rosterStrength - a.rosterStrength || a.id.localeCompare(b.id));
}
