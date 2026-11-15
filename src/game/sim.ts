import { writeSave } from "@/game/save";
import { POWER_LABEL, ROUNDS, SPECS, SUB_R, pxPerMeter, worldScale } from "@/game/specs";
import type { Cue, Entity, Game, Input, Kind, Particle } from "@/game/types";

const POWERS: Kind[] = ["shield", "magnet", "boost", "calm", "patch"];

function rand(g: Game) {
  g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0;
  return g.rng / 4294967296;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function blankEntity(): Entity {
  return { active: false, kind: "pearl", x: 0, y: 0, homeX: 0, bob: 0 };
}

function blankParticle(): Particle {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 4,
    kind: "bubble",
    tint: 0,
  };
}

export function createGame(width: number, height: number): Game {
  return {
    phase: "title",
    round: 0,
    depth: 0,
    totalDepth: 0,
    roundStartTotal: 0,
    pearls: 0,
    hull: 3,
    maxHull: 3,
    sink: 0,
    time: 0,
    width,
    height,
    sub: { x: width / 2, y: height * 0.72, vx: 0, anim: 0, tilt: 0, iframe: 0, flash: 0 },
    shield: false,
    magnet: 0,
    boost: 0,
    calm: 0,
    shake: 0,
    celebrate: 0,
    banner: "",
    bannerT: 0,
    entities: Array.from({ length: 40 }, blankEntity),
    particles: Array.from({ length: 80 }, blankParticle),
    spawnMeter: 8,
    pearlMeter: 6,
    powerMeter: 48,
    safeX: width / 2,
    safeTarget: width / 2,
    safeRetarget: 0,
    rng: 0x1a2b3c4d,
    chestSpawned: false,
    bubbleAcc: 0,
    bestDepth: 0,
    bestPearls: 0,
    lastSave: 0,
    reduceMotion: false,
    cues: [],
  };
}

export function resizeGame(g: Game, width: number, height: number) {
  const prev = g.width;
  g.width = Math.max(1, width);
  g.height = Math.max(1, height);
  if (prev > 1) g.sub.x = clamp((g.sub.x / prev) * g.width, 30, g.width - 30);
  else g.sub.x = g.width / 2;
  g.safeX = clamp((g.safeX / Math.max(prev, 1)) * g.width, g.width * 0.2, g.width * 0.8);
  g.safeTarget = clamp(g.safeTarget, g.width * 0.2, g.width * 0.8);
}

function sc(g: Game) {
  return worldScale(g.height);
}

function clearEntities(g: Game) {
  for (const e of g.entities) e.active = false;
}

function cue(g: Game, c: Cue) {
  if (g.cues.length < 8) g.cues.push(c);
}

function persist(g: Game, force = false) {
  let changed = false;
  if (g.totalDepth > g.bestDepth) {
    g.bestDepth = g.totalDepth;
    changed = true;
  }
  if (g.pearls > g.bestPearls) {
    g.bestPearls = g.pearls;
    changed = true;
  }
  if (!changed && !force) return;
  if (!force && g.time - g.lastSave < 1.4) return;
  g.lastSave = g.time;
  writeSave({ version: 1, bestDepth: g.bestDepth, bestPearls: g.bestPearls });
}

function spawnParticle(
  g: Game,
  x: number,
  y: number,
  kind: Particle["kind"],
  tint: number,
  speed = 1,
) {
  const p = g.particles.find((item) => !item.active);
  if (!p) return;
  p.active = true;
  p.x = x;
  p.y = y;
  p.vx = (rand(g) - 0.5) * 30 * speed;
  p.vy = kind === "bubble" ? -(18 + rand(g) * 36) : (rand(g) - 0.4) * 40 * speed;
  p.life = kind === "ring" ? 0.45 : 0.6 + rand(g) * 0.6;
  p.max = p.life;
  p.size = kind === "ring" ? 10 : 3 + rand(g) * 5;
  p.kind = kind;
  p.tint = tint;
}

function alloc(g: Game) {
  return g.entities.find((e) => !e.active) ?? null;
}

function place(g: Game, kind: Kind, x: number, y: number) {
  const e = alloc(g);
  if (!e) return null;
  e.active = true;
  e.kind = kind;
  e.x = x;
  e.y = y;
  e.homeX = x;
  e.bob = rand(g) * Math.PI * 2;
  return e;
}

function blocked(g: Game, x: number, y: number, radius: number) {
  const need = radius + 78 * sc(g);
  for (const e of g.entities) {
    if (!e.active || SPECS[e.kind].pickup) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const rr = need + SPECS[e.kind].r * sc(g);
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}

function pickX(g: Game, radius: number) {
  const margin = 24 * sc(g);
  const gap = 96 * sc(g);
  const minX = margin + radius;
  const maxX = g.width - margin - radius;
  if (maxX <= minX) return g.width / 2;
  const leftMax = g.safeX - gap - radius;
  const rightMin = g.safeX + gap + radius;
  const options: number[] = [];
  if (leftMax > minX) options.push(minX + rand(g) * (leftMax - minX));
  if (rightMin < maxX) options.push(rightMin + rand(g) * (maxX - rightMin));
  if (options.length === 0) return g.safeX > g.width / 2 ? minX : maxX;
  const spawnY = g.height + radius + 24;
  const open = options.filter((x) => !blocked(g, x, spawnY, radius));
  const pool = open.length > 0 ? open : options;
  return pool[Math.floor(rand(g) * pool.length)] ?? g.width / 2;
}

function spawnKind(g: Game, kind: Kind, x: number) {
  const spec = SPECS[kind];
  const radius = spec.r * sc(g);
  const y = g.height + (spec.h * sc(g)) / 2 + 12;
  return place(g, kind, x, y);
}

function spawnObstacle(g: Game) {
  const table = ROUNDS[g.round]?.weights ?? ROUNDS[0].weights;
  let total = 0;
  for (const row of table) total += row.w;
  let roll = rand(g) * total;
  let kind: Kind = table[0]?.kind ?? "fish";
  for (const row of table) {
    roll -= row.w;
    if (roll <= 0) {
      kind = row.kind;
      break;
    }
  }
  const radius = SPECS[kind].r * sc(g);
  const x = pickX(g, radius);
  if (blocked(g, x, g.height + radius, radius)) return;
  spawnKind(g, kind, x);
}

function spawnPearl(g: Game, x: number, y: number) {
  place(g, "pearl", x, y);
}

function spawnPower(g: Game) {
  let kind = POWERS[Math.floor(rand(g) * POWERS.length)] ?? "shield";
  if (kind === "patch" && g.hull >= g.maxHull) kind = "shield";
  if (kind === "shield" && g.shield) kind = "magnet";
  const x = clamp(g.safeX + (rand(g) - 0.5) * 36, 40, g.width - 40);
  spawnKind(g, kind, x);
}

function applyPower(g: Game, kind: Kind) {
  if (kind === "shield") g.shield = true;
  if (kind === "magnet") g.magnet = 7;
  if (kind === "boost") g.boost = 6;
  if (kind === "calm") g.calm = 6.5;
  if (kind === "patch") g.hull = Math.min(g.maxHull, g.hull + 1);
  if (kind === "shield" || kind === "magnet" || kind === "boost" || kind === "calm" || kind === "patch") {
    g.banner = POWER_LABEL[kind];
    g.bannerT = 2.3;
  }
  cue(g, "power");
}

function hurt(g: Game, ox: number) {
  if (g.sub.iframe > 0) return;
  if (g.shield) {
    g.shield = false;
    g.sub.iframe = 0.7;
    g.banner = "Shield spent";
    g.bannerT = 1.4;
    spawnParticle(g, g.sub.x, g.sub.y, "ring", 1, 1);
    cue(g, "shield");
    return;
  }
  g.hull -= 1;
  g.sub.iframe = 1.35;
  g.sub.flash = 0.28;
  g.shake = g.reduceMotion ? 0 : 8;
  const away = Math.sign(g.sub.x - ox) || (rand(g) < 0.5 ? -1 : 1);
  g.sub.vx = away * 240 * sc(g);
  for (let i = 0; i < 8; i++) spawnParticle(g, g.sub.x, g.sub.y, "spark", 2, 1.4);
  cue(g, "hit");
  if (g.hull <= 0) {
    g.phase = "fail";
    g.sink = 0;
    cue(g, "fail");
    persist(g, true);
  }
}

function spawnChest(g: Game) {
  g.chestSpawned = true;
  for (const e of g.entities) {
    if (e.active && !SPECS[e.kind].pickup) e.active = false;
  }
  const y = g.height + 120;
  place(g, "chest", g.width / 2, y);
  for (let i = 0; i < 5; i++) {
    spawnPearl(g, g.width / 2 + (i - 2) * 28 * sc(g), y + 70 + i * 22);
  }
  g.banner = "The chest";
  g.bannerT = 2.4;
}

function beginRound(g: Game) {
  g.depth = 0;
  g.sink = 2.1;
  g.phase = "playing";
  g.chestSpawned = false;
  g.roundStartTotal = g.totalDepth;
  g.spawnMeter = 7;
  g.pearlMeter = 5;
  g.powerMeter = 42;
  g.safeX = g.width * 0.5;
  g.safeTarget = g.width * (0.28 + rand(g) * 0.44);
  g.safeRetarget = g.time + 2.2;
  clearEntities(g);
}

export function startDive(g: Game) {
  g.round = 0;
  g.totalDepth = 0;
  g.pearls = 0;
  g.hull = g.maxHull;
  g.shield = false;
  g.magnet = 0;
  g.boost = 0;
  g.calm = 0;
  g.shake = 0;
  g.celebrate = 0;
  g.banner = "";
  g.bannerT = 0;
  g.sub.vx = 0;
  g.sub.iframe = 0;
  g.sub.x = g.width / 2;
  g.rng = (Math.floor(Math.random() * 1e9) >>> 0) || 1;
  beginRound(g);
}

export function continueDive(g: Game) {
  if (g.phase !== "round") return;
  g.round += 1;
  if (g.round >= ROUNDS.length) {
    g.phase = "win";
    return;
  }
  g.banner = "";
  beginRound(g);
}

export function retryRound(g: Game) {
  g.totalDepth = g.roundStartTotal;
  g.hull = g.maxHull;
  g.shield = false;
  g.magnet = 0;
  g.boost = 0;
  g.calm = 0;
  g.shake = 0;
  g.sub.iframe = 0;
  g.sub.vx = 0;
  g.banner = "";
  beginRound(g);
}

export function surface(g: Game) {
  g.phase = "title";
  g.sink = 0;
  g.depth = 0;
  g.shield = false;
  g.magnet = 0;
  g.boost = 0;
  g.calm = 0;
  g.sub.vx = 0;
  g.sub.tilt = 0;
  g.banner = "";
  clearEntities(g);
}

export function togglePause(g: Game) {
  if (g.phase === "playing") g.phase = "pause";
  else if (g.phase === "pause") g.phase = "playing";
}

function hitRadius(g: Game, kind: Kind) {
  return SPECS[kind].r * sc(g);
}

export function stepGame(g: Game, input: Input, dt: number) {
  g.time += dt;
  g.sub.anim += dt * (g.phase === "playing" ? 6 : 3);
  if (g.sub.flash > 0) g.sub.flash = Math.max(0, g.sub.flash - dt);
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 22);
  if (g.celebrate > 0) g.celebrate = Math.max(0, g.celebrate - dt);
  if (g.bannerT > 0) {
    g.bannerT -= dt;
    if (g.bannerT <= 0) g.banner = "";
  }

  const targetY = g.phase === "title" ? g.height * 0.74 : g.height * 0.32;
  g.sub.y += (targetY - g.sub.y) * Math.min(1, dt * 3.2);

  g.bubbleAcc += dt;
  const bubbleEvery = g.phase === "playing" ? 0.08 : 0.16;
  if (g.bubbleAcc >= bubbleEvery) {
    g.bubbleAcc = 0;
    const facingLeft = g.sub.vx < -12;
    const rear = facingLeft ? 0.42 : -0.42;
    spawnParticle(g, g.sub.x + rear * 138 * sc(g), g.sub.y + 6 * sc(g), "bubble", 0, 0.6);
  }
  if (rand(g) < dt * 3.2) {
    spawnParticle(g, rand(g) * g.width, g.height + 8, "bubble", g.round >= 4 ? 1 : 0, 0.4);
  }

  for (const p of g.particles) {
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) p.active = false;
  }

  if (g.phase !== "playing") {
    g.sub.vx *= Math.exp(-6 * dt);
    return;
  }

  // Side view: A / left moves the sub left on screen. D / right moves it right.
  let ax = 0;
  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  if (input.pointerX != null) {
    const dx = input.pointerX - g.sub.x;
    ax = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
  }
  const accel = 1100 * sc(g);
  const maxV = 360 * sc(g);
  g.sub.vx += ax * accel * dt;
  g.sub.vx = clamp(g.sub.vx, -maxV, maxV);
  if (ax === 0) g.sub.vx *= Math.exp(-8 * dt);
  g.sub.x += g.sub.vx * dt;
  const pad = 34 * sc(g);
  if (g.sub.x < pad) {
    g.sub.x = pad;
    g.sub.vx = 0;
  } else if (g.sub.x > g.width - pad) {
    g.sub.x = g.width - pad;
    g.sub.vx = 0;
  }
  const tiltTarget = clamp(g.sub.vx / maxV, -1, 1) * 0.1;
  g.sub.tilt += (tiltTarget - g.sub.tilt) * Math.min(1, dt * 8);
  if (g.sub.iframe > 0) g.sub.iframe -= dt;
  if (g.magnet > 0) g.magnet -= dt;
  if (g.boost > 0) g.boost -= dt;
  if (g.calm > 0) g.calm -= dt;

  const round = ROUNDS[g.round] ?? ROUNDS[0];
  const progress = clamp(g.depth / round.goal, 0, 1);
  let terminal = 5.5 + g.round * 0.28 + progress * 0.85;
  if (g.boost > 0) terminal *= 1.32;
  if (g.calm > 0) terminal *= 0.68;
  terminal = Math.min(terminal, 8.6);
  if (g.sink < terminal) g.sink = Math.min(terminal, g.sink + 3.1 * dt);
  else g.sink = Math.max(terminal, g.sink - 3.1 * dt);

  const meters = g.sink * dt;
  g.depth += meters;
  g.totalDepth += meters;
  const scroll = meters * pxPerMeter(g.height);

  if (g.time >= g.safeRetarget) {
    g.safeTarget = g.width * (0.22 + rand(g) * 0.56);
    g.safeRetarget = g.time + 2.3 + rand(g) * 1.4;
  }
  g.safeX += (g.safeTarget - g.safeX) * Math.min(1, dt * 0.45);

  if (!round.finale && g.depth >= round.goal) {
    g.phase = "round";
    g.sink *= 0.25;
    cue(g, "round");
    persist(g, true);
    return;
  }
  if (round.finale && !g.chestSpawned && g.depth >= round.goal * 0.8) spawnChest(g);

  if (!g.chestSpawned) {
    g.spawnMeter -= meters;
    if (g.spawnMeter <= 0) {
      g.spawnMeter = 8.2 + rand(g) * 3.4;
      spawnObstacle(g);
    }
    g.pearlMeter -= meters;
    if (g.pearlMeter <= 0) {
      g.pearlMeter = 11 + rand(g) * 6;
      const x = clamp(g.safeX + (rand(g) - 0.5) * 50, 36, g.width - 36);
      spawnPearl(g, x, g.height + 30);
      if (rand(g) < 0.45) spawnPearl(g, x, g.height + 68);
    }
    g.powerMeter -= meters;
    if (g.powerMeter <= 0) {
      g.powerMeter = 52 + rand(g) * 18;
      spawnPower(g);
    }
  }

  const subR = SUB_R * sc(g);
  for (const e of g.entities) {
    if (!e.active) continue;
    const spec = SPECS[e.kind];
    e.y -= scroll;
    if (spec.drift > 0) {
      e.x = e.homeX + Math.sin(g.time * spec.freq + e.bob) * spec.drift * sc(g);
    }
    if (g.magnet > 0 && e.kind === "pearl") {
      const dx = g.sub.x - e.x;
      const dy = g.sub.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 230 * sc(g)) {
        e.x += (dx / dist) * 260 * sc(g) * dt;
        e.y += (dy / dist) * 260 * sc(g) * dt;
      }
    }
    const off = spec.h * sc(g) + 40;
    if (e.y < -off) {
      if (e.kind === "chest") finish(g);
      e.active = false;
      continue;
    }
    const dx = e.x - g.sub.x;
    const dy = e.y - g.sub.y;
    const reach = subR + hitRadius(g, e.kind);
    if (dx * dx + dy * dy > reach * reach) continue;
    if (e.kind === "chest") {
      finish(g);
      e.active = false;
      continue;
    }
    if (spec.pickup) {
      e.active = false;
      if (e.kind === "pearl") {
        g.pearls += 1;
        spawnParticle(g, e.x, e.y, "spark", 1, 1);
        cue(g, "pearl");
        persist(g);
      } else {
        applyPower(g, e.kind);
        spawnParticle(g, e.x, e.y, "ring", 1, 1);
      }
    } else {
      hurt(g, e.x);
    }
  }

  for (const p of g.particles) {
    if (p.active) p.y -= scroll * 0.35;
  }
  persist(g);
}

function finish(g: Game) {
  if (g.phase === "win") return;
  g.phase = "win";
  g.pearls += 20;
  g.celebrate = 1.6;
  g.sink = 0;
  cue(g, "win");
  for (let i = 0; i < 14; i++) {
    spawnParticle(g, g.width / 2 + (rand(g) - 0.5) * 80, g.sub.y + 40, "spark", 1, 1.6);
  }
  persist(g, true);
}
