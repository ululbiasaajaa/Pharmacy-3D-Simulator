/**
 * Audio prosedural (WebAudio). Semua suara & musik disintesis saat runtime sehingga tidak ada
 * aset berlisensi pihak ketiga. Status: PLACEHOLDER yang rapi — bukan aset audio final.
 */
export type SfxName =
  | 'click'
  | 'door'
  | 'step'
  | 'cash'
  | 'notify'
  | 'success'
  | 'error'
  | 'levelup'
  | 'grind'
  | 'scale'
  | 'open'
  | 'arrive';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicVol = 0.35;
  private sfxVol = 0.7;
  private chordIndex = 0;

  /** Harus dipanggil dari gestur pengguna (kebijakan autoplay browser). */
  unlock() {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.music || !this.sfx) return;
    this.music.gain.setTargetAtTime(this.musicVol * 0.25, this.ctx.currentTime, 0.1);
    this.sfx.gain.setTargetAtTime(this.sfxVol * 0.6, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; delay?: number; gain?: number; slideTo?: number; bus?: 'sfx' | 'music' } = {}) {
    if (!this.ctx) return;
    const bus = opts.bus === 'music' ? this.music : this.sfx;
    if (!bus) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, opts: { delay?: number; gain?: number; freq?: number } = {}) {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.freq ?? 800;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 0.2;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t0);
  }

  play(name: SfxName) {
    if (!this.ctx) return;
    switch (name) {
      case 'click':
        this.tone(900, 0.06, { type: 'triangle', gain: 0.15 });
        break;
      case 'door':
        this.tone(1318, 0.5, { gain: 0.18 });
        this.tone(1046, 0.7, { delay: 0.18, gain: 0.18 });
        break;
      case 'step':
        this.noise(0.07, { freq: 300, gain: 0.08 });
        break;
      case 'cash':
        this.noise(0.08, { freq: 2500, gain: 0.15 });
        this.tone(1568, 0.25, { delay: 0.08, gain: 0.2, type: 'triangle' });
        this.tone(2093, 0.4, { delay: 0.16, gain: 0.2, type: 'triangle' });
        break;
      case 'notify':
        this.tone(880, 0.15, { gain: 0.15 });
        this.tone(1175, 0.2, { delay: 0.1, gain: 0.15 });
        break;
      case 'success':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { delay: i * 0.08, gain: 0.18, type: 'triangle' }));
        break;
      case 'error':
        this.tone(220, 0.25, { type: 'square', gain: 0.08, slideTo: 150 });
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { delay: i * 0.1, gain: 0.2, type: 'triangle' }));
        break;
      case 'grind':
        this.noise(0.18, { freq: 600, gain: 0.12 });
        break;
      case 'scale':
        this.tone(1400, 0.05, { type: 'square', gain: 0.05 });
        break;
      case 'open':
        this.tone(392, 0.2, { gain: 0.15 });
        this.tone(523, 0.3, { delay: 0.12, gain: 0.15 });
        break;
      case 'arrive':
        this.tone(660, 0.12, { gain: 0.1, type: 'triangle' });
        break;
    }
  }

  /** Musik latar generatif yang lembut (progresi akor + melodi pentatonik acak). */
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const chords = [
      [261.6, 329.6, 392.0],
      [220.0, 261.6, 329.6],
      [174.6, 220.0, 261.6],
      [196.0, 246.9, 293.7],
    ];
    const penta = [523.3, 587.3, 659.3, 784.0, 880.0];
    const bar = () => {
      const chord = chords[this.chordIndex % chords.length];
      this.chordIndex += 1;
      chord.forEach((f) => this.tone(f, 3.6, { bus: 'music', gain: 0.12, type: 'sine' }));
      this.tone(chord[0] / 2, 3.6, { bus: 'music', gain: 0.1, type: 'triangle' });
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.6) this.tone(penta[Math.floor(Math.random() * penta.length)], 0.8, { bus: 'music', gain: 0.06, delay: i * 1.2 + 0.3, type: 'triangle' });
      }
    };
    bar();
    this.musicTimer = window.setInterval(bar, 3600);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new AudioEngine();
