type Sound =
  | "pick"
  | "swap"
  | "invalid"
  | "match"
  | "cascade"
  | "special"
  | "win"
  | "buy";
export class Soundscape {
  private context: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  enabled = false;
  async unlock(): Promise<void> {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended")
      await this.context.resume().catch(() => {});
  }
  play(kind: Sound, chain = 0): void {
    if (!this.enabled || document.hidden) return;
    void this.unlock();
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    const note = (
      freq: number,
      when: number,
      duration: number,
      volume: number,
      type: OscillatorType = "sine",
    ) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, when);
      oscillator.frequency.exponentialRampToValueAtTime(
        freq * 0.985,
        when + duration,
      );
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(volume, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(oscillator);
      };
      oscillator.start(when);
      oscillator.stop(when + duration + 0.03);
    };
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
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.voices.clear();
    if (this.context?.state === "running") void this.context.suspend();
  }
  speak(text: string): void {
    if (!("speechSynthesis" in window)) return;
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
}
