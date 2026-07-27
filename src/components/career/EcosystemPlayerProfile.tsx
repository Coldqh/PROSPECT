import type { CareerSave } from "../../storage/saves/schema";
import { positionRoleLabel } from "../../sports/football/ecosystem/tactics";
import type { EcosystemPlayer } from "../../sports/football/ecosystem/types";
import { normalizeLegacyRosterPosition, positionLabel } from "../../sports/football/team/positions";
import type { FootballRosterPlayer } from "../../sports/football/team/types";
import { Icon } from "../ui/Icon";
import { OverlayDialog } from "../ui/OverlayDialog";

type ProfilePlayer = EcosystemPlayer | FootballRosterPlayer;
type ProfileSave = Pick<CareerSave, "world" | "football">;

interface EcosystemPlayerProfileProps {
  save: ProfileSave;
  player?: ProfilePlayer | undefined;
  onClose(): void;
  onOpenTeam?(teamId: string): void;
}

function isWorldPlayer(player: ProfilePlayer): player is EcosystemPlayer {
  return "classYear" in player;
}

function statusLabel(status: ProfilePlayer["status"]): string {
  return { starter: "Стартер", rotation: "Ротация", backup: "Резерв", injured: "Травмирован" }[status];
}

function usageLabel(value: EcosystemPlayer["usagePlan"]): string {
  return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие", redshirt: "Redshirt" }[value];
}

function trajectoryLabel(value: EcosystemPlayer["trajectory"]): string {
  return { surging: "Растёт", steady: "Стабилен", slipping: "Сдаёт" }[value];
}

function profilePosition(player: ProfilePlayer) {
  return normalizeLegacyRosterPosition(player.position, player.id);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function EcosystemPlayerProfile({ save, player, onClose, onOpenTeam }: EcosystemPlayerProfileProps) {
  const worldPlayer = player && isWorldPlayer(player) ? player : undefined;
  const rosterPlayer = player && !isWorldPlayer(player) ? player : undefined;
  const team = worldPlayer ? save.world.teams.find((item) => item.id === worldPlayer.teamId) : undefined;
  const previousTeams = worldPlayer?.previousTeamIds.map((id) => save.world.teams.find((item) => item.id === id)).filter(Boolean) ?? [];
  const awards = worldPlayer ? save.world.competition.awards.filter((award) => award.playerId === worldPlayer.id).slice(-8).reverse() : [];
  const stories = worldPlayer ? save.world.stories.filter((story) => story.playerIds.includes(worldPlayer.id)).slice(0, 8) : [];
  const transactions = worldPlayer ? save.world.transactions.filter((transaction) => transaction.playerId === worldPlayer.id).slice(-8).reverse() : [];
  const bonds = worldPlayer ? save.world.social.bonds.filter((bond) => bond.entityAId === worldPlayer.id || bond.entityBId === worldPlayer.id).filter((bond) => bond.active).slice(0, 6) : [];

  return (
    <OverlayDialog open={Boolean(player)} title={player?.name ?? "Игрок"} eyebrow={player ? `${profilePosition(player)} · ${positionLabel(profilePosition(player))} · ${isWorldPlayer(player) ? player.classYear : player.year}` : "ИГРОК"} wide onClose={onClose}>
      {player && (
        <div className="player-overlay-profile">
          <header className="player-overlay-profile__hero">
            <span>{initials(player.name)}</span>
            <div><small>{statusLabel(player.status)} · Depth #{player.depthRank}</small><h3>{player.name}</h3><p>{team?.name ?? save.football.school.name}</p></div>
            <strong>{Math.round(player.overall)}</strong>
          </header>

          <section className="player-overlay-profile__metrics">
            <article><small>OVR</small><strong>{Math.round(player.overall)}</strong></article>
            <article><small>POT</small><strong>{Math.round(player.potential)}</strong></article>
            <article><small>Здоровье</small><strong>{Math.round(player.health)}</strong></article>
            <article><small>Роль</small><strong>{worldPlayer ? usageLabel(worldPlayer.usagePlan) : statusLabel(player.status)}</strong></article>
            {worldPlayer && <article><small>Форма</small><strong>{Math.round(worldPlayer.form)}</strong></article>}
            {worldPlayer && <article><small>Fit</small><strong>{Math.round(worldPlayer.tactical.schemeFit)}</strong></article>}
          </section>

          {worldPlayer ? (
            <>
              <section className="player-overlay-profile__section">
                <header><span>Профиль</span><strong>#{worldPlayer.nationalRank || "—"}</strong></header>
                <div className="player-overlay-profile__facts">
                  <span><small>Возраст</small><strong>{worldPlayer.age}</strong></span>
                  <span><small>Траектория</small><strong>{trajectoryLabel(worldPlayer.trajectory)}</strong></span>
                  <span><small>Архетип</small><strong>{positionRoleLabel(worldPlayer.tactical.archetype)}</strong></span>
                  <span><small>Обучение</small><strong>{Math.round(worldPlayer.tactical.learning)}</strong></span>
                  <span><small>Универсальность</small><strong>{Math.round(worldPlayer.tactical.versatility)}</strong></span>
                  <span><small>Eligibility</small><strong>{worldPlayer.eligibilityYears}</strong></span>
                  <span><small>Позиция</small><strong>{positionLabel(worldPlayer.position)}</strong></span>
                  <span><small>Основная роль</small><strong>{positionRoleLabel(worldPlayer.tactical.preferredRole)}</strong></span>
                </div>
              </section>

              <section className="player-overlay-profile__section">
                <header><span>Карьера</span><strong>{worldPlayer.seasonsPlayed} сез.</strong></header>
                <div className="player-overlay-profile__facts">
                  <span><small>Текущая команда</small><strong>{team?.shortName ?? "FA"}</strong></span>
                  <span><small>Трансфер</small><strong>{worldPlayer.transferStatus}</strong></span>
                  <span><small>Рекрутинг</small><strong>{worldPlayer.recruitingStage}</strong></span>
                  <span><small>Сыграно матчей</small><strong>{worldPlayer.eligibility.gamesPlayedThisSeason}</strong></span>
                </div>
                {previousTeams.length > 0 && <p className="player-overlay-profile__history">Ранее: {previousTeams.map((item) => item?.shortName).join(" → ")}</p>}
              </section>

              <section className="player-overlay-profile__section">
                <header><span>События</span><strong>{stories.length + transactions.length + awards.length}</strong></header>
                <div className="player-overlay-profile__timeline">
                  {awards.map((award) => <article key={`${award.seasonYear}-${award.kind}-${award.playerId}`}><Icon name="trophy" size={15} /><div><strong>{award.title}</strong><small>{award.detail}</small></div></article>)}
                  {transactions.map((transaction) => <article key={transaction.id}><Icon name="arrow-right" size={15} /><div><strong>{transaction.title}</strong><small>{transaction.detail}</small></div></article>)}
                  {stories.map((story) => <article key={story.id}><Icon name="pulse" size={15} /><div><strong>{story.title}</strong><small>{story.detail}</small></div></article>)}
                  {awards.length + transactions.length + stories.length === 0 && <div className="data-empty">История пока не сформирована</div>}
                </div>
              </section>

              <section className="player-overlay-profile__section">
                <header><span>Связи в команде</span><strong>{bonds.length}</strong></header>
                <div className="player-overlay-profile__bonds">
                  {bonds.map((bond) => {
                    const otherId = bond.entityAId === worldPlayer.id ? bond.entityBId : bond.entityAId;
                    const other = save.world.players.find((item) => item.id === otherId) ?? save.world.coaches.find((item) => item.id === otherId);
                    return <article key={bond.id}><div><strong>{other?.name ?? otherId}</strong><small>{bond.kind}</small></div><span>{Math.round((bond.trust + bond.respect + bond.chemistry - bond.tension) / 3)}</span></article>;
                  })}
                  {bonds.length === 0 && <div className="data-empty">Активных связей нет</div>}
                </div>
              </section>

              {team && onOpenTeam && <button type="button" className="button button--primary button--wide" onClick={() => { onClose(); onOpenTeam(team.id); }}>{team.name}<Icon name="arrow-right" /></button>}
            </>
          ) : rosterPlayer ? (
            <section className="player-overlay-profile__section">
              <header><span>Школьный профиль</span><strong>{rosterPlayer.style}</strong></header>
              <div className="player-overlay-profile__facts">
                <span><small>Год</small><strong>{rosterPlayer.year}</strong></span>
                <span><small>Юнит</small><strong>{rosterPlayer.unit}</strong></span>
                <span><small>Статус у тренера</small><strong>{Math.round(rosterPlayer.coachStanding)}</strong></span>
                <span><small>Стиль</small><strong>{rosterPlayer.style}</strong></span>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </OverlayDialog>
  );
}
