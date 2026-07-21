import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1;

const gameDateSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const careerMetaSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  sport: z.literal("american-football"),
  worldSeed: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentDate: gameDateSchema,
  phase: z.literal("foundation"),
  revision: z.number().int().nonnegative(),
});

export const careerSaveSchema = z.object({
  meta: careerMetaSchema,
  football: z.object({
    moduleVersion: z.literal(1),
    worldSeed: z.string().min(1),
    stage: z.literal("foundation"),
  }),
  history: z.array(
    z.object({
      id: z.string().min(1),
      occurredAt: z.string().datetime(),
      type: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
});

export type CareerSave = z.infer<typeof careerSaveSchema>;

export interface CareerIndexRecord {
  id: string;
  displayName: string;
  sport: "american-football";
  phase: "foundation";
  currentDate: string;
  updatedAt: string;
  revision: number;
}
