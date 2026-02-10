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

  // Add event listeners for buttons
  const startVotingBtn = document.getElementById('start-voting');
  const viewResultsBtn = document.getElementById('view-results');
  const settingsBtn = document.getElementById('settings');

  startVotingBtn.addEventListener('click', () => {
    console.log('Start New Election clicked');
    alert('Election creation feature coming soon!');
    // TODO: Implement election creation UI
  });

  viewResultsBtn.addEventListener('click', () => {
    console.log('View Results clicked');
    alert('Results viewing feature coming soon!');
    // TODO: Implement results viewing UI
  });

  settingsBtn.addEventListener('click', () => {
    console.log('Settings clicked');
    alert('Settings feature coming soon!');
    // TODO: Implement settings UI
  });

  // Initialize the app
  initializeApp();
});

function initializeApp() {
  console.log('Initializing RSG Voting App...');

  // TODO: Load any saved data
  // TODO: Check for updates
  // TODO: Initialize database connection

  console.log('App initialization complete');
}
