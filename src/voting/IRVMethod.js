const VotingMethod = require('./VotingMethod');

class IRVMethod extends VotingMethod {
  constructor() {
    super('irv');
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

  // Original IRV — single winner
  _tabulateSingleWinner(candidates, ballots) {
    const activeCandidates = new Set(candidates);
    const workingBallots = ballots.map(b => [...b]);
    const rounds = [];
    let exhaustedCount = 0;

    while (activeCandidates.size > 1) {
      const tallies = {};
      for (const c of activeCandidates) {
        tallies[c] = 0;
      }

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
        .filter(([_, votes]) => votes === minVotes)
        .map(([candidate]) => candidate);

      rounds.push({
        roundNumber,
        tallies: { ...tallies },
        eliminated: [...eliminated],
        elected: null,
        totalActiveBallots: totalActive,
        threshold,
        rankDistribution: this._computeRankDistribution(activeCandidates, workingBallots),
      });

      for (const candidate of eliminated) {
        activeCandidates.delete(candidate);
      }
    }

    const remaining = Array.from(activeCandidates);

    if (remaining.length === 1) {
      const tallies = {};
      let finalActive = 0;
      tallies[remaining[0]] = 0;

      for (const ballot of workingBallots) {
        const topChoice = ballot.find(c => activeCandidates.has(c));
        if (topChoice) {
          tallies[topChoice]++;
          finalActive++;
        } else {
          exhaustedCount++;
        }
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

  // STV — multi-winner
  _tabulateMultiWinner(candidates, ballots, seats) {
    const activeCandidates = new Set(candidates);
    const winners = [];
    const rounds = [];
    let exhaustedCount = 0;

    // Each ballot gets a "weight" — starts at 1.0, reduced when surplus transfers
    let weightedBallots = ballots.map(b => ({ ranking: [...b], weight: 1.0 }));

    while (winners.length < seats) {
      const seatsRemaining = seats - winners.length;

      // If remaining candidates equals seats remaining, elect them all
      if (activeCandidates.size <= seatsRemaining) {
        const remaining = Array.from(activeCandidates);
        const tallies = {};
        let totalActive = 0;

        for (const c of activeCandidates) {
          tallies[c] = 0;
        }
        for (const wb of weightedBallots) {
          const topChoice = wb.ranking.find(c => activeCandidates.has(c));
          if (topChoice) {
            tallies[topChoice] += wb.weight;
            totalActive++;
          }
        }

        // Round the tallies for display
        for (const c in tallies) {
          tallies[c] = Math.round(tallies[c] * 100) / 100;
        }

        rounds.push({
          roundNumber: rounds.length + 1,
          tallies,
          eliminated: null,
          elected: [...remaining],
          totalActiveBallots: totalActive,
          threshold: null,
          rankDistribution: this._computeRankDistribution(activeCandidates, weightedBallots),
        });

        winners.push(...remaining);
        break;
      }

      // Count weighted first-choice votes
      const tallies = {};
      for (const c of activeCandidates) {
        tallies[c] = 0;
      }

      const stillActive = [];
      for (const wb of weightedBallots) {
        const topChoice = wb.ranking.find(c => activeCandidates.has(c));
        if (topChoice) {
          tallies[topChoice] += wb.weight;
          stillActive.push(wb);
        } else {
          exhaustedCount++;
        }
      }

      weightedBallots = stillActive;

      const totalWeight = weightedBallots.reduce((sum, wb) => sum + wb.weight, 0);
      // Droop quota: floor(totalVotes / (seats + 1)) + 1
      const quota = Math.floor(totalWeight / (seatsRemaining + 1)) + 1;
      const roundNumber = rounds.length + 1;

      // Round tallies for display
      const displayTallies = {};
      for (const c in tallies) {
        displayTallies[c] = Math.round(tallies[c] * 100) / 100;
      }

      // Check if any candidate meets the quota
      const newlyElected = Object.entries(tallies)
        .filter(([_, votes]) => votes >= quota)
        .sort((a, b) => b[1] - a[1])
        .map(([candidate]) => candidate);

      if (newlyElected.length > 0) {
        rounds.push({
          roundNumber,
          tallies: displayTallies,
          eliminated: null,
          elected: [...newlyElected],
          totalActiveBallots: weightedBallots.length,
          threshold: quota,
          rankDistribution: this._computeRankDistribution(activeCandidates, weightedBallots),
        });

        for (const elected of newlyElected) {
          winners.push(elected);
          const surplus = tallies[elected] - quota;

          if (surplus > 0) {
            // Transfer surplus: reduce weight of ballots that went to this candidate
            const transferFactor = surplus / tallies[elected];
            for (const wb of weightedBallots) {
              const topChoice = wb.ranking.find(c => activeCandidates.has(c));
              if (topChoice === elected) {
                wb.weight *= transferFactor;
              }
            }
          } else {
            // No surplus — zero out ballots for this candidate
            for (const wb of weightedBallots) {
              const topChoice = wb.ranking.find(c => activeCandidates.has(c));
              if (topChoice === elected) {
                wb.weight = 0;
              }
            }
          }

          activeCandidates.delete(elected);
        }

        // Remove zero-weight ballots
        weightedBallots = weightedBallots.filter(wb => wb.weight > 0.001);
        continue;
      }

      // No one meets quota — eliminate the candidate with fewest votes
      const voteCounts = Object.values(tallies);
      const minVotes = Math.min(...voteCounts);
      const maxVotes = Math.max(...voteCounts);

      // Complete tie among all remaining
      if (minVotes === maxVotes && activeCandidates.size > seatsRemaining) {
        rounds.push({
          roundNumber,
          tallies: displayTallies,
          eliminated: null,
          elected: null,
          totalActiveBallots: weightedBallots.length,
          threshold: quota,
          rankDistribution: this._computeRankDistribution(activeCandidates, weightedBallots),
        });

        return this._buildResult(candidates, ballots, rounds, winners, true, exhaustedCount, seats);
      }

      const eliminated = Object.entries(tallies)
        .filter(([_, votes]) => votes === minVotes)
        .map(([candidate]) => candidate);

      rounds.push({
        roundNumber,
        tallies: displayTallies,
        eliminated: [...eliminated],
        elected: null,
        totalActiveBallots: weightedBallots.length,
        threshold: quota,
        rankDistribution: this._computeRankDistribution(activeCandidates, weightedBallots),
      });

      for (const candidate of eliminated) {
        activeCandidates.delete(candidate);
      }
    }

    return this._buildResult(candidates, ballots, rounds, winners, false, exhaustedCount, seats);
  }

  // Compute how many ballots rank each active candidate at each effective position
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
      method: 'irv',
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

module.exports = IRVMethod;
