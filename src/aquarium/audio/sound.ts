type Sound =
  | "pick"
  | "swap"
  | "invalid"
  | "match"
  | "cascade"
  | "special"
  | "win"
  | "buy";
export type SoundRegion = "sun" | "coral" | "pearl" | "star";
type Voice = { gain: GainNode; ambient: boolean };
type Motif = {
  root: number;
  beat: number;
  notes: (number | null)[];
  chord: number[];
  tone: OscillatorType;
};

// Original, intentionally spacious miniatures: no streamed tracks or licensed samples.
const MOTIFS: Record<SoundRegion, Motif> = {
  sun: {
    root: 220,
    beat: 0.9,
    notes: [
      12,
      null,
      19,
      16,
      null,
      21,
      19,
      null,
      16,
      null,
      14,
      null,
      12,
      7,
      null,
      null,
    ],
    chord: [0, 4, 7],
    tone: "sine",
  },
  coral: {
    root: 246.94,
    beat: 0.8,
    notes: [
      12,
      16,
      null,
      19,
      null,
      24,
      21,
      null,
      19,
      null,
      16,
      14,
      null,
      19,
      null,
      null,
    ],
    chord: [0, 4, 7],
    tone: "triangle",
  },
  pearl: {
    root: 261.63,
    beat: 1.05,
    notes: [
      12,
      null,
      19,
      null,
      24,
      28,
      null,
      null,
      26,
      null,
      19,
      21,
      null,
      16,
      null,
      null,
    ],
    chord: [0, 7, 11],
    tone: "sine",
  },
  star: {
    root: 220,
    beat: 1.25,
    notes: [
      24,
      null,
      null,
      19,
      null,
      26,
      null,
      28,
      null,
      null,
      24,
      null,
      19,
      16,
      null,
      null,
    ],
    chord: [0, 7, 14],
    tone: "sine",
  },
};

export class Soundscape {
  private context: AudioContext | null = null;
  private output: AudioNode | null = null;
  private readonly voices = new Map<OscillatorNode, Voice>();
  private active = false;
  private interacted = false;
  private disposed = false;
  private region: SoundRegion = "sun";
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextMusicTime = 0;
  private resumePromise: Promise<void> | null = null;
  private pauseGeneration = 0;

  constructor() {
    // A restored "sound on" preference alone must never create an AudioContext.
    document.addEventListener("pointerdown", this.markInteraction, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", this.markInteraction, true);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  get enabled(): boolean {
    return this.active;
  }
  set enabled(value: boolean) {
    const changed = this.active !== value;
    this.active = value;
    if (!value) this.pause();
    else if (changed && this.interacted) void this.unlock();
  }

  setRegion(region: SoundRegion): void {
    if (
      this.disposed ||
      this.region === region ||
      !Object.hasOwn(MOTIFS, region)
    )
      return;
    this.region = region;
    this.stopMusicTimer();
    this.musicStep = 0;
    this.nextMusicTime = 0;
    // A short audio-clock fade avoids clicks; no per-voice JS timers accumulate.
    const ctx = this.context;
    for (const [oscillator, voice] of this.voices)
      if (voice.ambient) {
        if (ctx?.state === "running") {
          voice.gain.gain.cancelScheduledValues(ctx.currentTime);
          voice.gain.gain.setValueAtTime(
            Math.max(0.0001, voice.gain.gain.value),
            ctx.currentTime,
          );
          voice.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.06,
          );
          try {
            oscillator.stop(ctx.currentTime + 0.07);
          } catch {
            this.releaseVoice(oscillator);
          }
        } else this.stopVoice(oscillator);
      }
    this.startMusic();
  }

  async unlock(): Promise<void> {
    if (!this.active || this.disposed || document.hidden) return;
    if (!this.interacted && !navigator.userActivation?.hasBeenActive) return;
    this.interacted = true;
    const generation = this.pauseGeneration;
    if (!this.context) {
      const Audio =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) return;
      try {
        this.context = new Audio();
        // Keep simultaneous celebrations gentle instead of allowing digital clipping.
        if (typeof this.context.createDynamicsCompressor === "function") {
          const limiter = this.context.createDynamicsCompressor();
          limiter.threshold.value = -12;
          limiter.knee.value = 18;
          limiter.ratio.value = 3;
          limiter.attack.value = 0.003;
          limiter.release.value = 0.18;
          limiter.connect(this.context.destination);
          this.output = limiter;
        }
      } catch {
        return;
      }
    }
    const ctx = this.context;
    if (ctx.state === "closed") return;
    if (ctx.state !== "running") {
      this.resumePromise ??= ctx
        .resume()
        .catch(() => {})
        .finally(() => {
          this.resumePromise = null;
        });
      await this.resumePromise;
    }
    if (generation === this.pauseGeneration && this.active && !document.hidden)
      this.startMusic();
  }

  play(kind: Sound, chain = 0): void {
    if (!this.active || this.disposed || document.hidden) return;
    void this.unlock();
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    const note = (
      frequency: number,
      when: number,
      duration: number,
      volume: number,
      type: OscillatorType = "sine",
    ) => this.note(frequency, when, duration, volume, type, false);
    const time = ctx.currentTime;
    if (kind === "pick") note(620, time, 0.085, 0.045);
    else if (kind === "swap") {
      note(440, time, 0.08, 0.04);
      note(660, time + 0.04, 0.13, 0.045);
    } else if (kind === "invalid") note(170, time, 0.14, 0.04, "triangle");
    else if (kind === "special")
      [196, 392, 587, 784, 1175].forEach((f, i) =>
        note(f, time + i * 0.035, 0.48, 0.04),
      );
    else if (kind === "win")
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        note(f, time + i * 0.095, 0.75, 0.055),
      );
    else if (kind === "buy")
      [659.25, 880, 1318.5].forEach((f, i) =>
        note(f, time + i * 0.07, 0.4, 0.055),
      );
    else
      [0, 4, 7].forEach((n, i) =>
        note(
          440 * 2 ** ((n + Math.min(chain, 8) * 2) / 12),
          time + i * 0.04,
          0.22,
          0.04,
        ),
      );
  }

  pause(): void {
    this.pauseGeneration++;
    this.stopMusicTimer();
    this.nextMusicTime = 0;
    // Disconnect synchronously: suspended contexts need not deliver onended promptly.
    for (const oscillator of this.voices.keys()) this.stopVoice(oscillator);
    if (this.context?.state === "running")
      void this.context.suspend().catch(() => {});
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    document.removeEventListener("pointerdown", this.markInteraction, true);
    document.removeEventListener("keydown", this.markInteraction, true);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.output?.disconnect();
    this.output = null;
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
  }

  speak(text: string): void {
    if (!("speechSynthesis" in window) || this.disposed) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "da-DK";
    speech.rate = 0.94;
    const danish = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.startsWith("da"));
    if (danish) speech.voice = danish;
    window.speechSynthesis.speak(speech);
  }

  private markInteraction = (event: Event): void => {
    if (event.isTrusted) this.interacted = true;
  };
  private handleVisibility = (): void => {
    if (document.hidden) this.pause();
    else if (this.active && this.interacted) void this.unlock();
  };

  private startMusic(): void {
    const ctx = this.context;
    if (
      this.disposed ||
      !this.active ||
      document.hidden ||
      ctx?.state !== "running" ||
      this.musicTimer !== null
    )
      return;
    this.nextMusicTime = Math.max(this.nextMusicTime, ctx.currentTime + 0.12);
    this.scheduleMusic();
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic = (): void => {
    this.musicTimer = null;
    const ctx = this.context;
    if (
      this.disposed ||
      !this.active ||
      document.hidden ||
      ctx?.state !== "running"
    )
      return;
    const motif = MOTIFS[this.region];
    // Never replay missed bars after a slow frame or a backgrounded phone tab.
    if (this.nextMusicTime < ctx.currentTime - 0.2)
      this.nextMusicTime = ctx.currentTime + 0.08;
    let scheduled = 0;
    while (this.nextMusicTime < ctx.currentTime + 0.24 && scheduled++ < 3) {
      const step = this.musicStep++ % motif.notes.length;
      if (step === 0) {
        for (const interval of motif.chord)
          this.note(
            (motif.root / 2) * 2 ** (interval / 12),
            this.nextMusicTime,
            motif.beat * 7,
            0.0036,
            "sine",
            true,
            true,
          );
      }
      const pitch = motif.notes[step];
      if (pitch !== null) {
        this.note(
          motif.root * 2 ** (pitch / 12),
          this.nextMusicTime,
          motif.beat * 1.8,
          this.region === "coral" ? 0.006 : 0.008,
          motif.tone,
          true,
        );
        // A very quiet upper glint gives the pearl and deep-water regions their own timbre.
        if (
          (this.region === "pearl" || this.region === "star") &&
          step % 4 === 0
        )
          this.note(
            motif.root * 2 ** ((pitch + 12) / 12),
            this.nextMusicTime + 0.04,
            motif.beat * 1.4,
            0.0018,
            "sine",
            true,
          );
      }
      this.nextMusicTime += motif.beat;
    }
    this.musicTimer = window.setTimeout(this.scheduleMusic, 180);
  };

  private note(
    frequency: number,
    when: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    ambient: boolean,
    pad = false,
  ): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || this.voices.size >= 48) return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    if (!ambient)
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 0.985,
        when + duration,
      );
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(
      volume,
      when + (pad ? 0.8 : ambient ? 0.025 : 0.012),
    );
    if (pad) gain.gain.setValueAtTime(volume, when + duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.output ?? ctx.destination);
    this.voices.set(oscillator, { gain, ambient });
    oscillator.onended = () => this.releaseVoice(oscillator);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
  }

  private stopVoice(oscillator: OscillatorNode): void {
    try {
      oscillator.stop();
    } catch {
      /* Already ended. */
    }
    this.releaseVoice(oscillator);
  }

  private releaseVoice(oscillator: OscillatorNode): void {
    const voice = this.voices.get(oscillator);
    if (!voice) return;
    oscillator.onended = null;
    oscillator.disconnect();
    voice.gain.disconnect();
    this.voices.delete(oscillator);
  }
}
