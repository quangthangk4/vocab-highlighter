/**
 * popup.js — Extension Popup Logic
 *
 * Responsibilities:
 *  • Load and display all saved vocabulary words
 *  • Allow manual addition of words
 *  • Allow deletion of individual words
 *  • Allow clearing all words
 *  • Export word list as a plain-text file
 *  • Live-search / filter the displayed word list
 *  • Sync with chrome.storage.sync in real time
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'vocabWords';

  // ─── DOM References ────────────────────────────────────────────────────────

  const wordList      = document.getElementById('word-list');
  const emptyState    = document.getElementById('empty-state');
  const noResults     = document.getElementById('no-results');
  const wordCountEl   = document.getElementById('word-count');
  const manualInput   = document.getElementById('manual-input');
  const addBtn        = document.getElementById('add-btn');
  const searchInput   = document.getElementById('search-input');
  const clearAllBtn   = document.getElementById('clear-all-btn');
  const exportBtn     = document.getElementById('export-btn');
  const inputHint     = document.getElementById('input-hint');

  // ─── State ─────────────────────────────────────────────────────────────────

  let allWords     = [];  // full list from storage
  let searchQuery  = '';  // current search filter

  // ─── Storage Helpers ────────────────────────────────────────────────────────

  async function getWords() {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  }

  async function saveWords(words) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: words });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Rebuild the visible word list based on `allWords` and `searchQuery`.
   */
  function render() {
    wordList.innerHTML = '';

    const query   = searchQuery.toLowerCase().trim();
    const visible = query
      ? allWords.filter(w => w.includes(query)).reverse()
      : [...allWords].reverse();

    // Update count badge
    wordCountEl.textContent = `${allWords.length} word${allWords.length !== 1 ? 's' : ''}`;

    // Toggle empty / no-results states
    emptyState.hidden = allWords.length > 0;
    noResults.hidden  = !(allWords.length > 0 && visible.length === 0);
    wordList.hidden   = visible.length === 0;

    // Render each word as a list item
    for (const word of visible) {
      const li = document.createElement('li');
      li.className = 'word-item';

      const span = document.createElement('span');
      span.className = 'word-text';

      // Highlight the search query match within the word text
      if (query && word.includes(query)) {
        const idx = word.indexOf(query);
        span.innerHTML =
          escapeHtml(word.slice(0, idx)) +
          `<mark>${escapeHtml(word.slice(idx, idx + query.length))}</mark>` +
          escapeHtml(word.slice(idx + query.length));
      } else {
        span.textContent = word;
      }

      const delBtn = document.createElement('button');
      delBtn.className   = 'delete-btn';
      delBtn.textContent = '✕';
      delBtn.title       = `Remove "${word}"`;
      delBtn.addEventListener('click', () => deleteWord(word));

      li.appendChild(span);
      li.appendChild(delBtn);
      wordList.appendChild(li);
    }
  }

  /** Minimal HTML escaping to avoid XSS when interpolating user-typed text. */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Add Word ──────────────────────────────────────────────────────────────

  async function addWord() {
    const raw  = manualInput.value.trim().replace(/\s+/g, ' ').toLowerCase();

    if (!raw) {
      setHint('Please type a word first.', 'error');
      return;
    }

    if (allWords.includes(raw)) {
      setHint(`"${raw}" is already in your list.`, 'info');
      return;
    }

    allWords = [...allWords, raw];
    await saveWords(allWords);

    manualInput.value = '';
    setHint(`✓ "${raw}" added!`, 'success');
    render();
  }

  /** Show a small hint message below the input. Auto-clears after 2.5 s. */
  function setHint(message, type = 'info') {
    inputHint.textContent = message;
    inputHint.className   = `input-hint ${type}`;
    clearTimeout(setHint._timer);
    setHint._timer = setTimeout(() => {
      inputHint.textContent = '';
      inputHint.className   = 'input-hint';
    }, 2500);
  }

  // ─── Delete Word ───────────────────────────────────────────────────────────

  async function deleteWord(word) {
    allWords = allWords.filter(w => w !== word);
    await saveWords(allWords);
    render();
  }

  // ─── Clear All ─────────────────────────────────────────────────────────────

  async function clearAll() {
    if (!allWords.length) return;

    const confirmed = window.confirm(
      `Delete all ${allWords.length} saved words?\nThis cannot be undone.`
    );
    if (!confirmed) return;

    allWords = [];
    await saveWords([]);
    render();
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  function exportWords() {
    if (!allWords.length) {
      setHint('Nothing to export yet.', 'info');
      return;
    }

    const content = allWords.join('\n');
    const blob    = new Blob([content], { type: 'text/plain' });
    const url     = URL.createObjectURL(blob);

    const a    = document.createElement('a');
    a.href     = url;
    a.download = `vocab-words-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // ─── Event Listeners ───────────────────────────────────────────────────────

  addBtn.addEventListener('click', addWord);

  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWord();
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  clearAllBtn.addEventListener('click', clearAll);
  exportBtn.addEventListener('click', exportWords);

  // React to storage changes made by other parts of the extension
  // (e.g., a word saved via the context menu while popup is open)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    allWords = changes[STORAGE_KEY].newValue || [];
    render();
  });

  // ─── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    allWords = await getWords();
    render();
    manualInput.focus();
  }


  // ─── Settings Button ───────────────────────────────────────────────────────
  const settingsBtn = document.getElementById('settings-btn');
  const patternsBtn = document.getElementById('patterns-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  if (patternsBtn) {
    patternsBtn.addEventListener('click', async () => {
      await chrome.tabs.create({ url: `${chrome.runtime.getURL('options.html')}#patterns` });
      window.close();
    });
  }

  init();

})();
