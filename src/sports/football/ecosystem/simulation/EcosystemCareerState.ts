import type { GameDate } from "../../../../core/calendar/types";
import type { CharacterState } from "../../../../core/character/types";
import type { LifeState } from "../../../../core/life/types";
import type { RelationshipState } from "../../../../core/relationships/types";
import type { FootballCareerState } from "../../career/types";
import type { FootballEcosystemState } from "../types";

export interface EcosystemCareerState {
  meta: {
    worldSeed: string;
    currentDate: GameDate;
    updatedAt: string;
  };
  character: CharacterState;
  life: LifeState;
  football: FootballCareerState;
  relationships: RelationshipState;
  world: FootballEcosystemState;
  history: Array<{
    id: string;
    occurredAt: string;
    type: string;
    title: string;
    description: string;
  }>;
}
