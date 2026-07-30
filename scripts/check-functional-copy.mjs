import { readFileSync } from "node:fs";

const files = [
  "src/components/career/MatchDashboard.tsx",
  "src/components/career/RealTimeMatchField.tsx",
  "src/components/career/RecruitingDashboard.tsx",
  "src/components/career/MarketDashboard.tsx",
  "src/components/career/ProfessionalTransitionDashboard.tsx",
  "src/components/career/LeagueDirectoryDashboard.tsx",
  "src/components/career/CollegeCareerDashboard.tsx",
  "src/components/career/CareerDrawer.tsx",
  "src/screens/CareerOverviewScreen.tsx",
];
const forbidden = [
  "Учтены все",
  "Автопилот",
  "ручное вмешательство",
  "Игрок сам выполняет",
  "Коснись джойстика",
  "Следи за мячом",
  "Матч упущен",
  "Победа закрыта",
  "Результат войдёт",
  "персонаж сам выполняет",
  "Решение о портале появится",
  "Выбери приоритет",
  "Симуляция остальных матчей",
  "Тренировка и решение штаба",
  "Контракты, рынок и новые ростеры",
  "latestEvent",
  "live-football__autopilot",
  "Матч упущен",
  "Индивидуальная оценка",
];
const errors = [];
for (const file of files) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  for (const phrase of forbidden) {
    if (source.includes(phrase)) errors.push(`${file}: forbidden copy: ${phrase}`);
  }
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Functional copy: ${files.length} interfaces checked.`);
