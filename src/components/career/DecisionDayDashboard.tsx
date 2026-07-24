import type { CareerSave } from "../../storage/saves/schema";
import type { CollegeEntryRoute } from "../../sports/football/college/types";
import { collegeDecisionPrograms, collegeEntryRouteFor } from "../../sports/football/college/transition";
import { recruitingRoleLabel } from "../../sports/football/recruiting/updateRecruiting";
import { Icon } from "../ui/Icon";

interface DecisionDayDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onSign(programId: string, route: CollegeEntryRoute): Promise<void>;
  onReportToCollege(): Promise<void>;
}

function routeLabel(route: CollegeEntryRoute): string {
  return route === "scholarship" ? "Стипендия" : "Preferred walk-on";
}

export function DecisionDayDashboard({ save, mutating, actionError, onSign, onReportToCollege }: DecisionDayDashboardProps) {
  const college = save.football.college;
  const options = collegeDecisionPrograms(save).slice(0, 6);

  if (save.football.season.phase !== "complete") return <div className="data-empty">Откроется после сезона</div>;

  if (college.status === "signed" && college.program) return (
    <div className="decision-data-page">
      <section className="decision-signed-card"><Icon name="check" /><div><small>{routeLabel(college.entryRoute ?? "scholarship")}</small><h3>{college.program.shortName}</h3><span>{college.program.city}, {college.program.stateCode}</span></div></section>
      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
      <button type="button" className="button button--primary button--wide" disabled={mutating} onClick={() => void onReportToCollege()}>{mutating ? "Переход…" : "Прибыть в колледж"}<Icon name="arrow-right" /></button>
    </div>
  );

  return (
    <div className="decision-data-page">
      <header className="data-page-head"><div><small>DECISION</small><h1>Выбор колледжа</h1></div><strong>{options.length}</strong></header>
      <section className="decision-season-line"><span>{save.football.season.wins}–{save.football.season.losses}</span><span>Видео {Math.round(save.football.recruitment.filmGrade)}</span><span>OVR {Math.round(save.football.ratings.overall)}</span></section>
      <div className="decision-options-list">
        {options.map((program) => {
          const route = collegeEntryRouteFor(save, program);
          if (!route) return null;
          const blocked = Boolean(save.football.recruitment.commitment && save.football.recruitment.commitment.programId !== program.id);
          return <article key={program.id}><div className="decision-option-main"><span>{program.shortName.slice(0, 2).toUpperCase()}</span><div><small>{routeLabel(route)} · {recruitingRoleLabel(program.projectedRole)}</small><strong>{program.shortName}</strong></div><em>{Math.round(program.interest)}</em></div><div className="decision-option-meta"><span>FIT <b>{Math.round(program.fit)}</b></span><span>DEPTH <b>{Math.round(program.depthCompetition)}</b></span><span>TRUST <b>{Math.round(program.staffTrust)}</b></span></div><button type="button" disabled={mutating || blocked} onClick={() => void onSign(program.id, route)}>{blocked ? "Заблокировано" : "Выбрать"}</button></article>;
        })}
        {options.length === 0 && <div className="data-empty">Нет доступных вариантов</div>}
      </div>
      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    </div>
  );
}
