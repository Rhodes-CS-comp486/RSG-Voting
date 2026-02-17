let lastResult = null;
let electionCount = 0;

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// View switching — hides all sections, shows the one you want
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('RSG Voting App initialized');

  // Get app version from main process
  try {
    const version = await window.electronAPI.getAppVersion();
    document.getElementById('app-version').textContent = version;
  } catch (error) {
    console.error('Failed to get app version:', error);
    document.getElementById('app-version').textContent = 'Unknown';
  }

  // --- Home view buttons ---

  document.getElementById('start-voting').addEventListener('click', async () => {
    showView('view-setup');

    // Populate the voting method dropdown
    const methods = await window.electronAPI.getVotingMethods();
    const select = document.getElementById('voting-method');
    select.innerHTML = '';
    methods.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m.toUpperCase();
      select.appendChild(opt);
    });
  });

  document.getElementById('view-results-btn').addEventListener('click', () => {
    if (lastResult) {
      displayResults(lastResult);
      showView('view-results-page');
    } else {
      alert('No election results yet. Run an election first!');
    }
  });

  document.getElementById('settings').addEventListener('click', () => {
    alert('Settings feature coming soon!');
  });

  // --- Setup view buttons ---

  document.getElementById('setup-back-btn').addEventListener('click', () => {
    showView('view-home');
  });

  document.getElementById('run-election-btn').addEventListener('click', async () => {
    const errBox = document.getElementById('validation-errors');
    errBox.style.display = 'none';

    const title = document.getElementById('election-title').value.trim();
    const method = document.getElementById('voting-method').value;
    const candidatesRaw = document.getElementById('candidates-input').value.trim();
    const ballotsRaw = document.getElementById('ballots-input').value.trim();

    // Parse candidates: split by newline, trim, filter empty
    const candidates = candidatesRaw.split('\n').map(c => c.trim()).filter(Boolean);

    // Parse ballots: each line is comma-separated ranked choices
    const ballots = ballotsRaw.split('\n')
      .map(line => line.split(',').map(c => c.trim()).filter(Boolean))
      .filter(b => b.length > 0);

    if (candidates.length === 0 || ballots.length === 0) {
      errBox.textContent = 'Please enter at least one candidate and one ballot.';
      errBox.style.display = 'block';
      return;
    }

    const seats = parseInt(document.getElementById('seats-input').value, 10) || 1;
    const config = { title: title || 'Untitled Election', candidates, method, ballots, seats };

    const response = await window.electronAPI.runElection(config);

    if (response.success) {
      lastResult = response.result;
      electionCount++;
      document.getElementById('stat-elections').textContent = electionCount;
      document.getElementById('stat-ballots').textContent = response.result.totalBallots;
      displayResults(response.result);
      showView('view-results-page');
    } else {
      errBox.textContent = response.error;
      errBox.style.display = 'block';
    }
  });

  // --- Results view buttons ---

  document.getElementById('new-election-btn').addEventListener('click', async () => {
    showView('view-setup');

    const methods = await window.electronAPI.getVotingMethods();
    const select = document.getElementById('voting-method');
    select.innerHTML = '';
    methods.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m.toUpperCase();
      select.appendChild(opt);
    });
  });

  document.getElementById('results-back-btn').addEventListener('click', () => {
    showView('view-home');
  });
});

function displayResults(result) {
  // Title
  document.getElementById('results-title').textContent = result.title || 'Election Results';

  // Summary card
  const summaryEl = document.getElementById('result-summary');
  if (result.isTie) {
    summaryEl.innerHTML = `<p class="result-tie">Tie — Not All Seats Filled</p><p>${result.summary}</p>`;
  } else if (result.winners.length === 1) {
    summaryEl.innerHTML = `<p class="result-winner">Winner: ${result.winners[0]}</p><p>${result.summary}</p>`;
  } else {
    const winnerList = result.winners.map((w, i) => `${i + 1}. ${w}`).join('<br>');
    summaryEl.innerHTML = `<p class="result-winner">Elected (${result.winners.length} seats):</p><p>${winnerList}</p><p>${result.summary}</p>`;
  }

  // Stats
  document.getElementById('result-total-ballots').textContent = result.totalBallots;
  document.getElementById('result-total-candidates').textContent = result.totalCandidates;
  document.getElementById('result-exhausted').textContent = result.exhaustedBallots;

  // Rounds
  const container = document.getElementById('rounds-container');
  container.innerHTML = '';

  result.rounds.forEach(round => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const eliminatedSet = new Set(round.eliminated || []);

    let rankTableHTML = '';
    if (round.rankDistribution) {
      const candidates = Object.keys(round.rankDistribution);
      const numPositions = Math.max(...candidates.map(c => round.rankDistribution[c].length));

      let headerCells = '<th>Candidate</th>';
      for (let i = 0; i < numPositions; i++) {
        headerCells += `<th>${i + 1}${ordinalSuffix(i + 1)}</th>`;
      }
      headerCells += '<th>Total</th>';

      let bodyRows = '';
      for (const candidate of candidates) {
        const counts = round.rankDistribution[candidate];
        let cells = `<td class="rank-table-candidate">${candidate}</td>`;
        let total = 0;
        for (let i = 0; i < numPositions; i++) {
          const count = counts[i] || 0;
          total += count;
          const isFirst = i === 0;
          cells += `<td class="${isFirst ? 'rank-first' : ''}">${count}</td>`;
        }
        cells += `<td class="rank-total">${total}</td>`;
        const trClass = eliminatedSet.has(candidate) ? ' class="eliminated-row"' : '';
        bodyRows += `<tr${trClass}>${cells}</tr>`;
      }

      rankTableHTML = `
        <div class="rank-table-wrapper">
          <h5>Ranking Distribution</h5>
          <table class="rank-table">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>`;
    }

    let statusHTML = '';
    if (round.elected && round.elected.length > 0) {
      statusHTML = `<p class="winner-text">Elected: ${round.elected.join(', ')}</p>`;
    }
    if (round.eliminated) {
      statusHTML += `<p class="eliminated-text">Eliminated: ${round.eliminated.join(', ')}</p>`;
    }

    const thresholdText = round.threshold != null ? `Threshold: ${round.threshold}` : 'Final';
    card.innerHTML = `
      <h4>Round ${round.roundNumber} (${thresholdText})</h4>
      ${rankTableHTML}
      ${statusHTML}`;

    container.appendChild(card);
  });
}
