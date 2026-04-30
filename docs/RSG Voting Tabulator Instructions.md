**RSG Voting Tabulator**

**[Overview]**

This electron built app was created to be able to make the process of
counting election votes easier and more efficient for those responsible
for tabulation. It is specifically designed to be used during student
elections held at Rhodes College which are twice per year. Our goal was
to create a tool that not only improves the current process but also
remains sustainable and usable after we graduate. By implementing this
app, we have significantly reduced both human error and the time
required to count votes. For development, we used Electron for the
frontend along with JavaScript for the backend, since Electron is built
around JavaScript. The app allows you to take CSV files generated from
student responses submitted through Qualtrics forms. From there, users
can customize the vote tabulation process, specify the number of seats
available for each position, and combine votes from multiple ballots
using a dedicated "combine" button within the election preview page.

**[CSV File Format Requirements]**

To ensure the application functions correctly, uploaded CSV files must
follow a consistent structure in order to be read correctly. While the
app is compatible with Qualtrics exports, it is not dependent on
Qualtrics specifically. Any CSV file that follows the format below can
be used:

**File Structure**

The CSV must have exactly 3 header rows followed by voter data rows:

- Row 1: Internal IDs (can contain anything --- the app ignores this
  row)

- Row 2: Column headers --- this is what the app reads to identify
  positions and candidates

- Row 3: Value codes (can contain anything --- the app ignores this row)

- Row 4 and beyond: One row per voter

**Ranked-Choice Elections (President, Vice President, Trustee, etc.)**

Each candidate gets their own column. The header in Row 2 must follow
this exact pattern:

Please Rank for \[Position Name\] - \[Candidate Name\]

Examples:

- Please Rank for President - Alice Johnson

- Please Rank for President - Bob Smith

- Please Rank for Vice President - Carol Davis

- Please Rank for Vice President - David Lee

Cell values in voter rows must be numbers representing the voter\'s
ranking:

- 1 = first choice, 2 = second choice, 3 = third choice, and so on

- Leave the cell blank if the voter did not rank that candidate

**Yes/No Questions (Fee increases, referendums, etc.)**

Use a single column with the question as the header in Row 2. Cell
values must be Yes or No. The app detects these columns automatically
--- no special formatting needed for the header.

Example header: Do you vote to approve the student activity fee
increase?

Example values: Yes, No

**Key Rules**

1.  Ranked-choice headers must include the word \"Please\" followed by
    \"for\" or \"of\", then a dash and the candidate name (e.g., Please
    Rank for President - Candidate Name)

2.  Rank values must be whole numbers (1, 2, 3) --- not words like
    \"First\" or \"1st\"

3.  Multiple positions can exist in the same file --- the app separates
    them automatically by reading the position name from each column
    header

4.  Any columns that do not match these patterns (timestamps, email
    addresses, respondent IDs, etc.) are automatically ignored

5.  Yes/No values are case-insensitive --- \"yes\", \"YES\", and \"Yes\"
    all work

Example Layout:

![](images/media/image7.png)

If you so decide to move on from Qualtrics then the CSV files need to
follow that certain structure in order to ensure the cleanest reading of
the file and the output. So you would have to manually input the
information to fit the expectations. It has to be the same throughout
all the ballots you are trying to put in the election. Here is an image
to further explain what is being said. As you can see the image depicts
the breakdown, so from the top row it is the question number, then the
next row is the question that is being asked. Then the columns so the
answer from everyone that has filled out the form.

**[Instructions]**

1.  You need to download the app through our github repo:
    [[https://github.com/Rhodes-CS-comp486/RSG-Voting/releases]{.underline}](https://github.com/Rhodes-CS-comp486/RSG-Voting/releases)

![](images/media/image1.png)

2.  There are multiple ways to download the app depending on your PC
    Operating System.

> *X's represent the most updated version*

a.  Windows (Red Underline): RSG.Voting.Setup.XXXX.exe file

b.  Mac (White Underline): RSG.Voting-XXXX-arm64.dmg

c.  Intel Mac (Green Underline): RSG.Voting-XXXX.dmg

d.  Windows One Time Download (Orange Underline): RSG.Voting.XXXX.exe

![](images/media/image3.png)

![](images/media/image6.png)

3.  From there you will receive a message warning you, click "Trust" and
    you will have the app downloaded on your desktop.

4.  From there you are taken to a screen where you may either upload the
    CSV files that are needed for the certain election or use the manual
    entry option which could be used for certain testing.

![](images/media/image4.png)

5.  From there decide how you want to run that certain election (3
    options: Multi-Seat Voting(Current), Ranked Choice, or Points-Based
    Voting).

6.  Decide how many seats each election ballot needs and if you want to
    combine the results of a certain ballot as well.

![](images/media/image5.png)

7.  Once you decide how you want the ballots to tabulate, hit "Run
    Election" and it will give different result pages separated from
    tabs (Ex. Combined Ballots, Class of 2026 Ballots, Class of 2025
    Ballots, etc).

![](images/media/image2.png)

8.  You also have the option to download a PDF afterwards to keep for
    your own personal records and documentation.

**[Questions]**

Please contact Dr. Matt Superdock if you have any further questions

Office: Briggs 207

Email:
[[[superdockm@rhodes.edu]{.underline}]{.mark}](mailto:superdockm@rhodes.edu)
