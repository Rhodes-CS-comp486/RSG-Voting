let lastResult = null;
let electionCount = 0;
let parsedCandidates = [];
let parsedBallots = [];
let inputMode = 'upload'; // 'upload' | 'manual'

function parseElectionFile(text) {
  const lines = text.split('\n').map(l => l.trim());
  const candidates = [];
  const ballots = [];
  let section = null;

  for (const line of lines) {
    if (!line) continue;
    const upper = line.replace(/:$/, '').toUpperCase();
    if (upper === 'CANDIDATES') {
      section = 'candidates';
    } else if (upper === 'BALLOTS') {
      section = 'ballots';
    } else if (section === 'candidates') {
      candidates.push(line);
    } else if (section === 'ballots') {
      const ballot = line.split(',').map(c => c.trim()).filter(Boolean);
      if (ballot.length > 0) ballots.push(ballot);
    }
  }

  return { candidates, ballots };
}

function handleFileLoad(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const { candidates, ballots } = parseElectionFile(text);

    if (candidates.length === 0 && ballots.length === 0) {
      const errBox = document.getElementById('validation-errors');
      errBox.textContent = 'Could not parse any candidates or ballots from the file. Check the file format.';
      errBox.style.display = 'block';
      return;
    }

    parsedCandidates = candidates;
    parsedBallots = ballots;

    // Update drop zone appearance
    document.getElementById('drop-zone').classList.add('has-file');

    // Show preview
    const preview = document.getElementById('file-preview');
    document.getElementById('file-name-display').textContent = file.name;
    document.getElementById('preview-candidates-count').textContent =
      `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}`;
    document.getElementById('preview-ballots-count').textContent =
      `${ballots.length} ballot${ballots.length !== 1 ? 's' : ''}`;

    const list = document.getElementById('preview-candidates-list');
    list.innerHTML = candidates.map(c => `<div>${c}</div>`).join('');

    preview.style.display = 'block';
  };
  reader.readAsText(file);
}

function clearFile() {
  parsedCandidates = [];
  parsedBallots = [];
  document.getElementById('drop-zone').classList.remove('has-file');
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('file-input').value = '';
}

const METHOD_DESCRIPTIONS = {
  irv: 'Instant-Runoff Voting (IRV): Voters rank candidates by preference. If no candidate wins a majority of first-choice votes, the last-place candidate is eliminated and their votes transfer to each ballot\'s next choice. Repeats until a winner is found. For multiple seats, STV (Single Transferable Vote) is used.',
  borda: 'Borda Count: Voters rank candidates, and each position earns points (1st choice gets the most, last gets the fewest). The candidate with the highest total points wins. For multiple seats, the top scorers fill each seat.',
  'preferential-block': 'Preferential Block Voting: Voters rank candidates by preference. For N seats, each ballot counts its top N active preferences (1 vote each). The lowest-ranked candidate is eliminated each round and the next preference slides up to fill the gap, so each voter always has up to N active votes. Elimination continues until N candidates remain. With 1 seat, this is identical to standard IRV.',
};

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function populateMethodDropdown(methods) {
  const select = document.getElementById('voting-method');
  const tooltip = document.getElementById('method-tooltip-text');
  select.innerHTML = '';
  methods.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m.toUpperCase();
    select.appendChild(opt);
  });
  tooltip.textContent = METHOD_DESCRIPTIONS[select.value] || '';
  select.onchange = () => {
    tooltip.textContent = METHOD_DESCRIPTIONS[select.value] || '';
  };
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
    populateMethodDropdown(methods);
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

  // --- Input mode toggle ---
  document.getElementById('mode-upload-btn').addEventListener('click', () => {
    inputMode = 'upload';
    document.getElementById('mode-upload-btn').classList.add('active');
    document.getElementById('mode-manual-btn').classList.remove('active');
    document.getElementById('input-mode-upload').style.display = 'block';
    document.getElementById('input-mode-manual').style.display = 'none';
  });

  document.getElementById('mode-manual-btn').addEventListener('click', () => {
    inputMode = 'manual';
    document.getElementById('mode-manual-btn').classList.add('active');
    document.getElementById('mode-upload-btn').classList.remove('active');
    document.getElementById('input-mode-manual').style.display = 'block';
    document.getElementById('input-mode-upload').style.display = 'none';
  });

  // Drop zone: drag events
  const dropZone = document.getElementById('drop-zone');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  });

  // Drop zone: click to browse
  dropZone.addEventListener('click', (e) => {
    if (!dropZone.classList.contains('has-file')) {
      document.getElementById('file-input').click();
    }
  });

  document.getElementById('browse-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileLoad(file);
  });

  document.getElementById('clear-file-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  document.getElementById('run-election-btn').addEventListener('click', async () => {
    const errBox = document.getElementById('validation-errors');
    errBox.style.display = 'none';

    const title = document.getElementById('election-title').value.trim();
    const method = document.getElementById('voting-method').value;

    let candidates, ballots;

    if (inputMode === 'manual') {
      const candidatesRaw = document.getElementById('candidates-input').value.trim();
      const ballotsRaw = document.getElementById('ballots-input').value.trim();
      candidates = candidatesRaw.split('\n').map(c => c.trim()).filter(Boolean);
      ballots = ballotsRaw.split('\n')
        .map(line => line.split(',').map(c => c.trim()).filter(Boolean))
        .filter(b => b.length > 0);
    } else {
      candidates = parsedCandidates;
      ballots = parsedBallots;
    }

    if (candidates.length === 0 || ballots.length === 0) {
      errBox.textContent = inputMode === 'manual'
        ? 'Please enter at least one candidate and one ballot.'
        : 'Please upload a file with at least one candidate and one ballot.';
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
    clearFile();
    inputMode = 'upload';
    document.getElementById('mode-upload-btn').classList.add('active');
    document.getElementById('mode-manual-btn').classList.remove('active');
    document.getElementById('input-mode-upload').style.display = 'block';
    document.getElementById('input-mode-manual').style.display = 'none';
    document.getElementById('candidates-input').value = '';
    document.getElementById('ballots-input').value = '';
    showView('view-setup');

    const methods = await window.electronAPI.getVotingMethods();
    populateMethodDropdown(methods);
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

  // Rounds / breakdown
  const container = document.getElementById('rounds-container');
  container.innerHTML = '';

  if (result.method === 'borda') {
    displayBordaBreakdown(result, container);
    return;
  }

  if (result.method === 'preferential-block') {
    displayPreferentialBlockBreakdown(result, container);
    return;
  }

  result.rounds.forEach(round => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const eliminatedSet = new Set(round.eliminated || []);

    let rankTableHTML = '';
    if (round.rankDistribution) {
      const candidates = Object.keys(round.rankDistribution).sort((a, b) => {
        const aFirst = round.rankDistribution[a][0] || 0;
        const bFirst = round.rankDistribution[b][0] || 0;
        return bFirst - aFirst;
      });
      const numPositions = Math.max(...candidates.map(c => round.rankDistribution[c].length));

      let headerCells = '<th>Candidate</th>';
      for (let i = 0; i < numPositions; i++) {
        headerCells += `<th>${i + 1}${ordinalSuffix(i + 1)}</th>`;
      }

      let bodyRows = '';
      for (const candidate of candidates) {
        const counts = round.rankDistribution[candidate];
        let cells = `<td class="rank-table-candidate">${candidate}</td>`;
        for (let i = 0; i < numPositions; i++) {
          const count = counts[i] || 0;
          const isFirst = i === 0;
          cells += `<td class="${isFirst ? 'rank-first' : ''}">${count}</td>`;
        }
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

function displayBordaBreakdown(result, container) {
  const scores = result.scores || result.results || {};
  const rankDist = result.rankDistribution || {};
  const winnerSet = new Set(result.winners);

  // Sort candidates by score descending
  const candidates = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const numPositions = candidates.length;

  // Build header row
  let headerCells = '<th>Candidate</th>';
  for (let i = 0; i < numPositions; i++) {
    headerCells += `<th>${i + 1}${ordinalSuffix(i + 1)}</th>`;
  }
  headerCells += '<th class="borda-total-pts-header">Total Points</th>';

  // Build body rows
  let bodyRows = '';
  for (const candidate of candidates) {
    const isWinner = winnerSet.has(candidate);
    const dist = rankDist[candidate] || [];
    let cells = `<td class="rank-table-candidate${isWinner ? ' borda-winner-label' : ''}">${candidate}${isWinner ? ' ★' : ''}</td>`;
    for (let i = 0; i < numPositions; i++) {
      cells += `<td>${dist[i] || 0}</td>`;
    }
    cells += `<td class="borda-total-pts">${scores[candidate]}</td>`;
    const trClass = isWinner ? ' class="borda-winner-row"' : '';
    bodyRows += `<tr${trClass}>${cells}</tr>`;
  }

  const card = document.createElement('div');
  card.className = 'round-card';
  card.innerHTML = `
    <h4>Borda Point Totals</h4>
    <div class="rank-table-wrapper">
      <table class="rank-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  container.appendChild(card);
}

function displayPreferentialBlockBreakdown(result, container) {
  const seats = result.seats;
  const winnerSet = new Set(result.winners);

  result.rounds.forEach((round, idx) => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const electedSet = new Set(round.elected || []);
    const eliminatedSet = new Set(round.eliminated || []);
    const isWinningRound = electedSet.size > 0;

    let rankTableHTML = '';
    if (round.rankDistribution) {
      // Sort by total votes counted this round (descending)
      const candidates = Object.keys(round.rankDistribution).sort((a, b) => {
        return (round.tallies[b] || 0) - (round.tallies[a] || 0);
      });
      const numPositions = Math.max(...candidates.map(c => round.rankDistribution[c].length));

      // Header — highlight the columns that count toward the total
      let headerCells = '<th>Candidate</th>';
      for (let i = 0; i < numPositions; i++) {
        const counted = i < seats;
        headerCells += `<th class="${counted ? 'pbv-counted-header' : ''}">${i + 1}${ordinalSuffix(i + 1)}</th>`;
      }
      headerCells += '<th class="pbv-total-header">Total Counted</th>';

      // Body rows
      let bodyRows = '';
      for (const candidate of candidates) {
        const counts = round.rankDistribution[candidate];
        const isElected = electedSet.has(candidate) || (isWinningRound && winnerSet.has(candidate));
        const isEliminated = eliminatedSet.has(candidate);
        const totalCounted = round.tallies[candidate] || 0;

        const nameClass = `rank-table-candidate${isElected ? ' pbv-winner-label' : ''}`;
        let cells = `<td class="${nameClass}">${candidate}${isElected ? ' ★' : ''}</td>`;
        for (let i = 0; i < numPositions; i++) {
          const count = counts[i] || 0;
          const counted = i < seats;
          cells += `<td class="${counted ? 'rank-first pbv-counted-cell' : ''}">${count}</td>`;
        }
        cells += `<td class="pbv-total-votes">${totalCounted}</td>`;

        let trClass = '';
        if (isEliminated) trClass = ' class="eliminated-row"';
        else if (isElected) trClass = ' class="pbv-winner-row"';
        bodyRows += `<tr${trClass}>${cells}</tr>`;
      }

      const prefLabel = seats === 1 ? 'positions 1–1 counted' : `positions 1–${seats} counted`;
      rankTableHTML = `
        <div class="rank-table-wrapper">
          <h5>Ranking Distribution &nbsp;<span class="pbv-counted-note">(highlighted columns count toward total)</span></h5>
          <table class="rank-table">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>`;
    }

    let statusHTML = '';
    if (isWinningRound) {
      statusHTML = `<p class="winner-text">Elected: ${round.elected.join(', ')}</p>`;
    } else if (eliminatedSet.size > 0) {
      statusHTML = `<p class="eliminated-text">Eliminated: ${round.eliminated.join(', ')}</p>`;
    } else if (result.isTie && idx === result.rounds.length - 1) {
      statusHTML = `<p class="eliminated-text">Tie — remaining seat(s) could not be determined</p>`;
    }

    const thresholdText = round.threshold != null ? `Threshold: ${round.threshold}` : `top ${seats} preference${seats !== 1 ? 's' : ''} per ballot`;
    card.innerHTML = `
      <h4>Round ${round.roundNumber} (${thresholdText})</h4>
      ${rankTableHTML}
      ${statusHTML}`;

    container.appendChild(card);
  });
}
