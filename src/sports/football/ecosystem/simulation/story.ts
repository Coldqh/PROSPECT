import type { EcosystemPlayer, EcosystemStory } from "../types";
import type { EcosystemCareerState } from "./EcosystemCareerState";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

export function importance(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value >= 5) return 5;
  if (value >= 4) return 4;
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  return 1;
}

export function story(
  save: EcosystemCareerState,
  day: number,
  kind: EcosystemStory["kind"],
  title: string,
  detail: string,
  weight: number,
  teamIds: string[] = [],
  playerIds: string[] = [],
  coachIds: string[] = [],
  relatedToHero = false,
): EcosystemStory {
  return {
    id: `world-${day}-${kind}-${teamIds[0] ?? playerIds[0] ?? coachIds[0] ?? "global"}-${title.length}`,
    kind,
    createdOn: save.meta.currentDate,
    week: save.life.weekNumber,
    title,
    detail,
    importance: importance(weight),
    teamIds,
    playerIds,
    coachIds,
    relatedToHero,
  };
}

export function playerLabel(player: EcosystemPlayer): string {
  return `${player.name}, ${player.position}`;
}

