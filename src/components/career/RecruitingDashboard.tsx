import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { RecruitingActionId, RecruitingProgram, RecruitingStage } from "../../sports/football/recruiting/types";
import {
  recruitingActionsRemaining,
  recruitingRoleLabel,
  recruitingStageLabel,
} from "../../sports/football/recruiting/updateRecruiting";
import {
  credibilityLabel,
  getRecruitingAdvice,
  recruitingDecisionSnapshot,
} from "../../sports/football/recruiting/decisionSupport";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "pipeline", label: "Главное" },
  { id: "offers", label: "Офферы" },
  { id: "visits", label: "Визиты" },
  { id: "activity", label: "Лента" },
] as const;
type ViewId = (typeof views)[number]["id"];

const actionCopy: Record<RecruitingActionId, { label: string; detail: string }> = {
  "send-film": { label: "Отправить плёнку", detail: "Даёт штабу новый материал, но слабая плёнка тоже влияет на оценку." },
  "coach-call": { label: "Звонок тренера", detail: "Школьный тренер подтверждает роль, дисциплину и реальный прогресс." },
  "send-transcript": { label: "Отправить оценки", detail: "Академическая служба проверяет GPA и предварительный допуск." },
  "declare-interest": { label: "Показать интерес", detail: "Программа понимает, что её рассматривают всерьёз." },
  "recruiter-call": { label: "Разговор с рекрутером", detail: "Позволяет спросить о роли и получить конкретное обещание штаба." },
  "schedule-visit": { label: "Назначить визит", detail: "Поездка пройдёт в воскресенье и займёт часть восстановления." },
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
  if (stage === "cooled") return "is-cold";
  return "";
}

function tierLabel(program: RecruitingProgram): string {
  return {
    national: "Национальный уровень",
    power: "Сильная конференция",
    regional: "Региональная программа",
    developmental: "Развивающая программа",
  }[program.tier];
}

function activeScore(program: RecruitingProgram): number {
  const visit = program.officialVisit?.overallImpression ?? 0;
  return program.stage === "offered"
    ? 1000 + program.interest + visit
    : program.interest * 2 + program.scoutingConfidence + program.positionNeed * 0.35 + visit;
}

function visitLabel(program: RecruitingProgram): string {
  if (program.visitStatus === "invited") return "Есть приглашение";
  if (program.visitStatus === "scheduled") return "Визит назначен";
  if (program.visitStatus === "completed") return "Визит завершён";
  return "Визита нет";
}

function availableActions(program: RecruitingProgram): RecruitingActionId[] {
  if (program.stage === "cooled") return [];
  const actions: RecruitingActionId[] = [];
  if (program.stage === "unaware" || program.stage === "watchlist" || program.stage === "evaluating") actions.push("send-film");
  if (program.stage !== "unaware") actions.push("send-transcript");
  if (["watchlist", "evaluating", "contact", "priority"].includes(program.stage)) actions.push("coach-call");
  if (["contact", "priority", "offered"].includes(program.stage)) actions.push("recruiter-call", "declare-interest");
  if (program.visitStatus === "invited") actions.unshift("schedule-visit");
  return [...new Set(actions)].slice(0, 4);
}

export function RecruitingDashboard({
  save,
  mutating,
  actionError,
  onAction,
  onCommit,
  onWithdrawCommitment,
}: RecruitingDashboardProps) {
  const [view, setView] = useState<ViewId>("pipeline");
  const [selectedId, setSelectedId] = useState<string>();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const recruitment = save.football.recruitment;
  const actionsRemaining = recruitingActionsRemaining(recruitment, save.football.season.week);
  const advice = getRecruitingAdvice(save);
  const activePrograms = useMemo(
    () => [...recruitment.programs]
      .filter((program) => program.stage !== "unaware" && program.stage !== "cooled")
      .sort((left, right) => activeScore(right) - activeScore(left)),
    [recruitment.programs],
  );
  const offers = useMemo(
    () => [...recruitment.programs]
      .filter((program) => Boolean(program.offer))
      .sort((left, right) => recruitingDecisionSnapshot(right).overall - recruitingDecisionSnapshot(left).overall),
    [recruitment.programs],
  );
  const visits = useMemo(
    () => [...recruitment.programs]
      .filter((program) => program.visitStatus !== "none")
      .sort((left, right) => ({ invited: 3, scheduled: 4, completed: 2, none: 0 })[right.visitStatus] - ({ invited: 3, scheduled: 4, completed: 2, none: 0 })[left.visitStatus]),
    [recruitment.programs],
  );
  const selected = recruitment.programs.find((program) => program.id === selectedId);
  const committedProgram = recruitment.commitment
    ? recruitment.programs.find((program) => program.id === recruitment.commitment?.programId)
    : undefined;
  const comparePrograms = compareIds
    .map((id) => recruitment.programs.find((program) => program.id === id))
    .filter((program): program is RecruitingProgram => Boolean(program));

  async function runAction(actionId: RecruitingActionId) {
    if (!selected || mutating || actionsRemaining <= 0 || recruitment.commitment) return;
    await onAction(selected.id, actionId);
    setSelectedId(undefined);
  }

  function toggleCompare(programId: string) {
    setCompareIds((current) => {
      if (current.includes(programId)) return current.filter((id) => id !== programId);
      if (current.length >= 3) return [...current.slice(1), programId];
      return [...current, programId];
    });
  }

  async function commit(program: RecruitingProgram) {
    if (!program.offer || mutating) return;
    const confirmed = window.confirm(`Дать ${program.shortName} устный коммит? Другие программы могут отдать стипендии другим игрокам.`);
    if (!confirmed) return;
    await onCommit(program.id);
    setSelectedId(undefined);
  }

  async function withdraw() {
    if (!committedProgram || mutating) return;
    const confirmed = window.confirm(`Отозвать коммит в ${committedProgram.shortName}? Часть предложений уже не вернётся.`);
    if (!confirmed) return;
    await onWithdrawCommitment();
  }

  return (
    <div className="compact-section recruiting-dashboard">
      <header className="compact-page-head">
        <div><span>College recruiting</span><h2>Рекрутинг</h2></div>
        <strong className="compact-head-score">{recruitment.offers}</strong>
      </header>
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Разделы рекрутинга" />
      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      {view === "pipeline" && (
        <div className="compact-view">
          {committedProgram ? (
            <section className="recruiting-commitment-card">
              <span><Icon name="check" /></span>
              <div><small>УСТНЫЙ КОММИТ</small><h3>{committedProgram.shortName}</h3><p>Неделя {recruitment.commitment?.committedWeek} · уверенность {Math.round(recruitment.commitment?.confidence ?? 0)}</p></div>
              <button type="button" disabled={mutating} onClick={() => void withdraw()}>Отозвать</button>
            </section>
          ) : (
            <section className="recruiting-command-card">
              <div><small>ТЕКУЩИЙ СТАТУС</small><h3>{recruitment.regionalRankLabel}</h3><p>{recruitment.interestedPrograms} программ следят · {recruitment.offers} предложений</p></div>
              <span><small>ДЕЙСТВИЯ</small><strong>{actionsRemaining}/2</strong></span>
            </section>
          )}

          <div className="recruiting-metric-strip">
            <article><small>Плёнка</small><strong>{Math.round(recruitment.filmGrade)}</strong></article>
            <article><small>GPA</small><strong>{save.character.education.gpa.toFixed(2)}</strong></article>
            <article><small>Визиты</small><strong>{visits.filter((program) => program.visitStatus === "completed").length}</strong></article>
          </div>

          <div className="recruiting-advice-grid">
            <button type="button" onClick={() => advice.guardian.programId && setSelectedId(advice.guardian.programId)}>
              <small>{advice.guardian.name}</small><strong>{advice.guardian.title}</strong><p>{advice.guardian.detail}</p>
            </button>
            <button type="button" onClick={() => advice.coach.programId && setSelectedId(advice.coach.programId)}>
              <small>{advice.coach.name}</small><strong>{advice.coach.title}</strong><p>{advice.coach.detail}</p>
            </button>
          </div>

          <div className="recruiting-priority-list">
            {activePrograms.length === 0 ? (
              <div className="compact-note"><Icon name="target" /><p>Программы пока собирают первичную информацию. Матчи и плёнка изменят картину.</p></div>
            ) : activePrograms.slice(0, 3).map((program) => (
              <button type="button" key={program.id} className={stageClass(program.stage)} onClick={() => setSelectedId(program.id)}>
                <span className="recruiting-program-mark">{program.shortName.slice(0, 2).toUpperCase()}</span>
                <div><small>{recruitingStageLabel(program.stage)} · {visitLabel(program)}</small><strong>{program.shortName}</strong><p>{program.playerRead}</p></div>
                <em>{Math.round(program.interest)}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "offers" && (
        <div className="compact-view recruiting-offers-view">
          {offers.length === 0 ? (
            <div className="compact-note"><Icon name="trophy" /><p>Письменных предложений пока нет. Интерес и контакт ещё не равны стипендии.</p></div>
          ) : offers.map((program) => {
            const snapshot = recruitingDecisionSnapshot(program);
            const selectedForCompare = compareIds.includes(program.id);
            return (
              <article key={program.id} className={selectedForCompare ? "is-selected" : ""}>
                <button type="button" className="recruiting-offer-main" onClick={() => setSelectedId(program.id)}>
                  <span>{program.shortName.slice(0, 2).toUpperCase()}</span>
                  <div><small>{recruitingRoleLabel(program.projectedRole)}</small><strong>{program.shortName}</strong><p>{snapshot.risk}</p></div>
                  <em>{Math.round(snapshot.overall)}</em>
                </button>
                <button type="button" className="recruiting-compare-toggle" onClick={() => toggleCompare(program.id)}>{selectedForCompare ? "Убрать" : "Сравнить"}</button>
              </article>
            );
          })}
          {compareIds.length >= 2 && <button type="button" className="button button--primary button--wide" onClick={() => setCompareOpen(true)}>Сравнить программы · {compareIds.length}</button>}
        </div>
      )}

      {view === "visits" && (
        <div className="compact-view recruiting-visits-list">
          {visits.length === 0 ? (
            <div className="compact-note"><Icon name="map" /><p>Официальные визиты появляются только после серьёзного контакта или предложения.</p></div>
          ) : visits.map((program) => (
            <button type="button" key={program.id} onClick={() => setSelectedId(program.id)}>
              <span><Icon name={program.visitStatus === "completed" ? "check" : program.visitStatus === "scheduled" ? "calendar" : "map"} /></span>
              <div><small>{visitLabel(program)}</small><strong>{program.shortName}</strong><p>{program.officialVisit?.summary ?? program.lastUpdate}</p></div>
              <em>{program.officialVisit?.overallImpression ? Math.round(program.officialVisit.overallImpression) : "—"}</em>
            </button>
          ))}
        </div>
      )}

      {view === "activity" && (
        <div className="compact-view recruiting-activity-list">
          {recruitment.activity.length === 0 ? (
            <div className="compact-note"><Icon name="clock" /><p>Лента начнётся после первого изменения интереса или действия игрока.</p></div>
          ) : recruitment.activity.map((entry) => (
            <article key={entry.id}>
              <span><Icon name={entry.kind === "offer" || entry.kind === "commitment" ? "trophy" : entry.kind === "visit" ? "map" : entry.kind === "contact" || entry.kind === "conversation" ? "message" : "target"} /></span>
              <div><small>WEEK {entry.week} · {entry.kind}</small><strong>{entry.title}</strong><p>{entry.detail}</p></div>
            </article>
          ))}
        </div>
      )}

      <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(undefined)} eyebrow={selected ? tierLabel(selected) : "PROGRAM"} title={selected?.shortName ?? "Программа"}>
        {selected && (
          <div className="recruiting-program-sheet">
            <div className="sheet-metric-pair">
              <article><small>ИНТЕРЕС</small><strong>{Math.round(selected.interest)}</strong></article>
              <article><small>ДОВЕРИЕ ШТАБУ</small><strong>{Math.round(selected.staffTrust)}</strong></article>
            </div>
            <section className="recruiting-program-verdict"><small>{recruitingStageLabel(selected.stage)}</small><strong>{selected.playerRead}</strong></section>
            <div className="recruiting-fit-grid">
              <article><small>Схема</small><strong>{selected.fit}</strong><span>{selected.scheme}</span></article>
              <article><small>Потребность</small><strong>{selected.positionNeed}</strong><span>на позиции</span></article>
              <article><small>Конкуренция</small><strong>{selected.depthCompetition}</strong><span>в depth chart</span></article>
              <article><small>Ясность роли</small><strong>{Math.round(selected.roleClarity)}</strong><span>{recruitingRoleLabel(selected.projectedRole)}</span></article>
            </div>
            <div className="info-list info-list--compact">
              <span><small>Рекрутер</small><strong>{selected.recruiterName}</strong></span>
              <span><small>Академический допуск</small><strong>{selected.academicEligible ? "Предварительно да" : "Пока нет"}</strong></span>
              <span><small>Медицина</small><strong>{selected.medicalConcern ? "Есть вопросы" : "Без флага"}</strong></span>
              <span><small>Расстояние</small><strong>{selected.distanceMiles} mi</strong></span>
            </div>
            {selected.promises.length > 0 && (
              <section className="recruiting-promises-card">
                <small>ЧТО СКАЗАЛ ШТАБ</small>
                {selected.promises.slice(-3).reverse().map((promise) => (
                  <article key={promise.id}><strong>{promise.statement}</strong><span>Надёжность: {credibilityLabel(promise.credibility)}</span></article>
                ))}
              </section>
            )}
            {selected.officialVisit?.status === "completed" && (
              <section className="recruiting-visit-result">
                <small>ОФИЦИАЛЬНЫЙ ВИЗИТ</small><strong>{selected.officialVisit.summary}</strong><p>{selected.officialVisit.warning}</p>
              </section>
            )}
            {selected.offer && <section className="recruiting-offer-card"><Icon name="trophy" /><div><small>ПОЛНАЯ СТИПЕНДИЯ</small><strong>{recruitingRoleLabel(selected.offer.projectedRole)}</strong><p>Активна до конца недели {selected.offer.expiresAfterWeek}.</p></div></section>}
            {!recruitment.commitment && selected.offer && (
              <button type="button" className="button button--primary button--wide" disabled={mutating || !selected.academicEligible} onClick={() => void commit(selected)}>Дать устный коммит</button>
            )}
            {!recruitment.commitment && (
              <div className="recruiting-actions">
                {availableActions(selected).map((actionId) => (
                  <button type="button" key={actionId} disabled={mutating || actionsRemaining <= 0} onClick={() => void runAction(actionId)}>
                    <strong>{actionCopy[actionId].label}</strong><small>{actionCopy[actionId].detail}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={compareOpen} onClose={() => setCompareOpen(false)} eyebrow="DECISION ROOM" title="Сравнение офферов">
        <div className="recruiting-compare-sheet">
          {comparePrograms.map((program) => {
            const snapshot = recruitingDecisionSnapshot(program);
            return (
              <article key={program.id}>
                <header><div><small>{tierLabel(program)}</small><strong>{program.shortName}</strong></div><em>{Math.round(snapshot.overall)}</em></header>
                <div><span>Роль <b>{Math.round(snapshot.role)}</b></span><span>Развитие <b>{Math.round(snapshot.development)}</b></span><span>Медицина <b>{Math.round(snapshot.health)}</b></span><span>Семья <b>{Math.round(snapshot.family)}</b></span></div>
                <p>{snapshot.risk}</p>
              </article>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
