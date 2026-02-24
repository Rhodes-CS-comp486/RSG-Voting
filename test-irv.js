/**
 * Assertion-based test suite for IRVMethod (single-winner IRV + multi-winner STV)
 * Run with: node test-irv.js
 */

const assert = require('assert');
const IRVMethod = require('./src/voting/IRVMethod');

const irv = new IRVMethod();

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

// ─── Single-Winner: Majority ──────────────────────────────────────────────────

console.log('\nSingle-Winner: Majority');

test('candidate with first-round majority wins immediately', () => {
  // 6x [A,B,C], 3x [B,C,A], 1x [C,A,B]
  // Round 1: A=6, B=3, C=1, total=10, threshold=6 → A wins round 1
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(6).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(1).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  assert.deepStrictEqual(result.winners, ['A']);
  assert.strictEqual(result.rounds.length, 1);
  assert.deepStrictEqual(result.rounds[0].elected, ['A']);
});

test('threshold is floor(totalActive/2)+1', () => {
  // 10 active ballots → threshold = 6
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(6).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ['C', 'A', 'B'],
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  assert.strictEqual(result.rounds[0].threshold, 6);
});

test('unanimous first choice wins in round 1', () => {
  const ballots = Array(7).fill(['Alice', 'Bob', 'Charlie']);
  const result = irv.tabulate(['Alice', 'Bob', 'Charlie'], ballots, 1);
  assert.deepStrictEqual(result.winners, ['Alice']);
  assert.strictEqual(result.rounds.length, 1);
});

test('two-candidate race: winner is whoever has more first-choice votes', () => {
  // 3x [A,B], 2x [B,A] → A=3, total=5, threshold=3 → A wins round 1
  const result = irv.tabulate(
    ['A', 'B'],
    [...Array(3).fill(['A', 'B']), ...Array(2).fill(['B', 'A'])],
    1
  );
  assert.deepStrictEqual(result.winners, ['A']);
});

// ─── Single-Winner: Elimination Rounds ───────────────────────────────────────

console.log('\nSingle-Winner: Elimination Rounds');

test('last-place candidate is eliminated each round', () => {
  // 5x [A,B,C], 3x [B,C,A], 2x [C,A,B]
  // Round 1: A=5, B=3, C=2 → eliminate C
  // Round 2: A=7, B=3, threshold=6 → A wins
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(5).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  assert.deepStrictEqual(result.rounds[0].eliminated, ['C']);
  assert.deepStrictEqual(result.winners, ['A']);
});

test('eliminated candidate votes transfer to next active preference', () => {
  // After C is eliminated, [C,A,B] ballots transfer to A
  // Round 2: A=5+2=7, B=3 → A wins
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(5).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  const round2 = result.rounds[1];
  assert.strictEqual(round2.tallies['A'], 7);
  assert.strictEqual(round2.tallies['B'], 3);
});

test('three-round elimination resolves correctly', () => {
  // 4 candidates, needs two rounds of elimination
  // 4x [A,B,C,D], 3x [B,C,A,D], 2x [C,A,B,D], 1x [D,A,B,C]
  // Round 1: A=4, B=3, C=2, D=1 → eliminate D
  // Round 2: A=4+1=5, B=3, C=2 → threshold = floor(10/2)+1=6, no majority, eliminate C
  // Round 3: A=5+2=7, B=3 → threshold=6, A wins
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C', 'D']),
    ...Array(3).fill(['B', 'C', 'A', 'D']),
    ...Array(2).fill(['C', 'A', 'B', 'D']),
    ...Array(1).fill(['D', 'A', 'B', 'C']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  assert.deepStrictEqual(result.winners, ['A']);
  assert.strictEqual(result.rounds.length, 3);
  assert.deepStrictEqual(result.rounds[0].eliminated, ['D']);
  assert.deepStrictEqual(result.rounds[1].eliminated, ['C']);
  assert.deepStrictEqual(result.rounds[2].elected, ['A']);
});

test('plurality loser (IRV winner) differs from plurality winner', () => {
  // Classic IRV example: Condorcet winner beats plurality leader
  // 3x [A,B,C], 2x [B,A,C], 2x [C,B,A]
  // Round 1: A=3, B=2, C=2 → B and C tie at 2; eliminate B and C
  // Actually let me use a cleaner example:
  // 4x [A,B,C], 3x [B,C,A], 2x [C,B,A]
  // Round 1: A=4, B=3, C=2 → eliminate C
  // Round 2: A=4, B=3+2=5 → total=9, threshold=5 → B wins (not A who led in round 1)
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'B', 'A']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  // B wins despite A having more first-choice votes
  assert.deepStrictEqual(result.winners, ['B']);
  assert.strictEqual(result.rounds[1].tallies['B'], 5);
});

// ─── Single-Winner: Exhausted Ballots ────────────────────────────────────────

console.log('\nSingle-Winner: Exhausted Ballots');

test('ballot exhausts when voter ranks no remaining active candidate', () => {
  // Voter only ranked A; A is eliminated → ballot exhausts
  // 2x [A,B], 2x [B,A], 1x [A] — after A eliminated, the [A] ballot exhausts
  // Round 1: A=3, B=2 → threshold = floor(5/2)+1=3 → A wins immediately, so let's restructure
  // Use: 1x [A], 3x [B,A], 2x [C,B,A]
  // Round 1: A=1, B=3, C=2 → eliminate A
  // [A] ballot has no remaining active candidate → exhausts
  // Round 2: B=3, C=2 → total=5, threshold=3 → B wins
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ['A'],
    ...Array(3).fill(['B', 'A', 'C']),
    ...Array(2).fill(['C', 'B', 'A']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  assert.deepStrictEqual(result.winners, ['B']);
  assert.strictEqual(result.exhaustedBallots, 1);
});

test('exhaustedBallots is 0 when all ballots rank all candidates', () => {
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(5).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 1);
  assert.strictEqual(result.exhaustedBallots, 0);
});

// ─── Single-Winner: Ties ──────────────────────────────────────────────────────

console.log('\nSingle-Winner: Ties');

test('complete tie returns isTie=true and no winner', () => {
  // [A,B] and [B,A] — each gets 1, threshold=2, tie
  const result = irv.tabulate(['A', 'B'], [['A', 'B'], ['B', 'A']], 1);
  assert.strictEqual(result.isTie, true);
  assert.strictEqual(result.winners.length, 0);
});

test('three-way tie from cyclical preferences returns isTie=true', () => {
  // 2x [A,B,C], 2x [B,C,A], 2x [C,A,B] → each gets 2, complete tie
  const result = irv.tabulate(
    ['A', 'B', 'C'],
    [...Array(2).fill(['A', 'B', 'C']), ...Array(2).fill(['B', 'C', 'A']), ...Array(2).fill(['C', 'A', 'B'])],
    1
  );
  assert.strictEqual(result.isTie, true);
});

test('isTie is false when there is a clear winner', () => {
  const result = irv.tabulate(
    ['A', 'B'],
    [...Array(3).fill(['A', 'B']), ...Array(2).fill(['B', 'A'])],
    1
  );
  assert.strictEqual(result.isTie, false);
});

// ─── Single-Winner: Result Shape ─────────────────────────────────────────────

console.log('\nSingle-Winner: Result Shape');

test('result contains all expected fields', () => {
  const result = irv.tabulate(['A', 'B', 'C'], [['A', 'B', 'C'], ['B', 'A', 'C']]);
  for (const field of ['method', 'winners', 'seats', 'isTie', 'rounds', 'summary', 'totalBallots', 'totalCandidates', 'exhaustedBallots']) {
    assert.ok(field in result, `missing field: ${field}`);
  }
});

test('method field is "irv"', () => {
  const result = irv.tabulate(['A', 'B'], [['A', 'B'], ['A', 'B']]);
  assert.strictEqual(result.method, 'irv');
});

test('totalBallots matches submitted ballot count', () => {
  const ballots = [['A', 'B'], ['B', 'A'], ['A', 'B'], ['A', 'B']];
  const result = irv.tabulate(['A', 'B'], ballots);
  assert.strictEqual(result.totalBallots, 4);
});

test('totalCandidates matches submitted candidate count', () => {
  const result = irv.tabulate(['A', 'B', 'C', 'D'], [['A', 'B', 'C', 'D']]);
  assert.strictEqual(result.totalCandidates, 4);
});

test('each round has tallies, eliminated/elected, threshold, totalActiveBallots', () => {
  const result = irv.tabulate(
    ['A', 'B', 'C'],
    [...Array(5).fill(['A', 'B', 'C']), ...Array(3).fill(['B', 'C', 'A']), ...Array(2).fill(['C', 'A', 'B'])]
  );
  for (const round of result.rounds) {
    assert.ok(typeof round.roundNumber === 'number');
    assert.ok(typeof round.tallies === 'object');
    assert.ok(typeof round.totalActiveBallots === 'number');
    assert.ok(typeof round.threshold === 'number');
    assert.ok('eliminated' in round);
    assert.ok('elected' in round);
  }
});

test('winning round has elected set and eliminated null', () => {
  const result = irv.tabulate(
    ['A', 'B', 'C'],
    [...Array(6).fill(['A', 'B', 'C']), ...Array(3).fill(['B', 'C', 'A']), ['C', 'A', 'B']]
  );
  const winningRound = result.rounds[result.rounds.length - 1];
  assert.ok(Array.isArray(winningRound.elected));
  assert.strictEqual(winningRound.eliminated, null);
});

test('elimination rounds have eliminated set and elected null', () => {
  const result = irv.tabulate(
    ['A', 'B', 'C'],
    [...Array(5).fill(['A', 'B', 'C']), ...Array(3).fill(['B', 'C', 'A']), ...Array(2).fill(['C', 'A', 'B'])]
  );
  // Round 1 is an elimination round
  assert.ok(Array.isArray(result.rounds[0].eliminated));
  assert.strictEqual(result.rounds[0].elected, null);
});

// ─── Multi-Winner (STV): Droop Quota ─────────────────────────────────────────

console.log('\nMulti-Winner (STV): Droop Quota');

test('Droop quota: floor(totalVotes / (seats+1)) + 1', () => {
  // 9 ballots, 2 seats → quota = floor(9/3)+1 = 4
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 2);
  // First round threshold should be the Droop quota = 4
  assert.strictEqual(result.rounds[0].threshold, 4);
});

test('candidate meeting quota is immediately elected', () => {
  // 9 ballots, 2 seats, quota=4. A gets 4 → elected in round 1.
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 2);
  assert.ok(result.rounds[0].elected.includes('A'));
  assert.ok(result.winners.includes('A'));
});

test('2-seat STV: correct two winners elected', () => {
  // 9 ballots, 2 seats, quota=4
  // Round 1: A=4, B=3, C=2 → A meets quota, elected (no surplus)
  // Round 2 (A removed): B=3, C=2, seatsRemaining=1, new quota=floor(5/2)+1=3 → B meets quota
  // Winners: A, B
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = irv.tabulate(candidates, ballots, 2);
  assert.strictEqual(result.winners.length, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.ok(!result.winners.includes('C'));
  assert.strictEqual(result.isTie, false);
});

test('surplus transfer reduces ballot weight proportionally', () => {
  // 9 ballots, 2 seats, quota=4
  // A gets 6 votes → surplus=2, transfer factor=2/6=1/3
  // Those 6 ballots [A,B,C] transfer to B with weight 1/3 each → B gets +2
  // Remaining [B,C,A]x2 and [C,B,A]x1 contribute full weight
  // Round 2: B = 6*(1/3) + 2 = 4, C = 1 → B meets quota=3
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(6).fill(['A', 'B', 'C']),
    ...Array(2).fill(['B', 'C', 'A']),
    ...Array(1).fill(['C', 'B', 'A']),
  ];
  const result = irv.tabulate(candidates, ballots, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.strictEqual(result.winners.length, 2);
  // A's surplus (2 votes) should have transferred to B
  const round2 = result.rounds[1];
  // B should have approximately 4 votes (2 from surplus + 2 from own ballots)
  assert.ok(Math.round(round2.tallies['B']) === 4, `expected B≈4, got ${round2.tallies['B']}`);
});

test('STV: elimination used when no candidate meets quota', () => {
  // 14 ballots, 2 seats, quota=5
  // Round 1: A=5, B=4, C=3, D=2 → A elected (exactly quota, no surplus)
  // Round 2: {B,C,D}, seatsRemaining=1, quota=5 (total=9). B=4, C=3, D=2 → eliminate D
  // Round 3: {B,C}, total still 9. B=4+2=6? Actually D's [D,C,B,A] → C gets them.
  //   B=4, C=3+2=5 → C meets quota=5 → C elected
  // Winners: A, C
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = [
    ...Array(5).fill(['A', 'B', 'C', 'D']),
    ...Array(4).fill(['B', 'C', 'A', 'D']),
    ...Array(3).fill(['C', 'B', 'A', 'D']),
    ...Array(2).fill(['D', 'C', 'B', 'A']),
  ];
  const result = irv.tabulate(candidates, ballots, 2);
  assert.ok(result.winners.includes('A'), 'A should win');
  assert.ok(result.winners.includes('C'), 'C should win');
  assert.strictEqual(result.winners.length, 2);
});

test('remaining candidates auto-elected when count equals seats remaining', () => {
  // If only seatsRemaining candidates are left, they all win without further rounds
  // 2-seat election with 2 candidates: both should win immediately
  const result = irv.tabulate(
    ['A', 'B'],
    [['A', 'B'], ['B', 'A'], ['A', 'B']],
    2
  );
  assert.strictEqual(result.winners.length, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
});

test('STV result has winners, seats, isTie, rounds fields', () => {
  const result = irv.tabulate(
    ['A', 'B', 'C'],
    [...Array(4).fill(['A', 'B', 'C']), ...Array(3).fill(['B', 'C', 'A']), ...Array(2).fill(['C', 'A', 'B'])],
    2
  );
  assert.ok(Array.isArray(result.winners));
  assert.strictEqual(result.seats, 2);
  assert.ok(typeof result.isTie === 'boolean');
  assert.ok(Array.isArray(result.rounds));
});

// ─── Validation ───────────────────────────────────────────────────────────────

console.log('\nValidation');

test('empty candidates list is invalid', () => {
  const { valid } = irv.validate([], [['A']]);
  assert.strictEqual(valid, false);
});

test('null candidates is invalid', () => {
  const { valid } = irv.validate(null, [['A']]);
  assert.strictEqual(valid, false);
});

test('empty ballots list is invalid', () => {
  const { valid } = irv.validate(['A', 'B'], []);
  assert.strictEqual(valid, false);
});

test('null ballots is invalid', () => {
  const { valid } = irv.validate(['A', 'B'], null);
  assert.strictEqual(valid, false);
});

test('ballot with unknown candidate reports an error', () => {
  const { valid, errors } = irv.validate(['A', 'B'], [['A', 'X']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.includes('"X"')));
});

test('ballot with duplicate candidate reports an error', () => {
  const { valid, errors } = irv.validate(['A', 'B'], [['A', 'A']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.toLowerCase().includes('duplicate')));
});

test('empty ballot array entry reports an error', () => {
  const { valid } = irv.validate(['A', 'B'], [[]]);
  assert.strictEqual(valid, false);
});

test('valid full rankings pass validation', () => {
  const { valid, errors } = irv.validate(
    ['A', 'B', 'C'],
    [['A', 'B', 'C'], ['C', 'B', 'A']]
  );
  assert.strictEqual(valid, true);
  assert.strictEqual(errors.length, 0);
});

test('partial rankings pass validation', () => {
  const { valid } = irv.validate(['A', 'B', 'C'], [['A'], ['B', 'C']]);
  assert.strictEqual(valid, true);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
