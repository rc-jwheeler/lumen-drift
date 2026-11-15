import { ROUNDS, SPECS, SUB_H, SUB_W, pxPerMeter, worldScale } from "@/game/specs";
import type { Bank } from "@/game/assets";
import type { Game, Kind } from "@/game/types";

const TOPS = ["#8fd4ee", "#1a6d96", "#0d3554", "#071722", "#12160f"];
const BOTS = ["#0e6288", "#0c3b5c", "#07111c", "#04080e", "#1a140c"];
const DUST = ["#f4fbff", "#d7fff6", "#9ad4ff", "#7ee0c8", "#e8b86d"];

function mix(a: string, b: string, t: number) {
  const pa = hex(a);
  const pb = hex(b);
  const u = clamp(t, 0, 1);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * u));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function hex(value: string) {
  const n = value.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16));
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function roundColor(g: Game) {
  const round = ROUNDS[g.round] ?? ROUNDS[0];
  const t = g.phase === "title" ? 0 : clamp(g.depth / round.goal, 0, 1);
  const i = Math.min(g.round, TOPS.length - 1);
  const j = Math.min(i + 1, TOPS.length - 1);
  return {
    top: mix(TOPS[i] ?? "#07141f", TOPS[j] ?? "#07141f", t * 0.65),
    bot: mix(BOTS[i] ?? "#07141f", BOTS[j] ?? "#07141f", t * 0.65),
    dust: DUST[i] ?? "#ffffff",
    shaft: i === 0 ? 0.18 : i === 1 ? 0.07 : 0,
  };
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  bank: Bank | null,
  sprite: string,
  cols: number,
  rows: number,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
  flip: boolean,
  rot: number,
  alpha: number,
) {
  const img = bank?.[sprite];
  if (!img || !img.complete || img.naturalWidth === 0) return false;
  const col = ((frame % (cols * rows)) + cols * rows) % cols;
  const row = Math.floor((((frame % (cols * rows)) + cols * rows) % (cols * rows)) / cols);
  const fw = img.width / cols;
  const fh = img.height / rows;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, col * fw, row * fh, fw, fh, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function frameFor(kind: Kind, g: Game, bob: number, y: number) {
  const spec = SPECS[kind];
  if (kind === "chest") {
    const near = 1 - clamp((y - g.sub.y) / (g.height * 0.55), 0, 1);
    return Math.min(3, Math.floor(near * 3.2));
  }
  if (spec.frames <= 1) return spec.frame;
  return Math.floor(g.time * spec.anim + bob) % spec.frames;
}

const POWER_GLOW: Partial<Record<Kind, string>> = {
  magnet: "rgba(232, 184, 109, 0.45)",
  boost: "rgba(231, 243, 241, 0.4)",
  calm: "rgba(140, 186, 230, 0.45)",
  patch: "rgba(224, 122, 106, 0.4)",
};

function glyph(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#042226";
  ctx.fillStyle = "#042226";
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "magnet") {
    ctx.beginPath();
    ctx.arc(0, 2, s * 0.28, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.28, 2);
    ctx.lineTo(-s * 0.28, s * 0.22);
    ctx.moveTo(s * 0.28, 2);
    ctx.lineTo(s * 0.28, s * 0.22);
    ctx.stroke();
  } else if (kind === "boost") {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.28);
    ctx.lineTo(-s * 0.22, -s * 0.02);
    ctx.lineTo(s * 0.22, -s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.02);
    ctx.lineTo(-s * 0.16, -s * 0.24);
    ctx.lineTo(s * 0.16, -s * 0.24);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "calm") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, 0);
    ctx.quadraticCurveTo(-s * 0.16, -s * 0.22, 0, 0);
    ctx.quadraticCurveTo(s * 0.16, s * 0.22, s * 0.32, 0);
    ctx.stroke();
  } else if (kind === "patch") {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.26);
    ctx.lineTo(0, s * 0.26);
    ctx.moveTo(-s * 0.26, 0);
    ctx.lineTo(s * 0.26, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGame(ctx: CanvasRenderingContext2D, g: Game, bank: Bank | null) {
  const { width: w, height: h } = g;
  const s = worldScale(h);
  const colors = roundColor(g);
  ctx.save();
  if (g.shake > 0 && !g.reduceMotion) {
    const mag = g.shake * 0.4;
    ctx.translate(Math.sin(g.time * 46) * mag, Math.cos(g.time * 35) * mag);
  }
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, colors.top);
  sky.addColorStop(1, colors.bot);
  ctx.fillStyle = sky;
  ctx.fillRect(-30, -30, w + 60, h + 60);

  if (colors.shaft > 0 && !g.reduceMotion) {
    ctx.save();
    ctx.globalAlpha = colors.shaft;
    ctx.fillStyle = "#e7f6ff";
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.23 + 0.08) * w + Math.sin(g.time * 0.15 + i) * 12) % w;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + 36, -20);
      ctx.lineTo(x + 90, h);
      ctx.lineTo(x - 20, h);
      ctx.fill();
    }
    ctx.restore();
  }

  const dustN = g.round >= 3 ? 18 : 8;
  ctx.fillStyle = colors.dust;
  for (let i = 0; i < dustN; i++) {
    const travel = (g.totalDepth * pxPerMeter(h) * (g.round >= 3 ? 0.25 : 0.12) + i * 97) % (h + 60);
    const y = h + 30 - travel;
    const x = (i * 73 + Math.sin(i * 2.1) * 20) % w;
    ctx.globalAlpha = g.round >= 4 ? 0.22 : 0.07;
    ctx.beginPath();
    ctx.arc(x, y, (g.round >= 4 ? 2.2 : 10) + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const foamY = g.sub.y - 58 * s - g.depth * pxPerMeter(h);
  if (g.round === 0 && foamY > -30 && foamY < h + 20) {
    ctx.beginPath();
    ctx.moveTo(0, foamY);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, foamY + Math.sin(x * 0.04 + g.time * 1.4) * 5);
    }
    ctx.lineTo(w, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    const foam = ctx.createLinearGradient(0, foamY - 80, 0, foamY + 8);
    foam.addColorStop(0, "rgba(198, 232, 244, 0.55)");
    foam.addColorStop(1, "rgba(198, 232, 244, 0)");
    ctx.fillStyle = foam;
    ctx.fill();
    ctx.strokeStyle = "rgba(244, 251, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const y = foamY + Math.sin(x * 0.04 + g.time * 1.4) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  if (g.round >= 2 && g.phase !== "title") {
    const glow = ctx.createRadialGradient(g.sub.x, g.sub.y + 30, 8, g.sub.x, g.sub.y + 40, 200 * s);
    const alpha = g.round === 2 ? 0.16 : g.round === 3 ? 0.26 : 0.38;
    glow.addColorStop(0, `rgba(232, 184, 109, ${alpha})`);
    glow.addColorStop(1, "rgba(232, 184, 109, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  for (const p of g.particles) {
    if (!p.active || p.kind !== "bubble") continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = 0.35 * a;
    ctx.strokeStyle = p.tint === 1 ? "#e8b86d" : "#f4fbff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1.2 - a * 0.3), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const chest = g.entities.find((e) => e.active && e.kind === "chest");
  if (chest) {
    const sandY = chest.y + 48 * s;
    const sand = ctx.createLinearGradient(0, sandY, 0, sandY + 220);
    sand.addColorStop(0, "rgba(232, 184, 109, 0)");
    sand.addColorStop(0.15, "rgba(196, 154, 92, 0.85)");
    sand.addColorStop(1, "rgba(92, 62, 36, 0.95)");
    ctx.fillStyle = sand;
    ctx.fillRect(0, sandY, w, 240);
  }

  for (const e of g.entities) {
    if (!e.active) continue;
    const spec = SPECS[e.kind];
    const sway = spec.freq > 0 && spec.drift === 0 ? Math.sin(g.time * spec.freq + e.bob) * 0.05 : 0;
    const movingLeft = spec.drift > 0 && Math.cos(g.time * spec.freq + e.bob) < 0;
    const pulse = spec.pickup ? 1 + Math.sin(g.time * 3 + e.bob) * 0.05 : 1;
    const dw = spec.w * s * pulse;
    const dh = spec.h * s * pulse;
    const glow = POWER_GLOW[e.kind];
    if (glow) {
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(e.x, e.y, dw * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.kind === "chest") {
      const aura = ctx.createRadialGradient(e.x, e.y, 8, e.x, e.y, dw);
      aura.addColorStop(0, "rgba(232, 184, 109, 0.45)");
      aura.addColorStop(1, "rgba(232, 184, 109, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(e.x, e.y, dw, 0, Math.PI * 2);
      ctx.fill();
    }
    const frame = frameFor(e.kind, g, e.bob, e.y);
    drawSprite(ctx, bank, spec.sprite, spec.cols, spec.rows, frame, e.x, e.y, dw, dh, movingLeft, sway, 1);
    if (e.kind === "magnet" || e.kind === "boost" || e.kind === "calm" || e.kind === "patch") {
      glyph(ctx, e.kind, e.x, e.y, dw);
    }
  }

  if (g.round >= 2 && g.shield) {
    ctx.strokeStyle = "rgba(46, 196, 182, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.sub.x, g.sub.y, 52 * s, 0, Math.PI * 2);
    ctx.stroke();
  } else if (g.shield) {
    ctx.strokeStyle = "rgba(46, 196, 182, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.sub.x, g.sub.y, 52 * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  const blink = g.sub.iframe > 0 && Math.sin(g.time * 28) > 0 ? 0.45 : 1;
  const facingLeft = g.sub.vx < -12;
  const subFrame = Math.floor(g.sub.anim) % 4;
  drawSprite(
    ctx,
    bank,
    "sub",
    2,
    2,
    subFrame,
    g.sub.x,
    g.sub.y,
    SUB_W * s,
    SUB_H * s,
    facingLeft,
    g.sub.tilt * (facingLeft ? -1 : 1),
    blink,
  );

  for (const p of g.particles) {
    if (!p.active || p.kind === "bubble") continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.kind === "ring") {
      ctx.strokeStyle = p.tint === 2 ? "#e07a6a" : "#e8b86d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + (1 - a) * 28, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.tint === 2 ? "#e07a6a" : "#e8b86d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (g.sub.flash > 0) {
    ctx.fillStyle = `rgba(255, 236, 220, ${g.sub.flash * 0.45})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (g.celebrate > 0) {
    ctx.fillStyle = `rgba(232, 184, 109, ${g.celebrate * 0.18})`;
    ctx.fillRect(0, 0, w, h);
  }

  const vignette = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.5, h * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  if (g.shake > 0 && !g.reduceMotion) {
    ctx.strokeStyle = `rgba(224, 122, 106, ${Math.min(0.35, g.shake / 18)})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  }
  ctx.restore();
}
