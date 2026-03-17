let lastResult = null;
let electionCount = 0;
let parsedCandidates = [];
let parsedBallots = [];
let inputMode = 'upload'; // 'upload' | 'manual'
let loadedPositions = []; // positions accumulated from all uploaded files

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

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
      candidates.push(capitalizeFirst(line));
    } else if (section === 'ballots') {
      const ballot = line.split(',').map(c => capitalizeFirst(c.trim())).filter(Boolean);
      if (ballot.length > 0) ballots.push(ballot);
    }
  }

  return { candidates, ballots };
}

async function handleFileLoad(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const titleFromFile = file.name.replace(/\.[^/.]+$/, ''); // strip extension for default title

    // Try Qualtrics CSV format first (check for "Please" in headers)
    if (text.includes('Please Rank') || text.includes('Please Vote')) {
      const parseResult = await window.electronAPI.parseCSV(text);

      if (parseResult.success && parseResult.positions.length > 0) {
        const positions = parseResult.positions.map(pos => ({
          title: capitalizeFirst(pos.title),
          candidates: pos.candidates.map(capitalizeFirst),
          ballots: pos.ballots.map(ballot => ballot.map(capitalizeFirst)),
          fileName: file.name
        }));
        loadedPositions.push(...positions);
        renderFileList();
        return;
      }
    }

    // Fall back to simple CANDIDATES/BALLOTS format
    const { candidates, ballots } = parseElectionFile(text);

    if (candidates.length === 0 && ballots.length === 0) {
      const errBox = document.getElementById('validation-errors');
      errBox.textContent = `Could not parse any candidates or ballots from "${file.name}". Check the file format.`;
      errBox.style.display = 'block';
      return;
    }

    loadedPositions.push({
      title: capitalizeFirst(titleFromFile),
      candidates,
      ballots,
      fileName: file.name
    });
    renderFileList();
  };
  reader.readAsText(file);
}

function renderFileList() {
  const preview = document.getElementById('file-preview');
  const fileList = document.getElementById('file-list');
  const countEl = document.getElementById('multi-file-count');

  if (loadedPositions.length === 0) {
    preview.style.display = 'none';
    document.getElementById('drop-zone').classList.remove('has-file');
    return;
  }

  preview.style.display = 'block';
  document.getElementById('drop-zone').classList.add('has-file');

  const total = loadedPositions.length;
  countEl.textContent = `${total} position${total !== 1 ? 's' : ''} loaded`;

  fileList.innerHTML = '';
  loadedPositions.forEach((pos, index) => {
    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.innerHTML = `
      <div class="file-list-item-info">
        <span class="file-list-item-title">${escapeHtml(pos.title)}</span>
        <span class="file-list-item-meta">${pos.candidates.length} candidates · ${pos.ballots.length} ballots</span>
        <span class="file-list-item-source">${escapeHtml(pos.fileName)}</span>
      </div>
      <button class="btn-remove-file" type="button" title="Remove">✕</button>
    `;
    item.querySelector('.btn-remove-file').addEventListener('click', () => {
      loadedPositions.splice(index, 1);
      renderFileList();
    });
    fileList.appendChild(item);
  });
}

function clearFile() {
  parsedCandidates = [];
  parsedBallots = [];
  loadedPositions = [];
  document.getElementById('drop-zone').classList.remove('has-file');
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('file-input').value = '';
  // Reset upload trigger: show button, hide drop zone wrapper
  document.getElementById('upload-trigger-area').style.display = 'block';
  document.getElementById('drop-zone-wrapper').style.display = 'none';
}

const METHOD_DESCRIPTIONS = {
  irv: 'Instant-Runoff Voting (IRV): Voters rank candidates by preference. If no candidate wins a majority of first-choice votes, the last-place candidate is eliminated and their votes transfer to each ballot\'s next choice. Repeats until a winner is found. For multiple seats, STV (Single Transferable Vote) is used.',
  borda: 'Borda Count: Voters rank candidates, and each position earns points (1st choice gets the most, last gets the fewest). The candidate with the highest total points wins. For multiple seats, the top scorers fill each seat.',
  'preferential-block': 'Preferential Block Voting: Voters rank candidates by preference. For N seats, each ballot counts its top N active preferences (1 vote each). The lowest-ranked candidate is eliminated each round and the next preference slides up to fill the gap, so each voter always has up to N active votes. Elimination continues until N candidates remain. With 1 seat, this is identical to standard IRV.',
};

const METHOD_DISPLAY_NAMES = {
  irv: 'Ranked Choice (Instant-Runoff)',
  borda: 'Points-Based Ranking (Borda Count)',
  'preferential-block': 'Multi-Seat Ranked Choice (Preferential Block)',
};

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const METHOD_DISPLAY_NAMES = {
  irv: 'Ranked-Choice Voting',
  borda: 'Ranked Point System',
};

function populateMethodDropdown(methods) {
  const select = document.getElementById('voting-method');
  const tooltip = document.getElementById('method-tooltip-text');
  select.innerHTML = '';
  methods
    .filter(m => m !== 'preferential-block')
    .forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = METHOD_DISPLAY_NAMES[m] || m.toUpperCase();
      select.appendChild(opt);
    });
  methods.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = METHOD_DISPLAY_NAMES[m] || m.toUpperCase();
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

  // --- Upload trigger button ---
  document.getElementById('reveal-dropzone-btn').addEventListener('click', () => {
    document.getElementById('upload-trigger-area').style.display = 'none';
    document.getElementById('drop-zone-wrapper').style.display = 'block';
  });

  // --- Input mode toggle ---
  document.getElementById('mode-upload-btn').addEventListener('click', () => {
    inputMode = 'upload';
    document.getElementById('mode-upload-btn').classList.add('active');
    document.getElementById('mode-manual-btn').classList.remove('active');
    document.getElementById('input-mode-upload').style.display = 'block';
    document.getElementById('input-mode-manual').style.display = 'none';
    // Reset upload trigger state
    document.getElementById('upload-trigger-area').style.display = 'block';
    document.getElementById('drop-zone-wrapper').style.display = 'none';
    clearFile();
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
    Array.from(e.dataTransfer.files).forEach(file => handleFileLoad(file));
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
    Array.from(e.target.files).forEach(file => handleFileLoad(file));
    e.target.value = ''; // reset so the same file can be re-selected if cleared
  });

  document.getElementById('add-more-files-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
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

    // --- Upload mode: use loadedPositions ---
    if (inputMode === 'upload') {
      if (loadedPositions.length === 0) {
        errBox.textContent = 'Please upload at least one file.';
        errBox.style.display = 'block';
        return;
      }

      if (loadedPositions.length > 1) {
        await runMultiPositionElection(loadedPositions, method, seats);
        return;
      }

      // Single position from file
      const pos = loadedPositions[0];
      const config = { title: pos.title, candidates: pos.candidates, method, ballots: pos.ballots, seats };
      const response = await window.electronAPI.runElection(config);

      if (response.success) {
        lastResult = response.result;
        electionCount++;
        displayResults(response.result);
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
      return;
    }

    // --- Manual entry mode ---
    const candidatesRaw = document.getElementById('candidates-input').value.trim();
    const ballotsRaw = document.getElementById('ballots-input').value.trim();
    const candidates = candidatesRaw.split('\n').map(c => capitalizeFirst(c.trim())).filter(Boolean);
    const ballots = ballotsRaw.split('\n')
      .map(line => line.split(',').map(c => capitalizeFirst(c.trim())).filter(Boolean))
      .filter(b => b.length > 0);

    if (candidates.length === 0 || ballots.length === 0) {
      errBox.textContent = 'Please enter at least one candidate and one ballot.';
      errBox.style.display = 'block';
      return;
    }

    const config = { title: 'Election', candidates, method, ballots, seats };
    const response = await window.electronAPI.runElection(config);

    if (response.success) {
      lastResult = response.result;
      electionCount++;
      displayResults(response.result);
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

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    // Expand all accordion bodies so they appear in the PDF
    const bodies = document.querySelectorAll('.position-accordion-body');
    const previousStates = Array.from(bodies).map(b => b.style.display);
    bodies.forEach(b => { b.style.display = 'block'; });

    const accordions = document.querySelectorAll('.position-accordion');
    accordions.forEach(a => a.classList.add('expanded'));

    const result = await window.electronAPI.exportPDF();

    // Restore accordion states
    bodies.forEach((b, i) => { b.style.display = previousStates[i]; });
    accordions.forEach((a, i) => {
      if (previousStates[i] === 'none') a.classList.remove('expanded');
    });

    if (!result.success && !result.canceled) {
      alert('Failed to export PDF: ' + result.error);
    }
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
    const electedSet = new Set(round.elected || []);

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
        const isElected = electedSet.has(candidate);
        const crownHTML = isElected ? ' <svg class="winner-crown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg>' : '';
        let cells = `<td class="rank-table-candidate${isElected ? ' borda-winner-label' : ''}">${candidate}${crownHTML}</td>`;
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
    const crownHTML = isWinner ? ' <svg class="winner-crown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg>' : '';
    let cells = `<td class="rank-table-candidate${isWinner ? ' borda-winner-label' : ''}">${candidate}${crownHTML}</td>`;
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
        const crownHTML = isElected ? ' <svg class="winner-crown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg>' : '';
        let cells = `<td class="${nameClass}">${candidate}${crownHTML}</td>`;
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
    const winnerPreview = result.winners && result.winners.length > 0
      ? result.winners.join(', ')
      : 'Tie — Not All Seats Filled';

    const title = result.title
      ? result.title.charAt(0).toUpperCase() + result.title.slice(1)
      : result.title;

    // Accordion card
    const accordion = document.createElement('div');
    accordion.className = 'position-accordion';
    accordion.innerHTML = `
      <div class="position-accordion-header">
        <div class="position-accordion-left">
          <span class="position-accordion-index">${index + 1}</span>
          <span class="position-accordion-title">${title}</span>
        </div>
        <div class="position-accordion-right">
          <span class="position-winner-badge">${winnerPreview}</span>
          <svg class="accordion-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>`;

    // Body — hidden by default
    const body = document.createElement('div');
    body.className = 'position-accordion-body';
    body.style.display = 'none';
    accordion.appendChild(body);

    // Render rounds into the body
    if (result.method === 'irv') {
      displayIRVRounds(result, body);
    } else if (result.method === 'borda') {
      displayBordaResults(result, body);
    } else if (result.method === 'preferential-block') {
      displayPreferentialBlockBreakdown(result, body);
    }

    // Toggle on header click
    accordion.querySelector('.position-accordion-header').addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      accordion.classList.toggle('expanded', isHidden);
    });

    container.appendChild(accordion);
  });
}

// Helper functions to display IRV and Borda results for multi-position
function displayIRVRounds(result, container) {
  result.rounds.forEach(round => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const eliminatedSet = new Set(round.eliminated || []);
    const electedSet = new Set(round.elected || []);

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
        const isElected = electedSet.has(candidate);
        const crownHTML = isElected ? ' <svg class="winner-crown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg>' : '';
        let cells = `<td class="rank-table-candidate${isElected ? ' borda-winner-label' : ''}">${candidate}${crownHTML}</td>`;
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
    const crownHTML = isWinner ? ' <svg class="winner-crown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg>' : '';
    let cells = `<td class="rank-table-candidate ${isWinner ? 'borda-winner' : ''}">${candidate}${crownHTML}</td>`;
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
  return METHOD_DISPLAY_NAMES[method] || method.toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

