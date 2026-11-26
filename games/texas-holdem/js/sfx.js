/* Small table sounds, synthesised in the browser so there are no downloads.
   Everything is deliberately quiet: felt, clay, paper. */

let context = null;

function audio() {
  if (!context) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    context = new AudioCtor();
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

export function warmAudio() {
  audio();
}

function noiseBurst(ctx, { duration = 0.05, frequency = 900, q = 1.2, gain = 0.035, type = 'bandpass' }) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const decay = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}

function tone(ctx, { frequency = 440, duration = 0.05, gain = 0.02, type = 'sine', when = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + when);
  const amp = ctx.createGain();
  const at = ctx.currentTime + when;
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function sfx(name, options = {}) {
  try {
    const ctx = audio();
    if (!ctx) return;
    const pan = typeof options.pan === 'number' ? options.pan : 0;
    if (name === 'card') {
      noiseBurst(ctx, { duration: 0.075, frequency: 1450, q: 0.9, gain: 0.028 });
      tone(ctx, { frequency: 210, duration: 0.035, gain: 0.012, type: 'triangle' });
    } else if (name === 'chip' || name === 'chips') {
      const count = name === 'chips' ? 3 : 1;
      for (let i = 0; i < count; i += 1) {
        noiseBurst(ctx, { duration: 0.028, frequency: 2600 + i * 300, q: 2.2, gain: 0.022, type: 'bandpass' });
        tone(ctx, { frequency: 980 + i * 170 + pan * 120, duration: 0.028, gain: 0.008, type: 'square', when: i * 0.028 });
      }
    } else if (name === 'tap') {
      tone(ctx, { frequency: 160, duration: 0.07, gain: 0.03, type: 'triangle' });
      noiseBurst(ctx, { duration: 0.04, frequency: 500, q: 1.8, gain: 0.018 });
    } else if (name === 'fold') {
      noiseBurst(ctx, { duration: 0.12, frequency: 1800, q: 0.7, gain: 0.025 });
      tone(ctx, { frequency: 140, duration: 0.1, gain: 0.012, type: 'triangle' });
    } else if (name === 'win') {
      [392, 494, 587, 784].forEach((frequency, i) => {
        tone(ctx, { frequency, duration: 0.28, gain: 0.018, type: 'sine', when: i * 0.07 });
      });
    } else if (name === 'allin') {
      for (let i = 0; i < 8; i += 1) {
        noiseBurst(ctx, { duration: 0.026, frequency: 2200 + i * 180, q: 2, gain: 0.018 });
      }
      tone(ctx, { frequency: 96, duration: 0.18, gain: 0.025, type: 'triangle' });
    }
  } catch (error) {
    // Audio is a garnish; never let a browser block the hand.
  }
}
