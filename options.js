/**
 * options.js — Settings Page Logic
 *
 * Manages:
 *  • Tab navigation
 *  • Appearance settings (highlight colour, text colour, font weight)
 *  • Behaviour toggles (enabled, tooltip)
 *  • Backup: export .txt / .json
 *  • Restore: import .txt / .json
 *  • Clear all words
 *  • Save settings to chrome.storage.sync
 *  • Live preview of highlight appearance
 */

(() => {
  'use strict';

  const STORAGE_KEY  = 'vocabWords';
  const SETTINGS_KEY = 'vocabSettings';

  // ─── Default settings ──────────────────────────────────────────────────────

  const DEFAULTS = {
    enabled:        true,
    highlightColor: '#fde047',
    textColor:      '#1c1917',
    fontWeight:     'bold',
    showTooltip:    true,
    tooltipWidth:   280,
  };

  let settings = { ...DEFAULTS };

  // ─── DOM References ────────────────────────────────────────────────────────

  const navBtns          = document.querySelectorAll('.nav-btn');
  const tabs             = document.querySelectorAll('.tab');
  const savedToast       = document.getElementById('saved-toast');

  // Appearance
  const colorSwatches    = document.querySelectorAll('.preset-swatch[data-color]');
  const customColorInput = document.getElementById('custom-color');
  const customSwatch     = document.querySelector('.custom-swatch');
  const textSwatches     = document.querySelectorAll('.preset-text-swatch');
  const fontWeightBtns   = document.querySelectorAll('.toggle-btn[data-fw]');
  const previewMarks     = document.querySelectorAll('.preview-hl');

  // Behaviour
  const toggleEnabled    = document.getElementById('toggle-enabled');
  const toggleTooltip    = document.getElementById('toggle-tooltip');

  // Tooltip width
  const tooltipWidthSlider = document.getElementById('tooltip-width');
  const tooltipWidthValue  = document.getElementById('tooltip-width-value');
  const tooltipPreviewBox  = document.getElementById('tooltip-preview-box');

  // Backup
  const exportTxtBtn     = document.getElementById('export-txt-btn');
  const exportJsonBtn    = document.getElementById('export-json-btn');
  const importFileInput  = document.getElementById('import-file');
  const dropZone         = document.getElementById('drop-zone');
  const importFeedback   = document.getElementById('import-feedback');
  const clearAllBtn      = document.getElementById('clear-all-btn');

  // Save
  const saveBtn          = document.getElementById('save-btn');

  // ─── Tab Navigation ────────────────────────────────────────────────────────

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ─── Load Settings ─────────────────────────────────────────────────────────

  async function loadSettings() {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    settings = { ...DEFAULTS, ...result[SETTINGS_KEY] };
    applySettingsToUI();
  }

  function applySettingsToUI() {
    // Highlight colour
    setActiveColorSwatch(settings.highlightColor);
    customColorInput.value = settings.highlightColor;

    // Text colour
    setActiveTextSwatch(settings.textColor);

    // Font weight
    fontWeightBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.fw === settings.fontWeight);
    });

    // Toggles
    toggleEnabled.checked = settings.enabled;
    toggleTooltip.checked = settings.showTooltip;

    // Preview
    updatePreview();

    // Tooltip width
    if (tooltipWidthSlider) {
      tooltipWidthSlider.value      = settings.tooltipWidth;
      tooltipWidthValue.textContent = `${settings.tooltipWidth}px`;
      tooltipPreviewBox.style.width = `${settings.tooltipWidth}px`;
    }
  }

  // ─── Colour Swatches ───────────────────────────────────────────────────────

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      settings.highlightColor = swatch.dataset.color;
      setActiveColorSwatch(settings.highlightColor);
      customColorInput.value = settings.highlightColor;
      updatePreview();
    });
  });

  function setActiveColorSwatch(color) {
    colorSwatches.forEach(s => s.classList.remove('active'));
    customSwatch.classList.remove('active');
    const match = [...colorSwatches].find(s => s.dataset.color === color);
    if (match) {
      match.classList.add('active');
    } else {
      customSwatch.classList.add('active');
    }
  }

  // Custom colour picker
  customSwatch.addEventListener('click', () => {
    customColorInput.click();
  });

  customColorInput.addEventListener('input', () => {
    settings.highlightColor = customColorInput.value;
    setActiveColorSwatch(settings.highlightColor);
    updatePreview();
  });

  // Text colour swatches
  textSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      settings.textColor = swatch.dataset.tcolor;
      setActiveTextSwatch(settings.textColor);
      updatePreview();
    });
  });

  function setActiveTextSwatch(color) {
    textSwatches.forEach(s => s.classList.toggle('active', s.dataset.tcolor === color));
  }

  // Font weight
  fontWeightBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.fontWeight = btn.dataset.fw;
      fontWeightBtns.forEach(b => b.classList.toggle('active', b === btn));
      updatePreview();
    });
  });

  // ─── Live Preview ──────────────────────────────────────────────────────────

  function updatePreview() {
    const root = document.documentElement;
    root.style.setProperty('--preview-bg',   settings.highlightColor);
    root.style.setProperty('--preview-text', settings.textColor);
    root.style.setProperty('--preview-fw',   settings.fontWeight);
  }

  // ─── Behaviour Toggles ─────────────────────────────────────────────────────

  toggleEnabled.addEventListener('change', () => {
    settings.enabled = toggleEnabled.checked;
  });

  toggleTooltip.addEventListener('change', () => {
    settings.showTooltip = toggleTooltip.checked;
  });

  // Tooltip width slider
  if (tooltipWidthSlider) {
    tooltipWidthSlider.addEventListener('input', () => {
      const val = Number(tooltipWidthSlider.value);
      settings.tooltipWidth         = val;
      tooltipWidthValue.textContent = `${val}px`;
      tooltipPreviewBox.style.width = `${val}px`;
    });
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  saveBtn.addEventListener('click', async () => {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    broadcastSettingsUpdate();
    showToast();
  });

  function showToast() {
    savedToast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { savedToast.hidden = true; }, 2500);
  }

  async function broadcastSettingsUpdate() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url?.startsWith('http')) continue;
      chrome.tabs.sendMessage(tab.id, {
        type:     'SETTINGS_UPDATED',
        settings,
      }).catch(() => {});
    }
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  async function getWords() {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  }

  exportTxtBtn.addEventListener('click', async () => {
    const words = await getWords();
    if (!words.length) { setFeedback('No words to export.', 'error'); return; }
    downloadFile(words.join('\n'), 'vocab-words.txt', 'text/plain');
  });

  exportJsonBtn.addEventListener('click', async () => {
    const words = await getWords();
    if (!words.length) { setFeedback('No words to export.', 'error'); return; }
    downloadFile(JSON.stringify(words, null, 2), 'vocab-words.json', 'application/json');
  });

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Import ────────────────────────────────────────────────────────────────

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });

  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files[0];
    if (file) processImportFile(file);
    importFileInput.value = '';
  });

  async function processImportFile(file) {
    const text = await file.text();
    let imported = [];

    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
        imported = parsed.map(w => String(w).trim().toLowerCase()).filter(Boolean);
      } else {
        // .txt: one word/phrase per line
        imported = text.split('\n')
          .map(l => l.trim().toLowerCase())
          .filter(Boolean);
      }
    } catch (err) {
      setFeedback(`❌ Import failed: ${err.message}`, 'error');
      return;
    }

    const existing = await getWords();
    const newWords = imported.filter(w => !existing.includes(w));
    const merged   = [...existing, ...newWords];

    await chrome.storage.sync.set({ [STORAGE_KEY]: merged });
    setFeedback(
      `✅ Imported ${newWords.length} new word(s). ${imported.length - newWords.length} duplicate(s) skipped.`,
      'success'
    );
  }

  function setFeedback(message, type) {
    importFeedback.textContent = message;
    importFeedback.className   = `import-feedback ${type}`;
    clearTimeout(setFeedback._t);
    setFeedback._t = setTimeout(() => {
      importFeedback.textContent = '';
      importFeedback.className   = 'import-feedback';
    }, 5000);
  }

  // ─── Clear All ─────────────────────────────────────────────────────────────

  clearAllBtn.addEventListener('click', async () => {
    const words = await getWords();
    if (!words.length) { setFeedback('Word list is already empty.', 'error'); return; }

    const confirmed = confirm(
      `Permanently delete all ${words.length} saved words?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    await chrome.storage.sync.set({ [STORAGE_KEY]: [] });
    setFeedback(`✅ Deleted ${words.length} words.`, 'success');
  });

  // ─── Init ──────────────────────────────────────────────────────────────────

  loadSettings();

})();
