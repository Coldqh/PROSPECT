import type { CSSProperties } from "react";
import type { MatchEpisode, MatchEpisodeResult, MatchPlayerAssignment, MatchPoint } from "../../sports/football/matches/types";

export type MatchPlaybackPhase = "pre-snap" | "snap" | "develop" | "action" | "contact" | "result";

interface MatchFieldProps {
  episode: MatchEpisode;
  result?: MatchEpisodeResult | undefined;
  phase: MatchPlaybackPhase;
  analysisMode: boolean;
}

function clamp(value: number, min = 3, max = 97): number {
  return Math.max(min, Math.min(max, value));
}

function mix(left: number, right: number, progress: number): number {
  return left + (right - left) * progress;
}

function controlPoint(assignment: MatchPlayerAssignment): MatchPoint {
  const lateral = assignment.end.x - assignment.start.x;
  const vertical = assignment.end.y - assignment.start.y;
  if (assignment.kind === "route") {
    return { x: clamp(assignment.start.x + lateral * .34 + (lateral >= 0 ? 6 : -6)), y: clamp(assignment.start.y + vertical * .56) };
  }
  if (assignment.kind === "carry" || assignment.kind === "handoff") {
    return { x: clamp(assignment.start.x + lateral * .18), y: clamp(assignment.start.y + vertical * .58) };
  }
  if (assignment.kind === "rush" || assignment.kind === "contain") {
    return { x: clamp(assignment.start.x + lateral * .5), y: clamp(assignment.start.y + vertical * .35) };
  }
  if (assignment.kind === "zone-coverage" || assignment.kind === "man-coverage") {
    return { x: clamp(assignment.start.x + lateral * .62), y: clamp(assignment.start.y + vertical * .38) };
  }
  return { x: mix(assignment.start.x, assignment.end.x, .5), y: mix(assignment.start.y, assignment.end.y, .5) };
}

function pointOnPath(assignment: MatchPlayerAssignment, progress: number): MatchPoint {
  const control = controlPoint(assignment);
  const inverse = 1 - progress;
  return {
    x: clamp(inverse * inverse * assignment.start.x + 2 * inverse * progress * control.x + progress * progress * assignment.end.x),
    y: clamp(inverse * inverse * assignment.start.y + 2 * inverse * progress * control.y + progress * progress * assignment.end.y),
  };
}

function phaseProgress(phase: MatchPlaybackPhase, assignment: MatchPlayerAssignment): number {
  if (phase === "pre-snap") return 0;
  if (phase === "snap") return assignment.kind === "pass-read" || assignment.kind === "handoff" || assignment.kind === "long-snap" ? .18 : .07;
  if (phase === "develop") return assignment.kind === "run-block" || assignment.kind === "pass-protection" || assignment.kind === "kick-protection" ? .68 : .48;
  if (phase === "action") return .75;
  if (phase === "contact") return .92;
  return 1;
}

function routePath(assignment: MatchPlayerAssignment): string {
  const control = controlPoint(assignment);
  return `M ${assignment.start.x} ${assignment.start.y} Q ${control.x} ${control.y} ${assignment.end.x} ${assignment.end.y}`;
}

function ballPoint(episode: MatchEpisode, result: MatchEpisodeResult | undefined, phase: MatchPlaybackPhase): MatchPoint {
  const snapper = episode.assignments.find((assignment) => assignment.slot === "C" || assignment.slot === "LS");
  const quarterback = episode.assignments.find((assignment) => assignment.slot === "QB" || assignment.kind === "pass-read" || assignment.kind === "handoff");
  const targetSlot = result?.targetSlot ?? episode.playCall.primarySlot ?? episode.opponentCall.primarySlot;
  const target = episode.assignments.find((assignment) => assignment.slot === targetSlot && assignment.unit === "offense");
  const carrierSlot = result?.ballCarrierSlot ?? episode.assignments.find((assignment) => assignment.kind === "carry")?.slot;
  const carrier = episode.assignments.find((assignment) => assignment.slot === carrierSlot && assignment.unit === "offense");
  const specialist = episode.assignments.find((assignment) => assignment.kind === "kick" || assignment.kind === "punt");
  const origin = snapper?.start ?? quarterback?.start ?? specialist?.start ?? { x: 50, y: 58 };
  if (phase === "pre-snap") return origin;
  if (phase === "snap") return quarterback?.start ?? specialist?.start ?? origin;
  if (phase === "develop") return quarterback ? pointOnPath(quarterback, .38) : specialist ? pointOnPath(specialist, .42) : origin;
  const receiver = specialist ?? carrier ?? target ?? quarterback;
  if (!receiver) return origin;
  const base = pointOnPath(receiver, phase === "action" ? .7 : phase === "contact" ? .92 : 1);
  if (phase !== "result" || !result) return base;
  return { x: base.x, y: clamp(base.y - result.yards * .52) };
}

function phaseLabel(phase: MatchPlaybackPhase): string {
  return { "pre-snap": "PRE-SNAP", snap: "SNAP", develop: "РАЗВИТИЕ", action: "МЯЧ В ИГРЕ", contact: "КОНТАКТ", result: "РЕЗУЛЬТАТ" }[phase];
}

export function MatchField({ episode, result, phase, analysisMode }: MatchFieldProps) {
  const offense = episode.assignments.filter((assignment) => assignment.unit === "offense");
  const lineOfScrimmage = offense.length > 0 ? offense.reduce((sum, assignment) => sum + assignment.start.y, 0) / offense.length : 58;
  const firstDownLine = clamp(lineOfScrimmage - episode.distance * .54);
  const ball = ballPoint(episode, result, phase);
  const ballStyle = { left: `${ball.x}%`, top: `${ball.y}%` } as CSSProperties;
  const resultText = result
    ? result.snapResult === "touchdown" || result.snapResult === "defensive-touchdown"
      ? "TOUCHDOWN"
      : result.firstDown
        ? `${result.yards >= 0 ? "+" : ""}${result.yards} YD · FIRST DOWN`
        : `${result.yards >= 0 ? "+" : ""}${result.yards} YD`
    : undefined;

  return (
    <section className={`match-field match-field--${phase}`} aria-label="Плавное воспроизведение розыгрыша">
      <div className="match-field__yard-grid" />
      <div className="match-field__endzone match-field__endzone--away">END ZONE</div>
      <div className="match-field__endzone match-field__endzone--home">END ZONE</div>
      <div className="match-field__los" style={{ top: `${lineOfScrimmage}%` }}><span>LOS</span></div>
      <div className="match-field__first-down" style={{ top: `${firstDownLine}%` }}><span>1ST</span></div>
      <svg className="match-field__routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {episode.assignments.filter((assignment) => analysisMode || assignment.isHero || ["route", "carry", "rush"].includes(assignment.kind)).map((assignment) => (
          <path key={`route-${assignment.id}`} d={routePath(assignment)} className={`match-field-route match-field-route--${assignment.unit}${assignment.isHero ? " is-hero" : ""}`} />
        ))}
      </svg>
      <i className="match-field__ball" style={ballStyle} />
      {episode.assignments.map((assignment) => {
        const point = pointOnPath(assignment, phaseProgress(phase, assignment));
        const style = { left: `${point.x}%`, top: `${point.y}%`, transitionDelay: `${Math.min(160, assignment.delayMs)}ms` } as CSSProperties;
        return (
          <span key={assignment.id} className={`match-field-player match-field-player--${assignment.unit}${assignment.isHero ? " is-hero" : ""}`} style={style} title={`${assignment.playerName ?? assignment.slot} · ${assignment.position}: ${assignment.task}`}>
            {assignment.isHero ? episode.position : assignment.label}
          </span>
        );
      })}
      <div className="match-field__phase">{phaseLabel(phase)}</div>
      {phase === "result" && result && (
        <div className={`match-field__result is-${result.grade.toLowerCase()}`}>
          <strong>{resultText}</strong><span>{result.headline}</span><small>Мяч: {result.startFieldPosition} → {result.endFieldPosition}</small>
        </div>
      )}
    </section>
  );
}
