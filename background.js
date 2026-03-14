/**
 * background.js — Service Worker (Manifest V3)
 */

const STORAGE_KEY  = 'vocabWords';
const MENU_ITEM_ID = 'save-vocab-word';
const IPA_API      = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// ─── Context Menu ─────────────────────────────────────────────────────────────

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:       MENU_ITEM_ID,
      title:    '📖 Save "%s" to Vocabulary',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
createContextMenu();

// ─── Context Menu Click ────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ITEM_ID) return;
  const raw = info.selectionText;
  if (!raw) return;
  const word = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!word) return;
  await saveWord(word, tab);
});

// ─── Storage Helpers ──────────────────────────────────────────────────────────

async function getWords() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveWord(word, tab) {
  const words = await getWords();
  if (words.includes(word)) {
    if (tab) notifyTab(tab.id, { type: 'WORD_ALREADY_EXISTS', word });
    return false;
  }
  const updated = [...words, word];
  await chrome.storage.sync.set({ [STORAGE_KEY]: updated });
  if (tab) notifyTab(tab.id, { type: 'WORD_SAVED', word });
  broadcastToAllTabs(updated, tab?.id);
  return true;
}

// ─── Tab Messaging ─────────────────────────────────────────────────────────────

function notifyTab(tabId, message) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, message).catch(() => {});
}

async function broadcastToAllTabs(words, skipTabId) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === skipTabId) continue;
    if (!tab.url?.startsWith('http')) continue;
    chrome.tabs.sendMessage(tab.id, { type: 'VOCAB_UPDATED', words }).catch(() => {});
  }
}

// ─── IPA Fetch Proxy ──────────────────────────────────────────────────────────

const ipaCache = new Map();  // word → { us, uk }

function parsePhonetics(entry) {
  if (!entry) return { us: '', uk: '' };

  let us = '';
  let uk = '';
  const noAudio = [];

  for (const p of (entry.phonetics || [])) {
    const text  = p.text?.trim() || '';
    const audio = p.audio || '';
    if (!text) continue;
    if (audio.includes('-us'))      { if (!us) us = text; }
    else if (audio.includes('-uk')) { if (!uk) uk = text; }
    else                            { noAudio.push(text); }
  }

  for (const t of noAudio) {
    if (!us)    { us = t; continue; }
    if (!uk)    { uk = t; break;    }
  }

  const topLevel = entry.phonetic?.trim() || '';
  if (!us && !uk) { us = topLevel; }
  else if (!us)   { us = topLevel; }
  else if (!uk)   { uk = topLevel; }

  return { us, uk };
}

async function fetchIPAFromAPI(word) {
  if (ipaCache.has(word)) return ipaCache.get(word);

  try {
    const res = await fetch(`${IPA_API}${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data   = await res.json();
    const entry  = Array.isArray(data) ? data[0] : null;
    const result = parsePhonetics(entry);

    ipaCache.set(word, result);
    return result;
  } catch (err) {
    console.warn('[VocabHighlighter] IPA fetch failed for', word, '—', err.message);
    const empty = { us: '', uk: '' };
    ipaCache.set(word, empty);
    return empty;
  }
}

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'FETCH_IPA') {
    fetchIPAFromAPI(message.word)
      .then(result => sendResponse({ us: result.us, uk: result.uk }))
      .catch(()    => sendResponse({ us: '', uk: '' }));
    return true;
  }

  if (message.type === 'SAVE_WORD_FROM_CONTENT') {
    const tab = sender.tab;
    saveWord(message.word, tab)
      .then(saved => sendResponse({ saved }))
      .catch(()   => sendResponse({ saved: false }));
    return true;
  }
});
