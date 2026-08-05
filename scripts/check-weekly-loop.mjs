import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = {
  service: read("src/application/career/CareerCommandService.ts"),
  command: read("src/application/career/commands/CareerWeekCommands.ts"),
  advance: read("src/application/career/weekly/advanceCareerWeek.ts"),
  report: read("src/application/career/weekly/buildWeeklyReport.ts"),
  hook: read("src/hooks/useCareerSave.ts"),
  today: read("src/components/career/TodayDashboard.tsx"),
  college: read("src/components/career/CollegeCareerDashboard.tsx"),
  professional: read("src/components/career/ProfessionalTransitionDashboard.tsx"),
  panel: read("src/components/career/WeeklyReportPanel.tsx"),
};

const required = [
  [files.service, "advanceWeek(careerId", "career command facade has no weekly command"],
  [files.command, "buildWeeklyReport", "weekly command does not return a report"],
  [files.advance, 'startMatch(current, "auto", false)', "weekly loop does not auto-simulate matches"],
  [files.advance, "resolveAutomaticRelationshipEvents", "school blockers are not automated"],
  [files.advance, "resolveAutomaticCollegeDecisions", "college blockers are not automated"],
  [files.advance, "automaticProfessionalFocus", "professional preparation is not automated"],
  [files.report, "newHeadlines", "weekly report has no world composition"],
  [files.hook, "weeklyReport", "weekly report is not exposed to UI"],
  [files.today, "ПРОДОЛЖИТЬ НЕДЕЛЮ", "school home has no single weekly action"],
  [files.college, "ПРОДОЛЖИТЬ НЕДЕЛЮ", "college home has no single weekly action"],
  [files.professional, "ПРОДОЛЖИТЬ НЕДЕЛЮ", "professional home has no single weekly action"],
  [files.panel, "weekly-report__headlines", "weekly report composition is incomplete"],
];
const failures = required.filter(([source, token]) => !source.includes(token)).map(([, , message]) => message);

if (files.today.includes("onAdvanceDay") || files.today.includes("onUpdatePlan") || files.today.includes("relationship-event-options")) failures.push("school home still exposes daily or branching controls");
if (files.college.includes("onUpdateTrainingPlan") || files.college.includes("MatchDashboard")) failures.push("college home still exposes manual preparation or mandatory match routing");
if (files.professional.includes("onSetProfessionalWeekFocus") || files.professional.includes("MatchDashboard")) failures.push("professional home still exposes manual weekly planning or match routing");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("One-button weekly loop: OK (automatic preparation, match, world advance and compact report).");
