// Procedural Web Audio API sound synthesizer for Deep Rush City

class AudioManager {
  private ctx: AudioContext | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private driftGain: GainNode | null = null;
  private driftSource: AudioBufferSourceNode | null = null;
  private isDriftingActive: boolean = false;

  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private isHornPlaying: boolean = false;

  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Police siren (continuous two-tone wail, gain driven by proximity)
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenLfoGain: GainNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTargetGain: number = 0;

  // Jetpack thruster audio
  private jetpackGain: GainNode | null = null;
  private jetpackOsc: OscillatorNode | null = null;
  private jetpackFilter: BiquadFilterNode | null = null;
  private jetpackNoiseSource: AudioBufferSourceNode | null = null;

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupEngine();
      this.setupDrift();
      this.setupHorn();
      this.setupSiren();
      this.setupJetpack();
      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  private ensureRunning() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupEngine() {
    if (!this.ctx) return;
    // Primary engine oscillator
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // idle rumble

    // Lowpass filter for muffled cartoon exhaust
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(280, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  private setupDrift() {
    if (!this.ctx) return;
    // Create 2-second white noise buffer for tire squeal
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(4, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.driftGain);
    this.driftGain.connect(this.ctx.destination);
    noiseSource.start();
  }

  private setupHorn() {
    if (!this.ctx) return;
    this.hornGain = this.ctx.createGain();
    this.hornGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.hornGain.connect(this.ctx.destination);
  }

  private setupSiren() {
    if (!this.ctx) return;
    // Carrier
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(760, this.ctx.currentTime);

    // Slow wail LFO sweeping the carrier ±260 Hz
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'triangle';
    this.sirenLfo.frequency.setValueAtTime(0.9, this.ctx.currentTime);
    this.sirenLfoGain = this.ctx.createGain();
    this.sirenLfoGain.gain.setValueAtTime(260, this.ctx.currentTime);
    this.sirenLfo.connect(this.sirenLfoGain);
    this.sirenLfoGain.connect(this.sirenOsc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, this.ctx.currentTime);

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.sirenOsc.connect(filter);
    filter.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  private setupJetpack() {
    if (!this.ctx) return;
    this.jetpackGain = this.ctx.createGain();
    this.jetpackGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.jetpackGain.connect(this.ctx.destination);

    // 1. Dual-tone rocket rumble
    this.jetpackOsc = this.ctx.createOscillator();
    this.jetpackOsc.type = 'sawtooth';
    this.jetpackOsc.frequency.setValueAtTime(80, this.ctx.currentTime);

    const oscFilter = this.ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.45, this.ctx.currentTime);

    this.jetpackOsc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(this.jetpackGain);
    this.jetpackOsc.start();

    // 2. High-speed rocket nozzle hiss / exhaust vapour
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.jetpackNoiseSource = this.ctx.createBufferSource();
    this.jetpackNoiseSource.buffer = noiseBuffer;
    this.jetpackNoiseSource.loop = true;

    this.jetpackFilter = this.ctx.createBiquadFilter();
    this.jetpackFilter.type = 'bandpass';
    this.jetpackFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.jetpackFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, this.ctx.currentTime);

    this.jetpackNoiseSource.connect(this.jetpackFilter);
    this.jetpackFilter.connect(noiseGain);
    noiseGain.connect(this.jetpackGain);
    this.jetpackNoiseSource.start();
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(muted ? 0 : 0.08, this.ctx.currentTime, 0.05);
    }
    if (this.driftGain && this.ctx && muted) {
      this.driftGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    if (this.sirenGain && this.ctx) {
      this.sirenGain.gain.setTargetAtTime(muted ? 0 : this.sirenTargetGain, this.ctx.currentTime, 0.1);
    }
    if (this.jetpackGain && this.ctx && muted) {
      this.jetpackGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  /** Real-time jetpack audio: smoothly modulates gain, rumble frequency, and nozzle hiss with thrust. */
  updateJetpack(active: boolean, thrust01: number, isTurbo: boolean = false) {
    if (!this.ctx || !this.jetpackGain) return;
    if (this.isMuted || !active || thrust01 <= 0.02) {
      this.jetpackGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      return;
    }
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const targetGain = isTurbo ? 0.15 : 0.03 + thrust01 * 0.08;
    this.jetpackGain.gain.setTargetAtTime(targetGain, now, 0.05);

    if (this.jetpackOsc) {
      const targetFreq = 75 + thrust01 * 95 + (isTurbo ? 50 : 0);
      this.jetpackOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    }
    if (this.jetpackFilter) {
      const targetFilterFreq = 1100 + thrust01 * 1800 + (isTurbo ? 700 : 0);
      this.jetpackFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.06);
    }
  }

  playJetpackEquip() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playJetpackStow() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  /** Drive the police siren. proximity 0..1 (1 = cop right next to you). */
  setSiren(active: boolean, proximity: number = 0) {
    if (!this.ctx || !this.sirenGain) return;
    const target = active ? 0.02 + Math.min(1, Math.max(0, proximity)) * 0.075 : 0;
    if (Math.abs(target - this.sirenTargetGain) < 0.002) return;
    this.sirenTargetGain = target;
    if (this.isMuted) return;
    this.ensureRunning();
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.18);
  }

  // Deep detuned brass hit + falling tone — the classic "you died" sting
  playWasted() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    [110, 138.6, 164.8].forEach((f, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 1.6);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16 - i * 0.03, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 1.7);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.85);
    });
  }

  // Two heavy cell-door clangs
  playBusted() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    [0, 0.42].forEach((t) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(196, now + t);
      osc.frequency.exponentialRampToValueAtTime(98, now + t + 0.35);
      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.5);

      const bufferSize = Math.round(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.18, now + t);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.14);
      src.connect(ng);
      ng.connect(this.ctx.destination);
      src.start(now + t);
    });
  }

  // Crisp tactical police firearm gunshot with muzzle report and shell casing ping
  playGunshot(volume: number = 0.5) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const vol = Math.min(1.0, Math.max(0.1, volume));

    // 1. Explosive noise crack
    const bufferSize = Math.round(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, now);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35 * vol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);

    // 2. Punchy sub-bass projectile shockwave
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    oscGain.gain.setValueAtTime(0.4 * vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // 3. High shell casing / metallic barrel ringing tail
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3200 + Math.random() * 400, now);
    ringGain.gain.setValueAtTime(0.08 * vol, now);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    ring.connect(ringGain);
    ringGain.connect(this.ctx.destination);
    ring.start(now);
    ring.stop(now + 0.23);
  }

  // Bullet impact sound (flesh thud or vehicle metal ricochet)
  playBulletImpact(isMetal: boolean = false) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Heavy thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isMetal ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isMetal ? 800 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(isMetal ? 2400 : 50, now + 0.08);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Police radio squelch + 10-99 lethal force broadcast alert tone
  playPoliceRadioLethal() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Radio static burst
    const bufferSize = Math.round(this.ctx.sampleRate * 0.1);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);

    // Urgent two-tone dispatch chirp
    [880, 1174].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.08 + i * 0.09);
      gain.gain.setValueAtTime(0.18, now + 0.08 + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16 + i * 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + 0.08 + i * 0.09);
      osc.stop(now + 0.18 + i * 0.09);
    });
  }

  // Triumphant ascending brass fanfare
  playMissionPassed() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const notes = [
      { f: 392.0, t: 0.0, d: 0.16 },   // G4
      { f: 523.25, t: 0.16, d: 0.16 }, // C5
      { f: 659.25, t: 0.32, d: 0.16 }, // E5
      { f: 783.99, t: 0.48, d: 0.75 }, // G5 (held)
    ];
    notes.forEach(({ f, t, d }) => {
      if (!this.ctx) return;
      [1, 0.5, 2].forEach((mult, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f * mult, now + t);
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(idx === 0 ? 0.14 : 0.06, now + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + d + 0.05);
      });
    });
  }

  // Sad descending minor motif
  playMissionFailed() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    [
      { f: 329.63, t: 0.0, d: 0.28 },
      { f: 311.13, t: 0.28, d: 0.28 },
      { f: 261.63, t: 0.56, d: 0.7 },
    ].forEach(({ f, t, d }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.18, now + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d);
    });
  }

  // Bright checkpoint blip
  playCheckpoint() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.07);
      gain.gain.setValueAtTime(0.2, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.2);
    });
  }

  // Sparkly collectible pickup
  playPackagePickup() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    [1046.5, 1318.5, 1568.0, 2093.0].forEach((f, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.05);
      gain.gain.setValueAtTime(0.15, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.32);
    });
  }

  // Short tense sting when the wanted level rises
  playWantedUp() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(277, now + 0.09);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  // Engine dying: sputtering low pops
  playEngineDie() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = i * 0.13 + Math.random() * 0.03;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90 - i * 8, now + t);
      osc.frequency.exponentialRampToValueAtTime(30, now + t + 0.1);
      gain.gain.setValueAtTime(0.16, now + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.13);
    }
  }

  updateEngine(speedKmh: number, isAccelerating: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || this.isMuted) return;
    this.ensureRunning();

    // Map speed (0 - 120 km/h) to frequency (50Hz - 220Hz)
    const baseFreq = 50 + Math.abs(speedKmh) * 1.35 + (isAccelerating ? 25 : 0);
    const filterFreq = 260 + Math.abs(speedKmh) * 5.0 + (isAccelerating ? 150 : 0);

    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);
  }

  setDrifting(drifting: boolean) {
    if (!this.ctx || !this.driftGain || this.isMuted) return;
    if (this.isDriftingActive === drifting) return;
    this.isDriftingActive = drifting;

    this.ensureRunning();
    const targetGain = drifting ? 0.12 : 0.0;
    this.driftGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.06);
  }

  playCrash(intensity: number = 0.5) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const clampedIntensity = Math.min(Math.max(intensity, 0.2), 1.0);

    // 1. Low frequency bass thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.2);

    oscGain.gain.setValueAtTime(0.25 * clampedIntensity, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // 2. Crunchy metal / plastic noise punch
    const bufferSize = Math.round(this.ctx.sampleRate * 0.18);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(450, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3 * clampedIntensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseSource.start(now);
  }

  playHorn(active: boolean) {
    if (!this.ctx || !this.hornGain || this.isMuted) return;
    if (this.isHornPlaying === active) return;
    this.isHornPlaying = active;
    this.ensureRunning();

    if (active) {
      const now = this.ctx.currentTime;
      this.hornOsc1 = this.ctx.createOscillator();
      this.hornOsc2 = this.ctx.createOscillator();
      this.hornOsc1.type = 'triangle';
      this.hornOsc2.type = 'triangle';
      this.hornOsc1.frequency.setValueAtTime(392, now); // G4
      this.hornOsc2.frequency.setValueAtTime(494, now); // B4

      this.hornOsc1.connect(this.hornGain);
      this.hornOsc2.connect(this.hornGain);
      this.hornOsc1.start();
      this.hornOsc2.start();
      this.hornGain.gain.setTargetAtTime(0.2, now, 0.03);
    } else {
      const now = this.ctx.currentTime;
      this.hornGain.gain.setTargetAtTime(0, now, 0.05);
      setTimeout(() => {
        try {
          this.hornOsc1?.stop();
          this.hornOsc2?.stop();
          this.hornOsc1?.disconnect();
          this.hornOsc2?.disconnect();
        } catch {
          // ignore
        }
      }, 100);
    }
  }

  playChime() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Play comical cartoon boing when an NPC is bumped and does a comedy tumble
  playCartoonBoing() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Play startled gasp/yelp when horn is honked or a car zooms dangerously close
  playPedestrianGasp() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.22);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Play surprised "hey!" / grunt when hero and pedestrian bump into each other on sidewalk
  playPedestrianGrunt() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Crisp mechanical car door handle unlatch
  playDoorLatch() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1400, now);
    osc1.frequency.exponentialRampToValueAtTime(600, now + 0.05);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2200, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(900, now + 0.07);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.06);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.08);
  }

  // Heavy solid metallic car door slam (*THUD*)
  playDoorSlam() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // 1. Deep low-frequency cabin thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.22);

    subGain.gain.setValueAtTime(0.38, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.25);

    // 2. Metallic latch clang
    const metalOsc = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metalOsc.type = 'triangle';
    metalOsc.frequency.setValueAtTime(520, now);
    metalOsc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    metalGain.gain.setValueAtTime(0.24, now);
    metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    metalOsc.connect(metalGain);
    metalGain.connect(this.ctx.destination);
    metalOsc.start(now);
    metalOsc.stop(now + 0.14);
  }

  // Starter crank turnover and throatier engine rev roar
  playEngineIgnition() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Crank pulse 1
    const crank1 = this.ctx.createOscillator();
    const crankGain1 = this.ctx.createGain();
    crank1.type = 'sawtooth';
    crank1.frequency.setValueAtTime(75, now);
    crank1.frequency.linearRampToValueAtTime(110, now + 0.1);
    crankGain1.gain.setValueAtTime(0.18, now);
    crankGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    crank1.connect(crankGain1);
    crankGain1.connect(this.ctx.destination);
    crank1.start(now);
    crank1.stop(now + 0.12);

    // Crank pulse 2
    const crank2 = this.ctx.createOscillator();
    const crankGain2 = this.ctx.createGain();
    crank2.type = 'sawtooth';
    crank2.frequency.setValueAtTime(95, now + 0.14);
    crank2.frequency.linearRampToValueAtTime(130, now + 0.24);
    crankGain2.gain.setValueAtTime(0.2, now + 0.14);
    crankGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    crank2.connect(crankGain2);
    crankGain2.connect(this.ctx.destination);
    crank2.start(now + 0.14);
    crank2.stop(now + 0.26);

    // Throttle rev roar (engine catching fire)
    const revOsc = this.ctx.createOscillator();
    const revFilter = this.ctx.createBiquadFilter();
    const revGain = this.ctx.createGain();

    revOsc.type = 'sawtooth';
    revOsc.frequency.setValueAtTime(60, now + 0.28);
    revOsc.frequency.exponentialRampToValueAtTime(210, now + 0.55);
    revOsc.frequency.exponentialRampToValueAtTime(75, now + 0.88);

    revFilter.type = 'lowpass';
    revFilter.frequency.setValueAtTime(220, now + 0.28);
    revFilter.frequency.exponentialRampToValueAtTime(650, now + 0.55);
    revFilter.frequency.exponentialRampToValueAtTime(260, now + 0.88);

    revGain.gain.setValueAtTime(0.001, now + 0.28);
    revGain.gain.exponentialRampToValueAtTime(0.32, now + 0.45);
    revGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    revOsc.connect(revFilter);
    revFilter.connect(revGain);
    revGain.connect(this.ctx.destination);

    revOsc.start(now + 0.28);
    revOsc.stop(now + 0.9);
  }

  // Body hit / tarmac slide impact sound
  playTumbleImpact() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Short annoyed vehicle horn beep for traffic cars
  playCarHornPulse() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(392, now); // G4
    osc2.frequency.setValueAtTime(494, now); // B4

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.setValueAtTime(0.18, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.28);
    osc2.stop(now + 0.28);
  }

  // Metallic coin jingle + cash register bell (*CHA-CHING!*)
  playCashRegister() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // 1. Coins clinking
    [0, 0.05, 0.09].forEach((offset, idx) => {
      if (!this.ctx) return;
      const coinOsc = this.ctx.createOscillator();
      const coinGain = this.ctx.createGain();
      coinOsc.type = 'sine';
      coinOsc.frequency.setValueAtTime(1760 + idx * 320, now + offset);
      coinGain.gain.setValueAtTime(0.16, now + offset);
      coinGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      coinOsc.connect(coinGain);
      coinGain.connect(this.ctx.destination);
      coinOsc.start(now + offset);
      coinOsc.stop(now + offset + 0.12);
    });

    // 2. Resonant cash register bell (E7 - 2637 Hz)
    const bellOsc = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(2637, now + 0.12);
    bellGain.gain.setValueAtTime(0.24, now + 0.12);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    bellOsc.connect(bellGain);
    bellGain.connect(this.ctx.destination);
    bellOsc.start(now + 0.12);
    bellOsc.stop(now + 0.75);
  }

  // Radio dispatch chirp & upbeat mission start fanfare
  playMissionStart() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Radio squelch / chirp
    const chirpOsc = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();
    chirpOsc.type = 'sawtooth';
    chirpOsc.frequency.setValueAtTime(800, now);
    chirpOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
    chirpGain.gain.setValueAtTime(0.12, now);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    chirpOsc.connect(chirpGain);
    chirpGain.connect(this.ctx.destination);
    chirpOsc.start(now);
    chirpOsc.stop(now + 0.09);

    // Rising two-tone fanfare
    [
      { freq: 523.25, time: 0.1, dur: 0.14 }, // C5
      { freq: 659.25, time: 0.22, dur: 0.25 }, // E5
    ].forEach(({ freq, time, dur }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);
      gain.gain.setValueAtTime(0.22, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  }

  // Electronic wrench / power-up confirmation chime
  playUpgradeInstalled() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.22);
    });
  }

  // Juicy cartoon blood splatter / squelch impact
  playBloodSplatter(volume: number = 0.35) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // 1. Low impact thud (body hitting pavement or vehicle bumper)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(130, now);
    thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    thudGain.gain.setValueAtTime(volume * 0.9, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thudOsc.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.16);

    // 2. Wet squelch burst (filtered white noise)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.06));
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(350, now + 0.18);
    noiseFilter.Q.setValueAtTime(3.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.75, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.2);

    // 3. Squelch pitch chirp (slap/splat transient)
    const splatOsc = this.ctx.createOscillator();
    const splatGain = this.ctx.createGain();
    splatOsc.type = 'triangle';
    splatOsc.frequency.setValueAtTime(380, now);
    splatOsc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
    splatGain.gain.setValueAtTime(volume * 0.45, now);
    splatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    splatOsc.connect(splatGain);
    splatGain.connect(this.ctx.destination);
    splatOsc.start(now);
    splatOsc.stop(now + 0.12);
  }
}

export const audioManager = new AudioManager();
