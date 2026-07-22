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
  return route === "scholarship" ? "Полная стипендия" : "Preferred walk-on";
}

function finalLine(save: CareerSave): string {
  const season = save.football.season;
  const awards = season.awards.length;
  return `${season.wins}–${season.losses} · ${awards} ${awards === 1 ? "награда" : "наград"} · ${Math.round(save.football.recruitment.filmGrade)} film grade`;
}

export function DecisionDayDashboard({ save, mutating, actionError, onSign, onReportToCollege }: DecisionDayDashboardProps) {
  const seasonComplete = save.football.season.phase === "complete";
  const college = save.football.college;
  const options = collegeDecisionPrograms(save).slice(0, 6);

  if (!seasonComplete) {
    return (
      <div className="compact-view">
        <div className="compact-note"><Icon name="lock" /><p>Формальный выбор откроется после последнего матча школьного сезона.</p></div>
      </div>
    );
  }

  if (college.status === "signed" && college.program) {
    return (
      <div className="compact-view decision-day-view">
        <section className="decision-signed-card">
          <span><Icon name="check" /></span>
          <div><small>ФОРМАЛЬНЫЙ ВЫБОР</small><h3>{college.program.shortName}</h3><p>{routeLabel(college.entryRoute ?? "scholarship")} · {college.program.city}, {college.program.stateCode}</p></div>
        </section>
        <section className="decision-final-summary">
          <small>ШКОЛЬНЫЙ ЭТАП</small>
          <strong>{finalLine(save)}</strong>
          <p>Следующий шаг промотает выпускной семестр и межсезонье. Развитие, здоровье, оценки и обещанная роль будут пересчитаны.</p>
        </section>
        {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
        <button type="button" className="button button--primary button--wide" disabled={mutating} onClick={() => void onReportToCollege()}>
          {mutating ? "Подготовка перехода…" : "Завершить школу и приехать в кампус"}
          {!mutating && <Icon name="arrow-right" />}
        </button>
      </div>
    );
  }

  return (
    <div className="compact-view decision-day-view">
      <section className="decision-command-card">
        <div><small>DECISION DAY</small><h3>Последний школьный выбор</h3><p>{finalLine(save)}</p></div>
        <span>{options.length}</span>
      </section>

      {save.football.recruitment.commitment?.status === "verbal" && (
        <div className="compact-note"><Icon name="message" /><p>Есть устный коммит. Формально подписать можно только эту программу, пока коммит не отозван.</p></div>
      )}

      {options.length === 0 ? (
        <section className="decision-no-options">
          <Icon name="shield" />
          <div><strong>Подходящих вариантов нет</strong><p>Нет активной стипендии или подтверждённого preferred walk-on. Карьера не подменяет провал бесплатным оффером.</p></div>
        </section>
      ) : (
        <div className="decision-options-list">
          {options.map((program) => {
            const route = collegeEntryRouteFor(save, program);
            if (!route) return null;
            const blockedByCommitment = Boolean(save.football.recruitment.commitment && save.football.recruitment.commitment.programId !== program.id);
            return (
              <article key={program.id}>
                <div className="decision-option-main">
                  <span>{program.shortName.slice(0, 2).toUpperCase()}</span>
                  <div><small>{routeLabel(route)} · {recruitingRoleLabel(program.projectedRole)}</small><strong>{program.shortName}</strong><p>{program.playerRead}</p></div>
                  <em>{Math.round(program.interest)}</em>
                </div>
                <div className="decision-option-meta">
                  <span>Fit <b>{Math.round(program.fit)}</b></span>
                  <span>Depth <b>{Math.round(program.depthCompetition)}</b></span>
                  <span>Trust <b>{Math.round(program.staffTrust)}</b></span>
                </div>
                <button type="button" disabled={mutating || blockedByCommitment} onClick={() => void onSign(program.id, route)}>
                  {blockedByCommitment ? "Сначала отозвать коммит" : route === "scholarship" ? "Подписать стипендию" : "Принять место walk-on"}
                </button>
              </article>
            );
          })}
        </div>
      )}
      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    </div>
  );
}
