import { formatShortGameDate } from "../../core/calendar/types";
import type { WeeklyReport } from "../../application/career/weekly/types";

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
    <section className="weekly-report weekly-report--result">
      <header className="weekly-report__head">
        <div><small>НЕДЕЛЯ {report.week} ЗАВЕРШЕНА</small><strong>{report.teamName}</strong><span>{formatShortGameDate(report.startDate)} — {formatShortGameDate(report.endDate)}</span></div>
        <b>{report.record}</b>
      </header>

      <div className={`weekly-scoreboard${report.match ? (report.match.won ? " is-win" : " is-loss") : ""}`}>
        <div><small>{report.match ? (report.match.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ") : "ИТОГ НЕДЕЛИ"}</small><strong>{report.summary}</strong>{report.match?.spotlight && <p>{report.match.spotlight}</p>}</div>
        {report.match && <span>{report.match.grade ?? "—"}<small>{report.match.snaps !== undefined ? `${report.match.snaps} снэпов` : "оценка"}</small></span>}
      </div>

      <div className="weekly-report__metrics">
        {report.metrics.slice(0, 4).map((metric) => (
          <article key={metric.id}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
            {metric.delta !== undefined && <em className={metric.delta >= 0 ? "is-positive" : "is-negative"}>{delta(metric.delta)}</em>}
          </article>
        ))}
      </div>

      <div className="weekly-report__composition">
        <section className="weekly-report__changes">
          <header><span /><strong>Что изменилось</strong></header>
          {report.changes.map((change) => <article className={`is-${change.tone}`} key={change.id}><i /><div><small>{change.label}</small><strong>{change.value}</strong><p>{change.detail}</p></div></article>)}
        </section>

        <section className="weekly-report__headlines">
          <header><span /><strong>В мире</strong></header>
          {report.headlines.length > 0
            ? report.headlines.map((headline) => <article key={headline.id}><i>{headline.importance}</i><div><strong>{headline.title}</strong><small>{headline.detail}</small></div></article>)
            : <div className="weekly-report__quiet"><strong>Тихая неделя</strong><small>Крупных событий вне команды не произошло.</small></div>}
        </section>
      </div>
    </section>
  );
}
