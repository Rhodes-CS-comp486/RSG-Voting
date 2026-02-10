/**
 * Assertion-based test suite for BordaCountMethod
 * Run with: node test-borda-cases.js
 */

const assert = require('assert');
const BordaCountMethod = require('./src/voting/BordaCountMethod');

const borda = new BordaCountMethod();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// ─── Score Calculation ───────────────────────────────────────────────────────

console.log('\nScore Calculation');

test('1st place gets n-1 points, 2nd gets n-2, last gets 0', () => {
  // 3 candidates → 1st=2, 2nd=1, 3rd=0
  const result = borda.tabulate(['A', 'B', 'C'], [['A', 'B', 'C']]);
  assert.strictEqual(result.results['A'], 2);
  assert.strictEqual(result.results['B'], 1);
  assert.strictEqual(result.results['C'], 0);
});

test('scores accumulate correctly across multiple ballots', () => {
  // A wins: 2+1+0=3 | B wins: 1+2+1=4 | C: 0+0+2=2
  const result = borda.tabulate(
    ['A', 'B', 'C'],
    [
      ['A', 'B', 'C'],
      ['B', 'A', 'C'],
      ['C', 'B', 'A'],
    ]
  );
  assert.strictEqual(result.results['A'], 3);
  assert.strictEqual(result.results['B'], 4);
  assert.strictEqual(result.results['C'], 2);
  assert.deepStrictEqual(result.winners, ['B']);
});

test('Borda winner can differ from plurality winner', () => {
  // A has the most first-choice votes (4), but B wins on total Borda score
  // 4x ['A','B','C'] → A+=8, B+=4, C+=0
  // 3x ['B','C','A'] → B+=6, C+=3, A+=0
  // 2x ['C','B','A'] → C+=4, B+=2, A+=0
  // Totals: A=8, B=12, C=7  →  B wins despite A leading in first-choice votes
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'B', 'A']),
  ];
  const result = borda.tabulate(candidates, ballots);
  assert.strictEqual(result.results['A'], 8);
  assert.strictEqual(result.results['B'], 12);
  assert.strictEqual(result.results['C'], 7);
  assert.deepStrictEqual(result.winners, ['B']);
});

test('unranked candidates receive 0 points from a partial ballot', () => {
  // Ballot only ranks A and B; C and D should stay at 0
  const result = borda.tabulate(['A', 'B', 'C', 'D'], [['A', 'B']]);
  assert.strictEqual(result.results['C'], 0);
  assert.strictEqual(result.results['D'], 0);
});

test('partial ballot awards points based on total candidate count', () => {
  // 4 candidates → 1st=3, 2nd=2, 3rd=1, 4th=0
  // Ballot ['A','B'] means A gets 3 pts and B gets 2 pts (not 1 pt as if n=2)
  const result = borda.tabulate(['A', 'B', 'C', 'D'], [['A', 'B']]);
  assert.strictEqual(result.results['A'], 3);
  assert.strictEqual(result.results['B'], 2);
});

test('candidate always ranked last in full ballots scores 0', () => {
  const ballots = [
    ['A', 'B', 'Loser'],
    ['B', 'A', 'Loser'],
    ['A', 'B', 'Loser'],
  ];
  const result = borda.tabulate(['A', 'B', 'Loser'], ballots);
  assert.strictEqual(result.results['Loser'], 0);
});

// ─── Single-Winner ────────────────────────────────────────────────────────────

console.log('\nSingle-Winner');

test('clear winner with unanimous first-choice votes', () => {
  const ballots = Array(5).fill(['Alice', 'Bob', 'Charlie']);
  const result = borda.tabulate(['Alice', 'Bob', 'Charlie'], ballots);
  assert.deepStrictEqual(result.winners, ['Alice']);
  assert.strictEqual(result.isTieBreak, false);
  assert.strictEqual(result.results['Alice'], 10); // 5 * 2
});

test('two-way tie sets isTieBreak true and returns both candidates', () => {
  // ['A','B'] and ['B','A'] → A=1, B=1
  const result = borda.tabulate(['A', 'B'], [['A', 'B'], ['B', 'A']]);
  assert.strictEqual(result.isTieBreak, true);
  assert.strictEqual(result.winners.length, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
});

test('three-way tie from cyclical rankings', () => {
  // ['A','B','C'], ['B','C','A'], ['C','A','B'] → each candidate: 2+0+1=3
  const result = borda.tabulate(
    ['A', 'B', 'C'],
    [['A', 'B', 'C'], ['B', 'C', 'A'], ['C', 'A', 'B']]
  );
  assert.strictEqual(result.isTieBreak, true);
  assert.strictEqual(result.winners.length, 3);
});

test('single candidate wins with 0 points', () => {
  const result = borda.tabulate(['Solo'], [['Solo'], ['Solo']]);
  assert.deepStrictEqual(result.winners, ['Solo']);
  assert.strictEqual(result.results['Solo'], 0);
  assert.strictEqual(result.isTieBreak, false);
});

test('two-candidate election correct winner', () => {
  // 3 ballots: ['A','B'], ['A','B'], ['B','A']  →  A=2, B=1
  const result = borda.tabulate(
    ['A', 'B'],
    [['A', 'B'], ['A', 'B'], ['B', 'A']]
  );
  assert.deepStrictEqual(result.winners, ['A']);
  assert.strictEqual(result.isTieBreak, false);
});

test('all-identical ballots → winner same as unanimous first choice', () => {
  const ballots = Array(4).fill(['X', 'Y', 'Z']);
  const result = borda.tabulate(['X', 'Y', 'Z'], ballots);
  assert.deepStrictEqual(result.winners, ['X']);
  assert.strictEqual(result.results['X'], 8);  // 4 * 2
  assert.strictEqual(result.results['Y'], 4);  // 4 * 1
  assert.strictEqual(result.results['Z'], 0);  // 4 * 0
});

// ─── Multi-Winner ─────────────────────────────────────────────────────────────

console.log('\nMulti-Winner');

test('top-2 candidates elected when seats=2', () => {
  // A=8, B=7, C=2, D=1 → elected: A, B
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = [
    ['A', 'B', 'C', 'D'],
    ['A', 'B', 'D', 'C'],
    ['B', 'A', 'C', 'D'],
  ];
  const result = borda.tabulate(candidates, ballots, 2);
  assert.strictEqual(result.elected.length, 2);
  assert.ok(result.elected.includes('A'));
  assert.ok(result.elected.includes('B'));
  assert.ok(!result.elected.includes('C'));
  assert.ok(!result.elected.includes('D'));
});

test('top-3 candidates elected when seats=3', () => {
  const candidates = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  // Alpha consistently first, Beta second, Gamma third
  const ballots = Array(5).fill(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
  const result = borda.tabulate(candidates, ballots, 3);
  assert.strictEqual(result.elected.length, 3);
  assert.ok(result.elected.includes('Alpha'));
  assert.ok(result.elected.includes('Beta'));
  assert.ok(result.elected.includes('Gamma'));
  assert.ok(!result.elected.includes('Delta'));
  assert.ok(!result.elected.includes('Epsilon'));
});

test('when seats >= candidates, all candidates are elected', () => {
  const candidates = ['A', 'B'];
  const ballots = [['A', 'B']];
  const result = borda.tabulate(candidates, ballots, 5);
  assert.strictEqual(result.elected.length, 2);
  assert.strictEqual(result.seatsElected, 2);
});

test('rounds array length equals seats filled', () => {
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = Array(4).fill(['A', 'B', 'C', 'D']);
  const result = borda.tabulate(candidates, ballots, 3);
  assert.strictEqual(result.rounds.length, 3);
});

test('each round records the elected candidate and their score', () => {
  const candidates = ['A', 'B', 'C'];
  const ballots = Array(3).fill(['A', 'B', 'C']);
  const result = borda.tabulate(candidates, ballots, 2);
  for (const round of result.rounds) {
    assert.ok(Array.isArray(round.elected));
    assert.ok(typeof round.score === 'number');
    assert.ok(typeof round.roundNumber === 'number');
  }
});

test('multi-winner results include scores map', () => {
  const candidates = ['A', 'B', 'C'];
  const ballots = [['A', 'B', 'C']];
  const result = borda.tabulate(candidates, ballots, 2);
  assert.ok(typeof result.scores === 'object');
  for (const c of candidates) {
    assert.ok(c in result.scores, `scores missing key "${c}"`);
  }
});

// ─── Validation ──────────────────────────────────────────────────────────────

console.log('\nValidation');

test('empty candidates list is invalid', () => {
  const { valid, errors } = borda.validate([], [['A']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.length > 0);
});

test('null candidates is invalid', () => {
  const { valid } = borda.validate(null, [['A']]);
  assert.strictEqual(valid, false);
});

test('empty ballots list is invalid', () => {
  const { valid, errors } = borda.validate(['A', 'B'], []);
  assert.strictEqual(valid, false);
  assert.ok(errors.length > 0);
});

test('null ballots is invalid', () => {
  const { valid } = borda.validate(['A', 'B'], null);
  assert.strictEqual(valid, false);
});

test('ballot with unknown candidate reports an error', () => {
  const { valid, errors } = borda.validate(['A', 'B'], [['A', 'X']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.includes('"X"')));
});

test('ballot with duplicate candidate reports an error', () => {
  const { valid, errors } = borda.validate(['A', 'B'], [['A', 'A']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.toLowerCase().includes('duplicate')));
});

test('empty ballot entry ([] array) reports an error', () => {
  const { valid, errors } = borda.validate(['A', 'B'], [[]]);
  assert.strictEqual(valid, false);
  assert.ok(errors.length > 0);
});

test('valid candidates and ballots pass validation', () => {
  const { valid, errors } = borda.validate(
    ['A', 'B', 'C'],
    [['A', 'B', 'C'], ['C', 'A', 'B']]
  );
  assert.strictEqual(valid, true);
  assert.strictEqual(errors.length, 0);
});

test('partial rankings pass validation (ranking subset is allowed)', () => {
  const { valid } = borda.validate(['A', 'B', 'C'], [['A'], ['B', 'A']]);
  assert.strictEqual(valid, true);
});

// ─── Return Shape ────────────────────────────────────────────────────────────

console.log('\nReturn Shape');

test('single-winner result contains all expected fields', () => {
  const result = borda.tabulate(['A', 'B'], [['A', 'B']]);
  for (const field of ['method', 'winners', 'elected', 'isTieBreak', 'results', 'ballotCount', 'candidateCount', 'timestamp']) {
    assert.ok(field in result, `missing field: ${field}`);
  }
});

test('multi-winner result contains all expected fields', () => {
  const result = borda.tabulate(['A', 'B', 'C'], [['A', 'B', 'C']], 2);
  for (const field of ['method', 'elected', 'winners', 'rounds', 'scores', 'ballotCount', 'candidateCount', 'seatsToFill', 'seatsElected']) {
    assert.ok(field in result, `missing field: ${field}`);
  }
});

test('method field is "borda"', () => {
  const single = borda.tabulate(['A', 'B'], [['A', 'B']]);
  const multi = borda.tabulate(['A', 'B', 'C'], [['A', 'B', 'C']], 2);
  assert.strictEqual(single.method, 'borda');
  assert.strictEqual(multi.method, 'borda');
});

test('ballotCount matches number of ballots submitted', () => {
  const ballots = [['A', 'B'], ['B', 'A'], ['A', 'B']];
  const result = borda.tabulate(['A', 'B'], ballots);
  assert.strictEqual(result.ballotCount, 3);
});

test('candidateCount matches number of candidates', () => {
  const result = borda.tabulate(['A', 'B', 'C', 'D'], [['A', 'B', 'C', 'D']]);
  assert.strictEqual(result.candidateCount, 4);
});

test('seatsToFill and seatsElected are set correctly on multi-winner', () => {
  const result = borda.tabulate(['A', 'B', 'C'], [['A', 'B', 'C']], 2);
  assert.strictEqual(result.seatsToFill, 2);
  assert.strictEqual(result.seatsElected, 2);
});

test('timestamp is a valid ISO 8601 string', () => {
  const result = borda.tabulate(['A', 'B'], [['A', 'B']]);
  assert.ok(!isNaN(Date.parse(result.timestamp)));
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
