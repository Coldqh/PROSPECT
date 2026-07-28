import type { CollegeEntryRoute } from "../../sports/football/college/types";
import type { CareerSave } from "../../storage/saves/schema";
import { mindsetLabels } from "../../sports/football/career/catalog";
import type { MatchStatLine } from "../../sports/football/matches/types";
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


function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function classLabel(save: CareerSave): string {
  if (save.meta.phase === "college-season" && save.football.college.heroCareer) return save.football.college.heroCareer.classYear;
  if (save.meta.phase === "professional-draft" || save.meta.phase === "professional-career") return `Draft ${save.football.professional.draftYear}`;
  return "Senior";
}

function collegeStats(save: CareerSave): Array<{ label: string; value: string; detail: string }> {
  const career = save.football.college.heroCareer;
  if (!career) return playerStatCards(save);
  const totals = career.gameLog.reduce<{ snaps: number; starts: number; stats: MatchStatLine }>((acc, game) => {
    const stats = game.stats;
    acc.snaps += game.snaps;
    acc.starts += Number(game.started);
    if (stats) {
      const source = stats as Partial<Record<keyof MatchStatLine, number>>;
      const target = acc.stats as Record<keyof MatchStatLine, number>;
      for (const key of Object.keys(source) as Array<keyof MatchStatLine>) {
        const value = source[key] ?? 0;
        target[key] = key === "longestFieldGoal"
          ? Math.max(target[key], value)
          : target[key] + value;
      }
    }
    return acc;
  }, {
    snaps: 0,
    starts: 0,
    stats: {
      passingAttempts: 0, completions: 0, passingYards: 0, rushingAttempts: 0, rushingYards: 0,
      targets: 0, receptions: 0, receivingYards: 0, touchdowns: 0, turnovers: 0,
      tackles: 0, tacklesForLoss: 0, sacks: 0, passBreakups: 0, interceptions: 0,
      sacksAllowed: 0, pressuresAllowed: 0, pancakes: 0, hurries: 0, runStops: 0,
      coverageSnaps: 0, fieldGoalsAttempted: 0, fieldGoalsMade: 0, longestFieldGoal: 0,
      punts: 0, puntYards: 0, puntsInside20: 0, returnYardsAllowed: 0,
    },
  });
  const stats = totals.stats;
  const snaps = { label: "Снэпы", value: String(totals.snaps), detail: `${totals.starts} стартов` };

  switch (save.football.position) {
    case "QB": return [
      { label: "Пас", value: String(stats.passingYards), detail: `${stats.completions}/${stats.passingAttempts}` },
      { label: "TD", value: String(stats.touchdowns), detail: "карьера" },
      { label: "Потери", value: String(stats.turnovers), detail: "карьера" },
      snaps,
    ];
    case "RB": return [
      { label: "Вынос", value: String(stats.rushingYards), detail: `${stats.rushingAttempts} попыток` },
      { label: "Приём", value: String(stats.receivingYards), detail: `${stats.receptions}/${stats.targets}` },
      { label: "TD", value: String(stats.touchdowns), detail: "карьера" },
      snaps,
    ];
    case "WR":
    case "TE": return [
      { label: "Приём", value: String(stats.receivingYards), detail: `${stats.receptions}/${stats.targets}` },
      { label: "TD", value: String(stats.touchdowns), detail: "карьера" },
      { label: "Pancakes", value: String(stats.pancakes), detail: "блоки" },
      snaps,
    ];
    case "OT":
    case "OG":
    case "C": return [
      { label: "Сэки отданы", value: String(stats.sacksAllowed), detail: "pass pro" },
      { label: "Давление", value: String(stats.pressuresAllowed), detail: "allowed" },
      { label: "Pancakes", value: String(stats.pancakes), detail: "карьера" },
      snaps,
    ];
    case "EDGE":
    case "DT": return [
      { label: "Сэки", value: String(stats.sacks), detail: "карьера" },
      { label: "Hurries", value: String(stats.hurries), detail: "давление" },
      { label: "Run stops", value: String(stats.runStops), detail: "карьера" },
      snaps,
    ];
    case "LB": return [
      { label: "Захваты", value: String(stats.tackles), detail: "карьера" },
      { label: "Сэки", value: String(stats.sacks), detail: "карьера" },
      { label: "INT", value: String(stats.interceptions), detail: "карьера" },
      snaps,
    ];
    case "CB":
    case "S": return [
      { label: "Захваты", value: String(stats.tackles), detail: "карьера" },
      { label: "INT/PBU", value: `${stats.interceptions}/${stats.passBreakups}`, detail: "coverage" },
      { label: "Coverage", value: String(stats.coverageSnaps), detail: "снэпы" },
      snaps,
    ];
    case "K": return [
      { label: "Филд-голы", value: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}`, detail: "карьера" },
      { label: "Дальний", value: String(stats.longestFieldGoal), detail: "ярдов" },
      { label: "Очки", value: String(stats.fieldGoalsMade * 3), detail: "карьера" },
      snaps,
    ];
    case "P": return [
      { label: "Панты", value: String(stats.punts), detail: "карьера" },
      { label: "Net yards", value: String(stats.puntYards), detail: "суммарно" },
      { label: "Inside 20", value: String(stats.puntsInside20), detail: "карьера" },
      snaps,
    ];
  }
}

export function PlayerProfileDashboard({ save, mutating, actionError, onResolveCollegeDecision, onSignCollege, onReportToCollege }: PlayerProfileDashboardProps) {
  const { character, football } = save;
  const collegeCareer = football.college.heroCareer;
  const stats = save.meta.phase === "college-season" ? collegeStats(save) : playerStatCards(save);


  return (
    <div className="player-profile-page">
      <header className="elite-player-card">
        <div className="elite-player-card__copy">
          <div className="elite-player-card__line"><strong>#{football.jerseyNumber}</strong><span>{football.position} · {classLabel(save)}</span></div>
          <h1>{character.identity.fullName}</h1>
          <p>{teamName(save)}</p>
          <div className="elite-player-card__meta">
            <span><small>OVR</small><strong>{Math.round(football.ratings.overall)}</strong></span>
            <span><small>Потенциал</small><strong>{potentialLabel(football.ratings.potentialBand)}</strong></span>
            <span><small>Роль</small><strong>{collegeCareer?.role ?? football.depthChart.projectedRole}</strong></span>
          </div>
        </div>
        <div className="elite-player-art" aria-hidden="true">
          <span className="elite-player-art__halo" />
          <span className="elite-player-art__head">{initials(character.identity.fullName)}</span>
          <span className="elite-player-art__jersey">{football.jerseyNumber}</span>
        </div>
      </header>

      <section className="elite-rating-list" aria-label="Рейтинги игрока">
        {[
          ["Техника", football.ratings.technique],
          ["Атлетизм", football.ratings.athleticism],
          ["Игровое мышление", football.ratings.footballIq],
          ["Характер", football.ratings.competitiveness],
        ].map(([label, value]) => (
          <article key={String(label)}><span>{label}</span><i><b style={{ width: `${Number(value)}%` }} /></i><strong>{Math.round(Number(value))}</strong></article>
        ))}
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
