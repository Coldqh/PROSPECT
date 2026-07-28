import { useEffect, useMemo, useRef, useState } from "react";
import { formatGameDate, toGameDateKey } from "../../core/calendar/types";
import { calculateDecisionForecast } from "../../sports/football/matches/decisionForecast";
import type {
  MatchDriveOutcome,
  MatchEpisode,
  MatchParticipationMode,
  MatchUnit,
} from "../../sports/football/matches/types";
import type { CareerSave } from "../../storage/saves/schema";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { MatchField, type MatchPlaybackPhase } from "./MatchField";


interface MatchDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string | undefined;
  onStartMatch(mode: MatchParticipationMode, analysisMode: boolean): Promise<void>;
  onResolveDecision(optionId: string): Promise<void>;
  onFinalizeMatch?: (() => Promise<void>) | undefined;
}

const playbackPhases: MatchPlaybackPhase[] = ["pre-snap", "snap", "develop", "action", "contact", "result"];

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function unitLabel(unit: MatchUnit): string {
  return unit === "offense" ? "АТАКА" : unit === "defense" ? "ЗАЩИТА" : "СПЕЦКОМАНДЫ";
}

function riskLabel(risk: "safe" | "balanced" | "aggressive"): string {
  return { safe: "Надёжно", balanced: "Баланс", aggressive: "Риск" }[risk];
}

function involvementLabel(value: MatchEpisode["heroInvolvement"]): string {
  return { primary: "Ключевая роль", secondary: "Второе чтение", "assignment-only": "Работа без мяча" }[value];
}

function driveOutcomeLabel(outcome: MatchDriveOutcome): string {
  return {
    active: "Драйв продолжается",
    touchdown: "Тачдаун",
    "defensive-touchdown": "Тачдаун защиты",
    "field-goal": "Филд-гол",
    "missed-field-goal": "Промах",
    punt: "Пант",
    turnover: "Потеря",
    "turnover-on-downs": "Смена по даунам",
    "end-half": "Конец половины",
    "end-game": "Конец матча",
  }[outcome];
}

function confidenceLabel(value: "low" | "medium" | "high"): string {
  return { low: "низкая", medium: "средняя", high: "высокая" }[value];
}

function modeLabel(mode: MatchParticipationMode): string {
  return { auto: "Автоматически", "key-moments": "Ключевые моменты", "every-snap": "Каждый снэп" }[mode];
}

function modeDescription(mode: MatchParticipationMode): string {
  return {
    auto: "Штаб и игрок проводят весь матч без остановок. Ты получаешь полный итог и статистику.",
    "key-moments": "Матч идёт сам и останавливается на третьих даунах, red zone, риске потери и прямом участии.",
    "every-snap": "Ты выбираешь исполнение каждого своего снэпа. Остальные владения считаются автоматически.",
  }[mode];
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function statLine(save: CareerSave): Array<{ label: string; value: string }> {
  const stats = save.football.match.stats;
  const advanced = save.football.match.advancedStats;
  switch (save.football.position) {
    case "QB": return [
      { label: "COMP/ATT", value: `${stats.completions}/${stats.passingAttempts}` },
      { label: "PASS YDS", value: String(stats.passingYards) },
      { label: "TD", value: String(stats.touchdowns) },
      { label: "TO", value: String(stats.turnovers) },
    ];
    case "RB": return [
      { label: "CAR", value: String(stats.rushingAttempts) },
      { label: "RUSH YDS", value: String(stats.rushingYards) },
      { label: "REC YDS", value: String(stats.receivingYards) },
      { label: "TD", value: String(stats.touchdowns) },
    ];
    case "WR":
    case "TE": return [
      { label: "REC/TGT", value: `${stats.receptions}/${stats.targets}` },
      { label: "REC YDS", value: String(stats.receivingYards) },
      { label: "BLOCK W", value: String(advanced.blocksWon) },
      { label: "TD", value: String(stats.touchdowns) },
    ];
    case "OT":
    case "OG":
    case "C": return [
      { label: "PASS PRO", value: String(advanced.passProtectionWins) },
      { label: "RUN BLOCK", value: String(advanced.runBlockWins) },
      { label: "PRESS ALW", value: String(stats.pressuresAllowed) },
      { label: "PANCAKES", value: String(stats.pancakes) },
    ];
    case "EDGE":
    case "DT": return [
      { label: "SACK", value: String(stats.sacks) },
      { label: "HURRY", value: String(stats.hurries) },
      { label: "TFL", value: String(stats.tacklesForLoss) },
      { label: "RUN STOP", value: String(stats.runStops) },
    ];
    case "LB": return [
      { label: "TACKLES", value: String(stats.tackles) },
      { label: "TFL", value: String(stats.tacklesForLoss) },
      { label: "SACK", value: String(stats.sacks) },
      { label: "INT", value: String(stats.interceptions) },
    ];
    case "CB":
    case "S": return [
      { label: "TACKLES", value: String(stats.tackles) },
      { label: "PBU", value: String(stats.passBreakups) },
      { label: "INT", value: String(stats.interceptions) },
      { label: "COV SNAP", value: String(stats.coverageSnaps) },
    ];
    case "K": return [
      { label: "FG", value: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}` },
      { label: "LONG", value: String(stats.longestFieldGoal) },
      { label: "QUALITY", value: String(advanced.kickQuality) },
      { label: "PTS", value: String(stats.fieldGoalsMade * 3) },
    ];
    case "P": return [
      { label: "PUNTS", value: String(stats.punts) },
      { label: "NET YDS", value: String(stats.puntYards) },
      { label: "INSIDE 20", value: String(stats.puntsInside20) },
      { label: "RET ALW", value: String(stats.returnYardsAllowed) },
    ];
  }
  return [];
}

function SnapPersonnel({ episode }: { episode: MatchEpisode }) {
  const groups = episode.unit === "special"
    ? (["hero", "opponent"] as const).map((side) => ({ id: side, label: side === "hero" ? "Спецкоманда" : "Блок / возврат", assignments: episode.assignments.filter((item) => item.side === side) }))
    : (["offense", "defense"] as const).map((unit) => ({ id: unit, label: unit === "offense" ? "Атака" : "Защита", assignments: episode.assignments.filter((item) => item.unit === unit) }));
  return <section className="snap-personnel">{groups.map((group) => <div key={group.id}><header><strong>{group.label}</strong><span>{group.assignments.length}</span></header>{group.assignments.map((item) => <article key={item.id} className={item.isHero ? "is-hero" : ""}><span>{item.slot}</span><div><strong>{item.playerName ?? item.label}</strong><small>{item.position} · {item.task}</small></div><em>{item.overall ? Math.round(item.overall) : "—"}</em></article>)}</div>)}</section>;
}

export function MatchDashboard({ save, mutating, actionError, onStartMatch, onResolveDecision, onFinalizeMatch }: MatchDashboardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<MatchParticipationMode>("key-moments");
  const [analysisMode, setAnalysisMode] = useState(true);
  const [phase, setPhase] = useState<MatchPlaybackPhase>("pre-snap");
  const [playingResultId, setPlayingResultId] = useState<string>();
  const seenResult = useRef<string | undefined>(undefined);
  const match = save.football.match;
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const heroTeamName = collegeCareer
    ? save.world.teams.find((team) => team.id === collegeCareer.teamId)?.shortName ?? save.football.college.program?.shortName ?? "PROGRAM"
    : save.football.school.shortName;
  const stats = useMemo(() => statLine(save), [save]);
  const isMatchDay = match.status !== "upcoming" || toGameDateKey(save.meta.currentDate) === toGameDateKey(match.scheduledDate);
  const playbackEpisode = playingResultId ? match.lastResolvedEpisode : undefined;
  const playbackResult = playingResultId ? match.lastResolvedResult : undefined;
  const episode = playbackEpisode ?? match.currentEpisode;
  const resultAnimating = Boolean(playingResultId && playbackEpisode && playbackResult);
  const assignmentRate = match.advancedStats.snaps > 0 ? Math.round(match.advancedStats.assignmentWins / match.advancedStats.snaps * 100) : 0;

  useEffect(() => {
    const result = match.lastResolvedResult;
    if (!result || seenResult.current === result.id) return;
    seenResult.current = result.id;
    setPlayingResultId(result.id);
    setPhase("pre-snap");
    const timers = playbackPhases.slice(1).map((nextPhase, index) => window.setTimeout(() => setPhase(nextPhase), 460 + index * 520));
    timers.push(window.setTimeout(() => setPlayingResultId(undefined), 460 + playbackPhases.length * 520 + 950));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [match.lastResolvedResult?.id]);

  const offenseCall = episode ? (match.heroUnit === "offense" ? episode.playCall : episode.opponentCall) : undefined;
  const defenseCall = episode ? (match.heroUnit === "defense" ? episode.playCall : episode.opponentCall) : undefined;
  const heroAssignment = episode?.assignments.find((item) => item.isHero);
  const heroMatchup = heroAssignment?.matchupSlot ? episode?.assignments.find((item) => item.slot === heroAssignment.matchupSlot && item.unit !== heroAssignment.unit) : undefined;

  return <div className="compact-section match-section match-section--v36">
    <header className="compact-page-head match-page-head"><div><span>WEEK {match.scheduledWeek} · {unitLabel(match.heroUnit)}</span><h2>{match.status === "complete" ? "Финал" : "Матч"}</h2></div><button type="button" className="match-stat-button" onClick={() => setSheetOpen(true)}><small>SNAP</small><strong>{match.episodeIndex}/{match.totalEpisodes}</strong></button></header>
    {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    <section className="match-scoreboard"><div><small>{heroTeamName}</small><strong>{match.heroScore}</strong></div><span><em>{match.status === "upcoming" ? formatGameDate(match.scheduledDate) : `Q${match.quarter} · ${clockLabel(match.clockSeconds)}`}</em><i>{match.status === "complete" ? "FINAL" : match.status === "in-progress" ? "LIVE" : "UPCOMING"}</i></span><div><small>{match.opponentName}</small><strong>{match.opponentScore}</strong></div></section>

    {match.status === "upcoming" && <div className="compact-view match-upcoming">
      <section className="opponent-card"><div className="opponent-card__mark"><Icon name={match.heroUnit === "defense" ? "shield" : "football"} size={28} /></div><div><small>СОПЕРНИК · {match.opponentRecord}</small><h3>{match.opponentName}</h3><p>{match.opponentThreat}</p></div></section>
      <section className="match-mode-panel"><header><div><small>УЧАСТИЕ В МАТЧЕ</small><strong>{modeLabel(mode)}</strong></div><span>{save.football.position}</span></header><div className="match-mode-grid">{(["auto", "key-moments", "every-snap"] as const).map((item) => <button type="button" key={item} className={mode === item ? "is-active" : ""} onClick={() => setMode(item)}><strong>{modeLabel(item)}</strong><span>{modeDescription(item)}</span></button>)}</div><button type="button" className={`match-analysis-toggle${analysisMode ? " is-active" : ""}`} onClick={() => setAnalysisMode((value) => !value)}><Icon name="brain" /><span><strong>Analysis Mode</strong><small>Показывает честный прогноз, риск, matchup и уверенность чтения.</small></span><em>{analysisMode ? "ON" : "OFF"}</em></button></section>
      {isMatchDay ? <button type="button" className="primary-action-bar primary-action-bar--match" disabled={mutating} onClick={() => void onStartMatch(mode, analysisMode)}><span><small>{modeLabel(mode)} · Analysis {analysisMode ? "ON" : "OFF"}</small><strong>{mutating ? "Симуляция…" : "Начать матч"}</strong></span><Icon name="arrow-right" /></button> : <div className="match-lock-card"><Icon name="calendar" /><div><small>Матч назначен</small><strong>{formatGameDate(match.scheduledDate)}</strong></div></div>}
    </div>}

    {match.status === "in-progress" && episode && <div className="compact-view match-live-view elite-match-live">
      <section className="elite-match-player-strip"><span className="elite-match-player-strip__avatar">{initials(save.character.identity.fullName)}</span><div><small>#{save.football.jerseyNumber} · {save.football.position}</small><strong>{save.character.identity.fullName}</strong><span>{modeLabel(match.participationMode)}</span></div><article><small>Оценка</small><strong>{Math.round(match.coachGrade)}</strong></article><article><small>Энергия</small><strong>{Math.round(100 - match.heroFatigue)}%</strong></article></section>
      <section className="elite-match-situation"><header><div><small>ДРАЙВ {match.driveNumber}</small><h3>{episode.title}</h3></div><strong>{episode.down} & {episode.distance}</strong></header><div className="elite-match-facts"><span><small>Мяч</small><strong>{episode.fieldPosition} yd</strong></span><span><small>Время</small><strong>Q{episode.quarter} {clockLabel(episode.clockSeconds)}</strong></span><span><small>Роль</small><strong>{involvementLabel(episode.heroInvolvement)}</strong></span></div></section>
      <section className="match-called-play match-called-play--kernel"><div className="match-call-duel"><article><small>АТАКА · {offenseCall?.personnel}</small><strong>{offenseCall?.formation}</strong><span>{offenseCall?.concept}</span></article><b>VS</b><article><small>ЗАЩИТА · {defenseCall?.personnel}</small><strong>{defenseCall?.formation}</strong><span>{defenseCall?.concept}</span></article></div><MatchField episode={episode} result={playbackResult} phase={resultAnimating ? phase : "pre-snap"} analysisMode={match.analysisMode} /><div className="match-called-play__meta"><span><small>Твой слот</small><strong>{episode.heroSlot}</strong></span><span><small>Задание</small><strong>{episode.heroRole}</strong></span></div>{heroAssignment && <div className="match-personnel-matchup"><article><small>ТЫ</small><strong>{heroAssignment.playerName ?? save.character.identity.fullName}</strong><span>{heroAssignment.position} · OVR {Math.round(heroAssignment.overall ?? save.football.ratings.overall)}</span></article><b>VS</b><article><small>МАТЧАП</small><strong>{heroMatchup?.playerName ?? heroAssignment.matchupSlot ?? "Схема"}</strong><span>{heroMatchup ? `${heroMatchup.position} · OVR ${Math.round(heroMatchup.overall ?? 0)}` : episode.opponentCall.concept}</span></article></div>}</section>

      {match.analysisMode && !resultAnimating && <section className="match-analysis-panel"><header><span><Icon name="brain" /></span><div><small>ANALYSIS MODE</small><strong>{episode.opponentCall.formation} · {episode.opponentCall.concept}</strong></div><em>{episode.opponentCall.playType === "blitz" ? "BLITZ" : episode.opponentCall.tags[0] ?? "READ"}</em></header><div><span><small>Фронт</small><strong>{episode.opponentCall.personnel}</strong></span><span><small>Сильная сторона</small><strong>{episode.opponentCall.strength}</strong></span><span><small>Ключ</small><strong>{episode.heroRole}</strong></span></div></section>}

      {resultAnimating && playbackResult ? <section className={`match-playback-report is-${playbackResult.grade.toLowerCase()}`}><span>{playbackResult.grade}</span><div><small>{phase === "result" ? "РОЗЫГРЫШ ЗАВЕРШЁН" : "РОЗЫГРЫШ ИДЁТ"}</small><strong>{playbackResult.headline}</strong><p>{playbackResult.description}</p></div><em>{playbackResult.yards >= 0 ? "+" : ""}{playbackResult.yards} yd</em></section> : <section className="elite-match-choice"><header><h2>{episode.playCall.canCheck ? "Чтение перед снэпом" : "Выполнение назначения"}</h2><span>{episode.read}</span></header><div className="elite-match-options elite-match-options--v36">{episode.options.map((decision) => { const forecast = calculateDecisionForecast(save, match, episode, decision); return <button type="button" key={decision.id} className={`is-${decision.risk}`} disabled={mutating} onClick={() => void onResolveDecision(decision.id)}><div><small>{riskLabel(decision.risk)}</small><strong>{decision.label}</strong><p>{decision.detail}</p>{match.analysisMode ? <footer><span><em>Выполнение</em><b>{forecast.executionChance}%</b></span><span><em>Влияние</em><b>{forecast.playImpact}</b></span><span><em>Ошибка</em><b>{forecast.mistakeChance}%</b></span></footer> : <footer><span><em>Надёжность</em><b>{decision.risk === "safe" ? "Высокая" : decision.risk === "balanced" ? "Средняя" : "Низкая"}</b></span><span><em>Потенциал</em><b>{decision.upside}</b></span></footer>}{match.analysisMode && <small className="match-choice-range">Оценка {forecast.assignmentFloor}–{forecast.assignmentCeiling} · big play {forecast.bigPlayChance}% · уверенность {confidenceLabel(forecast.confidence)}</small>}</div><span className="elite-match-option-action">Играть</span></button>; })}</div></section>}

      <section className="match-drive-strip"><header><small>Драйв {match.driveNumber} · {match.drivePlays} plays · {match.driveYards} yd</small><strong>{episode.down} & {episode.distance}</strong></header><div><i style={{ width: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }} /><b className="match-drive-strip__first" style={{ left: `${Math.max(4, Math.min(96, episode.fieldPosition + episode.distance))}%` }} /><span style={{ left: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }}>{episode.fieldPosition}</span></div><footer><span>Назначения {assignmentRate}%</span><span>Снэпы {match.advancedStats.snaps}</span></footer></section>
    </div>}

    {match.status === "complete" && match.finalResult && <div className="compact-view match-final-view"><section className={`match-final-card ${match.finalResult.won ? "is-win" : "is-loss"}`}><small>{match.finalResult.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</small><div><strong>{match.finalResult.heroScore}</strong><span>:</span><strong>{match.finalResult.opponentScore}</strong></div><h3>{match.finalResult.headline}</h3><p>{match.finalResult.summary}</p></section><div className="match-stat-grid">{stats.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</div><section className="match-stat-integrity"><Icon name="check" /><div><strong>Полная статистика матча</strong><span>Учтены все {match.advancedStats.snaps} снэпов героя: ручные и автоматические.</span></div></section><section className="match-coach-report"><span className={`result-grade result-grade--${match.finalResult.grade.toLowerCase()}`}>{match.finalResult.grade}</span><div><small>ОЦЕНКА ШТАБА</small><strong>{match.finalResult.spotlight}</strong><p>Доверие {match.finalResult.coachTrustDelta >= 0 ? "+" : ""}{match.finalResult.coachTrustDelta.toFixed(1)} · Видимость +{match.finalResult.visibilityDelta.toFixed(1)}</p></div></section>{collegeCareer && onFinalizeMatch && <button type="button" className="primary-action-bar primary-action-bar--match" disabled={mutating} onClick={() => void onFinalizeMatch()}><span><small>Результат войдёт в календарь</small><strong>{mutating ? "Фиксация…" : "Закрыть матч"}</strong></span><Icon name="arrow-right" /></button>}<button type="button" className="button button--ghost button--wide" onClick={() => setSheetOpen(true)}>Открыть протокол</button></div>}

    <BottomSheet open={sheetOpen} title="Протокол матча" eyebrow={`${save.football.position} · ${unitLabel(match.heroUnit)}`} onClose={() => setSheetOpen(false)}><div className="match-sheet-stats">{stats.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</div>{episode && <SnapPersonnel episode={episode} />}{match.drives.length > 0 && <div className="match-sheet-drives">{[...match.drives].reverse().map((drive) => <article key={drive.id}><small>{drive.offense === "hero" ? heroTeamName : match.opponentName} · Q{drive.startQuarter} {clockLabel(drive.startClockSeconds)}</small><strong>{driveOutcomeLabel(drive.outcome)}</strong><span>{drive.plays} plays · {drive.yards} yd · {drive.points} pts</span></article>)}</div>}<div className="match-log">{[...match.completedEpisodes].reverse().map((result, index) => <article key={result.id}><span className={`result-grade result-grade--${result.grade.toLowerCase()}`}>{result.grade}</span><div><small>СНЭП {match.completedEpisodes.length - index} · {result.startFieldPosition} → {result.endFieldPosition}</small><strong>{result.headline}</strong><p>{result.description}</p></div></article>)}</div></BottomSheet>
  </div>;
}
