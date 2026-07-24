import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { RecruitingActionId, RecruitingProgram, RecruitingStage } from "../../sports/football/recruiting/types";
import { recruitingActionsRemaining, recruitingRoleLabel, recruitingStageLabel } from "../../sports/football/recruiting/updateRecruiting";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

const actionCopy: Record<RecruitingActionId, { label: string; effect: string }> = {
  "send-film": { label: "Отправить видео", effect: "Скаутинг" },
  "coach-call": { label: "Звонок тренера", effect: "Доверие" },
  "send-transcript": { label: "Отправить GPA", effect: "Допуск" },
  "declare-interest": { label: "Подтвердить интерес", effect: "Интерес" },
  "recruiter-call": { label: "Разговор со штабом", effect: "Роль" },
  "schedule-visit": { label: "Назначить визит", effect: "Визит" },
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
  return { national: "National", power: "Power", regional: "Regional", developmental: "Developmental" }[program.tier];
}

function visitLabel(program: RecruitingProgram): string {
  return { none: "—", invited: "Приглашение", scheduled: "Назначен", completed: "Завершён" }[program.visitStatus];
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
  const [selectedId, setSelectedId] = useState<string>();
  const recruitment = save.football.recruitment;
  const actionsRemaining = recruitingActionsRemaining(recruitment, save.football.season.week);
  const programs = useMemo(() => recruitment.programs.filter((program) => program.stage !== "unaware" && program.stage !== "cooled").sort((a, b) => Number(Boolean(b.offer)) - Number(Boolean(a.offer)) || b.interest - a.interest), [recruitment.programs]);
  const offers = programs.filter((program) => Boolean(program.offer));
  const visits = programs.filter((program) => program.visitStatus !== "none");
  const selected = recruitment.programs.find((program) => program.id === selectedId);
  const committed = recruitment.commitment ? recruitment.programs.find((program) => program.id === recruitment.commitment?.programId) : undefined;

  async function runAction(actionId: RecruitingActionId) {
    if (!selected || mutating || actionsRemaining <= 0 || recruitment.commitment) return;
    await onAction(selected.id, actionId);
    setSelectedId(undefined);
  }

  return (
    <div className="recruiting-page">
      <header className="data-page-head"><div><small>RECRUITING</small><h1>Рекрутинг</h1></div><strong>{recruitment.offers}</strong></header>
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
        <section className="recruiting-commit-row"><Icon name="check" /><div><small>{recruitment.commitment?.status === "signed" ? "ПОДПИСАНО" : "КОММИТ"}</small><strong>{committed.shortName}</strong></div>{recruitment.commitment?.status === "verbal" && <button type="button" disabled={mutating} onClick={() => void onWithdrawCommitment()}>Отозвать</button>}</section>
      )}

      <section className="recruiting-data-section">
        <header><span>ПРОГРАММЫ</span><strong>{programs.length}</strong></header>
        <div className="recruiting-program-list">
          {programs.map((program) => <button type="button" key={program.id} className={stageClass(program.stage)} onClick={() => setSelectedId(program.id)}><span>{program.shortName.slice(0, 2).toUpperCase()}</span><div><small>{recruitingStageLabel(program.stage)} · {recruitingRoleLabel(program.projectedRole)}</small><strong>{program.shortName}</strong><em>FIT {Math.round(program.fit)} · NEED {Math.round(program.positionNeed)} · DEPTH {Math.round(program.depthCompetition)}</em></div><b>{Math.round(program.interest)}</b></button>)}
          {programs.length === 0 && <div className="data-empty">Нет активных программ</div>}
        </div>
      </section>

      <section className="recruiting-data-section">
        <header><span>ОФФЕРЫ</span><strong>{offers.length}</strong></header>
        <div className="recruiting-offer-list">{offers.map((program) => <button type="button" key={program.id} onClick={() => setSelectedId(program.id)}><div><strong>{program.shortName}</strong><small>{recruitingRoleLabel(program.offer?.projectedRole ?? program.projectedRole)}</small></div><span>до W{program.offer?.expiresAfterWeek}</span><em>{Math.round(program.fit)}</em></button>)}{offers.length === 0 && <div className="data-empty">Нет предложений</div>}</div>
      </section>

      <section className="recruiting-data-section">
        <header><span>ВИЗИТЫ</span><strong>{visits.length}</strong></header>
        <div className="recruiting-visit-list">{visits.map((program) => <button type="button" key={program.id} onClick={() => setSelectedId(program.id)}><strong>{program.shortName}</strong><span>{visitLabel(program)}</span><em>{program.officialVisit?.overallImpression ? Math.round(program.officialVisit.overallImpression) : "—"}</em></button>)}{visits.length === 0 && <div className="data-empty">Нет визитов</div>}</div>
      </section>

      <section className="recruiting-data-section">
        <header><span>АКТИВНОСТЬ</span><strong>{recruitment.activity.length}</strong></header>
        <div className="recruiting-activity-data">{recruitment.activity.slice(-8).reverse().map((entry) => <article key={entry.id}><span>W{entry.week}</span><div><strong>{entry.title}</strong><small>{entry.kind}</small></div></article>)}{recruitment.activity.length === 0 && <div className="data-empty">Нет активности</div>}</div>
      </section>

      <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(undefined)} eyebrow={selected ? tierLabel(selected) : "PROGRAM"} title={selected?.shortName ?? "Программа"}>
        {selected && <div className="recruiting-program-sheet recruiting-program-sheet--data">
          <div className="sheet-metric-pair"><article><small>ИНТЕРЕС</small><strong>{Math.round(selected.interest)}</strong></article><article><small>FIT</small><strong>{Math.round(selected.fit)}</strong></article></div>
          <div className="recruiting-fit-grid">
            <article><small>Need</small><strong>{Math.round(selected.positionNeed)}</strong></article>
            <article><small>Depth</small><strong>{Math.round(selected.depthCompetition)}</strong></article>
            <article><small>Trust</small><strong>{Math.round(selected.staffTrust)}</strong></article>
            <article><small>Role</small><strong>{Math.round(selected.roleClarity)}</strong></article>
          </div>
          <div className="info-list info-list--compact">
            <span><small>Роль</small><strong>{recruitingRoleLabel(selected.projectedRole)}</strong></span>
            <span><small>Схема</small><strong>{selected.scheme}</strong></span>
            <span><small>GPA</small><strong>{selected.academicEligible ? "Допущен" : "Не допущен"}</strong></span>
            <span><small>Медицина</small><strong>{selected.medicalConcern ? "Флаг" : "Чисто"}</strong></span>
            <span><small>Расстояние</small><strong>{selected.distanceMiles} mi</strong></span>
            <span><small>Визит</small><strong>{visitLabel(selected)}</strong></span>
          </div>
          {selected.promises.length > 0 && <section className="recruiting-promises-card"><small>ОБЕЩАНИЯ</small>{selected.promises.slice(-3).reverse().map((promise) => <article key={promise.id}><strong>{promise.statement}</strong><span>{Math.round(promise.credibility)}</span></article>)}</section>}
          {!recruitment.commitment && selected.offer && <button type="button" className="button button--primary button--wide" disabled={mutating || !selected.academicEligible} onClick={() => void onCommit(selected.id).then(() => setSelectedId(undefined))}>Коммит</button>}
          {!recruitment.commitment && <div className="recruiting-actions">{availableActions(selected).map((actionId) => <button type="button" key={actionId} disabled={mutating || actionsRemaining <= 0} onClick={() => void runAction(actionId)}><strong>{actionCopy[actionId].label}</strong><small>{actionCopy[actionId].effect}</small></button>)}</div>}
        </div>}
      </BottomSheet>
    </div>
  );
}
