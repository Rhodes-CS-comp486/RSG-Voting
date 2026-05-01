# **RSG-Voting**

An electron app that allows Rhodes Student Government to more accurately count election results



**Instructions:** 

1. You need to download the app through our github repository : https://github.com/Rhodes-CS-comp486/RSG-Voting/releases
2. There are multiple ways to download the app depending on your PC Operating System. 

  X’s represent the most updated version
  
     * Windows: RSG.Voting.Setup.XXXX.exe file
     * Mac: RSG.Voting-XXXX-arm64.dmg
     * Intel Mac: RSG.Voting-XXXX.dmg
     
3. From there you will receive a message warning you, click “Trust” and you will have the app downloaded on your desktop.
4. From there you are taken to a screen where you may either upload the CSV files that are needed for the certain election or use the manual entry option which could be used for certain testing. 
5. From there decide how you want to run that certain election (3 options: Multi-Seat Voting(Current), Ranked Choice, or Points-Based Voting).
6. Decide how many seats each election ballot needs and if you want to combine the results of a certain ballot as well.
7. Once you decide how you want the ballots to tabulate, hit “Run Election” and it will give different result pages separated from tabs (Ex. Combined Ballots, Class of 2026 Ballots, Class of 2025 Ballots, etc).
8. You also have the option to download a PDF afterwards to keep for your own personal records and documentation.


**Please see the following for more in-depth documentation**

# RSG Voting Tabulator

## Overview
This Electron-built app was created to make the process of counting election votes easier and more efficient for those responsible for tabulation. It is specifically designed to be used during student elections held at Rhodes College which are twice per year. Our goal was to create a tool that not only improves the current process but also remains sustainable and usable after we graduate. 

By implementing this app, we have significantly reduced both human error and the time required to count votes. For development, we used Electron for the frontend along with JavaScript for the backend, since Electron is built around JavaScript. The app allows you to take CSV files generated from student responses submitted through Qualtrics forms. From there, users can customize the vote tabulation process, specify the number of seats available for each position, and combine votes from multiple ballots using a dedicated "combine" button within the election preview page.

---

## CSV File Format Requirements

To ensure the application functions correctly, uploaded CSV files must follow a consistent structure in order to be read correctly. While the app is compatible with Qualtrics exports, it is not dependent on Qualtrics specifically. Any CSV file that follows the format below can be used:

### File Structure
The CSV must have exactly 3 header rows followed by voter data rows:
- **Row 1:** Internal IDs (can contain anything — the app ignores this row)
- **Row 2:** Column headers — this is what the app reads to identify positions and candidates
- **Row 3:** Value codes (can contain anything — the app ignores this row)
- **Row 4 and beyond:** One row per voter

### Ranked-Choice Elections (President, Vice President, Trustee, etc.)
Each candidate gets their own column. The header in Row 2 must follow this exact pattern:
Please Rank for [Position Name] - [Candidate Name]

**Examples:**
- `Please Rank for President - Alice Johnson`
- `Please Rank for President - Bob Smith`
- `Please Rank for Vice President - Carol Davis`
- `Please Rank for Vice President - David Lee`

Cell values in voter rows must be numbers representing the voter's ranking:
- `1` = first choice, `2` = second choice, `3` = third choice, and so on
- Leave the cell blank if the voter did not rank that candidate

### Yes/No Questions (Fee increases, referendums, etc.)
Use a single column with the question as the header in Row 2. Cell values must be `Yes` or `No`. The app detects these columns automatically — no special formatting needed for the header.

**Example header:** `Do you vote to approve the student activity fee increase?`  
**Example values:** `Yes`, `No`

### Key Rules
1. Ranked-choice headers must include the word "Please" followed by "for" or "of", then a dash and the candidate name (e.g., `Please Rank for President - Candidate Name`)
2. Rank values must be whole numbers (1, 2, 3) — not words like "First" or "1st"
3. Multiple positions can exist in the same file — the app separates them automatically by reading the position name from each column header
4. Any columns that do not match these patterns (timestamps, email addresses, respondent IDs, etc.) are automatically ignored
5. Yes/No values are case-insensitive — "yes", "YES", and "Yes" all work

### Example Layout

| Row | Column A | Column B | Column C | Column D |
|-----|----------|----------|----------|----------|
| 1 | ResponseId | QID1_1 | QID1_2 | QID2 |
| 2 | Respondent | Please Rank for President - Alice J | Please Rank for President - Bob S | Do you approve the fee increase? |
| 3 | {ImportId} | 1 | 2 | 1 |
| 4 | R_abc123 | 1 | 2 | Yes |
| 5 | R_def456 | 2 | 1 | No |
| 6 | R_ghi789 | 1 |  | Yes |

---

## Installation Instructions

### 1. Download the App
Download from our GitHub releases page:  
**[https://github.com/Rhodes-CS-comp486/RSG-Voting/releases](https://github.com/Rhodes-CS-comp486/RSG-Voting/releases)**

### 2. Choose Your Operating System
Download the appropriate file for your system (X's represent the version number):

- **Windows (Installer):** `RSG.Voting.Setup.XXXX.exe`
- **Mac (Apple Silicon):** `RSG.Voting-XXXX-arm64.dmg`
- **Mac (Intel):** `RSG.Voting-XXXX.dmg`
- **Windows (Portable):** `RSG.Voting.XXXX.exe`

### 3. Install the Application
After downloading, you will receive a security warning. Click **"Trust"** to proceed with installation. The app will be installed on your desktop.

---

## Usage Instructions

### Step 1: Set Up New Election
When you open the app, you'll see the main screen where you can either:
- **Upload CSV files** for the election
- **Use manual entry** for testing purposes

### Step 2: Upload CSV Files
Click **"Upload CSV File"** and select your Qualtrics export or properly formatted CSV file.

### Step 3: Configure Voting Method
Choose how you want to run the election (3 options):
- **Multi-Seat Voting (Current)**
- **Ranked Choice**
- **Points-Based Voting**

### Step 4: Set Seats and Combine Ballots
- Specify **how many seats** are available for each position
- Choose whether to **combine results** from multiple ballot classes

### Step 5: Run Election
Click **"Run Election"** to tabulate the votes.

### Step 6: View Results
Results will appear in separate tabs:
- Combined Ballots
- Class of 2026 Ballots
- Class of 2025 Ballots
- etc.

### Step 7: Download Report
Click **"Download Full Report"** to save a PDF of the election results for your records and documentation.

---

## Questions & Support

For any questions or issues, please contact:

**Dr. Matt Superdock**  
Office: Briggs 207  
Email: [superdockm@rhodes.edu](mailto:superdockm@rhodes.edu)

---

## Technical Details

- **Frontend:** Electron
- **Backend:** JavaScript
- **Compatible with:** Qualtrics CSV exports and any CSV following the specified format
- **Platform:** Windows, macOS (Intel and Apple Silicon)

---

## License

[Add your license information here]

## Contributors

[Add contributor names here]


App Documents:
[App Documents.pdf](https://github.com/user-attachments/files/27262612/App.Documents.pdf)

Developer Instructions:
[Developer Instructions.pdf](https://github.com/user-attachments/files/27262642/Developer.Instructions.pdf)



