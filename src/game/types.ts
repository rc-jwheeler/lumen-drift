export type Phase = "title" | "playing" | "round" | "fail" | "win" | "pause";

export type Kind =
  | "jelly"
  | "fish"
  | "mine"
  | "angler"
  | "squid"
  | "kelp"
  | "coral"
  | "rock"
  | "urchin"
  | "pearl"
  | "shield"
  | "magnet"
  | "boost"
  | "calm"
  | "patch"
  | "chest";

export type Cue = "pearl" | "hit" | "shield" | "power" | "round" | "win" | "fail";

export type Input = {
  left: boolean;
  right: boolean;
  pointerX: number | null;
};

export type Spec = {
  sprite: string;
  cols: number;
  rows: number;
  frames: number;
  frame: number;
  w: number;
  h: number;
  r: number;
  pickup: boolean;
  drift: number;
  freq: number;
  anim: number;
};

export type Entity = {
  active: boolean;
  kind: Kind;
  x: number;
  y: number;
  homeX: number;
  bob: number;
};

export type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: "bubble" | "spark" | "ring";
  tint: number;
};

export type Game = {
  phase: Phase;
  round: number;
  depth: number;
  totalDepth: number;
  roundStartTotal: number;
  pearls: number;
  hull: number;
  maxHull: number;
  sink: number;
  time: number;
  width: number;
  height: number;
  sub: {
    x: number;
    y: number;
    vx: number;
    anim: number;
    tilt: number;
    iframe: number;
    flash: number;
  };
  shield: boolean;
  magnet: number;
  boost: number;
  calm: number;
  shake: number;
  celebrate: number;
  banner: string;
  bannerT: number;
  entities: Entity[];
  particles: Particle[];
  spawnMeter: number;
  pearlMeter: number;
  powerMeter: number;
  safeX: number;
  safeTarget: number;
  safeRetarget: number;
  rng: number;
  chestSpawned: boolean;
  bubbleAcc: number;
  bestDepth: number;
  bestPearls: number;
  lastSave: number;
  reduceMotion: boolean;
  cues: Cue[];
};
