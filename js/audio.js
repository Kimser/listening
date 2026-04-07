// ==================== AUDIO ENGINE (Web Speech API TTS) ====================
class AudioEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.isPlaying = false;
    this.rate = 1;
    this.voice = null;
    this.onEnd = null;
    this.onProgress = null;
    this.onBoundary = null;
    this._progressTimer = null;
    this._startTime = 0;
    this._estDuration = 0;
    this._initVoice();
  }

  _initVoice() {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                   voices.find(v => v.lang.startsWith('en-US')) ||
                   voices.find(v => v.lang.startsWith('en')) ||
                   voices[0];
    };
    loadVoices();
    this.synth.onvoiceschanged = loadVoices;
  }

  speak(text, onEnd) {
    this.stop();
    this.onEnd = onEnd;
    this.utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) this.utterance.voice = this.voice;
    this.utterance.rate = this.rate;
    this.utterance.pitch = 1;
    this.utterance.volume = 1;
    this.utterance.lang = 'en-US';

    // Estimate duration: ~150ms per character at rate 1
    this._estDuration = (text.length * 150) / this.rate;
    this._startTime = Date.now();

    this.utterance.onend = () => {
      this.isPlaying = false;
      this._stopProgress();
      if (this.onProgress) this.onProgress(100);
      if (this.onEnd) this.onEnd();
    };

    this.utterance.onerror = () => {
      this.isPlaying = false;
      this._stopProgress();
    };

    this.utterance.onboundary = (e) => {
      if (this.onBoundary) this.onBoundary(e);
    };

    this.synth.speak(this.utterance);
    this.isPlaying = true;
    this._startProgress();
  }

  _startProgress() {
    this._stopProgress();
    this._progressTimer = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = Date.now() - this._startTime;
      const pct = Math.min((elapsed / this._estDuration) * 100, 95);
      if (this.onProgress) this.onProgress(pct);
    }, 50);
  }

  _stopProgress() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  stop() {
    this.synth.cancel();
    this.isPlaying = false;
    this._stopProgress();
    if (this.onProgress) this.onProgress(0);
  }

  pause() {
    this.synth.pause();
    this.isPlaying = false;
  }

  resume() {
    this.synth.resume();
    this.isPlaying = true;
  }

  setRate(rate) {
    this.rate = rate;
  }

  speakWord(word, onEnd) {
    this.synth.cancel();
    const utt = new SpeechSynthesisUtterance(word);
    if (this.voice) utt.voice = this.voice;
    utt.rate = 0.8; // Speak words slowly for clarity
    utt.pitch = 1;
    utt.volume = 1;
    utt.lang = 'en-US';
    utt.onend = () => { if (onEnd) onEnd(); };
    utt.onerror = () => { if (onEnd) onEnd(); };
    this.synth.speak(utt);
  }

  playPromptSound(callback) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return callback();
      const ctx = new Ctx();
      
      const playNote = (freq, time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.start(time);
        osc.stop(time + 0.2);
      };
      
      playNote(880, ctx.currentTime); // A5 note
      playNote(1108.73, ctx.currentTime + 0.15); // C#6 note
      
      setTimeout(() => {
        ctx.close().catch(() => {});
        callback();
      }, 400); // Trigger callback after sound finishes
    } catch(e) {
      callback();
    }
  }
}
