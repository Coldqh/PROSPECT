import { useCallback, useMemo, useState } from "react";
import { formatGameDate, toGameDateKey } from "../../core/calendar/types";
import { encodeLivePlayOutcome, type MatchLivePlayOutcome } from "../../sports/football/matches/realTimeEngine";
import type {
  MatchDriveOutcome,
  MatchDriveSummary,
  MatchEpisode,
  MatchParticipationMode,
  MatchUnit,
} from "../../sports/football/matches/types";
import type { CareerSave } from "../../storage/saves/schema";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { RealTimeMatchField } from "./RealTimeMatchField";
import { ManagerPageHeader } from "./ManagerPageHeader";

interface MatchDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string | undefined;
  onStartMatch(mode: MatchParticipationMode, analysisMode: boolean): Promise<void>;
  onResolveDecision(optionId: string): Promise<void>;
  onFinalizeMatch?: (() => Promise<void>) | undefined;
}

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function unitLabel(unit: MatchUnit): string {
  return unit === "offense" ? "АТАКА" : unit === "defense" ? "ЗАЩИТА" : "СПЕЦКОМАНДЫ";
}

function involvementLabel(value: MatchEpisode["heroInvolvement"]): string {
  return { primary: "PRIMARY", secondary: "SECONDARY", "assignment-only": "ASSIGNMENT" }[value];
}

function driveOutcomeLabel(outcome: MatchDriveOutcome): string {
  return {
    active: "ACTIVE",
    touchdown: "TOUCHDOWN",
    "defensive-touchdown": "DEFENSIVE TD",
    "field-goal": "FIELD GOAL",
    "missed-field-goal": "MISSED FG",
    punt: "PUNT",
    turnover: "TURNOVER",
    "turnover-on-downs": "4TH DOWN",
    "end-half": "HALFTIME",
    "end-game": "FINAL",
  }[outcome];
}

function defenseOutcomeLabel(outcome: MatchDriveOutcome): string {
  return {
    active: "ACTIVE",
    touchdown: "TD ALLOWED",
    "defensive-touchdown": "DEFENSIVE TD",
    "field-goal": "FG ALLOWED",
    "missed-field-goal": "MISSED FG",
    punt: "PUNT FORCED",
    turnover: "TURNOVER FORCED",
    "turnover-on-downs": "4TH DOWN STOP",
    "end-half": "HALFTIME",
    "end-game": "FINAL",
  }[outcome];
}

function driveDuration(drive: MatchDriveSummary): string {
  const start = (4 - drive.startQuarter) * 900 + drive.startClockSeconds;
  const end = (4 - drive.endQuarter) * 900 + drive.endClockSeconds;
  return clockLabel(Math.max(0, start - end));
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function statLine(save: CareerSave): Array<{ label: string; value: string }> {
  const stats = save.football.match.stats;
  const advanced = save.football.match.advancedStats;
  const usage = save.football.match.usageStats;
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
      { label: "OPEN", value: String(usage.openWindows) },
      { label: "MISSED", value: String(usage.missedOpenWindows) },
    ];
    case "OT":
    case "OG":
    case "C": return [
      { label: "PASS PRO", value: String(advanced.passProtectionWins) },
      { label: "RUN BLOCK", value: String(advanced.runBlockWins) },
      { label: "PRESS ALW", value: String(stats.pressuresAllowed) },
      { label: "SACK ALW", value: String(stats.sacksAllowed) },
    ];
    case "EDGE":
    case "DT": return [
      { label: "SACK", value: String(stats.sacks) },
      { label: "PRESS", value: String(advanced.pressures) },
      { label: "TFL", value: String(stats.tacklesForLoss) },
      { label: "RUN STOP", value: String(stats.runStops) },
    ];
    case "LB": return [
      { label: "TACKLES", value: String(stats.tackles) },
      { label: "TFL", value: String(stats.tacklesForLoss) },
      { label: "SACK", value: String(stats.sacks) },
      { label: "PRESS", value: String(advanced.pressures) },
    ];
    case "CB":
    case "S": return [
      { label: "TACKLES", value: String(stats.tackles) },
      { label: "PBU", value: String(stats.passBreakups) },
      { label: "INT", value: String(stats.interceptions) },
      { label: "COV W", value: String(advanced.coverageWins) },
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
    ? (["hero", "opponent"] as const).map((side) => ({
        id: side,
        label: side === "hero" ? "SPECIAL" : "RETURN",
        assignments: episode.assignments.filter((item) => item.side === side),
      }))
    : (["offense", "defense"] as const).map((unit) => ({
        id: unit,
        label: unit === "offense" ? "OFFENSE" : "DEFENSE",
        assignments: episode.assignments.filter((item) => item.unit === unit),
      }));
  return (
    <section className="snap-personnel">
      {groups.map((group) => (
        <div key={group.id}>
          <header><strong>{group.label}</strong><span>{group.assignments.length}</span></header>
          {group.assignments.map((item) => (
            <article key={item.id} className={item.isHero ? "is-hero" : ""}>
              <span>{item.slot}</span>
              <div><strong>{item.playerName ?? item.label}</strong><small>{item.position} · {item.task}</small></div>
              <em>{item.overall ? Math.round(item.overall) : "—"}</em>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

export function MatchDashboard({
  save,
  mutating,
  actionError,
  onStartMatch,
  onResolveDecision,
  onFinalizeMatch,
}: MatchDashboardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedTransitionId, setDismissedTransitionId] = useState<string>();
  const mode: MatchParticipationMode = "every-snap";
  const [analysisMode, setAnalysisMode] = useState(true);
  const match = save.football.match;
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const professionalCareer = save.meta.phase === "professional-career" ? save.football.professional.heroCareer : undefined;
  const professionalTeam = professionalCareer?.teamId
    ? save.football.professional.teams.find((team) => team.id === professionalCareer.teamId)
    : undefined;
  const heroTeamName = collegeCareer
    ? save.world.teams.find((team) => team.id === collegeCareer.teamId)?.shortName ?? save.football.college.program?.shortName ?? "PROGRAM"
    : professionalTeam?.shortName ?? save.football.school.shortName;
  const stats = useMemo(() => statLine(save), [save]);
  const isMatchDay = match.status !== "upcoming" || toGameDateKey(save.meta.currentDate) === toGameDateKey(match.scheduledDate);
  const episode = match.currentEpisode;
  const assignmentRate = match.advancedStats.snaps > 0
    ? Math.round(match.advancedStats.assignmentWins / match.advancedStats.snaps * 100)
    : 0;
  const transitionDrive = match.status === "in-progress"
    ? [...match.drives].reverse().find((drive) => !drive.controlled)
    : undefined;
  const showTransition = Boolean(transitionDrive && transitionDrive.id !== dismissedTransitionId);

  const resolveLivePlay = useCallback(async (outcome: MatchLivePlayOutcome) => {
    await onResolveDecision(encodeLivePlayOutcome(outcome));
  }, [onResolveDecision]);

  const offenseCall = episode ? (match.heroUnit === "offense" ? episode.playCall : episode.opponentCall) : undefined;
  const defenseCall = episode ? (match.heroUnit === "defense" ? episode.playCall : episode.opponentCall) : undefined;
  const heroAssignment = episode?.assignments.find((item) => item.isHero);
  const heroMatchup = heroAssignment?.matchupSlot
    ? episode?.assignments.find((item) => item.slot === heroAssignment.matchupSlot && item.unit !== heroAssignment.unit)
    : undefined;

  const transitionIsHeroOffense = transitionDrive?.offense === "hero";
  const transitionLabel = match.heroUnit === "defense" && transitionIsHeroOffense
    ? `АТАКА · ${heroTeamName}`
    : match.heroUnit === "offense" && !transitionIsHeroOffense
      ? `ЗАЩИТА · ${heroTeamName}`
      : `${transitionIsHeroOffense ? heroTeamName : match.opponentName}`;

  return (
    <div className="compact-section match-section match-section--v36">
      <ManagerPageHeader
        eyebrow={`НЕДЕЛЯ ${match.scheduledWeek} · ${unitLabel(match.heroUnit)}`}
        title={match.status === "complete" ? "Финальный результат" : match.status === "in-progress" ? "Матч в прямом эфире" : `${heroTeamName} — ${match.opponentName}`}
        subtitle={match.status === "upcoming" ? `${formatGameDate(match.scheduledDate)} · ${match.opponentRecord}` : `Q${match.quarter} · ${clockLabel(match.clockSeconds)} · ${match.usagePlan.label}`}
        badge="GAME"
        metrics={[
          { label: heroTeamName, value: match.heroScore, tone: match.heroScore >= match.opponentScore ? "positive" : undefined },
          { label: match.opponentName, value: match.opponentScore, tone: match.opponentScore > match.heroScore ? "danger" : undefined },
          { label: "Снэпы", value: match.advancedStats.snaps },
          { label: "Оценка", value: Math.round(match.coachGrade) },
        ]}
        actions={<button type="button" className="manager-head-action" onClick={() => setSheetOpen(true)}><Icon name="chart" /><span>Протокол</span></button>}
        compact
      />

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      <section className="match-scoreboard match-scoreboard--manager">
        <div><small>{heroTeamName}</small><strong>{match.heroScore}</strong></div>
        <span>
          <em>{match.status === "upcoming" ? formatGameDate(match.scheduledDate) : `Q${match.quarter} · ${clockLabel(match.clockSeconds)}`}</em>
          <i>{match.status === "complete" ? "FINAL" : match.status === "in-progress" ? "LIVE" : "UPCOMING"}</i>
        </span>
        <div><small>{match.opponentName}</small><strong>{match.opponentScore}</strong></div>
      </section>

      {match.status === "upcoming" && (
        <div className="compact-view match-upcoming match-upcoming--manager">
          <section className="opponent-card">
            <div className="opponent-card__mark"><Icon name={match.heroUnit === "defense" ? "shield" : "football"} size={28} /></div>
            <div><small>{match.opponentRecord}</small><h3>{match.opponentName}</h3></div>
          </section>
          <section className="match-mode-panel">
            <header>
              <div>
                <small>РОЛЬ</small>
                <strong>{match.rosterRole === "starter" ? "STARTER" : match.rosterRole === "rotation" ? "ROTATION" : match.rosterRole === "special-teams" ? "SPECIAL TEAMS" : "ACTIVE"}</strong>
              </div>
              <span>{save.football.position}</span>
            </header>
            <div className="match-role-metrics">
              <span><small>ROLE</small><strong>{match.rosterRole?.toUpperCase() ?? "ACTIVE"}</strong></span>
              <span><small>GAMEPLAN</small><strong>{match.usagePlan.label}</strong></span>
              <span><small>{save.football.position === "RB" ? "TOUCH SHARE" : "TARGET SHARE"}</small><strong>{Math.round(match.usagePlan.designedShare)}%</strong></span>
              <span><small>HEALTH</small><strong>{Math.round(save.character.condition.health)}</strong></span>
            </div>
            <button type="button" className={`match-analysis-toggle${analysisMode ? " is-active" : ""}`} onClick={() => setAnalysisMode((value) => !value)}>
              <Icon name="brain" /><strong>ANALYSIS</strong><em>{analysisMode ? "ON" : "OFF"}</em>
            </button>
          </section>
          {isMatchDay ? (
            <button type="button" className="primary-action-bar primary-action-bar--match" disabled={mutating} onClick={() => void onStartMatch(mode, analysisMode)}>
              <span><strong>{mutating ? "ЗАПУСК…" : "НАЧАТЬ МАТЧ"}</strong></span><Icon name="arrow-right" />
            </button>
          ) : (
            <div className="match-lock-card"><Icon name="calendar" /><strong>{formatGameDate(match.scheduledDate)}</strong></div>
          )}
        </div>
      )}

      {match.status === "in-progress" && episode && (
        <div className="compact-view match-live-view elite-match-live">
          <section className="elite-match-player-strip">
            <span className="elite-match-player-strip__avatar">{initials(save.character.identity.fullName)}</span>
            <div><small>#{save.football.jerseyNumber} · {save.football.position}</small><strong>{save.character.identity.fullName}</strong></div>
            <article><small>GRADE</small><strong>{Math.round(match.coachGrade)}</strong></article>
            <article><small>ENERGY</small><strong>{Math.round(100 - match.heroFatigue)}%</strong></article>
          </section>

          <section className="elite-match-situation">
            <header><div><small>DRIVE {match.driveNumber}</small><h3>{episode.title}</h3></div><strong>{episode.down} & {episode.distance}</strong></header>
            <div className="elite-match-facts">
              <span><small>BALL</small><strong>{episode.fieldPosition}</strong></span>
              <span><small>TIME</small><strong>Q{episode.quarter} {clockLabel(episode.clockSeconds)}</strong></span>
              <span><small>ROLE</small><strong>{involvementLabel(episode.heroInvolvement)}</strong></span>
            </div>
          </section>

          <section className="match-called-play match-called-play--kernel">
            <div className="match-call-duel">
              <article><small>OFFENSE · {offenseCall?.personnel}</small><strong>{offenseCall?.formation}</strong><span>{offenseCall?.concept}</span></article>
              <b>VS</b>
              <article><small>DEFENSE · {defenseCall?.personnel}</small><strong>{defenseCall?.formation}</strong><span>{defenseCall?.concept}</span></article>
            </div>
            <RealTimeMatchField
              episode={episode}
              heroPosition={save.football.position}
              analysisMode={match.analysisMode}
              disabled={mutating || showTransition}
              seed={`${save.meta.worldSeed}:${match.gameId}:${episode.id}:real-time`}
              onComplete={resolveLivePlay}
            />
            <div className="match-called-play__meta">
              <span><small>SLOT</small><strong>{episode.heroSlot}</strong></span>
              <span><small>ASSIGNMENT</small><strong>{episode.heroRole}</strong></span>
            </div>
            {heroAssignment && (
              <div className="match-personnel-matchup">
                <article><small>YOU</small><strong>{heroAssignment.playerName ?? save.character.identity.fullName}</strong><span>{heroAssignment.position} · {Math.round(heroAssignment.overall ?? save.football.ratings.overall)}</span></article>
                <b>VS</b>
                <article><small>MATCHUP</small><strong>{heroMatchup?.playerName ?? heroAssignment.matchupSlot ?? "SCHEME"}</strong><span>{heroMatchup ? `${heroMatchup.position} · ${Math.round(heroMatchup.overall ?? 0)}` : episode.opponentCall.concept}</span></article>
              </div>
            )}
          </section>

          {match.analysisMode && (
            <section className="match-analysis-panel">
              <header><div><small>ANALYSIS</small><strong>{episode.opponentCall.formation} · {episode.opponentCall.concept}</strong></div><em>{episode.opponentCall.playType === "blitz" ? "BLITZ" : episode.opponentCall.tags[0] ?? "READ"}</em></header>
              <div>
                <span><small>PERSONNEL</small><strong>{episode.opponentCall.personnel}</strong></span>
                <span><small>STRENGTH</small><strong>{episode.opponentCall.strength}</strong></span>
                <span><small>KEY</small><strong>{episode.heroRole}</strong></span>
              </div>
            </section>
          )}

          <section className="match-drive-strip">
            <header><small>{match.drivePlays} PLAYS · {match.driveYards} YD</small><strong>{episode.down} & {episode.distance}</strong></header>
            <div>
              <i style={{ width: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }} />
              <b className="match-drive-strip__first" style={{ left: `${Math.max(4, Math.min(96, episode.fieldPosition + episode.distance))}%` }} />
              <span style={{ left: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }}>{episode.fieldPosition}</span>
            </div>
            <footer><span>ASSIGN {assignmentRate}%</span><span>SNAPS {match.advancedStats.snaps}</span></footer>
          </section>

          {showTransition && transitionDrive && (
            <div className="match-possession-layer" role="presentation">
              <section className="match-possession-dialog" role="dialog" aria-modal="true" aria-label="Смена сторон">
                <small>СМЕНА СТОРОН</small>
                <h3>{transitionLabel}</h3>
                <strong>{match.heroUnit === "offense" && transitionDrive.offense === "opponent" ? defenseOutcomeLabel(transitionDrive.outcome) : driveOutcomeLabel(transitionDrive.outcome)}</strong>
                <div>
                  <span><small>PLAYS</small><b>{transitionDrive.plays}</b></span>
                  <span><small>YARDS</small><b>{transitionDrive.yards}</b></span>
                  <span><small>POINTS</small><b>{transitionDrive.points}</b></span>
                  <span><small>TIME</small><b>{driveDuration(transitionDrive)}</b></span>
                </div>
                <button type="button" onClick={() => setDismissedTransitionId(transitionDrive.id)}>ПРОДОЛЖИТЬ</button>
              </section>
            </div>
          )}
        </div>
      )}

      {match.status === "complete" && match.finalResult && (
        <div className="compact-view match-final-view">
          <section className={`match-final-card ${match.finalResult.won ? "is-win" : "is-loss"}`}>
            <strong>{match.finalResult.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</strong>
          </section>
          <div className="match-stat-grid">{stats.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</div>
          {(save.football.position === "WR" || save.football.position === "TE" || save.football.position === "RB") && (
            <section className="match-usage-grid">
              <span><small>ROLE</small><strong>{match.usagePlan.label}</strong></span>
              <span><small>ROUTES</small><strong>{match.usageStats.routesRun}</strong></span>
              <span><small>OPEN TGT</small><strong>{match.usageStats.targetsWhenOpen}/{match.usageStats.openWindows}</strong></span>
              <span><small>SEP</small><strong>{match.usageStats.separationSamples > 0 ? (match.usageStats.separationTotal / match.usageStats.separationSamples).toFixed(1) : "0.0"}</strong></span>
            </section>
          )}
          <section className="match-coach-report">
            <span className={`result-grade result-grade--${match.finalResult.grade.toLowerCase()}`}>{match.finalResult.grade}</span>
            <div>
              <small>GRADE</small>
              <strong>{Math.round(match.finalResult.score ?? match.coachGrade)}/100</strong>
              <span>TRUST {match.finalResult.coachTrustDelta >= 0 ? "+" : ""}{match.finalResult.coachTrustDelta.toFixed(1)}</span>
            </div>
          </section>
          {match.finalResult.evaluation && (
            <section className="match-evaluation-grid">
              {match.finalResult.evaluation.criteria.map((item) => (
                <article key={item.id}><span>{item.label}</span><strong>{Math.round(item.score)}</strong></article>
              ))}
            </section>
          )}
          {onFinalizeMatch && (
            <button type="button" className="primary-action-bar primary-action-bar--match" disabled={mutating} onClick={() => void onFinalizeMatch()}>
              <span><strong>{mutating ? "СОХРАНЕНИЕ…" : "ЗАКРЫТЬ МАТЧ"}</strong></span><Icon name="arrow-right" />
            </button>
          )}
          <button type="button" className="button button--ghost button--wide" onClick={() => setSheetOpen(true)}>ПРОТОКОЛ</button>
        </div>
      )}

      <BottomSheet open={sheetOpen} title="Протокол" eyebrow={`${save.football.position} · ${unitLabel(match.heroUnit)}`} onClose={() => setSheetOpen(false)}>
        <div className="match-sheet-stats">{stats.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</div>
        {episode && <SnapPersonnel episode={episode} />}
        {match.drives.length > 0 && (
          <div className="match-sheet-drives">
            {[...match.drives].reverse().map((drive) => (
              <article key={drive.id}>
                <small>{drive.offense === "hero" ? heroTeamName : match.opponentName} · Q{drive.startQuarter} {clockLabel(drive.startClockSeconds)}</small>
                <strong>{driveOutcomeLabel(drive.outcome)}</strong>
                <span>{drive.plays} · {drive.yards} YD · {drive.points} PTS</span>
              </article>
            ))}
          </div>
        )}
        <div className="match-log">
          {[...match.completedEpisodes].reverse().map((result, index) => (
            <article key={result.id}>
              <span className={`result-grade result-grade--${result.grade.toLowerCase()}`}>{result.grade}<small>{Math.round(result.evaluation?.score ?? result.assignmentScore)}</small></span>
              <div>
                <small>SNAP {match.completedEpisodes.length - index} · {result.startFieldPosition} → {result.endFieldPosition}</small>
                <strong>{result.headline}</strong>
                {result.evaluation && (
                  <div className="match-log-criteria">{result.evaluation.criteria.map((item) => <span key={item.id}>{item.label} {Math.round(item.score)}</span>)}</div>
                )}
              </div>
            </article>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
