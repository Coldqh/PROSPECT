import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const database = read("src/storage/indexedDb/database.ts");
const repository = read("src/storage/saves/CareerRepository.ts");
const slices = read("src/storage/saves/worldSlices.ts");
const participation = read("src/sports/football/matches/participation.ts");
const simulation = read("src/sports/football/matches/simulateMatch.ts");
const matchUi = read("src/components/career/MatchDashboard.tsx");
const drawer = read("src/components/career/CareerDrawer.tsx");
const navigation = read("src/components/career/CareerNavigation.tsx");
const professional = read("src/components/career/ProfessionalTransitionDashboard.tsx");

const assertions = [
  [database.includes('careerWorldSlices') && database.includes('openDB<ProspectDatabase>("prospect-db", 2'), "normalized IndexedDB world slices"],
  [slices.includes("compactCareerSave") && slices.includes("hydrateCareerSave"), "compact snapshot hydration"],
  [repository.includes("careerSaveSchema.safeParse") && !repository.includes("if (save.meta.schemaVersion === CURRENT_SCHEMA_VERSION) return save"), "current-schema validation"],
  [repository.includes("createWorldSliceRecords") && repository.includes("pruneWorldSlices"), "content-addressed world persistence"],
  [participation.includes("expectedHeroSnapShare") && participation.includes("heroParticipationForSnap"), "dynamic package participation"],
  [simulation.includes("advancePastBenchSnaps") && simulation.includes("advanceToSpecialOpportunity"), "bench skipping and real special-team opportunities"],
  [!matchUi.includes("entryQuarter") && !matchUi.includes("match.totalEpisodes}</strong>"), "no fake entry quarter or snap quota in match UI"],
  [!drawer.includes('"matches"') && !drawer.includes('"standings"') && !drawer.includes('"leagues"'), "consolidated drawer sections"],
  [navigation.includes('label: "Сегодня"') && navigation.includes('label: "Карьера"') && navigation.includes('label: "Лига"'), "shared four-part career navigation"],
  [professional.includes("heroCanPlay") && professional.includes("(!activeGame || !heroCanPlay)"), "inactive professional week escape"],
  [!professional.includes("professional-root-tabs"), "no duplicate professional league tabs"],
];

for (const [ok, label] of assertions) {
  if (!ok) throw new Error(`Missing ${label}`);
}
console.log(`Core consolidation: ${assertions.length} checks passed.`);
