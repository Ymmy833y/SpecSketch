import { type BackgroundToPanel, MSG_TYPE } from '@common/messages';

export const DELIVERY_RESULT = {
  DELIVERED: 'DELIVERED',
  NO_RECEIVER: 'NO_RECEIVER',
  FAILED: 'FAILED',
} as const;

export type DeliveryResult = (typeof DELIVERY_RESULT)[keyof typeof DELIVERY_RESULT];

/**
 * Checks whether a side panel exists for the specified tab.
 *
 * This uses {@link chrome.runtime.getContexts} with `contextTypes: ['SIDE_PANEL']`
 * to determine if the current tab hosts an open side panel.
 *
 * @param tabId - Target tab ID.
 * @returns `true` if we should attempt delivery to the panel; `false` if the panel is definitely not present for the tab.
 */
export async function panelExistsForTab(tabId: number): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getContexts = (chrome.runtime as any)?.getContexts?.bind(chrome.runtime);
  if (!getContexts) return true; // Fallback: assume deliverable when API is unavailable.
  try {
    const ctxs = await getContexts({ contextTypes: ['SIDE_PANEL'], tabId });
    return Array.isArray(ctxs) && ctxs.length > 0;
  } catch {
    return true; // Fallback on errors to maintain legacy "send anyway" behavior.
  }
}

/**
 * Sends a "close panel" request to the side panel associated with the tab,
 * and reports the delivery result as a value.
 *
 * Internally uses {@link chrome.runtime.sendMessage}. If the receiving end does
 * not exist, Chrome rejects the promise; this function maps that case to
 * {@link DELIVERY_RESULT.FAILED} (or {@link DELIVERY_RESULT.NO_RECEIVER} when
 * pre-checked) instead of throwing.
 *
 * @param tabId - Target tab ID.
 * @returns A {@link DeliveryResult} indicating whether the message was delivered,
 * there was no receiver, or delivery failed.
 *
 * @remarks
 * This function intentionally normalizes expected "no receiver" scenarios into
 * return values so callers can branch on outcomes without try/catch noise.
 */
export async function notifyPanelClose(tabId: number): Promise<DeliveryResult> {
  if (!(await panelExistsForTab(tabId))) return DELIVERY_RESULT.NO_RECEIVER;

  const msg: BackgroundToPanel = {
    type: MSG_TYPE.CLOSE_PANEL,
    payload: { tabId },
  };

  try {
    await chrome.runtime.sendMessage(msg); // Rejects if no receiving end.
    return DELIVERY_RESULT.DELIVERED;
  } catch {
    return DELIVERY_RESULT.FAILED;
  }
}
