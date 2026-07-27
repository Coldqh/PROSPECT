import { useMemo, useState, type CSSProperties } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { formatGameDate } from "../../core/calendar/types";
import { BottomSheet } from "../ui/BottomSheet";
import type { MatchPlayCall } from "../../sports/football/matches/types";
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

function unitLabel(unit: "offense" | "defense"): string {
  return unit === "offense" ? "АТАКА" : "ЗАЩИТА";
}

function riskLabel(risk: "safe" | "balanced" | "aggressive"): string {
  return { safe: "Надёжно", balanced: "Баланс", aggressive: "Риск" }[risk];
}


function involvementLabel(value: "primary" | "secondary" | "assignment-only"): string {
  return { primary: "Ключевая роль", secondary: "Второе чтение", "assignment-only": "Работа без мяча" }[value];
}

interface FormationSpot {
  left: number;
  top: number;
  label: string;
  moveX: number;
  moveY: number;
  delay: number;
}

function strengthDirection(playCall: MatchPlayCall): number {
  return playCall.strength === "left" ? -1 : playCall.strength === "right" ? 1 : 0;
}

function offenseFormation(playCall: MatchPlayCall): FormationSpot[] {
  const direction = strengthDirection(playCall);
  const line: FormationSpot[] = [30, 40, 50, 60, 70].map((left, index) => ({ left, top: 61, label: index === 2 ? "C" : "OL", moveX: direction * 2, moveY: -5, delay: index * 25 }));
  const receivers: Record<string, Array<[number, number, string]>> = {
    "Gun Trips": [[10, 49, "WR"], [67, 48, "WR"], [79, 48, "WR"], [91, 49, "WR"]],
    "Gun Doubles": [[10, 49, "WR"], [25, 48, "WR"], [75, 48, "WR"], [90, 49, "WR"]],
    "Singleback Ace": [[10, 49, "WR"], [28, 50, "TE"], [72, 50, "TE"], [90, 49, "WR"]],
    "Pistol Strong": [[9, 49, "WR"], [27, 50, "WR"], [73, 50, "TE"], [91, 49, "WR"]],
    Empty: [[8, 48, "WR"], [24, 48, "WR"], [38, 50, "WR"], [76, 48, "WR"], [92, 48, "WR"]],
    "Goal Line": [[22, 53, "TE"], [78, 53, "TE"], [12, 51, "WR"], [88, 51, "WR"]],
  };
  const skillSpots = receivers[playCall.formation] ?? receivers["Gun Doubles"]!;
  const passLike = playCall.playType !== "run";
  const skill = skillSpots.map(([left, top, label], index) => ({
    left,
    top,
    label,
    moveX: passLike ? (left < 50 ? -4 - index * 2 : 4 + index * 2) : direction * 10,
    moveY: passLike ? -36 + (index % 2) * 9 : -11,
    delay: 90 + index * 45,
  }));
  const underCenter = playCall.formation === "Singleback Ace" || playCall.formation === "Goal Line";
  const pistol = playCall.formation === "Pistol Strong";
  const qb: FormationSpot = {
    left: 50,
    top: underCenter ? 68 : pistol ? 75 : 76,
    label: "QB",
    moveX: passLike ? direction * 5 : direction * 2,
    moveY: passLike ? 9 : -2,
    delay: 40,
  };
  const backs: FormationSpot[] = playCall.formation === "Empty"
    ? []
    : [{ left: pistol ? 50 : playCall.formation === "Gun Trips" ? 42 : 50, top: pistol ? 88 : 89, label: "RB", moveX: playCall.playType === "run" ? direction * 22 : direction * 5, moveY: playCall.playType === "run" ? -42 : -8, delay: 105 }];
  return [...line, ...skill, qb, ...backs];
}

function defenseFormation(playCall: MatchPlayCall): FormationSpot[] {
  const blitz = playCall.playType === "blitz";
  const front = playCall.formation === "3–4 Odd"
    ? [[37, 39, "DL"], [50, 38, "DL"], [63, 39, "DL"]] as const
    : playCall.formation === "Bear Front" || playCall.formation === "Goal Line"
      ? [[29, 40, "DL"], [39, 38, "DL"], [50, 37, "DL"], [61, 38, "DL"], [71, 40, "DL"]] as const
      : [[34, 39, "DL"], [45, 38, "DL"], [56, 38, "DL"], [67, 39, "DL"]] as const;
  const secondLevel = playCall.formation === "Dime"
    ? [[42, 24, "LB"], [58, 24, "LB"]] as const
    : playCall.formation.includes("Nickel")
      ? [[36, 25, "LB"], [50, 23, "LB"], [64, 25, "DB"]] as const
      : [[31, 25, "LB"], [50, 23, "LB"], [69, 25, "LB"]] as const;
  const secondary: Array<readonly [number, number, string]> = [[9, 18, "CB"], [91, 18, "CB"], [38, 9, "S"], [62, 9, "S"]];
  return [...front, ...secondLevel, ...secondary].map(([left, top, label], index) => ({
    left,
    top,
    label,
    moveX: left < 50 ? 4 : -4,
    moveY: label === "DL" ? 18 : label === "LB" && blitz ? 27 : label === "LB" ? 13 : 7,
    delay: index * 32,
  }));
}

function genericOffense(): FormationSpot[] {
  const call: MatchPlayCall = { formation: "Gun Doubles", personnel: "11", concept: "Opponent Call", playType: "pass", strength: "middle", calledBy: "offensive-coordinator", canCheck: false };
  return offenseFormation(call);
}

function genericDefense(): FormationSpot[] {
  const call: MatchPlayCall = { formation: "Nickel 4–2–5", personnel: "Nickel", concept: "Opponent Call", playType: "coverage", strength: "middle", calledBy: "defensive-coordinator", canCheck: false };
  return defenseFormation(call);
}

function FormationBoard({ save, playCall }: { save: CareerSave; playCall: MatchPlayCall }) {
  const hero = save.football.position;
  const heroUnit = save.football.match.heroUnit;
  let heroMarked = false;
  const offense = heroUnit === "offense" ? offenseFormation(playCall) : genericOffense();
  const defense = heroUnit === "defense" ? defenseFormation(playCall) : genericDefense();
  const renderSpot = (spot: FormationSpot, unit: "offense" | "defense", index: number) => {
    const eligible = unit === heroUnit && spot.label === hero;
    const isHero = eligible && !heroMarked;
    if (isHero) heroMarked = true;
    const style = {
      left: `${spot.left}%`,
      top: `${spot.top}%`,
      "--snap-x": `${spot.moveX}px`,
      "--snap-y": `${spot.moveY}px`,
      "--snap-delay": `${spot.delay}ms`,
    } as CSSProperties;
    return <span key={`${unit}-${index}`} className={`formation-player formation-player--${unit}${isHero ? " is-hero" : ""}`} style={style}>{isHero ? save.football.jerseyNumber : spot.label}</span>;
  };
  const ballDirection = strengthDirection(playCall);
  const ballStyle = {
    "--ball-x": `${playCall.playType === "run" ? ballDirection * 34 : ballDirection * 22}px`,
    "--ball-y": `${playCall.playType === "run" ? -68 : -92}px`,
  } as CSSProperties;
  return (
    <section className={`formation-board formation-board--${playCall.playType}`} aria-label="Анимированная расстановка и развитие снэпа">
      <div className="formation-board__endzone formation-board__endzone--away">DEFENSE</div>
      <div className="formation-board__line" />
      <i className="formation-ball" style={ballStyle} />
      {defense.map((spot, index) => renderSpot(spot, "defense", index))}
      {offense.map((spot, index) => renderSpot(spot, "offense", index))}
      <div className="formation-board__endzone formation-board__endzone--home">OFFENSE</div>
      <span className="formation-board__snap-label">SNAP</span>
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
    case "QB":
      return [
        { label: "COMP/ATT", value: `${stats.completions}/${stats.passingAttempts}` },
        { label: "PASS YDS", value: String(stats.passingYards) },
        { label: "TD", value: String(stats.touchdowns) },
        { label: "TO", value: String(stats.turnovers) },
      ];
    case "RB":
      return [
        { label: "CAR", value: String(stats.rushingAttempts) },
        { label: "RUSH YDS", value: String(stats.rushingYards) },
        { label: "TD", value: String(stats.touchdowns) },
        { label: "TO", value: String(stats.turnovers) },
      ];
    case "WR":
      return [
        { label: "REC/TGT", value: `${stats.receptions}/${stats.targets}` },
        { label: "REC YDS", value: String(stats.receivingYards) },
        { label: "TD", value: String(stats.touchdowns) },
        { label: "TO", value: String(stats.turnovers) },
      ];
    case "LB":
      return [
        { label: "TACKLES", value: String(stats.tackles) },
        { label: "TFL", value: String(stats.tacklesForLoss) },
        { label: "SACK", value: String(stats.sacks) },
        { label: "INT", value: String(stats.interceptions) },
      ];
    case "CB":
      return [
        { label: "TACKLES", value: String(stats.tackles) },
        { label: "PBU", value: String(stats.passBreakups) },
        { label: "INT", value: String(stats.interceptions) },
        { label: "TD", value: String(stats.touchdowns) },
      ];
    default:
      return [];
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
            <header><div><small>ТЕКУЩАЯ СИТУАЦИЯ</small><h3>{episode.title}</h3></div><strong>{episode.down} & {episode.distance}</strong></header>
            <div className="elite-match-facts">
              <span><small>Поле</small><strong>{episode.fieldPosition} yd</strong></span>
              <span><small>Давление</small><strong>{episode.scoreMargin < 0 ? "Высокое" : "Рабочее"}</strong></span>
              <span><small>Задача</small><strong>{episode.assignment}</strong></span>
            </div>
          </section>

          <section className="match-called-play">
            <header>
              <div><small>ВЫЗОВ ШТАБА</small><h3>{episode.playCall.formation}</h3></div>
              <span>{episode.playCall.personnel} · {episode.playCall.concept}</span>
            </header>
            <FormationBoard key={episode.id} save={save} playCall={episode.playCall} />
            <div className="match-called-play__meta">
              <span><small>Участие</small><strong>{involvementLabel(episode.heroInvolvement)}</strong></span>
              <span><small>Роль</small><strong>{episode.heroRole}</strong></span>
            </div>
          </section>

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
              <header><small>Драйв {match.driveNumber}</small><strong>{episode.down} & {episode.distance}</strong></header>
              <div><i style={{ width: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }} /><span style={{ left: `${Math.max(4, Math.min(96, episode.fieldPosition))}%` }}>{episode.fieldPosition}</span></div>
            </section>
            <section className="elite-play-log">
              <header><small>Последние розыгрыши</small><strong>{match.completedEpisodes.length}</strong></header>
              {[...match.completedEpisodes].slice(-4).reverse().map((item) => <article key={item.id}><span>{item.grade}</span><strong>{item.headline}</strong><em>{item.involved ? `${item.yards > 0 ? "+" : ""}${item.yards} yd` : `${Math.round(item.assignmentScore)}%`}</em></article>)}
              {match.completedEpisodes.length === 0 && <div className="elite-empty">Матч только начался</div>}
            </section>
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
