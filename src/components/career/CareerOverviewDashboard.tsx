import type { CareerSave } from "../../storage/saves/schema";
import { Icon } from "../ui/Icon";
import { recruitingActionsRemaining } from "../../sports/football/recruiting/updateRecruiting";

interface CareerOverviewDashboardProps {
  save: CareerSave;
}

function roleLabel(value: string): string {
  return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие" }[value] ?? value;
}

export function CareerOverviewDashboard({ save }: CareerOverviewDashboardProps) {
  const career = save.football.college.heroCareer;
  const collegeTeam = career ? save.world.teams.find((item) => item.id === career.teamId) : undefined;
  const nextCollegeGame = career ? save.world.competition.schedule.find((game) => game.status === "scheduled" && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId)) : undefined;
  const nextHighSchool = save.football.season.schedule.find((game) => game.status === "scheduled");
  const offers = save.football.recruitment.programs.filter((program) => Boolean(program.offer));
  const actionsRemaining = recruitingActionsRemaining(save.football.recruitment, save.football.season.week);

  return (
    <div className="career-overview-page">
      <header className="data-page-head"><div><small>КАРЬЕРА</small><h1>Обзор</h1></div><strong>{Math.round(save.football.ratings.overall)}</strong></header>
      <section className="career-overview-grid">
        <article><small>Позиция</small><strong>{save.football.position}</strong><span>#{save.football.jerseyNumber}</span></article>
        <article><small>Команда</small><strong>{save.football.college.program?.shortName ?? save.football.school.shortName}</strong><span>{career ? `${collegeTeam?.wins ?? 0}–${collegeTeam?.losses ?? 0}` : `${save.football.season.wins}–${save.football.season.losses}`}</span></article>
        <article><small>Роль</small><strong>{career ? roleLabel(career.role) : `#${save.football.depthChart.rank}`}</strong><span>{career ? `Depth #${career.depthRank}` : roleLabel(save.football.depthChart.projectedRole)}</span></article>
        <article><small>{career ? "Eligibility" : "Офферы"}</small><strong>{career ? career.eligibilityYears : offers.length}</strong><span>{career ? career.classYear : `${actionsRemaining} действий`}</span></article>
      </section>

      {(nextCollegeGame || nextHighSchool) && (
        <section className="career-overview-next">
          <Icon name="football" />
          <div><small>СЛЕДУЮЩИЙ МАТЧ</small><strong>{nextHighSchool?.opponentName ?? (nextCollegeGame ? save.world.teams.find((team) => team.id === (nextCollegeGame.homeTeamId === career?.teamId ? nextCollegeGame.awayTeamId : nextCollegeGame.homeTeamId))?.name : "")}</strong></div>
          <span>W{nextHighSchool?.week ?? nextCollegeGame?.week}</span>
        </section>
      )}

      <section className="career-overview-list">
        <article><span>OVR</span><strong>{Math.round(save.football.ratings.overall)}</strong></article>
        <article><span>ATH</span><strong>{Math.round(save.football.ratings.athleticism)}</strong></article>
        <article><span>TEC</span><strong>{Math.round(save.football.ratings.technique)}</strong></article>
        <article><span>IQ</span><strong>{Math.round(save.football.ratings.footballIq)}</strong></article>
        <article><span>COMP</span><strong>{Math.round(save.football.ratings.competitiveness)}</strong></article>
      </section>
    </div>
  );
}
