const VotingMethod = require('./VotingMethod');

class BordaCountMethod extends VotingMethod {
  constructor() {
    super('borda');
  }

  tabulate(candidates, ballots, seats = 1) {
    if (seats === 1) {
      return this._tabulateSingleWinner(candidates, ballots);
    }
    return this._tabulateMultiWinner(candidates, ballots, seats);
  }

  _computeScores(candidates, ballots) {
    const scores = {};
    for (const candidate of candidates) scores[candidate] = 0;
    for (const ballot of ballots) {
      for (let position = 0; position < ballot.length; position++) {
        const candidate = ballot[position];
        if (scores[candidate] !== undefined) {
          scores[candidate] += Math.max(0, candidates.length - 1 - position);
        }
      }
    }
    return scores;
  }

  // Borda Count — single winner
  _tabulateSingleWinner(candidates, ballots) {
    const scores = this._computeScores(candidates, ballots);

    const maxScore = Math.max(...Object.values(scores));
    const winners = Object.entries(scores)
      .filter(([, score]) => score === maxScore)
      .map(([candidate]) => candidate);

    const isTie = winners.length > 1;
    const summary = isTie
      ? `Tie between ${winners.join(' and ')}. A tiebreaker is required.`
      : `${winners[0]} wins with ${scores[winners[0]]} points.`;

    return {
      method: 'borda',
      title: '',
      winners,
      scores,
      rankDistribution: this._computeRankDistribution(candidates, ballots),
      isTie,
      summary,
      totalBallots: ballots.length,
      totalCandidates: candidates.length,
      exhaustedBallots: 0,
      rounds: [{
        roundNumber: 1,
        tallies: { ...scores },
        eliminated: null,
        elected: winners,
        totalActiveBallots: ballots.length,
        threshold: null,
      }],
      timestamp: '',
    };
  }

  // Borda Count — multi-winner (top-N by total score)
  _tabulateMultiWinner(candidates, ballots, seats) {
    const scores = this._computeScores(candidates, ballots);

    const sortedCandidates = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);

    const winners = sortedCandidates.slice(0, seats).map(([c]) => c);
    const rounds = winners.map((candidate, i) => ({
      roundNumber: i + 1,
      seat: i + 1,
      elected: [candidate],
      tallies: { ...scores },
      totalActiveBallots: ballots.length,
      threshold: null,
    }));

    return {
      method: 'borda',
      title: '',
      winners,
      rounds,
      scores,
      rankDistribution: this._computeRankDistribution(candidates, ballots),
      isTie: false,
      summary: `${winners.length} seats filled: ${winners.join(', ')}.`,
      totalBallots: ballots.length,
      totalCandidates: candidates.length,
      exhaustedBallots: 0,
      timestamp: '',
    };
  }

}

module.exports = BordaCountMethod;
