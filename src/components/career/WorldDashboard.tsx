import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { EcosystemPlayer, EcosystemPlayerCareerRecord, EcosystemStory, EcosystemTeam, FootballEcosystemState } from "../../sports/football/ecosystem/types";
import { BottomSheet } from "../ui/BottomSheet";
import { EcosystemPlayerProfile } from "./EcosystemPlayerProfile";
import { Icon } from "../ui/Icon";

export type WorldPrimaryView = "feed" | "rankings" | "careers";

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
    storyline: "История",
  }[kind];
}

function careerStageLabel(stage: EcosystemPlayerCareerRecord["currentStage"]): string {
  return {
    "high-school": "Школа",
    college: "Колледж",
    "draft-pool": "Драфт",
    professional: "Профессионал",
    "free-agent": "Свободный агент",
    retired: "Завершил карьеру",
    "football-exit": "Покинул футбол",
  }[stage];
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
  const [selectedCareer, setSelectedCareer] = useState<EcosystemPlayerCareerRecord>();
  const selectedView = forcedView ?? internalView;

  const stories = useMemo(
    () => [...world.stories]
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.week - left.week || right.importance - left.importance)
      .slice(0, 40),
    [world.stories],
  );
  const activeArcs = useMemo(
    () => [...world.worldHistory.arcs]
      .filter((arc) => arc.status !== "resolved")
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.momentum - left.momentum || right.lastWeek - left.lastWeek)
      .slice(0, 4),
    [world.worldHistory.arcs],
  );
  const activeObjectives = useMemo(
    () => world.worldHistory.objectives.filter((objective) => objective.status === "active").length,
    [world.worldHistory.objectives],
  );
  const activeConflicts = useMemo(
    () => [...world.agency.conflicts]
      .filter((conflict) => conflict.stage !== "resolved")
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.pressure - left.pressure || right.lastWeek - left.lastWeek)
      .slice(0, 4),
    [world.agency.conflicts],
  );
  const recentDecisions = useMemo(
    () => [...world.agency.decisions]
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.seasonYear - left.seasonYear || right.week - left.week)
      .slice(0, 3),
    [world.agency.decisions],
  );
  const rankings = useMemo(
    () => [...world.competition.rankings].sort((left, right) => left.rank - right.rank).slice(0, 25),
    [world.competition.rankings],
  );
  const careers = useMemo(
    () => [...world.careerRegistry.records]
      .sort((left, right) => Number(right.isHero) - Number(left.isHero) || right.events.at(-1)?.seasonYear! - left.events.at(-1)?.seasonYear! || right.overall - left.overall)
      .slice(0, 60),
    [world.careerRegistry.records],
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
  const activePlayerIds = new Set(world.players.map((player) => player.id));
  const searchCareers = normalizedQuery
    ? world.careerRegistry.records
      .filter((record) => !activePlayerIds.has(record.playerId) && `${record.name} ${record.position} ${careerStageLabel(record.currentStage)}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 8)
    : [];

  const selectedStoryTeam = selectedStory ? teamForStory(selectedStory, world.teams) : undefined;

  function openTeam(teamId: string) {
    if (onOpenTeam) onOpenTeam(teamId);
  }

  return (
    <div className="world-dashboard world-dashboard--v27">
      <header className="world-v27-head">
        <div><small>{phaseLabel(world.phase)} · W{world.seasonWeek}</small><h1>{selectedView === "feed" ? "Лента" : selectedView === "rankings" ? "Рейтинг" : "Карьеры"}</h1></div>
        <strong>{world.seasonYear}</strong>
      </header>

      {!hideNavigation && (
        <nav className="world-v27-tabs" aria-label="Мир">
          <button type="button" className={selectedView === "feed" ? "is-active" : ""} onClick={() => setInternalView("feed")}>Лента</button>
          <button type="button" className={selectedView === "rankings" ? "is-active" : ""} onClick={() => setInternalView("rankings")}>Рейтинг</button>
          <button type="button" className={selectedView === "careers" ? "is-active" : ""} onClick={() => setInternalView("careers")}>Карьеры</button>
        </nav>
      )}

      <label className="world-v27-search">
        <Icon name="search" size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Команда, игрок, карьера, событие" aria-label="Поиск" />
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
          {searchCareers.map((record) => (
            <button type="button" key={record.playerId} onClick={() => setSelectedCareer(record)}>
              <span>{record.position}</span><div><strong>{record.name}</strong><small>{careerStageLabel(record.currentStage)} · архив</small></div><em>{Math.round(record.overall)}</em>
            </button>
          ))}
          {searchStories.map((story) => (
            <button type="button" key={story.id} onClick={() => setSelectedStory(story)}>
              <span><Icon name="pulse" size={16} /></span><div><strong>{story.title}</strong><small>{storyKindLabel(story.kind)} · W{story.week}</small></div><em>{story.importance}</em>
            </button>
          ))}
          {searchTeams.length + searchPlayers.length + searchCareers.length + searchStories.length === 0 && <div className="data-empty">Нет совпадений</div>}
        </section>
      ) : selectedView === "feed" ? (
        <>
          <section className="world-v48-agency" aria-label="Автономные решения">
            <header>
              <div><small>ДАВЛЕНИЕ И РЕШЕНИЯ</small><strong>{activeConflicts.length} открыто</strong></div>
              <span>{recentDecisions.length} последних</span>
            </header>
            <div className="world-v48-agency__grid">
              {activeConflicts.map((conflict) => {
                const actor = conflict.actorKind === "team"
                  ? world.teams.find((team) => team.id === conflict.actorId)?.shortName
                  : conflict.actorKind === "player"
                    ? world.players.find((player) => player.id === conflict.actorId)?.name
                    : world.coaches.find((coach) => coach.id === conflict.actorId)?.name;
                return (
                  <article key={conflict.id} className={conflict.relatedToHero ? "is-relevant" : ""}>
                    <div><small>{conflict.stage.toUpperCase()} · {conflict.kind}</small><strong>{actor ?? conflict.actorId}</strong></div>
                    <span>{Math.round(conflict.pressure)}</span>
                  </article>
                );
              })}
              {activeConflicts.length === 0 && <p>Открытых конфликтов нет.</p>}
            </div>
            {recentDecisions.length > 0 && (
              <div className="world-v48-agency__decisions">
                {recentDecisions.map((decision) => <p key={decision.id}><strong>{decision.title}</strong><span>{decision.consequence}</span></p>)}
              </div>
            )}
          </section>
          <section className="world-v47-history" aria-label="История мира">
            <header><div><small>ЖИВОЙ МИР</small><strong>{activeArcs.length} линий</strong></div><span>{activeObjectives} целей</span></header>
            {activeArcs.map((arc) => (
              <article key={arc.id} className={arc.relatedToHero ? "is-relevant" : ""}>
                <div><small>{arc.status === "active" ? "РАЗВИВАЕТСЯ" : "ЗАРОЖДАЕТСЯ"} · {arc.chapters} гл.</small><strong>{arc.title}</strong></div>
                <p>{arc.summary || "История только начала складываться."}</p>
                <span>{Math.round(arc.momentum)}</span>
              </article>
            ))}
            {activeArcs.length === 0 && <p className="world-v47-history__empty">Долгие линии появятся после связанных событий симуляции.</p>}
          </section>
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
        </>
      ) : selectedView === "rankings" ? (
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
      ) : (
        <section className="world-v27-careers">
          <div className="world-v27-career-summary">
            <span><small>Школа</small><strong>{careers.filter((record) => record.currentStage === "high-school").length}</strong></span>
            <span><small>Колледж</small><strong>{careers.filter((record) => record.currentStage === "college").length}</strong></span>
            <span><small>Драфт</small><strong>{world.careerRegistry.draftPoolIds.length}</strong></span>
            <span><small>PRO</small><strong>{careers.filter((record) => record.currentStage === "professional").length}</strong></span>
          </div>
          <div className="world-v27-career-list">
            {careers.map((record) => (
              <button type="button" key={record.playerId} className={record.isHero ? "is-hero" : ""} onClick={() => setSelectedCareer(record)}>
                <span>{record.position}</span>
                <div><strong>{record.name}</strong><small>{careerStageLabel(record.currentStage)} · {record.events.length} событий</small></div>
                <em>{Math.round(record.overall)}</em>
              </button>
            ))}
          </div>
          {careers.length === 0 && <div className="data-empty">Карьерный архив пуст</div>}
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

      <BottomSheet open={Boolean(selectedCareer)} onClose={() => setSelectedCareer(undefined)} eyebrow={selectedCareer ? `${selectedCareer.position} · ${careerStageLabel(selectedCareer.currentStage)}` : "КАРЬЕРА"} title={selectedCareer?.name ?? "Карьера игрока"}>
        {selectedCareer && (
          <div className="world-v27-career-sheet">
            <section>
              <span><small>Возраст</small><strong>{selectedCareer.age}</strong></span>
              <span><small>OVR</small><strong>{Math.round(selectedCareer.overall)}</strong></span>
              <span><small>Потенциал</small><strong>{Math.round(selectedCareer.potential)}</strong></span>
              <span><small>Драфт</small><strong>{selectedCareer.draftPick ? `#${selectedCareer.draftPick}` : "—"}</strong></span>
            </section>
            <div className="world-v27-career-path">
              {selectedCareer.events.slice().reverse().map((item) => (
                <article key={item.id}><small>{item.seasonYear} · W{item.week}</small><strong>{item.detail}</strong></article>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      <EcosystemPlayerProfile save={save} player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} {...(onOpenTeam ? { onOpenTeam: openTeam } : {})} />
    </div>
  );
}
