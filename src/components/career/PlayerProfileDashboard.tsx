import type { CollegeEntryRoute } from "../../sports/football/college/types";
import type { CareerSave } from "../../storage/saves/schema";
import { mindsetLabels } from "../../sports/football/career/catalog";
import { playerStatCards } from "./SeasonDashboard";
import { DecisionDayDashboard } from "./DecisionDayDashboard";
import { Icon } from "../ui/Icon";

interface PlayerProfileDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onResolveCollegeDecision?(optionId: string): Promise<void>;
  onSignCollege?(programId: string, route: CollegeEntryRoute): Promise<void>;
  onReportToCollege?(): Promise<void>;
}

function heightLabel(inches: number): string {
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

function potentialLabel(value: CareerSave["football"]["ratings"]["potentialBand"]): string {
  return {
    "role-player": "Роль",
    starter: "Стартер",
    "high-upside": "Высокий",
    "national-ceiling": "Элита",
  }[value];
}

function teamName(save: CareerSave): string {
  if (save.football.professional.contract) return save.football.professional.contract.teamName;
  if (save.football.college.program) return save.football.college.program.shortName;
  return save.football.school.shortName;
}

function classLabel(save: CareerSave): string {
  if (save.meta.phase === "college-season" && save.football.college.heroCareer) return save.football.college.heroCareer.classYear;
  if (save.meta.phase === "professional-draft" || save.meta.phase === "professional-career") return `Draft ${save.football.professional.draftYear}`;
  return "Senior";
}

function collegeStats(save: CareerSave): Array<{ label: string; value: string; detail: string }> {
  const career = save.football.college.heroCareer;
  if (!career) return playerStatCards(save);
  const totals = career.gameLog.reduce((acc, game) => {
    const stats = game.stats;
    acc.snaps += game.snaps;
    acc.starts += Number(game.started);
    if (stats) {
      acc.passingYards += stats.passingYards;
      acc.rushingYards += stats.rushingYards;
      acc.receivingYards += stats.receivingYards;
      acc.touchdowns += stats.touchdowns;
      acc.turnovers += stats.turnovers;
      acc.tackles += stats.tackles;
      acc.sacks += stats.sacks;
      acc.interceptions += stats.interceptions;
    }
    return acc;
  }, { snaps: 0, starts: 0, passingYards: 0, rushingYards: 0, receivingYards: 0, touchdowns: 0, turnovers: 0, tackles: 0, sacks: 0, interceptions: 0 });

  switch (save.football.position) {
    case "QB": return [
      { label: "Пас", value: String(totals.passingYards), detail: "ярды" },
      { label: "TD", value: String(totals.touchdowns), detail: "сезон" },
      { label: "Потери", value: String(totals.turnovers), detail: "сезон" },
      { label: "Снэпы", value: String(totals.snaps), detail: `${totals.starts} стартов` },
    ];
    case "RB": return [
      { label: "Вынос", value: String(totals.rushingYards), detail: "ярды" },
      { label: "Приём", value: String(totals.receivingYards), detail: "ярды" },
      { label: "TD", value: String(totals.touchdowns), detail: "сезон" },
      { label: "Снэпы", value: String(totals.snaps), detail: `${totals.starts} стартов` },
    ];
    case "WR": return [
      { label: "Приём", value: String(totals.receivingYards), detail: "ярды" },
      { label: "TD", value: String(totals.touchdowns), detail: "сезон" },
      { label: "Старты", value: String(totals.starts), detail: `${career.gamesPlayed} игр` },
      { label: "Снэпы", value: String(totals.snaps), detail: "сезон" },
    ];
    case "LB": return [
      { label: "Захваты", value: String(totals.tackles), detail: "сезон" },
      { label: "Сэки", value: String(totals.sacks), detail: "сезон" },
      { label: "INT", value: String(totals.interceptions), detail: "сезон" },
      { label: "Снэпы", value: String(totals.snaps), detail: `${totals.starts} стартов` },
    ];
    case "CB": return [
      { label: "Захваты", value: String(totals.tackles), detail: "сезон" },
      { label: "INT", value: String(totals.interceptions), detail: "сезон" },
      { label: "Старты", value: String(totals.starts), detail: `${career.gamesPlayed} игр` },
      { label: "Снэпы", value: String(totals.snaps), detail: "сезон" },
    ];
  }
}

export function PlayerProfileDashboard({ save, mutating, actionError, onResolveCollegeDecision, onSignCollege, onReportToCollege }: PlayerProfileDashboardProps) {
  const { character, football } = save;
  const collegeCareer = football.college.heroCareer;
  const stats = save.meta.phase === "college-season" ? collegeStats(save) : playerStatCards(save);
  const heroBonds = save.world.social.bonds
    .filter((bond) => bond.active && (bond.entityAId === "hero" || bond.entityBId === "hero"))
    .sort((left, right) => right.influence - left.influence)
    .slice(0, 4);
  const counterpartName = (entityId: string) => save.world.players.find((player) => player.id === entityId)?.name
    ?? save.world.coaches.find((coach) => coach.id === entityId)?.name
    ?? entityId;

  return (
    <div className="player-profile-page">
      <header className="player-profile-hero">
        <div className="player-profile-hero__number">{String(football.jerseyNumber).padStart(2, "0")}</div>
        <div className="player-profile-hero__copy">
          <small>{football.position} · {classLabel(save)} · {teamName(save)}</small>
          <h1>{character.identity.fullName}</h1>
          <span>{football.archetypeName}</span>
        </div>
        <div className="player-profile-hero__overall"><strong>{Math.round(football.ratings.overall)}</strong><small>OVR</small></div>
      </header>

      <section className="player-profile-ratings" aria-label="Рейтинги игрока">
        <article><small>Потенциал</small><strong>{potentialLabel(football.ratings.potentialBand)}</strong></article>
        <article><small>Техника</small><strong>{Math.round(football.ratings.technique)}</strong></article>
        <article><small>Атлетизм</small><strong>{Math.round(football.ratings.athleticism)}</strong></article>
        <article><small>Football IQ</small><strong>{Math.round(football.ratings.footballIq)}</strong></article>
        <article><small>Характер</small><strong>{Math.round(football.ratings.competitiveness)}</strong></article>
      </section>

      <section className="profile-section-block">
        <header><span>Статистика</span><strong>{save.meta.phase === "college-season" ? collegeCareer?.seasonYear : football.season.year}</strong></header>
        <div className="profile-stat-grid">
          {stats.map((stat) => <article key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong><span>{stat.detail}</span></article>)}
        </div>
      </section>

      <section className="profile-section-block">
        <header><span>Физика</span><strong>{heightLabel(character.physical.heightInches)} · {character.physical.weightLbs} LB</strong></header>
        <div className="profile-skill-list">
          {[
            ["Скорость", character.physical.speed],
            ["Сила", character.physical.strength],
            ["Ловкость", character.physical.agility],
            ["Взрыв", character.physical.explosiveness],
            ["Выносливость", character.physical.stamina],
          ].map(([label, value]) => <span key={String(label)}><small>{label}</small><strong>{Math.round(Number(value))}</strong><i><b style={{ width: `${Number(value)}%` }} /></i></span>)}
        </div>
      </section>

      <section className="profile-section-block profile-section-block--split">
        <article><small>Характер</small><strong>{mindsetLabels[character.personality.preset].name}</strong><span>Дисциплина {Math.round(character.personality.discipline)} · Самообладание {Math.round(character.personality.composure)}</span></article>
        <article><small>Учёба</small><strong>GPA {character.education.gpa.toFixed(2)}</strong><span>{character.education.eligibilityStatus} · посещаемость {Math.round(character.education.attendance)}</span></article>
        <article><small>Состояние</small><strong>{Math.round(character.condition.health)} HP</strong><span>Энергия {Math.round(character.condition.energy)} · стресс {Math.round(character.condition.stress)}</span></article>
      </section>

      {heroBonds.length > 0 && (
        <section className="profile-section-block">
          <header><span>Связи</span><strong>{heroBonds.length}</strong></header>
          <div className="profile-bond-list">
            {heroBonds.map((bond) => {
              const otherId = bond.entityAId === "hero" ? bond.entityBId : bond.entityAId;
              return <article key={bond.id}><div><strong>{counterpartName(otherId)}</strong><small>{bond.kind}</small></div><span>Доверие {Math.round(bond.trust)}</span><span>Напряжение {Math.round(bond.tension)}</span></article>;
            })}
          </div>
        </section>
      )}

      {collegeCareer?.pendingDecision && onResolveCollegeDecision && (
        <section className="profile-decision-block">
          <header><Icon name="target" /><div><small>Решение</small><strong>{collegeCareer.pendingDecision.title}</strong></div></header>
          <div>
            {collegeCareer.pendingDecision.options.map((option) => (
              <button type="button" key={option.id} disabled={mutating} onClick={() => void onResolveCollegeDecision(option.id)}>
                <strong>{option.label}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {(football.season.phase === "complete" || football.college.status === "signed") && onSignCollege && onReportToCollege && (
        <section className="profile-section-block profile-decision-day">
          <DecisionDayDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onSign={onSignCollege} onReportToCollege={onReportToCollege} />
        </section>
      )}

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    </div>
  );
}
