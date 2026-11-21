// ---------------------------------------------------------------------------
// Sound, all synthesised in the browser: no sample files, no loading screens.
// Impacts are filtered noise, engines are saw oscillators, explosions are a
// noise crack over a falling sine, and the city has its own quiet bed.
// ---------------------------------------------------------------------------

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.65;
    this.listener = { x: 0, y: 0, z: 0 };
    this.engine = null;
    this.ambient = null;
    this.started = false;
    this.lastImpact = 0;
  }

  setListener(position) {
    this.listener.x = position.x;
    this.listener.y = position.y;
    this.listener.z = position.z;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.started = true;
    this.noiseBuffer = this.makeNoise(2);
    this.startAmbient();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // -------------------------------------------------------------------------
  // Mixing helpers
  // -------------------------------------------------------------------------
  channel(position, gainValue = 1) {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner && position) {
      const pan = Math.max(-1, Math.min(1, (position.x - this.listener.x) / 26));
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    return gain;
  }

  distanceGain(position, radius = 40) {
    if (!position) return 1;
    const dx = position.x - this.listener.x;
    const dy = (position.y || 0) - this.listener.y;
    const dz = position.z - this.listener.z;
    const distance = Math.hypot(dx, dy, dz);
    return Math.max(0, 1 - distance / radius) ** 1.5;
  }

  noiseBurst({ position, duration = 0.2, frequency = 800, q = 1.2, gain = 0.3, type = 'lowpass', sweep = 0 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, now);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + sweep), now + duration);
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const out = this.channel(position, 1);
    source.connect(filter);
    filter.connect(env);
    env.connect(out);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  tone({ position, frequency = 220, duration = 0.2, gain = 0.2, type = 'sine', sweepTo = null }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), now + duration);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const out = this.channel(position, 1);
    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // -------------------------------------------------------------------------
  // Game sounds
  // -------------------------------------------------------------------------
  impact(position, strength = 0.5, material = 'concrete') {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastImpact < 45) return; // do not stack a hundred contacts in one frame
    this.lastImpact = now;
    const gain = Math.min(0.45, 0.1 + strength * 0.4) * this.distanceGain(position, 60);
    if (gain < 0.01) return;
    if (material === 'metal') {
      this.noiseBurst({ position, duration: 0.16, frequency: 2600, q: 1.4, gain: gain * 0.5, type: 'bandpass' });
      this.tone({ position, frequency: 720 + strength * 400, duration: 0.22, gain: gain * 0.24, type: 'triangle', sweepTo: 420 });
    } else if (material === 'wood') {
      this.noiseBurst({ position, duration: 0.14, frequency: 420, q: 1.1, gain });
      this.tone({ position, frequency: 150, duration: 0.16, gain: gain * 0.4, type: 'triangle', sweepTo: 90 });
    } else {
      this.noiseBurst({ position, duration: 0.26, frequency: 300, q: 0.9, gain });
      this.tone({ position, frequency: 78, duration: 0.24, gain: gain * 0.6, type: 'sine', sweepTo: 44 });
    }
  }

  explosion(position, strength = 1) {
    if (!this.ctx) return;
    const gain = this.distanceGain(position, 130) * (0.35 + strength * 0.4);
    if (gain < 0.01) return;
    this.noiseBurst({ position, duration: 0.9, frequency: 1400, q: 0.6, gain: gain * 1.1, sweep: -1200 });
    this.tone({ position, frequency: 120, duration: 1.1, gain: gain * 0.9, type: 'sine', sweepTo: 32 });
    this.tone({ position, frequency: 62, duration: 0.7, gain: gain * 0.6, type: 'triangle', sweepTo: 28 });
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!this.ctx) return;
        this.noiseBurst({ position, duration: 0.12, frequency: 2200, q: 1.6, gain: gain * 0.18, type: 'bandpass' });
      }, 90 + i * 60 + Math.random() * 80);
    }
  }

  collapse(position, strength = 1) {
    if (!this.ctx) return;
    const gain = this.distanceGain(position, 110) * (0.22 + strength * 0.35);
    if (gain < 0.01) return;
    this.noiseBurst({ position, duration: 1.5, frequency: 260, q: 0.7, gain: gain, sweep: -150 });
    this.tone({ position, frequency: 48, duration: 1.4, gain: gain * 0.7, type: 'sine', sweepTo: 24 });
  }

  pop(position, strength = 0.3) {
    if (!this.ctx) return;
    const gain = this.distanceGain(position, 40) * strength * 0.4;
    if (gain < 0.01) return;
    this.tone({ position, frequency: 340, duration: 0.1, gain, type: 'triangle', sweepTo: 180 });
  }

  ui() {
    if (!this.ctx) return;
    this.tone({ position: null, frequency: 620, duration: 0.06, gain: 0.08, type: 'square' });
  }

  screech(intensity, position) {
    if (!this.ctx) return;
    if (intensity < 0.15) return;
    this.noiseBurst({ position, duration: 0.14, frequency: 1500 + intensity * 900, q: 2.4, gain: intensity * 0.12, type: 'bandpass' });
  }

  // -------------------------------------------------------------------------
  // Engine, driven by the player's vehicle each frame
  // -------------------------------------------------------------------------
  startEngine() {
    if (!this.ctx || this.engine) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const sub = this.ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 30;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 3;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    sub.start();
    this.engine = { osc, sub, filter, gain };
  }

  updateEngine(speed, throttle, active) {
    if (!this.ctx || !this.engine) return;
    const now = this.ctx.currentTime;
    const targetGain = active ? 0.045 + Math.abs(throttle) * 0.05 : 0.0001;
    const rpm = 55 + Math.min(240, Math.abs(speed) * 7 + Math.abs(throttle) * 40);
    this.engine.osc.frequency.setTargetAtTime(rpm, now, 0.08);
    this.engine.sub.frequency.setTargetAtTime(rpm * 0.5, now, 0.08);
    this.engine.filter.frequency.setTargetAtTime(360 + Math.abs(throttle) * 900 + Math.abs(speed) * 18, now, 0.1);
    this.engine.gain.gain.setTargetAtTime(targetGain, now, 0.1);
  }

  stopEngine() {
    if (!this.engine) return;
    try {
      this.engine.osc.stop();
      this.engine.sub.stop();
    } catch (error) { /* already stopped */ }
    this.engine = null;
  }

  startAmbient() {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 380;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.05;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.master);
    noise.start();

    const hum = this.ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 54;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.02;
    hum.connect(humGain);
    humGain.connect(this.master);
    hum.start();

    this.ambient = { noise, windFilter, windGain, hum };
  }
}
