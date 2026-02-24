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
      const match = header.match(/Please.*?(?:for|of)\s+(?:the\s+)?(.+?)\.\s*-\s*(.+)$/);
      if (!match) return;

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

    // Validate that we found at least one position
    if (Object.keys(positionColumns).length === 0) {
      return { success: false, positions: null, error: 'No valid position columns found in CSV.' };
    }

    // Step 4: Extract ballot data (skip rows 0-2, start from row 3)
    const ballotRows = rows.slice(3).filter(row => row.length > 0);

    if (ballotRows.length === 0) {
      return { success: false, positions: null, error: 'No ballot data found in CSV.' };
    }

    // Step 5: Transform each position
    const positions = [];

    for (const [positionName, columns] of Object.entries(positionColumns)) {
      const candidates = columns.map(c => c.candidateId);
      const ballots = [];

      // Transform each ballot row
      for (const row of ballotRows) {
        const rankings = {}; // candidateId -> rank

        // Extract ranks for this position
        for (const col of columns) {
          const rankValue = row[col.columnIndex];
          if (rankValue && rankValue.trim() !== '') {
            const rank = parseInt(rankValue.trim(), 10);
            if (!isNaN(rank)) {
              rankings[col.candidateId] = rank;
            }
          }
        }

        // Convert rankings object to ordered ballot array
        // Sort by rank value, then extract candidate IDs
        const rankedCandidates = Object.entries(rankings)
          .sort((a, b) => a[1] - b[1]) // Sort by rank (1, 2, 3, ...)
          .map(entry => entry[0]); // Extract candidate IDs

        // Only include ballots with at least one ranking
        if (rankedCandidates.length > 0) {
          ballots.push(rankedCandidates);
        }
      }

      positions.push({
        title: positionName,
        candidates: candidates,
        ballots: ballots
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
