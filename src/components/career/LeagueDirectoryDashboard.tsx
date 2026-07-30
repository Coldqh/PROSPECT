import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { ProfessionalRosterPlayer, ProfessionalTeam } from "../../sports/football/pro/types";
import { FOOTBALL_ROSTER_POSITIONS } from "../../sports/football/team/positions";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

type LeagueDirectoryView = "college" | "professional";

interface LeagueDirectoryDashboardProps {
  save: CareerSave;
  onOpenCollegeTeam?(teamId: string): void;
  initialView?: LeagueDirectoryView;
}

function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

function conferenceName(save: CareerSave, conferenceId?: string): string {
  return save.world.conferences.find((item) => item.id === conferenceId)?.shortName ?? "IND";
}

function proDepth(players: ProfessionalRosterPlayer[]): ProfessionalRosterPlayer[] {
  return [...players]
    .filter((player) => player.status === "active" || player.status === "injured-reserve")
    .sort((left, right) => FOOTBALL_ROSTER_POSITIONS.indexOf(left.position) - FOOTBALL_ROSTER_POSITIONS.indexOf(right.position)
      || left.depthRank - right.depthRank
      || right.overall - left.overall);
}

export function LeagueDirectoryDashboard({ save, onOpenCollegeTeam, initialView = "college" }: LeagueDirectoryDashboardProps) {
  const [view, setView] = useState<LeagueDirectoryView>(initialView);
  const [query, setQuery] = useState("");
  const [selectedProTeamId, setSelectedProTeamId] = useState<string>();
  const normalizedQuery = query.trim().toLowerCase();

  const colleges = useMemo(() => save.world.teams
    .filter((team) => team.level === "college")
    .filter((team) => !normalizedQuery || `${team.name} ${team.shortName} ${team.stateCode}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => right.wins - left.wins || left.losses - right.losses || right.rating - left.rating), [normalizedQuery, save.world.teams]);

  const professionalTeams = useMemo(() => save.football.professional.teams
    .filter((team) => !normalizedQuery || `${team.city} ${team.name} ${team.shortName} ${team.conference}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => right.wins - left.wins || left.losses - right.losses || right.rosterStrength - left.rosterStrength), [normalizedQuery, save.football.professional.teams]);

  const selectedProTeam = save.football.professional.teams.find((team) => team.id === selectedProTeamId);
  const selectedRoster = selectedProTeam
    ? proDepth(save.football.professional.league.roster.filter((player) => player.teamId === selectedProTeam.id))
    : [];
  const needs = selectedProTeam
    ? FOOTBALL_ROSTER_POSITIONS.map((position) => ({ position, value: selectedProTeam.needs[position] })).sort((left, right) => right.value - left.value).slice(0, 5)
    : [];

  return (
    <div className="league-directory">
      <header className="league-directory__head">
        <div><small>ЛИГИ</small><h2>{view === "college" ? "Колледжи" : "PRO"}</h2></div>
        <span>{view === "college" ? colleges.length : professionalTeams.length}</span>
      </header>

      <nav className="compact-segmented league-directory__tabs" aria-label="Уровень лиги">
        <button type="button" className={view === "college" ? "is-active" : ""} onClick={() => setView("college")}>COLLEGE</button>
        <button type="button" className={view === "professional" ? "is-active" : ""} onClick={() => setView("professional")}>PRO</button>
      </nav>

      <label className="league-directory__search">
        <Icon name="search" size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Команда" />
      </label>

      <section className="league-directory__list">
        {view === "college" ? colleges.map((team) => (
          <button type="button" key={team.id} onClick={() => onOpenCollegeTeam?.(team.id)} disabled={!onOpenCollegeTeam}>
            <span className="league-directory__mark">{team.shortName.slice(0, 3)}</span>
            <div><strong>{team.name}</strong><small>{conferenceName(save, team.conferenceId)} · {team.stateCode}</small></div>
            <em>{team.wins}–{team.losses}</em>
            <b>{Math.round(team.rating)}</b>
          </button>
        )) : professionalTeams.map((team) => (
          <button type="button" key={team.id} onClick={() => setSelectedProTeamId(team.id)}>
            <span className="league-directory__mark">{team.shortName.slice(0, 3)}</span>
            <div><strong>{team.city} {team.name}</strong><small>{team.conference} · CAP {money(team.capSpace)}</small></div>
            <em>{team.wins}–{team.losses}</em>
            <b>{Math.round(team.rosterStrength)}</b>
          </button>
        ))}
      </section>

      <BottomSheet
        open={Boolean(selectedProTeam)}
        title={selectedProTeam ? `${selectedProTeam.city} ${selectedProTeam.name}` : "PRO"}
        eyebrow={selectedProTeam ? `${selectedProTeam.conference} · ${selectedProTeam.wins}–${selectedProTeam.losses}` : "PRO"}
        onClose={() => setSelectedProTeamId(undefined)}
      >
        {selectedProTeam && <ProTeamSheet team={selectedProTeam} roster={selectedRoster} needs={needs} />}
      </BottomSheet>
    </div>
  );
}

function ProTeamSheet({ team, roster, needs }: { team: ProfessionalTeam; roster: ProfessionalRosterPlayer[]; needs: Array<{ position: ProfessionalRosterPlayer["position"]; value: number }> }) {
  return (
    <div className="pro-team-sheet">
      <section className="pro-team-sheet__metrics">
        <span><small>OVR</small><strong>{Math.round(team.rosterStrength)}</strong></span>
        <span><small>ROSTER</small><strong>{team.rosterSize}</strong></span>
        <span><small>CAP</small><strong>{money(team.capSpace)}</strong></span>
        <span><small>PAYROLL</small><strong>{money(team.payroll)}</strong></span>
      </section>
      <section className="pro-team-sheet__needs">
        <header><small>NEEDS</small></header>
        <div>{needs.map((item) => <span key={item.position}><strong>{item.position}</strong><em>{item.value}</em></span>)}</div>
      </section>
      <section className="pro-team-sheet__roster">
        <header><small>DEPTH CHART</small><strong>{roster.length}</strong></header>
        {roster.map((player) => (
          <article key={player.id} className={player.isHero ? "is-hero" : ""}>
            <span>{player.position}</span>
            <div><strong>{player.name}</strong><small>#{player.depthRank} · {player.availability}</small></div>
            <em>{Math.round(player.overall)}</em>
          </article>
        ))}
      </section>
    </div>
  );
}
