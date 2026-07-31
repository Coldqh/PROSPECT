import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { BottomSheet } from "../ui/BottomSheet";
import { addGameDays, formatGameDate, formatWeekday, toGameDateKey } from "../../core/calendar/types";
import {
  getIntensityDescriptor,
  getWeeklyPlanTemplate,
  intensityDescriptors,
  weeklyPlanTemplates,
} from "../../core/life/planCatalog";
import { buildDaySchedule } from "../../core/life/schedule";
import type { ScheduleActivityType, TrainingIntensity, WeeklyPlanTemplateId } from "../../core/life/types";
import { getTrainingFocus, getTrainingFocusCatalog } from "../../sports/football/training/catalog";
import type { MedicalStatus, TrainingFocusId } from "../../sports/football/training/types";
import type { CareerSave } from "../../storage/saves/schema";
import { teamBrandStyle } from "./teamBrand";

const activityIcons: Record<ScheduleActivityType, IconName> = {
  school: "book",
  football: "football",
  recovery: "pulse",
  study: "brain",
  personal: "user",
};

const trainingIcons: Record<TrainingFocusId, IconName> = {
  "position-craft": "target",
  "explosive-power": "bolt",
  "film-install": "brain",
  "recovery-reset": "pulse",
};

const weekdayLabels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"] as const;
type TodayView = "overview" | "plan" | "schedule";
type SheetId = "condition" | "result" | "training-result" | "medical" | "event" | null;

function signed(value: number, digits = 1): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}


function medicalLabel(status: MedicalStatus): string {
  return {
    cleared: "Допущен",
    questionable: "Под вопросом",
    limited: "Ограничен",
    out: "Вне работы",
  }[status];
}

interface TodayDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onUpdatePlan(templateId: WeeklyPlanTemplateId, intensity: TrainingIntensity): Promise<void>;
  onUpdateTrainingPlan(focusId: TrainingFocusId, intensity: TrainingIntensity): Promise<void>;
  onAdvanceDay(): Promise<void>;
  onResolveRelationshipEvent(optionId: string): Promise<void>;
  onOpenMatch(): void;
}

export function TodayDashboard({
  save,
  mutating,
  actionError,
  onUpdatePlan,
  onUpdateTrainingPlan,
  onAdvanceDay,
  onResolveRelationshipEvent,
  onOpenMatch,
}: TodayDashboardProps) {
  const { character, football, life } = save;
  const [view, setView] = useState<TodayView>("overview");
  const [sheet, setSheet] = useState<SheetId>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WeeklyPlanTemplateId>(life.weeklyPlan.templateId);
  const [selectedIntensity, setSelectedIntensity] = useState<TrainingIntensity>(life.weeklyPlan.intensity);
  const [selectedTrainingFocus, setSelectedTrainingFocus] = useState<TrainingFocusId>(football.training.plan.focusId);

  useEffect(() => {
    setSelectedTemplate(life.weeklyPlan.templateId);
    setSelectedIntensity(life.weeklyPlan.intensity);
  }, [life.weeklyPlan.intensity, life.weeklyPlan.templateId]);

  useEffect(() => {
    setSelectedTrainingFocus(football.training.plan.focusId);
  }, [football.training.plan.focusId]);

  const activeTemplate = getWeeklyPlanTemplate(selectedTemplate);
  const activeIntensity = getIntensityDescriptor(selectedIntensity);
  const trainingCatalog = getTrainingFocusCatalog(football.position);
  const activeTrainingFocus = getTrainingFocus(football.position, selectedTrainingFocus);
  const weekStart = addGameDays(save.meta.currentDate, -life.dayIndex);
  const scheduledMatch = football.match.status === "upcoming" || football.match.status === "in-progress" || football.match.status === "complete"
    ? football.match
    : undefined;
  const isCurrentMatchDate = scheduledMatch && toGameDateKey(scheduledMatch.scheduledDate) === toGameDateKey(save.meta.currentDate);
  const schedule = useMemo(() => {
    const base = buildDaySchedule(life.dayIndex, {
      ...life.weeklyPlan,
      templateId: selectedTemplate,
      intensity: selectedIntensity,
      focus: activeTemplate.focus,
    });
    if (!isCurrentMatchDate || !scheduledMatch) return base;
    const withoutScrimmage = base.filter((activity) => activity.id !== "scrimmage" && activity.id !== "extra-work");
    withoutScrimmage.push({
      id: `game-${scheduledMatch.gameId}`,
      time: "19:00",
      durationMinutes: 180,
      type: "football",
      title: `Матч против ${scheduledMatch.opponentName}`,
      location: "Стадион",
      mandatory: true,
      impact: "Сезон · Статистика · Рекрутинг",
    });
    return withoutScrimmage.sort((left, right) => left.time.localeCompare(right.time));
  }, [activeTemplate.focus, isCurrentMatchDate, life.dayIndex, life.weeklyPlan, scheduledMatch, selectedIntensity, selectedTemplate]);
  const planChanged = selectedTemplate !== life.weeklyPlan.templateId || selectedIntensity !== life.weeklyPlan.intensity;
  const trainingPlanChanged = selectedTrainingFocus !== football.training.plan.focusId || selectedIntensity !== football.training.plan.intensity;
  const weeklySetupChanged = planChanged || trainingPlanChanged;
  const projectedLoad = Math.round((activeTemplate.focus.training * 0.58 + 25) * activeIntensity.loadMultiplier);
  const trainingLoad = Math.round(activeTrainingFocus.load * activeIntensity.loadMultiplier);
  const recoveryMargin = Math.round(activeTemplate.focus.recovery * 1.45 - projectedLoad * 0.42);
  const nextActivity = schedule[0];
  const body = football.training.body;
  const currentTrainingFocus = getTrainingFocus(football.position, football.training.plan.focusId);

  async function applyWeeklySetup() {
    if (planChanged) await onUpdatePlan(selectedTemplate, selectedIntensity);
    if (trainingPlanChanged) await onUpdateTrainingPlan(selectedTrainingFocus, selectedIntensity);
  }

  const currentTeamName = football.professional.contract?.teamName ?? football.college.program?.shortName ?? football.school.shortName;
  const currentRole = football.college.heroCareer?.role ?? football.depthChart.projectedRole;
  const seasonRecord = football.professional.league && football.professional.contract
    ? (() => { const team = football.professional.teams.find((item) => item.id === football.professional.contract?.teamId); return team ? `${team.wins}–${team.losses}` : "0–0"; })()
    : football.college.heroCareer?.teamId
      ? (() => { const team = save.world.teams.find((item) => item.id === football.college.heroCareer?.teamId); return team ? `${team.wins}–${team.losses}` : "0–0"; })()
      : `${football.season.wins}–${football.season.losses}`;
  const pageStyle = football.college.program || football.professional.contract
    ? teamBrandStyle(football.college.program?.id ?? football.professional.contract?.teamId ?? currentTeamName)
    : ({
      "--team-primary": football.school.primaryColor,
      "--team-secondary": football.school.secondaryColor,
      "--team-ink": "#ffffff",
      "--team-hue": "354",
    } as CSSProperties);
  const weekProgress = Math.round(((life.dayIndex + 1) / 7) * 100);

  return (
    <div className="dynasty-page dynasty-home-page" style={pageStyle}>
      <header className="dynasty-page-head">
        <div className="dynasty-page-head__badge">WK</div>
        <div><strong>{view === "overview" ? "Сегодня" : view === "plan" ? "План недели" : "Расписание"}</strong><small>{formatWeekday(save.meta.currentDate).toUpperCase()} · НЕДЕЛЯ {life.weekNumber}</small></div>
        {view !== "overview" && <button type="button" className="dynasty-head-action" onClick={() => setView("overview")} aria-label="Вернуться к сводке"><Icon name="arrow-left" /></button>}
      </header>

      <section className="dynasty-context-bar">
        <article><small>Команда</small><strong>{currentTeamName}</strong></article>
        <article><small>Рекорд</small><strong>{seasonRecord}</strong></article>
        <article><small>OVR</small><strong>{Math.round(football.ratings.overall)}</strong></article>
        <article><small>Роль</small><strong>{currentRole}</strong></article>
        <article><small>Дата</small><strong>{formatGameDate(save.meta.currentDate)}</strong></article>
      </section>

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      {view === "overview" && (
        <div className="dynasty-stack">
          <section className="dynasty-panel dynasty-week-panel">
            <header><div><small>Текущая неделя</small><strong>{life.dayIndex + 1} из 7 дней</strong></div><span>{weekProgress}%</span></header>
            <i><b style={{ width: `${weekProgress}%` }} /></i>
            <div className="dynasty-week-days" aria-label="Текущая игровая неделя">
              {weekdayLabels.map((label, index) => {
                const date = addGameDays(weekStart, index);
                const matchOnDate = scheduledMatch && toGameDateKey(scheduledMatch.scheduledDate) === toGameDateKey(date);
                const className = [index < life.dayIndex ? "is-complete" : index === life.dayIndex ? "is-current" : "", matchOnDate ? "is-game" : ""].filter(Boolean).join(" ");
                return <span className={className} key={label}><small>{label}</small><strong>{date.day}</strong>{matchOnDate && <em>{scheduledMatch.status === "complete" ? "FINAL" : "GAME"}</em>}</span>;
              })}
            </div>
          </section>

          <header className="dynasty-section-title"><span /><strong>Готовность игрока</strong><em>{medicalLabel(body.medicalStatus)}</em></header>
          <section className="dynasty-readiness-grid">
            {[{ label: "Энергия", value: character.condition.energy, sheet: "condition" as const }, { label: "Готовность", value: body.readiness, sheet: "medical" as const }, { label: "Риск травмы", value: body.injuryRisk, sheet: "medical" as const }].map((item) => (
              <button type="button" key={item.label} className={item.label === "Риск травмы" && item.value > 45 ? "is-warning" : ""} onClick={() => setSheet(item.sheet)}>
                <div><small>{item.label}</small><strong>{Math.round(item.value)}</strong></div><i><b style={{ width: `${item.value}%` }} /></i>
              </button>
            ))}
          </section>

          {save.relationships.pendingEvent && (() => {
            const event = save.relationships.pendingEvent;
            const npc = save.relationships.npcs.find((item) => item.id === event.primaryNpcId);
            return <button type="button" className="dynasty-alert-row" onClick={() => setSheet("event")}><span><Icon name="message" /></span><div><small>{npc?.name ?? "Разговор"}</small><strong>{event.title}</strong><p>Требуется твой ответ</p></div><Icon name="arrow-right" /></button>;
          })()}

          <div className="dynasty-grid dynasty-grid--two">
            <section className="dynasty-panel dynasty-focus-card">
              <header className="dynasty-section-title"><span /><strong>Следующий блок</strong></header>
              {body.activeIssue ? <button type="button" onClick={() => setSheet("medical")}><span className="dynasty-focus-card__icon is-danger"><Icon name="pulse" /></span><div><small>Ограничение · {body.activeIssue.daysRemaining} дн.</small><h2>{body.activeIssue.diagnosis}</h2><p>{body.restriction}</p></div><Icon name="arrow-right" /></button> : nextActivity ? <button type="button" onClick={() => setView("schedule")}><span className="dynasty-focus-card__icon"><Icon name={activityIcons[nextActivity.type]} /></span><div><small>{nextActivity.time} · {nextActivity.location}</small><h2>{nextActivity.title}</h2><p>{nextActivity.durationMinutes} минут</p></div><Icon name="arrow-right" /></button> : <div className="dynasty-empty">На сегодня блоков нет</div>}
            </section>
            <section className="dynasty-panel dynasty-focus-card">
              <header className="dynasty-section-title"><span /><strong>Режим недели</strong></header>
              <button type="button" onClick={() => setView("plan")}><span className="dynasty-focus-card__icon"><Icon name="calendar" /></span><div><small>{activeIntensity.name} · стабильность {Math.round(life.consistency)}</small><h2>{activeTemplate.shortName}</h2><p>{currentTrainingFocus.name}</p></div><Icon name="arrow-right" /></button>
            </section>
          </div>

          <section className="dynasty-panel">
            <header className="dynasty-section-title"><span /><strong>Расписание дня</strong><em>{schedule.length} блоков</em></header>
            <div className="dynasty-row-list dynasty-schedule-preview">
              {schedule.slice(0, 4).map((activity) => <article key={activity.id}><b>{activity.time}</b><span className="dynasty-activity-icon"><Icon name={activityIcons[activity.type]} size={17} /></span><div><strong>{activity.title}</strong><small>{activity.location} · {activity.durationMinutes} мин</small></div>{activity.mandatory && <em>Обязательно</em>}</article>)}
            </div>
            {schedule.length > 4 && <button type="button" className="dynasty-panel-link" onClick={() => setView("schedule")}>Показать весь день <Icon name="arrow-right" size={15} /></button>}
          </section>

          {football.training.lastSession && <button type="button" className="dynasty-result-row" onClick={() => setSheet("training-result")}><span className={`result-grade result-grade--${football.training.lastSession.grade.toLowerCase()}`}>{football.training.lastSession.grade}</span><div><small>Последняя тренировка</small><strong>{football.training.lastSession.focusName}</strong><p>Готовность после: {Math.round(football.training.lastSession.readinessAfter)}</p></div><Icon name="arrow-right" /></button>}

          {save.relationships.pendingEvent ? (
            <button type="button" className="dynasty-primary-action" disabled={mutating} onClick={() => setSheet("event")}><span><small>Требуется решение</small><strong>Ответить</strong></span><Icon name="message" /></button>
          ) : isCurrentMatchDate && football.match.status !== "complete" ? (
            <button type="button" className="dynasty-primary-action" disabled={mutating} onClick={onOpenMatch}><span><small>Сегодня · {football.match.opponentName}</small><strong>Перейти к матчу</strong></span><Icon name="arrow-right" /></button>
          ) : (
            <button type="button" className="dynasty-primary-action" disabled={mutating} onClick={() => void onAdvanceDay()}><span><small>{formatGameDate(save.meta.currentDate)}</small><strong>{mutating ? "Расчёт…" : "Завершить день"}</strong></span><Icon name="arrow-right" /></button>
          )}
        </div>
      )}

      {view === "plan" && (
        <div className="dynasty-stack">
          <section>
            <header className="dynasty-section-title"><span /><strong>Режим недели</strong><em>{activeTemplate.shortName}</em></header>
            <div className="dynasty-choice-grid">
              {weeklyPlanTemplates.map((template) => <button type="button" className={selectedTemplate === template.id ? "is-active" : ""} onClick={() => setSelectedTemplate(template.id)} key={template.id}><span><Icon name={selectedTemplate === template.id ? "check" : "target"} /></span><div><strong>{template.shortName}</strong><small>Тренировки {template.focus.training} · восстановление {template.focus.recovery} · учёба {template.focus.study}</small></div></button>)}
            </div>
          </section>

          <section className="dynasty-panel">
            <header className="dynasty-section-title"><span /><strong>Футбольный акцент</strong><em>Нагрузка {trainingLoad}</em></header>
            <div className="dynasty-choice-grid dynasty-choice-grid--compact">
              {trainingCatalog.map((focus) => <button type="button" className={selectedTrainingFocus === focus.id ? "is-active" : ""} onClick={() => setSelectedTrainingFocus(focus.id)} key={focus.id}><span><Icon name={trainingIcons[focus.id]} /></span><div><strong>{focus.shortName}</strong><small>Техника {focus.multipliers.technique.toFixed(2)} · атлетизм {focus.multipliers.athleticism.toFixed(2)} · IQ {focus.multipliers.footballIq.toFixed(2)}</small></div></button>)}
            </div>
          </section>

          <section className="dynasty-panel">
            <header className="dynasty-section-title"><span /><strong>Интенсивность</strong><em>{activeIntensity.loadMultiplier.toFixed(2)}×</em></header>
            <div className="dynasty-segmented">{intensityDescriptors.map((item) => <button type="button" className={selectedIntensity === item.id ? "is-active" : ""} onClick={() => setSelectedIntensity(item.id)} key={item.id}>{item.name}</button>)}</div>
          </section>

          <section className="dynasty-metric-grid"><article><small>Нагрузка</small><strong>{projectedLoad}</strong></article><article><small>Запас</small><strong className={recoveryMargin < 0 ? "is-negative" : "is-positive"}>{recoveryMargin > 0 ? "+" : ""}{recoveryMargin}</strong></article><article><small>Стабильность</small><strong>{Math.round(life.consistency)}</strong></article></section>
          <button type="button" className="dynasty-primary-action" disabled={!weeklySetupChanged || mutating} onClick={() => void applyWeeklySetup()}><span><small>{activeTemplate.shortName} · {activeTrainingFocus.shortName} · {activeIntensity.name}</small><strong>{mutating ? "Сохранение…" : weeklySetupChanged ? "Применить план" : "План выбран"}</strong></span><Icon name={weeklySetupChanged ? "arrow-right" : "check"} /></button>
        </div>
      )}

      {view === "schedule" && (
        <div className="dynasty-stack">
          <section className="dynasty-panel"><header className="dynasty-section-title"><span /><strong>{formatGameDate(save.meta.currentDate)}</strong><em>{schedule.length} блоков</em></header><div className="dynasty-row-list dynasty-schedule-full">{schedule.map((activity) => <article key={activity.id}><b>{activity.time}</b><span className="dynasty-activity-icon"><Icon name={activityIcons[activity.type]} size={17} /></span><div><strong>{activity.title}</strong><small>{activity.location} · {activity.durationMinutes} мин</small></div>{activity.mandatory && <em>Обязательно</em>}</article>)}</div></section>
          <section className="dynasty-metric-grid"><article><small>Блоков</small><strong>{schedule.length}</strong></article><article><small>Время</small><strong>{Math.round(schedule.reduce((total, item) => total + item.durationMinutes, 0) / 60)} ч</strong></article><article><small>Фокус</small><strong>{currentTrainingFocus.shortName}</strong></article></section>
          <button type="button" className="dynasty-primary-action" disabled={mutating} onClick={() => void onAdvanceDay()}><span><small>После последнего блока</small><strong>{mutating ? "Расчёт дня…" : "Завершить день"}</strong></span><Icon name="arrow-right" /></button>
        </div>
      )}

      <BottomSheet open={sheet === "event" && Boolean(save.relationships.pendingEvent)} title={save.relationships.pendingEvent?.title ?? "Разговор"} eyebrow="Живая ситуация" onClose={() => setSheet(null)}>
        {save.relationships.pendingEvent && (() => {
          const event = save.relationships.pendingEvent;
          const npc = save.relationships.npcs.find((item) => item.id === event.primaryNpcId);
          return (
            <div className="relationship-event-sheet">
              <header><span>{npc?.name.slice(0, 2).toUpperCase() ?? "NPC"}</span><div><small>{npc?.name}</small><strong>{event.scene}</strong></div></header>
              <div className="relationship-event-context">{event.context.map((item) => <p key={item}>{item}</p>)}</div>
              <div className="relationship-event-options">
                {event.options.map((eventOption) => (
                  <button type="button" key={eventOption.id} disabled={mutating} onClick={() => void onResolveRelationshipEvent(eventOption.id).then(() => setSheet(null)).catch(() => undefined)}>
                    <strong>{eventOption.label}</strong><span>{eventOption.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      <BottomSheet open={sheet === "condition"} title="Состояние спортсмена" eyebrow="Сегодня" onClose={() => setSheet(null)}>
        <div className="sheet-metric-list">
          <span><small>Энергия</small><strong>{Math.round(character.condition.energy)}</strong><i><b style={{ width: `${character.condition.energy}%` }} /></i></span>
          <span><small>Усталость</small><strong>{Math.round(character.condition.fatigue)}</strong><i><b style={{ width: `${character.condition.fatigue}%` }} /></i></span>
          <span><small>Стресс</small><strong>{Math.round(character.condition.stress)}</strong><i><b style={{ width: `${character.condition.stress}%` }} /></i></span>
          <span><small>Уверенность</small><strong>{Math.round(character.condition.confidence)}</strong><i><b style={{ width: `${character.condition.confidence}%` }} /></i></span>
          <span><small>Здоровье</small><strong>{Math.round(character.condition.health)}</strong><i><b style={{ width: `${character.condition.health}%` }} /></i></span>
        </div>
        <div className="sheet-fact-grid">
          <span><small>Сон</small><strong>{character.condition.sleepHours.toFixed(1)} ч</strong></span>
          <span><small>Доверие тренера</small><strong>{Math.round(football.depthChart.coachTrust)}</strong></span>
          <span><small>GPA</small><strong>{character.education.gpa.toFixed(2)}</strong></span>
          <span><small>Общий рейтинг</small><strong>{football.ratings.overall}</strong></span>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "medical"} title="Медицинский статус" eyebrow={medicalLabel(body.medicalStatus)} onClose={() => setSheet(null)}>
        <div className={`medical-status-card medical-status-card--${body.medicalStatus}`}>
          <Icon name="pulse" />
          <div><small>Решение штаба</small><strong>{body.restriction}</strong></div>
        </div>
        {body.activeIssue && (
          <div className="active-issue-card">
            <small>Активная проблема</small>
            <h3>{body.activeIssue.diagnosis}</h3>
            <p>{body.activeIssue.severity === "moderate" ? "Средняя тяжесть" : "Лёгкая проблема"} · {body.activeIssue.daysRemaining} дн. до повторной оценки · риск рецидива {Math.round(body.activeIssue.recurrenceRisk)}</p>
          </div>
        )}
        <div className="sheet-metric-list">
          <span><small>Готовность</small><strong>{Math.round(body.readiness)}</strong><i><b style={{ width: `${body.readiness}%` }} /></i></span>
          <span><small>Острая нагрузка</small><strong>{Math.round(body.acuteLoad)}</strong><i><b style={{ width: `${body.acuteLoad}%` }} /></i></span>
          <span><small>Накопленная нагрузка</small><strong>{Math.round(body.chronicLoad)}</strong><i><b style={{ width: `${body.chronicLoad}%` }} /></i></span>
          <span><small>Забитость</small><strong>{Math.round(body.soreness)}</strong><i><b style={{ width: `${body.soreness}%` }} /></i></span>
          <span><small>Боль</small><strong>{Math.round(body.pain)}</strong><i><b style={{ width: `${body.pain}%` }} /></i></span>
          <span><small>Риск травмы</small><strong>{Math.round(body.injuryRisk)}</strong><i><b style={{ width: `${body.injuryRisk}%` }} /></i></span>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "training-result" && Boolean(football.training.lastSession)} title={football.training.lastSession?.focusName ?? "Тренировка"} eyebrow="Последняя сессия" onClose={() => setSheet(null)}>
        {football.training.lastSession && (
          <div className="sheet-result">
            <div className={`sheet-result__grade result-grade--${football.training.lastSession.grade.toLowerCase()}`}>{football.training.lastSession.grade}</div>

            <div className="sheet-deltas">
              <span><small>Техника</small><strong>{signed(football.training.lastSession.gains.technique, 2)}</strong></span>
              <span><small>Атлетизм</small><strong>{signed(football.training.lastSession.gains.athleticism, 2)}</strong></span>
              <span><small>Football IQ</small><strong>{signed(football.training.lastSession.gains.footballIq, 2)}</strong></span>
              <span><small>Забитость</small><strong>{signed(football.training.lastSession.sorenessDelta)}</strong></span>
            </div>
            <div className="sheet-fact-grid">
              <span><small>Нагрузка</small><strong>{Math.round(football.training.lastSession.load)}</strong></span>
              <span><small>Готовность после</small><strong>{Math.round(football.training.lastSession.readinessAfter)}</strong></span>
              <span><small>Риск после</small><strong>{Math.round(football.training.lastSession.riskAfter)}</strong></span>
              <span><small>Интенсивность</small><strong>{getIntensityDescriptor(football.training.lastSession.intensity).name}</strong></span>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === "result" && Boolean(life.lastOutcome)} title={life.lastOutcome?.title ?? "Итог дня"} eyebrow="Последний завершённый день" onClose={() => setSheet(null)}>
        {life.lastOutcome && (
          <div className="sheet-result">
            <div className={`sheet-result__grade result-grade--${life.lastOutcome.grade.toLowerCase()}`}>{life.lastOutcome.grade}</div>

            <div className="sheet-deltas">
              <span><small>Энергия</small><strong>{signed(life.lastOutcome.deltas.energy)}</strong></span>
              <span><small>Усталость</small><strong>{signed(life.lastOutcome.deltas.fatigue)}</strong></span>
              <span><small>Доверие</small><strong>{signed(life.lastOutcome.deltas.coachTrust)}</strong></span>
              <span><small>OVR</small><strong>{signed(life.lastOutcome.deltas.overall, 2)}</strong></span>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
