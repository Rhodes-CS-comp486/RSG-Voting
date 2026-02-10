/**
 * Interactive Borda Count Example
 * Run with: node example-borda.js
 *
 * Edit the ELECTION CONFIG section below to try your own elections.
 */

const { createEngine } = require('./src/voting');

const engine = createEngine();

// ─── ELECTION CONFIG ─────────────────────────────────────────────────────────
// Change anything here to try your own election.

const CANDIDATES = ['Alice', 'Bob', 'Charlie', 'Diana'];

// Each ballot is an array ranked from most to least preferred.
// Voters don't have to rank everyone — partial rankings are allowed.
const BALLOTS = [
  ['Alice',   'Bob',     'Charlie', 'Diana'],
  ['Alice',   'Charlie', 'Bob',     'Diana'],
  ['Bob',     'Alice',   'Diana',   'Charlie'],
  ['Charlie', 'Alice',   'Bob',     'Diana'],
  ['Diana',   'Bob',     'Alice',   'Charlie'],
  ['Bob',     'Diana',   'Charlie', 'Alice'],
  ['Alice',   'Bob'],              // partial — only ranks 2 of 4
];

// 1 = single winner,  2+ = multi-winner (top N elected)
const SEATS = 1;

// ─────────────────────────────────────────────────────────────────────────────

function printDivider(char = '─', width = 50) {
  console.log(char.repeat(width));
}

function runAndDisplay(label, candidates, ballots, seats) {
  console.log(`\n${label}`);
  printDivider();

  // Validate first so errors are readable
  const BordaCountMethod = require('./src/voting/BordaCountMethod');
  const borda = new BordaCountMethod();
  const { valid, errors } = borda.validate(candidates, ballots);
  if (!valid) {
    console.error('Validation errors:');
    errors.forEach(e => console.error(`  • ${e}`));
    return;
  }

  const result = engine.runElection({
    title: label,
    candidates,
    method: 'borda',
    ballots,
    seats,
  });

  // ── Ballots ──────────────────────────────────────────────────────────
  console.log('\nBallots submitted:');
  ballots.forEach((ballot, i) => {
    console.log(`  Voter ${i + 1}: ${ballot.join(' > ')}`);
  });

  // ── Scores ───────────────────────────────────────────────────────────
  const scores = result.scores ?? result.results;
  const maxScore = Math.max(...Object.values(scores));
  const barWidth = 30;

  console.log('\nScores  (1st choice = ' + (candidates.length - 1) + ' pts, last = 0 pts):');
  Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .forEach(([name, score]) => {
      const filled = maxScore > 0 ? Math.round((score / maxScore) * barWidth) : 0;
      const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
      const tag = result.elected.includes(name) ? ' ✓ ELECTED' : '';
      console.log(`  ${name.padEnd(12)} ${bar} ${score}${tag}`);
    });

  // ── Outcome ──────────────────────────────────────────────────────────
  console.log('');
  if (seats === 1) {
    if (result.isTieBreak) {
      console.log(`Outcome : TIE between ${result.winners.join(' and ')} — requires a tiebreaker`);
    } else {
      console.log(`Outcome : ${result.winners[0]} wins`);
    }
  } else {
    console.log(`Outcome : ${result.elected.length} of ${seats} seats filled`);
    result.elected.forEach((name, i) => console.log(`  Seat ${i + 1}: ${name}`));
  }

  console.log(`Ballots : ${result.ballotCount}  |  Candidates : ${result.candidateCount}`);
}

// ─── Run your election ───────────────────────────────────────────────────────

runAndDisplay('My Borda Election', CANDIDATES, BALLOTS, SEATS);

// ─── Built-in demos ──────────────────────────────────────────────────────────
// Uncomment any block below to see it run alongside your election.

/*
// DEMO 1: Borda winner ≠ plurality winner
// Alice leads in first-choice votes (4) but Bob wins overall.
runAndDisplay(
  'Demo: Borda vs Plurality',
  ['Alice', 'Bob', 'Charlie'],
  [
    ...Array(4).fill(['Alice', 'Charlie', 'Bob']),
    ...Array(3).fill(['Bob',   'Charlie', 'Alice']),
    ...Array(2).fill(['Charlie', 'Bob',   'Alice']),
  ],
  1
);
*/

/*
// DEMO 2: Two-seat committee election
runAndDisplay(
  'Demo: Committee (2 seats)',
  ['Priya', 'Jordan', 'Sam', 'Lee'],
  [
    ['Priya',  'Jordan', 'Sam',   'Lee'],
    ['Priya',  'Sam',    'Jordan', 'Lee'],
    ['Jordan', 'Priya',  'Lee',   'Sam'],
    ['Jordan', 'Lee',    'Priya', 'Sam'],
    ['Sam',    'Priya',  'Jordan', 'Lee'],
  ],
  2
);
*/

/*
// DEMO 3: Tie scenario
runAndDisplay(
  'Demo: Tie',
  ['Red', 'Blue'],
  [['Red', 'Blue'], ['Blue', 'Red']],
  1
);
*/
