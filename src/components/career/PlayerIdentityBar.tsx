import type { CSSProperties } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { Icon } from "../ui/Icon";

interface PlayerIdentityBarProps {
  save: CareerSave;
  onOpenTeam?: () => void;
  onOpenProfile?: () => void;
  compact?: boolean;
}

function phaseLabel(save: CareerSave): string {
  if (save.meta.phase === "professional-draft") return "Профессиональный драфт";
  if (save.meta.phase === "professional-career") return "Профессиональная карьера";
  if (save.meta.phase === "college-orientation") return "Прибытие в колледж";
  if (save.meta.phase === "college-season" && save.football.college.heroCareer) {
    return {
      Freshman: "Первый год",
      Sophomore: "Второй год",
      Junior: "Третий год",
      Senior: "Выпускной год",
    }[save.football.college.heroCareer.classYear];
  }
  return "Выпускной сезон";
}

function roleLabel(save: CareerSave): string {
  if (save.meta.phase === "professional-draft" || save.meta.phase === "professional-career") {
    const status = save.football.professional.status;
    return {
      dormant: "Подготовка", decision: "Решение по драфту", "agent-selection": "Выбор агента", evaluation: "Combine",
      "draft-ready": "Готов к драфту", drafted: "Выбран на драфте", undrafted: "Свободный агент",
      "training-camp": "Тренировочный лагерь", roster: "Активный состав", "practice-squad": "Тренировочный состав", cut: "Свободный агент",
    }[status];
  }
  if (save.meta.phase === "college-season" && save.football.college.heroCareer) {
    const role = save.football.college.heroCareer.role;
    return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие" }[role];
  }
  return `#${save.football.depthChart.rank} в depth chart`;
}

export function PlayerIdentityBar({ save, onOpenTeam, onOpenProfile, compact = false }: PlayerIdentityBarProps) {
  const { character, football } = save;
  const initials = `${character.identity.firstName[0] ?? "P"}${character.identity.lastName[0] ?? "R"}`;
  const professionalTeam = (save.meta.phase === "professional-draft" || save.meta.phase === "professional-career")
    ? football.professional.teams.find((team) => team.id === (football.professional.contract?.teamId ?? football.professional.heroSelection?.teamId ?? football.professional.camp?.teamId))
    : undefined;
  const collegeProgram = !professionalTeam && (save.meta.phase === "college-season" || save.meta.phase === "college-orientation" || save.meta.phase === "professional-draft")
    ? football.college.program
    : undefined;
  const heroPlayer = collegeProgram ? save.world.players.find((player) => player.isHero) : undefined;
  const teamName = professionalTeam ? `${professionalTeam.city} ${professionalTeam.name}` : collegeProgram?.shortName ?? `${football.school.shortName} ${football.school.mascot}`;
  const teamMark = (professionalTeam?.shortName ?? collegeProgram?.shortName ?? football.school.shortName).slice(0, 2);
  const overall = Math.round(heroPlayer?.overall ?? football.ratings.overall);
  const style = collegeProgram || professionalTeam ? undefined : ({
    "--team-primary": football.school.primaryColor,
    "--team-secondary": football.school.secondaryColor,
  } as CSSProperties);

  return (
    <section className={`player-identity-bar ${compact ? "player-identity-bar--compact" : ""}`} {...(style ? { style } : {})}>
      {onOpenProfile ? (
        <button type="button" className="player-identity-bar__portrait" onClick={onOpenProfile} aria-label="Открыть профиль игрока">
          <span>{initials}</span>
          <small>{football.position}</small>
        </button>
      ) : (
        <div className="player-identity-bar__portrait" aria-hidden="true">
          <span>{initials}</span>
          <small>{football.position}</small>
        </div>
      )}

      <div className="player-identity-bar__copy">
        <span>{phaseLabel(save)} · #{football.jerseyNumber}</span>
        <h1>{character.identity.fullName}</h1>
        <p>{teamName} · {roleLabel(save)}</p>
      </div>

      {onOpenTeam ? (
        <button type="button" className="player-identity-bar__team" onClick={onOpenTeam} aria-label="Открыть команду">
          <span className="player-identity-bar__team-mark">{teamMark}</span>
          <span><small>OVR</small><strong>{overall}</strong></span>
          <Icon name="arrow-right" size={16} />
        </button>
      ) : (
        <div className="player-identity-bar__team player-identity-bar__team--static">
          <span className="player-identity-bar__team-mark">{teamMark}</span>
          <span><small>OVR</small><strong>{overall}</strong></span>
        </div>
      )}
    </section>
  );
}
