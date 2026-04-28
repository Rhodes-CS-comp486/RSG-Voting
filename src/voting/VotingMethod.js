class VotingMethod {
  constructor(name) {
    if (new.target === VotingMethod) {
      throw new Error('VotingMethod is abstract and cannot be instantiated directly');
    }
    this.name = name;
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
    throw new Error('tabulate() must be implemented by subclass');
  }

  _buildResult(candidates, ballots, rounds, winners, isTie, exhaustedBallots, seats) {
    let summary;
    if (isTie) {
      summary = winners.length > 0
        ? `Partial result: ${winners.join(', ')} elected. Remaining seats ended in a tie.`
        : 'The election ended in a tie. No winner could be determined.';
    } else if (winners.length === 1) {
      const finalRound = rounds[rounds.length - 1];
      const winnerVotes = finalRound.tallies[winners[0]];
      summary = `${winners[0]} wins with ${winnerVotes} votes in round ${rounds.length}.`;
    } else {
      summary = `${winners.length} seats filled: ${winners.join(', ')}.`;
    }

    return {
      method: this.name,
      title: '',
      winners,
      seats,
      isTie,
      rounds,
      summary,
      totalBallots: ballots.length,
      totalCandidates: candidates.length,
      exhaustedBallots,
      timestamp: '',
    };
  }

  _computeRankDistribution(activeCandidates, ballots) {
    const distribution = {};
    const numActive = activeCandidates instanceof Set ? activeCandidates.size : activeCandidates.length;
    for (const c of activeCandidates) {
      distribution[c] = new Array(numActive).fill(0);
    }
    for (const ballot of ballots) {
      const ranking = Array.isArray(ballot)
        ? ballot.filter(c => distribution[c] !== undefined)
        : ballot.ranking.filter(c => distribution[c] !== undefined);
      for (let i = 0; i < ranking.length; i++) {
        distribution[ranking[i]][i]++;
      }
    }
    return distribution;
  }
}

module.exports = VotingMethod;
