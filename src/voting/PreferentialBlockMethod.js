const VotingMethod = require('./VotingMethod');

/**
 * Preferential Block Voting (Bloc IRV)
 *
 * For N seats, each ballot counts its top N active preferences (1 vote each).
 * When a candidate is eliminated, the next available preference slides up to fill
 * the slot, so each ballot always contributes up to N votes while candidates remain.
 *
 * - 1 seat  → identical to standard IRV (majority threshold + elimination)
 * - N seats → count top N active preferences per ballot, eliminate lowest, repeat
 *             until N candidates remain
 */
class PreferentialBlockMethod extends VotingMethod {
  constructor() {
    super('preferential-block');
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

  // Single-winner: identical to standard IRV
  _tabulateSingleWinner(candidates, ballots) {
    const activeCandidates = new Set(candidates);
    const workingBallots = ballots.map(b => [...b]);
    const rounds = [];
    let exhaustedCount = 0;

    while (activeCandidates.size > 1) {
      const tallies = {};
      for (const c of activeCandidates) tallies[c] = 0;

      const stillActive = [];
      for (const ballot of workingBallots) {
        const topChoice = ballot.find(c => activeCandidates.has(c));
        if (topChoice) {
          tallies[topChoice]++;
          stillActive.push(ballot);
        } else {
          exhaustedCount++;
        }
      }

      workingBallots.length = 0;
      workingBallots.push(...stillActive);

      const totalActive = workingBallots.length;
      const threshold = Math.floor(totalActive / 2) + 1;
      const roundNumber = rounds.length + 1;

      // Majority check — declare winner early if threshold met
      for (const [candidate, votes] of Object.entries(tallies)) {
        if (votes >= threshold) {
          rounds.push({
            roundNumber,
            tallies: { ...tallies },
            eliminated: null,
            elected: [candidate],
            totalActiveBallots: totalActive,
            threshold,
            rankDistribution: this._computeRankDistribution(activeCandidates, workingBallots),
          });
          return this._buildResult(candidates, ballots, rounds, [candidate], false, exhaustedCount, 1);
        }
      }

      const voteCounts = Object.values(tallies);
      const minVotes = Math.min(...voteCounts);
      const maxVotes = Math.max(...voteCounts);

      if (minVotes === maxVotes) {
        rounds.push({
          roundNumber,
          tallies: { ...tallies },
          eliminated: null,
          elected: null,
          totalActiveBallots: totalActive,
          threshold,
          rankDistribution: this._computeRankDistribution(activeCandidates, workingBallots),
        });
        return this._buildResult(candidates, ballots, rounds, [], true, exhaustedCount, 1);
      }

      const eliminated = Object.entries(tallies)
        .filter(([, votes]) => votes === minVotes)
        .map(([c]) => c);

      rounds.push({
        roundNumber,
        tallies: { ...tallies },
        eliminated: [...eliminated],
        elected: null,
        totalActiveBallots: totalActive,
        threshold,
        rankDistribution: this._computeRankDistribution(activeCandidates, workingBallots),
      });

      for (const c of eliminated) activeCandidates.delete(c);
    }

    const remaining = Array.from(activeCandidates);
    if (remaining.length === 1) {
      const tallies = { [remaining[0]]: 0 };
      let finalActive = 0;
      for (const ballot of workingBallots) {
        const topChoice = ballot.find(c => activeCandidates.has(c));
        if (topChoice) { tallies[topChoice]++; finalActive++; }
        else exhaustedCount++;
      }
      rounds.push({
        roundNumber: rounds.length + 1,
        tallies,
        eliminated: null,
        elected: [remaining[0]],
        totalActiveBallots: finalActive,
        threshold: Math.floor(finalActive / 2) + 1,
        rankDistribution: this._computeRankDistribution(activeCandidates, workingBallots),
      });
      return this._buildResult(candidates, ballots, rounds, [remaining[0]], false, exhaustedCount, 1);
    }

    return this._buildResult(candidates, ballots, rounds, [], true, exhaustedCount, 1);
  }

  // Multi-winner: each ballot counts its top `seats` active preferences
  _tabulateMultiWinner(candidates, ballots, seats) {
    const activeCandidates = new Set(candidates);
    const rounds = [];
    let exhaustedCount = 0;

    while (activeCandidates.size > seats) {
      const tallies = {};
      for (const c of activeCandidates) tallies[c] = 0;

      let activeVoters = 0;
      let exhaustedThisRound = 0;

      for (const ballot of ballots) {
        // Slide-up: take the top `seats` still-active preferences from this ballot
        const topN = ballot.filter(c => activeCandidates.has(c)).slice(0, seats);
        if (topN.length > 0) {
          activeVoters++;
          for (const choice of topN) tallies[choice]++;
        } else {
          exhaustedThisRound++;
        }
      }

      exhaustedCount = exhaustedThisRound; // track exhausted per round (latest count)

      const roundNumber = rounds.length + 1;
      const voteCounts = Object.values(tallies);
      const minVotes = Math.min(...voteCounts);
      const maxVotes = Math.max(...voteCounts);

      // Complete tie among all remaining candidates
      if (minVotes === maxVotes) {
        rounds.push({
          roundNumber,
          tallies: { ...tallies },
          eliminated: null,
          elected: null,
          totalActiveBallots: activeVoters,
          threshold: null,
          rankDistribution: this._computeRankDistribution(activeCandidates, ballots),
        });
        return this._buildResult(candidates, ballots, rounds, [], true, exhaustedCount, seats);
      }

      const eliminated = Object.entries(tallies)
        .filter(([, votes]) => votes === minVotes)
        .map(([c]) => c);

      // Guard: eliminating all tied-bottom candidates would drop below the seat count
      if (activeCandidates.size - eliminated.length < seats) {
        rounds.push({
          roundNumber,
          tallies: { ...tallies },
          eliminated: null,
          elected: null,
          totalActiveBallots: activeVoters,
          threshold: null,
          rankDistribution: this._computeRankDistribution(activeCandidates, ballots),
        });
        return this._buildResult(candidates, ballots, rounds, [], true, exhaustedCount, seats);
      }

      rounds.push({
        roundNumber,
        tallies: { ...tallies },
        eliminated: [...eliminated],
        elected: null,
        totalActiveBallots: activeVoters,
        threshold: null,
        rankDistribution: this._computeRankDistribution(activeCandidates, ballots),
      });

      for (const c of eliminated) activeCandidates.delete(c);
    }

    // Remaining candidates fill all seats
    const winners = Array.from(activeCandidates);

    // Final round: show last tally for the winners
    const finalTallies = {};
    for (const c of activeCandidates) finalTallies[c] = 0;
    let finalActive = 0;
    for (const ballot of ballots) {
      const topN = ballot.filter(c => activeCandidates.has(c)).slice(0, seats);
      if (topN.length > 0) {
        finalActive++;
        for (const choice of topN) finalTallies[choice]++;
      }
    }

    rounds.push({
      roundNumber: rounds.length + 1,
      tallies: finalTallies,
      eliminated: null,
      elected: [...winners],
      totalActiveBallots: finalActive,
      threshold: null,
      rankDistribution: this._computeRankDistribution(activeCandidates, ballots),
    });

    return this._buildResult(candidates, ballots, rounds, winners, false, exhaustedCount, seats);
  }

  _computeRankDistribution(activeCandidates, ballots) {
    const distribution = {};
    const numActive = activeCandidates.size;
    for (const c of activeCandidates) {
      distribution[c] = new Array(numActive).fill(0);
    }
    for (const ballot of ballots) {
      const ranking = Array.isArray(ballot)
        ? ballot.filter(c => activeCandidates.has(c))
        : ballot.ranking.filter(c => activeCandidates.has(c));
      for (let i = 0; i < ranking.length; i++) {
        distribution[ranking[i]][i]++;
      }
    }
    return distribution;
  }

  _buildResult(candidates, ballots, rounds, winners, isTie, exhaustedBallots, seats) {
    let summary;
    if (isTie) {
      if (winners.length > 0) {
        summary = `Partial result: ${winners.join(', ')} elected. Remaining seats ended in a tie.`;
      } else {
        summary = 'The election ended in a tie. No winner could be determined.';
      }
    } else if (winners.length === 1) {
      const finalRound = rounds[rounds.length - 1];
      const winnerVotes = finalRound.tallies[winners[0]];
      summary = `${winners[0]} wins with ${winnerVotes} votes in round ${rounds.length}.`;
    } else {
      summary = `${winners.length} seats filled: ${winners.join(', ')}.`;
    }

    return {
      method: 'preferential-block',
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
}

module.exports = PreferentialBlockMethod;
