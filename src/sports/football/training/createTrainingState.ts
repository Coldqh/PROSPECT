import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition, FootballRatings } from "../career/types";
import type { FootballTrainingState } from "./types";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function createInitialTrainingState(
  worldSeed: string,
  position: FootballPosition,
  character: CharacterState,
  ratings: FootballRatings,
): FootballTrainingState {
  const random = new SeededRandom(worldSeed).fork(`training:${position}`);
  const baseReadiness = clamp(
    character.condition.energy * 0.42 +
      character.condition.health * 0.34 +
      (100 - character.condition.fatigue) * 0.24 +
      random.integer(-3, 3),
  );

  return {
    moduleVersion: 1,
    plan: {
      focusId: "position-craft",
      intensity: "standard",
      revision: 1,
    },
    body: {
      readiness: baseReadiness,
      acuteLoad: clamp(18 + character.condition.fatigue * 0.18 + random.integer(-3, 4)),
      chronicLoad: clamp(24 + character.physical.stamina * 0.22 + random.integer(-3, 3)),
      soreness: clamp(10 + character.condition.fatigue * 0.18 + random.integer(-2, 4)),
      pain: clamp(random.integer(0, 5)),
      injuryRisk: clamp(9 + character.condition.fatigue * 0.09 + random.integer(-2, 3)),
      medicalStatus: "cleared",
      restriction: "Полный тренировочный допуск.",
    },
    momentum: {
      technique: clamp((ratings.technique - 50) * 0.65),
      athleticism: clamp((ratings.athleticism - 50) * 0.65),
      footballIq: clamp((ratings.footballIq - 50) * 0.65),
      competitiveness: clamp((ratings.competitiveness - 50) * 0.65),
    },
  };
}
