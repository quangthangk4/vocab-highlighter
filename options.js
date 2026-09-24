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
  const PATTERNS_KEY = 'patternNotes';
  const SETTINGS_KEY = 'vocabSettings';

  // ─── Default settings ──────────────────────────────────────────────────────

  const DEFAULTS = {
    enabled:        true,
    highlightColor: '#fde047',
    textColor:      '#1c1917',
    fontWeight:     'bold',
    showTooltip:    true,
    tooltipWidth:   280,
    patternMatching: {
      enabled: true,
      confidenceThreshold: 0.85,
      aiFallbackEnabled: false,
    },
  };

  let settings = { ...DEFAULTS };
  let patternNotes = [];
  let editingPatternId = null;
  let pendingJsonPatternNotes = null;

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
  const exportPatternsJsonBtn = document.getElementById('export-patterns-json-btn');
  const importFileInput  = document.getElementById('import-file');
  const dropZone         = document.getElementById('drop-zone');
  const importFeedback   = document.getElementById('import-feedback');
  const clearAllBtn      = document.getElementById('clear-all-btn');

  // Save
  const saveBtn          = document.getElementById('save-btn');

  // Pattern Notes
  const patternForm             = document.getElementById('pattern-form');
  const patternEditorTitle      = document.getElementById('pattern-editor-title');
  const patternRawInput         = document.getElementById('pattern-raw-input');
  const patternMeaningInput     = document.getElementById('pattern-meaning-input');
  const patternJsonInput        = document.getElementById('pattern-json-input');
  const patternJsonFeedback     = document.getElementById('pattern-json-feedback');
  const validatePatternJsonBtn  = document.getElementById('validate-pattern-json-btn');
  const patternJsonPreview      = document.getElementById('pattern-json-preview');
  const patternJsonPreviewTitle = document.getElementById('pattern-json-preview-title');
  const patternJsonPreviewCount = document.getElementById('pattern-json-preview-count');
  const patternJsonPreviewList  = document.getElementById('pattern-json-preview-list');
  const confirmPatternJsonBtn   = document.getElementById('confirm-pattern-json-btn');
  const cancelPatternJsonBtn    = document.getElementById('cancel-pattern-json-btn');
  const patternPreview          = document.getElementById('pattern-normalized-preview');
  const patternFeedback         = document.getElementById('pattern-form-feedback');
  const patternSubmitBtn        = document.getElementById('pattern-submit-btn');
  const patternCancelEditBtn    = document.getElementById('pattern-cancel-edit-btn');
  const patternMatchingToggle   = document.getElementById('toggle-pattern-matching');
  const patternThreshold        = document.getElementById('pattern-threshold');
  const patternThresholdValue   = document.getElementById('pattern-threshold-value');
  const patternList             = document.getElementById('pattern-list');
  const patternEmptyState       = document.getElementById('pattern-empty-state');
  const patternCount            = document.getElementById('pattern-count');

  // ─── Tab Navigation ────────────────────────────────────────────────────────

  function activateTab(tabName) {
    const target = document.getElementById(`tab-${tabName}`);
    const button = [...navBtns].find(item => item.dataset.tab === tabName);
    if (!target || !button) return;
    navBtns.forEach(item => item.classList.toggle('active', item === button));
    tabs.forEach(item => item.classList.toggle('active', item === target));
    history.replaceState(null, '', `#${tabName}`);
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // ─── Load Settings ─────────────────────────────────────────────────────────

  async function loadSettings() {
    const [result, localResult] = await Promise.all([
      chrome.storage.sync.get(SETTINGS_KEY),
      chrome.storage.local.get(PATTERNS_KEY),
    ]);
    settings = {
      ...DEFAULTS,
      ...result[SETTINGS_KEY],
      patternMatching: { ...DEFAULTS.patternMatching, ...(result[SETTINGS_KEY]?.patternMatching || {}) },
    };
    patternNotes = localResult[PATTERNS_KEY] || [];
    applySettingsToUI();
    renderPatternList();
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

    if (patternMatchingToggle) {
      patternMatchingToggle.checked = settings.patternMatching.enabled;
      patternThreshold.value = String(Math.round(settings.patternMatching.confidenceThreshold * 100));
      patternThresholdValue.textContent = `${Math.round(settings.patternMatching.confidenceThreshold * 100)}%`;
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

  // ─── Pattern Notes ─────────────────────────────────────────────────────────

  function previewPatternNormalization() {
    const raw = patternRawInput.value.trim();
    if (!raw) {
      patternPreview.textContent = 'Start typing to preview the normalized structure.';
      patternPreview.classList.remove('error');
      return null;
    }
    const result = window.VocabPatternEngine?.normalizePattern(raw);
    if (!result?.ok) {
      patternPreview.textContent = result?.error || 'Pattern engine unavailable.';
      patternPreview.classList.add('error');
      return null;
    }
    patternPreview.textContent = window.VocabPatternEngine.describeNormalizedPattern(result.ast);
    patternPreview.classList.remove('error');
    return result;
  }

  function setPatternFeedback(message = '', type = '') {
    patternFeedback.textContent = message;
    patternFeedback.className = `import-feedback ${type}`.trim();
  }

  function setPatternJsonFeedback(message = '', type = '') {
    patternJsonFeedback.textContent = message;
    patternJsonFeedback.className = `import-feedback ${type}`.trim();
  }

  async function persistPatternNotes() {
    await chrome.storage.local.set({ [PATTERNS_KEY]: patternNotes });
  }

  function setPatternEditor(note = null) {
    editingPatternId = note?.id || null;
    patternEditorTitle.textContent = note ? 'Edit pattern' : 'Add a pattern';
    patternSubmitBtn.textContent = note ? 'Save changes' : 'Save pattern';
    patternCancelEditBtn.hidden = !note;
    patternRawInput.value = note?.rawPattern || '';
    patternMeaningInput.value = note?.meaning || '';
    setPatternFeedback();
    previewPatternNormalization();
    if (note) patternRawInput.focus();
  }

  function patternExampleCount(note) {
    return Array.isArray(note.examples) ? note.examples.length : 0;
  }

  function mergePatternExamples(existingExamples, incomingExamples) {
    const merged = Array.isArray(existingExamples) ? [...existingExamples] : [];
    const seen = new Set(merged.map(item => (typeof item === 'string' ? item : item?.text)).filter(Boolean));
    for (const item of incomingExamples || []) {
      const text = typeof item === 'string' ? item : item?.text;
      if (!text || seen.has(text)) continue;
      seen.add(text);
      merged.push(typeof item === 'string' ? { text, savedAt: new Date().toISOString() } : item);
    }
    return merged;
  }

  function mergeImportedPattern(existing, incoming) {
    const examples = mergePatternExamples(existing.examples, incoming.examples);
    const meaning = existing.meaning || incoming.meaning || '';
    const changed = meaning !== (existing.meaning || '') || examples.length !== (existing.examples || []).length;
    return {
      changed,
      note: changed
        ? { ...existing, meaning, examples, updatedAt: new Date().toISOString() }
        : existing,
    };
  }

  function renderPatternList() {
    if (!patternList) return;
    patternList.innerHTML = '';
    patternCount.textContent = String(patternNotes.length);
    patternEmptyState.hidden = patternNotes.length > 0;

    for (const note of [...patternNotes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))) {
      const item = document.createElement('li');
      item.className = 'pattern-item';

      const top = document.createElement('div');
      top.className = 'pattern-item-top';
      const copy = document.createElement('div');
      const raw = document.createElement('div');
      raw.className = 'pattern-raw';
      raw.textContent = note.rawPattern;
      copy.appendChild(raw);
      if (note.meaning) {
        const meaning = document.createElement('div');
        meaning.className = 'pattern-meaning';
        meaning.textContent = note.meaning;
        copy.appendChild(meaning);
      }
      top.appendChild(copy);
      item.appendChild(top);

      const structure = document.createElement('div');
      structure.className = 'pattern-structure';
      structure.textContent = window.VocabPatternEngine?.describeNormalizedPattern(note.normalizedPattern) || 'Legacy pattern';
      item.appendChild(structure);

      const meta = document.createElement('div');
      meta.className = 'pattern-meta';
      meta.textContent = `${patternExampleCount(note)} saved example${patternExampleCount(note) === 1 ? '' : 's'}`;
      item.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'pattern-actions';
      const status = document.createElement('select');
      status.className = 'pattern-status';
      status.setAttribute('aria-label', `Learning status for ${note.rawPattern}`);
      for (const [value, label] of [['learning', 'Learning'], ['review', 'Review later'], ['learned', 'Learned']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = (note.status || 'learning') === value;
        status.appendChild(option);
      }
      status.addEventListener('change', async () => {
        patternNotes = patternNotes.map(current => current.id === note.id
          ? { ...current, status: status.value, updatedAt: new Date().toISOString() }
          : current);
        await persistPatternNotes();
      });
      actions.appendChild(status);

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.className = 'btn-secondary';
      edit.addEventListener('click', () => setPatternEditor(note));
      actions.appendChild(edit);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.className = 'pattern-delete';
      remove.addEventListener('click', async () => {
        if (!confirm(`Delete pattern “${note.rawPattern}”?`)) return;
        patternNotes = patternNotes.filter(current => current.id !== note.id);
        await persistPatternNotes();
        if (editingPatternId === note.id) setPatternEditor();
        renderPatternList();
      });
      actions.appendChild(remove);
      item.appendChild(actions);
      patternList.appendChild(item);
    }
  }

  patternRawInput.addEventListener('input', previewPatternNormalization);
  patternForm.addEventListener('submit', async event => {
    event.preventDefault();
    const normalized = previewPatternNormalization();
    if (!normalized) {
      setPatternFeedback('Please fix the pattern before saving.', 'error');
      return;
    }

    const raw = patternRawInput.value.trim();
    const duplicate = patternNotes.find(note =>
      note.rawPattern.toLowerCase() === raw.toLowerCase() && note.id !== editingPatternId
    );
    if (duplicate) {
      setPatternFeedback('That pattern is already saved.', 'error');
      return;
    }

    const existing = patternNotes.find(note => note.id === editingPatternId);
    const created = window.VocabPatternEngine.createPatternNote(raw, {
      id: existing?.id,
      meaning: patternMeaningInput.value.trim(),
      status: existing?.status || 'learning',
      examples: existing?.examples || [],
      createdAt: existing?.createdAt,
    });
    if (!created.ok) {
      setPatternFeedback(created.error, 'error');
      return;
    }

    patternNotes = existing
      ? patternNotes.map(note => note.id === existing.id ? created.note : note)
      : [created.note, ...patternNotes];
    await persistPatternNotes();
    renderPatternList();
    setPatternEditor();
    setPatternFeedback(existing ? 'Pattern updated.' : 'Pattern saved.', 'success');
  });

  patternCancelEditBtn.addEventListener('click', () => setPatternEditor());
  importPatternJsonBtn.addEventListener('click', async () => {
    const parsed = window.VocabPatternEngine?.createPatternNotesFromJson(patternJsonInput.value);
    if (!parsed?.ok) {
      setPatternJsonFeedback(parsed?.error || 'Pattern engine unavailable.', 'error');
      return;
    }

    let workingNotes = [...patternNotes];
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    const usedIds = new Set(workingNotes.map(note => note.id));

    for (const incoming of parsed.notes) {
      const existingIndex = workingNotes.findIndex(note =>
        note.rawPattern.toLowerCase() === incoming.rawPattern.toLowerCase()
      );
      if (existingIndex >= 0) {
        const merged = mergeImportedPattern(workingNotes[existingIndex], incoming);
        workingNotes[existingIndex] = merged.note;
        if (merged.changed) updated += 1;
        else unchanged += 1;
        continue;
      }

      let note = incoming;
      if (usedIds.has(note.id)) {
        const recreated = window.VocabPatternEngine.createPatternNote(note.rawPattern, {
          meaning: note.meaning,
          status: note.status,
          examples: note.examples,
          createdAt: note.createdAt,
        });
        note = recreated.note;
      }
      usedIds.add(note.id);
      workingNotes.push(note);
      added += 1;
    }

    patternNotes = workingNotes;
    if (added || updated) await persistPatternNotes();
    renderPatternList();
    patternJsonInput.value = '';
    setPatternJsonFeedback(
      `Imported ${added} new pattern(s)${updated ? `, updated ${updated}` : ''}${unchanged ? `, skipped ${unchanged} unchanged` : ''}.`,
      'success'
    );
  });
  patternMatchingToggle.addEventListener('change', () => {
    settings.patternMatching.enabled = patternMatchingToggle.checked;
  });
  patternThreshold.addEventListener('input', () => {
    const threshold = Number(patternThreshold.value) / 100;
    settings.patternMatching.confidenceThreshold = threshold;
    patternThresholdValue.textContent = `${Math.round(threshold * 100)}%`;
  });

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

  exportPatternsJsonBtn.addEventListener('click', () => {
    if (!patternNotes.length) { setFeedback('No pattern notes to export.', 'error'); return; }
    downloadFile(JSON.stringify(patternNotes, null, 2), 'vocab-pattern-notes.json', 'application/json');
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
    let importedPatterns = [];

    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
        if (parsed.every(item => typeof item === 'string')) {
          imported = parsed.map(w => w.trim().toLowerCase()).filter(Boolean);
        } else if (parsed.every(item => item && typeof item === 'object' && item.rawPattern)) {
          importedPatterns = parsed;
        } else {
          throw new Error('Expected a word array or an exported pattern-notes array');
        }
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
    if (newWords.length) await chrome.storage.sync.set({ [STORAGE_KEY]: [...existing, ...newWords] });

    const knownPatterns = new Set(patternNotes.map(note => note.rawPattern.toLowerCase()));
    const usedPatternIds = new Set(patternNotes.map(note => note.id));
    const newPatterns = [];
    for (const item of importedPatterns) {
      const created = window.VocabPatternEngine?.createPatternNote(item.rawPattern, {
        ...item,
        id: usedPatternIds.has(item.id) ? undefined : item.id,
      });
      if (!created?.ok || knownPatterns.has(created.note.rawPattern.toLowerCase())) continue;
      knownPatterns.add(created.note.rawPattern.toLowerCase());
      usedPatternIds.add(created.note.id);
      newPatterns.push(created.note);
    }
    if (newPatterns.length) {
      patternNotes = [...patternNotes, ...newPatterns];
      await persistPatternNotes();
      renderPatternList();
    }

    const duplicates = imported.length - newWords.length + importedPatterns.length - newPatterns.length;
    setFeedback(
      `✅ Imported ${newWords.length} word(s) and ${newPatterns.length} pattern(s). ${duplicates} duplicate or invalid item(s) skipped.`,
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

  // Keep the list current when an example or status is changed from a webpage.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PATTERNS_KEY]) return;
    patternNotes = changes[PATTERNS_KEY].newValue || [];
    renderPatternList();
  });

  // ─── Init ──────────────────────────────────────────────────────────────────

  activateTab(location.hash.slice(1) || 'appearance');
  loadSettings();

})();
