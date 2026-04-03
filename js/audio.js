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
}
