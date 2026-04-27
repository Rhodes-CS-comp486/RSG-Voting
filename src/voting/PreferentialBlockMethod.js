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

}

module.exports = PreferentialBlockMethod;
