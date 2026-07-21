import type { SportDescriptor, SportId, SportModule } from "./types";

export const sportDescriptors: readonly SportDescriptor[] = [
  {
    id: "american-football",
    name: "American Football",
    shortName: "Football",
    status: "available",
    accent: "#d8ff3e",
    summary: "Школьный сезон, depth chart, матчи и рекрутинг колледжей.",
  },
  {
    id: "basketball",
    name: "Basketball",
    shortName: "Basketball",
    status: "planned",
    accent: "#ff8a3d",
    summary: "Отдельная спортивная экосистема появится после футбольного вертикального среза.",
  },
] as const;

export function getSportDescriptor(id: SportId): SportDescriptor {
  const descriptor = sportDescriptors.find((item) => item.id === id);

  if (!descriptor) {
    throw new Error(`Unknown sport: ${id}`);
  }

  return descriptor;
}

export async function loadSportModule(id: SportId): Promise<SportModule> {
  if (id === "american-football") {
    return import("../../sports/football");
  }

  throw new Error("Basketball module is not available in this build");
}
