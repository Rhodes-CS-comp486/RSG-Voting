const VotingMethod = require('./VotingMethod');

class BordaCountMethod extends VotingMethod {
  constructor() {
    super('borda');
  }

  validate(candidates, ballots) {
    const errors = [];

    if (!Array.isArray(candidates) || candidates.length === 0) {
      errors.push('Candidates list must be a non-empty array');
    }

    if (!Array.isArray(ballots) || ballots.length === 0) {
      errors.push('Ballots list must be a non-empty array');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const candidateSet = new Set(candidates);

    for (let i = 0; i < ballots.length; i++) {
      const ballot = ballots[i];

      if (!Array.isArray(ballot) || ballot.length === 0) {
        errors.push(`Ballot ${i + 1}: must be a non-empty array`);
        continue;
      }

      const seen = new Set();
      for (const choice of ballot) {
        if (!candidateSet.has(choice)) {
          errors.push(`Ballot ${i + 1}: unknown candidate "${choice}"`);
        }
        if (seen.has(choice)) {
          errors.push(`Ballot ${i + 1}: duplicate ranking for "${choice}"`);
        }
        seen.add(choice);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  tabulate(candidates, ballots, seats = 1) {
    if (seats === 1) {
      return this._tabulateSingleWinner(candidates, ballots);
    }
    return this._tabulateMultiWinner(candidates, ballots, seats);
  }

  // Borda Count — single winner
  _tabulateSingleWinner(candidates, ballots) {
    const scores = {};
    for (const candidate of candidates) {
      scores[candidate] = 0;
    }

    // Assign points based on ranking position
    // 1st choice gets (n-1) points, 2nd gets (n-2), etc.
    for (const ballot of ballots) {
      for (let position = 0; position < ballot.length; position++) {
        const candidate = ballot[position];
        if (candidates.includes(candidate)) {
          const points = Math.max(0, candidates.length - 1 - position);
          scores[candidate] += points;
        }
      }
    }

    // Find winner(s)
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
      elected: winners,
      // renderer-compatible fields
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
      // kept for backwards compatibility
      isTieBreak: isTie,
      results: scores,
      ballotCount: ballots.length,
      candidateCount: candidates.length,
      timestamp: new Date().toISOString(),
    };
  }

  // Borda Count — multi-winner (top-N by total score)
  _tabulateMultiWinner(candidates, ballots, seats) {
    const scores = {};
    for (const candidate of candidates) {
      scores[candidate] = 0;
    }

    // Calculate Borda scores using fixed point scale (based on total candidates)
    // All candidates scored consistently: 1st choice = n-1 points, etc.
    for (const ballot of ballots) {
      for (let position = 0; position < ballot.length; position++) {
        const candidate = ballot[position];
        if (candidates.includes(candidate)) {
          const points = Math.max(0, candidates.length - 1 - position);
          scores[candidate] += points;
        }
      }
    }

    // Sort all candidates by score (descending)
    const sortedCandidates = Object.entries(scores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

    // Elect top N candidates for the available seats
    const elected = [];
    const rounds = [];
    
    for (let i = 0; i < Math.min(seats, sortedCandidates.length); i++) {
      const [candidate, score] = sortedCandidates[i];
      elected.push(candidate);
      
      rounds.push({
        roundNumber: i + 1,
        seat: i + 1,
        elected: [candidate],
        score: score,
        allScores: { ...scores },
        // renderer-compatible fields
        tallies: { ...scores },
        totalActiveBallots: ballots.length,
        threshold: null,
      });
    }

    return {
      method: 'borda',
      title: '',
      elected,
      winners: elected,
      rounds,
      scores,
      // renderer-compatible fields
      isTie: false,
      summary: `${elected.length} seats filled: ${elected.join(', ')}.`,
      totalBallots: ballots.length,
      totalCandidates: candidates.length,
      exhaustedBallots: 0,
      // kept for backwards compatibility
      ballotCount: ballots.length,
      candidateCount: candidates.length,
      seatsToFill: seats,
      seatsElected: elected.length,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = BordaCountMethod;
