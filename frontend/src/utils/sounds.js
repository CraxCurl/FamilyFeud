// Audio Synthesizer utilizing Web Audio API for offline, reliable, zero-asset gameplay sounds
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buzzAudio = new Audio('/buzzersound.mp3');
    this.buzzAudio.preload = 'auto';
    this.buzzAudio.load();
    this.lastBuzzTime = 0;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCorrect() {
    this.init();
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Positive major triad arpeggio
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc1.frequency.setValueAtTime(1046.50, now + 0.3); // C6

    osc2.frequency.setValueAtTime(523.25 * 0.5, now);
    osc2.frequency.setValueAtTime(659.25 * 0.5, now + 0.1);
    osc2.frequency.setValueAtTime(783.99 * 0.5, now + 0.2);
    osc2.frequency.setValueAtTime(1046.50 * 0.5, now + 0.3);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.setValueAtTime(0.3, now + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  }

  playWrong() {
    this.init();
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    // Deep, harsh descending buzz
    osc.frequency.setValueAtTime(130.81, now); // C3
    osc.frequency.linearRampToValueAtTime(80, now + 0.4);

    // Simple lowpass filter to make it sound like a buzzer
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gainNode.gain.setValueAtTime(0.4, now + 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playBuzz() {
    this.init();
    if (this.muted) return;

    const now = Date.now();
    if (this.lastBuzzTime && now - this.lastBuzzTime < 1000) {
      return;
    }
    this.lastBuzzTime = now;

    if (this.buzzAudio) {
      this.buzzAudio.currentTime = 0;
      this.buzzAudio.play().catch(err => {
        console.error("Failed to play custom buzzer audio:", err);
      });
    }
  }

  playCountdown() {
    this.init();
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    // High woodblock tick
    osc.frequency.setValueAtTime(1200, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playTimerEnd() {
    this.init();
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    // Alarm pulse
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(293.66, now + 0.15);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.setValueAtTime(0.3, now + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  playRoundComplete() {
    this.init();
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    // Upward fanfare
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((note, idx) => {
      osc.frequency.setValueAtTime(note, now + idx * 0.08);
    });

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.setValueAtTime(0.3, now + 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  playWinner() {
    this.init();
    if (this.muted) return;

    // Happy victory melody
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 523.25, 783.99, 1046.50];
    const durations = [0.15, 0.15, 0.15, 0.15, 0.15, 0.5];

    let currentOffset = 0;
    notes.forEach((note, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;

      gainNode.gain.setValueAtTime(0, now + currentOffset);
      gainNode.gain.linearRampToValueAtTime(0.25, now + currentOffset + 0.02);
      gainNode.gain.setValueAtTime(0.25, now + currentOffset + durations[idx] - 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + currentOffset + durations[idx]);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(now + currentOffset);
      osc.stop(now + currentOffset + durations[idx]);

      currentOffset += durations[idx];
    });
  }

  playLoser() {
    this.init();
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    // Sad trombone sliding down
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 1.0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.0);
  }
}

export const sounds = new SoundSynthesizer();
