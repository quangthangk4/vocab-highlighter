/**
 * content.js — Content Script v4
 *
 * v4 additions:
 *  - Ctrl + Left-click on highlighted word → open meaning popup
 *  - Tooltip shows meaning if available
 * v3 additions:
 *  - Ctrl + Right-click on highlighted word → removes it from vocabulary
 */

(() => {
  'use strict';

  const STORAGE_KEY     = 'vocabWords';
  const SETTINGS_KEY    = 'vocabSettings';
  const HIGHLIGHT_CLASS = 'vocab-highlight';
  const TOOLTIP_ID      = 'vocab-hl-tooltip';
  const SEL_BTN_ID      = 'vocab-sel-btn';
  const DYN_STYLE_ID     = 'vocab-hl-dynamic-style';
  const MEANINGS_KEY     = 'vocabMeanings';    // { word: "nghĩa" }
  const MEANING_POPUP_ID = 'vocab-meaning-popup';

  const SKIP_TAGS = new Set([
    'SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','BUTTON',
    'CODE','PRE','NOSCRIPT','IFRAME','AUDIO','VIDEO','SVG',
  ]);

  let vocabPattern     = null;
  let currentSettings  = getDefaultSettings();
  let mutationObserver = null;
  let isHighlighting   = false;

  function getDefaultSettings() {
    return {
      enabled:        true,
      highlightColor: '#fde047',
      textColor:      '#1c1917',
      fontWeight:     'bold',
      showTooltip:    true,
      tooltipWidth:   280,
    };
  }

  // ─── Dynamic Style ────────────────────────────────────────────────────────────

  function applyDynamicStyle(settings) {
    let el = document.getElementById(DYN_STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = DYN_STYLE_ID;
      document.head?.appendChild(el);
    }
    el.textContent = `
      mark.${HIGHLIGHT_CLASS} {
        background-color : ${settings.highlightColor} !important;
        color            : ${settings.textColor}      !important;
        font-weight      : ${settings.fontWeight}     !important;
      }
    `;
  }

  // ─── Pattern Builder ──────────────────────────────────────────────────────────

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildPattern(words) {
    if (!words.length) return null;
    const alts = words.map(escapeRegex).join('|');
    return new RegExp(`\\b(${alts})\\b`, 'gi');
  }

  // ─── Safe DOM Traversal ───────────────────────────────────────────────────────

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.classList.contains(HIGHLIGHT_CLASS)) return NodeFilter.FILTER_REJECT;
          if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  // ─── Highlight ────────────────────────────────────────────────────────────────

  function highlightTextNode(textNode) {
    if (!textNode.parentNode || !vocabPattern) return;
    const text = textNode.textContent;
    vocabPattern.lastIndex = 0;
    if (!vocabPattern.test(text)) return;
    vocabPattern.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let cursor = 0, match;

    while ((match = vocabPattern.exec(text)) !== null) {
      if (match.index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }
      const mark = document.createElement('mark');
      mark.className     = HIGHLIGHT_CLASS;
      mark.textContent   = match[0];
      mark.dataset.vocab = match[0].toLowerCase();
      fragment.appendChild(mark);
      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function highlightSubtree(root = document.body) {
    if (!vocabPattern || !root || isHighlighting) return;
    isHighlighting = true;

    const textNodes = collectTextNodes(root);
    let index = 0;

    function processBatch(deadline) {
      while (index < textNodes.length) {
        if (!deadline.didTimeout && deadline.timeRemaining() < 2) break;
        highlightTextNode(textNodes[index++]);
        if (index % 50 === 0) break;
      }
      if (index < textNodes.length) {
        scheduleIdleCallback(processBatch);
      } else {
        isHighlighting = false;
      }
    }
    scheduleIdleCallback(processBatch);
  }

  function scheduleIdleCallback(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: 500 });
    } else {
      setTimeout(() => fn({ timeRemaining: () => 50, didTimeout: true }), 0);
    }
  }

  function removeAllHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(mark => {
      mark.replaceWith(document.createTextNode(mark.textContent));
    });
    document.body.normalize();
  }

  // ─── IPA ─────────────────────────────────────────────────────────────────────

  const ipaCache = new Map();  // word → { us, uk }

  async function fetchIPA(word) {
    if (ipaCache.has(word)) return ipaCache.get(word);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'FETCH_IPA', word });
      const result = { us: response?.us || '', uk: response?.uk || '' };
      ipaCache.set(word, result);
      return result;
    } catch {
      const empty = { us: '', uk: '' };
      ipaCache.set(word, empty);
      return empty;
    }
  }

  function buildTooltipHTML(word, us, uk, meaning = '') {
    const wordRow =
      `<div style="opacity:0.6;font-size:11px;letter-spacing:0.06em;` +
      `text-transform:uppercase;margin-bottom:6px;color:#94a3b8">📖 ${word}</div>`;

    const meaningRow = meaning
      ? `<div style="` +
          `margin-bottom:8px;padding:7px 10px;` +
          `background:rgba(253,224,71,0.08);` +
          `border-left:3px solid #fde047;` +
          `border-radius:0 6px 6px 0;` +
          `font-size:13px;color:#f1f5f9;font-family:system-ui,sans-serif;` +
          `line-height:1.5` +
        `">${meaning}</div>`
      : '';

    function accentBlock(flag, label, ipa) {
      if (!ipa) return '';
      return (
        `<div style="display:flex;align-items:baseline;gap:6px;margin-top:2px">` +
          `<span style="font-size:16px;line-height:1">${flag}</span>` +
          `<div>` +
            `<div style="font-size:9px;opacity:0.5;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:1px">${label}</div>` +
            `<div style="font-size:17px;color:#fde047;letter-spacing:0.03em">${ipa}</div>` +
          `</div>` +
        `</div>`
      );
    }

    const ipaSection = (!us && !uk)
      ? `<div style="opacity:0.4;font-size:12px;font-style:italic">pronunciation not found</div>`
      : accentBlock('🇺🇸', 'American', us) +
        ((us && uk) ? `<div style="border-top:1px solid rgba(255,255,255,0.1);margin:7px 0 5px"></div>` : '') +
        accentBlock('🇬🇧', 'British', uk);

    const deleteRow =
      `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">` +
        `<button class="vocab-tooltip-delete" style="` +
          `background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.3);` +
          `border-radius:6px;padding:4px 10px;font-size:11px;font-family:system-ui,sans-serif;` +
          `font-weight:600;cursor:pointer;width:100%;transition:background 0.15s ease` +
        `">🗑 REMOVE (ctrl + right click)</button>` +
      `</div>`;

    return wordRow + meaningRow + ipaSection + deleteRow;
  }

  // ─── Tooltip ──────────────────────────────────────────────────────────────────

  function setupTooltip() {
    document.getElementById(TOOLTIP_ID)?.remove();

    const tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    Object.assign(tooltip.style, {
      position:      'fixed',
      zIndex:        '2147483647',
      display:       'none',
      pointerEvents: 'none',
      background:    'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color:         '#e2e8f0',
      padding:       '11px 16px',
      borderRadius:  '12px',
      fontSize:      '13px',
      fontFamily:    '"Noto Serif", Georgia, serif',
      letterSpacing: '0.04em',
      boxShadow:     '0 6px 28px rgba(0,0,0,0.5)',
      border:        '1px solid rgba(255,255,255,0.12)',
      minWidth:      '160px',
      lineHeight:    '1.5',
      transition:    'opacity 0.15s ease',
    });
    document.body.appendChild(tooltip);

    let currentTarget = null;

    document.addEventListener('mouseover', async (e) => {
      if (!currentSettings.showTooltip) return;
      const el = e.target;
      if (!el.classList?.contains(HIGHLIGHT_CLASS)) return;

      currentTarget = el;
      const word = el.dataset.vocab || el.textContent.toLowerCase();

      tooltip.style.maxWidth      = `${currentSettings.tooltipWidth || 280}px`;
      tooltip.style.pointerEvents = 'none';
      tooltip.innerHTML =
        `<div style="opacity:0.5;font-size:12px;font-style:italic">loading…</div>`;
      positionTooltip(tooltip, e);
      tooltip.style.display = 'block';

      const [{ us, uk }, meaningsResult] = await Promise.all([
        fetchIPA(word),
        chrome.storage.sync.get(MEANINGS_KEY),
      ]);
      if (currentTarget !== el) return;

      const meanings = meaningsResult[MEANINGS_KEY] || {};
      tooltip.innerHTML = buildTooltipHTML(word, us, uk, meanings[word] || '');
      tooltip.style.pointerEvents = 'auto';

      // Wire delete button
      const deleteBtn = tooltip.querySelector('.vocab-tooltip-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('mouseover', () => {
          deleteBtn.style.background = 'rgba(239,68,68,0.25)';
        });
        deleteBtn.addEventListener('mouseout', () => {
          deleteBtn.style.background = 'rgba(239,68,68,0.12)';
        });
        deleteBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          tooltip.style.display = 'none';
          currentTarget = null;
          await removeWord(word);
        });
      }
    }, true);

    document.addEventListener('mousemove', (e) => {
      if (tooltip.style.display === 'none') return;
      positionTooltip(tooltip, e);
    }, { passive: true });

    // Hide tooltip only when leaving both the highlight AND the tooltip itself
    document.addEventListener('mouseout', (e) => {
      const to = e.relatedTarget;
      if (
        e.target.classList?.contains(HIGHLIGHT_CLASS) &&
        !tooltip.contains(to)
      ) {
        tooltip.style.display = 'none';
        currentTarget = null;
      }
    }, true);

    // Hide when mouse leaves the tooltip (and not going to a highlight)
    tooltip.addEventListener('mouseleave', (e) => {
      const to = e.relatedTarget;
      if (!to?.classList?.contains(HIGHLIGHT_CLASS)) {
        tooltip.style.display = 'none';
        currentTarget = null;
      }
    });
  }

  function positionTooltip(tooltip, e) {
    const w = currentSettings.tooltipWidth || 280;
    const x = Math.min(e.clientX + 14, window.innerWidth  - w - 10);
    const y = Math.max(e.clientY - 20,  8);
    tooltip.style.left = `${x}px`;
    tooltip.style.top  = `${y}px`;
  }

  // ─── Remove Word ──────────────────────────────────────────────────────────────

  async function removeWord(word) {
    try {
      const result  = await chrome.storage.sync.get(STORAGE_KEY);
      const words   = result[STORAGE_KEY] || [];
      const updated = words.filter(w => w !== word);
      await chrome.storage.sync.set({ [STORAGE_KEY]: updated });

      // Remove highlights of this specific word on current page immediately
      document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(mark => {
        if (mark.dataset.vocab === word) {
          mark.replaceWith(document.createTextNode(mark.textContent));
        }
      });
      document.body.normalize();

      showSaveBanner(word, false, true);
    } catch (err) {
      console.warn('[VocabHighlighter] removeWord error:', err);
    }
  }

  // ─── Selection Save Button ────────────────────────────────────────────────────

  function setupSelectionButton() {
    document.getElementById(SEL_BTN_ID)?.remove();

    const btn = document.createElement('button');
    btn.id = SEL_BTN_ID;
    btn.title = 'Save to Vocabulary';
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        <line x1="12" y1="9" x2="12" y2="15"/>
        <line x1="9"  y1="12" x2="15" y2="12"/>
      </svg>
      <span>Save</span>
    `;

    Object.assign(btn.style, {
      position:      'fixed',
      zIndex:        '2147483647',
      display:       'none',
      alignItems:    'center',
      gap:           '5px',
      background:    '#1a1a2e',
      color:         '#fde047',
      border:        '1.5px solid rgba(253,224,71,0.4)',
      borderRadius:  '7px',
      padding:       '5px 10px',
      fontSize:      '12px',
      fontFamily:    'system-ui, sans-serif',
      fontWeight:    '600',
      cursor:        'pointer',
      boxShadow:     '0 3px 14px rgba(0,0,0,0.4)',
      letterSpacing: '0.02em',
      userSelect:    'none',
      transition:    'transform 0.12s ease, background 0.12s ease',
      pointerEvents: 'auto',
    });

    document.body.appendChild(btn);

    let pendingWord = '';

    document.addEventListener('mouseup', (e) => {
      if (e.target === btn || btn.contains(e.target)) return;
      setTimeout(() => {
        const sel  = window.getSelection();
        const text = sel?.toString().trim().replace(/\s+/g, ' ').toLowerCase();
        if (!text || text.length > 80) { btn.style.display = 'none'; return; }

        const range = sel.getRangeAt(0);
        const rect  = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) { btn.style.display = 'none'; return; }

        pendingWord = text;
        const x = Math.min(rect.right - 4,  window.innerWidth  - 90);
        const y = Math.min(rect.bottom + 6,  window.innerHeight - 38);
        btn.style.left    = `${x}px`;
        btn.style.top     = `${y}px`;
        btn.style.display = 'flex';
        btn.style.transform = 'scale(0.85)';
        requestAnimationFrame(() => { btn.style.transform = 'scale(1)'; });
      }, 10);
    });

    btn.addEventListener('mousedown', (e) => { e.preventDefault(); });

    btn.addEventListener('click', async () => {
      if (!pendingWord) return;
      const word = pendingWord;
      btn.style.display = 'none';
      window.getSelection()?.removeAllRanges();

      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD_FROM_CONTENT',
        word,
      }).catch(() => null);

      showSaveBanner(word, response?.saved === false);
    });

    btn.addEventListener('mouseover', () => { btn.style.background = '#16213e'; });
    btn.addEventListener('mouseout',  () => { btn.style.background = '#1a1a2e'; });

    document.addEventListener('mousedown', (e) => {
      if (e.target !== btn && !btn.contains(e.target)) btn.style.display = 'none';
    });

    window.addEventListener('scroll', () => { btn.style.display = 'none'; }, { passive: true });
  }

  // ─── Ctrl + Right-click to Remove Word ───────────────────────────────────────
  //
  // Ctrl + right-click on any highlighted word → remove from vocabulary.
  // Normal right-click (no Ctrl) is untouched so the browser/extension context
  // menu still works as usual.

  document.addEventListener('contextmenu', async (e) => {
    if (!e.ctrlKey) return;                         // Only act when Ctrl is held

    const el = e.target.closest?.('.' + HIGHLIGHT_CLASS);
    if (!el) return;                                // Not on a highlight → ignore

    e.preventDefault();                             // Suppress the context menu popup
    e.stopPropagation();

    const word = el.dataset.vocab || el.textContent.toLowerCase();

    // Brief red flash so the user sees which word is being removed
    el.style.outline       = '2px solid #ef4444';
    el.style.outlineOffset = '1px';
    setTimeout(() => {
      el.style.outline       = '';
      el.style.outlineOffset = '';
    }, 300);

    await removeWord(word);
  }, true);   // capture phase — intercepts before any site listener

  // ─── Meaning Popup (Ctrl + Left-click on highlighted word) ───────────────────

  function setupMeaningPopup() {
    document.addEventListener('click', async (e) => {
      if (!e.ctrlKey) return;

      const el = e.target.closest?.('.' + HIGHLIGHT_CLASS);
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      const word = el.dataset.vocab || el.textContent.toLowerCase();

      const stored   = await chrome.storage.sync.get(MEANINGS_KEY);
      const meanings = stored[MEANINGS_KEY] || {};
      const existing = meanings[word] || '';

      showMeaningPopup(word, existing, el);
    }, true);
  }

  function showMeaningPopup(word, existingMeaning, anchorEl) {
    document.getElementById(MEANING_POPUP_ID)?.remove();

    const popup = document.createElement('div');
    popup.id = MEANING_POPUP_ID;

    Object.assign(popup.style, {
      position     : 'fixed',
      zIndex       : '2147483647',
      background   : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      border       : '1px solid rgba(253,224,71,0.35)',
      borderRadius : '12px',
      padding      : '14px 16px',
      boxShadow    : '0 8px 32px rgba(0,0,0,0.55)',
      fontFamily   : 'system-ui, sans-serif',
      color        : '#f1f5f9',
      width        : '280px',
      pointerEvents: 'auto',
    });

    popup.innerHTML = `
      <div style="font-size:11px;opacity:0.55;letter-spacing:0.07em;text-transform:uppercase;margin-bottom:10px;color:#94a3b8">
        ✏️ Nghĩa của "<strong style="color:#fde047">${word}</strong>"
      </div>
      <textarea id="vocab-meaning-input" placeholder="Nhập nghĩa của từ… (bỏ trống để xoá)" rows="3" style="
        width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);
        border-radius:8px;color:#f1f5f9;font-family:inherit;font-size:13px;
        padding:8px 10px;resize:none;outline:none;line-height:1.5;
        transition:border-color 0.15s ease;box-sizing:border-box;
      ">${existingMeaning}</textarea>
      <div style="font-size:11px;opacity:0.4;margin-top:5px;font-family:inherit">
        Ctrl+Enter để lưu · Esc để huỷ
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
        <button id="vocab-meaning-cancel" style="
          background:transparent;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;
          border-radius:7px;padding:6px 14px;font-size:12px;font-weight:600;
          cursor:pointer;font-family:inherit;transition:background 0.12s ease;
        ">Huỷ</button>
        <button id="vocab-meaning-submit" style="
          background:#fde047;color:#0f172a;border:none;
          border-radius:7px;padding:6px 14px;font-size:12px;font-weight:700;
          cursor:pointer;font-family:inherit;transition:background 0.12s ease;
        ">Lưu</button>
      </div>
    `;

    document.body.appendChild(popup);

    // Position below the anchor element
    const rect   = anchorEl.getBoundingClientRect();
    const popupW = 280;
    const x = Math.min(rect.left, window.innerWidth - popupW - 12);
    const y = Math.min(rect.bottom + 8, window.innerHeight - 185);
    popup.style.left = `${Math.max(8, x)}px`;
    popup.style.top  = `${y}px`;

    const textarea = popup.querySelector('#vocab-meaning-input');
    textarea.focus();
    textarea.select();

    textarea.addEventListener('focus', () => {
      textarea.style.borderColor = 'rgba(253,224,71,0.5)';
    });
    textarea.addEventListener('blur', () => {
      textarea.style.borderColor = 'rgba(255,255,255,0.15)';
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); submitMeaning(); }
      if (e.key === 'Escape') popup.remove();
    });

    async function submitMeaning() {
      const value    = textarea.value.trim();
      const stored   = await chrome.storage.sync.get(MEANINGS_KEY);
      const meanings = stored[MEANINGS_KEY] || {};

      if (value) {
        meanings[word] = value;
      } else {
        delete meanings[word];
      }

      await chrome.storage.sync.set({ [MEANINGS_KEY]: meanings });
      popup.remove();

      showSaveBanner(
        value ? `Đã lưu nghĩa: "${word}"` : `Đã xoá nghĩa của "${word}"`,
        false,
        !value
      );
    }

    const submitBtn = popup.querySelector('#vocab-meaning-submit');
    const cancelBtn = popup.querySelector('#vocab-meaning-cancel');

    submitBtn.addEventListener('click', submitMeaning);
    submitBtn.addEventListener('mouseover', function() { this.style.background = '#fbbf24'; });
    submitBtn.addEventListener('mouseout',  function() { this.style.background = '#fde047'; });

    cancelBtn.addEventListener('click', () => popup.remove());
    cancelBtn.addEventListener('mouseover', function() { this.style.background = 'rgba(255,255,255,0.08)'; });
    cancelBtn.addEventListener('mouseout',  function() { this.style.background = 'transparent'; });

    // Click outside → close
    setTimeout(() => {
      document.addEventListener('mousedown', function handler(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener('mousedown', handler);
        }
      });
    }, 0);
  }

  // ─── MutationObserver ─────────────────────────────────────────────────────────

  function setupMutationObserver() {
    let debounceTimer = null;
    const pendingNodes = new Set();

    mutationObserver = new MutationObserver((mutations) => {
      if (isHighlighting) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) pendingNodes.add(node);
        }
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        for (const node of pendingNodes) highlightSubtree(node);
        pendingNodes.clear();
      }, 200);
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Banner ───────────────────────────────────────────────────────────────────

  function showSaveBanner(word, duplicate = false, removed = false) {
    const BANNER_ID = 'vocab-hl-banner';
    document.getElementById(BANNER_ID)?.remove();

    const banner = document.createElement('div');
    banner.id = BANNER_ID;

    if (removed) {
      banner.innerHTML = `🗑 Removed: <strong>"${word}"</strong>`;
    } else if (duplicate) {
      banner.innerHTML = `ℹ️ Already saved: <strong>"${word}"</strong>`;
    } else {
      banner.innerHTML = `✅ Saved: <strong>"${word}"</strong>`;
    }

    const bgColor = removed ? '#7f1d1d' : duplicate ? '#1e3a5f' : '#065f46';

    Object.assign(banner.style, {
      position:     'fixed',
      top:          '16px',
      right:        '16px',
      zIndex:       '2147483647',
      background:   bgColor,
      color:        '#fff',
      padding:      '10px 18px',
      borderRadius: '10px',
      fontSize:     '13px',
      fontFamily:   'system-ui, sans-serif',
      boxShadow:    '0 4px 16px rgba(0,0,0,0.35)',
      transition:   'opacity 0.4s ease',
      opacity:      '1',
      pointerEvents:'none',
    });

    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = '0'; }, 2500);
    setTimeout(() => { banner.remove(); },            3000);
  }

  // ─── Message Listener ─────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'WORD_SAVED':
        showSaveBanner(message.word);
        break;
      case 'WORD_ALREADY_EXISTS':
        showSaveBanner(message.word, true);
        break;
      case 'VOCAB_UPDATED':
        vocabPattern = buildPattern(message.words || []);
        removeAllHighlights();
        if (vocabPattern) highlightSubtree();
        break;
      case 'SETTINGS_UPDATED':
        currentSettings = { ...currentSettings, ...message.settings };
        applyDynamicStyle(currentSettings);
        removeAllHighlights();
        if (currentSettings.enabled && vocabPattern) highlightSubtree();
        break;
    }
  });

  // ─── Storage Change ───────────────────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    if (changes[STORAGE_KEY]) {
      const words  = changes[STORAGE_KEY].newValue || [];
      vocabPattern = buildPattern(words);
      removeAllHighlights();
      if (currentSettings.enabled && vocabPattern) highlightSubtree();
    }

    if (changes[SETTINGS_KEY]) {
      currentSettings = { ...getDefaultSettings(), ...changes[SETTINGS_KEY].newValue };
      applyDynamicStyle(currentSettings);
      removeAllHighlights();
      if (currentSettings.enabled && vocabPattern) highlightSubtree();
    }
  });

  // ─── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    try {
      const result    = await chrome.storage.sync.get([STORAGE_KEY, SETTINGS_KEY]);
      const words     = result[STORAGE_KEY] || [];
      currentSettings = { ...getDefaultSettings(), ...result[SETTINGS_KEY] };

      vocabPattern = buildPattern(words);
      applyDynamicStyle(currentSettings);

      if (currentSettings.enabled && vocabPattern) highlightSubtree();

      setupMutationObserver();
      setupTooltip();
      setupSelectionButton();
      setupMeaningPopup();
    } catch (err) {
      console.warn('[VocabHighlighter] Init error:', err);
    }
  }

  init();

})();
