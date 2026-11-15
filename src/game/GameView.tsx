import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { SeaAudio } from "@/game/audio";
import { loadBank, type Bank } from "@/game/assets";
import { drawGame } from "@/game/draw";
import { readSave } from "@/game/save";
import { ROUNDS } from "@/game/specs";
import {
  continueDive,
  createGame,
  resizeGame,
  retryRound,
  startDive,
  stepGame,
  surface,
  togglePause,
} from "@/game/sim";
import type { Game, Input, Phase } from "@/game/types";

type Snap = {
  phase: Phase;
  round: number;
  roundName: string;
  tease: string;
  depth: number;
  goal: number;
  totalDepth: number;
  pearls: number;
  hull: number;
  maxHull: number;
  shield: boolean;
  boost: number;
  calm: number;
  magnet: number;
  banner: string;
  bestDepth: number;
  bestPearls: number;
};

const INITIAL: Snap = {
  phase: "title",
  round: 0,
  roundName: ROUNDS[0].name,
  tease: ROUNDS[0].tease,
  depth: 0,
  goal: ROUNDS[0].goal,
  totalDepth: 0,
  pearls: 0,
  hull: 3,
  maxHull: 3,
  shield: false,
  boost: 0,
  calm: 0,
  magnet: 0,
  banner: "",
  bestDepth: 0,
  bestPearls: 0,
};

function toSnap(g: Game): Snap {
  const round = ROUNDS[g.round] ?? ROUNDS[0];
  return {
    phase: g.phase,
    round: g.round,
    roundName: round.name,
    tease: round.tease,
    depth: g.depth,
    goal: round.goal,
    totalDepth: g.totalDepth,
    pearls: g.pearls,
    hull: g.hull,
    maxHull: g.maxHull,
    shield: g.shield,
    boost: g.boost,
    calm: g.calm,
    magnet: g.magnet,
    banner: g.banner,
    bestDepth: g.bestDepth,
    bestPearls: g.bestPearls,
  };
}

function signature(g: Game) {
  return [
    g.phase,
    g.round,
    g.hull,
    g.pearls,
    g.shield ? 1 : 0,
    Math.floor(g.totalDepth),
    Math.floor(g.depth),
    Math.ceil(g.boost),
    Math.ceil(g.calm),
    Math.ceil(g.magnet),
    g.banner,
    Math.floor(g.bestDepth),
    g.bestPearls,
  ].join("|");
}

function readInput(keys: Set<string>, pointerX: number | null): Input {
  return {
    left: keys.has("KeyA") || keys.has("ArrowLeft"),
    right: keys.has("KeyD") || keys.has("ArrowRight"),
    pointerX,
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getSpeed: () => number;
      getYaw: () => number;
      setKeys: (codes: string[]) => void;
      setSteer: (v: number) => void;
    };
  }
}

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const keysRef = useRef(new Set<string>());
  const pointerRef = useRef<number | null>(null);
  const audioRef = useRef<SeaAudio | null>(null);
  const spritesRef = useRef<Bank | null>(null);
  const [snap, setSnap] = useState<Snap>(INITIAL);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = new SeaAudio();
    audioRef.current = audio;
    setMuted(audio.loadMute());
    const game = createGame(360, 640);
    const save = readSave();
    game.bestDepth = save.bestDepth;
    game.bestPearls = save.bestPearls;
    game.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gameRef.current = game;

    let dead = false;
    void loadBank().then((bank) => {
      if (!dead) spritesRef.current = bank;
    });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    const dprRef = { value: 1 };
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.value = dpr;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      resizeGame(game, rect.width, rect.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "Space") {
        event.preventDefault();
      }
      keysRef.current.add(event.code);
      if (event.code === "KeyP" || event.code === "Escape") togglePause(game);
      if (event.code === "KeyM") setMuted(audio.toggleMute());
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const onBlur = () => {
      keysRef.current.clear();
      pointerRef.current = null;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    const onVis = () => {
      if (document.visibilityState === "visible") audio.resume();
    };
    document.addEventListener("visibilitychange", onVis);

    if (import.meta.env.DEV) {
      window.__controlsTest = {
        getX: () => game.sub.x,
        getSpeed: () => (game.phase === "playing" ? game.sink : 0),
        getYaw: () => 0,
        setKeys: (codes) => {
          keysRef.current = new Set(codes);
        },
        setSteer: (steer) => {
          const next = new Set<string>();
          if (steer < -0.05) next.add("KeyA");
          if (steer > 0.05) next.add("KeyD");
          keysRef.current = next;
        },
      };
    }

    let last = performance.now();
    let acc = 0;
    let sig = "";
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      const frame = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += frame;
      if (game.phase !== "playing") pointerRef.current = null;
      const input = readInput(keysRef.current, pointerRef.current);
      let guard = 0;
      while (acc >= 1 / 60 && guard < 4) {
        stepGame(game, input, 1 / 60);
        acc -= 1 / 60;
        guard += 1;
      }
      audio.consume(game.cues);
      game.cues.length = 0;
      if (game.phase === "playing" || game.phase === "pause") audio.mood(game.round);
      ctx.setTransform(dprRef.value, 0, 0, dprRef.value, 0, 0);
      drawGame(ctx, game, spritesRef.current);
      const next = signature(game);
      if (next !== sig) {
        sig = next;
        setSnap(toSnap(game));
      }
    };
    raf = requestAnimationFrame(loop);
    setSnap(toSnap(game));

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      if (import.meta.env.DEV) delete window.__controlsTest;
    };
  }, []);

  function dive() {
    const game = gameRef.current;
    const audio = audioRef.current;
    if (!game || !audio) return;
    audio.unlock();
    startDive(game);
    setSnap(toSnap(game));
  }

  function onward() {
    const game = gameRef.current;
    if (!game) return;
    audioRef.current?.unlock();
    continueDive(game);
    setSnap(toSnap(game));
  }

  function again() {
    const game = gameRef.current;
    if (!game) return;
    audioRef.current?.unlock();
    if (snap.phase === "win") startDive(game);
    else retryRound(game);
    setSnap(toSnap(game));
  }

  function back() {
    const game = gameRef.current;
    if (!game) return;
    surface(game);
    setSnap(toSnap(game));
  }

  function pause() {
    const game = gameRef.current;
    if (!game) return;
    togglePause(game);
    setSnap(toSnap(game));
  }

  function mute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.unlock();
    setMuted(audio.toggleMute());
  }

  const showHud = snap.phase === "playing" || snap.phase === "pause";
  const progress = Math.max(0, Math.min(1, snap.depth / snap.goal));
  const power =
    snap.boost > 0 ? "Swift ballast" : snap.calm > 0 ? "Calm water" : snap.magnet > 0 ? "Pearl tide" : snap.shield ? "Shield ready" : "";

  return (
    <main className="stage">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onPointerDown={(event) => {
          const game = gameRef.current;
          if (!game || game.phase !== "playing") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerRef.current = event.nativeEvent.offsetX;
        }}
        onPointerMove={(event) => {
          if (pointerRef.current == null) return;
          pointerRef.current = event.nativeEvent.offsetX;
        }}
        onPointerUp={() => {
          pointerRef.current = null;
        }}
        onPointerCancel={() => {
          pointerRef.current = null;
        }}
      />

      <header
        className={`hud-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 ${showHud ? "bg-bg/80" : ""}`}
      >
        <div className="min-w-0">
          {showHud ? (
            <>
              <p className="text-sm font-bold tracking-wide text-muted">
                Depth {snap.round + 1} of {ROUNDS.length}
              </p>
              <p className="truncate font-display text-2xl leading-tight text-fg">{snap.roundName}</p>
              <p className="mt-1 text-sm tabular-nums text-fg">
                {Math.floor(snap.totalDepth)} m
                <span className="text-muted">
                  {" "}
                  · {snap.pearls} {snap.pearls === 1 ? "pearl" : "pearls"}
                </span>
              </p>
              <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
              </div>
            </>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {showHud ? (
            <div className="mr-1 flex gap-1" aria-label={`Hull ${snap.hull} of ${snap.maxHull}`}>
              {Array.from({ length: snap.maxHull }, (_, i) => (
                <span
                  key={i}
                  className={i < snap.hull ? "h-3 w-3 rounded-full bg-primary" : "h-3 w-3 rounded-full bg-border"}
                />
              ))}
            </div>
          ) : null}
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={mute}
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-fg"
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          {showHud ? (
            <button
              type="button"
              aria-label={snap.phase === "pause" ? "Resume" : "Pause"}
              onClick={pause}
              className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-fg"
            >
              {snap.phase === "pause" ? <Play size={20} /> : <Pause size={20} />}
            </button>
          ) : null}
        </div>
      </header>

      {showHud && (power || snap.banner) ? (
        <p className="pointer-events-none absolute top-28 left-1/2 z-10 -translate-x-1/2 rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-accent">
          {snap.banner || power}
        </p>
      ) : null}

      {showHud ? (
        <p className="hud-safe pointer-events-none absolute inset-x-0 bottom-0 z-10 text-center">
          <span className="inline-block rounded-full bg-bg/80 px-3 py-1 text-sm text-fg">
            A left · D right · hold a side
          </span>
        </p>
      ) : null}

      {snap.phase === "title" ? (
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-16">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface/90 px-6 py-7 backdrop-blur-md">
            <p className="text-sm font-bold tracking-widest text-primary">Five quiet depths</p>
            <h1 className="mt-1 font-display text-4xl leading-tight text-fg sm:text-5xl">Lumen Drift</h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              She sinks on her own. Steer left and right, slip past the sea life, and bring her to the chest
              at the bottom of the trench.
            </p>
            <button
              type="button"
              onClick={dive}
              className="mt-6 h-12 w-full rounded-full bg-primary text-lg font-bold text-primary-fg"
            >
              Begin the dive
            </button>
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="pearl-icon" aria-hidden="true">
                  <img src="/game/props.png" alt="" />
                </span>
                Best {snap.bestPearls > 0 ? `${snap.bestPearls} pearls` : "—"}
              </span>
              <span className="tabular-nums">
                {snap.bestDepth > 1 ? `${Math.floor(snap.bestDepth)} m` : "—"}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted">A left · D right · or hold either side of the sea.</p>
          </div>
        </div>
      ) : null}

      {snap.phase === "round" ? (
        <Overlay
          kicker={`${snap.roundName} rests`}
          title="The water changes"
          body={snap.tease}
          action="Sink onward"
          onAction={onward}
        />
      ) : null}

      {snap.phase === "fail" ? (
        <Overlay
          kicker="A warm current"
          title="The hull sighed"
          body={`You are lifted to the start of ${snap.roundName}. The pearls you gathered stay with you.`}
          action="Try this depth"
          onAction={again}
          secondary="Surface"
          onSecondary={back}
        />
      ) : null}

      {snap.phase === "win" ? (
        <Overlay
          kicker="Treasure trench"
          title="The chest opens"
          body={`The little sub brought home ${snap.pearls} pearls through ${Math.floor(snap.totalDepth)} meters of quiet water.`}
          action="Dive again"
          onAction={again}
          secondary="Surface"
          onSecondary={back}
        />
      ) : null}

      {snap.phase === "pause" ? (
        <Overlay
          kicker="Holding still"
          title="The sea waits"
          body="She will keep sinking when you are ready. Nothing down here is in a hurry."
          action="Resume"
          onAction={pause}
          secondary="Surface"
          onSecondary={back}
        />
      ) : null}
    </main>
  );
}

function Overlay({
  kicker,
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  kicker: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-bg/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface px-6 py-7">
        <p className="text-sm font-bold tracking-wide text-primary">{kicker}</p>
        <h2 className="mt-1 font-display text-4xl leading-tight text-fg">{title}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted">{body}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-6 h-12 w-full rounded-full bg-primary text-lg font-bold text-primary-fg"
        >
          {action}
        </button>
        {secondary && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className="mt-3 h-12 w-full rounded-full border border-border text-base font-bold text-fg"
          >
            {secondary}
          </button>
        ) : null}
      </div>
    </div>
  );
}
