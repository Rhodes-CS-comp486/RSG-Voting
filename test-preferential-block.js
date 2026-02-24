/**
 * Assertion-based test suite for PreferentialBlockMethod
 * Run with: node test-preferential-block.js
 */

const assert = require('assert');
const PreferentialBlockMethod = require('./src/voting/PreferentialBlockMethod');

const pbv = new PreferentialBlockMethod();

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

// ─── Single-Winner (IRV equivalence) ─────────────────────────────────────────

console.log('\nSingle-Winner (must be identical to IRV)');

test('clear majority in round 1 wins immediately', () => {
  // 5x [A,B,C], 3x [B,C,A], 2x [C,A,B]
  // Round 1: A=5, B=3, C=2 → eliminate C
  // Round 2: A=7, B=3, threshold=6 → A wins
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(5).fill(['A', 'B', 'C']),
    ...Array(3).fill(['B', 'C', 'A']),
    ...Array(2).fill(['C', 'A', 'B']),
  ];
  const result = pbv.tabulate(candidates, ballots, 1);
  assert.deepStrictEqual(result.winners, ['A']);
  assert.strictEqual(result.isTie, false);
});

test('last candidate standing wins after all eliminations', () => {
  // A, B, C — C eliminated first, then B, A last standing
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ['A', 'B', 'C'],
    ['A', 'B', 'C'],
    ['B', 'A', 'C'],
    ['C', 'B', 'A'],
  ];
  const result = pbv.tabulate(candidates, ballots, 1);
  assert.deepStrictEqual(result.winners, ['A']);
});

test('unanimous first choice wins in round 1', () => {
  const ballots = Array(6).fill(['Alice', 'Bob', 'Charlie']);
  const result = pbv.tabulate(['Alice', 'Bob', 'Charlie'], ballots, 1);
  assert.deepStrictEqual(result.winners, ['Alice']);
  assert.strictEqual(result.rounds.length, 1);
});

test('complete tie returns isTie=true and empty winners', () => {
  // ['A','B'] and ['B','A'] — each gets 1, no majority, tie
  const result = pbv.tabulate(['A', 'B'], [['A', 'B'], ['B', 'A']], 1);
  assert.strictEqual(result.isTie, true);
  assert.strictEqual(result.winners.length, 0);
});

test('result method field is "preferential-block"', () => {
  const result = pbv.tabulate(['A', 'B'], [['A', 'B'], ['A', 'B']], 1);
  assert.strictEqual(result.method, 'preferential-block');
});

// ─── Multi-Winner: 2 Seats ────────────────────────────────────────────────────

console.log('\nMulti-Winner: 2 Seats');

test('2-seat election: correct two winners elected via elimination', () => {
  // Round 1 tallies (top 2 per ballot):
  //   3x [A,B,C,D] → A+=3, B+=3
  //   2x [B,C,A,D] → B+=2, C+=2
  //   2x [C,D,A,B] → C+=2, D+=2
  //   1x [D,A,B,C] → D+=1, A+=1
  // Totals: A=4, B=5, C=4, D=3 → eliminate D
  //
  // Round 2 (D out, slide-up):
  //   3x [A,B,C,D] → top2 active [A,B] → A+=3, B+=3
  //   2x [B,C,A,D] → top2 active [B,C] → B+=2, C+=2
  //   2x [C,D,A,B] → top2 active [C,A] → C+=2, A+=2   ← D slid out
  //   1x [D,A,B,C] → top2 active [A,B] → A+=1, B+=1   ← D slid out
  // Totals: A=6, B=6, C=4 → eliminate C
  //
  // 2 remain: A, B → both win
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = [
    ...Array(3).fill(['A', 'B', 'C', 'D']),
    ...Array(2).fill(['B', 'C', 'A', 'D']),
    ...Array(2).fill(['C', 'D', 'A', 'B']),
    ...Array(1).fill(['D', 'A', 'B', 'C']),
  ];
  const result = pbv.tabulate(candidates, ballots, 2);
  assert.strictEqual(result.winners.length, 2);
  assert.ok(result.winners.includes('A'), 'A should win');
  assert.ok(result.winners.includes('B'), 'B should win');
  assert.ok(!result.winners.includes('C'), 'C should NOT win');
  assert.ok(!result.winners.includes('D'), 'D should NOT win');
});

test('slide-up: round 2 tally reflects D being replaced by next preference', () => {
  // Same ballots as above — check that after D is eliminated,
  // the [C,D,A,B] ballots now contribute to A (not D)
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = [
    ...Array(3).fill(['A', 'B', 'C', 'D']),
    ...Array(2).fill(['B', 'C', 'A', 'D']),
    ...Array(2).fill(['C', 'D', 'A', 'B']),
    ...Array(1).fill(['D', 'A', 'B', 'C']),
  ];
  const result = pbv.tabulate(candidates, ballots, 2);
  // round index 0 = round 1 (D eliminated), round index 1 = round 2 (C eliminated)
  const round2 = result.rounds[1];
  // After D is removed from the pool, the [C,D,A,B] ballot's top 2 are [C, A]
  // so A should have received +2 in round 2 from those ballots
  // A total in round 2: 3 (from ABCDs) + 2 (from CDABs, slide-up) + 1 (from DABCs, slide-up) = 6
  assert.strictEqual(round2.tallies['A'], 6);
});

test('2-seat with only 2 candidates: both win immediately (no rounds needed)', () => {
  const result = pbv.tabulate(
    ['A', 'B'],
    [['A', 'B'], ['B', 'A'], ['A', 'B']],
    2
  );
  assert.strictEqual(result.winners.length, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.strictEqual(result.isTie, false);
});

test('2-seat: dominant candidates win without full elimination', () => {
  // Everyone prefers A and B → they should clearly survive
  const candidates = ['A', 'B', 'C', 'D'];
  const ballots = Array(10).fill(['A', 'B', 'C', 'D']);
  const result = pbv.tabulate(candidates, ballots, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.strictEqual(result.winners.length, 2);
});

// ─── Multi-Winner: 3 Seats ────────────────────────────────────────────────────

console.log('\nMulti-Winner: 3 Seats');

test('3-seat election: correct three winners (A, B, C) elected', () => {
  // Round 1 (top 3 per ballot):
  //   4x [A,B,C,D,E] → A+=4, B+=4, C+=4
  //   3x [B,C,D,A,E] → B+=3, C+=3, D+=3
  //   2x [E,D,A,B,C] → E+=2, D+=2, A+=2
  // Totals: A=6, B=7, C=7, D=5, E=2 → eliminate E
  //
  // Round 2 (E out):
  //   4x [A,B,C,D,E] → top3 active [A,B,C] → A+=4, B+=4, C+=4
  //   3x [B,C,D,A,E] → top3 active [B,C,D] → B+=3, C+=3, D+=3
  //   2x [E,D,A,B,C] → top3 active [D,A,B] → D+=2, A+=2, B+=2
  // Totals: A=6, B=9, C=7, D=5 → eliminate D
  //
  // 3 remain: A, B, C → all win
  const candidates = ['A', 'B', 'C', 'D', 'E'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C', 'D', 'E']),
    ...Array(3).fill(['B', 'C', 'D', 'A', 'E']),
    ...Array(2).fill(['E', 'D', 'A', 'B', 'C']),
  ];
  const result = pbv.tabulate(candidates, ballots, 3);
  assert.strictEqual(result.winners.length, 3);
  assert.ok(result.winners.includes('A'), 'A should win');
  assert.ok(result.winners.includes('B'), 'B should win');
  assert.ok(result.winners.includes('C'), 'C should win');
  assert.ok(!result.winners.includes('D'), 'D should NOT win');
  assert.ok(!result.winners.includes('E'), 'E should NOT win');
});

test('3-seat: round 1 tally counts exactly top 3 preferences per ballot', () => {
  const candidates = ['A', 'B', 'C', 'D', 'E'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C', 'D', 'E']),
    ...Array(3).fill(['B', 'C', 'D', 'A', 'E']),
    ...Array(2).fill(['E', 'D', 'A', 'B', 'C']),
  ];
  const result = pbv.tabulate(candidates, ballots, 3);
  const round1 = result.rounds[0];
  // Expected from manual calculation above
  assert.strictEqual(round1.tallies['A'], 6);
  assert.strictEqual(round1.tallies['B'], 7);
  assert.strictEqual(round1.tallies['C'], 7);
  assert.strictEqual(round1.tallies['D'], 5);
  assert.strictEqual(round1.tallies['E'], 2);
});

test('3-seat: E eliminated in round 1', () => {
  const candidates = ['A', 'B', 'C', 'D', 'E'];
  const ballots = [
    ...Array(4).fill(['A', 'B', 'C', 'D', 'E']),
    ...Array(3).fill(['B', 'C', 'D', 'A', 'E']),
    ...Array(2).fill(['E', 'D', 'A', 'B', 'C']),
  ];
  const result = pbv.tabulate(candidates, ballots, 3);
  assert.deepStrictEqual(result.rounds[0].eliminated, ['E']);
});

test('unanimous 3-seat: top-3 preferences always win', () => {
  const candidates = ['A', 'B', 'C', 'D', 'E'];
  const ballots = Array(8).fill(['A', 'B', 'C', 'D', 'E']);
  const result = pbv.tabulate(candidates, ballots, 3);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.ok(result.winners.includes('C'));
  assert.strictEqual(result.winners.length, 3);
});

// ─── Seats = Candidates edge case ─────────────────────────────────────────────

console.log('\nEdge Cases');

test('seats >= candidates: all candidates win', () => {
  const result = pbv.tabulate(
    ['A', 'B', 'C'],
    [['A', 'B', 'C'], ['B', 'C', 'A']],
    5
  );
  assert.strictEqual(result.winners.length, 3);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.ok(result.winners.includes('C'));
});

test('exhausted ballots (voter ranks fewer than N candidates)', () => {
  // ['A'] in a 2-seat race → contributes only 1 vote, not 2
  // Use ballots that produce a clear winner pair (no tie):
  //   Round 1 (top 2 active):
  //     ['A']       → A+=1
  //     2x ['A','B','C'] → A+=2, B+=2
  //     2x ['A','B','C'] → A+=2, B+=2 (same)
  //     2x ['B','C','A'] → B+=2, C+=2
  //     ['C','A','B']   → C+=1, A+=1
  //   Totals: A=6, B=6, C=3 → eliminate C → A and B win
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ['A'],
    ...Array(4).fill(['A', 'B', 'C']),
    ...Array(2).fill(['B', 'C', 'A']),
    ['C', 'A', 'B'],
  ];
  const result = pbv.tabulate(candidates, ballots, 2);
  assert.strictEqual(result.winners.length, 2);
  assert.ok(result.winners.includes('A'));
  assert.ok(result.winners.includes('B'));
  assert.strictEqual(result.isTie, false);
});

test('over-elimination guard: tie declared when eliminating all bottom candidates would go below seats', () => {
  // 3 candidates, 2 seats.
  // Round 1 (top 2 per ballot):
  //   2x [A,B,C] → A+=2, B+=2
  //   2x [A,C,B] → A+=2, C+=2
  // Tallies: A=4, B=2, C=2 → B and C tied for bottom.
  // Eliminating both would leave only A for 2 seats → guard triggers → isTie=true.
  const candidates = ['A', 'B', 'C'];
  const ballots = [
    ...Array(2).fill(['A', 'B', 'C']),
    ...Array(2).fill(['A', 'C', 'B']),
  ];
  const result = pbv.tabulate(candidates, ballots, 2);
  assert.strictEqual(result.isTie, true);
});

test('result has expected shape: winners, seats, isTie, rounds, totalBallots', () => {
  const result = pbv.tabulate(
    ['A', 'B', 'C'],
    [['A', 'B', 'C'], ['B', 'A', 'C']],
    2
  );
  assert.ok(Array.isArray(result.winners), 'winners should be an array');
  assert.ok(typeof result.seats === 'number', 'seats should be a number');
  assert.ok(typeof result.isTie === 'boolean', 'isTie should be a boolean');
  assert.ok(Array.isArray(result.rounds), 'rounds should be an array');
  assert.ok(typeof result.totalBallots === 'number', 'totalBallots should be a number');
});

test('totalBallots matches number of submitted ballots', () => {
  const ballots = [['A', 'B'], ['B', 'A'], ['A', 'B'], ['B', 'A']];
  const result = pbv.tabulate(['A', 'B'], ballots, 1);
  assert.strictEqual(result.totalBallots, 4);
});

// ─── Validation ───────────────────────────────────────────────────────────────

console.log('\nValidation');

test('empty candidates list is invalid', () => {
  const { valid } = pbv.validate([], [['A']]);
  assert.strictEqual(valid, false);
});

test('empty ballots list is invalid', () => {
  const { valid } = pbv.validate(['A', 'B'], []);
  assert.strictEqual(valid, false);
});

test('ballot with unknown candidate is invalid', () => {
  const { valid, errors } = pbv.validate(['A', 'B'], [['A', 'X']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.includes('"X"')));
});

test('ballot with duplicate candidate is invalid', () => {
  const { valid, errors } = pbv.validate(['A', 'B'], [['A', 'A']]);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.toLowerCase().includes('duplicate')));
});

test('valid ranked ballots pass validation', () => {
  const { valid, errors } = pbv.validate(
    ['A', 'B', 'C'],
    [['A', 'B', 'C'], ['C', 'B', 'A']]
  );
  assert.strictEqual(valid, true);
  assert.strictEqual(errors.length, 0);
});

test('partial rankings pass validation', () => {
  const { valid } = pbv.validate(['A', 'B', 'C'], [['A'], ['B', 'C']]);
  assert.strictEqual(valid, true);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
