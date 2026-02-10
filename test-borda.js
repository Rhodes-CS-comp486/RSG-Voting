const { createEngine } = require('./src/voting');

const engine = createEngine();

// Test 1: Simple single-winner election
console.log('=== Test 1: Single-Winner Borda Count ===');
const test1Result = engine.runElection({
  title: 'Best Pizza Topping',
  candidates: ['Pepperoni', 'Mushroom', 'Onion', 'Sausage'],
  method: 'borda',
  ballots: [
    ['Pepperoni', 'Mushroom', 'Onion', 'Sausage'],
    ['Pepperoni', 'Onion', 'Mushroom', 'Sausage'],
    ['Mushroom', 'Pepperoni', 'Sausage', 'Onion'],
    ['Mushroom', 'Sausage', 'Pepperoni', 'Onion'],
    ['Onion', 'Pepperoni', 'Mushroom', 'Sausage'],
    ['Sausage', 'Mushroom', 'Pepperoni', 'Onion'],
  ],
});
console.log(JSON.stringify(test1Result, null, 2));
console.log('\n');

// Test 2: Multi-winner election (2 seats)
console.log('=== Test 2: Multi-Winner - 2 Seats ===');
const test2Result = engine.runElection({
  title: 'Best Programming Languages',
  candidates: ['Python', 'JavaScript', 'Rust', 'Go', 'TypeScript'],
  method: 'borda',
  seats: 2,
  ballots: [
    ['Python', 'JavaScript', 'TypeScript', 'Rust', 'Go'],
    ['Python', 'Rust', 'JavaScript', 'TypeScript', 'Go'],
    ['JavaScript', 'Python', 'TypeScript', 'Go', 'Rust'],
    ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go'],
    ['Rust', 'Go', 'Python', 'JavaScript', 'TypeScript'],
    ['TypeScript', 'Python', 'JavaScript', 'Go', 'Rust'],
    ['Python', 'JavaScript', 'Rust', 'TypeScript', 'Go'],
  ],
});
console.log(JSON.stringify(test2Result, null, 2));
console.log('\n');

// Test 3: Clear winner scenario
console.log('=== Test 3: Clear Winner (Single-Winner) ===');
const test3Result = engine.runElection({
  title: 'Team Lead Election',
  candidates: ['Alice', 'Bob', 'Charlie'],
  method: 'borda',
  ballots: [
    ['Alice', 'Bob', 'Charlie'],
    ['Alice', 'Charlie', 'Bob'],
    ['Alice', 'Bob', 'Charlie'],
    ['Bob', 'Alice', 'Charlie'],
    ['Alice', 'Bob', 'Charlie'],
  ],
});
console.log(JSON.stringify(test3Result, null, 2));
console.log('\n');

// Test 4: Three-way tie scenario
console.log('=== Test 4: Three-Way Tie (Single-Winner) ===');
const test4Result = engine.runElection({
  title: 'Movie Night Pick',
  candidates: ['Action', 'Comedy', 'Drama'],
  method: 'borda',
  ballots: [
    ['Action', 'Comedy', 'Drama'],
    ['Comedy', 'Drama', 'Action'],
    ['Drama', 'Action', 'Comedy'],
  ],
});
console.log(JSON.stringify(test4Result, null, 2));
console.log('\n');

// Test 5: Large multi-winner election (3 of 6 candidates)
console.log('=== Test 5: Multi-Winner - 3 of 6 Candidates ===');
const test5Result = engine.runElection({
  title: 'Committee Member Selection',
  candidates: ['Carol', 'Diana', 'Edward', 'Frank', 'Grace', 'Henry'],
  method: 'borda',
  seats: 3,
  ballots: [
    ['Carol', 'Diana', 'Edward', 'Frank', 'Grace', 'Henry'],
    ['Diana', 'Carol', 'Frank', 'Edward', 'Henry', 'Grace'],
    ['Edward', 'Carol', 'Diana', 'Frank', 'Grace', 'Henry'],
    ['Carol', 'Frank', 'Diana', 'Edward', 'Henry', 'Grace'],
    ['Diana', 'Edward', 'Carol', 'Grace', 'Frank', 'Henry'],
    ['Frank', 'Carol', 'Diana', 'Edward', 'Grace', 'Henry'],
    ['Carol', 'Diana', 'Edward', 'Frank', 'Grace', 'Henry'],
    ['Grace', 'Carol', 'Diana', 'Edward', 'Frank', 'Henry'],
  ],
});
console.log(JSON.stringify(test5Result, null, 2));
console.log('\n');

// Test 6: Partial rankings (voters don't rank all candidates)
console.log('=== Test 6: Partial Rankings (Single-Winner) ===');
const test6Result = engine.runElection({
  title: 'Best Dessert',
  candidates: ['Cake', 'Pie', 'Ice Cream', 'Brownie'],
  method: 'borda',
  ballots: [
    ['Cake', 'Pie'],  // Only ranks 2
    ['Pie', 'Cake', 'Ice Cream'],  // Ranks 3
    ['Cake'],  // Only 1 choice
    ['Ice Cream', 'Cake', 'Pie', 'Brownie'],  // All 4
    ['Brownie', 'Ice Cream', 'Cake'],  // Ranks 3
    ['Cake', 'Pie', 'Brownie'],  // Ranks 3
  ],
});
console.log(JSON.stringify(test6Result, null, 2));
console.log('\n');

console.log('All tests completed!');
