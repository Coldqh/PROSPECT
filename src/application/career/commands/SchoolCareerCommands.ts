import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createSeed } from "../../../core/random/createSeed";
import { loadSportModule } from "../../../core/sports/sportRegistry";
import type { FootballCareerSetup } from "../../../sports/football/career/types";
import { createFootballEcosystem } from "../../../sports/football/ecosystem/createEcosystem";
import { performRecruitingAction } from "../../../sports/football/recruiting/updateRecruiting";
import type { RecruitingActionId } from "../../../sports/football/recruiting/types";
import { commitToCollege, withdrawCollegeCommitment } from "../../../sports/football/recruiting/visits";
import { createFootballRelationships } from "../../../sports/football/relationships/createFootballRelationships";
import { resolveRelationshipEvent } from "../../../sports/football/relationships/relationshipEvents";
import { advanceFootballCareerDay } from "../../../sports/football/simulation/advanceFootballDay";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import type { CareerMutationStore } from "../CareerMutationStore";

export class SchoolCareerCommands {
  constructor(private readonly store: CareerMutationStore) {}

  async createFootballCareer(setup: FootballCareerSetup): Promise<CareerSave> {
    const careerId = crypto.randomUUID();
    const worldSeed = createSeed("football");
    const now = new Date().toISOString();
    const footballModule = await loadSportModule("american-football");
    const generated = footballModule.createInitialState(worldSeed, setup) as Pick<CareerSave, "character" | "football">;

    const save: CareerSave = {
      meta: {
        id: careerId,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sport: "american-football",
        worldSeed,
        createdAt: now,
        updatedAt: now,
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "high-school-preseason",
        revision: 0,
      },
      character: generated.character,
      life: createInitialLifeState(),
      football: generated.football,
      relationships: createFootballRelationships(worldSeed, generated.character, generated.football),
      world: createFootballEcosystem(
        worldSeed,
        generated.character,
        generated.football,
        { year: 2026, month: 8, day: 17 },
      ),
      history: [
        {
          id: crypto.randomUUID(),
          occurredAt: now,
          type: "career-created",
          title: "Первый день",
          description: `${generated.character.identity.fullName} начинает последний школьный сезон в ${generated.football.school.name}.`,
        },
      ],
    };

    return this.store.save(save);
  }

  async resolveRelationshipEvent(careerId: string, optionId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveRelationshipEvent(current, optionId));
  }

  async performRecruitingAction(
    careerId: string,
    programId: string,
    actionId: RecruitingActionId,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => performRecruitingAction(current, programId, actionId));
  }

  async commitToCollege(careerId: string, programId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => commitToCollege(current, programId));
  }

  async withdrawCollegeCommitment(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, withdrawCollegeCommitment);
  }

  async advanceDay(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase !== "high-school-preseason") {
        throw new Error("High-school career is not active");
      }
      if (current.relationships.pendingEvent) {
        throw new Error("Relationship event must be resolved before advancing");
      }
      if (current.life.dayIndex === 5 && current.football.match.status !== "complete") {
        throw new Error("Match must be completed before advancing Saturday");
      }
      return advanceFootballCareerDay(current);
    });
  }
}
