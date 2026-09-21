export type MusicState = { enabled: boolean; active: boolean; volume: number };

/** One lazy-loaded buffer and one looping source; suspend preserves the playhead. */
export class MusicAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<AudioBuffer> | null = null;
  private abort = new AbortController();
  private revision = 0;
  private wanted = false;
  private destroyed = false;
  private onFailure: () => void;
  private onLoading: (loading: boolean) => void;
  private factory: () => AudioContext;
  private fetcher: typeof fetch;

  constructor(
    onFailure: () => void,
    onLoading: (loading: boolean) => void = () => {},
    factory = () => new AudioContext({ sampleRate: 32000 }),
    fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.onFailure = onFailure;
    this.onLoading = onLoading;
    this.factory = factory;
    this.fetcher = fetcher;
  }

  sync(state: MusicState) {
    if (this.destroyed) return;
    const id = ++this.revision;
    this.wanted = state.enabled && state.active && state.volume > 0;
    if (!this.context && !this.wanted) return;
    try {
      if (!this.context) {
        this.context = this.factory();
        this.gain = this.context.createGain();
        this.gain.gain.value = 0;
        this.gain.connect(this.context.destination);
      }
      const c = this.context;
      this.gain!.gain.cancelScheduledValues(c.currentTime);
      this.gain!.gain.setTargetAtTime(
        this.wanted ? state.volume * 0.7 : 0,
        c.currentTime,
        0.04,
      );
      if (!this.wanted) {
        this.onLoading(false);
        void c.suspend().catch(() => {});
        return;
      }
      // Resume is invoked in the user gesture, before the asynchronous download.
      const resumed = c.resume();
      if (!this.buffer && !this.loading) {
        this.loading = this.fetcher("/audio/oh-rain.mp3", {
          signal: this.abort.signal,
        })
          .then((r) => {
            if (!r.ok) throw new Error("Music download failed");
            return r.arrayBuffer();
          })
          .then((bytes) => c.decodeAudioData(bytes))
          .then((buffer) => {
            if (!this.destroyed) this.buffer = buffer;
            return buffer;
          })
          .finally(() => {
            this.loading = null;
          });
      }
      this.onLoading(!this.buffer);
      void Promise.all([resumed, this.buffer ?? this.loading!])
        .then(([, buffer]) => {
          if (this.destroyed || id !== this.revision || !this.wanted) {
            if (!this.wanted && c.state === "running")
              void c.suspend().catch(() => {});
            return;
          }
          if (!this.source) {
            const source = c.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this.gain!);
            source.start();
            this.source = source;
          }
          this.onLoading(false);
        })
        .catch(() => {
          if (!this.destroyed && id === this.revision && this.wanted)
            this.fail();
        });
    } catch {
      if (!this.gain) {
        void this.context?.close().catch(() => {});
        this.context = null;
      }
      this.fail();
    }
  }
  private fail() {
    this.wanted = false;
    void this.context?.suspend().catch(() => {});
    this.onLoading(false);
    this.onFailure();
  }
  destroy() {
    this.destroyed = true;
    this.wanted = false;
    this.revision++;
    this.abort.abort();
    this.source?.stop();
    this.source?.disconnect();
    void this.context?.close().catch(() => {});
    this.buffer = null;
  }
}
