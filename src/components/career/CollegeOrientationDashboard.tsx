import type { CareerSave } from "../../storage/saves/schema";
import type { CollegeOnboardingPriority } from "../../sports/football/college/types";
import type { ProjectedCollegeRole } from "../../sports/football/recruiting/types";
import { Icon } from "../ui/Icon";

interface CollegeOrientationDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onSetPriority(priority: CollegeOnboardingPriority): Promise<void>;
}

function roleLabel(role: ProjectedCollegeRole | undefined): string {
  if (!role) return "—";
  return {
    "immediate-competition": "Ротация",
    "rotation-path": "Глубина",
    developmental: "Развитие",
    "long-shot": "Резерв",
  }[role];
}

const priorities: readonly {
  id: CollegeOnboardingPriority;
  title: string;
  icon: "target" | "brain" | "book";
  stats: readonly string[];
}[] = [
  { id: "compete-now", title: "Повторы", icon: "target", stats: ["CONF +3", "STRESS +4"] },
  { id: "learn-system", title: "Система", icon: "brain", stats: ["IQ +0.8", "STRESS −1"] },
  { id: "academic-base", title: "Учёба", icon: "book", stats: ["GPA +0.06", "STRESS −2"] },
];

export function CollegeOrientationDashboard({ save, mutating, actionError, onSetPriority }: CollegeOrientationDashboardProps) {
  const college = save.football.college;
  const program = college.program;
  if (!program || college.status !== "orientation") return null;

  const offseason = college.offseason;

  return (
    <div className="college-orientation-v27">
      <header className="college-orientation-v27__head">
        <div><small>{program.city}, {program.stateCode}</small><h1>{program.name}</h1><span>{save.football.position} · #{college.depthRank ?? "—"}</span></div>
        <strong>{Math.round(save.football.ratings.overall)}<small>OVR</small></strong>
      </header>

      <section className="college-orientation-v27__metrics">
        <article><small>Обещали</small><strong>{roleLabel(college.projectedRole)}</strong></article>
        <article><small>Получил</small><strong>{roleLabel(college.actualRole)}</strong></article>
        <article><small>Престиж</small><strong>{program.prestige}</strong></article>
        <article><small>Маршрут</small><strong>{college.entryRoute === "scholarship" ? "Scholarship" : "Walk-on"}</strong></article>
      </section>

      <section className="college-orientation-v27__priority">
        <header><span>ПРИОРИТЕТ</span><strong>{college.onboardingPriority ? priorities.find((item) => item.id === college.onboardingPriority)?.title : "Не выбран"}</strong></header>
        <div>
          {priorities.map((priority) => (
            <button type="button" key={priority.id} className={college.onboardingPriority === priority.id ? "is-active" : ""} disabled={mutating || Boolean(college.onboardingPriority)} onClick={() => void onSetPriority(priority.id)}>
              <Icon name={priority.icon} />
              <strong>{priority.title}</strong>
              <span>{priority.stats.map((stat) => <small key={stat}>{stat}</small>)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="college-orientation-v27__room">
        <header><span>DEPTH CHART</span><strong>{college.positionRoom.length}</strong></header>
        {college.positionRoom.map((player) => (
          <article key={player.id} className={player.isHero ? "is-hero" : ""}>
            <span>{player.depthRank}</span>
            <div><strong>{player.name}</strong><small>{player.year}{player.redshirt ? " · RS" : ""} · {player.style}</small></div>
            <em>{Math.round(player.overall)}</em>
          </article>
        ))}
      </section>

      <section className="college-orientation-v27__offseason">
        <header><span>OFFSEASON</span><strong>{offseason?.trainingGrade ?? "—"}</strong></header>
        <div>
          <article><small>OVR</small><strong>{offseason?.overallDelta && offseason.overallDelta > 0 ? "+" : ""}{offseason?.overallDelta ?? 0}</strong></article>
          <article><small>Вес</small><strong>{offseason?.weightDelta && offseason.weightDelta > 0 ? "+" : ""}{offseason?.weightDelta ?? 0}</strong></article>
          <article><small>GPA</small><strong>{offseason?.gpaDelta && offseason.gpaDelta > 0 ? "+" : ""}{offseason?.gpaDelta ?? 0}</strong></article>
          <article><small>HP</small><strong>{offseason?.healthDelta && offseason.healthDelta > 0 ? "+" : ""}{offseason?.healthDelta ?? 0}</strong></article>
        </div>
      </section>

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    </div>
  );
}
