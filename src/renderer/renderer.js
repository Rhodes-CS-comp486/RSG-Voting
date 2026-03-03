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

async function handleFileLoad(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;

    // Try Qualtrics CSV format first (check for "Please" in headers)
    if (text.includes('Please Rank') || text.includes('Please Vote')) {
      const parseResult = await window.electronAPI.parseCSV(text);

      if (parseResult.success && parseResult.positions.length > 0) {
        // Store multi-position data globally
        window.csvPositions = parseResult.positions;

        // Update drop zone
        document.getElementById('drop-zone').classList.add('has-file');

        // Show multi-position preview
        const preview = document.getElementById('file-preview');
        document.getElementById('file-name-display').textContent = file.name;
        document.getElementById('preview-candidates-count').textContent =
          `${parseResult.positions.length} position${parseResult.positions.length !== 1 ? 's' : ''}`;
        document.getElementById('preview-ballots-count').textContent =
          `Multi-position election`;

        const list = document.getElementById('preview-candidates-list');
        list.innerHTML = parseResult.positions.map(p =>
          `<div><strong>${p.title}</strong>: ${p.candidates.length} candidates, ${p.ballots.length} ballots</div>`
        ).join('');

        preview.style.display = 'block';
        return;
      }
    }

    // Fall back to simple CANDIDATES/BALLOTS format
    const { candidates, ballots } = parseElectionFile(text);

    if (candidates.length === 0 && ballots.length === 0) {
      const errBox = document.getElementById('validation-errors');
      errBox.textContent = 'Could not parse any candidates or ballots from the file. Check the file format.';
      errBox.style.display = 'block';
      return;
    }

    parsedCandidates = candidates;
    parsedBallots = ballots;
    window.csvPositions = null; // Clear multi-position data

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

  // Populate voting method dropdown on startup
  const methods = await window.electronAPI.getVotingMethods();
  populateMethodDropdown(methods);

  // --- Setup view buttons ---

  document.getElementById('setup-settings-btn').addEventListener('click', () => {
    loadElectionHistory();
    showView('view-settings');
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

    const method = document.getElementById('voting-method').value;
    const seats = parseInt(document.getElementById('seats-input').value, 10) || 1;

    // Check for multi-position Qualtrics CSV data
    if (window.csvPositions && window.csvPositions.length > 0) {
      await runMultiPositionElection(window.csvPositions, method, seats);
      return;
    }

    // Single position election
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

    const config = { title: 'Election', candidates, method, ballots, seats };

    const response = await window.electronAPI.runElection(config);

    if (response.success) {
      lastResult = response.result;
      electionCount++;
      displayResults(response.result);

      // Auto-save election to history
      saveElectionToHistory({
        title: config.title,
        method: config.method,
        seats: config.seats,
        candidates: config.candidates,
        totalBallots: response.result.totalBallots,
        winner: response.result.winner,
        result: response.result
      });

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
    showView('view-setup');
  });

  // --- Settings view buttons ---

  document.getElementById('settings-back-btn').addEventListener('click', () => {
    showView('view-setup');
  });

  document.getElementById('tab-history').addEventListener('click', () => {
    document.getElementById('tab-history').classList.add('active');
    document.getElementById('tab-methods').classList.remove('active');
    document.getElementById('tab-content-history').style.display = 'block';
    document.getElementById('tab-content-methods').style.display = 'none';
  });

  document.getElementById('tab-methods').addEventListener('click', () => {
    document.getElementById('tab-methods').classList.add('active');
    document.getElementById('tab-history').classList.remove('active');
    document.getElementById('tab-content-methods').style.display = 'block';
    document.getElementById('tab-content-history').style.display = 'none';
  });

  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all election history? This cannot be undone.')) {
      localStorage.removeItem('electionHistory');
      loadElectionHistory();
    }
  });
});

function displayResults(result) {
  // Check if multi-position result
  if (result.multiPosition) {
    displayMultiPositionResults(result.results);
    return;
  }

  // Single position display
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

async function runMultiPositionElection(positions, method, seats) {
  const results = [];

  for (const position of positions) {
    const config = {
      title: position.title,
      candidates: position.candidates,
      method: method,
      ballots: position.ballots,
      seats: seats
    };

    const response = await window.electronAPI.runElection(config);

    if (response.success) {
      results.push(response.result);
    } else {
      const errBox = document.getElementById('validation-errors');
      errBox.textContent = `Error in ${position.title}: ${response.error}`;
      errBox.style.display = 'block';
      return;
    }
  }

  electionCount += results.length;

  // Store for "View Results" button
  lastResult = { multiPosition: true, results: results };

  // Display all results
  displayMultiPositionResults(results);
  showView('view-results-page');

  // Clear CSV data
  window.csvPositions = null;
  clearFile();
}

function displayMultiPositionResults(results) {
  // Page title
  document.getElementById('results-title').textContent = 'Multi-Position Election Results';

  // Aggregate stats
  const totalBallots = results.reduce((sum, r) => sum + r.totalBallots, 0);
  const totalCandidates = results.reduce((sum, r) => sum + r.totalCandidates, 0);

  document.getElementById('result-total-ballots').textContent = totalBallots;
  document.getElementById('result-total-candidates').textContent = totalCandidates;

  // Summary of winners per position
  const summaryEl = document.getElementById('result-summary');
  let summaryHTML = '<div class="multi-position-summary">';
  results.forEach(result => {
    const winnerText = result.winners && result.winners.length > 0
      ? result.winners.join(', ')
      : 'Tie - Not All Seats Filled';
    summaryHTML += `<p><strong>${result.title}:</strong> ${winnerText}</p>`;
  });
  summaryHTML += '</div>';
  summaryEl.innerHTML = summaryHTML;

  // Display rounds for each position
  const container = document.getElementById('rounds-container');
  container.innerHTML = '';

  results.forEach((result, index) => {
    // Position header — clickable to expand/collapse rounds
    const header = document.createElement('div');
    header.className = 'position-header';

    const winnerPreview = result.winners && result.winners.length > 0
      ? result.winners.join(', ')
      : 'Tie — Not All Seats Filled';

    header.innerHTML = `
      <div class="position-header-inner">
        <h3>${result.title}</h3>
        <div class="position-header-right">
          <span class="position-winner-preview">Winner: ${winnerPreview}</span>
          <span class="collapse-chevron">&#9660;</span>
        </div>
      </div>`;
    container.appendChild(header);

    // Rounds wrapper — hidden by default
    const roundsWrapper = document.createElement('div');
    roundsWrapper.className = 'position-rounds-wrapper';
    roundsWrapper.style.display = 'none';
    container.appendChild(roundsWrapper);

    // Render rounds into the wrapper (not directly into container)
    if (result.method === 'irv') {
      displayIRVRounds(result, roundsWrapper);
    } else if (result.method === 'borda') {
      displayBordaResults(result, roundsWrapper);
    } else if (result.method === 'preferential-block') {
      displayPreferentialBlockBreakdown(result, roundsWrapper);
    }

    // Toggle rounds on header click
    header.addEventListener('click', () => {
      const isHidden = roundsWrapper.style.display === 'none';
      roundsWrapper.style.display = isHidden ? 'block' : 'none';
      header.classList.toggle('expanded', isHidden);
    });

    // Add divider between positions (except after last)
    if (index < results.length - 1) {
      const divider = document.createElement('hr');
      divider.className = 'position-divider';
      container.appendChild(divider);
    }
  });
}

// Helper functions to display IRV and Borda results for multi-position
function displayIRVRounds(result, container) {
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

function displayBordaResults(result, container) {
  const scores = result.scores || result.results;
  const distribution = result.distribution || {};
  const numBallots = result.totalBallots;
  const numCandidates = result.totalCandidates;

  const sortedEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const winners = result.winners || result.elected || [];
  const winnerSet = new Set(winners);

  let headerCells = '<th>Candidate</th>';
  for (let i = 1; i <= numCandidates; i++) {
    headerCells += `<th>${i}${ordinalSuffix(i)}</th>`;
  }
  headerCells += '<th>Total Points</th>';

  let bodyRows = '';
  for (const [candidate, ] of sortedEntries) {
    const dist = distribution[candidate] || [];
    const isWinner = winnerSet.has(candidate);
    let cells = `<td class="rank-table-candidate ${isWinner ? 'borda-winner' : ''}">${candidate}</td>`;
    for (let i = 1; i <= numCandidates; i++) {
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

// ── Election History Management ────────────────────────────────────────

function saveElectionToHistory(electionData) {
  const history = JSON.parse(localStorage.getItem('electionHistory') || '[]');
  
  const historyEntry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    title: electionData.title || 'Untitled Election',
    method: electionData.method,
    seats: electionData.seats || 1,
    candidates: electionData.candidates || [],
    totalBallots: electionData.totalBallots || 0,
    winner: electionData.winner,
    result: electionData.result
  };

  history.unshift(historyEntry); // Add to beginning
  
  // Keep only last 50 elections
  if (history.length > 50) {
    history.splice(50);
  }

  localStorage.setItem('electionHistory', JSON.stringify(history));
}

function loadElectionHistory() {
  const history = JSON.parse(localStorage.getItem('electionHistory') || '[]');
  renderElectionHistory(history);
}

function renderElectionHistory(history) {
  const container = document.getElementById('election-history-list');
  const noHistoryMsg = document.getElementById('no-history-message');

  if (history.length === 0) {
    container.innerHTML = '';
    noHistoryMsg.style.display = 'block';
    return;
  }

  noHistoryMsg.style.display = 'none';
  container.innerHTML = '';

  history.forEach(election => {
    const card = createHistoryCard(election);
    container.appendChild(card);
  });
}

function createHistoryCard(election) {
  const card = document.createElement('div');
  card.className = 'history-card';
  
  const date = new Date(election.timestamp);
  const formattedDate = date.toLocaleString();
  
  const methodName = getMethodDisplayName(election.method);
  const winnerText = Array.isArray(election.winner) 
    ? election.winner.join(', ') 
    : election.winner || 'No winner determined';

  card.innerHTML = `
    <div class="history-card-header">
      <h4 class="history-card-title">${escapeHtml(election.title)}</h4>
      <span class="history-card-date">${formattedDate}</span>
    </div>
    <div class="history-card-meta">
      <span class="history-method-badge">${methodName}</span>
      <span>📊 ${election.totalBallots} ballots</span>
      <span>👥 ${election.candidates.length} candidates</span>
      ${election.seats > 1 ? `<span>🪑 ${election.seats} seats</span>` : ''}
    </div>
    <div class="history-card-winner">Winner: ${escapeHtml(winnerText)}</div>
    <div class="history-card-details">
      <strong>Candidates:</strong>
      <div class="history-detail-row">${election.candidates.map(c => escapeHtml(c)).join(', ')}</div>
    </div>
  `;

  card.addEventListener('click', () => {
    card.classList.toggle('expanded');
  });

  return card;
}

function getMethodDisplayName(method) {
  const methodNames = {
    'irv': 'Instant Runoff',
    'borda': 'Borda Count',
    'pbv': 'Preferential Block Voting'
  };
  return methodNames[method] || method.toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

