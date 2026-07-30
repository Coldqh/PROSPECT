import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { RecruitingActionId, RecruitingProgram, RecruitingStage } from "../../sports/football/recruiting/types";
import { recruitingActionsRemaining, recruitingRoleLabel, recruitingStageLabel } from "../../sports/football/recruiting/updateRecruiting";
import { OverlayDialog } from "../ui/OverlayDialog";
import { Icon } from "../ui/Icon";

type RecruitingView = "programs" | "offers" | "visits";

const actionCopy: Record<RecruitingActionId, { label: string; effect: string }> = {
  "send-film": { label: "Отправить видео", effect: "SCOUT" },
  "coach-call": { label: "Звонок тренера", effect: "TRUST" },
  "send-transcript": { label: "Отправить GPA", effect: "GPA" },
  "declare-interest": { label: "Подтвердить интерес", effect: "INTEREST" },
  "recruiter-call": { label: "Разговор со штабом", effect: "ROLE" },
  "schedule-visit": { label: "Назначить визит", effect: "VISIT" },
};

interface RecruitingDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onAction(programId: string, actionId: RecruitingActionId): Promise<void>;
  onCommit(programId: string): Promise<void>;
  onWithdrawCommitment(): Promise<void>;
}

function stageClass(stage: RecruitingStage): string {
  if (stage === "offered") return "is-offer";
  if (stage === "priority" || stage === "contact") return "is-hot";
  return "";
}

function tierLabel(program: RecruitingProgram): string {
  return { national: "NATIONAL", power: "POWER", regional: "REGIONAL", developmental: "DEVELOPMENTAL" }[program.tier];
}

function visitLabel(program: RecruitingProgram): string {
  return { none: "—", invited: "INVITED", scheduled: "SCHEDULED", completed: "COMPLETE" }[program.visitStatus];
}

function availableActions(program: RecruitingProgram): RecruitingActionId[] {
  if (program.stage === "cooled") return [];
  const actions: RecruitingActionId[] = [];
  if (["unaware", "watchlist", "evaluating"].includes(program.stage)) actions.push("send-film");
  if (program.stage !== "unaware") actions.push("send-transcript");
  if (["watchlist", "evaluating", "contact", "priority"].includes(program.stage)) actions.push("coach-call");
  if (["contact", "priority", "offered"].includes(program.stage)) actions.push("recruiter-call", "declare-interest");
  if (program.visitStatus === "invited") actions.unshift("schedule-visit");
  return [...new Set(actions)].slice(0, 4);
}

export function RecruitingDashboard({ save, mutating, actionError, onAction, onCommit, onWithdrawCommitment }: RecruitingDashboardProps) {
  const [view, setView] = useState<RecruitingView>("programs");
  const [selectedId, setSelectedId] = useState<string>();
  const recruitment = save.football.recruitment;
  const actionsRemaining = recruitingActionsRemaining(recruitment, save.football.season.week);
  const programs = useMemo(() => recruitment.programs
    .filter((program) => program.stage !== "unaware" && program.stage !== "cooled")
    .sort((left, right) => Number(Boolean(right.offer)) - Number(Boolean(left.offer)) || right.interest - left.interest), [recruitment.programs]);
  const offers = programs.filter((program) => Boolean(program.offer));
  const visits = programs.filter((program) => program.visitStatus !== "none");
  const visible = view === "offers" ? offers : view === "visits" ? visits : programs;
  const selected = recruitment.programs.find((program) => program.id === selectedId);
  const committed = recruitment.commitment ? recruitment.programs.find((program) => program.id === recruitment.commitment?.programId) : undefined;

  async function runAction(actionId: RecruitingActionId) {
    if (!selected || mutating || actionsRemaining <= 0 || recruitment.commitment) return;
    await onAction(selected.id, actionId);
    setSelectedId(undefined);
  }

  return (
    <div className="recruiting-page">
      <header className="data-page-head"><div><small>RECRUITING</small><h1>Рекрутинг</h1></div><strong>{offers.length}</strong></header>
      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      <section className="recruiting-status-strip">
        <article><small>Ранг</small><strong>{recruitment.regionalRankLabel}</strong></article>
        <article><small>Офферы</small><strong>{offers.length}</strong></article>
        <article><small>Действия</small><strong>{actionsRemaining}/2</strong></article>
        <article><small>Видео</small><strong>{Math.round(recruitment.filmGrade)}</strong></article>
        <article><small>GPA</small><strong>{save.character.education.gpa.toFixed(2)}</strong></article>
        <article><small>Визиты</small><strong>{visits.length}</strong></article>
      </section>

      {committed && (
        <section className="recruiting-commit-row"><Icon name="check" /><div><small>{recruitment.commitment?.status === "signed" ? "SIGNED" : "COMMIT"}</small><strong>{committed.shortName}</strong></div>{recruitment.commitment?.status === "verbal" && <button type="button" disabled={mutating} onClick={() => void onWithdrawCommitment()}>Отозвать</button>}</section>
      )}

      <nav className="compact-segmented recruiting-view-tabs" aria-label="Рекрутинг">
        <button type="button" className={view === "programs" ? "is-active" : ""} onClick={() => setView("programs")}>ПРОГРАММЫ {programs.length}</button>
        <button type="button" className={view === "offers" ? "is-active" : ""} onClick={() => setView("offers")}>ОФФЕРЫ {offers.length}</button>
        <button type="button" className={view === "visits" ? "is-active" : ""} onClick={() => setView("visits")}>ВИЗИТЫ {visits.length}</button>
      </nav>

      <section className="recruiting-data-section">
        <div className="recruiting-program-list">
          {visible.map((program) => (
            <button type="button" key={program.id} className={stageClass(program.stage)} onClick={() => setSelectedId(program.id)}>
              <span>{program.shortName.slice(0, 2).toUpperCase()}</span>
              <div>
                <small>{view === "visits" ? visitLabel(program) : `${recruitingStageLabel(program.stage)} · ${recruitingRoleLabel(program.projectedRole)}`}</small>
                <strong>{program.shortName}</strong>
                <em>FIT {Math.round(program.fit)} · NEED {Math.round(program.positionNeed)} · DEPTH {Math.round(program.depthCompetition)}</em>
              </div>
              <b>{view === "offers" ? `W${program.offer?.expiresAfterWeek ?? "—"}` : view === "visits" ? Math.round(program.officialVisit?.overallImpression ?? 0) || "—" : Math.round(program.interest)}</b>
            </button>
          ))}
          {visible.length === 0 && <div className="data-empty">0</div>}
        </div>
      </section>

      <OverlayDialog open={Boolean(selected)} onClose={() => setSelectedId(undefined)} eyebrow={selected ? tierLabel(selected) : "PROGRAM"} title={selected?.shortName ?? "Программа"} wide>
        {selected && <div className="recruiting-program-sheet recruiting-program-sheet--data">
          <div className="sheet-metric-pair"><article><small>INTEREST</small><strong>{Math.round(selected.interest)}</strong></article><article><small>FIT</small><strong>{Math.round(selected.fit)}</strong></article></div>
          <div className="recruiting-fit-grid">
            <article><small>NEED</small><strong>{Math.round(selected.positionNeed)}</strong></article>
            <article><small>DEPTH</small><strong>{Math.round(selected.depthCompetition)}</strong></article>
            <article><small>TRUST</small><strong>{Math.round(selected.staffTrust)}</strong></article>
            <article><small>ROLE</small><strong>{Math.round(selected.roleClarity)}</strong></article>
          </div>
          <div className="info-list info-list--compact">
            <span><small>Роль</small><strong>{recruitingRoleLabel(selected.projectedRole)}</strong></span>
            <span><small>Схема</small><strong>{selected.scheme}</strong></span>
            <span><small>GPA</small><strong>{selected.academicEligible ? "OK" : "BLOCK"}</strong></span>
            <span><small>Медицина</small><strong>{selected.medicalConcern ? "FLAG" : "OK"}</strong></span>
            <span><small>Расстояние</small><strong>{selected.distanceMiles} MI</strong></span>
            <span><small>Визит</small><strong>{visitLabel(selected)}</strong></span>
          </div>
          {selected.promises.length > 0 && <section className="recruiting-promises-card"><small>PROMISES</small>{selected.promises.slice(-3).reverse().map((promise) => <article key={promise.id}><strong>{promise.category.toUpperCase()}</strong><span>{Math.round(promise.credibility)}</span></article>)}</section>}
          {!recruitment.commitment && selected.offer && <button type="button" className="button button--primary button--wide" disabled={mutating || !selected.academicEligible} onClick={() => void onCommit(selected.id).then(() => setSelectedId(undefined))}>КОММИТ</button>}
          {!recruitment.commitment && <div className="recruiting-actions">{availableActions(selected).map((actionId) => <button type="button" key={actionId} disabled={mutating || actionsRemaining <= 0} onClick={() => void runAction(actionId)}><strong>{actionCopy[actionId].label}</strong><small>{actionCopy[actionId].effect}</small></button>)}</div>}
        </div>}
      </OverlayDialog>
    </div>
  );
}
