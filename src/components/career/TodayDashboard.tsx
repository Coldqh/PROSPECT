import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
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
import { mindsetLabels } from "../../sports/football/career/catalog";

const activityIcons: Record<ScheduleActivityType, IconName> = {
  school: "book",
  football: "football",
  recovery: "pulse",
  study: "brain",
  personal: "user",
};

const weekdayLabels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"] as const;

function roleLabel(value: CareerSave["football"]["depthChart"]["projectedRole"]): string {
  return {
    starter: "Projected Starter",
    rotation: "Rotation",
    "special-teams": "Special Teams",
    developmental: "Developmental",
  }[value];
}

function signed(value: number, digits = 1): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function riskLabel(risk: "low" | "medium" | "high"): string {
  return { low: "LOW RISK", medium: "MEDIUM RISK", high: "HIGH RISK" }[risk];
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
  const [selectedTemplate, setSelectedTemplate] = useState<WeeklyPlanTemplateId>(life.weeklyPlan.templateId);
  const [selectedIntensity, setSelectedIntensity] = useState<TrainingIntensity>(life.weeklyPlan.intensity);

  useEffect(() => {
    setSelectedTemplate(life.weeklyPlan.templateId);
    setSelectedIntensity(life.weeklyPlan.intensity);
  }, [life.weeklyPlan.intensity, life.weeklyPlan.templateId]);

  const activeTemplate = getWeeklyPlanTemplate(selectedTemplate);
  const activeIntensity = getIntensityDescriptor(selectedIntensity);
  const schedule = useMemo(
    () => buildDaySchedule(life.dayIndex, { ...life.weeklyPlan, templateId: selectedTemplate, intensity: selectedIntensity, focus: activeTemplate.focus }),
    [activeTemplate.focus, life.dayIndex, life.weeklyPlan, selectedIntensity, selectedTemplate],
  );
  const weekStart = addGameDays(save.meta.currentDate, -life.dayIndex);
  const planChanged = selectedTemplate !== life.weeklyPlan.templateId || selectedIntensity !== life.weeklyPlan.intensity;
  const projectedLoad = Math.round((activeTemplate.focus.training * 0.58 + 25) * activeIntensity.loadMultiplier);
  const recoveryMargin = Math.round(activeTemplate.focus.recovery * 1.45 - projectedLoad * 0.42);

  return (
    <div className="dashboard-stack today-command-center">
      <header className="dashboard-heading dashboard-heading--command">
        <div>
          <span className="eyebrow">WEEK {String(life.weekNumber).padStart(2, "0")} // {formatWeekday(save.meta.currentDate).toUpperCase()}</span>
          <h2>{life.completedDays === 0 ? "Первый день сезона" : "Режим на сегодня"}</h2>
        </div>
        <div className="date-lockup">
          <strong>{String(save.meta.currentDate.day).padStart(2, "0")}</strong>
          <span>{formatGameDate(save.meta.currentDate)}</span>
        </div>
      </header>

      <div className="week-strip" aria-label="Текущая игровая неделя">
        {weekdayLabels.map((label, index) => {
          const date = addGameDays(weekStart, index);
          const status = index < life.dayIndex ? "is-complete" : index === life.dayIndex ? "is-current" : "";
          return (
            <article className={status} key={label}>
              <small>{label}</small>
              <strong>{date.day}</strong>
              <span>{formatShortGameDate(date).replace(String(date.day).padStart(2, "0"), "")}</span>
              <i />
            </article>
          );
        })}
      </div>

      <div className="stat-grid stat-grid--live">
        <article className="stat-tile stat-tile--live">
          <span className="stat-tile__icon"><Icon name="bolt" /></span><small>ENERGY</small><strong>{Math.round(character.condition.energy)}</strong><p>{character.condition.sleepHours.toFixed(1)} h sleep</p>
          <div className="micro-track"><i style={{ width: `${character.condition.energy}%` }} /></div>
        </article>
        <article className="stat-tile stat-tile--live">
          <span className="stat-tile__icon"><Icon name="pulse" /></span><small>FATIGUE</small><strong>{Math.round(character.condition.fatigue)}</strong><p>{character.condition.fatigue >= 65 ? "Load warning" : "Manageable load"}</p>
          <div className="micro-track"><i style={{ width: `${character.condition.fatigue}%` }} /></div>
        </article>
        <article className="stat-tile stat-tile--live">
          <span className="stat-tile__icon"><Icon name="brain" /></span><small>STRESS</small><strong>{Math.round(character.condition.stress)}</strong><p>{mindsetLabels[character.personality.preset].name}</p>
          <div className="micro-track"><i style={{ width: `${character.condition.stress}%` }} /></div>
        </article>
        <article className="stat-tile stat-tile--live">
          <span className="stat-tile__icon"><Icon name="shield" /></span><small>COACH TRUST</small><strong>{Math.round(football.depthChart.coachTrust)}</strong><p>{roleLabel(football.depthChart.projectedRole)}</p>
          <div className="micro-track"><i style={{ width: `${football.depthChart.coachTrust}%` }} /></div>
        </article>
      </div>

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      <div className="command-grid">
        <section className="panel strategy-panel">
          <header className="panel__header panel__header--large">
            <div><small>WEEKLY SYSTEM</small><h3>Выбери режим</h3><p>План действует каждый день, пока ты его не изменишь.</p></div>
            <span className="panel-index">{String(life.weeklyPlan.revision).padStart(2, "0")}</span>
          </header>

          <div className="plan-deck">
            {weeklyPlanTemplates.map((template, index) => (
              <button
                type="button"
                className={selectedTemplate === template.id ? "is-active" : ""}
                onClick={() => setSelectedTemplate(template.id)}
                key={template.id}
              >
                <span className="plan-deck__number">0{index + 1}</span>
                <div><small>{riskLabel(template.risk)}</small><strong>{template.shortName}</strong><p>{template.identity}</p></div>
                <Icon name={selectedTemplate === template.id ? "check" : "arrow-right"} />
              </button>
            ))}
          </div>

          <div className="plan-readout">
            <div className="plan-readout__copy"><small>{activeTemplate.name.toUpperCase()}</small><strong>{activeTemplate.description}</strong></div>
            <div className="focus-bars">
              {Object.entries(activeTemplate.focus).map(([key, value]) => (
                <span key={key}><small>{key}</small><i><b style={{ width: `${value}%` }} /></i><strong>{value}</strong></span>
              ))}
            </div>
          </div>

          <div className="intensity-block">
            <div><small>INTENSITY</small><strong>Насколько жёстко выполнять план</strong></div>
            <div className="intensity-switch">
              {intensityDescriptors.map((item) => (
                <button type="button" className={selectedIntensity === item.id ? "is-active" : ""} onClick={() => setSelectedIntensity(item.id)} key={item.id}>
                  <span>{item.name}</span><small>{item.loadMultiplier.toFixed(2)}×</small>
                </button>
              ))}
            </div>
          </div>

          <div className="plan-forecast">
            <span><small>PROJECTED LOAD</small><strong>{projectedLoad}</strong></span>
            <span><small>RECOVERY MARGIN</small><strong className={recoveryMargin < 0 ? "is-danger" : ""}>{recoveryMargin > 0 ? "+" : ""}{recoveryMargin}</strong></span>
            <span><small>CONSISTENCY</small><strong>{Math.round(life.consistency)}</strong></span>
          </div>

          <button
            type="button"
            className="button button--plan"
            disabled={!planChanged || mutating}
            onClick={() => void onUpdatePlan(selectedTemplate, selectedIntensity)}
          >
            <span>{mutating ? "Сохранение…" : planChanged ? "Применить план" : "План активен"}</span>
            <Icon name={planChanged ? "arrow-right" : "check"} />
          </button>
        </section>

        <section className="panel execution-panel">
          <header className="panel__header panel__header--large">
            <div><small>DAY EXECUTION</small><h3>{formatWeekday(save.meta.currentDate)}</h3><p>{schedule.length} блока · {schedule.reduce((total, item) => total + item.durationMinutes, 0)} минут</p></div>
            <span className="execution-signal"><i /> LIVE</span>
          </header>

          <div className="schedule-stack">
            {schedule.map((activity, index) => (
              <article className={`schedule-item schedule-item--${activity.type}`} key={activity.id}>
                <div className="schedule-item__time"><strong>{activity.time}</strong><small>{activity.durationMinutes} MIN</small></div>
                <span className="schedule-item__node"><Icon name={activityIcons[activity.type]} size={17} /></span>
                <div className="schedule-item__copy">
                  <span><small>{activity.type}</small>{activity.mandatory && <em>MANDATORY</em>}</span>
                  <strong>{activity.title}</strong>
                  <p>{activity.location} · {activity.impact}</p>
                </div>
                <span className="schedule-item__index">0{index + 1}</span>
              </article>
            ))}
          </div>

          <div className="day-execution-footer">
            <div>
              <span><Icon name="database" size={16} /> Автосохранение</span>
              <small>Результат зависит от состояния, характера, плана и seed текущего дня.</small>
            </div>
            <button type="button" className="execute-day-button" disabled={mutating || planChanged} onClick={() => void onAdvanceDay()}>
              <span><small>{planChanged ? "СНАЧАЛА ПРИМЕНИ ПЛАН" : "SIMULATE DAY"}</small><strong>{mutating ? "Расчёт…" : "Завершить день"}</strong></span>
              <Icon name="arrow-right" size={24} />
            </button>
          </div>
        </section>
      </div>

      {life.lastOutcome && (
        <section className={`day-report day-report--${life.lastOutcome.grade.toLowerCase()}`}>
          <div className="day-report__grade"><small>DAY GRADE</small><strong>{life.lastOutcome.grade}</strong></div>
          <div className="day-report__main">
            <span className="eyebrow">LAST COMPLETED DAY</span>
            <h3>{life.lastOutcome.title}</h3>
            <p>{life.lastOutcome.summary}</p>
            <div className="report-highlights">
              {life.lastOutcome.highlights.map((highlight) => <span key={highlight}><i />{highlight}</span>)}
            </div>
          </div>
          <div className="delta-board">
            <span><small>ENERGY</small><strong className={life.lastOutcome.deltas.energy < 0 ? "is-negative" : ""}>{signed(life.lastOutcome.deltas.energy)}</strong></span>
            <span><small>FATIGUE</small><strong className={life.lastOutcome.deltas.fatigue > 0 ? "is-negative" : ""}>{signed(life.lastOutcome.deltas.fatigue)}</strong></span>
            <span><small>TRUST</small><strong className={life.lastOutcome.deltas.coachTrust < 0 ? "is-negative" : ""}>{signed(life.lastOutcome.deltas.coachTrust)}</strong></span>
            <span><small>OVR</small><strong>{signed(life.lastOutcome.deltas.overall, 2)}</strong></span>
            <span><small>GPA</small><strong className={life.lastOutcome.deltas.gpa < 0 ? "is-negative" : ""}>{signed(life.lastOutcome.deltas.gpa, 3)}</strong></span>
          </div>
        </section>
      )}
    </div>
  );
}
