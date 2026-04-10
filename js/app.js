// ==================== MAIN APPLICATION ====================
(function() {
  'use strict';

  // State
  const state = {
    sentences: [...SENTENCES],
    filtered: [...SENTENCES],
    currentIndex: -1,
    typeFilter: 'all',
    levelFilter: 'all',
    playMode: 'sequential',
    speed: 1,
    fontSize: parseInt(localStorage.getItem('lp_fontSize') || '18'),
    loopTimer: null,
    wordbook: JSON.parse(localStorage.getItem('lp_wordbook') || '[]'),
    stats: JSON.parse(localStorage.getItem('lp_stats') || '{"totalTime":0,"sessionsCount":0,"sentencesPlayed":0,"startTime":null}'),
    lang: localStorage.getItem('lp_lang') || 'zh',
    showCn: localStorage.getItem('lp_showCn') === 'true'
  };

  const i18n = {
    en: {
      type: "Type", all: "All", interrogative: "Interrogative", category: "Category", dialogue: "Dialogue",
      level: "Level", speed: "Speed", mode: "Mode", sequential: "Sequential", loop: "Loop",
      sentences: "Sentences", statsTitle: "Learning Stats", wordbookTitle: "Word Book",
      selectPrompt: "Select a sentence to start practicing",
      statsSentences: "Sentences Played", statsWords: "Words Saved",
      statsTotal: "Total Sentences", statsDict: "Dictionary Words",
      noDef: "No definition available",
      noWords: "No words saved yet.<br>Tap any word to add it.",
      lvl_elementary: "Elementary", lvl_intermediate: "Intermediate", lvl_advanced: "Advanced"
    },
    zh: {
      type: "类型", all: "全部", interrogative: "疑问句", category: "分类句型", dialogue: "对话文章",
      level: "难度等级", speed: "语速调节", mode: "播放模式", sequential: "顺序播放", loop: "单句循环",
      sentences: "语句列表", statsTitle: "学习统计", wordbookTitle: "生词本",
      selectPrompt: "请选择一个句子开始练习",
      statsSentences: "已学句子数", statsWords: "已存单词数",
      statsTotal: "总句子数", statsDict: "词典总词汇",
      noDef: "暂无释义",
      noWords: "暂无保存的单词。<br>点击任意单词即可添加。",
      lvl_elementary: "入门级", lvl_intermediate: "进阶级", lvl_advanced: "高级"
    }
  };

  const audio = new AudioEngine();

  // DOM Elements
  const $ = id => document.getElementById(id);
  const sentenceText = $('sentenceText');
  const sentenceList = $('sentenceList');
  const playIcon = $('playIcon');
  const progressBar = $('progressBar');
  const cardBadge = $('cardBadge');
  const sentenceIndex = $('sentenceIndex');
  const listCount = $('listCount');
  const wordPopup = $('wordPopup');
  const statsModal = $('statsModal');
  const wordbookModal = $('wordbookModal');

  // ---- Filter Logic ----
  function applyFilters() {
    state.filtered = state.sentences.filter(s => {
      const typeMatch = state.typeFilter === 'all' || s.type === state.typeFilter;
      const levelMatch = state.levelFilter === 'all' || s.level === state.levelFilter;
      return typeMatch && levelMatch;
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
    sentenceList.innerHTML = '';
    state.filtered.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'sentence-item' + (i === state.currentIndex ? ' active' : '');
      li.innerHTML = `<span class="num">${i + 1}</span><span class="text">${s.text}</span><span class="level-dot ${s.level}"></span>`;
      li.addEventListener('click', () => selectSentence(i));
      sentenceList.appendChild(li);
    });
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
    document.querySelectorAll('.sentence-item').forEach((el, i) => {
      el.classList.toggle('active', i === state.currentIndex);
    });

    // Scroll active item into view
    const activeItem = sentenceList.querySelector('.sentence-item.active');
    if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

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
  function getPlaybackRates(baseSpeed) {
    const first = Math.max(0.5, baseSpeed);
    const second = Math.max(0.42, first - 0.15);
    const third = Math.max(0.35, second - 0.15);
    const chinese = Math.max(0.32, third - 0.08);
    return { first, second, third, chinese };
  }

  function toDetachedSentence(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';
    const hasEndingPunct = /[.!?]$/.test(trimmed);
    const ending = hasEndingPunct ? trimmed.slice(-1) : '';
    const body = hasEndingPunct ? trimmed.slice(0, -1) : trimmed;
    const words = body.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += 2) {
      chunks.push(words.slice(i, i + 2).join(' '));
    }
    return `${chunks.join(', ')}${ending}`;
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
    audio.onProgress = pct => { progressBar.style.width = pct + '%'; };
    audio.speak(pass.text, handlePassEnd, { lang: pass.lang, rate: pass.rate, pitch: pass.pitch || 1 });
  }

  function playCurrent(playReason = 'initial') {
    if (state.currentIndex < 0 || state.filtered.length === 0) return;
    const s = state.filtered[state.currentIndex];

    state.stats.sentencesPlayed++;
    saveStats();

    const rates = getPlaybackRates(state.speed);
    const passes = [
      { text: s.text, lang: 'en-US', rate: rates.first, pitch: 1.01 },
      { text: s.text, lang: 'en-US', rate: rates.second, pitch: 1.02 },
      { text: toDetachedSentence(s.text), lang: 'en-US', rate: rates.third, pitch: 1.03 },
      { text: s.cn || s.text, lang: 'zh-CN', rate: rates.chinese, pitch: 1.0 }
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
    playIcon.className = playing ? 'ri-pause-fill' : 'ri-play-fill';
  }

  function clearLoopTimer() {
    if (state.loopTimer) { clearTimeout(state.loopTimer); state.loopTimer = null; }
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
    document.querySelectorAll('#speedControl .speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#speedControl .speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.speed = parseFloat(btn.dataset.speed);
        audio.setRate(state.speed);
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

  // ---- Word Popup ----
  function showWordPopup(word) {
    if (!word) return;
    const entry = DICTIONARY[word];
    $('popupWord').textContent = word;

    if (entry) {
      $('popupPhonetic').textContent = entry.ipa;
      $('popupMeaning').innerHTML = `<strong>${entry.pos}</strong> ${entry.cn}`;
      $('popupExamples').innerHTML = entry.ex.map(e => `<p>• ${e}</p>`).join('');
    } else {
      $('popupPhonetic').textContent = '';
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

    // Speak the word
    $('popupSpeak').addEventListener('click', () => {
      const word = $('popupWord').textContent;
      if (!word) return;
      const btn = $('popupSpeak');
      btn.classList.add('speaking');
      audio.speakWord(word, () => {
        btn.classList.remove('speaking');
      });
    });

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
        const ipa = entry && entry.ipa ? ` <span style="color:var(--accent);font-size:12px;margin-left:6px;font-style:italic">${entry.ipa}</span>` : '';
        const meaning = entry ? entry.cn : '—';
        return `
          <li class="wordbook-item">
            <div><span class="wb-word">${w}</span>${ipa}<br><span class="wb-meaning">${meaning}</span></div>
            <div style="display:flex; gap:12px;">
              <button class="wb-speak" data-word="${w}" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:18px;transition:all 0.2s;"><i class="ri-volume-up-fill"></i></button>
              <button class="wb-remove" data-word="${w}" style="background:none;border:none;color:var(--accent2);cursor:pointer;font-size:18px;transition:all 0.2s;"><i class="ri-delete-bin-line"></i></button>
            </div>
          </li>`;
      }).join('');
      
      list.querySelectorAll('.wb-speak').forEach(btn => {
        btn.addEventListener('click', () => {
          const w = btn.dataset.word;
          btn.style.transform = 'scale(1.2)';
          audio.speakWord(w, () => {
            btn.style.transform = 'scale(1)';
          });
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
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      // Do not overwrite the main sentence display if a sentence is currently playing
      if (key === 'selectPrompt' && state.currentIndex >= 0 && state.filtered.length > 0) return;
      
      if (i18n[state.lang] && i18n[state.lang][key]) {
        el.textContent = i18n[state.lang][key];
      }
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
  }

  function setupLanguage() {
    updateI18n();
    $('btnLang').addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'zh' : 'en';
      localStorage.setItem('lp_lang', state.lang);
      updateI18n();
    });
  }

  // ---- Initialize ----
  function init() {
    setupLanguage();
    setupFilters();
    setupSpeed();
    setupPlayMode();
    setupFontSize();
    
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
    $('btnStats').addEventListener('click', showStats);
    $('btnWordbook').addEventListener('click', showWordbook);
    $('closeStats').addEventListener('click', () => statsModal.classList.remove('show'));
    $('closeWordbook').addEventListener('click', () => wordbookModal.classList.remove('show'));

    // Close modals on overlay click
    [statsModal, wordbookModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    });

    applyFilters();
  }

  init();
})();
