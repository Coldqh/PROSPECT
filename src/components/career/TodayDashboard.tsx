import type { CSSProperties } from "react";
import type { WeeklyReport } from "../../application/career/weekly/types";
import { addGameDays, formatGameDate, formatWeekday, toGameDateKey } from "../../core/calendar/types";
import type { MedicalStatus } from "../../sports/football/training/types";
import type { CareerSave } from "../../storage/saves/schema";
import { Icon } from "../ui/Icon";
import { teamBrandStyle } from "./teamBrand";
import { WeeklyReportPanel } from "./WeeklyReportPanel";

const weekdayLabels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"] as const;

function medicalLabel(status: MedicalStatus): string {
  return {
    cleared: "Допущен",
    questionable: "Под вопросом",
    limited: "Ограничен",
    out: "Вне работы",
  }[status];
}

interface TodayDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  weeklyReport?: WeeklyReport;
  onAdvanceWeek(): Promise<void>;
}

export function TodayDashboard({ save, mutating, actionError, weeklyReport, onAdvanceWeek }: TodayDashboardProps) {
  const { character, football, life } = save;
  const body = football.training.body;
  const weekStart = addGameDays(save.meta.currentDate, -life.dayIndex);
  const scheduledMatch = football.match.status === "upcoming" || football.match.status === "in-progress" || football.match.status === "complete"
    ? football.match
    : undefined;
  const currentTeamName = football.college.program?.shortName ?? football.school.shortName;
  const currentRole = football.college.heroCareer?.role ?? football.depthChart.projectedRole;
  const seasonRecord = `${football.season.wins}–${football.season.losses}`;
  const pageStyle = football.college.program
    ? teamBrandStyle(football.college.program.id)
    : ({
        "--team-primary": football.school.primaryColor,
        "--team-secondary": football.school.secondaryColor,
        "--team-ink": "#ffffff",
        "--team-hue": "354",
      } as CSSProperties);
  const nextOpponent = scheduledMatch?.opponentName ?? football.season.nextOpponent.name;
  const matchLabel = scheduledMatch?.status === "complete"
    ? `${scheduledMatch.heroScore}:${scheduledMatch.opponentScore}`
    : `Неделя ${football.season.week}`;

  return (
    <div className="dynasty-page dynasty-home-page" style={pageStyle}>
      <header className="dynasty-page-head">
        <div className="dynasty-page-head__badge">WK</div>
        <div><strong>Карьера</strong><small>{formatWeekday(save.meta.currentDate).toUpperCase()} · НЕДЕЛЯ {life.weekNumber}</small></div>
      </header>

      <section className="dynasty-context-bar">
        <article><small>Команда</small><strong>{currentTeamName}</strong></article>
        <article><small>Рекорд</small><strong>{seasonRecord}</strong></article>
        <article><small>OVR</small><strong>{Math.round(football.ratings.overall)}</strong></article>
        <article><small>Роль</small><strong>{currentRole}</strong></article>
        <article><small>Дата</small><strong>{formatGameDate(save.meta.currentDate)}</strong></article>
      </section>

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
      <WeeklyReportPanel report={weeklyReport} />

      <div className="dynasty-stack">
        <section className="dynasty-panel dynasty-week-panel">
          <header><div><small>Текущая неделя</small><strong>Автоматический цикл</strong></div><span>{life.dayIndex + 1}/7</span></header>
          <div className="dynasty-week-days" aria-label="Текущая игровая неделя">
            {weekdayLabels.map((label, index) => {
              const date = addGameDays(weekStart, index);
              const matchOnDate = scheduledMatch && toGameDateKey(scheduledMatch.scheduledDate) === toGameDateKey(date);
              const className = [index < life.dayIndex ? "is-complete" : index === life.dayIndex ? "is-current" : "", matchOnDate ? "is-game" : ""].filter(Boolean).join(" ");
              return <span className={className} key={label}><small>{label}</small><strong>{date.day}</strong>{matchOnDate && <em>GAME</em>}</span>;
            })}
          </div>
        </section>

        <section className="weekly-composition-card">
          <header><small>СЛЕДУЮЩАЯ НЕДЕЛЯ</small><strong>Матч против {nextOpponent}</strong><span>{matchLabel}</span></header>
          <div>
            <article><small>Готовность</small><strong>{Math.round(body.readiness)}</strong></article>
            <article><small>Здоровье</small><strong>{Math.round(character.condition.health)}</strong></article>
            <article><small>Доверие</small><strong>{Math.round(football.depthChart.coachTrust)}</strong></article>
            <article><small>Статус</small><strong>{medicalLabel(body.medicalStatus)}</strong></article>
          </div>
          <p>Тренировки, восстановление, отношения, рекрутинг и матч рассчитываются автоматически.</p>
        </section>

        {life.lastOutcome && (
          <section className="weekly-last-note">
            <span>{life.lastOutcome.grade}</span>
            <div><small>Последний день</small><strong>{life.lastOutcome.title}</strong><p>{life.lastOutcome.summary}</p></div>
          </section>
        )}

        <button type="button" className="dynasty-primary-action weekly-advance-button" disabled={mutating} onClick={() => void onAdvanceWeek()}>
          <span><small>7 дней · автоматический матч</small><strong>{mutating ? "РАСЧЁТ НЕДЕЛИ…" : "ПРОДОЛЖИТЬ НЕДЕЛЮ"}</strong></span>
          <Icon name="arrow-right" />
        </button>
      </div>
    </div>
  );
}
