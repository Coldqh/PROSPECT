import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { FootballPosition } from "../../sports/football/career/types";
import {
  createLivePlayEngine,
  issueLivePlayCommand,
  liveReceiverTargets,
  liveRoleActions,
  stepLivePlayEngine,
  type LiveControlInput,
  type LivePlayCommand,
  type LivePlayEngineState,
  type MatchLivePlayOutcome,
} from "../../sports/football/matches/realTimeEngine";
import type { MatchEpisode } from "../../sports/football/matches/types";

interface RealTimeMatchFieldProps {
  episode: MatchEpisode;
  heroPosition: FootballPosition;
  analysisMode: boolean;
  disabled: boolean;
  seed: string;
  onComplete(outcome: MatchLivePlayOutcome): Promise<void>;
}

interface HudState {
  phase: LivePlayEngineState["phase"];
  elapsed: number;
  pressure: boolean;
  runCommitted: boolean;
  latestEvent?: string;
  outcome?: MatchLivePlayOutcome;
}

const EMPTY_INPUT: LiveControlInput = { moveX: 0, moveY: 0 };

function roleHint(position: FootballPosition): string {
  if (position === "QB") return "WASD или крестовина — двигаться. Нажми на ресивера, чтобы бросить. За линией скримиджа пас недоступен.";
  if (position === "RB") return "Выбирай гэп движением. Рывок даёт скорость, финт помогает уйти от первого защитника.";
  if (position === "WR" || position === "TE") return "Сам веди маршрут. Ускоряйся на прямой, срезай на брейке, готовь приём кнопкой «Ловить».";
  if (position === "OT" || position === "OG" || position === "C") return "Держи позицию между защитником и QB. Силовой блок двигает соперника, якорь держит карман.";
  if (position === "EDGE" || position === "DT") return "Обходи блок движением. Speed rush атакует край, power rush пробивает напрямую.";
  if (position === "LB" || position === "CB" || position === "S") return "Следи за мячом и своим игроком. К мячу — резкий брейк, тэкл — контакт, перехват — игра на пас.";
  return "Дождись точного окна и нажми кнопку удара.";
}

function drawField(canvas: HTMLCanvasElement, engine: LivePlayEngineState, analysisMode: boolean): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(390, Math.round(rect.height));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const px = (value: number) => value / 100 * width;
  const py = (value: number) => value / 100 * height;

  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#123523");
  background.addColorStop(1, "#071d14");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(0,0,0,.25)";
  context.fillRect(0, 0, width, py(6));
  context.fillRect(0, py(94), width, py(6));

  context.strokeStyle = "rgba(255,255,255,.16)";
  context.lineWidth = 1;
  for (let yard = 10; yard < 100; yard += 10) {
    context.beginPath();
    context.moveTo(0, py(yard));
    context.lineTo(width, py(yard));
    context.stroke();
  }
  context.setLineDash([5, 7]);
  for (const hash of [34, 66]) {
    context.beginPath();
    context.moveTo(px(hash), 0);
    context.lineTo(px(hash), height);
    context.stroke();
  }
  context.setLineDash([]);

  context.strokeStyle = "#4399ff";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, py(engine.lineOfScrimmage));
  context.lineTo(width, py(engine.lineOfScrimmage));
  context.stroke();

  context.strokeStyle = "#f4dc55";
  context.beginPath();
  context.moveTo(0, py(engine.firstDownY));
  context.lineTo(width, py(engine.firstDownY));
  context.stroke();

  if (analysisMode || engine.phase === "pre-snap") {
    context.setLineDash([4, 5]);
    context.lineWidth = 1.2;
    for (const player of engine.players) {
      if (!player.isHero && !analysisMode) continue;
      if (player.route.length === 0) continue;
      context.strokeStyle = player.isHero ? "rgba(255,73,94,.95)" : player.unit === "offense" ? "rgba(255,255,255,.28)" : "rgba(255,115,115,.24)";
      context.beginPath();
      context.moveTo(px(player.startX), py(player.startY));
      for (const point of player.route) context.lineTo(px(point.x), py(point.y));
      context.stroke();
    }
    context.setLineDash([]);
  }

  for (const player of engine.players) {
    const radius = player.isHero ? 13 : 10;
    context.beginPath();
    context.arc(px(player.x), py(player.y), radius, 0, Math.PI * 2);
    context.fillStyle = player.isHero ? "#ef3e52" : player.unit === "defense" ? "#8d2633" : player.unit === "special" ? "#55436d" : "#172438";
    context.fill();
    context.lineWidth = player.isHero ? 3 : 1.6;
    context.strokeStyle = player.hasBall ? "#f6dd68" : "rgba(255,255,255,.88)";
    context.stroke();
    if (player.down) {
      context.strokeStyle = "rgba(255,255,255,.75)";
      context.beginPath();
      context.moveTo(px(player.x) - 7, py(player.y) - 7);
      context.lineTo(px(player.x) + 7, py(player.y) + 7);
      context.stroke();
    }
    context.fillStyle = "#fff";
    context.font = `800 ${player.isHero ? 10 : 8}px Inter, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(player.isHero ? player.position : player.label, px(player.x), py(player.y) + 0.5);
  }

  context.save();
  context.translate(px(engine.ball.x), py(engine.ball.y) - engine.ball.z * 2.2);
  context.rotate(-0.25);
  context.fillStyle = "#7a3c20";
  context.strokeStyle = "#fff";
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  const latest = engine.events[engine.events.length - 1];
  if (latest && engine.phase !== "pre-snap") {
    const text = latest.text;
    context.font = "700 11px Inter, sans-serif";
    const textWidth = context.measureText(text).width;
    const boxWidth = Math.min(width - 24, textWidth + 22);
    context.fillStyle = "rgba(5,8,12,.84)";
    context.fillRect((width - boxWidth) / 2, 10, boxWidth, 28);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, 24, boxWidth - 12);
  }

  if (engine.outcome) {
    context.fillStyle = "rgba(3,6,10,.78)";
    context.fillRect(0, 0, width, height);
    context.textAlign = "center";
    context.fillStyle = engine.outcome.turnover ? "#ff6d7d" : "#fff";
    context.font = "900 24px Inter, sans-serif";
    const result = engine.outcome.snapResult === "touchdown"
      ? "TOUCHDOWN"
      : engine.outcome.turnover
        ? "TURNOVER"
        : `${engine.outcome.yards >= 0 ? "+" : ""}${engine.outcome.yards} YD`;
    context.fillText(result, width / 2, height / 2 - 10);
    context.fillStyle = "rgba(255,255,255,.76)";
    context.font = "600 12px Inter, sans-serif";
    context.fillText(engine.outcome.description, width / 2, height / 2 + 18, width - 42);
  }
}

export function RealTimeMatchField({ episode, heroPosition, analysisMode, disabled, seed, onComplete }: RealTimeMatchFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<LivePlayEngineState>(createLivePlayEngine(episode, heroPosition, seed));
  const keysRef = useRef(new Set<string>());
  const touchInputRef = useRef<LiveControlInput>({ ...EMPTY_INPUT });
  const completionRef = useRef<string | undefined>(undefined);
  const lastHudUpdateRef = useRef(0);
  const [hud, setHud] = useState<HudState>({ phase: "pre-snap", elapsed: 0, pressure: false, runCommitted: false });

  useEffect(() => {
    engineRef.current = createLivePlayEngine(episode, heroPosition, seed);
    completionRef.current = undefined;
    setHud({ phase: "pre-snap", elapsed: 0, pressure: false, runCommitted: false });
  }, [episode.id, heroPosition, seed]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", " "].includes(event.key)) event.preventDefault();
      keysRef.current.add(event.key.toLowerCase());
      if (event.key === " " && engineRef.current.phase === "pre-snap") issueLivePlayCommand(engineRef.current, { type: "snap" });
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const engine = engineRef.current;
      const keys = keysRef.current;
      const keyboardX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const keyboardY = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const input = keyboardX !== 0 || keyboardY !== 0 ? { moveX: keyboardX, moveY: keyboardY } : touchInputRef.current;
      const outcome = stepLivePlayEngine(engine, input, (now - previous) / 1000);
      previous = now;
      const canvas = canvasRef.current;
      if (canvas) drawField(canvas, engine, analysisMode);
      if (now - lastHudUpdateRef.current > 90 || outcome) {
        const latest = engine.events[engine.events.length - 1];
        const nextHud: HudState = {
          phase: engine.phase,
          elapsed: engine.elapsed,
          pressure: engine.pressureOccurred,
          runCommitted: engine.runCommitted,
        };
        if (latest) nextHud.latestEvent = latest.text;
        if (engine.outcome) nextHud.outcome = engine.outcome;
        setHud(nextHud);
        lastHudUpdateRef.current = now;
      }
      if (outcome && completionRef.current !== episode.id) {
        completionRef.current = episode.id;
        window.setTimeout(() => void onComplete(outcome), 900);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [analysisMode, episode.id, onComplete]);

  const actions = useMemo(() => liveRoleActions(heroPosition), [heroPosition]);
  const receivers = liveReceiverTargets(engineRef.current);
  const canThrow = heroPosition === "QB" && hud.phase !== "pre-snap" && !hud.runCommitted && !hud.outcome;

  const command = useCallback((value: LivePlayCommand) => {
    if (disabled) return;
    issueLivePlayCommand(engineRef.current, value);
    const engine = engineRef.current;
    setHud((current) => ({ ...current, phase: engine.phase, runCommitted: engine.runCommitted }));
  }, [disabled]);

  const setTouchDirection = useCallback((moveX: number, moveY: number) => {
    touchInputRef.current = { moveX, moveY };
  }, []);

  const clearTouchDirection = useCallback(() => {
    touchInputRef.current = { ...EMPTY_INPUT };
  }, []);

  const canvasClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!canThrow) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / rect.width * 100;
    const clickY = (event.clientY - rect.top) / rect.height * 100;
    const target = liveReceiverTargets(engineRef.current)
      .sort((left, right) => Math.hypot(left.x - clickX, left.y - clickY) - Math.hypot(right.x - clickX, right.y - clickY))[0];
    if (target && Math.hypot(target.x - clickX, target.y - clickY) < 9) command({ type: "throw", targetId: target.id });
  }, [canThrow, command]);

  return (
    <section className="live-football" aria-label="Игровой розыгрыш в реальном времени">
      <header className="live-football__header">
        <div><small>REAL-TIME SNAP</small><strong>{hud.phase === "pre-snap" ? "Готов к снэпу" : hud.outcome ? "Свисток" : `${hud.elapsed.toFixed(1)} сек`}</strong></div>
        <span className={hud.pressure ? "is-danger" : ""}>{hud.pressure ? "ДАВЛЕНИЕ" : hud.runCommitted ? "QB RUN" : episode.playCall.concept}</span>
      </header>
      <div className="live-football__canvas-wrap">
        <canvas ref={canvasRef} className="live-football__canvas" onClick={canvasClick} />
      </div>
      <p className="live-football__hint">{roleHint(heroPosition)}</p>

      {hud.phase === "pre-snap" ? (
        <button type="button" className="live-football__snap" disabled={disabled} onClick={() => command({ type: "snap" })}>СНЭП</button>
      ) : !hud.outcome ? (
        <div className="live-football__controls">
          <div className="live-dpad" aria-label="Направление движения">
            <button type="button" aria-label="Вверх" onPointerDown={() => setTouchDirection(0, -1)} onPointerUp={clearTouchDirection} onPointerCancel={clearTouchDirection}>↑</button>
            <button type="button" aria-label="Влево" onPointerDown={() => setTouchDirection(-1, 0)} onPointerUp={clearTouchDirection} onPointerCancel={clearTouchDirection}>←</button>
            <i />
            <button type="button" aria-label="Вправо" onPointerDown={() => setTouchDirection(1, 0)} onPointerUp={clearTouchDirection} onPointerCancel={clearTouchDirection}>→</button>
            <button type="button" aria-label="Вниз" onPointerDown={() => setTouchDirection(0, 1)} onPointerUp={clearTouchDirection} onPointerCancel={clearTouchDirection}>↓</button>
          </div>
          <div className="live-role-actions">
            {canThrow && <div className="live-receiver-buttons">{receivers.map((receiver) => <button type="button" key={receiver.id} onClick={() => command({ type: "throw", targetId: receiver.id })}><strong>{receiver.slot}</strong><span>{receiver.label}</span></button>)}</div>}
            <div className="live-role-actions__main">{actions.map((action) => <button type="button" key={action.id} disabled={disabled} onClick={() => command({ type: action.id } as LivePlayCommand)}>{action.label}</button>)}</div>
          </div>
        </div>
      ) : (
        <div className="live-football__result"><strong>{hud.outcome.yards >= 0 ? "+" : ""}{hud.outcome.yards} YD</strong><span>{hud.outcome.description}</span><small>Розыгрыш фиксируется…</small></div>
      )}
    </section>
  );
}
