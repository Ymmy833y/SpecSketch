import { isPanelContentPort } from '@common/constants';
import { MSG_TYPE, type PanelToContent } from '@common/messages';
import type { ScreenItem } from '@common/types';

import { buildCssAnchor } from './anchor';
import {
  bindCssSelectorMap,
  clearOverlay,
  highlightOverlay,
  mountOverlay,
  renderItems,
} from './overlay';
import { Selector } from './selector';

const selection = new Selector(onPick);
let port: chrome.runtime.Port | null = null;

// Accepts connections from the Panel. Once connected, initializes the overlay,
// subscribes to messages, and sets up cleanup on disconnect.
chrome.runtime.onConnect.addListener(async (p) => {
  if (!isPanelContentPort(p)) return;
  port = p;
  await mountOverlay();

  // Handles messages from Panel → Content.
  // Processes RPCs such as toggling selection, rendering, and clearing.
  p.onMessage.addListener(async (msg: PanelToContent) => {
    if (!msg?.type) return;
    switch (msg.type) {
      case MSG_TYPE.PING:
        p.postMessage({ id: msg.id, ok: true });
        break;
      case MSG_TYPE.TOGGLE_SELECT:
        selection.setEnabled(!!msg.payload?.enabled);
        break;
      case MSG_TYPE.RENDER: {
        const items = msg.payload.items as ScreenItem[];
        await renderItems(items);
        bindCssSelectorMap(items);
        break;
      }
      case MSG_TYPE.CLEAR:
        await clearOverlay();
        break;
      case MSG_TYPE.HOVER:
        await highlightOverlay(msg.payload.id);
        break;
    }
  });

  // Cleans up on port disconnection.
  // Disables selection and clears the overlay.
  p.onDisconnect.addListener(() => {
    selection.setEnabled(false);
    clearOverlay();
  });
});

/**
 * Called when an element is picked.
 * Builds an anchor and notifies the Panel.
 *
 * @param el - Element confirmed by click
 */
function onPick(el: Element) {
  const anchor = buildCssAnchor(el);
  port?.postMessage({
    type: MSG_TYPE.SELECTED,
    payload: { anchors: [anchor] },
    id: crypto.randomUUID(),
  });
}
