import { settings } from '../config/settings.js';

/**
 * All audio is synthesized with the Web Audio API (no audio files). The context is only
 * created after the first user gesture, and every call is a no-op if audio is unavailable.
 */
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Each track: [bpm, steps per beat, bass notes, lead notes]; 0 = rest.
const TRACKS = {
  menu: {
    bpm: 112,
    steps: 2,
    bass: [36, 0, 43, 36, 41, 0, 48, 41, 43, 0, 50, 43, 38, 0, 45, 43],
    lead: [72, 0, 76, 79, 0, 76, 74, 72, 74, 0, 77, 76, 74, 0, 71, 0,
      72, 0, 76, 79, 0, 81, 79, 77, 76, 0, 74, 72, 74, 0, 0, 0],
    leadWave: 'square',
    bassWave: 'triangle',
  },
  fight: {
    bpm: 150,
    steps: 2,
    bass: [33, 33, 45, 33, 33, 45, 33, 43, 29, 29, 41, 29, 31, 31, 43, 32],
    lead: [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 69, 0, 67, 69, 0, 0,
      65, 0, 69, 0, 72, 0, 71, 69, 67, 0, 71, 0, 74, 72, 71, 68],
    leadWave: 'square',
    bassWave: 'sawtooth',
  },
};

class Sound {
  constructor() {
    this.ctx = null;
    this.track = null;
    this.timer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.pendingTrack) this.music(this.pendingTrack);
    } catch {
      this.ctx = null;
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = settings.sfxVolume;
    this.musicGain.gain.value = settings.musicVolume * 0.35;
  }

  tone(type, f0, f1, dur, vol = 0.3, when = 0, dest = this.sfxGain) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  burst(filterType, freq, dur, vol = 0.3, when = 0, sweepTo = freq) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo !== freq) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx) return;
    try {
      this.effect(name);
    } catch {
      // Ignore audio scheduling errors; the game must keep running.
    }
  }

  effect(name) {
    switch (name) {
      case 'whoosh':
        this.burst('bandpass', 500, 0.12, 0.12, 0, 2200);
        break;
      case 'light':
        this.burst('bandpass', 1400, 0.07, 0.35);
        this.tone('sine', 160, 60, 0.09, 0.4);
        break;
      case 'heavy':
        this.burst('lowpass', 1200, 0.16, 0.5);
        this.tone('sine', 110, 40, 0.18, 0.6);
        break;
      case 'block':
        this.tone('square', 1100, 700, 0.05, 0.12);
        this.burst('highpass', 3000, 0.06, 0.2);
        break;
      case 'shot':
        this.tone('square', 900, 200, 0.16, 0.18);
        this.burst('highpass', 2500, 0.1, 0.25);
        break;
      case 'speech':
        this.tone('sawtooth', 220, 330, 0.12, 0.12);
        this.tone('sawtooth', 330, 260, 0.14, 0.12, 0.12);
        this.burst('bandpass', 900, 0.3, 0.12);
        break;
      case 'engine':
        this.tone('sawtooth', 70, 120, 0.5, 0.22);
        this.tone('square', 55, 95, 0.5, 0.1);
        this.burst('lowpass', 500, 0.5, 0.15);
        break;
      case 'crowd':
        this.burst('bandpass', 700, 0.8, 0.3, 0, 1200);
        this.burst('bandpass', 1500, 0.6, 0.15, 0.1);
        break;
      case 'special':
        this.tone('sawtooth', 300, 900, 0.2, 0.15);
        break;
      case 'super':
        [60, 64, 67, 72, 76, 79].forEach((n, i) => this.tone('square', midi(n), midi(n), 0.12, 0.15, i * 0.07));
        this.burst('bandpass', 400, 0.7, 0.2, 0, 3000);
        break;
      case 'superHit':
        this.burst('lowpass', 2000, 0.45, 0.6);
        this.tone('sine', 90, 30, 0.5, 0.7);
        break;
      case 'ko':
        this.tone('square', 600, 80, 0.8, 0.2);
        this.burst('lowpass', 800, 0.6, 0.5);
        this.tone('sine', 70, 30, 0.7, 0.6);
        break;
      case 'victory':
        [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone('square', midi(n), midi(n), i === 5 ? 0.5 : 0.14, 0.15, i * 0.14));
        break;
      case 'select':
        this.tone('square', 660, 660, 0.05, 0.12);
        break;
      case 'confirm':
        this.tone('square', 660, 660, 0.06, 0.14);
        this.tone('square', 990, 990, 0.1, 0.14, 0.06);
        break;
      case 'back':
        this.tone('square', 440, 330, 0.08, 0.12);
        break;
      case 'round':
        this.tone('triangle', 392, 392, 0.15, 0.3);
        this.tone('triangle', 523, 523, 0.25, 0.3, 0.15);
        break;
      case 'fight':
        this.tone('square', 523, 523, 0.08, 0.2);
        this.tone('square', 784, 784, 0.3, 0.2, 0.08);
        this.burst('bandpass', 1000, 0.3, 0.15);
        break;
      default:
        break;
    }
  }

  music(name) {
    this.pendingTrack = name;
    if (this.track === name && this.timer) return;
    this.stopMusic();
    if (!this.ctx || !name) return;
    const track = TRACKS[name];
    this.track = name;
    const stepDur = 60 / track.bpm / track.steps;
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        const lead = track.lead[step % track.lead.length];
        const bass = track.bass[Math.floor(step / 2) % track.bass.length];
        const when = next - this.ctx.currentTime;
        if (lead) this.tone(track.leadWave, midi(lead), midi(lead), stepDur * 0.9, 0.12, when, this.musicGain);
        if (bass && step % 2 === 0) this.tone(track.bassWave, midi(bass), midi(bass), stepDur * 1.8, 0.16, when, this.musicGain);
        if (step % 4 === 0) this.kick(when);
        if (step % 4 === 2) this.hat(when);
        step++;
        next += stepDur;
      }
    }, 50);
  }

  kick(when) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  hat(when) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }
}

export const sound = new Sound();
