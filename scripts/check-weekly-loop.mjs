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
  center: read("src/components/career/CareerWeekCenter.tsx"),
  timeline: read("src/components/career/SeasonTimelinePanel.tsx"),
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
  [files.today, "CareerWeekCenter", "school home does not use the shared weekly center"],
  [files.college, "CareerWeekCenter", "college home does not use the shared weekly center"],
  [files.professional, "CareerWeekCenter", "professional home does not use the shared weekly center"],
  [files.panel, "weekly-report__changes", "weekly report does not expose career changes"],
  [files.panel, "weekly-scoreboard", "weekly report has no strong result composition"],
  [files.center, "career-week-stage__action", "main career screen has no single dominant action"],
  [files.timeline, "season-timeline__track", "main career screen has no persistent season history"],
];
const failures = required.filter(([source, token]) => !source.includes(token)).map(([, , message]) => message);

if (files.today.includes("onAdvanceDay") || files.today.includes("onUpdatePlan") || files.today.includes("relationship-event-options")) failures.push("school home still exposes daily or branching controls");
if (files.college.includes("onUpdateTrainingPlan") || files.college.includes("MatchDashboard")) failures.push("college home still exposes manual preparation or mandatory match routing");
if (files.professional.includes("onSetProfessionalWeekFocus") || files.professional.includes("MatchDashboard")) failures.push("professional home still exposes manual weekly planning or match routing");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("One-button weekly loop: OK (single action, result composition and persistent season timeline).");
