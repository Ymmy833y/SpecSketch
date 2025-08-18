import i18n from '@common/i18n';
import { type BackgroundToPanel,ContentToPanel, MSG_TYPE } from '@common/messages';
import type { ScreenState } from '@common/types';
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { connectToTab } from '@panel/messaging/connection'
import { captureFullPage } from '@panel/services/capture';
import { getState, handleSelected, setState, updateScreenState } from '@panel/state/store';
import { STATUS } from '@panel/view/status';
import { bindSync, getBadgeColor, getSelectedCaptureFormat, renderList, toggleCaptureOptionsUI, updateBadgeColorUI, updateQualityVisibility, updateStatusUI, updateToggleIconUI } from '@panel/view/ui';

const toggleBtn = document.getElementById('toggle-select') as HTMLButtonElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const captureBtn = document.getElementById('capture') as HTMLButtonElement;

// capture options
const captureOptionsToggleBtn = document.getElementById('capture-options-toggle') as HTMLButtonElement;
const captureFmtRadios = document.querySelectorAll<HTMLInputElement>('input[name="capture-format"]');
const jpegQualityRange = document.getElementById('jpeg-quality-range') as HTMLInputElement;
const jpegQualityNumber = document.getElementById('jpeg-quality-number') as HTMLInputElement;
const captureScaleRange = document.getElementById('capture-scale-range') as HTMLInputElement;
const captureScaleNumber = document.getElementById('capture-scale-number') as HTMLInputElement;

const badgeSizeRange = document.getElementById('badge-size-range') as HTMLInputElement;
const badgeSizeNumber = document.getElementById('badge-size-number') as HTMLInputElement;
const badgeColorPopButtons = document.querySelectorAll<HTMLButtonElement>('#badge-color-pop button');

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
  badgeSizeNumber.value = String(st.defaultSize);
  badgeSizeRange.value = String(st.defaultSize);
  updateBadgeColorUI(st.defaultColor);

  // Toggles selection mode from the Panel and notifies Content.
  toggleBtn.onclick = async () => {
    selectionEnabled = !selectionEnabled;
    updateToggleIconUI(selectionEnabled);
    await conn.api.toggleSelect(selectionEnabled);
  };

  // Clears all selections from storage and the Content overlay.
  clearBtn.onclick = async () => {
    const cleared: ScreenState = {
      items: [],
      nextId: 1,
      nextLabel: 1,
      defaultSize: Number(badgeSizeNumber.value),
      defaultColor: getBadgeColor(),
    };
    await setState(currentPageKey, cleared);
    renderList([]);
    await conn.api.clear();
  };

  // Initiates a full-page screenshot of the current tab and saves it via the Downloads API.
  // Errors are logged to the console without interrupting the UI.
  captureBtn.onclick = async () => {
    try {
      await captureFullPage({
        tabId: currentTabId!,
        format: getSelectedCaptureFormat(),
        quality: Number(jpegQualityNumber.value),
        scale: Number(captureScaleNumber.value),
      });
    } catch (e) {
      console.error('Full capture failed', e);
    }
  };

  captureOptionsToggleBtn.onclick = async () => {
    toggleCaptureOptionsUI(captureOptionsToggleBtn);
  }
  captureFmtRadios.forEach((radio) => {
    radio.addEventListener('change', updateQualityVisibility);
  });
  updateQualityVisibility();
  bindSync(jpegQualityRange, jpegQualityNumber);
  bindSync(captureScaleRange, captureScaleNumber);

  bindSync(badgeSizeRange, badgeSizeNumber);
  badgeSizeRange.addEventListener('change', async() => {
    const newState = await updateScreenState(currentPageKey, Number(badgeSizeNumber.value), undefined);
    renderList(newState.items);
    await conn.api.render(newState.items);
  })
  badgeColorPopButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      updateBadgeColorUI(btn.dataset.colorName ?? '');
      const newState = await updateScreenState(currentPageKey, undefined, getBadgeColor());
      renderList(newState.items);
      await conn.api.render(newState.items);
    });
  });
}
