import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { ProfessionalRosterPlayer, ProfessionalTransaction } from "../types";
import { rebuildProfessionalDepthCharts } from "./roster";
import { clamp } from "./shared";

export function advanceProfessionalMedical(
  seed: string,
  seasonYear: number,
  currentWeek: number,
  roster: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
): { roster: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  const random = new SeededRandom(seed).fork(`professional-medical:${seasonYear}:${currentWeek}`);
  const nextTransactions = [...transactions];
  const nextRoster = roster.map((player) => {
    if (player.injuryWeeks > 0) {
      const injuryWeeks = Math.max(0, player.injuryWeeks - 1);
      const availability = injuryWeeks === 0 ? "active" as const : injuryWeeks === 1 ? "questionable" as const : injuryWeeks >= 5 ? "injured-reserve" as const : "out" as const;
      const status = player.status === "injured-reserve" && injuryWeeks === 0 ? "active" as const : availability === "injured-reserve" ? "injured-reserve" as const : player.status;
      return { ...player, injuryWeeks, availability, status, health: clamp(player.health + random.integer(2, 6)) };
    }
    if (player.isHero || player.status !== "active") return player;
    const injuryChance = .0035 + Math.max(0, 78 - player.health) * .00025;
    if (!random.chance(injuryChance)) return { ...player, health: clamp(player.health + random.integer(-2, 2)) };
    const injuryWeeks = random.integer(1, 7);
    const availability = injuryWeeks === 1 ? "questionable" as const : injuryWeeks >= 5 ? "injured-reserve" as const : "out" as const;
    nextTransactions.push({
      id: `pro-tx:${seasonYear}:w${currentWeek}:injury:${player.id}`,
      seasonYear,
      week: currentWeek,
      kind: "injury",
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      fromTeamId: player.teamId,
      value: injuryWeeks,
      summary: `${player.position} ${player.name} выбыл на ${injuryWeeks} нед.`,
    });
    return { ...player, injuryWeeks, availability, status: availability === "injured-reserve" ? "injured-reserve" as const : player.status, health: clamp(player.health - random.integer(4, 14)) };
  });
  return { roster: rebuildProfessionalDepthCharts(nextRoster), transactions: nextTransactions.slice(-600) };
}
