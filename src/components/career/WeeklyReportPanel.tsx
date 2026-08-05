import { formatShortGameDate } from "../../core/calendar/types";
import type { WeeklyReport } from "../../application/career/weekly/types";
import { Icon } from "../ui/Icon";

interface WeeklyReportPanelProps {
  report?: WeeklyReport | undefined;
}

function delta(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return `${value > 0 ? "+" : ""}${value}`;
}

export function WeeklyReportPanel({ report }: WeeklyReportPanelProps) {
  if (!report) return null;
  return (
    <section className="weekly-report">
      <header className="weekly-report__head">
        <div><small>НЕДЕЛЯ {report.week} ЗАВЕРШЕНА</small><strong>{report.teamName}</strong><span>{formatShortGameDate(report.startDate)} — {formatShortGameDate(report.endDate)}</span></div>
        <b>{report.record}</b>
      </header>

      <div className={`weekly-report__result${report.match ? (report.match.won ? " is-win" : " is-loss") : ""}`}>
        <span><Icon name={report.match ? "football" : "calendar"} /></span>
        <div><strong>{report.summary}</strong>{report.match?.grade && <small>Оценка {report.match.grade}{report.match.snaps !== undefined ? ` · ${report.match.snaps} снэпов` : ""}</small>}</div>
      </div>

      <div className="weekly-report__metrics">
        {report.metrics.map((metric) => (
          <article key={metric.id}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
            {metric.delta !== undefined && <em className={metric.delta >= 0 ? "is-positive" : "is-negative"}>{delta(metric.delta)}</em>}
          </article>
        ))}
      </div>

      {report.headlines.length > 0 && (
        <div className="weekly-report__headlines">
          <header><span /><strong>В мире</strong></header>
          {report.headlines.map((headline) => <article key={headline.id}><i>{headline.importance}</i><div><strong>{headline.title}</strong><small>{headline.detail}</small></div></article>)}
        </div>
      )}
    </section>
  );
}
