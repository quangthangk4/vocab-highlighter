const assert = require('node:assert/strict');
const engine = require('../pattern-engine.js');

function matches(pattern, text, threshold = 0.85) {
  const created = engine.createPatternNote(pattern);
  assert.equal(created.ok, true, `Pattern should normalize: ${pattern}`);
  return engine.findMatches(text, [created.note], { threshold }).highlighted;
}

function matchedText(pattern, text) {
  return matches(pattern, text).map(match => match.matchedText);
}

// Normalization is structured data, not a raw-string-only record.
{
  const result = engine.normalizePattern('teach sb how to V');
  assert.equal(result.ok, true);
  assert.deepEqual(result.ast.head, { type: 'VERB', lemma: 'teach', inflection: 'any-form' });
  assert.deepEqual(result.ast.placeholders, ['PERSON', 'VERB_BASE']);
}

// Chat-friendly JSON supports the exact { pattern, meaning, example } shape.
{
  const imported = engine.createPatternNotesFromJson(`{
    "pattern": "turn in the direction of sth",
    "meaning": "quay về hướng của cái gì",
    "example": "Turning in the direction of the thundering noise."
  }`);
  assert.equal(imported.ok, true);
  assert.equal(imported.notes.length, 1);
  assert.equal(imported.notes[0].rawPattern, 'turn in the direction of sth');
  assert.equal(imported.notes[0].meaning, 'quay về hướng của cái gì');
  assert.equal(imported.notes[0].examples[0].text, 'Turning in the direction of the thundering noise.');
}

{
  const imported = engine.createPatternNotesFromJson('```json\n[&#x20;{"pattern":"raise sth","example":"They raised their heads."}\n]\n```');
  assert.equal(imported.ok, true);
  assert.equal(imported.notes[0].rawPattern, 'raise sth');
}

for (const [text, expected] of [
  ['I teach him how to swim.', 'teach him how to swim'],
  ['She teaches her how to cook.', 'teaches her how to cook'],
  ['The father taught his son how to fish.', 'taught his son how to fish'],
  ['They are teaching my daughter how to ride.', 'teaching my daughter how to ride'],
  ['He was teaching his son how to fish.', 'teaching his son how to fish'],
]) {
  assert.deepEqual(matchedText('teach sb how to V', text), [expected]);
}

for (const [text, expected] of [
  ['They sit at the table.', 'sit at the table'],
  ['She sits at the table.', 'sits at the table'],
  ['He sat at the table.', 'sat at the table'],
  ['The woman is sitting at the table.', 'sitting at the table'],
  ['The woman was sitting at the table.', 'sitting at the table'],
]) {
  assert.deepEqual(matchedText('sit at the table', text), [expected]);
}

for (const text of [
  'She is interested in learning.',
  'They were interested in playing.',
  'He became interested in learning.',
]) {
  assert.equal(matches('be interested in V-ing', text).length, 1);
}

for (const text of [
  'I have difficulty understanding.',
  'She has difficulty understanding.',
  'They had difficulty finding.',
  'He is having difficulty sleeping.',
]) {
  assert.equal(matches('have difficulty V-ing', text).length, 1);
}

// A head word alone is never enough for a structure match.
assert.equal(matches('teach sb how to V', 'I teach English at school.').length, 0);
assert.equal(matches('teach sb how to V', 'They are teaching the table how to move.').length, 0);

// A terminal `sth` slot includes its complete noun phrase, then stops before
// punctuation or the next preposition rather than stopping after an article.
assert.deepEqual(
  matchedText(
    'turn in the direction of sth',
    'Turning in the direction of the thundering noise, many slaves raised their heads.'
  ),
  ['Turning in the direction of the thundering noise']
);
assert.deepEqual(
  matchedText('turn in the direction of sth', 'They turned in the direction of the noise from outside.'),
  ['turned in the direction of the noise']
);

// Multiple saved patterns can be highlighted in one sentence.
{
  const notes = [
    engine.createPatternNote('teach sb how to V').note,
    engine.createPatternNote('sit at the table').note,
  ];
  const result = engine.findMatches(
    'The father is teaching his son how to fish while sitting at the table.',
    notes,
    { threshold: 0.85 }
  );
  assert.deepEqual(result.highlighted.map(match => match.matchedText), [
    'teaching his son how to fish',
    'sitting at the table',
  ]);
}

console.log('pattern-engine tests passed');
