import i18n from '@common/i18n';
import { type BackgroundToPanel,ContentToPanel, MSG_TYPE } from '@common/messages';
import type { ScreenState } from '@common/types';
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { connectToTab } from '@panel/messaging/connection'
import { captureFullPage } from '@panel/services/capture';
import { getState, handleSelected, setState } from '@panel/state/store';
import { STATUS } from '@panel/view/status';
import { renderList, updateStatusUI, updateToggleIconUI } from '@panel/view/ui';

const toggleBtn = document.getElementById('toggle-select') as HTMLButtonElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const captureBtn = document.getElementById('capture') as HTMLButtonElement;

let currentTabId: number | null = null;
let currentPageKey = '';
let selectionEnabled = false;

main().catch(console.error);

/**
 * Orchestrates UI initialization and connection lifecycle.
 * - Apply i18n
 * - Detect and connect to the active tab
 * - Restore state and perform initial render
 * - Bind UI events
 */
async function main() {
  i18n.localize(document);

  const tab = await getActiveTab();
  if (!tab?.id || isRestricted(tab.url)) return updateStatusUI(STATUS.RESTRICTED);
  currentTabId = tab.id!;
  currentPageKey = pageKey(tab.url!);
  updateStatusUI(STATUS.CONNECTING);

  const conn = await connectToTab(currentTabId);
  conn.onDisconnect(() => {
    updateStatusUI(STATUS.DISCONNECTED);
    selectionEnabled = false;
    updateToggleIconUI(selectionEnabled);
  });

  // Receives messages from Content → Panel.
  // Applies selection results (anchors), updates state, and re-renders.
  conn.port.onMessage.addListener(async (msg: ContentToPanel) => {
    if (!msg || !msg.type) return;

    if (msg.type === MSG_TYPE.SELECTED) {
      const newState = await handleSelected(currentPageKey, msg.payload.anchors);
      renderList(newState.items);
      await conn.api.render(newState.items);
    }
  });

  // Receives messages from Background (SW) → Panel.
  chrome.runtime.onMessage.addListener((msg: BackgroundToPanel) => {
    if (msg?.type !== MSG_TYPE.CLOSE_PANEL) return;
    if (currentTabId === null || msg.payload?.tabId === currentTabId) {
      window.close();
    }
  });

  // Restore
  const st = await getState(currentPageKey);
  await conn.api.render(st.items);
  renderList(st.items);
  updateStatusUI(STATUS.CONNECTED);

  // Toggles selection mode from the Panel and notifies Content.
  toggleBtn.onclick = async () => {
    selectionEnabled = !selectionEnabled;
    updateToggleIconUI(selectionEnabled);
    await conn.api.toggleSelect(selectionEnabled);
  };

  // Clears all selections from storage and the Content overlay.
  clearBtn.onclick = async () => {
    const cleared: ScreenState = { items: [], nextId: 1, nextLabel: 1 };
    await setState(currentPageKey, cleared);
    renderList([]);
    await conn.api.clear();
  };

  // Initiates a full-page screenshot of the current tab and saves it via the Downloads API.
  // Errors are logged to the console without interrupting the UI.
  captureBtn.onclick = async () => {
    try {
      await captureFullPage({ tabId: currentTabId! });
    } catch (e) {
      console.error('Full capture failed', e);
    }
  };
}
