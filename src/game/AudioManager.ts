// Procedural Web Audio API sound synthesizer for Deep Rush City
// Features multi-harmonic combustion engine, 5-speed transmission, BOV, backfires,
// cryogenic nitro, electric hypercar whine, asphalt footsteps, dynamic drift & city ambience.

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;

  // Ambient city atmosphere
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientLfo: OscillatorNode | null = null;

  // Multi-harmonic engine nodes
  private engineMasterGain: GainNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineSubGain: GainNode | null = null;
  private engineMainOsc: OscillatorNode | null = null;
  private engineMainGain: GainNode | null = null;
  private engineHarmonicOsc: OscillatorNode | null = null;
  private engineHarmonicGain: GainNode | null = null;
  private engineElectricOsc: OscillatorNode | null = null;
  private engineElectricGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineResonance: BiquadFilterNode | null = null;

  // Turbocharger whine & Nitro hiss
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private nitroGain: GainNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroSubOsc: OscillatorNode | null = null;
  private nitroSubGain: GainNode | null = null;

  // Engine lifecycle & transmission state
  private isEngineRunning: boolean = false;
  private currentGear: number = 1;
  private currentRpm: number = 1000;
  private isShifting: boolean = false;
  private shiftTimer: number = 0;
  private prevAccelerating: boolean = false;
  private lastThrottleReleaseTime: number = 0;
  private currentVehicleType: string = '';

  // Drift & tire screech
  private driftGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private isDriftingActive: boolean = false;

  // Horn
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private isHornPlaying: boolean = false;

  // Settings & state
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
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master bus: Gain -> Dynamics Compressor -> Destination
      // Prevents all clipping, digital harshness, and speaker distortion
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.masterCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.masterCompressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.masterCompressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.masterGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.ctx.destination);

      this.setupAmbience();
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

  private get destination(): AudioNode {
    return this.masterGain || this.ctx!.destination;
  }

  private ensureRunning() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Urban Ambience ---
  private setupAmbience() {
    if (!this.ctx) return;

    // Loopable pink-filtered noise buffer
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.22;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    this.ambientFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    // Subtle wind gust LFO
    this.ambientLfo = this.ctx.createOscillator();
    this.ambientLfo.type = 'sine';
    this.ambientLfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(45, this.ctx.currentTime);
    this.ambientLfo.connect(lfoGain);
    lfoGain.connect(this.ambientFilter.frequency);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.024, this.ctx.currentTime);

    noiseSource.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.destination);

    noiseSource.start();
    this.ambientLfo.start();
  }

  setDayNightAmbience(isNight: boolean) {
    if (!this.ctx || !this.ambientFilter || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    if (isNight) {
      this.ambientFilter.frequency.setTargetAtTime(190, now, 2.0);
      this.ambientGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.018, now, 1.5);
    } else {
      this.ambientFilter.frequency.setTargetAtTime(290, now, 2.0);
      this.ambientGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.025, now, 1.5);
    }
  }

  // --- Multi-Harmonic Engine Synthesis ---
  private setupEngine() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.engineMasterGain = this.ctx.createGain();
    // Engine starts at 0 volume until player enters vehicle!
    this.engineMasterGain.gain.setValueAtTime(0.0, now);

    // Intake/exhaust lowpass filter
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(320, now);
    this.engineFilter.Q.setValueAtTime(1.8, now);

    // Exhaust body resonance peaking filter
    this.engineResonance = this.ctx.createBiquadFilter();
    this.engineResonance.type = 'peaking';
    this.engineResonance.frequency.setValueAtTime(160, now);
    this.engineResonance.Q.setValueAtTime(2.2, now);
    this.engineResonance.gain.setValueAtTime(5.0, now);

    // 1. Sub-bass cylinder pulse (fundamental)
    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.setValueAtTime(35, now);
    this.engineSubGain = this.ctx.createGain();
    this.engineSubGain.gain.setValueAtTime(0.38, now);
    this.engineSubOsc.connect(this.engineSubGain);

    // 2. Main harmonic (sawtooth)
    this.engineMainOsc = this.ctx.createOscillator();
    this.engineMainOsc.type = 'sawtooth';
    this.engineMainOsc.frequency.setValueAtTime(52, now);
    this.engineMainGain = this.ctx.createGain();
    this.engineMainGain.gain.setValueAtTime(0.32, now);
    this.engineMainOsc.connect(this.engineMainGain);

    // 3. Secondary detuned harmonic (sawtooth detuned +6 cents)
    this.engineHarmonicOsc = this.ctx.createOscillator();
    this.engineHarmonicOsc.type = 'sawtooth';
    this.engineHarmonicOsc.detune.setValueAtTime(6, now);
    this.engineHarmonicOsc.frequency.setValueAtTime(104, now);
    this.engineHarmonicGain = this.ctx.createGain();
    this.engineHarmonicGain.gain.setValueAtTime(0.18, now);
    this.engineHarmonicOsc.connect(this.engineHarmonicGain);

    // 4. Electric hypercar stator inverter sine whine
    this.engineElectricOsc = this.ctx.createOscillator();
    this.engineElectricOsc.type = 'sine';
    this.engineElectricOsc.frequency.setValueAtTime(320, now);
    this.engineElectricGain = this.ctx.createGain();
    this.engineElectricGain.gain.setValueAtTime(0.0, now); // combustion default
    this.engineElectricOsc.connect(this.engineElectricGain);

    // Mix engine harmonics into resonance -> filter -> master engine gain
    this.engineSubGain.connect(this.engineResonance);
    this.engineMainGain.connect(this.engineResonance);
    this.engineHarmonicGain.connect(this.engineResonance);
    this.engineElectricGain.connect(this.engineFilter);

    this.engineResonance.connect(this.engineFilter);
    this.engineFilter.connect(this.engineMasterGain);
    this.engineMasterGain.connect(this.destination);

    this.engineSubOsc.start();
    this.engineMainOsc.start();
    this.engineHarmonicOsc.start();
    this.engineElectricOsc.start();

    // 5. Turbocharger whine
    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.setValueAtTime(1400, now);
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.setValueAtTime(0.0, now);
    this.turboOsc.connect(this.turboGain);
    this.turboGain.connect(this.destination);
    this.turboOsc.start();

    // 6. Cryogenic Nitro Injection (high pressure hiss + sub rumble)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const nData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) nData[i] = Math.random() * 2 - 1;

    const nitroNoise = this.ctx.createBufferSource();
    nitroNoise.buffer = noiseBuffer;
    nitroNoise.loop = true;

    this.nitroFilter = this.ctx.createBiquadFilter();
    this.nitroFilter.type = 'bandpass';
    this.nitroFilter.frequency.setValueAtTime(2200, now);
    this.nitroFilter.Q.setValueAtTime(2.6, now);

    this.nitroGain = this.ctx.createGain();
    this.nitroGain.gain.setValueAtTime(0.0, now);

    this.nitroSubOsc = this.ctx.createOscillator();
    this.nitroSubOsc.type = 'sine';
    this.nitroSubOsc.frequency.setValueAtTime(48, now);
    this.nitroSubGain = this.ctx.createGain();
    this.nitroSubGain.gain.setValueAtTime(0.0, now);
    this.nitroSubOsc.connect(this.nitroSubGain);
    this.nitroSubGain.connect(this.destination);
    this.nitroSubOsc.start();

    nitroNoise.connect(this.nitroFilter);
    this.nitroFilter.connect(this.nitroGain);
    this.nitroGain.connect(this.destination);
    nitroNoise.start();
  }

  startEngine(vehicleType?: string) {
    if (!this.ctx || !this.engineMasterGain) return;
    this.ensureRunning();
    this.isEngineRunning = true;
    this.currentVehicleType = vehicleType || '';
    this.currentGear = 1;
    this.currentRpm = 1100;
    this.isShifting = false;

    const now = this.ctx.currentTime;
    const isElectric = this.currentVehicleType === 'Futuristic_Car_1';

    if (isElectric) {
      this.engineElectricGain?.gain.setTargetAtTime(0.25, now, 0.1);
      this.engineSubGain?.gain.setTargetAtTime(0.12, now, 0.1);
      this.engineMainGain?.gain.setTargetAtTime(0.06, now, 0.1);
      this.engineHarmonicGain?.gain.setTargetAtTime(0.04, now, 0.1);
    } else {
      this.engineElectricGain?.gain.setTargetAtTime(0.0, now, 0.1);
      this.engineSubGain?.gain.setTargetAtTime(0.38, now, 0.1);
      this.engineMainGain?.gain.setTargetAtTime(0.32, now, 0.1);
      this.engineHarmonicGain?.gain.setTargetAtTime(0.18, now, 0.1);
    }

    if (!this.isMuted) {
      this.engineMasterGain.gain.setTargetAtTime(0.09, now, 0.2);
    }
  }

  public stopVehicleAudio() {
    if (!this.ctx) return;
    this.isEngineRunning = false;
    this.isDriftingActive = false;
    const now = this.ctx.currentTime;

    // 1. Immediately cut master engine volume
    if (this.engineMasterGain) {
      this.engineMasterGain.gain.cancelScheduledValues(now);
      this.engineMasterGain.gain.setValueAtTime(this.engineMasterGain.gain.value, now);
      this.engineMasterGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
    }
    // 2. Immediately cut turbo & nitro gains
    if (this.turboGain) {
      this.turboGain.gain.cancelScheduledValues(now);
      this.turboGain.gain.setValueAtTime(this.turboGain.gain.value, now);
      this.turboGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
    }
    if (this.nitroGain) {
      this.nitroGain.gain.cancelScheduledValues(now);
      this.nitroGain.gain.setValueAtTime(this.nitroGain.gain.value, now);
      this.nitroGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
    }
    if (this.nitroSubGain) {
      this.nitroSubGain.gain.cancelScheduledValues(now);
      this.nitroSubGain.gain.setValueAtTime(this.nitroSubGain.gain.value, now);
      this.nitroSubGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
    }
    // 3. Immediately silence tire screech / drift loop
    if (this.driftGain) {
      this.driftGain.gain.cancelScheduledValues(now);
      this.driftGain.gain.setValueAtTime(this.driftGain.gain.value, now);
      this.driftGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
    }
    // 4. Immediately silence horn
    if (this.isHornPlaying || (this.hornGain && this.hornGain.gain.value > 0.001)) {
      this.isHornPlaying = false;
      if (this.hornGain) {
        this.hornGain.gain.cancelScheduledValues(now);
        this.hornGain.gain.setValueAtTime(this.hornGain.gain.value, now);
        this.hornGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
      }
      setTimeout(() => {
        try {
          this.hornOsc1?.stop();
          this.hornOsc2?.stop();
          this.hornOsc1?.disconnect();
          this.hornOsc2?.disconnect();
          this.hornOsc1 = null;
          this.hornOsc2 = null;
        } catch {
          // ignore
        }
      }, 60);
    }
  }

  stopEngine() {
    this.stopVehicleAudio();
  }

  /**
   * Real-time engine audio with 5-speed transmission, RPM curve, BOV, backfires & nitro.
   */
  updateEngine(
    speedKmh: number,
    isAccelerating: boolean,
    isBoosting: boolean = false,
    vehicleType?: string,
    physicalRpm?: number,
    physicalGear?: number | string
  ) {
    if (!this.ctx || !this.engineMasterGain || this.isMuted || !this.isEngineRunning) {
      const now = this.ctx ? this.ctx.currentTime : 0;
      if (this.engineMasterGain && (!this.isEngineRunning || this.isMuted)) {
        this.engineMasterGain.gain.setTargetAtTime(0, now, 0.05);
      }
      if (this.turboGain && (!this.isEngineRunning || this.isMuted)) {
        this.turboGain.gain.setTargetAtTime(0, now, 0.05);
      }
      if (this.nitroGain && (!this.isEngineRunning || this.isMuted)) {
        this.nitroGain.gain.setTargetAtTime(0, now, 0.05);
      }
      if (this.nitroSubGain && (!this.isEngineRunning || this.isMuted)) {
        this.nitroSubGain.gain.setTargetAtTime(0, now, 0.05);
      }
      return;
    }
    this.ensureRunning();
    const now = this.ctx.currentTime;
    if (vehicleType) this.currentVehicleType = vehicleType;

    const absSpeed = Math.abs(speedKmh);
    const isElectric = this.currentVehicleType === 'Futuristic_Car_1';

    // 1. Transmission & Gear Tracking
    if (physicalGear !== undefined) {
      const parsedGear = typeof physicalGear === 'number' ? physicalGear : parseInt(physicalGear, 10) || 1;
      if (!isElectric && parsedGear > this.currentGear && this.currentGear > 0) {
        this.isShifting = true;
        this.shiftTimer = now + 0.085;
      }
      this.currentGear = parsedGear > 0 ? parsedGear : 1;
    } else {
      let newGear = 1;
      if (absSpeed < 32) newGear = 1;
      else if (absSpeed < 64) newGear = 2;
      else if (absSpeed < 100) newGear = 3;
      else if (absSpeed < 140) newGear = 4;
      else newGear = 5;

      if (!isElectric && newGear > this.currentGear) {
        this.isShifting = true;
        this.shiftTimer = now + 0.1;
      }
      this.currentGear = newGear;
    }

    if (this.isShifting && now > this.shiftTimer) {
      this.isShifting = false;
    }

    // 2. RPM calculation (honors true physical engine RPM when available)
    if (physicalRpm !== undefined) {
      this.currentRpm += (physicalRpm - this.currentRpm) * 0.28;
    } else {
      let targetRpm = 1000;
      if (isElectric) {
        // Hypercar linear power band
        targetRpm = 1200 + absSpeed * 32 + (isAccelerating ? 600 : 0) + (isBoosting ? 1400 : 0);
      } else {
        const gearRanges = [
          { min: 0, max: 35 },
          { min: 25, max: 68 },
          { min: 54, max: 105 },
          { min: 88, max: 146 },
          { min: 125, max: 215 },
        ];
        const range = gearRanges[this.currentGear - 1] || gearRanges[4];
        const speedInGear = Math.max(0, Math.min(1, (absSpeed - range.min) / (range.max - range.min)));
        targetRpm =
          1100 +
          speedInGear * 4800 +
          (isAccelerating ? 700 : 0) +
          (isBoosting ? 1100 : 0);

        if (this.isShifting) {
          targetRpm *= 0.72; // Clutch dip
        }
      }
      targetRpm = Math.max(900, Math.min(6800, targetRpm));
      this.currentRpm += (targetRpm - this.currentRpm) * 0.18;
    }

    // 3. Exhaust Overrun Backfires & Blow-off Valve on throttle lift-off
    if (this.prevAccelerating && !isAccelerating && now - this.lastThrottleReleaseTime > 0.6) {
      this.lastThrottleReleaseTime = now;
      if (this.currentRpm > 3600 && !isElectric) {
        this.triggerExhaustBurble();
        if (isBoosting || this.currentRpm > 4600) {
          this.triggerBlowOffValve();
        }
      }
    }
    this.prevAccelerating = isAccelerating;

    // 4. Harmonic Frequencies based on RPM
    if (isElectric) {
      const statorFreq = 300 + (this.currentRpm / 6800) * 1650 + (isBoosting ? 250 : 0);
      this.engineElectricOsc?.frequency.setTargetAtTime(statorFreq, now, 0.06);
      this.engineFilter?.frequency.setTargetAtTime(2200, now, 0.08);

      const targetGain = 0.07 + (absSpeed / 160) * 0.05 + (isAccelerating ? 0.025 : 0);
      this.engineMasterGain.gain.setTargetAtTime(targetGain, now, 0.06);
    } else {
      // 4-cylinder engine fundamental firing rate
      const baseFreq = (this.currentRpm / 60) * 0.75;
      this.engineSubOsc?.frequency.setTargetAtTime(Math.max(26, baseFreq * 0.78), now, 0.07);
      this.engineMainOsc?.frequency.setTargetAtTime(Math.max(45, baseFreq * 1.5), now, 0.07);
      this.engineHarmonicOsc?.frequency.setTargetAtTime(Math.max(90, baseFreq * 2.25), now, 0.07);

      // Intake/Exhaust filter opens as throttle/RPM rises
      const filterCutoff =
        260 +
        (this.currentRpm / 6800) * 1900 +
        (isAccelerating ? 450 : 0) +
        (isBoosting ? 650 : 0);
      this.engineFilter?.frequency.setTargetAtTime(filterCutoff, now, 0.08);

      // Resonant chamber frequency follows engine load
      const resFreq = 140 + (this.currentRpm / 6800) * 260;
      this.engineResonance?.frequency.setTargetAtTime(resFreq, now, 0.08);

      let targetGain =
        0.08 +
        (this.currentRpm / 6800) * 0.05 +
        (isAccelerating ? 0.03 : 0) +
        (isBoosting ? 0.04 : 0);
      if (this.isShifting) targetGain *= 0.65;
      this.engineMasterGain.gain.setTargetAtTime(targetGain, now, 0.06);
    }

    // 5. Turbocharger Spool Whine
    if (this.turboGain && this.turboOsc) {
      const turboTargetGain =
        isBoosting
          ? 0.042
          : isAccelerating && this.currentRpm > 3200
          ? 0.016
          : 0.0001;
      const turboTargetFreq = 1500 + (this.currentRpm / 6800) * 2200;
      this.turboGain.gain.setTargetAtTime(turboTargetGain, now, 0.1);
      this.turboOsc.frequency.setTargetAtTime(turboTargetFreq, now, 0.08);
    }

    // 6. Cryogenic Nitro Blast
    if (this.nitroGain && this.nitroSubGain) {
      const nitroTargetGain = isBoosting ? 0.11 : 0.0;
      const nitroSubTarget = isBoosting ? 0.08 : 0.0;
      this.nitroGain.gain.setTargetAtTime(nitroTargetGain, now, 0.05);
      this.nitroSubGain.gain.setTargetAtTime(nitroSubTarget, now, 0.05);
    }
  }

  // Exhaust burble & crackle pops (*pop-pop-burble*)
  public triggerExhaustBurble() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const popCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < popCount; i++) {
      const delay = i * 0.07 + Math.random() * 0.04;
      const popTime = now + delay;

      // 1. Bass thud of cylinder overrun combustion
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(95 + Math.random() * 25, popTime);
      subOsc.frequency.exponentialRampToValueAtTime(26, popTime + 0.06);
      subGain.gain.setValueAtTime(0.18, popTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.07);
      subOsc.connect(subGain);
      subGain.connect(this.destination);
      subOsc.start(popTime);
      subOsc.stop(popTime + 0.07);

      // 2. High exhaust manifold crackle
      const bufferSize = Math.round(this.ctx.sampleRate * 0.035);
      const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.25));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600 + Math.random() * 400, popTime);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, popTime);
      gain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.04);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.destination);
      noise.start(popTime);
    }
  }

  // Wastegate Blow-off Valve flutter (*pssh-stututu*)
  public triggerBlowOffValve() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Initial pressure release whoosh
    const bufferSize = Math.round(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const whoosh = this.ctx.createBufferSource();
    whoosh.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    whoosh.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    whoosh.start(now);

    // 3 rapid flutter pulses
    [0.06, 0.11, 0.15].forEach((t, idx) => {
      if (!this.ctx) return;
      const pSize = Math.round(this.ctx.sampleRate * 0.04);
      const pBuf = this.ctx.createBuffer(1, pSize, this.ctx.sampleRate);
      const pData = pBuf.getChannelData(0);
      for (let i = 0; i < pSize; i++) pData[i] = Math.random() * 2 - 1;

      const pNoise = this.ctx.createBufferSource();
      pNoise.buffer = pBuf;
      const pFilter = this.ctx.createBiquadFilter();
      pFilter.type = 'bandpass';
      pFilter.frequency.setValueAtTime(1700 - idx * 200, now + t);
      pFilter.Q.setValueAtTime(3.5, now + t);
      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime(0.08 - idx * 0.025, now + t);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.035);
      pNoise.connect(pFilter);
      pFilter.connect(pGain);
      pGain.connect(this.destination);
      pNoise.start(now + t);
    });
  }

  // --- Drift & Tire Audio ---
  private setupDrift() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(1050, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(3.8, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.destination);
    noiseSource.start();
  }

  setDrifting(drifting: boolean, slipIntensity: number = 1.0, speedKmh: number = 50) {
    if (!this.ctx || !this.driftGain || !this.driftFilter || this.isMuted) return;
    if (!this.isEngineRunning) {
      if (this.driftGain.gain.value > 0.001) {
        this.driftGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.04);
      }
      this.isDriftingActive = false;
      return;
    }
    this.isDriftingActive = drifting;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    if (drifting) {
      const clampedSlip = Math.min(1.6, Math.max(0.4, slipIntensity));
      const targetGain = Math.min(0.2, 0.06 + clampedSlip * 0.065 + (speedKmh / 160) * 0.05);
      const targetFreq = 920 + Math.min(600, (speedKmh / 120) * 500);

      this.driftGain.gain.setTargetAtTime(targetGain, now, 0.05);
      this.driftFilter.frequency.setTargetAtTime(targetFreq, now, 0.05);
    } else {
      this.driftGain.gain.setTargetAtTime(0.0, now, 0.06);
    }
  }

  // Burnout launch chirp when launching full throttle from stationary
  playTireBurnoutChirp() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const bufferSize = Math.round(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, now);
    filter.frequency.exponentialRampToValueAtTime(850, now + 0.12);
    filter.Q.setValueAtTime(4.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    noise.start(now);
  }

  // Mechanical handbrake ratchet click (*chk-chk*)
  playHandbrakeClick() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    [0, 0.035].forEach((t, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 2400 : 2800, now + t);
      osc.frequency.exponentialRampToValueAtTime(1200, now + t + 0.02);

      gain.gain.setValueAtTime(0.14, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.025);

      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.025);
    });
  }

  // --- Protagonist Footsteps & On-Foot Audio ---
  playFootstep(isSprinting: boolean = false) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const pitchVar = 0.94 + Math.random() * 0.12;
    const vol = isSprinting ? 0.16 : 0.11;

    // 1. Shoe sole asphalt impact thump
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime((isSprinting ? 125 : 100) * pitchVar, now);
    thud.frequency.exponentialRampToValueAtTime(36, now + 0.05);

    thudGain.gain.setValueAtTime(vol, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    thud.connect(thudGain);
    thudGain.connect(this.destination);
    thud.start(now);
    thud.stop(now + 0.06);

    // 2. High asphalt grit / shoe texture friction
    const bufferSize = Math.round(this.ctx.sampleRate * 0.035);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const grit = this.ctx.createBufferSource();
    grit.buffer = buf;
    const gritFilter = this.ctx.createBiquadFilter();
    gritFilter.type = 'highpass';
    gritFilter.frequency.setValueAtTime((isSprinting ? 1800 : 1400) * pitchVar, now);

    const gritGain = this.ctx.createGain();
    gritGain.gain.setValueAtTime(vol * 0.65, now);
    gritGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    grit.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(this.destination);
    grit.start(now);
  }

  playJump() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Shoe sole liftoff scuff + upward whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playLand(impactSpeed: number = 5) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const intensity = Math.min(1.0, Math.max(0.25, impactSpeed / 10));

    // Heavy pavement landing thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.16);

    gain.gain.setValueAtTime(0.3 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    // Shoe grit impact dispersion
    const bufferSize = Math.round(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.2 * intensity, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.destination);
    noise.start(now);
  }

  // --- Parachute Sound Effects ---
  playParachuteDeploy() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // 1. Sharp pilot chute / deployment cord snap
    const bufferSize = Math.round(this.ctx.sampleRate * 0.25);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

    const snap = this.ctx.createBufferSource();
    snap.buffer = buf;
    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(1800, now);
    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.42, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    snap.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.destination);
    snap.start(now);

    // 2. Heavy canvas inflation whoosh & air capture
    const whoosh = this.ctx.createBufferSource();
    whoosh.buffer = buf;
    const whooshFilter = this.ctx.createBiquadFilter();
    whooshFilter.type = 'lowpass';
    whooshFilter.frequency.setValueAtTime(450, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.16);
    whooshFilter.frequency.exponentialRampToValueAtTime(320, now + 0.42);
    const whooshGain = this.ctx.createGain();
    whooshGain.gain.setValueAtTime(0.01, now);
    whooshGain.gain.linearRampToValueAtTime(0.38, now + 0.12);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(this.destination);
    whoosh.start(now);

    // 3. Low aerodynamic jolt thud as canopy catches air
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(95, now + 0.05);
    thud.frequency.exponentialRampToValueAtTime(32, now + 0.28);
    thudGain.gain.setValueAtTime(0.26, now + 0.05);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    thud.connect(thudGain);
    thudGain.connect(this.destination);
    thud.start(now + 0.05);
    thud.stop(now + 0.32);
  }

  playParachuteCut() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const bufferSize = Math.round(this.ctx.sampleRate * 0.1);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

    const cut = this.ctx.createBufferSource();
    cut.buffer = buf;
    const cutFilter = this.ctx.createBiquadFilter();
    cutFilter.type = 'bandpass';
    cutFilter.frequency.setValueAtTime(2400, now);
    cutFilter.Q.setValueAtTime(3.0, now);
    const cutGain = this.ctx.createGain();
    cutGain.gain.setValueAtTime(0.35, now);
    cutGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    cut.connect(cutFilter);
    cutFilter.connect(cutGain);
    cutGain.connect(this.destination);
    cut.start(now);
  }

  // --- UI Sound Effects ---
  playUiClick() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.025);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  // --- Horn ---
  private setupHorn() {
    if (!this.ctx) return;
    this.hornGain = this.ctx.createGain();
    this.hornGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.hornGain.connect(this.destination);
  }

  playHorn(active: boolean) {
    if (!this.ctx || !this.hornGain || this.isMuted) return;
    if (!this.isEngineRunning && active) return;
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

  // --- Police Siren ---
  private setupSiren() {
    if (!this.ctx) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(760, this.ctx.currentTime);

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
    this.sirenGain.connect(this.destination);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  setSiren(active: boolean, proximity: number = 0) {
    if (!this.ctx || !this.sirenGain) return;
    const target = active ? 0.02 + Math.min(1, Math.max(0, proximity)) * 0.075 : 0;
    if (Math.abs(target - this.sirenTargetGain) < 0.002) return;
    this.sirenTargetGain = target;
    if (this.isMuted) return;
    this.ensureRunning();
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.18);
  }

  // --- Jetpack Thruster Audio ---
  private setupJetpack() {
    if (!this.ctx) return;
    this.jetpackGain = this.ctx.createGain();
    this.jetpackGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.jetpackGain.connect(this.destination);

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
    gain.connect(this.destination);
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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  // --- Sound Effects Library ---
  setMuted(muted: boolean) {
    this.isMuted = muted;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1.0, now, 0.05);
    }
    if (this.engineMasterGain && this.ctx) {
      this.engineMasterGain.gain.setTargetAtTime(
        muted ? 0 : this.isEngineRunning ? 0.09 : 0,
        now,
        0.05
      );
    }
    if (this.driftGain && this.ctx && muted) {
      this.driftGain.gain.setTargetAtTime(0, now, 0.05);
    }
    if (this.sirenGain && this.ctx) {
      this.sirenGain.gain.setTargetAtTime(muted ? 0 : this.sirenTargetGain, now, 0.1);
    }
    if (this.jetpackGain && this.ctx && muted) {
      this.jetpackGain.gain.setTargetAtTime(0, now, 0.05);
    }
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.024, now, 0.1);
    }
  }

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
      gain.connect(this.destination);
      osc.start(now);
      osc.stop(now + 1.85);
    });
  }

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
      gain.connect(this.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.5);

      const bufferSize = Math.round(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.18, now + t);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.14);
      src.connect(ng);
      ng.connect(this.destination);
      src.start(now + t);
    });
  }

  playGunshot(volume: number = 0.5) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const vol = Math.min(1.0, Math.max(0.1, volume));

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
    noiseGain.connect(this.destination);
    noise.start(now);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    oscGain.gain.setValueAtTime(0.4 * vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(oscGain);
    oscGain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3200 + Math.random() * 400, now);
    ringGain.gain.setValueAtTime(0.08 * vol, now);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    ring.connect(ringGain);
    ringGain.connect(this.destination);
    ring.start(now);
    ring.stop(now + 0.23);
  }

  playBulletImpact(isMetal: boolean = false) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isMetal ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isMetal ? 800 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(isMetal ? 2400 : 50, now + 0.08);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playPoliceRadioLethal() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

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
    noiseGain.connect(this.destination);
    noise.start(now);

    [880, 1174].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.08 + i * 0.09);
      gain.gain.setValueAtTime(0.18, now + 0.08 + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16 + i * 0.09);
      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(now + 0.08 + i * 0.09);
      osc.stop(now + 0.18 + i * 0.09);
    });
  }

  playMissionPassed() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const notes = [
      { f: 392.0, t: 0.0, d: 0.16 }, // G4
      { f: 523.25, t: 0.16, d: 0.16 }, // C5
      { f: 659.25, t: 0.32, d: 0.16 }, // E5
      { f: 783.99, t: 0.48, d: 0.75 }, // G5
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
        gain.connect(this.destination);
        osc.start(now + t);
        osc.stop(now + t + d + 0.05);
      });
    });
  }

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
      gain.connect(this.destination);
      osc.start(now + t);
      osc.stop(now + t + d);
    });
  }

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
      gain.connect(this.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.2);
    });
  }

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
      gain.connect(this.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.32);
    });
  }

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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

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
      gain.connect(this.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.13);
    }
  }

  playCrash(intensity: number = 0.5) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const clampedIntensity = Math.min(Math.max(intensity, 0.2), 1.0);

    // Deep sub-bass punch
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
    oscGain.gain.setValueAtTime(0.28 * clampedIntensity, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(oscGain);
    oscGain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.26);

    // Metal / composite impact crunch
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
    noiseFilter.frequency.setValueAtTime(520, now);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.32 * clampedIntensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.destination);
    noiseSource.start(now);
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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

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
    gain.connect(this.destination);

    osc1.start(now);
    osc1.stop(now + 0.06);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.08);
  }

  playDoorSlam() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
    subGain.gain.setValueAtTime(0.38, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    subOsc.connect(subGain);
    subGain.connect(this.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.25);

    const metalOsc = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metalOsc.type = 'triangle';
    metalOsc.frequency.setValueAtTime(520, now);
    metalOsc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    metalGain.gain.setValueAtTime(0.24, now);
    metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    metalOsc.connect(metalGain);
    metalGain.connect(this.destination);
    metalOsc.start(now);
    metalOsc.stop(now + 0.14);
  }

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
    crankGain1.connect(this.destination);
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
    crankGain2.connect(this.destination);
    crank2.start(now + 0.14);
    crank2.stop(now + 0.26);

    // Roar blip
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
    revGain.connect(this.destination);

    revOsc.start(now + 0.28);
    revOsc.stop(now + 0.9);
  }

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
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

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
    gain.connect(this.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.28);
    osc2.stop(now + 0.28);
  }

  playCashRegister() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    [0, 0.05, 0.09].forEach((offset, idx) => {
      if (!this.ctx) return;
      const coinOsc = this.ctx.createOscillator();
      const coinGain = this.ctx.createGain();
      coinOsc.type = 'sine';
      coinOsc.frequency.setValueAtTime(1760 + idx * 320, now + offset);
      coinGain.gain.setValueAtTime(0.16, now + offset);
      coinGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      coinOsc.connect(coinGain);
      coinGain.connect(this.destination);
      coinOsc.start(now + offset);
      coinOsc.stop(now + offset + 0.12);
    });

    const bellOsc = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(2637, now + 0.12);
    bellGain.gain.setValueAtTime(0.24, now + 0.12);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    bellOsc.connect(bellGain);
    bellGain.connect(this.destination);
    bellOsc.start(now + 0.12);
    bellOsc.stop(now + 0.75);
  }

  playMissionStart() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const chirpOsc = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();
    chirpOsc.type = 'sawtooth';
    chirpOsc.frequency.setValueAtTime(800, now);
    chirpOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
    chirpGain.gain.setValueAtTime(0.12, now);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    chirpOsc.connect(chirpGain);
    chirpGain.connect(this.destination);
    chirpOsc.start(now);
    chirpOsc.stop(now + 0.09);

    [
      { freq: 523.25, time: 0.1, dur: 0.14 },
      { freq: 659.25, time: 0.22, dur: 0.25 },
    ].forEach(({ freq, time, dur }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);
      gain.gain.setValueAtTime(0.22, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  }

  playUpgradeInstalled() {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.22);
    });
  }

  playBloodSplatter(volume: number = 0.35) {
    if (!this.ctx || this.isMuted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(130, now);
    thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    thudGain.gain.setValueAtTime(volume * 0.9, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thudOsc.connect(thudGain);
    thudGain.connect(this.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.16);

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
    noiseGain.connect(this.destination);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.2);

    const splatOsc = this.ctx.createOscillator();
    const splatGain = this.ctx.createGain();
    splatOsc.type = 'triangle';
    splatOsc.frequency.setValueAtTime(380, now);
    splatOsc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
    splatGain.gain.setValueAtTime(volume * 0.45, now);
    splatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    splatOsc.connect(splatGain);
    splatGain.connect(this.destination);
    splatOsc.start(now);
    splatOsc.stop(now + 0.12);
  }
}

export const audioManager = new AudioManager();
