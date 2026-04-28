let lastResult = null;
let electionCount = 0;
let parsedCandidates = [];
let parsedBallots = [];
let inputMode = 'upload'; // 'upload' | 'manual'
let loadedPositions = []; // positions accumulated from all uploaded files
let availableMethods = []; // populated once methods are fetched from main process

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
        const defaultMethod = document.getElementById('voting-method').value;
        const positions = parseResult.positions.map(pos => ({
          title: capitalizeFirst(pos.title),
          candidates: pos.candidates.map(capitalizeFirst),
          ballots: pos.ballots.map(ballot => ballot.map(capitalizeFirst)),
          fileName: file.name,
          method: defaultMethod,
          combine: false
        }));
        loadedPositions.push(...positions);
        renderFileList();
        return;
      }

      // Qualtrics format detected but no positions parsed — could be all empty ballots
      if (parseResult.success && parseResult.positions.length === 0) {
        const errBox = document.getElementById('validation-errors');
        errBox.textContent = `No positions found in "${file.name}". The file may have no candidates listed.`;
        errBox.style.display = 'block';
        return;
      }
    }

    // Fall back to simple CANDIDATES/BALLOTS format
    const { candidates, ballots } = parseElectionFile(text);

    if (candidates.length === 0 && ballots.length === 0) {
      const errBox = document.getElementById('validation-errors');
      errBox.textContent = `Could not parse any candidates or ballots from "${file.name}". The file may be empty or all ballots were blank.`;
      errBox.style.display = 'block';
      return;
    }

    loadedPositions.push({
      title: capitalizeFirst(titleFromFile),
      candidates,
      ballots,
      fileName: file.name,
      method: document.getElementById('voting-method').value,
      combine: false
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

  // --- Pass 1: render combined groups first (at the top, no file headers) ---
  const combinedIndices = new Set(); // all indices absorbed into a combined row
  const seenCombineTitles = new Set();
  let combinedHeaderAdded = false;

  loadedPositions.forEach((pos, index) => {
    if (!pos.combine) return;
    const titleKey = pos.title.toLowerCase();
    if (seenCombineTitles.has(titleKey)) return;
    seenCombineTitles.add(titleKey);

    const groupIndices = loadedPositions.reduce((acc, p, i) => {
      if (p.combine && p.title.toLowerCase() === titleKey) acc.push(i);
      return acc;
    }, []);

    if (groupIndices.length < 2) return; // need at least 2 to combine

    groupIndices.forEach(i => combinedIndices.add(i));

    const leader = loadedPositions[groupIndices[0]];
    groupIndices.forEach(i => {
      loadedPositions[i].method = leader.method;
      loadedPositions[i].seats = leader.seats;
    });

    const fileLabels = groupIndices.map(i => fileGroupLabel(loadedPositions[i].fileName));
    const totalCandidates = new Set(groupIndices.flatMap(i => loadedPositions[i].candidates)).size;
    const totalBallots = groupIndices.reduce((s, i) => s + loadedPositions[i].ballots.length, 0);
    const combinedTitle = `${escapeHtml(pos.title)} (${fileLabels.map(escapeHtml).join(', ')})`;

    const methodOptions = availableMethods.map(m =>
      `<option value="${m}"${m === leader.method ? ' selected' : ''}>${escapeHtml(METHOD_DISPLAY_NAMES[m] || m.toUpperCase())}</option>`
    ).join('');

    if (!combinedHeaderAdded) {
      const header = document.createElement('div');
      header.className = 'file-list-group-header file-list-group-header--combined';
      header.textContent = 'Combined Ballots';
      fileList.appendChild(header);
      combinedHeaderAdded = true;
    }

    const item = document.createElement('div');
    item.className = 'file-list-item file-list-item--combined';
    item.innerHTML = `
      <div class="file-list-item-info">
        <span class="file-list-item-title">${combinedTitle}</span>
        <span class="file-list-item-meta">${totalCandidates} candidates · ${totalBallots} ballots combined</span>
      </div>
      <div class="file-list-item-controls">
        <div class="position-method-control">
          <span class="seats-label">Voting Method</span>
          <select class="position-method-select">${methodOptions}</select>
        </div>
        <div class="seats-control">
          <span class="seats-label">Seats</span>
          <div class="seats-stepper">
            <button class="seats-step-btn" type="button" data-dir="-1">&#8722;</button>
            <span class="seats-value">${leader.seats}</span>
            <button class="seats-step-btn" type="button" data-dir="1">&#43;</button>
          </div>
        </div>
        <button type="button" class="combine-btn combined">Uncombine</button>
      </div>
    `;
    item.querySelector('.position-method-select').addEventListener('change', (e) => {
      groupIndices.forEach(i => { loadedPositions[i].method = e.target.value; });
    });
    item.querySelectorAll('.seats-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir, 10);
        const next = Math.min(10, Math.max(1, loadedPositions[groupIndices[0]].seats + dir));
        groupIndices.forEach(i => { loadedPositions[i].seats = next; });
        item.querySelector('.seats-value').textContent = next;
      });
    });
    item.querySelector('.combine-btn').addEventListener('click', () => {
      groupIndices.forEach(i => { loadedPositions[i].combine = false; });
      renderFileList();
    });
    fileList.appendChild(item);
  });

  // --- Pass 2: render remaining (non-combined) positions grouped by file ---
  let lastFileName = null;
  loadedPositions.forEach((pos, index) => {
    if (!pos.seats) pos.seats = 1;
    if (combinedIndices.has(index)) return;

    if (pos.fileName !== lastFileName) {
      lastFileName = pos.fileName;
      const groupHeader = document.createElement('div');
      groupHeader.className = 'file-list-group-header';
      groupHeader.textContent = fileGroupLabel(pos.fileName);
      fileList.appendChild(groupHeader);
    }

    const methodOptions = availableMethods.map(m =>
      `<option value="${m}"${m === pos.method ? ' selected' : ''}>${escapeHtml(METHOD_DISPLAY_NAMES[m] || m.toUpperCase())}</option>`
    ).join('');

    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.innerHTML = `
      <div class="file-list-item-info">
        <span class="file-list-item-title">${escapeHtml(pos.title)}</span>
        <span class="file-list-item-meta">${pos.candidates.length} candidates · ${pos.ballots.length} ballots</span>
        <span class="file-list-item-source">${escapeHtml(pos.fileName)}</span>
      </div>
      <div class="file-list-item-controls">
        <div class="position-method-control">
          <span class="seats-label">Voting Method</span>
          <select class="position-method-select">${methodOptions}</select>
        </div>
        <div class="seats-control">
          <span class="seats-label">Seats</span>
          <div class="seats-stepper">
            <button class="seats-step-btn" type="button" data-dir="-1">&#8722;</button>
            <span class="seats-value">${pos.seats}</span>
            <button class="seats-step-btn" type="button" data-dir="1">&#43;</button>
          </div>
        </div>
        <button type="button" class="combine-btn">Combine</button>
        <button class="btn-remove-file" type="button" title="Remove">✕</button>
      </div>
    `;
    item.querySelector('.position-method-select').addEventListener('change', (e) => {
      loadedPositions[index].method = e.target.value;
    });
    item.querySelectorAll('.seats-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir, 10);
        const next = Math.min(10, Math.max(1, loadedPositions[index].seats + dir));
        loadedPositions[index].seats = next;
        item.querySelector('.seats-value').textContent = next;
      });
    });
    item.querySelector('.btn-remove-file').addEventListener('click', () => {
      loadedPositions.splice(index, 1);
      renderFileList();
    });
    item.querySelector('.combine-btn').addEventListener('click', () => {
      const titleKey = loadedPositions[index].title.toLowerCase();
      loadedPositions.forEach((p, i) => {
        if (p.title.toLowerCase() === titleKey) loadedPositions[i].combine = true;
      });
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

function populateMethodDropdown(methods) {
  availableMethods = methods;
  const select = document.getElementById('voting-method');
  select.innerHTML = '';
  availableMethods.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = METHOD_DISPLAY_NAMES[m] || m.toUpperCase();
    select.appendChild(opt);
  });
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

  document.getElementById('method-info-btn').addEventListener('click', () => {
    showView('view-methods');
  });

  document.getElementById('methods-back-btn').addEventListener('click', () => {
    showView('view-setup');
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
    document.getElementById('global-method-group').style.display = 'none';
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
    document.getElementById('global-method-group').style.display = 'block';
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

    // --- Upload mode: use loadedPositions ---
    if (inputMode === 'upload') {
      if (loadedPositions.length === 0) {
        errBox.textContent = 'Please upload at least one file.';
        errBox.style.display = 'block';
        return;
      }

      if (loadedPositions.length > 1) {
        await runMultiPositionElection(loadedPositions);
        return;
      }

      // Single position from file
      const pos = loadedPositions[0];
      const seats = pos.seats || 1;
      const config = { title: pos.title, candidates: pos.candidates, method: pos.method || method, ballots: pos.ballots, seats };
      const response = await window.electronAPI.runElection(config);

      if (response.success) {
        lastResult = response.result;
        electionCount++;
        displayResults(response.result);
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

    const seats = parseInt(document.getElementById('manual-seats-input').value, 10) || 1;
    const config = { title: 'Election', candidates, method, ballots, seats };
    const response = await window.electronAPI.runElection(config);

    if (response.success) {
      lastResult = response.result;
      electionCount++;
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

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    if (!lastResult) return;
    const result = await window.electronAPI.generatePDF(lastResult);
    if (!result.success && !result.canceled) {
      alert('Failed to export PDF: ' + result.error);
    }
  });

});

function displayResults(result) {
  // Check if multi-position result
  if (result.multiPosition) {
    displayMultiPositionResults(result.results);
    return;
  }

  // Single position display — restore elements that multi-position may have hidden
  document.getElementById('result-summary').style.display = '';
  document.getElementById('result-stats').style.display = '';
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

  displayIRVRounds(result, container);
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

  const firstRound = result.rounds[0];
  if (firstRound && firstRound.rankDistribution) {
    const initCard = document.createElement('div');
    initCard.className = 'round-card';

    const candidates = Object.keys(firstRound.rankDistribution).sort((a, b) =>
      (firstRound.tallies[b] || 0) - (firstRound.tallies[a] || 0)
    );
    const numPositions = Math.max(...candidates.map(c => firstRound.rankDistribution[c].length));

    let headerCells = '<th>Candidate</th>';
    for (let i = 0; i < numPositions; i++) {
      const counted = i < seats;
      headerCells += `<th class="${counted ? 'pbv-counted-header' : ''}">${i + 1}${ordinalSuffix(i + 1)}</th>`;
    }
    headerCells += '<th class="pbv-total-header">Total Counted</th>';

    let bodyRows = '';
    for (const candidate of candidates) {
      const counts = firstRound.rankDistribution[candidate];
      const totalCounted = firstRound.tallies[candidate] || 0;
      let cells = `<td class="rank-table-candidate">${candidate}</td>`;
      for (let i = 0; i < numPositions; i++) {
        const count = counts[i] || 0;
        const counted = i < seats;
        cells += `<td class="${counted ? 'rank-first pbv-counted-cell' : ''}">${count}</td>`;
      }
      cells += `<td class="pbv-total-votes">${totalCounted}</td>`;
      bodyRows += `<tr>${cells}</tr>`;
    }

    initCard.innerHTML = `
      <h4>Initial Distribution</h4>
      <div class="rank-table-wrapper">
        <h5>Ranking Distribution &nbsp;<span class="pbv-counted-note">(highlighted columns count toward total)</span></h5>
        <table class="rank-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;

    container.appendChild(initCard);
  }

  result.rounds.forEach((round, idx) => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const electedSet = new Set(round.elected || []);
    const eliminatedSet = new Set(round.eliminated || []);
    const isWinningRound = electedSet.size > 0;

    let rankTableHTML = '';
    if (round.rankDistribution) {
      const candidates = Object.keys(round.rankDistribution).sort((a, b) =>
        (round.tallies[b] || 0) - (round.tallies[a] || 0)
      );
      const numPositions = Math.max(...candidates.map(c => round.rankDistribution[c].length));

      let headerCells = '<th>Candidate</th>';
      for (let i = 0; i < numPositions; i++) {
        const counted = i < seats;
        headerCells += `<th class="${counted ? 'pbv-counted-header' : ''}">${i + 1}${ordinalSuffix(i + 1)}</th>`;
      }
      headerCells += '<th class="pbv-total-header">Total Counted</th>';

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

    card.innerHTML = `
      <h4>Round ${round.roundNumber}</h4>
      ${rankTableHTML}
      ${statusHTML}`;

    container.appendChild(card);
  });
}

async function runMultiPositionElection(positions) {
  // --- Combine pass ---
  const combineGroups = new Map(); // lowercase title -> index in effectivePositions
  const effectivePositions = [];

  for (const pos of positions) {
    if (pos.combine) {
      const key = pos.title.toLowerCase();
      if (combineGroups.has(key)) {
        const existing = effectivePositions[combineGroups.get(key)];
        // Merge candidate lists so ballots from all files are valid
        existing.candidates = [...new Set([...existing.candidates, ...pos.candidates])];
        existing.ballots = existing.ballots.concat(pos.ballots);
        existing.combinedFrom.push(pos.fileName);
      } else {
        effectivePositions.push({
          title: pos.title,
          candidates: pos.candidates,
          ballots: [...pos.ballots],
          fileName: pos.fileName,
          method: pos.method,
          seats: pos.seats || 1,
          combinedFrom: [pos.fileName]
        });
        combineGroups.set(key, effectivePositions.length - 1);
      }
    } else {
      effectivePositions.push(pos);
    }
  }

  // A combine group with only one source behaves like a normal position
  for (const pos of effectivePositions) {
    if (pos.combinedFrom && pos.combinedFrom.length === 1) {
      pos.combinedFrom = null;
    }
  }

  // --- Election loop ---
  const results = [];

  for (const position of effectivePositions) {
    const config = {
      title: position.title,
      candidates: position.candidates,
      method: position.method,
      ballots: position.ballots,
      seats: position.seats || 1
    };

    const response = await window.electronAPI.runElection(config);

    if (response.success) {
      response.result.fileName = position.fileName;
      response.result.combinedFrom = position.combinedFrom || null;
      results.push(response.result);
    } else {
      const errBox = document.getElementById('validation-errors');
      errBox.textContent = `Error in ${position.title}: ${response.error}`;
      errBox.style.display = 'block';
      return;
    }
  }

  electionCount += results.length;
  lastResult = { multiPosition: true, results: results };
  displayMultiPositionResults(results);
  showView('view-results-page');
  clearFile();
}

function displayMultiPositionResults(results) {
  document.getElementById('results-title').textContent = 'Election Results';

  // Hide global summary/stats — each tab panel has its own
  document.getElementById('result-summary').style.display = 'none';
  document.getElementById('result-stats').style.display = 'none';

  const container = document.getElementById('rounds-container');
  container.innerHTML = '';

  // Group results by class year / file
  const fileGroups = [];
  const fileMap = new Map();
  results.forEach(result => {
    const key = result.combinedFrom
      ? '__combined__' + result.combinedFrom.slice().sort().join('|')
      : (result.fileName || 'Unknown');
    if (!fileMap.has(key)) {
      const label = result.combinedFrom
        ? 'Combined (' + result.combinedFrom.map(fileGroupLabel).join(', ') + ')'
        : fileGroupLabel(result.fileName || 'Unknown');
      const group = { key, label, results: [] };
      fileGroups.push(group);
      fileMap.set(key, group);
    }
    fileMap.get(key).results.push(result);
  });

  const tabBar = document.createElement('div');
  tabBar.className = 'results-tab-bar';

  const panelsWrapper = document.createElement('div');
  panelsWrapper.className = 'results-tab-panels';

  // ── Class year tabs ──────────────────────────────────────────────────
  fileGroups.forEach((group, index) => {
    const tab = document.createElement('button');
    tab.className = index === 0 ? 'results-tab active' : 'results-tab';
    tab.type = 'button';
    tab.dataset.tabIndex = index;
    tab.innerHTML = `<span class="results-tab-title">${escapeHtml(group.label)}</span>`;
    tabBar.appendChild(tab);

    const panel = document.createElement('div');
    panel.className = index === 0 ? 'results-tab-panel active' : 'results-tab-panel';
    panel.dataset.panelIndex = index;

    group.results.forEach((result, posIdx) => {
      const title = result.title
        ? result.title.charAt(0).toUpperCase() + result.title.slice(1)
        : `Position ${posIdx + 1}`;
      const winnerText = result.winners && result.winners.length > 0
        ? result.winners.join(', ')
        : 'Tie — Not All Seats Filled';

      // Collapsible position section
      const posSection = document.createElement('div');
      posSection.className = 'tab-position-section';

      const posHeader = document.createElement('div');
      posHeader.className = 'tab-position-header';
      posHeader.innerHTML = `
        <div class="tab-position-header-left">
          <span class="tab-position-title">${escapeHtml(title)}</span>
          <span class="tab-position-winner">${escapeHtml(winnerText)}</span>
        </div>
        <svg class="tab-position-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>`;
      posSection.appendChild(posHeader);

      // Collapsible body
      const posBody = document.createElement('div');
      posBody.className = 'tab-position-body';
      posBody.style.display = 'none';

      const statsEl = document.createElement('div');
      statsEl.className = 'result-meta-bar tab-panel-stats';
      statsEl.innerHTML = `
        <span class="result-meta-chip">Ballots: <strong>${result.totalBallots}</strong></span>
        <span class="result-meta-chip">Candidates: <strong>${result.totalCandidates}</strong></span>`;
      posBody.appendChild(statsEl);

      if (result.method === 'irv') {
        displayIRVRounds(result, posBody, { showTotal: true });
      } else if (result.method === 'borda') {
        displayBordaResults(result, posBody);
      } else if (result.method === 'preferential-block') {
        displayPreferentialBlockBreakdown(result, posBody);
      }

      posSection.appendChild(posBody);

      posHeader.addEventListener('click', () => {
        const isHidden = posBody.style.display === 'none';
        posBody.style.display = isHidden ? 'block' : 'none';
        posSection.classList.toggle('expanded', isHidden);
      });

      panel.appendChild(posSection);

      if (posIdx < group.results.length - 1) {
        const divider = document.createElement('hr');
        divider.className = 'tab-position-divider';
        panel.appendChild(divider);
      }
    });

    panelsWrapper.appendChild(panel);
  });

  // Tab switching
  tabBar.addEventListener('click', (e) => {
    const tab = e.target.closest('.results-tab');
    if (!tab) return;
    const idx = tab.dataset.tabIndex;
    tabBar.querySelectorAll('.results-tab').forEach(t => t.classList.remove('active'));
    panelsWrapper.querySelectorAll('.results-tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    panelsWrapper.querySelector(`[data-panel-index="${idx}"]`).classList.add('active');
  });

  container.appendChild(tabBar);
  container.appendChild(panelsWrapper);
}

// Shared renderer for IRV round cards (single- and multi-position).
// showTotal: add a running first-rank total column (used for multi-position display).
function displayIRVRounds(result, container, { showTotal = false } = {}) {
  const firstRound = result.rounds[0];
  if (firstRound && firstRound.rankDistribution) {
    const initCard = document.createElement('div');
    initCard.className = 'round-card';

    const candidates = Object.keys(firstRound.rankDistribution).sort((a, b) =>
      (firstRound.rankDistribution[b][0] || 0) - (firstRound.rankDistribution[a][0] || 0)
    );
    const numPositions = Math.max(...candidates.map(c => firstRound.rankDistribution[c].length));

    let headerCells = '<th>Candidate</th>';
    for (let i = 0; i < numPositions; i++) {
      headerCells += `<th>${i + 1}${ordinalSuffix(i + 1)}</th>`;
    }
    if (showTotal) headerCells += '<th>Total</th>';

    let bodyRows = '';
    for (const candidate of candidates) {
      const counts = firstRound.rankDistribution[candidate];
      let cells = `<td class="rank-table-candidate">${candidate}</td>`;
      let total = 0;
      for (let i = 0; i < numPositions; i++) {
        const count = counts[i] || 0;
        total += count;
        cells += `<td class="${i === 0 ? 'rank-first' : ''}">${count}</td>`;
      }
      if (showTotal) cells += `<td class="rank-total">${total}</td>`;
      bodyRows += `<tr>${cells}</tr>`;
    }

    initCard.innerHTML = `
      <h4>Initial Distribution</h4>
      <div class="rank-table-wrapper">
        <h5>Ranking Distribution</h5>
        <table class="rank-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;

    container.appendChild(initCard);
  }

  result.rounds.forEach(round => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const eliminatedSet = new Set(round.eliminated || []);
    const electedSet = new Set(round.elected || []);

    let rankTableHTML = '';
    if (round.rankDistribution) {
      const candidates = Object.keys(round.rankDistribution).sort((a, b) =>
        (round.rankDistribution[b][0] || 0) - (round.rankDistribution[a][0] || 0)
      );
      const numPositions = Math.max(...candidates.map(c => round.rankDistribution[c].length));

      let headerCells = '<th>Candidate</th>';
      for (let i = 0; i < numPositions; i++) {
        headerCells += `<th>${i + 1}${ordinalSuffix(i + 1)}</th>`;
      }
      if (showTotal) headerCells += '<th>Total</th>';

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
          cells += `<td class="${i === 0 ? 'rank-first' : ''}">${count}</td>`;
        }
        if (showTotal) cells += `<td class="rank-total">${total}</td>`;
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

    card.innerHTML = `
      <h4>Round ${round.roundNumber}</h4>
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


function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function fileGroupLabel(fileName) {
  // Extract class year from "Class of YYYY" → "Class of YYYY Ballot"
  const classMatch = fileName.match(/class\s+of\s+(\d{4})/i);
  if (classMatch) {
    return `Class of ${classMatch[1]} Ballot`;
  }
  // Fall back to filename without extension
  return fileName.replace(/\.[^/.]+$/, '');
}

