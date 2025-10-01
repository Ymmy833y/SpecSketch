import { MSG_TYPE } from '@common/messages';
import { pageKey } from '@common/url';

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export function registerActiveTabBroadcast() {
  // Tab switching
  const onActivated = async ({ tabId, windowId }: chrome.tabs.OnActivatedInfo) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      const url = tab?.url;
      const key = url ? pageKey(url) : undefined;
      await chrome.runtime.sendMessage({
        type: MSG_TYPE.ACTIVE_TAB_CHANGED,
        payload: { tabId, windowId, url, pageKey: key },
      });
    } catch {
      /* no-op */
    }
  };

  // Reload/transition detection within the same tab
  const onUpdated = async (
    tabId: number,
    info: chrome.tabs.OnUpdatedInfo,
    tab?: chrome.tabs.Tab,
  ) => {
    if (!tab?.active) return;
    if (info.status === 'loading' || typeof info.url === 'string') {
      try {
        const url = tab.url;
        const key = url ? pageKey(url) : undefined;
        await chrome.runtime.sendMessage({
          type: MSG_TYPE.ACTIVE_TAB_CHANGED,
          payload: { tabId, windowId: tab.windowId!, url, pageKey: key },
        });
      } catch {
        /* no-op */
      }
    }
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
}
