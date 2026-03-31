/**
 * CSV Parser for Qualtrics Survey Export
 * Parses ranked-choice ballot data from Qualtrics CSV format
 */

/**
 * Parse a Qualtrics CSV export containing multi-position election data
 * @param {string} csvContent - Raw CSV content as string
 * @returns {Object} - { success: boolean, positions: Array, error: string }
 */
function parseQualtricsCSV(csvContent) {
  try {
    // Step 1: Parse CSV into rows/columns
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 4) {
      return { success: false, positions: null, error: 'CSV file is too short. Expected at least 4 rows.' };
    }

    const rows = lines.map(line => parseCSVLine(line));

    // Step 2: Extract headers (row 2, index 1)
    const headers = rows[1]; // Row 2 contains human-readable headers

    // Step 3: Identify position columns
    // Find columns with ranking questions (contain "Please Rank" or "Please Vote")
    const positionColumns = {};

    headers.forEach((header, colIndex) => {
      // Skip metadata columns (StartDate, EndDate, etc.)
      if (!header.includes('Please')) return;

      // Extract position name and candidate ID from header
      // Format: "Please Rank... Vice President. - VP 1"
      const match = header.match(/Please.*?(?:for|of)\s+(?:the\s+)?(.+?)\.?\s*-\s*(.+)$/);
      if (!match) {
        console.log('[CSV Parser] Header did not match pattern:', header);
        return;
      }

      const [, positionName, candidateId] = match;
      const cleanPosition = positionName.trim();
      const cleanCandidate = candidateId.trim();

      if (!positionColumns[cleanPosition]) {
        positionColumns[cleanPosition] = [];
      }

      positionColumns[cleanPosition].push({
        candidateId: cleanCandidate,
        columnIndex: colIndex
      });
    });

    // Track which column indices are already used by ranking questions
    const usedColIndices = new Set();
    Object.values(positionColumns).forEach(cols => cols.forEach(c => usedColIndices.add(c.columnIndex)));

    // Step 4: Extract ballot data (skip rows 0-2, start from row 3)
    const ballotRows = rows.slice(3).filter(row => row.length > 0);

    if (ballotRows.length === 0) {
      return { success: false, positions: null, error: 'No ballot data found in CSV.' };
    }

    // Detect Yes/No (or any single-choice) vote columns not already handled
    // These are columns where all non-empty values are the same small set of options (e.g. Yes/No)
    const singleChoiceColumns = {};
    headers.forEach((header, colIndex) => {
      if (usedColIndices.has(colIndex)) return;
      if (!header || header.trim() === '') return;

      // Collect unique non-empty values for this column
      const values = ballotRows
        .map(row => row[colIndex] ? row[colIndex].trim() : '')
        .filter(v => v !== '');

      if (values.length === 0) return;

      const uniqueValues = new Set(values.map(v => v.toLowerCase()));

      // Detect Yes/No questions
      const isYesNo = uniqueValues.size <= 4 &&
        [...uniqueValues].every(v => ['yes', 'no', 'y', 'n', 'true', 'false'].includes(v));

      if (isYesNo) {
        singleChoiceColumns[colIndex] = { header, values };
        console.log('[CSV Parser] Yes/No column found:', header, 'col:', colIndex);
      }
    });

    // Validate that we found at least one position
    const allPositionNames = [...Object.keys(positionColumns), ...Object.keys(singleChoiceColumns).map(i => singleChoiceColumns[i].header)];
    console.log('[CSV Parser] Positions found:', allPositionNames);
    if (allPositionNames.length === 0) {
      return { success: false, positions: null, error: 'No valid position columns found in CSV.' };
    }

    // Step 5: Transform each position
    const positions = [];

    // Handle ranking questions (multi-column, numeric rank values)
    for (const [positionName, columns] of Object.entries(positionColumns)) {
      const candidates = columns.map(c => c.candidateId);
      const ballots = [];

      for (const row of ballotRows) {
        const rankings = {};

        for (const col of columns) {
          const rankValue = row[col.columnIndex];
          if (rankValue && rankValue.trim() !== '') {
            const rank = parseInt(rankValue.trim(), 10);
            if (!isNaN(rank)) {
              rankings[col.candidateId] = rank;
            }
          }
        }

        const rankedCandidates = Object.entries(rankings)
          .sort((a, b) => a[1] - b[1])
          .map(entry => entry[0]);

        if (rankedCandidates.length > 0) {
          ballots.push(rankedCandidates);
        }
      }

      positions.push({ title: positionName, candidates, ballots });
    }

    // Handle Yes/No and single-choice columns
    for (const [colIndex, { header, values }] of Object.entries(singleChoiceColumns)) {
      const candidateSet = new Set(values);
      const ballots = values.map(v => [v]);

      positions.push({
        title: header.trim(),
        candidates: Array.from(candidateSet),
        ballots,
        isTally: true
      });
    }

    return { success: true, positions: positions };
  } catch (error) {
    return { success: false, positions: null, error: `CSV parsing error: ${error.message}` };
  }
}

/**
 * Helper function to parse CSV line (handles quoted fields)
 * @param {string} line - A single line from the CSV
 * @returns {Array<string>} - Array of field values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current); // Push last field
  return result;
}

module.exports = {
  parseQualtricsCSV
};
