import type { ReactNode } from "react";
import type { WeeklyReport } from "../../application/career/weekly/types";
import type { CareerSave } from "../../storage/saves/schema";
import { Icon } from "../ui/Icon";
import { SeasonTimelinePanel } from "./SeasonTimelinePanel";
import { WeeklyReportPanel } from "./WeeklyReportPanel";

export interface CareerWeekMetric {
  label: string;
  value: string | number;
  detail?: string;
}

interface CareerWeekCenterProps {
  save: CareerSave;
  report?: WeeklyReport;
  phaseLabel: string;
  weekLabel: string;
  teamName: string;
  teamCode: string;
  record: string;
  opponentName?: string;
  opponentCode?: string;
  opponentMeta?: string;
  metrics: CareerWeekMetric[];
  preparationLabel: string;
  preparationDetail: string;
  mutating: boolean;
  disabled?: boolean;
  actionLabel?: string;
  actionMeta?: string;
  actionError?: string;
  extraAction?: ReactNode;
  onAdvanceWeek(): Promise<void>;
}

export function CareerWeekCenter({
  save,
  report,
  phaseLabel,
  weekLabel,
  teamName,
  teamCode,
  record,
  opponentName,
  opponentCode,
  opponentMeta,
  metrics,
  preparationLabel,
  preparationDetail,
  mutating,
  disabled = false,
  actionLabel = "ПРОДОЛЖИТЬ НЕДЕЛЮ",
  actionMeta = "Подготовка · мир · матч",
  actionError,
  extraAction,
  onAdvanceWeek,
}: CareerWeekCenterProps) {
  return (
    <div className="career-week-center">
      {report && <WeeklyReportPanel report={report} />}

      <section className="career-week-stage">
        <header className="career-week-stage__head">
          <div><small>{phaseLabel}</small><strong>{weekLabel}</strong></div>
          <span>{record}</span>
        </header>

        <div className="career-week-matchup">
          <article className="career-week-matchup__team is-hero"><span>{teamCode}</span><div><small>ТВОЯ КОМАНДА</small><strong>{teamName}</strong></div></article>
          <b>VS</b>
          <article className="career-week-matchup__team"><span>{opponentCode ?? "—"}</span><div><small>{opponentMeta ?? "СЛЕДУЮЩИЙ МАТЧ"}</small><strong>{opponentName ?? "Нет матча"}</strong></div></article>
        </div>

        <div className="career-week-stage__metrics">
          {metrics.slice(0, 4).map((metric) => <article key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong>{metric.detail && <span>{metric.detail}</span>}</article>)}
        </div>

        <div className="career-week-stage__plan">
          <span />
          <div><small>ПЛАН ШТАБА</small><strong>{preparationLabel}</strong><p>{preparationDetail}</p></div>
        </div>

        {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
        <button type="button" className="primary-action-bar weekly-advance-button career-week-stage__action" disabled={mutating || disabled} onClick={() => void onAdvanceWeek()}>
          <span><small>{actionMeta}</small><strong>{mutating ? "РАСЧЁТ НЕДЕЛИ…" : disabled ? "СЕЗОН ЗАВЕРШЁН" : actionLabel}</strong></span><Icon name="arrow-right" />
        </button>
        {extraAction}
      </section>

      <SeasonTimelinePanel save={save} />
    </div>
  );
}
