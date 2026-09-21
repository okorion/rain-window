import { audible, type ExperienceState } from "./state";
import { fillRainChannel } from "./rain-sound";

export class RainAudio {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private revision = 0;
  private wanted = false;
  private onFailure: () => void;
  private factory: () => AudioContext;
  constructor(onFailure: () => void, factory = () => new AudioContext()) {
    this.onFailure = onFailure;
    this.factory = factory;
  }
  // Synchronous creation keeps resume within the trusted button event.
  private ensure() {
    if (this.context) return;
    const c = this.factory();
    this.context = c;
    try {
      const buffer = c.createBuffer(2, c.sampleRate * 24, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        fillRainChannel(
          buffer.getChannelData(ch),
          c.sampleRate,
          3127 + ch * 917,
        );
      }
      this.source = c.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      this.filter = c.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 1350;
      this.gain = c.createGain();
      this.gain.gain.value = 0;
      this.source.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(c.destination);
      this.source.start();
    } catch {
      void c.close().catch(() => {});
      this.context = null;
      this.source = null;
      this.gain = null;
      this.filter = null;
      throw new Error("Audio setup failed");
    }
  }
  sync(state: ExperienceState) {
    const id = ++this.revision;
    this.wanted = audible(state);
    if (!this.context && !this.wanted) return;
    try {
      if (this.wanted) this.ensure();
      const c = this.context;
      if (!c || !this.gain) return;
      this.gain.gain.cancelScheduledValues(c.currentTime);
      this.gain.gain.setTargetAtTime(
        this.wanted ? state.volume * (0.08 + 0.14 * state.intensity) : 0,
        c.currentTime,
        0.05,
      );
      this.filter!.frequency.setTargetAtTime(
        950 + state.intensity * 850,
        c.currentTime,
        0.1,
      );
      const action = this.wanted ? c.resume() : c.suspend();
      void action
        .then(() => {
          // A stale resume is never allowed to leave sound playing after stop.
          if (id !== this.revision && !this.wanted && c.state === "running")
            void c.suspend().catch(() => {});
        })
        .catch(() => {
          if (id === this.revision && this.wanted) this.onFailure();
        });
    } catch {
      if (id === this.revision) this.onFailure();
    }
  }
  destroy() {
    this.revision++;
    this.wanted = false;
    this.source?.stop();
    this.source?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
