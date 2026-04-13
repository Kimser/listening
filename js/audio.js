// ==================== AUDIO ENGINE (Web Speech API TTS) ====================
class AudioEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.isPlaying = false;
    this.rate = 1;
    this.voice = null;
    this.voiceEn = null;
    this.voiceZh = null;
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
      this.voiceEn = this._pickVoice(
        voices,
        ['en-us', 'en-gb', 'en'],
        ['samantha', 'alex', 'ava', 'allison', 'daniel', 'karen', 'moira', 'google us english', 'google uk english', 'enhanced', 'premium', 'natural']
      ) || voices[0];
      this.voiceZh = this._pickVoice(
        voices,
        ['zh-cn', 'zh-hk', 'zh-tw', 'zh'],
        ['mei-jia', 'tingting', 'xiaoxiao', 'xiaoyi', 'sin-ji', 'yunxi', 'siri', 'female', 'google 中文', 'google 普通话', 'enhanced', 'premium', 'natural']
      ) || this.voiceEn;
      this.voice = this.voiceEn;
    };
    loadVoices();
    this.synth.onvoiceschanged = loadVoices;
  }

  _pickVoice(voices, langPrefixes, preferredNames) {
    const byLang = voices.filter(v => langPrefixes.some(p => v.lang.toLowerCase().startsWith(p)));
    for (const name of preferredNames) {
      const found = byLang.find(v => v.name.toLowerCase().includes(name));
      if (found) return found;
    }
    return byLang[0] || null;
  }

  speak(text, onEnd, options = {}) {
    this.stop();
    this.onEnd = onEnd;
    const lang = options.lang || 'en-US';
    const rate = typeof options.rate === 'number' ? options.rate : this.rate;
    const pitch = typeof options.pitch === 'number' ? options.pitch : 1;
    const volume = typeof options.volume === 'number' ? options.volume : 1;
    const voice = lang.startsWith('zh') ? this.voiceZh : this.voiceEn;
    this.utterance = new SpeechSynthesisUtterance(text);
    if (voice) this.utterance.voice = voice;
    this.utterance.rate = rate;
    this.utterance.pitch = pitch;
    this.utterance.volume = volume;
    this.utterance.lang = lang;

    this._estDuration = (text.length * 150) / rate;
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
    const speakText = (word || '').toLowerCase() === 'a' ? 'uh' : word;
    const utt = new SpeechSynthesisUtterance(speakText);
    if (this.voiceEn) utt.voice = this.voiceEn;
    utt.rate = 0.8; // Speak words slowly for clarity
    utt.pitch = 1.02;
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
