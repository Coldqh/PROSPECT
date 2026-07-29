import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { FootballPosition } from "../../sports/football/career/types";
import {
  createLivePlayEngine,
  issueLivePlayCommand,
  liveFieldViewport,
  liveHeroControlActive,
  liveReceiverTargets,
  liveRoleActions,
  liveWorldToFieldYard,
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
  fieldYard: number;
  gameClockSeconds: number;
  controlActive: boolean;
  latestEvent?: string;
  outcome?: MatchLivePlayOutcome;
}

interface JoystickState {
  x: number;
  y: number;
  active: boolean;
}

const EMPTY_INPUT: LiveControlInput = { moveX: 0, moveY: 0 };
const EMPTY_JOYSTICK: JoystickState = { x: 0, y: 0, active: false };

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function downLabel(down: number): string {
  return ["", "1ST", "2ND", "3RD", "4TH"][down] ?? `${down}TH`;
}

function fieldSpotLabel(yard: number): string {
  const spot = Math.max(0, Math.min(100, Math.round(yard)));
  if (spot === 50) return "50";
  if (spot < 50) return `OWN ${spot}`;
  return `OPP ${100 - spot}`;
}

function roleHint(position: FootballPosition): string {
  if (position === "QB") return "Стрелки — движение в кармане. Нажми кнопку ресивера для паса. После пересечения линии скримиджа остаётся только бег.";
  if (position === "RB") return "Выбирай настоящий гэп движением. Рывок даёт скорость, финт помогает уйти от первого защитника.";
  if (position === "WR" || position === "TE") return "Сам веди маршрут. Ускоряйся на прямой, срезай на брейке, готовь приём кнопкой «Ловить».";
  if (position === "OT" || position === "OG" || position === "C") return "Держи корпус между защитником и QB. Силовой блок двигает соперника, якорь удерживает карман.";
  if (position === "EDGE" || position === "DT") return "Обходи блок движением. Speed rush атакует край, power rush пробивает напрямую.";
  if (position === "LB" || position === "CB" || position === "S") return "Следи за мячом и своей зоной. Брейк ускоряет реакцию, тэкл завершает контакт, перехват — игра на летящий мяч.";
  return "Дождись точного окна и нажми кнопку удара.";
}

function controlHint(position: FootballPosition, active: boolean): string {
  if (active) return `${roleHint(position)} Отпусти управление — игрок сразу продолжит назначение сам.`;
  return `Игрок сам выполняет назначение. Коснись джойстика или нажми стрелку, чтобы вмешаться. ${roleHint(position)}`;
}

function resultTitle(outcome: MatchLivePlayOutcome): string {
  if (outcome.snapResult === "touchdown") return "TOUCHDOWN";
  if (outcome.snapResult === "defensive-touchdown") return "PICK SIX";
  if (outcome.snapResult === "sack") return "SACK";
  if (outcome.turnover) return "TURNOVER";
  if (outcome.firstDown) return "FIRST DOWN";
  if (outcome.snapResult === "incomplete") return "INCOMPLETE";
  return `${outcome.yards >= 0 ? "+" : ""}${outcome.yards} YD`;
}

function fieldTransform(engine: LivePlayEngineState, width: number, height: number) {
  const viewport = liveFieldViewport(engine);
  const px = (value: number) => value / 100 * width;
  const pyField = (fieldYard: number) => (viewport.highFieldYard - fieldYard) / viewport.spanYards * height;
  const pyWorld = (worldY: number) => pyField(liveWorldToFieldYard(engine, worldY));
  return { viewport, px, pyField, pyWorld };
}

function drawField(canvas: HTMLCanvasElement, engine: LivePlayEngineState, analysisMode: boolean): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(500, Math.round(rect.height));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const { viewport, px, pyField, pyWorld } = fieldTransform(engine, width, height);
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#123d27");
  background.addColorStop(1, "#071d14");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  for (const goal of [0, 100]) {
    if (goal < viewport.lowFieldYard || goal > viewport.highFieldYard) continue;
    const goalY = pyField(goal);
    context.fillStyle = "rgba(7,10,16,.46)";
    if (goal === 100) context.fillRect(0, 0, width, Math.max(0, goalY));
    else context.fillRect(0, goalY, width, height - goalY);
  }

  context.strokeStyle = "rgba(255,255,255,.52)";
  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, height - 2);

  const firstYard = Math.max(0, Math.floor(viewport.lowFieldYard / 5) * 5);
  const lastYard = Math.min(100, Math.ceil(viewport.highFieldYard / 5) * 5);
  for (let yard = firstYard; yard <= lastYard; yard += 5) {
    const y = pyField(yard);
    if (y < -2 || y > height + 2) continue;
    context.strokeStyle = yard % 10 === 0 ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.18)";
    context.lineWidth = yard % 10 === 0 ? 1.3 : 1;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();

    for (const hashX of [34, 66]) {
      context.beginPath();
      context.moveTo(px(hashX) - 7, y);
      context.lineTo(px(hashX) + 7, y);
      context.stroke();
    }

    if (yard % 10 === 0) {
      const fieldNumber = yard <= 50 ? yard : 100 - yard;
      context.fillStyle = "rgba(255,255,255,.58)";
      context.font = "800 14px Inter, sans-serif";
      context.textBaseline = "middle";
      context.textAlign = "left";
      context.fillText(String(fieldNumber), 12, y);
      context.textAlign = "right";
      context.fillText(String(fieldNumber), width - 12, y);
    }
  }

  const scrimmageFieldYard = engine.episode.fieldPosition;
  const firstDownFieldYard = Math.min(100, engine.episode.fieldPosition + engine.episode.distance);
  context.strokeStyle = "#4399ff";
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(0, pyField(scrimmageFieldYard));
  context.lineTo(width, pyField(scrimmageFieldYard));
  context.stroke();

  context.strokeStyle = "#f4dc55";
  context.beginPath();
  context.moveTo(0, pyField(firstDownFieldYard));
  context.lineTo(width, pyField(firstDownFieldYard));
  context.stroke();

  if (analysisMode || engine.phase === "pre-snap") {
    context.setLineDash([4, 5]);
    context.lineWidth = 1.2;
    for (const player of engine.players) {
      if (!player.isHero && !analysisMode) continue;
      if (player.route.length === 0) continue;
      context.strokeStyle = player.isHero ? "rgba(255,73,94,.95)" : player.unit === "offense" ? "rgba(255,255,255,.28)" : "rgba(255,115,115,.24)";
      context.beginPath();
      context.moveTo(px(player.startX), pyWorld(player.startY));
      for (const point of player.route) context.lineTo(px(point.x), pyWorld(point.y));
      context.stroke();
    }
    context.setLineDash([]);
  }

  for (const player of engine.players) {
    const screenY = pyWorld(player.y);
    if (screenY < -25 || screenY > height + 25) continue;
    const radius = player.isHero ? 13 : 10;
    context.beginPath();
    context.arc(px(player.x), screenY, radius, 0, Math.PI * 2);
    context.fillStyle = player.isHero ? "#ef3e52" : player.unit === "defense" ? "#b82f42" : player.unit === "special" ? "#74529a" : "#2f78d0";
    context.fill();
    context.lineWidth = player.isHero ? 3 : 1.6;
    context.strokeStyle = player.hasBall ? "#f6dd68" : "rgba(255,255,255,.88)";
    context.stroke();
    if (player.down) {
      context.strokeStyle = "rgba(255,255,255,.75)";
      context.beginPath();
      context.moveTo(px(player.x) - 7, screenY - 7);
      context.lineTo(px(player.x) + 7, screenY + 7);
      context.stroke();
    }
    context.fillStyle = "#fff";
    context.font = `800 ${player.isHero ? 10 : 8}px Inter, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(player.isHero ? player.position : player.label, px(player.x), screenY + 0.5);
  }

  const ballY = pyWorld(engine.ball.y) - engine.ball.z * 2.2;
  if (ballY > -20 && ballY < height + 20) {
    context.save();
    context.translate(px(engine.ball.x), ballY);
    context.rotate(-0.25);
    context.fillStyle = "#7a3c20";
    context.strokeStyle = "#fff";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  context.fillStyle = "rgba(3,7,11,.9)";
  context.fillRect(8, 8, width - 16, 42);
  context.fillStyle = "#fff";
  context.textBaseline = "middle";
  context.font = "900 13px Inter, sans-serif";
  context.textAlign = "left";
  context.fillText(`Q${engine.episode.quarter}  ${clockLabel(Math.max(0, engine.episode.clockSeconds - Math.floor(engine.elapsed)))}`, 18, 29);
  context.textAlign = "center";
  context.fillText(`${downLabel(engine.episode.down)} & ${engine.episode.distance}`, width / 2, 29);
  context.textAlign = "right";
  context.fillText(fieldSpotLabel(liveWorldToFieldYard(engine, engine.ball.y)), width - 18, 29);

  const latest = engine.events[engine.events.length - 1];
  if (latest && engine.phase !== "pre-snap" && !engine.outcome) {
    const text = latest.text;
    context.font = "700 11px Inter, sans-serif";
    const textWidth = context.measureText(text).width;
    const boxWidth = Math.min(width - 24, textWidth + 22);
    context.fillStyle = "rgba(5,8,12,.84)";
    context.fillRect((width - boxWidth) / 2, height - 42, boxWidth, 30);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.fillText(text, width / 2, height - 27, boxWidth - 12);
  }

}

export function RealTimeMatchField({ episode, heroPosition, analysisMode, disabled, seed, onComplete }: RealTimeMatchFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const activePointerRef = useRef<number | undefined>(undefined);
  const engineRef = useRef<LivePlayEngineState>(createLivePlayEngine(episode, heroPosition, seed));
  const keysRef = useRef(new Set<string>());
  const touchInputRef = useRef<LiveControlInput>({ ...EMPTY_INPUT });
  const completionRef = useRef<string | undefined>(undefined);
  const lastHudUpdateRef = useRef(0);
  const [joystick, setJoystick] = useState<JoystickState>(EMPTY_JOYSTICK);
  const [hud, setHud] = useState<HudState>({
    phase: "pre-snap",
    elapsed: 0,
    pressure: false,
    runCommitted: false,
    fieldYard: episode.fieldPosition,
    gameClockSeconds: episode.clockSeconds,
    controlActive: false,
  });

  useEffect(() => {
    engineRef.current = createLivePlayEngine(episode, heroPosition, seed);
    completionRef.current = undefined;
    touchInputRef.current = { ...EMPTY_INPUT };
    setJoystick(EMPTY_JOYSTICK);
    setHud({
      phase: "pre-snap",
      elapsed: 0,
      pressure: false,
      runCommitted: false,
      fieldYard: episode.fieldPosition,
      gameClockSeconds: episode.clockSeconds,
      controlActive: false,
    });
  }, [episode.id, episode.fieldPosition, seed]);


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
      const manualInput = keyboardX !== 0 || keyboardY !== 0 ? { moveX: keyboardX, moveY: keyboardY } : touchInputRef.current;
      const controlActive = liveHeroControlActive(manualInput);
      const input = controlActive ? manualInput : EMPTY_INPUT;
      const outcome = stepLivePlayEngine(engine, input, (now - previous) / 1000);
      previous = now;
      const canvas = canvasRef.current;
      if (canvas) drawField(canvas, engine, analysisMode);
      if (now - lastHudUpdateRef.current > 80 || outcome) {
        const latest = engine.events[engine.events.length - 1];
        const nextHud: HudState = {
          phase: engine.phase,
          elapsed: engine.elapsed,
          pressure: engine.pressureOccurred,
          runCommitted: engine.runCommitted,
          fieldYard: liveWorldToFieldYard(engine, engine.ball.y),
          gameClockSeconds: Math.max(0, episode.clockSeconds - Math.floor(engine.elapsed)),
          controlActive,
        };
        if (latest) nextHud.latestEvent = latest.text;
        if (engine.outcome) nextHud.outcome = engine.outcome;
        setHud(nextHud);
        lastHudUpdateRef.current = now;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [analysisMode, episode.id]);

  const actions = useMemo(() => liveRoleActions(heroPosition), [heroPosition]);
  const receivers = liveReceiverTargets(engineRef.current);
  const canThrow = heroPosition === "QB" && hud.phase === "live" && !hud.runCommitted && !hud.outcome;

  const command = useCallback((value: LivePlayCommand) => {
    if (disabled) return;
    issueLivePlayCommand(engineRef.current, value);
    const engine = engineRef.current;
    setHud((current) => ({ ...current, phase: engine.phase, runCommitted: engine.runCommitted }));
  }, [disabled]);

  const clearJoystick = useCallback(() => {
    activePointerRef.current = undefined;
    touchInputRef.current = { ...EMPTY_INPUT };
    setJoystick(EMPTY_JOYSTICK);
  }, []);

  const updateJoystick = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const base = joystickRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const radius = Math.max(28, Math.min(rect.width, rect.height) * 0.34);
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(rawX, rawY);
    const scale = length > radius ? radius / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    touchInputRef.current = { moveX: x / radius, moveY: y / radius };
    setJoystick({ x, y, active: true });
  }, []);

  const joystickDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystick(event);
  }, [disabled, updateJoystick]);

  const joystickMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    updateJoystick(event);
  }, [updateJoystick]);

  const joystickUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    clearJoystick();
  }, [clearJoystick]);

  const canvasClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!canThrow) return;
    const engine = engineRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const { px, pyWorld } = fieldTransform(engine, rect.width, rect.height);
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const target = liveReceiverTargets(engine)
      .sort((left, right) => Math.hypot(px(left.x) - clickX, pyWorld(left.y) - clickY) - Math.hypot(px(right.x) - clickX, pyWorld(right.y) - clickY))[0];
    if (target && Math.hypot(px(target.x) - clickX, pyWorld(target.y) - clickY) < 38) command({ type: "throw", targetId: target.id });
  }, [canThrow, command]);

  const submitOutcome = useCallback(() => {
    if (!hud.outcome || completionRef.current === episode.id || disabled) return;
    completionRef.current = episode.id;
    void onComplete(hud.outcome);
  }, [disabled, episode.id, hud.outcome, onComplete]);

  return (
    <section className={`live-football${hud.controlActive ? " is-manual-override" : " is-autopilot"}`} aria-label="Игровой розыгрыш в реальном времени">
      <header className="live-football__header">
        <div><small>Q{episode.quarter} · {clockLabel(hud.gameClockSeconds)}</small><strong>{downLabel(episode.down)} & {episode.distance} · {fieldSpotLabel(hud.fieldYard)}</strong></div>
        <span className={hud.pressure ? "is-danger" : ""}>{hud.pressure ? "ДАВЛЕНИЕ" : `${hud.controlActive ? "РУЧНОЕ ВМЕШАТЕЛЬСТВО" : "АВТОМАРШРУТ"} · ${hud.runCommitted ? "QB RUN" : episode.playCall.concept}`}</span>
      </header>
      <div className="live-football__canvas-wrap">
        <canvas ref={canvasRef} className="live-football__canvas" onClick={canvasClick} />
        {hud.outcome && (
          <div className="live-snap-result-layer" role="presentation">
            <section className={`live-snap-result-dialog${hud.outcome.turnover ? " is-turnover" : ""}`} role="dialog" aria-modal="true" aria-label="Итог снэпа">
              <small>ИТОГ СНЭПА</small>
              <strong>{resultTitle(hud.outcome)}</strong>
              <div><span>{hud.outcome.yards >= 0 ? "+" : ""}{hud.outcome.yards} ярдов</span><span>{fieldSpotLabel(hud.outcome.endFieldPosition ?? episode.fieldPosition)}</span></div>
              <p>{hud.outcome.description}</p>
              <footer><span>Задание {Math.round(hud.outcome.assignmentScore)}</span><span>Команда {Math.round(hud.outcome.teamExecutionScore)}</span></footer>
              <button type="button" disabled={disabled} onClick={submitOutcome}>{disabled ? "Сохранение…" : "Следующий снэп"}</button>
            </section>
          </div>
        )}
      </div>
      <p className="live-football__hint">{controlHint(heroPosition, hud.controlActive)}</p>

      {hud.phase === "pre-snap" ? (
        <button type="button" className="live-football__snap" disabled={disabled} onClick={() => command({ type: "snap" })}>СНЭП</button>
      ) : !hud.outcome ? (
        <div className="live-football__controls">
          <div className="live-keyboard-guide" aria-label="Управление стрелками">
            <small>ПК · СТРЕЛКИ</small>
            <div><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div>
          </div>
          <div
            ref={joystickRef}
            className={`live-joystick${joystick.active ? " is-active" : ""}`}
            aria-label="Джойстик движения"
            onPointerDown={joystickDown}
            onPointerMove={joystickMove}
            onPointerUp={joystickUp}
            onPointerCancel={joystickUp}
          >
            <span style={{ transform: `translate(${joystick.x}px, ${joystick.y}px)` }} />
          </div>
          <div className="live-role-actions">
            {canThrow && <div className="live-receiver-buttons">{receivers.map((receiver) => <button type="button" key={receiver.id} onClick={() => command({ type: "throw", targetId: receiver.id })}><strong>{receiver.slot}</strong><span>{receiver.label}</span></button>)}</div>}
            <div className="live-role-actions__main">{actions.map((action) => <button type="button" key={action.id} disabled={disabled} onClick={() => command({ type: action.id } as LivePlayCommand)}>{action.label}</button>)}</div>
          </div>
          <div className={`live-football__autopilot-state${hud.controlActive ? " is-manual" : ""}`}>
            <span>{hud.controlActive ? "YOU" : "AI"}</span>
            <div><strong>{hud.controlActive ? "Ты управляешь движением" : "Игрок выполняет назначение"}</strong><small>{hud.controlActive ? "Отпусти джойстик — автоматика продолжит из текущей точки" : "Коснись джойстика в любой момент"}</small></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
