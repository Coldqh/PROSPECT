import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  CharacterCreationInput,
  FamilyIncomeTier,
  FamilyStructure,
  FamilySupport,
  MindsetPreset,
} from "../core/character/types";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { Icon, type IconName } from "../components/ui/Icon";
import { MetricBar } from "../components/ui/MetricBar";
import {
  familyIncomeLabels,
  familyStructureLabels,
  familySupportLabels,
  getArchetypesForPosition,
  getOriginPreset,
  getPositionDescriptor,
  mindsetLabels,
  originPresets,
  positionDescriptors,
} from "../sports/football/career/catalog";
import type { FootballCareerSetup, FootballPosition } from "../sports/football/career/types";
import { useCareerLibrary } from "../state/CareerLibraryProvider";

const steps = [
  { id: "sport", label: "Sport", title: "Выбор мира", icon: "football" },
  { id: "identity", label: "Identity", title: "Личность", icon: "user" },
  { id: "origin", label: "Origin", title: "Происхождение", icon: "map" },
  { id: "role", label: "Role", title: "Позиция", icon: "target" },
  { id: "mindset", label: "Mindset", title: "Характер", icon: "brain" },
  { id: "review", label: "Launch", title: "Запуск", icon: "spark" },
] as const satisfies readonly { id: string; label: string; title: string; icon: IconName }[];

type StepId = (typeof steps)[number]["id"];

const initialCharacter: CharacterCreationInput = {
  firstName: "",
  lastName: "",
  birthDate: "2008-02-14",
  gender: "male",
  handedness: "right",
  originId: "houston",
  familyIncome: "working",
  familyStructure: "two-parent",
  familySupport: "supportive",
  mindset: "composed",
};

const initialSetup: FootballCareerSetup = {
  character: initialCharacter,
  position: "WR",
  archetypeId: "route-technician",
  jerseyNumber: 11,
};

function ChoiceCard({
  active,
  icon,
  title,
  kicker,
  description,
  onClick,
  disabled = false,
}: {
  active: boolean;
  icon?: IconName;
  title: string;
  kicker?: string;
  description: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`choice-card ${active ? "choice-card--active" : ""} ${disabled ? "choice-card--disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="choice-card__top">
        {icon && <span className="choice-card__icon"><Icon name={icon} /></span>}
        {kicker && <span className="choice-card__kicker">{kicker}</span>}
        <span className="choice-card__check"><Icon name={active ? "check" : "arrow-right"} size={17} /></span>
      </span>
      <strong>{title}</strong>
      <small>{description}</small>
    </button>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
}) {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? "is-active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function NewCareerScreen() {
  const navigate = useNavigate();
  const { createFootballCareer } = useCareerLibrary();
  const [step, setStep] = useState<StepId>("sport");
  const [setup, setSetup] = useState<FootballCareerSetup>(initialSetup);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  const stepIndex = steps.findIndex((item) => item.id === step);
  const archetypesForPosition = getArchetypesForPosition(setup.position);
  const selectedArchetype = archetypesForPosition.find((item) => item.id === setup.archetypeId) ?? archetypesForPosition[0];
  const selectedOrigin = getOriginPreset(setup.character.originId);
  const position = getPositionDescriptor(setup.position);

  const progress = Math.round((stepIndex / (steps.length - 1)) * 100);
  const canContinue = useMemo(() => {
    if (step === "identity") {
      return setup.character.firstName.trim().length >= 2 && setup.character.lastName.trim().length >= 2 && setup.character.birthDate.length === 10;
    }
    if (step === "role") {
      return Boolean(selectedArchetype) && setup.jerseyNumber >= 0 && setup.jerseyNumber <= 99;
    }
    return true;
  }, [selectedArchetype, setup, step]);

  function updateCharacter(patch: Partial<CharacterCreationInput>) {
    setSetup((current) => ({ ...current, character: { ...current.character, ...patch } }));
  }

  function selectPosition(nextPosition: FootballPosition) {
    const nextArchetype = getArchetypesForPosition(nextPosition)[0];
    const range = getPositionDescriptor(nextPosition).numberRange;
    if (!nextArchetype) {
      return;
    }
    setSetup((current) => ({
      ...current,
      position: nextPosition,
      archetypeId: nextArchetype.id,
      jerseyNumber: Math.max(range[0], Math.min(range[1], current.jerseyNumber)),
    }));
  }

  function goForward() {
    if (!canContinue || stepIndex >= steps.length - 1) {
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) {
      setStep(next.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    if (stepIndex === 0) {
      navigate(-1);
      return;
    }
    const previous = steps[stepIndex - 1];
    if (previous) {
      setStep(previous.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function launchCareer() {
    if (!canContinue) {
      return;
    }
    setCreating(true);
    setError(undefined);
    try {
      const save = await createFootballCareer(setup);
      navigate(`/career/${save.meta.id}`, { replace: true });
    } catch (caught) {
      console.error(caught);
      setError("Не удалось создать карьеру. Проверь данные и повтори попытку.");
      setCreating(false);
    }
  }

  return (
    <ScreenShell
      header={
        <AppHeader
          compact
          action={
            <button className="icon-button" aria-label="Закрыть создание" onClick={() => navigate("/")}>
              <Icon name="close" />
            </button>
          }
        />
      }
    >
      <div className="creator-shell">
        <aside className="creator-rail">
          <div className="creator-rail__head">
            <span>CAREER BUILDER</span>
            <strong>{String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</strong>
          </div>
          <div className="creator-progress"><i style={{ height: `${progress}%` }} /></div>
          <nav aria-label="Этапы создания карьеры">
            {steps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`${item.id === step ? "is-active" : ""} ${index < stepIndex ? "is-complete" : ""}`}
                onClick={() => index <= stepIndex && setStep(item.id)}
                disabled={index > stepIndex}
              >
                <span><Icon name={item.icon} size={17} /></span>
                <div><small>{item.label}</small><strong>{item.title}</strong></div>
                {index < stepIndex && <Icon name="check" size={15} />}
              </button>
            ))}
          </nav>
        </aside>

        <section className="creator-stage">
          <header className="creator-stage__header">
            <div>
              <span className="eyebrow">PROSPECT // ORIGIN SEQUENCE</span>
              <h1>{steps[stepIndex]?.title}</h1>
            </div>
            <span className="creator-stage__number">{String(stepIndex + 1).padStart(2, "0")}</span>
          </header>

          {step === "sport" && (
            <div className="creator-content">
              <div className="creator-lead">
                <h2>Один спорт. Одна жизнь.</h2>
                <p>Мир второго спорта не создаётся и не участвует в сохранении. Сейчас доступен полный путь American Football.</p>
              </div>
              <div className="sport-select-grid">
                <ChoiceCard
                  active
                  icon="football"
                  kicker="ACTIVE MODULE"
                  title="American Football"
                  description="Последний школьный сезон, борьба за состав, матчи и рекрутинг колледжей."
                  onClick={() => undefined}
                />
                <ChoiceCard
                  active={false}
                  icon="basketball"
                  kicker="LOCKED"
                  title="Basketball"
                  description="Будет подключён отдельным модулем после устойчивой футбольной карьеры."
                  onClick={() => undefined}
                  disabled
                />
              </div>
              <div className="creator-data-strip">
                <span><Icon name="database" /> Только футбольная экосистема</span>
                <span><Icon name="shield" /> Локальное сохранение</span>
                <span><Icon name="spark" /> Уникальный world seed</span>
              </div>
            </div>
          )}

          {step === "identity" && (
            <div className="creator-content creator-content--form">
              <div className="creator-lead">
                <h2>Кто выходит на поле?</h2>
                <p>Это не никнейм и не карточка. Имя останется в истории команд, новостях и отношениях.</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Имя</span>
                  <input
                    autoFocus
                    value={setup.character.firstName}
                    maxLength={24}
                    placeholder="Jalen"
                    onChange={(event) => updateCharacter({ firstName: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Фамилия</span>
                  <input
                    value={setup.character.lastName}
                    maxLength={28}
                    placeholder="Cole"
                    onChange={(event) => updateCharacter({ lastName: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Дата рождения</span>
                  <input
                    type="date"
                    min="2007-08-18"
                    max="2009-08-17"
                    value={setup.character.birthDate}
                    onChange={(event) => updateCharacter({ birthDate: event.target.value })}
                  />
                </label>
                <div className="field">
                  <span>Пол</span>
                  <Segment
                    value={setup.character.gender}
                    options={[{ value: "male", label: "Мужской" }, { value: "female", label: "Женский" }]}
                    onChange={(gender) => updateCharacter({ gender })}
                  />
                </div>
                <div className="field">
                  <span>Ведущая рука</span>
                  <Segment
                    value={setup.character.handedness}
                    options={[{ value: "right", label: "Правая" }, { value: "left", label: "Левая" }]}
                    onChange={(handedness) => updateCharacter({ handedness })}
                  />
                </div>
              </div>
              <div className="identity-preview">
                <div className="identity-preview__monogram">
                  {(setup.character.firstName[0] ?? "P").toUpperCase()}{(setup.character.lastName[0] ?? "R").toUpperCase()}
                </div>
                <div>
                  <small>PLAYER ID</small>
                  <strong>{setup.character.firstName || "FIRST"} {setup.character.lastName || "LAST"}</strong>
                  <span>Class of 2027 · Senior season</span>
                </div>
              </div>
            </div>
          )}

          {step === "origin" && (
            <div className="creator-content">
              <div className="creator-lead">
                <h2>Где началась история?</h2>
                <p>Регион определяет футбольную культуру, конкуренцию, ресурсы и тип школьной программы.</p>
              </div>
              <div className="origin-grid">
                {originPresets.map((origin) => (
                  <button
                    type="button"
                    key={origin.id}
                    className={`origin-card ${setup.character.originId === origin.id ? "is-active" : ""}`}
                    onClick={() => updateCharacter({ originId: origin.id })}
                  >
                    <span>{origin.stateCode}</span>
                    <strong>{origin.city}</strong>
                    <small>{origin.tagline}</small>
                    <div><i style={{ width: `${origin.footballCulture}%` }} /></div>
                    <em>Football culture {origin.footballCulture}</em>
                  </button>
                ))}
              </div>
              <div className="creator-subsection">
                <div className="creator-subsection__head"><span>FAMILY ENVIRONMENT</span><strong>Стартовые условия</strong></div>
                <div className="form-grid form-grid--three">
                  <label className="field">
                    <span>Финансы семьи</span>
                    <select value={setup.character.familyIncome} onChange={(event) => updateCharacter({ familyIncome: event.target.value as FamilyIncomeTier })}>
                      {Object.entries(familyIncomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Структура семьи</span>
                    <select value={setup.character.familyStructure} onChange={(event) => updateCharacter({ familyStructure: event.target.value as FamilyStructure })}>
                      {Object.entries(familyStructureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Отношение к спорту</span>
                    <select value={setup.character.familySupport} onChange={(event) => updateCharacter({ familySupport: event.target.value as FamilySupport })}>
                      {Object.entries(familySupportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === "role" && selectedArchetype && (
            <div className="creator-content">
              <div className="creator-lead">
                <h2>Как ты влияешь на игру?</h2>
                <p>Позиция меняет весь матчевый геймплей. Архетип определяет стартовый профиль, но не закрывает развитие.</p>
              </div>
              <div className="position-tabs">
                {positionDescriptors.map((item) => (
                  <button type="button" key={item.id} className={setup.position === item.id ? "is-active" : ""} onClick={() => selectPosition(item.id)}>
                    <strong>{item.id}</strong><span>{item.name}</span>
                  </button>
                ))}
              </div>
              <div className="role-layout">
                <div className="archetype-grid">
                  {archetypesForPosition.map((archetype) => (
                    <ChoiceCard
                      key={archetype.id}
                      active={setup.archetypeId === archetype.id}
                      kicker={archetype.label}
                      title={archetype.name}
                      description={archetype.summary}
                      onClick={() => setSetup((current) => ({ ...current, archetypeId: archetype.id }))}
                    />
                  ))}
                </div>
                <aside className="athlete-scan">
                  <div className="athlete-scan__top"><span>ATHLETE SCAN</span><strong>{setup.position}</strong></div>
                  <div className="jersey-control">
                    <span>JERSEY</span>
                    <input
                      type="number"
                      min={position.numberRange[0]}
                      max={position.numberRange[1]}
                      value={setup.jerseyNumber}
                      onChange={(event) => setSetup((current) => ({ ...current, jerseyNumber: Number(event.target.value) }))}
                    />
                  </div>
                  <MetricBar label="Speed" value={selectedArchetype.speed} />
                  <MetricBar label="Strength" value={selectedArchetype.strength} />
                  <MetricBar label="Agility" value={selectedArchetype.agility} />
                  <MetricBar label="Technique" value={selectedArchetype.technique} />
                  <MetricBar label="Football IQ" value={selectedArchetype.footballIq} />
                  <div className="scan-range"><span>Projected build</span><strong>{selectedArchetype.height[0]}–{selectedArchetype.height[1]} in · {selectedArchetype.weight[0]}–{selectedArchetype.weight[1]} lb</strong></div>
                </aside>
              </div>
            </div>
          )}

          {step === "mindset" && (
            <div className="creator-content">
              <div className="creator-lead">
                <h2>Что происходит под шлемом?</h2>
                <p>Характер меняет стресс, решения, отношения с тренером и цену рискованных действий.</p>
              </div>
              <div className="mindset-grid">
                {(Object.entries(mindsetLabels) as [MindsetPreset, { name: string; summary: string }][]).map(([id, item], index) => (
                  <button type="button" key={id} className={`mindset-card ${setup.character.mindset === id ? "is-active" : ""}`} onClick={() => updateCharacter({ mindset: id })}>
                    <span>0{index + 1}</span>
                    <div><small>MINDSET</small><strong>{item.name}</strong><p>{item.summary}</p></div>
                    <Icon name={setup.character.mindset === id ? "check" : "arrow-right"} />
                  </button>
                ))}
              </div>
              <div className="creator-warning">
                <Icon name="pulse" />
                <div><strong>Это не класс персонажа</strong><span>Черты будут меняться через опыт, привычки, отношения и последствия решений.</span></div>
              </div>
            </div>
          )}

          {step === "review" && selectedArchetype && (
            <div className="creator-content">
              <div className="launch-card">
                <div className="launch-card__player">
                  <span className="launch-card__index">PRSPCT / 2026</span>
                  <div className="launch-card__number">{String(setup.jerseyNumber).padStart(2, "0")}</div>
                  <div className="launch-card__identity">
                    <small>{setup.position} · {selectedArchetype.name}</small>
                    <h2>{setup.character.firstName || "Unnamed"}<br />{setup.character.lastName || "Prospect"}</h2>
                    <span>{selectedOrigin.city}, {selectedOrigin.stateCode}</span>
                  </div>
                </div>
                <div className="launch-card__data">
                  <div><small>ORIGIN</small><strong>{selectedOrigin.region}</strong></div>
                  <div><small>FAMILY</small><strong>{familyIncomeLabels[setup.character.familyIncome]}</strong></div>
                  <div><small>MINDSET</small><strong>{mindsetLabels[setup.character.mindset].name}</strong></div>
                  <div><small>HAND</small><strong>{setup.character.handedness === "right" ? "Right" : "Left"}</strong></div>
                </div>
              </div>
              <div className="launch-sequence">
                <span><Icon name="spark" /><strong>Генерация школы</strong><small>Культура, тренеры, медицина, depth chart</small></span>
                <span><Icon name="team" /><strong>Генерация команды</strong><small>Конкурент, роль, следующий соперник</small></span>
                <span><Icon name="database" /><strong>Безопасный снимок</strong><small>Schema v3 · IndexedDB · backup</small></span>
              </div>
              {error && <div className="inline-message inline-message--error">{error}</div>}
            </div>
          )}

          <footer className="creator-actions">
            <button type="button" className="button button--ghost" onClick={goBack}>
              <Icon name="arrow-left" /> {stepIndex === 0 ? "Выйти" : "Назад"}
            </button>
            {step === "review" ? (
              <button type="button" className="button button--primary button--launch" disabled={creating || !canContinue} onClick={() => void launchCareer()}>
                {creating ? "Генерация мира…" : "Начать карьеру"}<Icon name="spark" />
              </button>
            ) : (
              <button type="button" className="button button--primary" disabled={!canContinue} onClick={goForward}>
                Продолжить <Icon name="arrow-right" />
              </button>
            )}
          </footer>
        </section>

        <aside className="creator-preview">
          <div className="creator-preview__label">LIVE PROFILE</div>
          <div className="mini-player-card">
            <div className="mini-player-card__top">
              <span>{setup.position}</span><strong>#{String(setup.jerseyNumber).padStart(2, "0")}</strong>
            </div>
            <div className="mini-player-card__avatar">{(setup.character.firstName[0] ?? "P").toUpperCase()}{(setup.character.lastName[0] ?? "R").toUpperCase()}</div>
            <h3>{setup.character.firstName || "UNNAMED"}<br />{setup.character.lastName || "PROSPECT"}</h3>
            <p>{selectedArchetype?.name ?? "Select archetype"}</p>
            <div className="mini-player-card__footer"><span>{selectedOrigin.stateCode}</span><span>{mindsetLabels[setup.character.mindset].name}</span></div>
          </div>
          <div className="preview-signal"><i /><span>World not generated</span></div>
        </aside>
      </div>
    </ScreenShell>
  );
}
