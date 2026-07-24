import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { CharacterCreationInput, FamilyIncomeTier, FamilyStructure, FamilySupport, MindsetPreset } from "../core/character/types";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { Icon, type IconName } from "../components/ui/Icon";
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
  { id: "identity", label: "Игрок", icon: "user" },
  { id: "origin", label: "Дом", icon: "map" },
  { id: "role", label: "Позиция", icon: "target" },
  { id: "mindset", label: "Характер", icon: "brain" },
  { id: "review", label: "Старт", icon: "spark" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

type StepId = (typeof steps)[number]["id"];

const mindsetSkills: Record<MindsetPreset, Record<string, number>> = {
  obsessed: { DISC: 86, AMB: 91, CONF: 72, COMP: 65, COACH: 76, ADAPT: 70 },
  composed: { DISC: 78, AMB: 76, CONF: 76, COMP: 88, COACH: 84, ADAPT: 78 },
  electric: { DISC: 65, AMB: 85, CONF: 91, COMP: 64, COACH: 66, ADAPT: 76 },
  underdog: { DISC: 82, AMB: 84, CONF: 67, COMP: 76, COACH: 81, ADAPT: 89 },
};

const initialSetup: FootballCareerSetup = {
  character: {
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
  },
  position: "WR",
  archetypeId: "route-technician",
  jerseyNumber: 11,
};

function StatLine({ data }: { data: Record<string, number> }) {
  return <div className="creator-stat-line">{Object.entries(data).map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div>;
}

export default function NewCareerScreen() {
  const navigate = useNavigate();
  const { createFootballCareer } = useCareerLibrary();
  const [step, setStep] = useState<StepId>("identity");
  const [setup, setSetup] = useState<FootballCareerSetup>(initialSetup);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const stepIndex = steps.findIndex((item) => item.id === step);
  const archetypes = getArchetypesForPosition(setup.position);
  const archetype = archetypes.find((item) => item.id === setup.archetypeId) ?? archetypes[0];
  const origin = getOriginPreset(setup.character.originId);
  const position = getPositionDescriptor(setup.position);
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const canContinue = useMemo(() => step !== "identity" || (setup.character.firstName.trim().length >= 2 && setup.character.lastName.trim().length >= 2), [setup.character.firstName, setup.character.lastName, step]);

  function updateCharacter(patch: Partial<CharacterCreationInput>) {
    setSetup((current) => ({ ...current, character: { ...current.character, ...patch } }));
  }

  function selectPosition(next: FootballPosition) {
    const nextArchetype = getArchetypesForPosition(next)[0];
    const range = getPositionDescriptor(next).numberRange;
    if (!nextArchetype) return;
    setSetup((current) => ({ ...current, position: next, archetypeId: nextArchetype.id, jerseyNumber: Math.max(range[0], Math.min(range[1], current.jerseyNumber)) }));
  }

  function move(delta: number) {
    const next = steps[stepIndex + delta];
    if (next) setStep(next.id);
    else if (delta < 0) navigate("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function launchCareer() {
    setCreating(true);
    setError(undefined);
    try {
      const save = await createFootballCareer(setup);
      navigate(`/career/${save.meta.id}`, { replace: true });
    } catch (caught) {
      console.error(caught);
      setError("Создание не выполнено");
      setCreating(false);
    }
  }

  return (
    <ScreenShell className="new-career" header={<AppHeader compact context="NEW CAREER" action={<button className="icon-button" aria-label="Закрыть" onClick={() => navigate("/")}><Icon name="close" /></button>} />}>
      <div className="new-career__shell">
        <header className="new-career__progress">
          <div><small>{String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</small><strong>{steps[stepIndex]?.label}</strong></div>
          <nav aria-label="Этапы">{steps.map((item, index) => <button type="button" key={item.id} className={item.id === step ? "is-active" : index < stepIndex ? "is-complete" : ""} disabled={index > stepIndex} onClick={() => index <= stepIndex && setStep(item.id)} aria-label={item.label}><Icon name={index < stepIndex ? "check" : item.icon} size={16} /></button>)}</nav>
          <i style={{ "--progress": `${progress}%` } as CSSProperties}><b /></i>
        </header>

        <main className="new-career__stage">
          {step === "identity" && (
            <section className="creator-panel">
              <header><small>01</small><h1>Игрок</h1></header>
              <div className="creator-form-grid">
                <label><span>Имя</span><input autoFocus value={setup.character.firstName} onChange={(event) => updateCharacter({ firstName: event.target.value })} /></label>
                <label><span>Фамилия</span><input value={setup.character.lastName} onChange={(event) => updateCharacter({ lastName: event.target.value })} /></label>
                <label><span>Дата рождения</span><input type="date" value={setup.character.birthDate} onChange={(event) => updateCharacter({ birthDate: event.target.value })} /></label>
                <label><span>Ведущая рука</span><select value={setup.character.handedness} onChange={(event) => updateCharacter({ handedness: event.target.value as "right" | "left" })}><option value="right">Правая</option><option value="left">Левая</option></select></label>
              </div>
            </section>
          )}

          {step === "origin" && (
            <section className="creator-panel">
              <header><small>02</small><h1>Происхождение</h1></header>
              <div className="origin-skill-grid">{originPresets.map((item) => <button type="button" key={item.id} className={setup.character.originId === item.id ? "is-active" : ""} onClick={() => updateCharacter({ originId: item.id })}><header><span>{item.stateCode}</span><strong>{item.city}</strong></header><StatLine data={{ FB: item.footballCulture, TRAIN: item.trainingAccess, MED: item.medicalAccess, SCHOOL: item.schoolQuality }} /></button>)}</div>
              <div className="creator-form-grid creator-form-grid--three">
                <label><span>Финансы</span><select value={setup.character.familyIncome} onChange={(event) => updateCharacter({ familyIncome: event.target.value as FamilyIncomeTier })}>{Object.entries(familyIncomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Семья</span><select value={setup.character.familyStructure} onChange={(event) => updateCharacter({ familyStructure: event.target.value as FamilyStructure })}>{Object.entries(familyStructureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Поддержка</span><select value={setup.character.familySupport} onChange={(event) => updateCharacter({ familySupport: event.target.value as FamilySupport })}>{Object.entries(familySupportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
            </section>
          )}

          {step === "role" && archetype && (
            <section className="creator-panel">
              <header><small>03</small><h1>Позиция</h1></header>
              <nav className="position-select">{positionDescriptors.map((item) => <button type="button" key={item.id} className={setup.position === item.id ? "is-active" : ""} onClick={() => selectPosition(item.id)}><strong>{item.id}</strong><small>{item.name}</small></button>)}</nav>
              <div className="archetype-skill-grid">{archetypes.map((item) => <button type="button" key={item.id} className={setup.archetypeId === item.id ? "is-active" : ""} onClick={() => setSetup((current) => ({ ...current, archetypeId: item.id }))}><header><small>{item.label}</small><strong>{item.name}</strong></header><StatLine data={{ SPD: item.speed, STR: item.strength, AGI: item.agility, TEC: item.technique, IQ: item.footballIq }} /></button>)}</div>
              <label className="jersey-field"><span>Номер</span><input type="number" min={position.numberRange[0]} max={position.numberRange[1]} value={setup.jerseyNumber} onChange={(event) => setSetup((current) => ({ ...current, jerseyNumber: Number(event.target.value) }))} /></label>
            </section>
          )}

          {step === "mindset" && (
            <section className="creator-panel">
              <header><small>04</small><h1>Характер</h1></header>
              <div className="mindset-skill-grid">{(Object.keys(mindsetSkills) as MindsetPreset[]).map((id) => <button type="button" key={id} className={setup.character.mindset === id ? "is-active" : ""} onClick={() => updateCharacter({ mindset: id })}><header><strong>{mindsetLabels[id].name}</strong>{setup.character.mindset === id && <Icon name="check" size={17} />}</header><StatLine data={mindsetSkills[id]} /></button>)}</div>
            </section>
          )}

          {step === "review" && archetype && (
            <section className="creator-panel creator-review">
              <header><small>05</small><h1>Старт</h1></header>
              <div className="creator-review__player"><span>{setup.position}<small>#{setup.jerseyNumber}</small></span><div><h2>{setup.character.firstName} {setup.character.lastName}</h2><p>{archetype.name} · {origin.city}, {origin.stateCode}</p></div></div>
              <StatLine data={{ SPD: archetype.speed, STR: archetype.strength, AGI: archetype.agility, TEC: archetype.technique, IQ: archetype.footballIq }} />
              <div className="creator-review__facts"><span><small>Характер</small><strong>{mindsetLabels[setup.character.mindset].name}</strong></span><span><small>Культура</small><strong>{origin.footballCulture}</strong></span><span><small>Тренировки</small><strong>{origin.trainingAccess}</strong></span><span><small>Медицина</small><strong>{origin.medicalAccess}</strong></span></div>
              {error && <div className="inline-message inline-message--error">{error}</div>}
            </section>
          )}
        </main>

        <footer className="new-career__actions">
          <button type="button" className="button button--ghost" onClick={() => move(-1)}><Icon name="arrow-left" /> Назад</button>
          {step === "review" ? <button type="button" className="button button--primary" disabled={creating} onClick={() => void launchCareer()}>{creating ? "Создание…" : "Начать"}<Icon name="arrow-right" /></button> : <button type="button" className="button button--primary" disabled={!canContinue} onClick={() => move(1)}>Далее <Icon name="arrow-right" /></button>}
        </footer>
      </div>
    </ScreenShell>
  );
}
