import type { WeeklyPlanState, ScheduleActivity } from "./types";

const schoolDay = (title = "Senior classes"): ScheduleActivity => ({
  id: "school",
  time: "08:00",
  durationMinutes: 390,
  type: "school",
  title,
  location: "Main campus",
  mandatory: true,
  impact: "Attendance · GPA",
});

const dayActivities: readonly (readonly ScheduleActivity[])[] = [
  [
    schoolDay("Senior orientation"),
    { id: "baseline", time: "15:15", durationMinutes: 90, type: "football", title: "Baseline testing", location: "Performance field", mandatory: true, impact: "Coach trust · Load" },
    { id: "position", time: "18:00", durationMinutes: 60, type: "football", title: "Position meeting", location: "Film room", mandatory: true, impact: "Football IQ" },
  ],
  [
    schoolDay(),
    { id: "technique", time: "15:30", durationMinutes: 105, type: "football", title: "Position technique", location: "Practice field", mandatory: true, impact: "Technique · Fatigue" },
    { id: "recovery", time: "18:10", durationMinutes: 35, type: "recovery", title: "Mobility block", location: "Training room", mandatory: false, impact: "Recovery" },
  ],
  [
    schoolDay("Academic checkpoint"),
    { id: "team", time: "15:20", durationMinutes: 120, type: "football", title: "Full team practice", location: "Stadium field", mandatory: true, impact: "Coach trust · Load" },
    { id: "study", time: "19:30", durationMinutes: 70, type: "study", title: "Assignment block", location: "Home", mandatory: false, impact: "GPA · Stress" },
  ],
  [
    schoolDay(),
    { id: "install", time: "15:15", durationMinutes: 115, type: "football", title: "Scheme install", location: "Practice field", mandatory: true, impact: "Football IQ · Technique" },
    { id: "film", time: "18:30", durationMinutes: 50, type: "study", title: "Opponent film", location: "Film room", mandatory: false, impact: "Preparation" },
  ],
  [
    schoolDay("Friday classes"),
    { id: "walkthrough", time: "14:50", durationMinutes: 70, type: "football", title: "Tempo walkthrough", location: "Stadium field", mandatory: true, impact: "Preparation · Low load" },
    { id: "treatment", time: "16:20", durationMinutes: 40, type: "recovery", title: "Treatment window", location: "Training room", mandatory: false, impact: "Health · Recovery" },
  ],
  [
    { id: "scrimmage", time: "10:00", durationMinutes: 135, type: "football", title: "Controlled scrimmage", location: "Stadium", mandatory: true, impact: "Evaluation · High load" },
    { id: "review", time: "14:30", durationMinutes: 45, type: "study", title: "Personal review", location: "Home", mandatory: false, impact: "Football IQ" },
    { id: "social", time: "19:00", durationMinutes: 120, type: "personal", title: "Free evening", location: "Off campus", mandatory: false, impact: "Stress · Relationships" },
  ],
  [
    { id: "sleep", time: "09:00", durationMinutes: 90, type: "recovery", title: "Extended sleep", location: "Home", mandatory: false, impact: "Energy · Recovery" },
    { id: "planning", time: "16:00", durationMinutes: 45, type: "study", title: "Weekly reset", location: "Home", mandatory: false, impact: "Consistency" },
    { id: "family", time: "18:00", durationMinutes: 120, type: "personal", title: "Family time", location: "Home", mandatory: false, impact: "Stress · Support" },
  ],
] as const;

function cloneActivity(activity: ScheduleActivity): ScheduleActivity {
  return { ...activity };
}

export function buildDaySchedule(dayIndex: number, plan: WeeklyPlanState): ScheduleActivity[] {
  const base = dayActivities[dayIndex] ?? dayActivities[0];
  if (!base) {
    throw new Error(`No schedule template for day ${dayIndex}`);
  }
  const activities = base.map(cloneActivity);

  const focus = plan.focus;
  if (focus.training >= 42 && dayIndex < 6) {
    activities.push({
      id: "extra-work",
      time: dayIndex === 5 ? "16:00" : "19:15",
      durationMinutes: plan.intensity === "aggressive" ? 65 : 45,
      type: "football",
      title: "Extra work",
      location: "Practice facility",
      mandatory: false,
      impact: "Development · Fatigue",
    });
  } else if (focus.recovery >= 36) {
    activities.push({
      id: "recovery-focus",
      time: "19:00",
      durationMinutes: 55,
      type: "recovery",
      title: "Recovery protocol",
      location: "Home",
      mandatory: false,
      impact: "Sleep · Health",
    });
  } else if (focus.study >= 38) {
    activities.push({
      id: "study-focus",
      time: "19:00",
      durationMinutes: 75,
      type: "study",
      title: "Focused study block",
      location: "Library",
      mandatory: false,
      impact: "GPA · Eligibility",
    });
  }

  return activities.sort((left, right) => left.time.localeCompare(right.time));
}
