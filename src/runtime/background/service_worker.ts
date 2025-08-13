// Fired when the extension is installed or updated.
// Configures side panel to open on extension action click.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
