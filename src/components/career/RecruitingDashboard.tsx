import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { RecruitingActionId, RecruitingProgram, RecruitingStage } from "../../sports/football/recruiting/types";
import { recruitingActionsRemaining, recruitingRoleLabel, recruitingStageLabel } from "../../sports/football/recruiting/updateRecruiting";
import { Icon } from "../ui/Icon";
import { teamBrandStyle, teamMark } from "./teamBrand";

type RecruitingView = "board" | "offers" | "visits";

const actionCopy: Record<RecruitingActionId, { label: string; effect: string }> = {
  "send-film": { label: "Отправить новое видео", effect: "Штаб получит свежую игровую оценку." },
  "coach-call": { label: "Позвонить тренеру", effect: "Укрепить контакт и выяснить реальный интерес." },
  "send-transcript": { label: "Отправить документы", effect: "Закрыть вопросы по академической части." },
  "declare-interest": { label: "Подтвердить интерес", effect: "Показать школе, что она остаётся в твоём списке." },
  "recruiter-call": { label: "Обсудить роль", effect: "Уточнить путь к игровому времени и обещания штаба." },
  "schedule-visit": { label: "Назначить визит", effect: "Закрепить дату официального визита." },
};

interface RecruitingDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onAction(programId: string, actionId: RecruitingActionId): Promise<void>;
  onCommit(programId: string): Promise<void>;
  onWithdrawCommitment(): Promise<void>;
}

function tierLabel(program: RecruitingProgram): string {
  return { national: "Национальная программа", power: "Сильная программа", regional: "Региональная программа", developmental: "Программа развития" }[program.tier];
}

function interestLabel(value: number): string {
  if (value >= 82) return "Очень высокий интерес";
  if (value >= 66) return "Высокий интерес";
  if (value >= 48) return "Умеренный интерес";
  return "Наблюдают";
}

function stageTone(stage: RecruitingStage): string {
  if (stage === "offered") return "is-offer";
  if (stage === "priority" || stage === "contact") return "is-active";
  return "";
}

function visitLabel(program: RecruitingProgram): string {
  return { none: "Нет приглашения", invited: "Есть приглашение", scheduled: "Визит назначен", completed: "Визит завершён" }[program.visitStatus];
}

function nextStep(program: RecruitingProgram): string {
  if (program.offer) return `Оффер действует до недели ${program.offer.expiresAfterWeek}.`;
  if (program.visitStatus === "invited") return "Школа ждёт подтверждения официального визита.";
  if (program.visitStatus === "scheduled") return `Официальный визит назначен на неделю ${program.officialVisit?.scheduledWeek ?? "—"}.`;
  if (program.stage === "priority") return "Ты среди главных целей штаба. Сейчас важно уточнить роль.";
  if (program.stage === "contact") return "Контакт установлен. Следующий шаг — усилить доверие штаба.";
  if (program.stage === "evaluating") return "Штаб продолжает оценку. Новое видео может ускорить решение.";
  return "Программа следит за развитием сезона.";
}

function programReason(program: RecruitingProgram): string {
  if (!program.academicEligible) return "Академический допуск пока блокирует продвижение.";
  if (program.medicalConcern) return "Штаб ждёт подтверждения по здоровью.";
  if (program.positionNeed >= 72 && program.depthCompetition <= 55) return "У команды явная потребность на позиции и свободный путь к ротации.";
  if (program.positionNeed >= 72) return "Позиция входит в главные потребности набора.";
  if (program.fit >= 76) return "Твои качества хорошо подходят под их игровую систему.";
  return program.lastUpdate || program.evaluation;
}

function rolePath(program: RecruitingProgram): string {
  const role = recruitingRoleLabel(program.projectedRole);
  if (program.depthCompetition >= 72) return `${role}. Перед тобой сильная и глубокая группа.`;
  if (program.depthCompetition >= 50) return `${role}. За место придётся бороться в лагере.`;
  return `${role}. На позиции есть реальная возможность быстро подняться.`;
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
  const [view, setView] = useState<RecruitingView>("board");
  const [selectedId, setSelectedId] = useState<string>();
  const recruitment = save.football.recruitment;
  const actionsRemaining = recruitingActionsRemaining(recruitment, save.football.season.week);
  const programs = useMemo(() => recruitment.programs
    .filter((program) => program.stage !== "unaware" && program.stage !== "cooled")
    .sort((left, right) => Number(Boolean(right.offer)) - Number(Boolean(left.offer)) || right.interest - left.interest || right.fit - left.fit), [recruitment.programs]);
  const offers = programs.filter((program) => Boolean(program.offer));
  const visits = programs.filter((program) => program.visitStatus !== "none");
  const visible = view === "offers" ? offers : view === "visits" ? visits : programs;
  const selected = visible.find((program) => program.id === selectedId) ?? visible[0] ?? programs[0];
  const committed = recruitment.commitment ? recruitment.programs.find((program) => program.id === recruitment.commitment?.programId) : undefined;

  async function runAction(actionId: RecruitingActionId) {
    if (!selected || mutating || actionsRemaining <= 0 || recruitment.commitment) return;
    await onAction(selected.id, actionId);
  }

  return (
    <div className="recruiting-hub">
      <header className="recruiting-hub__head">
        <div className="recruiting-hub__title">
          <small>МОЙ РЕКРУТИНГ</small>
          <h1>Доска программ</h1>
          <p>Кто действительно зовёт тебя, что обещает и где есть путь к игровому времени.</p>
        </div>
        <div className="recruiting-hub__scoreboard">
          <span><small>Рейтинг</small><strong>{recruitment.regionalRankLabel}</strong></span>
          <span><small>Контакты</small><strong>{actionsRemaining}<em>/2</em></strong></span>
        </div>
      </header>

      <section className="recruiting-hub__brief">
        <div className="recruiting-hub__brief-copy"><small>СОСТОЯНИЕ БОРЬБЫ</small><strong>{programs.length} программ остаются в борьбе</strong><p>{offers.length > 0 ? `${offers.length} оффера уже на столе.` : "Офферов пока нет — штабы продолжают оценку."} {visits.length > 0 ? `${visits.length} программ обсуждают визит.` : "Приглашений на визит пока нет."}</p></div>
        <div className="recruiting-hub__tape">
          <span><strong>{offers.length}</strong><small>офферы</small></span>
          <span><strong>{visits.length}</strong><small>визиты</small></span>
          <span><strong>{Math.round(recruitment.filmGrade)}</strong><small>видео</small></span>
        </div>
      </section>

      {committed && (
        <section className="recruiting-hub__commit">
          <Icon name="check" />
          <div><small>{recruitment.commitment?.status === "signed" ? "СОГЛАШЕНИЕ ПОДПИСАНО" : "УСТНЫЙ КОММИТ"}</small><strong>{committed.shortName}</strong></div>
          {recruitment.commitment?.status === "verbal" && <button type="button" disabled={mutating} onClick={() => void onWithdrawCommitment()}>Отозвать</button>}
        </section>
      )}

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      <nav className="recruiting-hub__filters" aria-label="Фильтр рекрутинга">
        <button type="button" className={view === "board" ? "is-active" : ""} onClick={() => setView("board")}>Все программы <span>{programs.length}</span></button>
        <button type="button" className={view === "offers" ? "is-active" : ""} onClick={() => setView("offers")}>Офферы <span>{offers.length}</span></button>
        <button type="button" className={view === "visits" ? "is-active" : ""} onClick={() => setView("visits")}>Визиты <span>{visits.length}</span></button>
      </nav>

      <div className="recruiting-hub__workspace">
        <section className="recruiting-board" aria-label="Список программ">
          <header><span>#</span><span>Команда</span><span>Программа и ситуация</span><span>Статус</span></header>
          {visible.map((program, index) => (
            <button type="button" key={program.id} style={teamBrandStyle(program.seed)} className={`${selected?.id === program.id ? "is-selected" : ""} ${stageTone(program.stage)}`} onClick={() => setSelectedId(program.id)}>
              <span className="recruiting-board__rank">{index + 1}</span>
              <span className="recruiting-board__mark">{teamMark(program.shortName)}</span>
              <div className="recruiting-board__program">
                <strong>{program.shortName}</strong>
                <small>{recruitingRoleLabel(program.projectedRole)} · {programReason(program)}</small>
              </div>
              <span className="recruiting-board__status">
                <strong>{program.offer ? `Оффер до W${program.offer.expiresAfterWeek}` : recruitingStageLabel(program.stage)}</strong>
                <small>{interestLabel(program.interest)}</small>
              </span>
            </button>
          ))}
          {visible.length === 0 && <div className="data-empty">Здесь пока нет программ</div>}
        </section>

        <aside className="recruiting-detail" style={selected ? teamBrandStyle(selected.seed) : undefined} aria-label="Подробности программы">
          {selected ? (
            <>
              <header>
                <span className="recruiting-detail__mark">{teamMark(selected.shortName)}</span>
                <div><small>{tierLabel(selected)} · {selected.stateCode}</small><h2>{selected.name}</h2><p>{selected.city} · {selected.scheme}</p></div>
                <span className="recruiting-detail__interest">{Math.round(selected.interest)}<small>интерес</small></span>
              </header>

              <section className="recruiting-detail__next">
                <small>ЧТО ПРОИСХОДИТ</small>
                <strong>{nextStep(selected)}</strong>
                <p>{selected.lastUpdate}</p>
              </section>

              <section className="recruiting-detail__facts">
                <article><small>Твоя роль</small><strong>{recruitingRoleLabel(selected.projectedRole)}</strong><p>{rolePath(selected)}</p></article>
                <article><small>Почему ты им нужен</small><strong>{programReason(selected)}</strong><p>{selected.evaluation}</p></article>
                <article><small>Доверие штаба</small><strong>{selected.staffTrust >= 70 ? "Высокое" : selected.staffTrust >= 50 ? "Рабочее" : "Не сформировано"}</strong><p>{selected.playerRead}</p></article>
                <article><small>Визит</small><strong>{visitLabel(selected)}</strong><p>{selected.officialVisit?.summary ?? "Личное впечатление ещё не сформировано."}</p></article>
              </section>

              <section className="recruiting-detail__context">
                <span><small>Система</small><strong>{selected.scheme}</strong></span>
                <span><small>Потребность на позиции</small><strong>{selected.positionNeed >= 70 ? "Высокая" : selected.positionNeed >= 45 ? "Средняя" : "Низкая"}</strong></span>
                <span><small>Конкуренция</small><strong>{selected.depthCompetition >= 70 ? "Тяжёлая" : selected.depthCompetition >= 45 ? "Рабочая" : "Свободная"}</strong></span>
                <span><small>Академический допуск</small><strong>{selected.academicEligible ? "Пройден" : "Не пройден"}</strong></span>
              </section>

              {selected.promises.length > 0 && (
                <section className="recruiting-detail__promises">
                  <header><small>ОБЕЩАНИЯ ШТАБА</small></header>
                  {selected.promises.slice(-3).reverse().map((promise) => <article key={promise.id}><strong>{promise.statement}</strong><span>{promise.credibility >= 70 ? "Надёжно" : promise.credibility >= 50 ? "Есть сомнения" : "Слабое обещание"}</span></article>)}
                </section>
              )}

              {!recruitment.commitment && selected.offer && <button type="button" className="button button--primary button--wide" disabled={mutating || !selected.academicEligible} onClick={() => void onCommit(selected.id)}>Принять оффер {selected.shortName}</button>}

              {!recruitment.commitment && (
                <section className="recruiting-detail__actions">
                  <header><div><small>СЛЕДУЮЩИЙ КОНТАКТ</small><strong>{actionsRemaining > 0 ? "Выбери одно действие" : "Лимит недели исчерпан"}</strong></div></header>
                  {availableActions(selected).map((actionId) => <button type="button" key={actionId} disabled={mutating || actionsRemaining <= 0} onClick={() => void runAction(actionId)}><div><strong>{actionCopy[actionId].label}</strong><small>{actionCopy[actionId].effect}</small></div><Icon name="arrow-right" /></button>)}
                </section>
              )}
            </>
          ) : <div className="data-empty">Нет активных программ</div>}
        </aside>
      </div>
    </div>
  );
}
