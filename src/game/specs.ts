import type { Kind, Spec } from "@/game/types";

export const ROUNDS: {
  name: string;
  tease: string;
  goal: number;
  finale?: boolean;
  weights: { kind: Kind; w: number }[];
}[] = [
  {
    name: "Sunlit Shallows",
    tease: "The light thins. Coral twilight is next.",
    goal: 165,
    weights: [
      { kind: "fish", w: 3 },
      { kind: "jelly", w: 3 },
      { kind: "kelp", w: 2 },
    ],
  },
  {
    name: "Coral Twilight",
    tease: "Night water. Keep the lantern between the mines.",
    goal: 180,
    weights: [
      { kind: "coral", w: 3 },
      { kind: "jelly", w: 2 },
      { kind: "urchin", w: 2 },
      { kind: "fish", w: 2 },
    ],
  },
  {
    name: "Midnight Drift",
    tease: "Deeper still. Squid drift through the vent dark.",
    goal: 190,
    weights: [
      { kind: "mine", w: 3 },
      { kind: "angler", w: 3 },
      { kind: "rock", w: 2 },
    ],
  },
  {
    name: "Vent Abyss",
    tease: "The trench floor. Something gold is waiting.",
    goal: 200,
    weights: [
      { kind: "squid", w: 3 },
      { kind: "mine", w: 2 },
      { kind: "angler", w: 2 },
      { kind: "rock", w: 1 },
    ],
  },
  {
    name: "Treasure Trench",
    tease: "The chest is yours.",
    goal: 170,
    finale: true,
    weights: [
      { kind: "rock", w: 2 },
      { kind: "mine", w: 2 },
      { kind: "squid", w: 2 },
      { kind: "urchin", w: 2 },
    ],
  },
];

const grid = {
  cols: 2,
  rows: 2,
  frames: 4,
  frame: 0,
  pickup: false,
};

export const SPECS: Record<Kind, Spec> = {
  jelly: { ...grid, sprite: "jelly", w: 86, h: 110, r: 28, drift: 18, freq: 0.8, anim: 3.2 },
  fish: { ...grid, sprite: "fish", w: 92, h: 68, r: 22, drift: 26, freq: 1.15, anim: 7 },
  mine: { ...grid, sprite: "mine", w: 84, h: 84, r: 34, drift: 0, freq: 0, anim: 3 },
  angler: { ...grid, sprite: "angler", w: 120, h: 78, r: 30, drift: 16, freq: 0.7, anim: 3 },
  squid: { ...grid, sprite: "squid", w: 112, h: 90, r: 30, drift: 20, freq: 0.9, anim: 3.4 },
  kelp: {
    sprite: "kelp",
    cols: 1,
    rows: 1,
    frames: 1,
    frame: 0,
    w: 92,
    h: 230,
    r: 20,
    pickup: false,
    drift: 0,
    freq: 0.55,
    anim: 0,
  },
  coral: {
    sprite: "coral",
    cols: 1,
    rows: 1,
    frames: 1,
    frame: 0,
    w: 130,
    h: 110,
    r: 36,
    pickup: false,
    drift: 0,
    freq: 0,
    anim: 0,
  },
  rock: {
    sprite: "props",
    cols: 2,
    rows: 2,
    frames: 1,
    frame: 2,
    w: 88,
    h: 78,
    r: 30,
    pickup: false,
    drift: 0,
    freq: 0,
    anim: 0,
  },
  urchin: {
    sprite: "props",
    cols: 2,
    rows: 2,
    frames: 1,
    frame: 3,
    w: 74,
    h: 74,
    r: 28,
    pickup: false,
    drift: 0,
    freq: 0,
    anim: 0,
  },
  pearl: {
    sprite: "props",
    cols: 2,
    rows: 2,
    frames: 1,
    frame: 0,
    w: 42,
    h: 42,
    r: 18,
    pickup: true,
    drift: 8,
    freq: 1.3,
    anim: 0,
  },
  shield: bubble(0),
  magnet: bubble(0),
  boost: bubble(0),
  calm: bubble(0),
  patch: bubble(0),
  chest: {
    ...grid,
    sprite: "chest",
    w: 156,
    h: 136,
    r: 50,
    pickup: true,
    drift: 0,
    freq: 0,
    anim: 0,
  },
};

function bubble(frame: number): Spec {
  return {
    sprite: "props",
    cols: 2,
    rows: 2,
    frames: 1,
    frame,
    w: 58,
    h: 58,
    r: 22,
    pickup: true,
    drift: 6,
    freq: 1,
    anim: 0,
  };
}

export const POWER_LABEL: Record<"shield" | "magnet" | "boost" | "calm" | "patch", string> = {
  shield: "Bubble shield",
  magnet: "Pearl tide",
  boost: "Swift ballast",
  calm: "Calm water",
  patch: "Hull patched",
};

export const SUB_W = 138;
export const SUB_H = 86;
export const SUB_R = 24;

export function worldScale(height: number) {
  return Math.max(0.7, Math.min(1.15, height / 780));
}

export function pxPerMeter(height: number) {
  return height / 40;
}
