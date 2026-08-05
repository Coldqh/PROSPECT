import type { CSSProperties } from "react";
import type { WeeklyReport } from "../../application/career/weekly/types";
import { formatGameDate, formatWeekday } from "../../core/calendar/types";
import type { MedicalStatus } from "../../sports/football/training/types";
import type { CareerSave } from "../../storage/saves/schema";
import { CareerWeekCenter } from "./CareerWeekCenter";
import { teamBrandStyle } from "./teamBrand";

function medicalLabel(status: MedicalStatus): string {
  return {
    cleared: "Допущен",
    questionable: "Под вопросом",
    limited: "Ограничен",
    out: "Вне состава",
  }[status];
}

function roleLabel(role: string): string {
  return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие", reserve: "Резерв", "first-team": "Первая команда", "second-team": "Вторая команда" }[role] ?? role;
}

interface TodayDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  weeklyReport?: WeeklyReport;
  onAdvanceWeek(): Promise<void>;
}

export function TodayDashboard({ save, mutating, actionError, weeklyReport, onAdvanceWeek }: TodayDashboardProps) {
  const { football, life } = save;
  const body = football.training.body;
  const scheduled = football.season.schedule.find((game) => game.status === "scheduled");
  const standings = [...football.season.standings].sort((left, right) => right.wins - left.wins || (right.pointsFor - right.pointsAgainst) - (left.pointsFor - left.pointsAgainst) || right.rating - left.rating);
  const standing = standings.findIndex((team) => team.isHeroTeam) + 1;
  const currentRole = football.depthChart.projectedRole;
  const pageStyle = football.college.program
    ? teamBrandStyle(football.college.program.id)
    : ({
        "--team-primary": football.school.primaryColor,
        "--team-secondary": football.school.secondaryColor,
        "--team-ink": "#ffffff",
        "--team-hue": "354",
      } as CSSProperties);

  return (
    <div className="dynasty-page dynasty-home-page" style={pageStyle}>
      <header className="dynasty-page-head">
        <div className="dynasty-page-head__badge">WK</div>
        <div><strong>Карьера</strong><small>{formatWeekday(save.meta.currentDate).toUpperCase()} · {formatGameDate(save.meta.currentDate)}</small></div>
      </header>

      <CareerWeekCenter
        save={save}
        {...(weeklyReport ? { report: weeklyReport } : {})}
        phaseLabel="ШКОЛЬНЫЙ СЕЗОН"
        weekLabel={`Неделя ${life.weekNumber}`}
        teamName={football.school.name}
        teamCode={football.school.shortName}
        record={`${football.season.wins}–${football.season.losses}`}
        opponentName={scheduled?.opponentName ?? football.season.nextOpponent.name}
        opponentCode={scheduled?.opponentShortName ?? "NEXT"}
        opponentMeta={scheduled ? `W${scheduled.week} · OVR ${Math.round(scheduled.opponentRating)}` : "СЛЕДУЮЩИЙ МАТЧ"}
        metrics={[
          { label: "Роль", value: roleLabel(currentRole) },
          { label: "Форма", value: Math.round(body.readiness), detail: medicalLabel(body.medicalStatus) },
          { label: "OVR", value: Math.round(football.ratings.overall) },
          { label: "Таблица", value: standing > 0 ? `#${standing}` : "—", detail: `${standings.length} команд` },
        ]}
        preparationLabel={body.activeIssue ? "Восстановление" : football.training.plan.focusId === "film-install" ? "Разбор игры" : football.training.plan.focusId === "explosive-power" ? "Физическая работа" : "Позиционная техника"}
        preparationDetail="Штаб сам проводит тренировки, двигает состав и рассчитывает матч. Ты видишь только итог недели."
        mutating={mutating}
        actionMeta="7 дней · автоматический матч"
        {...(actionError ? { actionError } : {})}
        onAdvanceWeek={onAdvanceWeek}
      />
    </div>
  );
}
