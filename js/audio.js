// ==================== AUDIO ENGINE (Web Speech API TTS) ====================
class AudioEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.isPlaying = false;
    this.rate = 1;
    this.voice = null;
    this.voiceEn = null;
    this.voiceEnUs = null;
    this.voiceEnUk = null;
    this.voiceZh = null;
    this.englishVariant = 'us';
    this.onEnd = null;
    this.onProgress = null;
    this.onBoundary = null;
    this._progressTimer = null;
    this._startTime = 0;
    this._estDuration = 0;
    this._speakToken = 0;
    this._pendingSpeakTimer = null;
    this._transitionGapMs = 120;
    this._initVoice();
  }

  _initVoice() {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      this.voiceEnUs = this._pickVoice(
        voices,
        ['en-us'],
        ['samantha', 'ava', 'allison', 'karen', 'susan', 'victoria', 'zoe', 'google us english', 'enhanced', 'premium', 'natural']
      );
      this.voiceEnUk = this._pickVoice(
        voices,
        ['en-gb'],
        ['uk english male', 'serena', 'kate', 'moira', 'google uk english', 'enhanced', 'premium', 'natural']
      );
      this.voiceEn = this.voiceEnUs || this.voiceEnUk || this._pickVoice(
        voices,
        ['en-us', 'en-gb', 'en'],
        ['uk english male', 'samantha', 'ava', 'allison', 'karen', 'susan', 'serena', 'kate', 'moira', 'google us english', 'google uk english', 'enhanced', 'premium', 'natural']
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

  _getEnglishVoice(variant = this.englishVariant) {
    if (variant === 'uk') return this.voiceEnUk || this.voiceEnUs || this.voiceEn;
    return this.voiceEnUs || this.voiceEnUk || this.voiceEn;
  }

  speak(text, onEnd, options = {}) {
    this.stop(true);
    const speakToken = ++this._speakToken;
    this.onEnd = onEnd;
    const lang = options.lang || 'en-US';
    const rate = typeof options.rate === 'number' ? options.rate : this.rate;
    const pitch = typeof options.pitch === 'number' ? options.pitch : 1;
    const volume = typeof options.volume === 'number' ? options.volume : 1;
    const isEnglish = lang.toLowerCase().startsWith('en');
    const variant = options.voiceVariant || this.englishVariant;
    const voice = lang.startsWith('zh') ? this.voiceZh : (isEnglish ? this._getEnglishVoice(variant) : this.voiceEn);
    this.utterance = new SpeechSynthesisUtterance(text);
    if (voice) this.utterance.voice = voice;
    this.utterance.rate = rate;
    this.utterance.pitch = pitch;
    this.utterance.volume = volume;
    this.utterance.lang = lang;

    this._estDuration = (text.length * 150) / rate;

    this.utterance.onend = () => {
      if (this._speakToken !== speakToken) return;
      this.isPlaying = false;
      this._stopProgress();
      if (this.onProgress) this.onProgress(100);
      if (this.onEnd) this.onEnd();
    };

    this.utterance.onerror = () => {
      if (this._speakToken !== speakToken) return;
      this.isPlaying = false;
      this._stopProgress();
    };

    this.utterance.onboundary = (e) => {
      if (this._speakToken !== speakToken) return;
      if (this.onBoundary) this.onBoundary(e);
    };

    if (this._pendingSpeakTimer) {
      clearTimeout(this._pendingSpeakTimer);
      this._pendingSpeakTimer = null;
    }
    this._pendingSpeakTimer = setTimeout(() => {
      if (this._speakToken !== speakToken) return;
      this._startTime = Date.now();
      this.synth.speak(this.utterance);
      this.isPlaying = true;
      this._startProgress();
      this._pendingSpeakTimer = null;
    }, this._transitionGapMs);
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

  stop(silent = false) {
    if (this._pendingSpeakTimer) {
      clearTimeout(this._pendingSpeakTimer);
      this._pendingSpeakTimer = null;
    }
    this._speakToken++;
    this.synth.cancel();
    this.isPlaying = false;
    this._stopProgress();
    if (!silent && this.onProgress) this.onProgress(0);
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

  setEnglishVariant(variant) {
    this.englishVariant = variant === 'uk' ? 'uk' : 'us';
  }

  /**
   * Returns all available browser voices for a given language prefix.
   * @param {string} [langPrefix='en'] - e.g. 'en', 'zh'
   * @returns {SpeechSynthesisVoice[]}
   */
  getAvailableVoices(langPrefix = 'en') {
    const voices = this.synth.getVoices();
    return voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  }

  /**
   * Override the currently active English voice by exact voice name.
   * Saves the preference to localStorage for persistence across reloads.
   * Pass null / '' to reset to auto-selected default.
   * @param {string|null} name - SpeechSynthesisVoice.name
   */
  setVoiceByName(name) {
    if (!name) {
      // Reset: re-run auto selection
      this._initVoice();
      localStorage.removeItem('lp_voiceName');
      return;
    }
    const voices = this.synth.getVoices();
    const found = voices.find(v => v.name === name);
    if (!found) return;
    localStorage.setItem('lp_voiceName', name);
    // Determine which slot to assign based on lang
    if (found.lang.toLowerCase().startsWith('en-gb')) {
      this.voiceEnUk = found;
    } else {
      this.voiceEnUs = found;
    }
    // Always update the active voice reference
    this.voiceEn = found;
  }

  /**
   * Returns the name of the currently active English voice (auto or manually set).
   * @returns {string}
   */
  getCurrentVoiceName() {
    const v = this._getEnglishVoice(this.englishVariant);
    return v ? v.name : '';
  }

  speakWord(word, onEnd, options = {}) {
    if (this._pendingSpeakTimer) {
      clearTimeout(this._pendingSpeakTimer);
      this._pendingSpeakTimer = null;
    }
    this._speakToken++;
    this.synth.cancel();
    const speakText = (word || '').toLowerCase() === 'a' ? 'uh' : word;
    const variant = options.voiceVariant || this.englishVariant;
    const utt = new SpeechSynthesisUtterance(speakText);
    const voice = this._getEnglishVoice(variant);
    if (voice) utt.voice = voice;
    utt.rate = 0.8; // Speak words slowly for clarity
    utt.pitch = 1.02;
    utt.volume = 1;
    utt.lang = variant === 'uk' ? 'en-GB' : 'en-US';
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
