import type { CareerSave } from "../../storage/saves/schema";

export type CareerMutation = (current: CareerSave) => CareerSave | Promise<CareerSave>;

export interface CareerMutationStore {
  save(input: CareerSave): Promise<CareerSave>;
  mutate(careerId: string, mutation: CareerMutation): Promise<CareerSave>;
}
