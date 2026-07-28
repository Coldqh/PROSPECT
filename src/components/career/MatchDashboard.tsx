import { useMemo, useState, type CSSProperties } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { formatGameDate } from "../../core/calendar/types";
import { BottomSheet } from "../ui/BottomSheet";
import type { MatchDriveOutcome, MatchEpisode, MatchUnit } from "../../sports/football/matches/types";
import { Icon } from "../ui/Icon";

interface MatchDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string | undefined;
  onStartMatch(): Promise<void>;
  onResolveDecision(optionId: string): Promise<void>;
  onFinalizeMatch?: (() => Promise<void>) | undefined;
}

function collegeRoleLabel(role: NonNullable<CareerSave["football"]["college"]["heroCareer"]>["role"]): string {
  return {
    starter: "Стартер",
    rotation: "Ротация",
    "special-teams": "Спецкоманды",
    developmental: "Развитие",
  }[role];
}

function clockLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function unitLabel(unit: MatchUnit): string {
  return unit === "offense" ? "АТАКА" : unit === "defense" ? "ЗАЩИТА" : "СПЕЦКОМАНДЫ";
}

function riskLabel(risk: "safe" | "balanced" | "aggressive"): string {
  return { safe: "Надёжно", balanced: "Баланс", aggressive: "Риск" }[risk];
}


function involvementLabel(value: "primary" | "secondary" | "assignment-only"): string {
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

function FormationBoard({ episode }: { episode: MatchEpisode }) {
  const target = episode.assignments.find((assignment) => assignment.unit === "offense" && assignment.slot === episode.playCall.primarySlot)
    ?? episode.assignments.find((assignment) => assignment.unit === "offense" && assignment.slot === episode.opponentCall.primarySlot);
  const ballCarrier = episode.assignments.find((assignment) => assignment.kind === "carry");
  const specialist = episode.assignments.find((assignment) => assignment.kind === "kick" || assignment.kind === "punt");
  const destination = specialist?.end ?? ballCarrier?.end ?? target?.end ?? { x: 50, y: 28 };
  const ballStyle = {
    "--ball-left": `${destination.x}%`,
    "--ball-top": `${destination.y}%`,
  } as CSSProperties;

  return (
    <section className="formation-board formation-board--kernel" aria-label="Расстановка и задания двадцати двух игроков">
      <svg className="formation-board__routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {episode.assignments.map((assignment) => (
          <line
            key={`route-${assignment.id}`}
            x1={assignment.start.x}
            y1={assignment.start.y}
            x2={assignment.end.x}
            y2={assignment.end.y}
            className={`formation-route formation-route--${assignment.unit}${assignment.isHero ? " is-hero" : ""}`}
          />
        ))}
      </svg>
      <div className="formation-board__endzone formation-board__endzone--away">{episode.unit === "special" ? "BLOCK / RETURN" : "DEFENSE"}</div>
      <div className="formation-board__hash formation-board__hash--left" />
      <div className="formation-board__hash formation-board__hash--right" />
      <div className="formation-board__line" />
      <i className="formation-ball" style={ballStyle} />
      {episode.assignments.map((assignment) => {
        const style = {
          left: `${assignment.start.x}%`,
          top: `${assignment.start.y}%`,
          "--snap-left": `${assignment.end.x}%`,
          "--snap-top": `${assignment.end.y}%`,
          "--snap-delay": `${assignment.delayMs}ms`,
        } as CSSProperties;
        return (
          <span
            key={assignment.id}
            className={`formation-player formation-player--${assignment.unit}${assignment.isHero ? " is-hero" : ""}`}
            style={style}
            title={`${assignment.playerName ?? assignment.slot} · ${assignment.position}${assignment.overall ? ` · OVR ${Math.round(assignment.overall)}` : ""}: ${assignment.task}`}
          >
            {assignment.isHero ? episode.position : assignment.label}
          </span>
        );
      })}
      <div className="formation-board__endzone formation-board__endzone--home">{episode.unit === "special" ? "SPECIAL TEAMS" : "OFFENSE"}</div>
      <span className="formation-board__snap-label">22 PLAYERS · {episode.unit === "special" ? "KICK" : "SNAP"}</span>
    </section>
  );
}

function SnapPersonnel({ episode }: { episode: MatchEpisode }) {
  const groups = episode.unit === "special"
    ? (["hero", "opponent"] as const).map((side) => ({
        id: side,
        label: side === "hero" ? "Спецкоманда" : "Блок / возврат",
        assignments: episode.assignments.filter((assignment) => assignment.side === side),
      }))
    : (["offense", "defense"] as const).map((unit) => ({
        id: unit,
        label: unit === "offense" ? "Атака" : "Защита",
        assignments: episode.assignments.filter((assignment) => assignment.unit === unit),
      }));
  return (
    <section className="snap-personnel">
      {groups.map((group) => (
        <div key={group.id}>
          <header><strong>{group.label}</strong><span>{group.assignments.length} игроков</span></header>
          {group.assignments.map((assignment) => (
            <article key={assignment.id} className={assignment.isHero ? "is-hero" : ""}>
              <span>{assignment.slot}</span>
              <div><strong>{assignment.playerName ?? assignment.label}</strong><small>{assignment.position} · #{assignment.depthRank ?? "—"} · {assignment.task}</small></div>
              <em>{assignment.overall ? Math.round(assignment.overall) : "—"}</em>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

function daysUntilMatch(dayIndex: number): number {
  return Math.max(0, 5 - dayIndex);
}

function optionSuccess(save: CareerSave, difficulty: number): number {
  const ratings = save.football.ratings;
  const base = ratings.technique * .34 + ratings.footballIq * .26 + ratings.athleticism * .2 + ratings.competitiveness * .12 + save.character.condition.confidence * .08;
  return Math.max(18, Math.min(94, Math.round(base - difficulty * .35 + 27)));
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function statLine(save: CareerSave): Array<{ label: string; value: string }> {
  const stats = save.football.match.stats;
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
      { label: "BLOCK W", value: String(save.football.match.advancedStats.blocksWon) },
      { label: "TD", value: String(stats.touchdowns) },
    ];
    case "OT":
    case "OG":
    case "C": return [
      { label: "PASS PRO", value: String(save.football.match.advancedStats.passProtectionWins) },
      { label: "RUN BLOCK", value: String(save.football.match.advancedStats.runBlockWins) },
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
      { label: "QUALITY", value: String(save.football.match.advancedStats.kickQuality) },
      { label: "PTS", value: String(stats.fieldGoalsMade * 3) },
    ];
    case "P": return [
      { label: "PUNTS", value: String(stats.punts) },
      { label: "NET YDS", value: String(stats.puntYards) },
      { label: "INSIDE 20", value: String(stats.puntsInside20) },
      { label: "RET ALW", value: String(stats.returnYardsAllowed) },
    ];
  }
}

export function MatchDashboard({ save, mutating, actionError, onStartMatch, onResolveDecision, onFinalizeMatch }: MatchDashboardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { football, life } = save;
  const match = football.match;
  const episode = match.currentEpisode;
  const stats = useMemo(() => statLine(save), [save]);
  const collegeCareer = save.meta.phase === "college-season" ? save.football.college.heroCareer : undefined;
  const isMatchDay = Boolean(collegeCareer) || life.dayIndex === 5;
  const heroTeamName = collegeCareer
    ? save.world.teams.find((team) => team.id === collegeCareer.teamId)?.shortName ?? save.football.college.program?.shortName ?? "PROGRAM"
    : football.school.shortName;
  const offenseCall = episode ? (match.heroUnit === "offense" ? episode.playCall : episode.opponentCall) : undefined;
  const defenseCall = episode ? (match.heroUnit === "defense" ? episode.playCall : episode.opponentCall) : undefined;
  const specialCall = episode?.unit === "special" ? episode.playCall : undefined;
  const lastResult = match.completedEpisodes.at(-1);
  const assignmentRate = match.advancedStats.snaps > 0
    ? Math.round(match.advancedStats.assignmentWins / match.advancedStats.snaps * 100)
    : 0;
  const heroAssignment = episode?.assignments.find((assignment) => assignment.isHero);
  const heroMatchup = heroAssignment?.matchupSlot
    ? episode?.assignments.find((assignment) => assignment.slot === heroAssignment.matchupSlot && assignment.unit !== heroAssignment.unit)
    : undefined;

  return (
    <div className="compact-section match-section">
      <header className="compact-page-head match-page-head">
        <div>
          <span>WEEK {match.scheduledWeek} · {unitLabel(match.heroUnit)}</span>
          <h2>{match.status === "complete" ? "Финал" : "Матч"}</h2>
        </div>
        <button type="button" className="match-stat-button" onClick={() => setSheetOpen(true)}>
          <small>SNAP</small><strong>{match.episodeIndex}/{match.totalEpisodes}</strong>
        </button>
      </header>

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}

      <section className="match-scoreboard">
        <div>
          <small>{heroTeamName}</small>
          <strong>{match.heroScore}</strong>
        </div>
        <span>
          <em>{match.status === "upcoming" ? formatGameDate(match.scheduledDate) : `Q${match.quarter} · ${clockLabel(match.clockSeconds)}`}</em>
          <i>{match.status === "complete" ? "FINAL" : match.status === "in-progress" ? "LIVE" : "UPCOMING"}</i>
        </span>
        <div>
          <small>{match.opponentName}</small>
          <strong>{match.opponentScore}</strong>
        </div>
      </section>

      {match.status === "in-progress" && (
        <section className="elite-match-player-strip">
          <span className="elite-match-player-strip__avatar">{initials(save.character.identity.fullName)}</span>
          <div><small>#{football.jerseyNumber} · {football.position}</small><strong>{save.character.identity.fullName}</strong><span>{collegeCareer ? collegeRoleLabel(collegeCareer.role) : `Depth #${football.depthChart.rank}`}</span></div>
          <article><small>Оценка</small><strong>{Math.round(match.coachGrade)}</strong></article>
          <article><small>Энергия</small><strong>{Math.round(100 - match.heroFatigue)}%</strong></article>
        </section>
      )}

      {match.status === "upcoming" && (
        <div className="compact-view match-upcoming">
          <section className="opponent-card">
            <div className="opponent-card__mark"><Icon name={match.heroUnit === "defense" ? "shield" : "football"} size={28} /></div>
            <div>
              <small>СЛЕДУЮЩИЙ СОПЕРНИК · {match.opponentRecord}</small>
              <h3>{match.opponentName}</h3>
              <p>{match.opponentThreat}</p>
            </div>
          </section>

          <div className="match-readiness-strip">
            <span><small>РОЛЬ</small><strong>{collegeCareer ? collegeRoleLabel(collegeCareer.role) : `#${football.depthChart.rank}`}</strong></span>
            <span><small>ГОТОВНОСТЬ</small><strong>{Math.round(football.training.body.readiness)}</strong></span>
            <span><small>ДОВЕРИЕ</small><strong>{Math.round(collegeCareer?.coachTrust ?? football.depthChart.coachTrust)}</strong></span>
          </div>

          {isMatchDay ? (
            <button type="button" className="primary-action-bar primary-action-bar--match" disabled={mutating} onClick={() => void onStartMatch()}>
              <span><small>{unitLabel(match.heroUnit)} · {football.position}</small><strong>{mutating ? "Подготовка…" : "Начать матч"}</strong></span>
              <Icon name="arrow-right" />
            </button>
          ) : (
            <div className="match-lock-card">
              <Icon name="calendar" />
              <div><small>Матч откроется в субботу</small><strong>Осталось {daysUntilMatch(life.dayIndex)} дн.</strong></div>
            </div>
          )}
        </div>
      )}

      {match.status === "in-progress" && episode && (
        <div className="compact-view match-live-view elite-match-live">
          <section className="elite-match-situation">
            <header><div><small>ДРАЙВ {match.driveNumber} · СИТУАЦИЯ</small><h3>{episode.title}</h3></div><strong>{episode.down} & {episode.distance}</strong></header>
            <div className="elite-match-facts">
              <span><small>Поле</small><strong>{episode.fieldPosition} yd</strong></span>
              <span><small>Время</small><strong>Q{episode.quarter} {clockLabel(episode.clockSeconds)}</strong></span>
              <span><small>Назначение</small><strong>{involvementLabel(episode.heroInvolvement)}</strong></span>
            </div>
            <p className="match-situation-copy">{episode.situation}</p>
          </section>

          <section className="match-called-play match-called-play--kernel">
            <div className="match-call-duel">
              {specialCall ? (
                <>
                  <article>
                    <small>СПЕЦКОМАНДА · {specialCall.personnel}</small>
                    <strong>{specialCall.formation}</strong>
                    <span>{specialCall.concept}</span>
                  </article>
                  <b>VS</b>
                  <article>
                    <small>БЛОК / ВОЗВРАТ</small>
                    <strong>{episode.opponentCall.formation}</strong>
                    <span>{episode.opponentCall.concept}</span>
                  </article>
                </>
              ) : (
                <>
                  <article>
                    <small>АТАКА · {offenseCall?.personnel}</small>
                    <strong>{offenseCall?.formation}</strong>
                    <span>{offenseCall?.concept}</span>
                  </article>
                  <b>VS</b>
                  <article>
                    <small>ЗАЩИТА · {defenseCall?.personnel}</small>
                    <strong>{defenseCall?.formation}</strong>
                    <span>{defenseCall?.concept}</span>
                  </article>
                </>
              )}
            </div>
            <FormationBoard key={episode.id} episode={episode} />
            <div className="match-called-play__meta">
              <span><small>Твой слот</small><strong>{episode.heroSlot}</strong></span>
              <span><small>Твоя работа</small><strong>{episode.heroRole}</strong></span>
            </div>
            {heroAssignment && (
              <div className="match-personnel-matchup">
                <article><small>ТЫ</small><strong>{heroAssignment.playerName ?? save.character.identity.fullName}</strong><span>{heroAssignment.position} · OVR {Math.round(heroAssignment.overall ?? football.ratings.overall)}</span></article>
                <b>VS</b>
                <article><small>МАТЧАП</small><strong>{heroMatchup?.playerName ?? heroAssignment.matchupSlot ?? "Схема"}</strong><span>{heroMatchup ? `${heroMatchup.position} · OVR ${Math.round(heroMatchup.overall ?? 0)}` : episode.opponentCall.concept}</span></article>
              </div>
            )}
          </section>

          {lastResult && (
            <section className={`match-last-result is-${lastResult.grade.toLowerCase()}`}>
              <span>{lastResult.grade}</span>
              <div><small>ПРЕДЫДУЩИЙ СНЭП · команда {Math.round(lastResult.teamExecutionScore)}%</small><strong>{lastResult.headline}</strong><p>{lastResult.description}</p></div>
              <em>{lastResult.yards > 0 ? "+" : ""}{lastResult.yards} yd</em>
            </section>
          )}

          <section className="elite-match-choice">
            <header><h2>{episode.playCall.canCheck ? "Чтение перед снэпом" : "Выполнение назначения"}</h2><span>{episode.read}</span></header>
            <div className="elite-match-options">
              {episode.options.map((decision) => {
                const success = optionSuccess(save, decision.difficulty);
                return (
                  <button type="button" key={decision.id} className={`is-${decision.risk}`} disabled={mutating} onClick={() => void onResolveDecision(decision.id)}>
                    <div><small>{riskLabel(decision.risk)}</small><strong>{decision.label}</strong><p>{decision.detail}</p><footer><span><em>Выполнение</em><b>{success}%</b></span><span><em>Влияние</em><b>{decision.upside}</b></span></footer></div>
                    <span className="elite-match-option-action">Играть</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="elite-match-lower">
            <section className="match-drive-strip" aria-label="Текущее владение">
              <header><small>Драйв {match.driveNumber} · {match.drivePlays} plays · {match.driveYards} yd</small><strong>{episode.down} & {episode.distance}</strong></header>
              <div><i style={{ width: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }} /><span style={{ left: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }}>{episode.fieldPosition}</span></div>
              <footer><span>Назначения {assignmentRate}%</span><span>Снэпы {match.advancedStats.snaps}</span></footer>
            </section>
            <section className="elite-play-log">
              <header><small>Последние розыгрыши</small><strong>{match.completedEpisodes.length}</strong></header>
              {[...match.completedEpisodes].slice(-4).reverse().map((item) => <article key={item.id}><span>{item.grade}</span><strong>{item.headline}</strong><em>{item.involved ? `${item.yards > 0 ? "+" : ""}${item.yards} yd` : `${Math.round(item.assignmentScore)}%`}</em></article>)}
              {match.completedEpisodes.length === 0 && <div className="elite-empty">Матч только начался</div>}
            </section>
            {match.drives.length > 0 && (
              <section className="match-drive-history">
                <header><small>Владения</small><strong>{match.drives.length}</strong></header>
                {[...match.drives].slice(-4).reverse().map((drive) => (
                  <article key={drive.id}>
                    <span>{drive.offense === "hero" ? heroTeamName : match.opponentName}</span>
                    <strong>{driveOutcomeLabel(drive.outcome)}</strong>
                    <em>{drive.plays} plays · {drive.yards} yd · {drive.points} pts</em>
                  </article>
                ))}
              </section>
            )}
          </div>
        </div>
      )}

      {match.status === "complete" && match.finalResult && (
        <div className="compact-view match-final-view">
          <section className={`match-final-card ${match.finalResult.won ? "is-win" : "is-loss"}`}>
            <small>{match.finalResult.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</small>
            <div><strong>{match.finalResult.heroScore}</strong><span>:</span><strong>{match.finalResult.opponentScore}</strong></div>
            <h3>{match.finalResult.headline}</h3>
            <p>{match.finalResult.summary}</p>
          </section>

          <div className="match-stat-grid">
            {stats.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}
          </div>

          <section className="match-coach-report">
            <span className={`result-grade result-grade--${match.finalResult.grade.toLowerCase()}`}>{match.finalResult.grade}</span>
            <div><small>ОЦЕНКА ШТАБА</small><strong>{match.finalResult.spotlight}</strong><p>Доверие {match.finalResult.coachTrustDelta >= 0 ? "+" : ""}{match.finalResult.coachTrustDelta.toFixed(1)} · Видимость +{match.finalResult.visibilityDelta.toFixed(1)}</p></div>
          </section>

          {collegeCareer && onFinalizeMatch && (
            <button type="button" className="primary-action-bar primary-action-bar--match" disabled={mutating} onClick={() => void onFinalizeMatch()}>
              <span><small>Результат войдёт в национальный календарь</small><strong>{mutating ? "Фиксация…" : "Закрыть матч"}</strong></span>
              <Icon name="arrow-right" />
            </button>
          )}
          <button type="button" className="button button--ghost button--wide" onClick={() => setSheetOpen(true)}>Открыть протокол</button>
        </div>
      )}

      <BottomSheet open={sheetOpen} title="Протокол матча" eyebrow={`${football.position} · ${unitLabel(match.heroUnit)}`} onClose={() => setSheetOpen(false)}>
        <div className="match-sheet-stats">
          {stats.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}
        </div>
        {episode && <SnapPersonnel episode={episode} />}
        {match.drives.length > 0 && (
          <div className="match-sheet-drives">
            {[...match.drives].reverse().map((drive) => (
              <article key={drive.id}>
                <small>{drive.offense === "hero" ? heroTeamName : match.opponentName} · Q{drive.startQuarter} {clockLabel(drive.startClockSeconds)}</small>
                <strong>{driveOutcomeLabel(drive.outcome)}</strong>
                <span>{drive.plays} plays · {drive.yards} yd · {drive.points} pts</span>
              </article>
            ))}
          </div>
        )}
        <div className="match-log">
          {match.completedEpisodes.length === 0 ? <p>Игровых эпизодов пока нет.</p> : [...match.completedEpisodes].reverse().map((result, index) => (
            <article key={result.id}>
              <span className={`result-grade result-grade--${result.grade.toLowerCase()}`}>{result.grade}</span>
              <div><small>СНЭП {match.completedEpisodes.length - index} · назначение {Math.round(result.assignmentScore)}%</small><strong>{result.headline}</strong><p>{result.description}</p></div>
            </article>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
