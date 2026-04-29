const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createEngine } = require('./voting/index');
const { parseQualtricsCSV } = require('./utils/csvParser');

const engine = createEngine();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'renderer', 'assets', 'RSG_taskbar.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, applications stay active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('voting:get-methods', () => {
  return engine.getAvailableMethods();
});

ipcMain.handle('voting:run-election', (event, config) => {
  try {
    const result = engine.runElection(config);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('voting:validate-ballots', (event, { method, candidates, ballots }) => {
  try {
    const votingMethod = engine.methods.get(method);
    if (!votingMethod) {
      return { valid: false, errors: [`Unknown method: ${method}`] };
    }
    return votingMethod.validate(candidates, ballots);
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
});

ipcMain.handle('voting:parse-csv', (event, csvContent) => {
  try {
    return parseQualtricsCSV(csvContent);
  } catch (error) {
    return { success: false, positions: null, error: error.message };
  }
});

ipcMain.handle('results:generate-pdf', async (event, resultsData) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Election Results as PDF',
    defaultPath: 'election-results.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { success: false, canceled: true };

  const os = require('os');
  const tmpFile = path.join(os.tmpdir(), `rsg-results-${Date.now()}.html`);

  try {
    const html = buildResultsHTML(resultsData);
    fs.writeFileSync(tmpFile, html, 'utf8');

    const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    await printWindow.loadURL(`file://${tmpFile}`);

    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: { top: 0.5, bottom: 0.5, left: 0.6, right: 0.6 }
    });

    printWindow.close();
    fs.unlinkSync(tmpFile);
    fs.writeFileSync(filePath, pdfData);
    return { success: true, filePath };
  } catch (error) {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    return { success: false, error: error.message };
  }
});

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function classLabel(fileName) {
  const m = (fileName || '').match(/class\s+of\s+(\d{4})/i);
  return m ? `Class of ${m[1]}` : (fileName || '').replace(/\.[^/.]+$/, '');
}

function buildRankTable(round, method, { showEliminated = true, showElected = true } = {}) {
  if (!round.rankDistribution) return '';
  const candidates = Object.keys(round.rankDistribution);
  const numCols = Math.max(...candidates.map(c => round.rankDistribution[c].length));
  const electedSet = new Set(round.elected || []);
  const eliminatedSet = new Set(round.eliminated || []);
  let headers = '<th>Candidate</th>';
  for (let i = 0; i < numCols; i++) {
    const sfx = ['th','st','nd','rd'][Math.min(i+1,3)] || 'th';
    headers += `<th>${i+1}${sfx} Choice</th>`;
  }
  if (method === 'irv') headers += '<th>Total</th>';
  let rows = '';
  for (const c of candidates) {
    const counts = round.rankDistribution[c];
    const rowCls = (showElected && electedSet.has(c)) ? ' class="winner-row"'
      : (showEliminated && eliminatedSet.has(c)) ? ' class="elim-row"' : '';
    let cells = `<td>${esc(c)}</td>`;
    let total = 0;
    for (let i = 0; i < numCols; i++) { const v = counts[i] || 0; total += v; cells += `<td>${v}</td>`; }
    if (method === 'irv') cells += `<td><strong>${total}</strong></td>`;
    rows += `<tr${rowCls}>${cells}</tr>`;
  }
  return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function buildInitialDistributionHTML(round, method) {
  return `<div class="round-label">Initial Distribution</div>${buildRankTable(round, method, { showEliminated: false, showElected: false })}`;
}

function buildRoundHTML(round, method) {
  let html = `<div class="round-label">Round ${round.roundNumber}</div>`;
  html += buildRankTable(round, method, { showEliminated: true });
  if (round.elected && round.elected.length) {
    html += `<p class="status elected-line">&#10003; Elected: ${esc(round.elected.join(', '))}</p>`;
  }
  if (round.eliminated && round.eliminated.length) {
    html += `<div class="elim-line"><span class="elim-label">&#10007; Eliminated: ${esc(round.eliminated.join(', '))}</span></div>`;
  }
  return html;
}

function buildPositionHTML(result) {
  const title = result.title || 'Election';
  const winnerText = result.winners && result.winners.length > 0
    ? (result.winners.length === 1 ? result.winners[0] : result.winners.join(', '))
    : 'Tie — Not All Seats Filled';

  let breakdown = '';
  if (result.method === 'borda' && result.scores) {
    const scores = result.scores;
    const sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const winnerSet = new Set(result.winners || []);
    let rows = sorted.map(c => {
      const cls = winnerSet.has(c) ? ' class="winner-row"' : '';
      return `<tr${cls}><td>${esc(c)}</td><td>${scores[c]}</td></tr>`;
    }).join('');
    breakdown = `<table><thead><tr><th>Candidate</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else if (result.rounds && result.rounds.length) {
    breakdown = buildInitialDistributionHTML(result.rounds[0], result.method)
      + result.rounds.map(r => buildRoundHTML(r, result.method)).join('');
  }

  return `
    <div class="position">
      <div class="pos-header">
        <span class="pos-title">${esc(title)}</span>
        <span class="pos-winner">${esc(winnerText)}</span>
      </div>
      <div class="pos-stats">${result.totalBallots} ballots &nbsp;·&nbsp; ${result.totalCandidates} candidates</div>
      ${breakdown}
    </div>`;
}

function buildResultsHTML(data) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let body = '';

  if (data.multiPosition) {
    // Summary list at top
    const summaryRows = data.results.map(r => {
      const title = r.title || 'Unknown';
      const winner = r.winners && r.winners.length > 0 ? r.winners.join(', ') : 'Tie — Not All Seats Filled';
      return `<tr><td class="sum-title">${esc(title)}</td><td class="sum-winner">${esc(winner)}</td></tr>`;
    }).join('');
    body = `<table class="summary-table"><thead><tr><th>Position</th><th>Result</th></tr></thead><tbody>${summaryRows}</tbody></table><hr class="pos-divider">`;

    // Group results by class/file and add headings (combined groups go first)
    const fileGroups = [];
    const fileMap = new Map();

    const hasCombined = data.results.some(r => r.combinedFrom);
    if (hasCombined) {
      const combinedGroup = { label: 'Combined Ballots', results: [], isCombined: true };
      fileMap.set('__combined__', combinedGroup);
      fileGroups.push(combinedGroup);
    }

    data.results.forEach(result => {
      const key = result.combinedFrom ? '__combined__' : (result.fileName || 'Unknown');
      if (!fileMap.has(key)) {
        const group = { label: classLabel(result.fileName || 'Unknown'), results: [] };
        fileMap.set(key, group);
        fileGroups.push(group);
      }
      fileMap.get(key).results.push(result);
    });

    body += fileGroups.map(group => `
      <div class="class-section">
        <div class="class-heading">${esc(group.label)}</div>
        ${group.results.map(buildPositionHTML).join('<hr class="pos-divider">')}
      </div>
    `).join('');
  } else {
    body = buildPositionHTML(data);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;margin:40px;color:#222;font-size:12px;line-height:1.5}
  h1{color:#cc0000;font-size:1.35rem;margin:0 0 2px}
  .date{color:#888;font-size:0.78rem;margin-bottom:24px}
  .class-section{margin-bottom:28px}
  .class-heading{font-size:1rem;font-weight:700;border-bottom:2px solid #cc0000;padding-bottom:4px;margin-bottom:12px}
  .position{margin-bottom:18px;padding-left:10px;border-left:3px solid #f0f0f0}
  .pos-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
  .pos-title{font-weight:700;font-size:0.9rem}
  .pos-winner{color:#cc0000;font-weight:600;font-size:0.82rem}
  .pos-stats{color:#999;font-size:0.72rem;margin-bottom:6px}
  .round-label{font-size:0.75rem;font-weight:700;color:#555;margin:6px 0 2px}
  table{width:100%;border-collapse:collapse;font-size:0.72rem;margin-bottom:4px}
  th{background:#f5f5f5;text-align:left;padding:3px 8px;border:1px solid #ddd;font-weight:600}
  td{padding:3px 8px;border:1px solid #ddd}
  tr.winner-row td{font-weight:700;background:#f0fff4}
  tr.elim-row td{color:#bbb;text-decoration:line-through}
  .elected-line{font-size:0.72rem;color:#28a745;font-weight:600;margin:3px 0}
  .elim-line{border-top:2px solid #cc0000;margin:4px 0 6px;padding-top:3px}
  .elim-label{font-size:0.72rem;color:#cc0000;font-weight:600}
  .pos-divider{border:none;border-top:1px solid #e0e0e0;margin:16px 0}
  .summary-table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:0.72rem}
  .summary-table th{background:#cc0000;color:white;text-align:left;padding:2px 6px;font-weight:600}
  .summary-table td{padding:2px 6px;border-bottom:1px solid #eee}
  .sum-title{font-weight:600;color:#1a1a1a}
  .sum-winner{color:#cc0000;font-weight:500}
</style></head><body>
  <h1>RSG Election Results</h1>
  <p class="date">Generated ${date}</p>
  ${body}
</body></html>`;
}
