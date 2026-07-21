import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { BottomSheet } from "../ui/BottomSheet";
import { SectionTabs } from "../ui/SectionTabs";
import { addGameDays, formatGameDate, formatShortGameDate, formatWeekday } from "../../core/calendar/types";
import {
  getIntensityDescriptor,
  getWeeklyPlanTemplate,
  intensityDescriptors,
  weeklyPlanTemplates,
} from "../../core/life/planCatalog";
import { buildDaySchedule } from "../../core/life/schedule";
import type { ScheduleActivityType, TrainingIntensity, WeeklyPlanTemplateId } from "../../core/life/types";
import type { CareerSave } from "../../storage/saves/schema";

const activityIcons: Record<ScheduleActivityType, IconName> = {
  school: "book",
  football: "football",
  recovery: "pulse",
  study: "brain",
  personal: "user",
};

const weekdayLabels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"] as const;
const views = [
  { id: "overview", label: "Сводка" },
  { id: "plan", label: "План" },
  { id: "schedule", label: "Расписание" },
] as const;

type TodayView = (typeof views)[number]["id"];
type SheetId = "condition" | "result" | null;

function signed(value: number, digits = 1): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function riskLabel(risk: "low" | "medium" | "high"): string {
  return { low: "Низкий риск", medium: "Средний риск", high: "Высокий риск" }[risk];
}

interface TodayDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onUpdatePlan(templateId: WeeklyPlanTemplateId, intensity: TrainingIntensity): Promise<void>;
  onAdvanceDay(): Promise<void>;
}

export function TodayDashboard({ save, mutating, actionError, onUpdatePlan, onAdvanceDay }: TodayDashboardProps) {
  const { character, football, life } = save;
  const [view, setView] = useState<TodayView>("overview");
  const [sheet, setSheet] = useState<SheetId>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WeeklyPlanTemplateId>(life.weeklyPlan.templateId);
  const [selectedIntensity, setSelectedIntensity] = useState<TrainingIntensity>(life.weeklyPlan.intensity);

  useEffect(() => {
    setSelectedTemplate(life.weeklyPlan.templateId);
    setSelectedIntensity(life.weeklyPlan.intensity);
  }, [life.weeklyPlan.intensity, life.weeklyPlan.templateId]);

  const activeTemplate = getWeeklyPlanTemplate(selectedTemplate);
  const activeIntensity = getIntensityDescriptor(selectedIntensity);
  const schedule = useMemo(
    () => buildDaySchedule(life.dayIndex, {
      ...life.weeklyPlan,
      templateId: selectedTemplate,
      intensity: selectedIntensity,
      focus: activeTemplate.focus,
    }),
    [activeTemplate.focus, life.dayIndex, life.weeklyPlan, selectedIntensity, selectedTemplate],
  );
  const weekStart = addGameDays(save.meta.currentDate, -life.dayIndex);
  const planChanged = selectedTemplate !== life.weeklyPlan.templateId || selectedIntensity !== life.weeklyPlan.intensity;
  const projectedLoad = Math.round((activeTemplate.focus.training * 0.58 + 25) * activeIntensity.loadMultiplier);
  const recoveryMargin = Math.round(activeTemplate.focus.recovery * 1.45 - projectedLoad * 0.42);
  const nextActivity = schedule[0];

  return (
    <div className="compact-section today-section">
      <header className="compact-page-head">
        <div>
          <span>{formatWeekday(save.meta.currentDate)} · неделя {life.weekNumber}</span>
          <h2>{formatGameDate(save.meta.currentDate)}</h2>
        </div>
        <button type="button" className="quiet-pill" onClick={() => setSheet("condition")}>
          Состояние <Icon name="chevron-down" size={15} />
        </button>
      </header>

      <div className="mini-week" aria-label="Текущая игровая неделя">
        {weekdayLabels.map((label, index) => {
          const date = addGameDays(weekStart, index);
          const className = index < life.dayIndex ? "is-complete" : index === life.dayIndex ? "is-current" : "";
          return (
            <span className={className} key={label}>
              <small>{label}</small>
              <strong>{date.day}</strong>
            </span>
          );
        })}
      </div>

      <SectionTabs<TodayView> tabs={views} active={view} onChange={setView} ariaLabel="Разделы текущего дня" />

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      {view === "overview" && (
        <div className="compact-view">
          <div className="vital-row">
            <button type="button" onClick={() => setSheet("condition")}>
              <small>Энергия</small><strong>{Math.round(character.condition.energy)}</strong><i style={{ width: `${character.condition.energy}%` }} />
            </button>
            <button type="button" onClick={() => setSheet("condition")}>
              <small>Усталость</small><strong>{Math.round(character.condition.fatigue)}</strong><i style={{ width: `${character.condition.fatigue}%` }} />
            </button>
            <button type="button" onClick={() => setSheet("condition")}>
              <small>Стресс</small><strong>{Math.round(character.condition.stress)}</strong><i style={{ width: `${character.condition.stress}%` }} />
            </button>
          </div>

          <section className="today-focus-card">
            <div className="today-focus-card__head">
              <div>
                <small>Активный режим</small>
                <h3>{getWeeklyPlanTemplate(life.weeklyPlan.templateId).shortName}</h3>
              </div>
              <span>{getIntensityDescriptor(life.weeklyPlan.intensity).name}</span>
            </div>
            <p>{getWeeklyPlanTemplate(life.weeklyPlan.templateId).description}</p>
            <div className="today-focus-card__facts">
              <span><small>Нагрузка</small><strong>{projectedLoad}</strong></span>
              <span><small>Восстановление</small><strong className={recoveryMargin < 0 ? "is-danger" : ""}>{recoveryMargin > 0 ? "+" : ""}{recoveryMargin}</strong></span>
              <span><small>Доверие</small><strong>{Math.round(football.depthChart.coachTrust)}</strong></span>
            </div>
            <div className="today-focus-card__actions">
              <button type="button" onClick={() => setView("plan")}><Icon name="target" /> Настроить</button>
              <button type="button" onClick={() => setView("schedule")}><Icon name="calendar" /> День</button>
            </div>
          </section>

          {nextActivity && (
            <button type="button" className="next-activity" onClick={() => setView("schedule")}>
              <span className={`next-activity__icon next-activity__icon--${nextActivity.type}`}><Icon name={activityIcons[nextActivity.type]} /></span>
              <div><small>Следующий блок · {nextActivity.time}</small><strong>{nextActivity.title}</strong><p>{nextActivity.location}</p></div>
              <Icon name="arrow-right" />
            </button>
          )}

          {life.lastOutcome && (
            <button type="button" className="result-teaser" onClick={() => setSheet("result")}>
              <span className={`result-grade result-grade--${life.lastOutcome.grade.toLowerCase()}`}>{life.lastOutcome.grade}</span>
              <div><small>Предыдущий день</small><strong>{life.lastOutcome.title}</strong></div>
              <Icon name="arrow-right" />
            </button>
          )}

          <button
            type="button"
            className="primary-action-bar"
            disabled={mutating}
            onClick={() => void onAdvanceDay()}
          >
            <span><small>Автосохранение включено</small><strong>{mutating ? "Расчёт дня…" : "Завершить день"}</strong></span>
            <Icon name="arrow-right" />
          </button>
        </div>
      )}

      {view === "plan" && (
        <div className="compact-view">
          <div className="plan-list-compact">
            {weeklyPlanTemplates.map((template) => (
              <button
                type="button"
                className={selectedTemplate === template.id ? "is-active" : ""}
                onClick={() => setSelectedTemplate(template.id)}
                key={template.id}
              >
                <span className="plan-list-compact__mark"><Icon name={selectedTemplate === template.id ? "check" : "target"} /></span>
                <div><strong>{template.shortName}</strong><small>{template.identity} · {riskLabel(template.risk)}</small></div>
                <em>{template.focus.training}</em>
              </button>
            ))}
          </div>

          <section className="compact-control-card">
            <header><div><small>Интенсивность</small><strong>{activeIntensity.description}</strong></div><span>{activeIntensity.loadMultiplier.toFixed(2)}×</span></header>
            <div className="compact-segmented">
              {intensityDescriptors.map((item) => (
                <button type="button" className={selectedIntensity === item.id ? "is-active" : ""} onClick={() => setSelectedIntensity(item.id)} key={item.id}>
                  {item.name}
                </button>
              ))}
            </div>
          </section>

          <div className="compact-forecast">
            <span><small>Нагрузка</small><strong>{projectedLoad}</strong></span>
            <span><small>Запас</small><strong className={recoveryMargin < 0 ? "is-danger" : ""}>{recoveryMargin > 0 ? "+" : ""}{recoveryMargin}</strong></span>
            <span><small>Стабильность</small><strong>{Math.round(life.consistency)}</strong></span>
          </div>

          <button
            type="button"
            className="primary-action-bar"
            disabled={!planChanged || mutating}
            onClick={() => void onUpdatePlan(selectedTemplate, selectedIntensity)}
          >
            <span><small>{activeTemplate.name}</small><strong>{mutating ? "Сохранение…" : planChanged ? "Применить режим" : "Режим активен"}</strong></span>
            <Icon name={planChanged ? "arrow-right" : "check"} />
          </button>
        </div>
      )}

      {view === "schedule" && (
        <div className="compact-view">
          <div className="schedule-list-compact">
            {schedule.map((activity) => (
              <article key={activity.id}>
                <time>{activity.time}</time>
                <span className={`schedule-list-compact__icon schedule-list-compact__icon--${activity.type}`}><Icon name={activityIcons[activity.type]} size={17} /></span>
                <div><strong>{activity.title}</strong><small>{activity.location} · {activity.durationMinutes} мин</small></div>
                {activity.mandatory && <em>обяз.</em>}
              </article>
            ))}
          </div>
          <div className="schedule-summary">
            <span><small>Блоков</small><strong>{schedule.length}</strong></span>
            <span><small>Время</small><strong>{Math.round(schedule.reduce((total, item) => total + item.durationMinutes, 0) / 60)} ч</strong></span>
            <span><small>Режим</small><strong>{getWeeklyPlanTemplate(life.weeklyPlan.templateId).shortName}</strong></span>
          </div>
          <button type="button" className="primary-action-bar" disabled={mutating} onClick={() => void onAdvanceDay()}>
            <span><small>После последнего блока</small><strong>{mutating ? "Расчёт дня…" : "Завершить день"}</strong></span>
            <Icon name="arrow-right" />
          </button>
        </div>
      )}

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

      <BottomSheet open={sheet === "result" && Boolean(life.lastOutcome)} title={life.lastOutcome?.title ?? "Итог дня"} eyebrow="Последний завершённый день" onClose={() => setSheet(null)}>
        {life.lastOutcome && (
          <div className="sheet-result">
            <div className={`sheet-result__grade result-grade--${life.lastOutcome.grade.toLowerCase()}`}>{life.lastOutcome.grade}</div>
            <p>{life.lastOutcome.summary}</p>
            <div className="sheet-highlights">
              {life.lastOutcome.highlights.map((highlight) => <span key={highlight}><i />{highlight}</span>)}
            </div>
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
