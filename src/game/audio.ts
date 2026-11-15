import type { Cue } from "@/game/types";

const BASES = [98, 90, 78, 70, 84];

export class SeaAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private lastRound = -1;
  muted = false;

  loadMute() {
    try {
      this.muted = localStorage.getItem("lumen-drift-mute") === "1";
    } catch {
      this.muted = false;
    }
    return this.muted;
  }

  private ensure() {
    if (this.ctx) return;
    const ctx = new AudioContext({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    music.gain.value = 0.16;
    sfx.gain.value = 0.55;
    master.gain.value = this.muted ? 0 : 0.9;
    music.connect(master);
    sfx.connect(master);
    master.connect(ctx.destination);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(music.gain);
    lfo.start();
    const ratios = [1, 1.5, 2];
    for (const ratio of ratios) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 98 * ratio;
      gain.gain.value = ratio === 1 ? 0.5 : 0.18;
      osc.connect(gain);
      gain.connect(music);
      osc.start();
      this.oscs.push(osc);
    }
    this.ctx = ctx;
    this.master = master;
    this.music = music;
    this.sfx = sfx;
  }

  unlock() {
    try {
      this.ensure();
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* audio is optional */
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem("lumen-drift-mute", this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  mood(round: number) {
    if (!this.ctx || round === this.lastRound) return;
    this.lastRound = round;
    const base = BASES[round] ?? 84;
    const ratios = [1, 1.5, 2];
    this.oscs.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(base * (ratios[i] ?? 1), this.ctx!.currentTime, 0.6);
    });
  }

  consume(cues: Cue[]) {
    let pearls = 0;
    for (const cue of cues) {
      if (cue === "pearl") {
        pearls += 1;
        if (pearls <= 2) this.pearl();
      } else if (cue === "hit") this.hit();
      else if (cue === "shield") this.shield();
      else if (cue === "power") this.power();
      else if (cue === "round") this.roundChime();
      else if (cue === "win") this.win();
      else if (cue === "fail") this.fail();
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gainValue: number, slide = 0) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainValue, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private pearl() {
    const wobble = 1 + (Math.random() - 0.5) * 0.06;
    this.tone(780 * wobble, 0.16, "sine", 0.12, 420);
  }

  private hit() {
    this.tone(130, 0.28, "triangle", 0.18, -50);
  }

  private shield() {
    this.tone(520, 0.22, "sine", 0.1, 180);
  }

  private power() {
    this.tone(440, 0.16, "sine", 0.1, 0);
    this.tone(660, 0.22, "sine", 0.08, 80);
  }

  private roundChime() {
    this.tone(523, 0.2, "sine", 0.1, 0);
    this.tone(659, 0.28, "sine", 0.08, 40);
  }

  private win() {
    if (!this.ctx || !this.sfx || this.muted) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      const t = this.ctx!.currentTime + i * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain);
      gain.connect(this.sfx!);
      osc.start(t);
      osc.stop(t + 0.36);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  private fail() {
    this.tone(180, 0.4, "sine", 0.1, -80);
  }
}
