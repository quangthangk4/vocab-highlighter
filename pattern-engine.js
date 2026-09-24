/**
 * Reusable English Pattern Matching Engine.
 *
 * This file deliberately has no Chrome or DOM dependency.  It can run in a
 * content script, an extension page, or a Node test runner.  The matcher is a
 * deterministic, local-first layer: it validates the complete construction
 * around a head verb instead of treating a matching keyword as a hit.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VocabPatternEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const PLACEHOLDERS = {
    sb: 'PERSON', somebody: 'PERSON', someone: 'PERSON', person: 'PERSON',
    sth: 'THING', something: 'THING', thing: 'THING', object: 'THING',
    v: 'VERB_BASE',
    'v-ing': 'GERUND', ving: 'GERUND', gerund: 'GERUND',
    adj: 'ADJECTIVE', adjective: 'ADJECTIVE',
    adv: 'ADVERB', adverb: 'ADVERB',
    place: 'PLACE', location: 'PLACE',
    time: 'TIME',
  };

  const IRREGULAR_FORMS = {
    be: ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
    become: ['become', 'becomes', 'became', 'becoming'],
    teach: ['teach', 'teaches', 'teaching', 'taught'],
    sit: ['sit', 'sits', 'sitting', 'sat'],
    have: ['have', 'has', 'had', 'having'],
    do: ['do', 'does', 'did', 'doing', 'done'],
    go: ['go', 'goes', 'went', 'going', 'gone'],
    make: ['make', 'makes', 'made', 'making'],
    take: ['take', 'takes', 'took', 'taking', 'taken'],
    give: ['give', 'gives', 'gave', 'giving', 'given'],
    get: ['get', 'gets', 'got', 'getting', 'gotten'],
    find: ['find', 'finds', 'found', 'finding'],
    understand: ['understand', 'understands', 'understood', 'understanding'],
    sleep: ['sleep', 'sleeps', 'slept', 'sleeping'],
    ride: ['ride', 'rides', 'rode', 'riding', 'ridden'],
    swim: ['swim', 'swims', 'swam', 'swimming', 'swum'],
    run: ['run', 'runs', 'ran', 'running'],
    write: ['write', 'writes', 'wrote', 'writing', 'written'],
    read: ['read', 'reads', 'reading'],
    say: ['say', 'says', 'said', 'saying'],
    see: ['see', 'sees', 'saw', 'seeing', 'seen'],
    know: ['know', 'knows', 'knew', 'knowing', 'known'],
    come: ['come', 'comes', 'came', 'coming'],
    begin: ['begin', 'begins', 'began', 'beginning', 'begun'],
  };

  const PERSON_PRONOUNS = new Set([
    'me', 'him', 'her', 'us', 'them', 'someone', 'somebody', 'anyone',
    'anybody', 'everyone', 'everybody', 'who', 'whoever',
  ]);
  const POSSESSIVES = new Set(['my', 'your', 'his', 'her', 'our', 'their', 'whose']);
  const HUMAN_NOUNS = new Set([
    'person', 'people', 'man', 'woman', 'boy', 'girl', 'child', 'children',
    'son', 'daughter', 'father', 'mother', 'parent', 'brother', 'sister',
    'husband', 'wife', 'friend', 'student', 'teacher', 'pupil', 'baby',
    'customer', 'client', 'patient', 'employee', 'worker', 'reader', 'learner',
  ]);
  const FUNCTION_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'that', 'this', 'these',
    'those', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as',
    'to', 'how', 'who', 'which', 'when', 'where', 'why', 'not', 'no', 'yes',
    'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'may',
    'might', 'should', 'must', 'shall',
  ]);
  const TIME_WORDS = new Set([
    'today', 'tomorrow', 'yesterday', 'tonight', 'morning', 'afternoon',
    'evening', 'week', 'month', 'year', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday', 'sunday', 'now', 'later', 'soon',
  ]);

  function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function tokenize(text) {
    const tokens = [];
    const re = /[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:[.:/]\d+)*|[^\s]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      tokens.push({
        value: match[0],
        lower: match[0].toLowerCase(),
        start: match.index,
        end: match.index + match[0].length,
        isWord: /^[A-Za-z]/.test(match[0]),
      });
    }
    return tokens;
  }

  function regularForms(lemma) {
    const forms = new Set([lemma]);
    if (lemma.endsWith('y') && !/[aeiou]y$/.test(lemma)) {
      forms.add(`${lemma.slice(0, -1)}ies`);
      forms.add(`${lemma.slice(0, -1)}ied`);
    } else if (/(s|x|z|ch|sh|o)$/.test(lemma)) {
      forms.add(`${lemma}es`);
      forms.add(`${lemma}ed`);
    } else {
      forms.add(`${lemma}s`);
      forms.add(`${lemma}ed`);
    }

    if (lemma.endsWith('e') && !lemma.endsWith('ee')) {
      forms.add(`${lemma.slice(0, -1)}ing`);
    } else {
      forms.add(`${lemma}ing`);
    }
    // Common CVC doubling: plan → planning, stop → stopped.
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(lemma)) {
      const last = lemma.slice(-1);
      forms.add(`${lemma}${last}ing`);
      forms.add(`${lemma}${last}ed`);
    }
    return [...forms];
  }

  function verbForms(lemma) {
    return new Set(IRREGULAR_FORMS[lemma] || regularForms(lemma));
  }

  function matchesHead(token, head) {
    if (!token?.isWord) return false;
    if (head.type === 'STATE_VERB') {
      return verbForms('be').has(token.lower) || (head.allowBecome && verbForms('become').has(token.lower));
    }
    return verbForms(head.lemma).has(token.lower);
  }

  function tokenDescriptor(rawToken) {
    const lower = rawToken.toLowerCase();
    const placeholder = PLACEHOLDERS[lower];
    if (placeholder) return { type: 'PLACEHOLDER', slot: placeholder, raw: rawToken };
    return { type: 'LITERAL', value: lower, raw: rawToken };
  }

  function normalizePattern(rawPattern) {
    const raw = cleanText(rawPattern);
    if (!raw) return { ok: false, error: 'Enter a pattern first.' };
    if (raw.length > 160) return { ok: false, error: 'Patterns must be 160 characters or fewer.' };

    const sourceTokens = raw.match(/[A-Za-z]+(?:-[A-Za-z]+)?/g) || [];
    if (!sourceTokens.length) return { ok: false, error: 'Use English words and supported placeholders.' };

    const first = sourceTokens[0].toLowerCase();
    if (PLACEHOLDERS[first]) {
      return { ok: false, error: 'A pattern must start with a head verb, such as “teach” or “have”.' };
    }

    const isState = first === 'be';
    const ast = {
      version: VERSION,
      kind: isState ? 'state-construction' : 'verb-construction',
      rawPattern: raw,
      head: isState
        ? { type: 'STATE_VERB', lemma: 'be', allowBecome: true, inflection: 'copula-or-become' }
        : { type: 'VERB', lemma: first, inflection: 'any-form' },
      sequence: sourceTokens.slice(1).map(tokenDescriptor),
      placeholders: sourceTokens.slice(1)
        .map(tokenDescriptor)
        .filter(token => token.type === 'PLACEHOLDER')
        .map(token => token.slot),
    };

    return { ok: true, ast };
  }

  function isPunctuation(token) {
    return !token?.isWord && !/^\d/.test(token?.value || '');
  }

  function literalMatches(tokens, start, sequence) {
    for (let offset = 0; offset < sequence.length; offset += 1) {
      const expected = sequence[offset];
      const actual = tokens[start + offset];
      if (!actual || expected.type !== 'LITERAL' || actual.lower !== expected.value) return false;
    }
    return true;
  }

  function boundaryForSlot(tokens, start, remaining) {
    const firstLiteralAt = remaining.findIndex(item => item.type === 'LITERAL');
    if (firstLiteralAt === -1) return Math.min(start + 1, tokens.length);
    const literalRun = remaining.slice(firstLiteralAt)
      .filter(item => item.type === 'LITERAL');
    const max = Math.min(tokens.length, start + 8);

    for (let end = start + 1; end < max; end += 1) {
      if (literalMatches(tokens, end, literalRun)) return end;
    }
    return -1;
  }

  function scorePerson(tokens) {
    const words = tokens.filter(token => token.isWord);
    if (!words.length || tokens.some(isPunctuation)) return 0;
    const lowers = words.map(token => token.lower);
    if (lowers.some(word => PERSON_PRONOUNS.has(word))) return 1;
    if (lowers.some(word => HUMAN_NOUNS.has(word))) return lowers.some(word => POSSESSIVES.has(word)) ? 1 : 0.95;
    if (words.some(token => /^[A-Z]/.test(token.value))) return 0.9;
    // A noun phrase with no human cue is deliberately low confidence. This is
    // what prevents “teach English …” from being treated as a person slot.
    return 0.48;
  }

  function scoreThing(tokens) {
    return tokens.length && !tokens.some(isPunctuation) ? 0.9 : 0;
  }

  function scoreBaseVerb(token) {
    if (!token?.isWord || FUNCTION_WORDS.has(token.lower)) return 0;
    if (/ing$|ed$/.test(token.lower)) return 0.38;
    return 0.93;
  }

  function scoreGerund(token) {
    if (!token?.isWord || !/ing$/.test(token.lower)) return 0;
    if (['morning', 'evening', 'thing', 'ceiling', 'building'].includes(token.lower)) return 0.42;
    return 0.96;
  }

  function scoreAdjective(token) {
    if (!token?.isWord || FUNCTION_WORDS.has(token.lower)) return 0;
    return /(ed|ing|ful|less|ous|ive|able|al|ic|y)$/.test(token.lower) ? 0.83 : 0.64;
  }

  function scoreAdverb(token) {
    if (!token?.isWord || FUNCTION_WORDS.has(token.lower)) return 0;
    return /ly$/.test(token.lower) ? 0.94 : 0.58;
  }

  function scorePlace(tokens) {
    const words = tokens.filter(token => token.isWord).map(token => token.lower);
    if (!words.length) return 0;
    return words.some(word => ['home', 'school', 'office', 'table', 'room', 'park', 'city', 'country', 'here', 'there'].includes(word)) ? 0.9 : 0.58;
  }

  function scoreTime(tokens) {
    const words = tokens.filter(token => token.isWord).map(token => token.lower);
    if (!words.length) return 0;
    return words.some(word => TIME_WORDS.has(word) || /^\d+$/.test(word)) ? 0.9 : 0.58;
  }

  function matchSlot(slot, tokens, cursor, remaining) {
    const boundary = ['PERSON', 'THING', 'PLACE', 'TIME'].includes(slot)
      ? boundaryForSlot(tokens, cursor, remaining)
      : Math.min(cursor + 1, tokens.length);
    if (boundary <= cursor) return null;
    const matchedTokens = tokens.slice(cursor, boundary);
    let quality = 0;
    switch (slot) {
      case 'PERSON': quality = scorePerson(matchedTokens); break;
      case 'THING': quality = scoreThing(matchedTokens); break;
      case 'VERB_BASE': quality = scoreBaseVerb(matchedTokens[0]); break;
      case 'GERUND': quality = scoreGerund(matchedTokens[0]); break;
      case 'ADJECTIVE': quality = scoreAdjective(matchedTokens[0]); break;
      case 'ADVERB': quality = scoreAdverb(matchedTokens[0]); break;
      case 'PLACE': quality = scorePlace(matchedTokens); break;
      case 'TIME': quality = scoreTime(matchedTokens); break;
      default: quality = 0;
    }
    if (!quality) return null;
    return { end: boundary, quality, tokens: matchedTokens };
  }

  function matchAt(tokens, startIndex, ast, originalText) {
    const headToken = tokens[startIndex];
    if (!matchesHead(headToken, ast.head)) return null;

    let cursor = startIndex + 1;
    const scores = [ast.head.type === 'STATE_VERB' && verbForms('become').has(headToken.lower) ? 0.96 : 1];
    const breakdown = [{
      patternPart: ast.head.lemma,
      role: ast.head.type === 'STATE_VERB' ? 'state verb' : 'verb',
      matched: headToken.value,
      confidence: scores[0],
    }];

    for (let sequenceIndex = 0; sequenceIndex < ast.sequence.length; sequenceIndex += 1) {
      const expected = ast.sequence[sequenceIndex];
      if (expected.type === 'LITERAL') {
        const actual = tokens[cursor];
        if (!actual || actual.lower !== expected.value) return null;
        scores.push(1);
        breakdown.push({ patternPart: expected.raw, role: 'connector', matched: actual.value, confidence: 1 });
        cursor += 1;
        continue;
      }

      const slot = matchSlot(expected.slot, tokens, cursor, ast.sequence.slice(sequenceIndex + 1));
      if (!slot) return null;
      scores.push(slot.quality);
      breakdown.push({
        patternPart: expected.raw,
        role: expected.slot,
        matched: originalText.slice(slot.tokens[0].start, slot.tokens[slot.tokens.length - 1].end),
        confidence: slot.quality,
      });
      cursor = slot.end;
    }

    if (cursor <= startIndex + 1 && ast.sequence.length) return null;
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const weakest = Math.min(...scores);
    const confidence = Math.round((mean * 0.68 + weakest * 0.32) * 100) / 100;
    const endToken = tokens[cursor - 1];
    return {
      start: headToken.start,
      end: endToken.end,
      matchedText: originalText.slice(headToken.start, endToken.end),
      confidence,
      breakdown,
    };
  }

  function selectNonOverlapping(matches) {
    const selected = [];
    for (const match of [...matches].sort((a, b) => b.confidence - a.confidence || (b.end - b.start) - (a.end - a.start))) {
      if (!selected.some(chosen => match.start < chosen.end && match.end > chosen.start)) selected.push(match);
    }
    return selected.sort((a, b) => a.start - b.start);
  }

  function findMatches(text, patternNotes, options = {}) {
    const source = String(text || '');
    const tokens = tokenize(source);
    const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : 0.85;
    const candidates = [];

    for (const note of patternNotes || []) {
      const normalized = note?.normalizedPattern || note?.ast || note;
      if (!normalized?.head || !Array.isArray(normalized.sequence)) continue;
      for (let index = 0; index < tokens.length; index += 1) {
        const result = matchAt(tokens, index, normalized, source);
        if (!result) continue;
        candidates.push({
          ...result,
          patternId: note.id || normalized.id || '',
          pattern: note.rawPattern || normalized.rawPattern,
          note,
          shouldHighlight: result.confidence >= threshold,
        });
      }
    }

    const highlighted = selectNonOverlapping(candidates.filter(match => match.shouldHighlight));
    const fallbackCandidates = candidates.filter(match => !match.shouldHighlight);
    return { highlighted, fallbackCandidates };
  }

  function createPatternNote(rawPattern, fields = {}) {
    const result = normalizePattern(rawPattern);
    if (!result.ok) return result;
    const now = new Date().toISOString();
    return {
      ok: true,
      note: {
        id: fields.id || `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rawPattern: result.ast.rawPattern,
        normalizedPattern: result.ast,
        meaning: cleanText(fields.meaning || ''),
        status: fields.status || 'learning',
        examples: Array.isArray(fields.examples) ? fields.examples : [],
        createdAt: fields.createdAt || now,
        updatedAt: now,
      },
    };
  }

  function describeNormalizedPattern(ast) {
    if (!ast?.head) return '';
    const pieces = [`verb: ${ast.head.lemma}`];
    for (const token of ast.sequence || []) {
      pieces.push(token.type === 'LITERAL' ? `connector: ${token.value}` : `argument: ${token.slot}`);
    }
    return pieces.join(' · ');
  }

  return {
    VERSION,
    normalizePattern,
    createPatternNote,
    findMatches,
    tokenize,
    describeNormalizedPattern,
  };
});
