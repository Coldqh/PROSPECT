import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { EcosystemPlayer, EcosystemStory, EcosystemTeam, FootballEcosystemState } from "../../sports/football/ecosystem/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

export type WorldPrimaryView = "feed" | "rankings";

type WorldDashboardSave = Pick<CareerSave, "world" | "football">;

interface WorldDashboardProps {
  save: WorldDashboardSave;
  view?: WorldPrimaryView;
  hideNavigation?: boolean;
  onOpenTeam?: (teamId: string) => void;
}

function phaseLabel(phase: FootballEcosystemState["phase"]): string {
  if (phase === "regular-season") return "Регулярный сезон";
  if (phase === "postseason") return "Постсезон";
  return "Межсезонье";
}

function storyKindLabel(kind: EcosystemStory["kind"]): string {
  return {
    breakout: "Прорыв",
    injury: "Травма",
    "depth-change": "Состав",
    commitment: "Коммит",
    "coach-pressure": "Тренер",
    "coach-move": "Штаб",
    upset: "Матч",
    "market-shift": "Рынок",
    "conference-race": "Конференция",
    championship: "Титул",
    transfer: "Трансфер",
    graduation: "Выпуск",
    enrollment: "Набор",
    investment: "Инвестиции",
    "budget-crunch": "Бюджет",
    "nil-battle": "NIL",
    "resource-shift": "Ресурсы",
    "talent-class": "Набор",
    "camp-breakout": "Лагерь",
    "juco-route": "JUCO",
    "walk-on-route": "Walk-on",
    "roster-plan": "Состав",
    "position-change": "Позиция",
    redshirt: "Redshirt",
    scholarship: "Стипендия",
    offer: "Оффер",
    "offer-withdrawn": "Оффер",
    "market-chain": "Рынок",
    "coach-vacancy": "Вакансия",
    "tactical-change": "Система",
    "scheme-fit": "Система",
    ranking: "Рейтинг",
    playoff: "Плей-офф",
    award: "Награда",
    rivalry: "Rivalry",
    bowl: "Bowl",
    mentorship: "Наставник",
    "locker-room-conflict": "Конфликт",
    leadership: "Лидерство",
    reconciliation: "Раздевалка",
    "staff-friction": "Штаб",
    "broken-promise": "Обещание",
  }[kind];
}

function teamForStory(story: EcosystemStory, teams: EcosystemTeam[]): EcosystemTeam | undefined {
  return story.teamIds.length > 0 ? teams.find((team) => team.id === story.teamIds[0]) : undefined;
}

export function WorldDashboard({ save, view: forcedView, hideNavigation = false, onOpenTeam }: WorldDashboardProps) {
  const { world } = save;
  const [internalView, setInternalView] = useState<WorldPrimaryView>("feed");
  const [query, setQuery] = useState("");
  const [selectedStory, setSelectedStory] = useState<EcosystemStory>();
  const [selectedPlayer, setSelectedPlayer] = useState<EcosystemPlayer>();
  const selectedView = forcedView ?? internalView;

  const stories = useMemo(
    () => [...world.stories]
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.week - left.week || right.importance - left.importance)
      .slice(0, 40),
    [world.stories],
  );
  const rankings = useMemo(
    () => [...world.competition.rankings].sort((left, right) => left.rank - right.rank).slice(0, 25),
    [world.competition.rankings],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const searchTeams = normalizedQuery
    ? world.teams.filter((team) => `${team.name} ${team.shortName} ${team.stateCode}`.toLowerCase().includes(normalizedQuery)).slice(0, 8)
    : [];
  const searchPlayers = normalizedQuery
    ? world.players.filter((player) => `${player.name} ${player.position} ${player.classYear}`.toLowerCase().includes(normalizedQuery)).slice(0, 8)
    : [];
  const searchStories = normalizedQuery
    ? stories.filter((story) => `${story.title} ${story.detail}`.toLowerCase().includes(normalizedQuery)).slice(0, 8)
    : [];

  const selectedPlayerTeam = selectedPlayer ? world.teams.find((team) => team.id === selectedPlayer.teamId) : undefined;
  const selectedStoryTeam = selectedStory ? teamForStory(selectedStory, world.teams) : undefined;

  function openTeam(teamId: string) {
    if (onOpenTeam) onOpenTeam(teamId);
  }

  return (
    <div className="world-dashboard world-dashboard--v27">
      <header className="world-v27-head">
        <div><small>{phaseLabel(world.phase)} · W{world.seasonWeek}</small><h1>{selectedView === "feed" ? "Лента" : "Рейтинг"}</h1></div>
        <strong>{world.seasonYear}</strong>
      </header>

      {!hideNavigation && (
        <nav className="world-v27-tabs" aria-label="Мир">
          <button type="button" className={selectedView === "feed" ? "is-active" : ""} onClick={() => setInternalView("feed")}>Лента</button>
          <button type="button" className={selectedView === "rankings" ? "is-active" : ""} onClick={() => setInternalView("rankings")}>Рейтинг</button>
        </nav>
      )}

      <label className="world-v27-search">
        <Icon name="search" size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Команда, игрок, событие" aria-label="Поиск" />
        {query && <button type="button" aria-label="Очистить" onClick={() => setQuery("")}><Icon name="close" size={15} /></button>}
      </label>

      {normalizedQuery ? (
        <section className="world-v27-results">
          {searchTeams.map((team) => (
            <button type="button" key={team.id} onClick={() => openTeam(team.id)}>
              <span>{team.shortName.slice(0, 3)}</span><div><strong>{team.name}</strong><small>{team.stateCode} · {team.wins}–{team.losses}</small></div><em>{Math.round(team.rating)}</em>
            </button>
          ))}
          {searchPlayers.map((player) => (
            <button type="button" key={player.id} onClick={() => setSelectedPlayer(player)}>
              <span>{player.position}</span><div><strong>{player.name}</strong><small>{player.classYear} · {world.teams.find((team) => team.id === player.teamId)?.shortName ?? "FA"}</small></div><em>{Math.round(player.overall)}</em>
            </button>
          ))}
          {searchStories.map((story) => (
            <button type="button" key={story.id} onClick={() => setSelectedStory(story)}>
              <span><Icon name="pulse" size={16} /></span><div><strong>{story.title}</strong><small>{storyKindLabel(story.kind)} · W{story.week}</small></div><em>{story.importance}</em>
            </button>
          ))}
          {searchTeams.length + searchPlayers.length + searchStories.length === 0 && <div className="data-empty">Нет совпадений</div>}
        </section>
      ) : selectedView === "feed" ? (
        <section className="world-v27-feed">
          {stories.map((story) => {
            const team = teamForStory(story, world.teams);
            return (
              <button type="button" key={story.id} className={story.relatedToHero ? "is-relevant" : ""} onClick={() => setSelectedStory(story)}>
                <span className="world-v27-feed__kind">{storyKindLabel(story.kind)}</span>
                <div><strong>{story.title}</strong><small>W{story.week}{team ? ` · ${team.shortName}` : ""}</small></div>
                <Icon name="arrow-right" size={16} />
              </button>
            );
          })}
          {stories.length === 0 && <div className="data-empty">Нет событий</div>}
        </section>
      ) : (
        <section className="world-v27-ranking">
          {rankings.map((ranking) => {
            const team = world.teams.find((item) => item.id === ranking.teamId);
            if (!team) return null;
            const movement = ranking.previousRank ? ranking.previousRank - ranking.rank : 0;
            return (
              <button type="button" key={ranking.teamId} onClick={() => openTeam(team.id)}>
                <span>{ranking.rank}</span>
                <div><strong>{team.name}</strong><small>{team.wins}–{team.losses} · SOS {Math.round(ranking.strengthOfSchedule)} · QW {ranking.qualityWins}</small></div>
                <em>{movement > 0 ? `+${movement}` : movement < 0 ? movement : "—"}</em>
              </button>
            );
          })}
          {rankings.length === 0 && <div className="data-empty">Рейтинг не сформирован</div>}
        </section>
      )}

      <BottomSheet open={Boolean(selectedStory)} onClose={() => setSelectedStory(undefined)} eyebrow={selectedStory ? `${storyKindLabel(selectedStory.kind)} · W${selectedStory.week}` : "СОБЫТИЕ"} title={selectedStory?.title ?? "Событие"}>
        {selectedStory && (
          <div className="world-v27-sheet">
            <p>{selectedStory.detail}</p>
            <div><span><small>Важность</small><strong>{selectedStory.importance}</strong></span><span><small>Сезон</small><strong>{world.seasonYear}</strong></span></div>
            {selectedStoryTeam && onOpenTeam && <button type="button" className="button button--primary" onClick={() => { setSelectedStory(undefined); openTeam(selectedStoryTeam.id); }}>{selectedStoryTeam.name}<Icon name="arrow-right" /></button>}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(selectedPlayer)} onClose={() => setSelectedPlayer(undefined)} eyebrow={selectedPlayer ? `${selectedPlayer.position} · ${selectedPlayer.classYear}` : "ИГРОК"} title={selectedPlayer?.name ?? "Игрок"}>
        {selectedPlayer && (
          <div className="world-v27-player">
            <section><span><small>OVR</small><strong>{Math.round(selectedPlayer.overall)}</strong></span><span><small>POT</small><strong>{Math.round(selectedPlayer.potential)}</strong></span><span><small>Форма</small><strong>{Math.round(selectedPlayer.form)}</strong></span><span><small>Depth</small><strong>#{selectedPlayer.depthRank}</strong></span></section>
            <section><span><small>Здоровье</small><strong>{Math.round(selectedPlayer.health)}</strong></span><span><small>Fit</small><strong>{Math.round(selectedPlayer.tactical.schemeFit)}</strong></span><span><small>Роль</small><strong>{selectedPlayer.usagePlan}</strong></span><span><small>Eligibility</small><strong>{selectedPlayer.eligibilityYears}</strong></span></section>
            {selectedPlayerTeam && onOpenTeam && <button type="button" className="button button--primary" onClick={() => { setSelectedPlayer(undefined); openTeam(selectedPlayerTeam.id); }}>{selectedPlayerTeam.name}<Icon name="arrow-right" /></button>}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
