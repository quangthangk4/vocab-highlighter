const assert = require('node:assert/strict');
const engine = require('../pattern-engine.js');

const cases = [
  ['turn in the direction of sth', 'Turning in the direction of the thundering noise, many slaves raised their heads.'],
  ['raise sth', 'Many slaves raised their heads.'],
  ['lurch away from sth', 'They instantly panicked, lurching away from the falling rocks.'],
  ['fall to the ground', 'Those slaves fell to the ground.'],
  ['take a step back', 'He took one measured step back.'],
  ['hit the ground', 'A piece of ice hit the ground right in front of him.'],
  ['shower sth with sth', 'The explosion showered everything around with sharp shards.'],
  ['get to the wall', 'Get to the wall!'],
  ['try to V', 'The soldier was trying to get the slaves to move.'],
  ['get sb to V', 'The soldier tried to get the slaves to move.'],
  ['move towards sth', 'The slaves moved towards the mountain slope.'],
  ['come crashing down', 'Something massive came crashing down.'],
  ['send a tremor through sth', 'The impact sent a tremor through the stones.'],
  ['fall between sth and sth', 'It fell right between the caravan and the mountain wall.'],
  ['turn out to be sth', 'The thing that looked like dirty snow turned out to be its fur.'],
  ['look like sth', 'At first, it looked like a lump of dirty snow.'],
  ['rise above sth', 'The creature rose above the stone platform.'],
  ['regard sb with sth', 'Five white eyes regarded the slaves with indifference.'],
  ['run down sth', "Viscous drool was running down the creature's chin."],
  ['feel sth under sth', "He felt something wriggling under the dead man's skin."],
  ["move in sb's direction", 'The creature moved in his direction.'],
  ['jump sideways', 'He jumped sideways as far as the chain allowed.'],
  ['place sb between sth and sth', 'He placed the broad-shouldered slave between himself and the monster.'],
  ["save sb's life", 'His quick reaction saved his life.'],
  ['hit the ground', 'Drenched in the hot liquid, Sunny hit the ground.'],
  ['try to V', 'He tried to roll the corpse to the side.'],
  ['be able to V', 'He was able to control his hands again.'],
  ['push sth with sth', 'Sunny pushed the corpse with his legs.'],
  ['set sb free', 'The corpse finally fell sideways, setting Sunny free.'],
  ['move away from sth', 'Move away from it!'],
];

let passed = 0;
for (const [pattern, text] of cases) {
  const note = engine.createPatternNote(pattern).note;
  const matches = engine.findMatches(text, [note], { threshold: 0.85 }).highlighted;
  if (matches.length) passed += 1;
  console.log(`${matches.length ? 'PASS' : 'FAIL'} | ${pattern} | ${matches.map(match => match.matchedText).join(' / ') || 'no match'}`);
}

console.log(`\n${passed}/${cases.length} example sentences matched at the default 85% threshold.`);
assert.equal(passed, cases.length, 'Every supplied example should match its pattern.');
