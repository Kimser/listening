// ==================== MAIN APPLICATION ====================
(function() {
  'use strict';

  // State
  const state = {
    sentences: [...SENTENCES],
    filtered: [...SENTENCES],
    currentIndex: -1,
    typeFilter: 'category',
    levelFilter: 'all',
    playMode: 'sequential',
    speed: parseFloat(localStorage.getItem('lp_speed') || '1'),
    fontSize: parseInt(localStorage.getItem('lp_fontSize') || '18'),
    loopTimer: null,
    wordbook: JSON.parse(localStorage.getItem('lp_wordbook') || '[]'),
    stats: JSON.parse(localStorage.getItem('lp_stats') || '{"totalTime":0,"sessionsCount":0,"sentencesPlayed":0,"startTime":null}'),
    lang: localStorage.getItem('lp_lang') || 'zh',
    showCn: localStorage.getItem('lp_showCn') === 'true',
    accent: localStorage.getItem('lp_accent') || 'uk',
    isPlayerCollapsed: localStorage.getItem('lp_playerCollapsed') === 'true',
    theme: localStorage.getItem('lp_theme') || 'dark'
  };

  const i18n = {
    en: {
      type: "Type", all: "All", category: "Category", dialogue: "Dialogue",
      level: "Level", speed: "Speed", mode: "Mode", sequential: "Sequential", loop: "Loop",
      sentences: "Sentences", statsTitle: "Learning Stats", wordbookTitle: "Word Book",
      selectPrompt: "Select a sentence to start practicing",
      statsSentences: "Sentences Played", statsWords: "Words Saved",
      statsTotal: "Total Sentences", statsDict: "Dictionary Words",
      noDef: "No definition available",
      noWords: "No words saved yet.<br>Tap any word to add it.",
      lvl_elementary: "Elementary", lvl_intermediate: "Intermediate", lvl_advanced: "Advanced",
      personalizeTitle: "Personalization", accentLabel: "English Accent", accentUs: "US", accentUk: "UK",
      installTitle: "Install App",
      installDescNative: "Add this app to your home screen for a faster fullscreen experience.",
      installDescIosSafari: "Tap Share, then choose Add to Home Screen.",
      installDescIosOther: "Open in Safari, tap Share, then choose Add to Home Screen.",
      installNow: "Install Now",
      installLater: "Later",
      language: "Language",
      logout: "Logout",
      titleTheme: "Toggle Theme",
      titleMore: "More Options",
      titleLocate: "Locate Current Sentence",
      titlePlayer: "Toggle Player",
      titleTrans: "Toggle EN/CN",
      titleFont: "Font Size"
    },
    zh: {
      type: "类型", all: "全部", category: "分类句型", dialogue: "对话文章",
      level: "难度等级", speed: "语速调节", mode: "播放模式", sequential: "顺序播放", loop: "单句循环",
      sentences: "语句列表", statsTitle: "学习统计", wordbookTitle: "生词本",
      selectPrompt: "请选择一个句子开始练习",
      statsSentences: "已学句子数", statsWords: "已存单词数",
      statsTotal: "总句子数", statsDict: "词典总词汇",
      noDef: "暂无释义",
      noWords: "暂无保存的单词。<br>点击任意单词即可添加。",
      lvl_elementary: "入门级", lvl_intermediate: "进阶级", lvl_advanced: "高级",
      personalizeTitle: "个性化设置", accentLabel: "英语口音", accentUs: "美音", accentUk: "英音",
      installTitle: "添加到桌面",
      installDescNative: "将应用添加到桌面，获得更快的全屏使用体验。",
      installDescIosSafari: "点击下方分享按钮，再选择“添加到主屏幕”。",
      installDescIosOther: "请先在 Safari 打开，再点击分享并选择“添加到主屏幕”。",
      installNow: "立即安装",
      installLater: "稍后",
      language: "中英切换",
      logout: "退出登录",
      titleTheme: "切换主题",
      titleMore: "更多选项",
      titleLocate: "定位到当前句子",
      titlePlayer: "展开/收起播放器",
      titleTrans: "中英切换",
      titleFont: "字体大小"
    }
  };

  const audio = new AudioEngine();

  // DOM Elements
  const $ = id => document.getElementById(id);
  const sentenceText = $('sentenceText');
  const sentenceList = $('sentenceList');
  const playIcon = $('playIcon');
  const miniPlayIcon = $('miniPlayIcon');
  const progressBar = $('progressBar');
  const cardBadge = $('cardBadge');
  const sentenceIndex = $('sentenceIndex');
  const listCount = $('listCount');
  const wordPopup = $('wordPopup');
  const statsModal = $('statsModal');
  const wordbookModal = $('wordbookModal');
  const settingsDrawer = $('settingsDrawer');
  const settingsOverlay = $('settingsOverlay');
  const playerSection = $('playerSection');
  const playerToggleIcon = $('playerToggleIcon');
  const btnTogglePlayer = $('btnTogglePlayer');
  let deferredInstallPrompt = null;
  let installPromptEl = null;
  const INSTALL_DISMISS_KEY = 'lp_install_prompt_dismissed_v1';

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIosDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function isSafariBrowser() {
    const ua = window.navigator.userAgent || '';
    const isWebkit = /webkit/i.test(ua);
    const isExcluded = /crios|fxios|edgios|opios|mercury/i.test(ua);
    return isWebkit && !isExcluded;
  }

  function dismissInstallPrompt(persist = true) {
    if (installPromptEl) {
      installPromptEl.remove();
      installPromptEl = null;
    }
    if (persist) localStorage.setItem(INSTALL_DISMISS_KEY, 'true');
  }

  function shouldShowInstallPrompt() {
    const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === 'true';
    if (dismissed) return false;
    if (isStandaloneMode()) return false;
    return !!deferredInstallPrompt || isIosDevice();
  }

  function renderInstallPrompt() {
    if (!shouldShowInstallPrompt()) {
      dismissInstallPrompt(false);
      return;
    }
    const langPack = i18n[state.lang] || i18n.zh;
    const ios = isIosDevice();
    const safari = isSafariBrowser();
    const canNativeInstall = !!deferredInstallPrompt;
    const desc = canNativeInstall
      ? langPack.installDescNative
      : (ios ? (safari ? langPack.installDescIosSafari : langPack.installDescIosOther) : langPack.installDescNative);
    const actionLabel = canNativeInstall ? langPack.installNow : langPack.installLater;
    if (!installPromptEl) {
      installPromptEl = document.createElement('div');
      installPromptEl.className = 'install-prompt';
      document.body.appendChild(installPromptEl);
    }
    installPromptEl.innerHTML = `
      <button class="install-close" aria-label="Close"><i class="ri-close-line"></i></button>
      <div class="install-prompt-title">${langPack.installTitle}</div>
      <div class="install-prompt-desc">${desc}</div>
      <div class="install-prompt-actions">
        <button class="install-action">${actionLabel}</button>
      </div>
    `;
    const actionBtn = installPromptEl.querySelector('.install-action');
    const closeBtn = installPromptEl.querySelector('.install-close');
    actionBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        dismissInstallPrompt(true);
        return;
      }
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (_) {}
      deferredInstallPrompt = null;
      dismissInstallPrompt(true);
    });
    closeBtn.addEventListener('click', () => dismissInstallPrompt(true));
  }

  function setupInstallPrompt() {
    if (isStandaloneMode()) return;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      renderInstallPrompt();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      dismissInstallPrompt(true);
    });
    setTimeout(() => {
      renderInstallPrompt();
    }, 500);
  }

  function getEnglishLang() {
    return state.accent === 'uk' ? 'en-GB' : 'en-US';
  }

  function getIpaText(entry, accent = state.accent) {
    if (!entry) return '';
    if (entry.ipa && typeof entry.ipa === 'object') {
      const text = accent === 'uk' ? entry.ipa.uk : entry.ipa.us;
      return text || entry.ipa.us || entry.ipa.uk || '';
    }
    if (entry.ipa && typeof entry.ipa === 'string') return entry.ipa;
    const fallback = accent === 'uk' ? entry.ipa_uk : entry.ipa_us;
    return fallback || entry.ipa_us || entry.ipa_uk || '';
  }

  function renderWordPronunciations(word, entry) {
    const holder = $('popupPronunciations');
    if (!entry) {
      holder.innerHTML = '';
      return;
    }
    const usIpa = getIpaText(entry, 'us');
    const ukIpa = getIpaText(entry, 'uk');
    holder.innerHTML = `
      <button class="pron-btn ${state.accent === 'us' ? 'active' : ''}" data-accent="us">
        <div class="pron-top">
          <span class="tag">${i18n[state.lang].accentUs}</span>
          <i class="ri-volume-up-fill"></i>
        </div>
        <span class="ipa">${usIpa || '-'}</span>
      </button>
      <button class="pron-btn ${state.accent === 'uk' ? 'active' : ''}" data-accent="uk">
        <div class="pron-top">
          <span class="tag">${i18n[state.lang].accentUk}</span>
          <i class="ri-volume-up-fill"></i>
        </div>
        <span class="ipa">${ukIpa || '-'}</span>
      </button>
    `;
    holder.querySelectorAll('.pron-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        interruptMainPlayback();
        const accent = btn.dataset.accent === 'uk' ? 'uk' : 'us';
        btn.classList.add('speaking');
        audio.speakWord(word, () => {
          btn.classList.remove('speaking');
        }, { voiceVariant: accent });
      });
    });
  }

  // ---- Filter Logic ----
  function applyFilters() {
    const isCategoryParent = s => s.type === 'category' && (s.parentId === undefined || s.parentId === null);
    state.filtered = state.sentences.filter(s => {
      const typeMatch = state.typeFilter === 'all' || s.type === state.typeFilter;
      const levelMatch = state.levelFilter === 'all' || s.level === state.levelFilter;
      const hideParentInAll = state.typeFilter === 'all' && isCategoryParent(s);
      return typeMatch && levelMatch && !hideParentInAll;
    });
    renderList();
    listCount.textContent = state.filtered.length;
    if (state.currentIndex >= state.filtered.length) {
      state.currentIndex = state.filtered.length > 0 ? 0 : -1;
    }
    if (state.filtered.length > 0 && state.currentIndex === -1) {
      state.currentIndex = 0;
    }
    updateDisplay();
  }

  function setupFilters() {
    document.querySelectorAll('#typeFilter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#typeFilter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.typeFilter = btn.dataset.value;
        state.currentIndex = -1;
        audio.stop();
        updatePlayBtn(false);
        applyFilters();
      });
    });
    document.querySelectorAll('#levelFilter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#levelFilter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.levelFilter = btn.dataset.value;
        state.currentIndex = -1;
        audio.stop();
        updatePlayBtn(false);
        applyFilters();
      });
    });
  }

  // ---- Render Sentence List ----
  function renderList() {
    const html = state.filtered.map((s, i) => 
      `<li class="sentence-item${i === state.currentIndex ? ' active' : ''}" data-index="${i}">` +
      `<span class="num">${i + 1}</span><span class="text">${s.text}</span><span class="level-dot ${s.level}"></span>` +
      `</li>`
    ).join('');
    sentenceList.innerHTML = html;
  }

  // ---- Display Current Sentence ----
  function updateDisplay() {
    if (state.currentIndex < 0 || state.filtered.length === 0) {
      sentenceText.innerHTML = i18n[state.lang].selectPrompt;
      sentenceText.style.fontSize = state.fontSize + 'px';
      cardBadge.textContent = '—';
      sentenceIndex.textContent = '0 / 0';
      return;
    }
    const s = state.filtered[state.currentIndex];
    
    if (state.showCn) {
      sentenceText.innerHTML = s.cn;
    } else {
      // Wrap words for click interaction
      const words = s.text.replace(/[.,!?;:'"]/g, m => `<span class="punct">${m}</span>`).split(/\s+/);
      sentenceText.innerHTML = s.text.split(/\s+/).map(w => {
        const clean = w.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
        return `<span class="word" data-word="${clean}">${w}</span>`;
      }).join(' ');
    }
    
    sentenceText.style.fontSize = state.fontSize + 'px';

    const levelNames = { 
      elementary: i18n[state.lang].lvl_elementary, 
      intermediate: i18n[state.lang].lvl_intermediate, 
      advanced: i18n[state.lang].lvl_advanced 
    };
    cardBadge.textContent = levelNames[s.level] || s.level;
    cardBadge.style.background = s.level === 'elementary' ? 'var(--accent)' : s.level === 'intermediate' ? '#f9c74f' : 'var(--accent2)';
    sentenceIndex.textContent = `${state.currentIndex + 1} / ${state.filtered.length}`;

    // Highlight active in list
    const activeItem = sentenceList.querySelector('.sentence-item.active');
    if (activeItem) activeItem.classList.remove('active');
    if (state.currentIndex >= 0 && sentenceList.children[state.currentIndex]) {
      sentenceList.children[state.currentIndex].classList.add('active');
    }
    // // Scroll active item into view
    // const activeItem = sentenceList.querySelector('.sentence-item.active');
    // if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Wire up word clicks if in English mode
    if (!state.showCn) {
      sentenceText.querySelectorAll('.word').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          showWordPopup(el.dataset.word);
        });
      });
    }
  }

  // ---- Select Sentence ----
  function selectSentence(index) {
    audio.stop();
    clearLoopTimer();
    state.currentIndex = index;
    updateDisplay();
    updatePlayBtn(false);
    playCurrent();
  }

  // ---- Play Controls ----
  function getSelectedSpeed() {
    const activeBtn = document.querySelector('#speedControl .speed-btn.active');
    const activeSpeed = activeBtn ? parseFloat(activeBtn.dataset.speed) : NaN;
    if (Number.isFinite(activeSpeed)) return activeSpeed;
    return Number.isFinite(state.speed) ? state.speed : 1;
  }

  function getPlaybackRates(baseSpeed) {
    // Pass 1: natural fluency at user-selected speed
    // Pass 2: moderately slowed, full sentence — clearer phrasing
    // Pass 3: slowest full-sentence read — deliberate but not word-by-word overhead
    // Chinese: comfortable comprehension speed
    const first  = Math.max(0.5,  Math.min(1.5,  baseSpeed));
    const second = Math.max(0.5,  Math.min(1.2,  baseSpeed - 0.15));
    const third  = Math.max(0.6,  Math.min(1.3,  baseSpeed - 0.1));
    const chinese = Math.max(0.6,  Math.min(1.1,  baseSpeed - 0.1));
    return { first, second, third, chinese };
  }

  function buildClearEnglishSpeechText(text) {
    // Keep speech clear but natural: pause by phrase, not by every single word.
    return (text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([,;:])\s*/g, '$1 ')
      .replace(/([.!?])\s*/g, '$1 ')
      .replace(/\s*[—-]\s*/g, ', ');
  }

  function buildWordByWordStream(text) {
    return ((text || '').match(/[A-Za-z]+(?:['-][A-Za-z]+)*|[.,!?;:]/g) || []);
  }

  function speakWordByWordLikeSentence(text, rate, onEnd, index = 0, tokens = null) {
    const stream = tokens || buildWordByWordStream(text);
    if (index >= stream.length) {
      onEnd();
      return;
    }
    const token = stream[index];
    if (/^[.,!?;:]$/.test(token)) {
      speakWordByWordLikeSentence(text, rate, onEnd, index + 1, stream);
      return;
    }
    const speakToken = token.toLowerCase() === 'a' ? 'uh' : token;
    // Use the given rate uniformly; avoid extra slowdown that causes swallowed sounds
    const tokenRate = Math.max(0.45, rate);
    audio.onProgress = pct => { progressBar.style.width = pct + '%'; };
    audio.speak(speakToken, () => {
      speakWordByWordLikeSentence(text, rate, onEnd, index + 1, stream);
      updatePlayBtn(true);
    }, { lang: getEnglishLang(), rate: tokenRate, pitch: 1.1, voiceVariant: state.accent });
  }

  function normalizeStandaloneArticleA(text) {
    return (text || '').replace(/\ba(?=\s*[.!?,;:]?\s*$)/gi, 'uh');
  }

  function playPasses(passes, onEnd, index = 0) {
    if (index >= passes.length) {
      onEnd();
      return;
    }
    const pass = passes[index];
    const handlePassEnd = () => {
      if (index >= passes.length - 1) {
        onEnd();
        return;
      }
      state.loopTimer = setTimeout(() => playPasses(passes, onEnd, index + 1), 2200);
      updatePlayBtn(true);
    };
    if (pass.mode === 'word_by_word') {
      speakWordByWordLikeSentence(pass.text, pass.rate, handlePassEnd);
      return;
    }
    audio.onProgress = pct => { progressBar.style.width = pct + '%'; };
    let spokenText = pass.normalizeA ? normalizeStandaloneArticleA(pass.text) : pass.text;
    if (pass.clearSpeech) spokenText = buildClearEnglishSpeechText(spokenText);
    audio.speak(spokenText, handlePassEnd, { lang: pass.lang, rate: pass.rate, pitch: pass.pitch || 1, volume: pass.volume || 1, voiceVariant: pass.voiceVariant });
  }

  function playCurrent(playReason = 'initial') {
    if (state.currentIndex < 0 || state.filtered.length === 0) return;
    const s = state.filtered[state.currentIndex];

    state.stats.sentencesPlayed++;
    saveStats();

    const selectedSpeed = getSelectedSpeed();
    if (selectedSpeed !== state.speed) {
      state.speed = selectedSpeed;
      localStorage.setItem('lp_speed', state.speed);
    }
    audio.setRate(state.speed);
    const rates = getPlaybackRates(state.speed);
    const isCategoryParent = s.type === 'category' && (s.parentId === undefined || s.parentId === null);
    const passes = isCategoryParent
      ? [
          { text: s.text, lang: getEnglishLang(), rate: rates.first, pitch: 1.1, normalizeA: true, clearSpeech: true, voiceVariant: state.accent },
          { text: s.cn || s.text, lang: 'zh-CN', rate: rates.chinese, pitch: 1.05, volume: 1 }
        ]
      : [
        // Pass 1: natural fluency at user-selected speed
        { text: s.text, lang: getEnglishLang(), rate: rates.first,  pitch: 1.1, clearSpeech: true, voiceVariant: state.accent },
        // Pass 2: moderately slowed, full sentence — clearer phrasing
        { text: s.text, lang: getEnglishLang(), rate: rates.second, pitch: 1.1, clearSpeech: true, voiceVariant: state.accent },
        // Pass 3: word-by-word, deliberate & clear
        { text: s.text, lang: getEnglishLang(), rate: rates.third,  pitch: 1.1, mode: 'word_by_word', voiceVariant: state.accent },
        // Pass 4: Chinese translation
        { text: s.cn || s.text, lang: 'zh-CN', rate: rates.chinese, pitch: 1.05, volume: 1 }
      ];

    const startSpeaking = () => {
      playPasses(passes, () => {
        updatePlayBtn(false);
        if (state.playMode === 'loop') {
          state.loopTimer = setTimeout(() => playCurrent('loop'), 2600);
          updatePlayBtn(true);
          return;
        }
        if (state.playMode === 'sequential' && state.currentIndex < state.filtered.length - 1) {
          state.currentIndex++;
          updateDisplay();
          state.loopTimer = setTimeout(() => playCurrent('sequential'), 2600);
          updatePlayBtn(true);
        }
      });
    };

    if (playReason === 'initial' || playReason === 'sequential') {
      audio.playPromptSound(startSpeaking);
    } else {
      startSpeaking();
    }
    updatePlayBtn(true);
  }

  function togglePlay() {
    if (audio.isPlaying) {
      audio.stop();
      clearLoopTimer();
      updatePlayBtn(false);
    } else {
      if (state.currentIndex < 0 && state.filtered.length > 0) state.currentIndex = 0;
      updateDisplay();
      playCurrent();
    }
  }

  function updatePlayBtn(playing) {
    const iconClass = playing ? 'ri-pause-fill' : 'ri-play-fill';
    playIcon.className = iconClass;
    if (miniPlayIcon) miniPlayIcon.className = iconClass;
  }

  function clearLoopTimer() {
    if (state.loopTimer) { clearTimeout(state.loopTimer); state.loopTimer = null; }
  }

  function interruptMainPlayback() {
    audio.stop();
    clearLoopTimer();
    updatePlayBtn(false);
  }

  function playPrev() {
    if (state.filtered.length === 0) return;
    audio.stop(); clearLoopTimer();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    updateDisplay();
    playCurrent();
  }

  function playNext() {
    if (state.filtered.length === 0) return;
    audio.stop(); clearLoopTimer();
    state.currentIndex = Math.min(state.filtered.length - 1, state.currentIndex + 1);
    updateDisplay();
    playCurrent();
  }

  // ---- Speed Control ----
  function setupSpeed() {
    const speedButtons = document.querySelectorAll('#speedControl .speed-btn');
    const allowedSpeeds = Array.from(speedButtons).map(btn => parseFloat(btn.dataset.speed));
    if (!allowedSpeeds.includes(state.speed)) {
      state.speed = 1;
    }
    speedButtons.forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === state.speed);
    });
    audio.setRate(state.speed);
    document.querySelectorAll('#speedControl .speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#speedControl .speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.speed = parseFloat(btn.dataset.speed);
        audio.setRate(state.speed);
        localStorage.setItem('lp_speed', state.speed);
      });
    });
  }

  // ---- Play Mode ----
  function setupPlayMode() {
    document.querySelectorAll('#playMode .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#playMode .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.playMode = btn.dataset.value;
      });
    });
  }

  // ---- Font Size ----
  function setupFontSize() {
    $('btnFontSize').addEventListener('click', () => {
      state.fontSize = state.fontSize >= 24 ? 14 : state.fontSize + 2;
      sentenceText.style.fontSize = state.fontSize + 'px';
      localStorage.setItem('lp_fontSize', state.fontSize);
    });
  }

  // ---- Player Collapse ----
  function setupPlayerCollapse() {
    const updatePlayerCollapse = () => {
      if (state.isPlayerCollapsed) {
        playerSection.classList.add('collapsed');
        playerToggleIcon.className = 'ri-arrow-down-s-line';
        document.body.classList.add('player-collapsed');
      } else {
        playerSection.classList.remove('collapsed');
        playerToggleIcon.className = 'ri-arrow-up-s-line';
        document.body.classList.remove('player-collapsed');
      }
    };
    
    updatePlayerCollapse();

    btnTogglePlayer.addEventListener('click', () => {
      state.isPlayerCollapsed = !state.isPlayerCollapsed;
      localStorage.setItem('lp_playerCollapsed', state.isPlayerCollapsed);
      updatePlayerCollapse();
    });
  }

  // ---- Word Popup ----
  function showWordPopup(word) {
    if (!word) return;
    const entry = DICTIONARY[word];
    $('popupWord').textContent = word;

    if (entry) {
      renderWordPronunciations(word, entry);
      $('popupMeaning').innerHTML = `<strong>${entry.pos}</strong> ${entry.cn}`;
      $('popupExamples').innerHTML = entry.ex.map(e => `<p>• ${e}</p>`).join('');
    } else {
      renderWordPronunciations(word, null);
      $('popupMeaning').innerHTML = `<em>${i18n[state.lang].noDef}</em>`;
      $('popupExamples').innerHTML = '';
    }

    // Check if word is in wordbook
    const isSaved = state.wordbook.includes(word);
    $('popupFav').innerHTML = isSaved ? '<i class="ri-star-fill"></i>' : '<i class="ri-star-line"></i>';
    $('popupFav').classList.toggle('saved', isSaved);

    wordPopup.classList.add('show');
  }

  function setupWordPopup() {
    $('popupClose').addEventListener('click', () => wordPopup.classList.remove('show'));

    $('popupFav').addEventListener('click', () => {
      const word = $('popupWord').textContent;
      const idx = state.wordbook.indexOf(word);
      if (idx > -1) {
        state.wordbook.splice(idx, 1);
        $('popupFav').innerHTML = '<i class="ri-star-line"></i>';
        $('popupFav').classList.remove('saved');
      } else {
        state.wordbook.push(word);
        $('popupFav').innerHTML = '<i class="ri-star-fill"></i>';
        $('popupFav').classList.add('saved');
      }
      localStorage.setItem('lp_wordbook', JSON.stringify(state.wordbook));
    });
    // Close popup on outside click
    document.addEventListener('click', (e) => {
      if (!wordPopup.contains(e.target) && !e.target.classList.contains('word')) {
        wordPopup.classList.remove('show');
      }
    });
  }

  // ---- Stats ----
  function saveStats() {
    localStorage.setItem('lp_stats', JSON.stringify(state.stats));
  }

  function showStats() {
    const s = state.stats;
    $('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${s.sentencesPlayed}</div><div class="stat-label">${i18n[state.lang].statsSentences}</div></div>
      <div class="stat-card"><div class="stat-value">${state.wordbook.length}</div><div class="stat-label">${i18n[state.lang].statsWords}</div></div>
      <div class="stat-card"><div class="stat-value">${SENTENCES.length}</div><div class="stat-label">${i18n[state.lang].statsTotal}</div></div>
      <div class="stat-card"><div class="stat-value">${Object.keys(DICTIONARY).length}</div><div class="stat-label">${i18n[state.lang].statsDict}</div></div>
    `;
    statsModal.classList.add('show');
  }

  // ---- Wordbook ----
  function showWordbook() {
    const list = $('wordbookList');
    if (state.wordbook.length === 0) {
      list.innerHTML = `<li class="wordbook-empty"><i class="ri-bookmark-line" style="font-size:32px;display:block;margin-bottom:8px"></i>${i18n[state.lang].noWords}</li>`;
    } else {
      list.innerHTML = state.wordbook.map(w => {
        const entry = DICTIONARY[w];
        const usIpa = getIpaText(entry, 'us');
        const ukIpa = getIpaText(entry, 'uk');
        const meaning = entry ? entry.cn : '—';
        return `
          <li class="wordbook-item">
            <div class="wb-header">
              <span class="wb-word">${w}</span>
              <button class="wb-remove" data-word="${w}" title="Remove"><i class="ri-delete-bin-line"></i></button>
            </div>
            <div class="wb-meaning">${meaning}</div>
            <div class="popup-pronunciations wb-pronunciations">
              <button class="pron-btn wb-speak ${state.accent === 'us' ? 'active' : ''}" data-accent="us" data-word="${w}">
                <div class="pron-top">
                  <span class="tag">${i18n[state.lang].accentUs}</span>
                  <i class="ri-volume-up-fill"></i>
                </div>
                <span class="ipa">${usIpa || '-'}</span>
              </button>
              <button class="pron-btn wb-speak ${state.accent === 'uk' ? 'active' : ''}" data-accent="uk" data-word="${w}">
                <div class="pron-top">
                  <span class="tag">${i18n[state.lang].accentUk}</span>
                  <i class="ri-volume-up-fill"></i>
                </div>
                <span class="ipa">${ukIpa || '-'}</span>
              </button>
            </div>
          </li>`;
      }).join('');
      
      list.querySelectorAll('.wb-speak').forEach(btn => {
        btn.addEventListener('click', () => {
          const w = btn.dataset.word;
          const accent = btn.dataset.accent;
          interruptMainPlayback();
          btn.classList.add('speaking');
          audio.speakWord(w, () => {
            btn.classList.remove('speaking');
          }, { voiceVariant: accent });
        });
      });

      list.querySelectorAll('.wb-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const w = btn.dataset.word;
          state.wordbook = state.wordbook.filter(x => x !== w);
          localStorage.setItem('lp_wordbook', JSON.stringify(state.wordbook));
          showWordbook();
        });
      });
    }
    wordbookModal.classList.add('show');
  }

  // ---- Track Session Time ----
  function startSessionTimer() {
    state.stats.startTime = Date.now();
    setInterval(() => {
      if (state.stats.startTime) {
        state.stats.totalTime += 1;
        saveStats();
      }
    }, 60000); // Every minute
  }

  // ---- Language ----
  function updateI18n() {
    const dict = i18n[state.lang];
    if (!dict) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key === 'selectPrompt' && state.currentIndex >= 0 && state.filtered.length > 0) return;
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (dict[key]) el.title = dict[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (dict[key]) el.placeholder = dict[key];
    });

    // Update dynamic texts
    if (state.currentIndex >= 0 && state.filtered.length > 0) {
      const s = state.filtered[state.currentIndex];
      const levelNames = { elementary: i18n[state.lang].lvl_elementary, intermediate: i18n[state.lang].lvl_intermediate, advanced: i18n[state.lang].lvl_advanced };
      cardBadge.textContent = levelNames[s.level] || s.level;
    }

    // Check if we need to update the prompt manually if no selection
    if (state.currentIndex < 0 || state.filtered.length === 0) {
      sentenceText.innerHTML = i18n[state.lang].selectPrompt;
    }
    const popupWord = $('popupWord').textContent;
    if (wordPopup.classList.contains('show') && popupWord) {
      renderWordPronunciations(popupWord, DICTIONARY[popupWord] || null);
    }
    renderInstallPrompt();
  }

  function setupLanguage() {
    updateI18n();
    $('btnLang').addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'zh' : 'en';
      localStorage.setItem('lp_lang', state.lang);
      updateI18n();
    });
  }

  function closeSettingsDrawer() {
    settingsDrawer.classList.remove('show');
    settingsOverlay.classList.remove('show');
  }

  function setupPersonalization() {
    audio.setEnglishVariant(state.accent);
    const accentButtons = document.querySelectorAll('#accentControl .accent-btn');
    const syncAccentActive = () => {
      accentButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.accent === state.accent));
    };
    syncAccentActive();

    $('btnPersonalize').addEventListener('click', () => {
      settingsDrawer.classList.add('show');
      settingsOverlay.classList.add('show');
    });
    $('closeSettingsDrawer').addEventListener('click', closeSettingsDrawer);
    settingsOverlay.addEventListener('click', closeSettingsDrawer);

    accentButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.accent = btn.dataset.accent === 'uk' ? 'uk' : 'us';
        localStorage.setItem('lp_accent', state.accent);
        audio.setEnglishVariant(state.accent);
        syncAccentActive();
        
        const popupWord = $('popupWord').textContent;
        if (wordPopup.classList.contains('show') && popupWord) {
          renderWordPronunciations(popupWord, DICTIONARY[popupWord] || null);
        }
      });
    });
  }

  // ---- Theme ----
  function setupTheme() {
    const applyTheme = (animate = false) => {
      if (animate) {
        document.documentElement.classList.add('theme-transition');
        setTimeout(() => document.documentElement.classList.remove('theme-transition'), 500);
      }
      if (state.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        $('themeIcon').className = 'ri-moon-line'; // the icon to switch *back* to dark mode is usually a moon
      } else {
        document.documentElement.removeAttribute('data-theme');
        $('themeIcon').className = 'ri-sun-line'; // icon to switch to light mode is sun
      }
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', state.theme === 'light' ? '#f1f5f9' : '#0f0e17');
      }
    };
    applyTheme(false);
    $('btnTheme').addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('lp_theme', state.theme);
      applyTheme(true);
    });
  }

  // ---- Dropdown Menu ----
  function setupDropdown() {
    const dropdown = $('headerDropdown');
    const btnMore = $('btnMore');
    if (!dropdown || !btnMore) return;
    
    document.addEventListener('click', (e) => {
      if (btnMore.contains(e.target)) {
        dropdown.classList.toggle('show');
      } else if (!dropdown.contains(e.target) || e.target.closest('.dropdown-item')) {
        dropdown.classList.remove('show');
      }
    });

    // Hide dropdown on scroll
    window.addEventListener('scroll', () => {
      if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
      }
    }, { passive: true, capture: true });
  }

  // ---- Initialize ----
  function init() {
    setupTheme();
    setupDropdown();
    setupLanguage();
    setupPersonalization();
    setupFilters();
    setupSpeed();
    setupPlayMode();
    setupFontSize();
    setupPlayerCollapse();
    setupInstallPrompt();
    
    $('btnToggleCn').addEventListener('click', () => {
      state.showCn = !state.showCn;
      localStorage.setItem('lp_showCn', state.showCn);
      updateDisplay();
    });
    
    setupWordPopup();
    startSessionTimer();

    $('btnPlay').addEventListener('click', togglePlay);
    $('btnPrev').addEventListener('click', playPrev);
    $('btnNext').addEventListener('click', playNext);
    
    if ($('btnMiniPlay')) $('btnMiniPlay').addEventListener('click', togglePlay);
    if ($('btnMiniPrev')) $('btnMiniPrev').addEventListener('click', playPrev);
    if ($('btnMiniNext')) $('btnMiniNext').addEventListener('click', playNext);

    $('btnStats').addEventListener('click', showStats);
    $('btnWordbook').addEventListener('click', showWordbook);
    $('btnLocate').addEventListener('click', () => {
      const activeItem = sentenceList.querySelector('.sentence-item.active');
      if (activeItem) activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    $('closeStats').addEventListener('click', () => statsModal.classList.remove('show'));
    $('closeWordbook').addEventListener('click', () => wordbookModal.classList.remove('show'));

    // Close modals on overlay click
    [statsModal, wordbookModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    });

    // Event delegation for sentence list
    sentenceList.addEventListener('click', (e) => {
      const li = e.target.closest('.sentence-item');
      if (li) {
        const index = parseInt(li.dataset.index, 10);
        if (!isNaN(index)) {
          selectSentence(index);
        }
      }
    });

    applyFilters();
  }

  init();
})();
