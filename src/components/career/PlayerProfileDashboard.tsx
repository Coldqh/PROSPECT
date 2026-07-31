import type { CSSProperties } from "react";
import type { CollegeEntryRoute } from "../../sports/football/college/types";
import type { CareerSave } from "../../storage/saves/schema";
import { mindsetLabels } from "../../sports/football/career/catalog";
import type { MatchStatLine } from "../../sports/football/matches/types";
import { playerStatCards } from "./SeasonDashboard";
import { DecisionDayDashboard } from "./DecisionDayDashboard";
import { Icon } from "../ui/Icon";
import { teamBrandStyle, teamMark } from "./teamBrand";

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
    "role-player": "Ролевой игрок",
    starter: "Стартер",
    "high-upside": "Высокий потолок",
    "national-ceiling": "Элитный потолок",
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

function roleLabel(role: string): string {
  return {
    starter: "Стартер",
    rotation: "Ротация",
    "special-teams": "Спецкоманды",
    developmental: "Развитие",
    inactive: "Вне заявки",
  }[role] ?? role;
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
        target[key] = key === "longestFieldGoal" ? Math.max(target[key], value) : target[key] + value;
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
    case "QB": return [{ label: "Пасовые ярды", value: String(stats.passingYards), detail: `${stats.completions}/${stats.passingAttempts}` }, { label: "TD", value: String(stats.touchdowns), detail: "за карьеру" }, { label: "Потери", value: String(stats.turnovers), detail: "за карьеру" }, snaps];
    case "RB": return [{ label: "Вынос", value: String(stats.rushingYards), detail: `${stats.rushingAttempts} попыток` }, { label: "Приём", value: String(stats.receivingYards), detail: `${stats.receptions}/${stats.targets}` }, { label: "TD", value: String(stats.touchdowns), detail: "за карьеру" }, snaps];
    case "WR":
    case "TE": return [{ label: "Приём", value: String(stats.receivingYards), detail: `${stats.receptions}/${stats.targets}` }, { label: "TD", value: String(stats.touchdowns), detail: "за карьеру" }, { label: "Pancakes", value: String(stats.pancakes), detail: "блоки" }, snaps];
    case "OT":
    case "OG":
    case "C": return [{ label: "Сэки отданы", value: String(stats.sacksAllowed), detail: "pass pro" }, { label: "Давление", value: String(stats.pressuresAllowed), detail: "allowed" }, { label: "Pancakes", value: String(stats.pancakes), detail: "за карьеру" }, snaps];
    case "EDGE":
    case "DT": return [{ label: "Сэки", value: String(stats.sacks), detail: "за карьеру" }, { label: "Hurries", value: String(stats.hurries), detail: "давление" }, { label: "Run stops", value: String(stats.runStops), detail: "за карьеру" }, snaps];
    case "LB": return [{ label: "Захваты", value: String(stats.tackles), detail: "за карьеру" }, { label: "Сэки", value: String(stats.sacks), detail: "за карьеру" }, { label: "INT", value: String(stats.interceptions), detail: "за карьеру" }, snaps];
    case "CB":
    case "S": return [{ label: "Захваты", value: String(stats.tackles), detail: "за карьеру" }, { label: "INT / PBU", value: `${stats.interceptions}/${stats.passBreakups}`, detail: "coverage" }, { label: "Coverage", value: String(stats.coverageSnaps), detail: "снэпы" }, snaps];
    case "K": return [{ label: "Филд-голы", value: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}`, detail: "за карьеру" }, { label: "Дальний", value: String(stats.longestFieldGoal), detail: "ярдов" }, { label: "Очки", value: String(stats.fieldGoalsMade * 3), detail: "за карьеру" }, snaps];
    case "P": return [{ label: "Панты", value: String(stats.punts), detail: "за карьеру" }, { label: "Net yards", value: String(stats.puntYards), detail: "суммарно" }, { label: "Inside 20", value: String(stats.puntsInside20), detail: "за карьеру" }, snaps];
  }
}

export function PlayerProfileDashboard({ save, mutating, actionError, onResolveCollegeDecision, onSignCollege, onReportToCollege }: PlayerProfileDashboardProps) {
  const { character, football } = save;
  const collegeCareer = football.college.heroCareer;
  const stats = save.meta.phase === "college-season" ? collegeStats(save) : playerStatCards(save);
  const currentRole = roleLabel(collegeCareer?.role ?? football.depthChart.projectedRole);
  const currentTeam = teamName(save);
  const brandStyle = save.football.college.program || save.football.professional.contract
    ? teamBrandStyle(save.football.college.program?.id ?? save.football.professional.contract?.teamId ?? currentTeam)
    : ({
      "--team-primary": save.football.school.primaryColor,
      "--team-secondary": save.football.school.secondaryColor,
      "--team-ink": "#ffffff",
      "--team-hue": "354",
    } as CSSProperties);
  const ratingGroups = [
    { label: "Техника", value: football.ratings.technique },
    { label: "Атлетизм", value: football.ratings.athleticism },
    { label: "Игровое мышление", value: football.ratings.footballIq },
    { label: "Характер", value: football.ratings.competitiveness },
  ];
  const physicalGroups = [
    { label: "Скорость", value: character.physical.speed },
    { label: "Сила", value: character.physical.strength },
    { label: "Ловкость", value: character.physical.agility },
    { label: "Взрыв", value: character.physical.explosiveness },
    { label: "Выносливость", value: character.physical.stamina },
  ];

  return (
    <div className="dynasty-page dynasty-profile-page" style={brandStyle}>
      <header className="dynasty-page-head">
        <div className="dynasty-page-head__badge">PL</div>
        <div><strong>Профиль игрока</strong><small>КАРЬЕРА · РЕЙТИНГИ · СТАТИСТИКА</small></div>
      </header>

      <section className="dynasty-profile-hero">
        <div className="dynasty-profile-hero__team"><span>{teamMark(currentTeam)}</span><small>{currentTeam}</small></div>
        <div className="dynasty-overall-shield dynasty-overall-shield--hero"><strong>{Math.round(football.ratings.overall)}</strong><small>OVR</small></div>
        <div className="dynasty-profile-hero__identity">
          <small>#{football.jerseyNumber} · {football.position} · {classLabel(save)}</small>
          <h1>{character.identity.fullName}</h1>
          <p>{currentTeam}</p>
          <div><span className="dynasty-status dynasty-status--signed">{currentRole}</span><span className="dynasty-status">{potentialLabel(football.ratings.potentialBand)}</span></div>
        </div>
        <div className="dynasty-profile-hero__figure" aria-hidden="true"><span>{football.position}</span><strong>{football.jerseyNumber}</strong></div>
      </section>

      <div className="dynasty-grid dynasty-grid--profile">
        <section className="dynasty-panel">
          <header className="dynasty-section-title"><span /><strong>Игровые рейтинги</strong></header>
          <div className="dynasty-skill-grid">
            {ratingGroups.map((item) => <article key={item.label}><div><small>{item.label}</small><strong>{Math.round(item.value)}</strong></div><i><b style={{ width: `${item.value}%` }} /></i></article>)}
          </div>
        </section>
        <section className="dynasty-panel dynasty-profile-contract">
          <header className="dynasty-section-title"><span /><strong>Статус</strong></header>
          <div><small>Роль</small><strong>{currentRole}</strong></div>
          <div><small>Потенциал</small><strong>{potentialLabel(football.ratings.potentialBand)}</strong></div>
          <div><small>Позиция</small><strong>{football.position}</strong></div>
          <div><small>Команда</small><strong>{currentTeam}</strong></div>
        </section>
      </div>

      <section>
        <header className="dynasty-section-title"><span /><strong>Статистика</strong><em>{save.meta.phase === "college-season" ? collegeCareer?.seasonYear : football.season.year}</em></header>
        <div className="dynasty-stat-card-grid">
          {stats.map((stat) => <article key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong><span>{stat.detail}</span></article>)}
        </div>
      </section>

      <div className="dynasty-grid dynasty-grid--two">
        <section className="dynasty-panel">
          <header className="dynasty-section-title"><span /><strong>Физика</strong><em>{heightLabel(character.physical.heightInches)} · {character.physical.weightLbs} LB</em></header>
          <div className="dynasty-skill-list">
            {physicalGroups.map((item) => <article key={item.label}><small>{item.label}</small><i><b style={{ width: `${item.value}%` }} /></i><strong>{Math.round(item.value)}</strong></article>)}
          </div>
        </section>
        <section className="dynasty-panel dynasty-profile-facts">
          <header className="dynasty-section-title"><span /><strong>Личное состояние</strong></header>
          <article><small>Характер</small><strong>{mindsetLabels[character.personality.preset].name}</strong><span>Дисциплина {Math.round(character.personality.discipline)} · самообладание {Math.round(character.personality.composure)}</span></article>
          <article><small>Учёба</small><strong>GPA {character.education.gpa.toFixed(2)}</strong><span>{character.education.eligibilityStatus} · посещаемость {Math.round(character.education.attendance)}</span></article>
          <article><small>Состояние</small><strong>{Math.round(character.condition.health)} HP</strong><span>Энергия {Math.round(character.condition.energy)} · стресс {Math.round(character.condition.stress)}</span></article>
        </section>
      </div>

      {collegeCareer?.pendingDecision && onResolveCollegeDecision && (
        <section className="dynasty-panel dynasty-decision-panel">
          <header><Icon name="target" /><div><small>Требуется решение</small><strong>{collegeCareer.pendingDecision.title}</strong></div></header>
          <div>{collegeCareer.pendingDecision.options.map((option) => <button type="button" key={option.id} disabled={mutating} onClick={() => void onResolveCollegeDecision(option.id)}><strong>{option.label}</strong><Icon name="arrow-right" /></button>)}</div>
        </section>
      )}

      {(football.season.phase === "complete" || football.college.status === "signed") && onSignCollege && onReportToCollege && (
        <section className="dynasty-panel dynasty-decision-day"><DecisionDayDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onSign={onSignCollege} onReportToCollege={onReportToCollege} /></section>
      )}

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    </div>
  );
}
