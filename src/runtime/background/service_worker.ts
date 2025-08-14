import { DELIVERY_RESULT, notifyPanelClose } from '@background/panel_control';

const lastActiveByWindow = new Map<number, number>();

// Fired when the extension is installed or updated.
// Configures side panel to open on extension action click.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * Close the side panel before top-level navigations to avoid BFCache races.
 */
chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, frameId }) => {
  if (frameId !== 0 || tabId === -1) return;

  const res = await notifyPanelClose(tabId);
  if (res !== DELIVERY_RESULT.DELIVERED) {
    console.debug('[bg] close_panel:navigate', tabId, res);
  }
});

// Also hide the side panel when the user switches to another tab.
// We remember the last active tab per window and close its panel when a different tab becomes active in the same window.
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const prev = lastActiveByWindow.get(windowId);
  lastActiveByWindow.set(windowId, tabId);

  // If there was a previously active tab in this window and it's different,
  // ask its panel (if any) to close itself.
  if (prev !== undefined && prev !== tabId) {
    const res = await notifyPanelClose(prev);
    if (res !== DELIVERY_RESULT.DELIVERED) {
      console.debug('[bg] close_panel:tab_switch', prev, res);
    }
  }
});
