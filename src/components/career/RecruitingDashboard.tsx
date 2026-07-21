import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { RecruitingActionId, RecruitingProgram, RecruitingStage } from "../../sports/football/recruiting/types";
import {
  recruitingActionsRemaining,
  recruitingRoleLabel,
  recruitingStageLabel,
} from "../../sports/football/recruiting/updateRecruiting";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { MetricBar } from "../ui/MetricBar";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "pipeline", label: "Главное" },
  { id: "programs", label: "Программы" },
  { id: "profile", label: "Профиль" },
  { id: "activity", label: "Лента" },
] as const;
type ViewId = (typeof views)[number]["id"];

const actionCopy: Record<RecruitingActionId, { label: string; detail: string }> = {
  "send-film": { label: "Отправить плёнку", detail: "Повышает точность оценки. Результат зависит от качества матчей." },
  "coach-call": { label: "Звонок тренера", detail: "Школьный тренер подтверждает роль, дисциплину и прогресс." },
  "send-transcript": { label: "Отправить оценки", detail: "Программа проверяет GPA и предварительный академический допуск." },
  "declare-interest": { label: "Показать интерес", detail: "Даёт понять, что программа рассматривается всерьёз." },
};

interface RecruitingDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onAction(programId: string, actionId: RecruitingActionId): Promise<void>;
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
  return program.stage === "offered" ? 1000 + program.interest : program.interest * 2 + program.scoutingConfidence + program.positionNeed * 0.35;
}

export function RecruitingDashboard({ save, mutating, actionError, onAction }: RecruitingDashboardProps) {
  const [view, setView] = useState<ViewId>("pipeline");
  const [selectedId, setSelectedId] = useState<string>();
  const recruitment = save.football.recruitment;
  const actionsRemaining = recruitingActionsRemaining(recruitment, save.football.season.week);
  const activePrograms = useMemo(
    () => [...recruitment.programs]
      .filter((program) => program.stage !== "unaware" && program.stage !== "cooled")
      .sort((left, right) => activeScore(right) - activeScore(left)),
    [recruitment.programs],
  );
  const visiblePrograms = useMemo(
    () => [...recruitment.programs]
      .sort((left, right) => activeScore(right) - activeScore(left))
      .slice(0, 12),
    [recruitment.programs],
  );
  const selected = recruitment.programs.find((program) => program.id === selectedId);

  async function runAction(actionId: RecruitingActionId) {
    if (!selected || mutating || actionsRemaining <= 0) return;
    await onAction(selected.id, actionId);
    setSelectedId(undefined);
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
          <section className="recruiting-command-card">
            <div><small>ТЕКУЩИЙ СТАТУС</small><h3>{recruitment.regionalRankLabel}</h3><p>{recruitment.interestedPrograms} программ следят · {recruitment.offers} предложений</p></div>
            <span><small>ДЕЙСТВИЯ</small><strong>{actionsRemaining}/2</strong></span>
          </section>

          <div className="recruiting-metric-strip">
            <article><small>Плёнка</small><strong>{Math.round(recruitment.filmGrade)}</strong></article>
            <article><small>GPA</small><strong>{save.character.education.gpa.toFixed(2)}</strong></article>
            <article><small>Здоровье</small><strong>{Math.round(recruitment.healthConfidence)}</strong></article>
          </div>

          <div className="recruiting-priority-list">
            {activePrograms.length === 0 ? (
              <div className="compact-note"><Icon name="target" /><p>Программы пока собирают первичную информацию. Матчи и плёнка изменят картину.</p></div>
            ) : activePrograms.slice(0, 4).map((program) => (
              <button type="button" key={program.id} className={stageClass(program.stage)} onClick={() => setSelectedId(program.id)}>
                <span className="recruiting-program-mark">{program.shortName.slice(0, 2).toUpperCase()}</span>
                <div><small>{recruitingStageLabel(program.stage)} · {program.stateCode}</small><strong>{program.shortName}</strong><p>{program.evaluation}</p></div>
                <em>{Math.round(program.interest)}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "programs" && (
        <div className="compact-view recruiting-program-list">
          {visiblePrograms.map((program) => (
            <button type="button" key={program.id} className={stageClass(program.stage)} onClick={() => setSelectedId(program.id)}>
              <span>{program.shortName.slice(0, 2).toUpperCase()}</span>
              <div><strong>{program.shortName}</strong><small>{tierLabel(program)} · {program.scheme}</small></div>
              <em>{program.stage === "unaware" ? "—" : Math.round(program.interest)}</em>
            </button>
          ))}
          <div className="compact-note"><Icon name="target" /><p>Показаны 12 наиболее релевантных программ из {recruitment.programs.length}. Остальные существуют в фоне и могут включиться позже.</p></div>
        </div>
      )}

      {view === "profile" && (
        <div className="compact-view">
          <section className="recruiting-profile-card">
            <div><small>РЕГИОНАЛЬНАЯ ОЦЕНКА</small><h3>{recruitment.regionalRankLabel}</h3></div>
            <strong>{Math.round(recruitment.visibility)}</strong>
          </section>
          <div className="metric-list-card">
            <MetricBar compact label="Качество плёнки" value={recruitment.filmGrade} />
            <MetricBar compact label="Стабильность" value={recruitment.consistency} />
            <MetricBar compact label="Уверенность в здоровье" value={recruitment.healthConfidence} />
            <MetricBar compact label="Академический допуск" value={recruitment.academicClearance} />
            <MetricBar compact label="Рекомендация тренера" value={recruitment.coachRecommendation} />
            <MetricBar compact label="Уровень соперников" value={recruitment.competitionLevel} />
          </div>
        </div>
      )}

      {view === "activity" && (
        <div className="compact-view recruiting-activity-list">
          {recruitment.activity.length === 0 ? (
            <div className="compact-note"><Icon name="clock" /><p>Лента начнётся после первого изменения интереса или действия игрока.</p></div>
          ) : recruitment.activity.map((entry) => (
            <article key={entry.id}>
              <span><Icon name={entry.kind === "offer" ? "trophy" : entry.kind === "contact" ? "message" : "target"} /></span>
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
              <article><small>УВЕРЕННОСТЬ</small><strong>{Math.round(selected.scoutingConfidence)}</strong></article>
            </div>
            <section className="recruiting-program-verdict"><small>{recruitingStageLabel(selected.stage)}</small><strong>{selected.evaluation}</strong></section>
            <div className="recruiting-fit-grid">
              <article><small>Схема</small><strong>{selected.fit}</strong><span>{selected.scheme}</span></article>
              <article><small>Потребность</small><strong>{selected.positionNeed}</strong><span>на позиции</span></article>
              <article><small>Конкуренция</small><strong>{selected.depthCompetition}</strong><span>в depth chart</span></article>
              <article><small>Роль</small><strong>{selected.youthOpportunity}</strong><span>{recruitingRoleLabel(selected.projectedRole)}</span></article>
            </div>
            <div className="info-list info-list--compact">
              <span><small>Рекрутер</small><strong>{selected.recruiterName}</strong></span>
              <span><small>Академический допуск</small><strong>{selected.academicEligible ? "Предварительно да" : "Пока нет"}</strong></span>
              <span><small>Медицина</small><strong>{selected.medicalConcern ? "Есть вопросы" : "Без флага"}</strong></span>
              <span><small>Расстояние</small><strong>{selected.distanceMiles} mi</strong></span>
            </div>
            {selected.offer && <section className="recruiting-offer-card"><Icon name="trophy" /><div><small>ПОЛНАЯ СТИПЕНДИЯ</small><strong>{recruitingRoleLabel(selected.offer.projectedRole)}</strong><p>Предложение активно до конца недели {selected.offer.expiresAfterWeek}.</p></div></section>}
            <div className="recruiting-actions">
              {(Object.keys(actionCopy) as RecruitingActionId[]).map((actionId) => (
                <button type="button" key={actionId} disabled={mutating || actionsRemaining <= 0 || (selected.stage === "unaware" && actionId !== "send-film")} onClick={() => void runAction(actionId)}>
                  <strong>{actionCopy[actionId].label}</strong><small>{actionCopy[actionId].detail}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
