import { useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { CollegeOnboardingPriority } from "../../sports/football/college/types";
import type { ProjectedCollegeRole } from "../../sports/football/recruiting/types";
import { formatGameDate } from "../../core/calendar/types";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "arrival", label: "Старт" },
  { id: "program", label: "Программа" },
  { id: "room", label: "Depth" },
  { id: "journey", label: "Путь" },
] as const;
type ViewId = (typeof views)[number]["id"];

interface CollegeOrientationDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onSetPriority(priority: CollegeOnboardingPriority): Promise<void>;
}

function roleLabel(role: ProjectedCollegeRole | undefined): string {
  if (!role) return "Не определена";
  return {
    "immediate-competition": "Борьба за ротацию",
    "rotation-path": "Путь через ротацию",
    developmental: "Развитие",
    "long-shot": "Дальний состав",
  }[role];
}

const priorities: readonly { id: CollegeOnboardingPriority; title: string; detail: string; icon: "target" | "brain" | "book" }[] = [
  { id: "compete-now", title: "Сразу за повторы", detail: "Выше давление и стресс, но герой заявляет о себе в лагере.", icon: "target" },
  { id: "learn-system", title: "Выучить систему", detail: "Спокойнее вход в программу и быстрый рост football IQ.", icon: "brain" },
  { id: "academic-base", title: "Закрыть учёбу", detail: "Меньше риска потерять eligibility в первый семестр.", icon: "book" },
];

export function CollegeOrientationDashboard({ save, mutating, actionError, onSetPriority }: CollegeOrientationDashboardProps) {
  const [view, setView] = useState<ViewId>("arrival");
  const college = save.football.college;
  const program = college.program;
  if (!program || college.status !== "orientation") return null;

  const offseason = college.offseason;
  const hero = college.positionRoom.find((player) => player.isHero);

  return (
    <div className="college-orientation-shell">
      <header className="college-compact-head">
        <div><small>FRESHMAN YEAR · {program.city}, {program.stateCode}</small><h1>{program.shortName}</h1><p>{save.character.identity.fullName} · {save.football.position} · #{college.depthRank ?? "—"} в комнате</p></div>
        <span><small>OVR</small><strong>{Math.round(save.football.ratings.overall)}</strong></span>
      </header>
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Первый год колледжа" />

      {view === "arrival" && (
        <div className="compact-view college-arrival-view">
          <section className={`college-role-verdict is-${college.promiseVerdict ?? "uncertain"}`}>
            <div><small>РЕАЛЬНОСТЬ ПОСЛЕ ПРИЕЗДА</small><h3>{roleLabel(college.actualRole)}</h3></div>
            <span>#{college.depthRank ?? "—"}</span>
            <p>{college.promiseSummary}</p>
          </section>
          <div className="compact-stat-pair">
            <article><small>Обещали</small><strong>{roleLabel(college.projectedRole)}</strong><span>во время рекрутинга</span></article>
            <article><small>Получил</small><strong>{roleLabel(college.actualRole)}</strong><span>после первого собрания</span></article>
          </div>
          <section className="college-priority-card">
            <small>ПЕРВЫЙ ПРИОРИТЕТ</small>
            <h3>{college.onboardingPriority ? priorities.find((item) => item.id === college.onboardingPriority)?.title : "Выбери подход"}</h3>
            <div>
              {priorities.map((priority) => (
                <button type="button" key={priority.id} className={college.onboardingPriority === priority.id ? "is-active" : ""} disabled={mutating || Boolean(college.onboardingPriority)} onClick={() => void onSetPriority(priority.id)}>
                  <Icon name={priority.icon} /><span><strong>{priority.title}</strong><small>{priority.detail}</small></span>
                </button>
              ))}
            </div>
          </section>
          {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
        </div>
      )}

      {view === "program" && (
        <div className="compact-view">
          <section className="college-program-card"><div><small>{program.tier.toUpperCase()}</small><h3>{program.name}</h3><p>{program.scheme}</p></div><strong>{program.prestige}</strong></section>
          <div className="college-program-grid">
            <article><small>Facilities</small><strong>{program.facilities}</strong></article>
            <article><small>Medicine</small><strong>{program.medicine}</strong></article>
            <article><small>Youth</small><strong>{program.youthOpportunity}</strong></article>
            <article><small>Route</small><strong>{college.entryRoute === "scholarship" ? "Scholarship" : "Walk-on"}</strong></article>
          </div>
          <div className="info-list info-list--compact">
            <span><small>Главный тренер</small><strong>{program.headCoachName}</strong></span>
            <span><small>Рекрутер</small><strong>{program.recruiterName}</strong></span>
            <span><small>Прибытие</small><strong>{college.arrivalDate ? formatGameDate(college.arrivalDate) : "—"}</strong></span>
          </div>
        </div>
      )}

      {view === "room" && (
        <div className="compact-view college-room-list">
          {college.positionRoom.map((player) => (
            <article key={player.id} className={player.isHero ? "is-hero" : ""}>
              <span>{player.depthRank}</span>
              <div><strong>{player.name}</strong><small>{player.year}{player.redshirt ? " · RS" : ""} · {player.style}</small></div>
              <em>{Math.round(player.overall)}</em>
            </article>
          ))}
          <div className="compact-note"><Icon name="shield" /><p>Порядок не окончательный. Он отражает опыт, обещанную роль, качество состава и первое мнение штаба до лагеря.</p></div>
        </div>
      )}

      {view === "journey" && (
        <div className="compact-view">
          <section className="college-offseason-card">
            <div><small>OFFSEASON</small><h3>{offseason?.trainingGrade ?? "—"}</h3><p>{offseason?.summary}</p></div>
          </section>
          <div className="college-transition-grid">
            <article><small>OVR</small><strong>{offseason?.overallDelta && offseason.overallDelta > 0 ? "+" : ""}{offseason?.overallDelta ?? 0}</strong></article>
            <article><small>Вес</small><strong>{offseason?.weightDelta && offseason.weightDelta > 0 ? "+" : ""}{offseason?.weightDelta ?? 0} lb</strong></article>
            <article><small>GPA</small><strong>{offseason?.gpaDelta && offseason.gpaDelta > 0 ? "+" : ""}{offseason?.gpaDelta ?? 0}</strong></article>
            <article><small>Здоровье</small><strong>{offseason?.healthDelta && offseason.healthDelta > 0 ? "+" : ""}{offseason?.healthDelta ?? 0}</strong></article>
          </div>
          <section className="college-high-school-summary"><small>ШКОЛЬНЫЙ ФИНАЛ</small><strong>{save.football.season.wins}–{save.football.season.losses}</strong><p>{save.football.season.awards.length} наград · {Math.round(save.football.recruitment.filmGrade)} film grade · {hero?.overall ?? save.football.ratings.overall} OVR к приезду</p></section>
        </div>
      )}
    </div>
  );
}
