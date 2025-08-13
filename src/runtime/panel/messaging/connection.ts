import { CHANNEL } from '@common/constants';

import { PanelApi } from './api'
import { PortRpc } from './port_rpc';

export type Connection = {
  api: PanelApi;
  port: chrome.runtime.Port;
  rpc: PortRpc;
  onDisconnect(cb: () => void): void;
  dispose(): void;
};

/**
 * Injects the content script into the tab if needed, and
 * initializes the Port connection and RPC for Panel ↔ Content.
 *
 * @param tabId - Target tab id
 * @returns A connection object bundling API, Port, and RPC
 */
export async function connectToTab(tabId: number): Promise<Connection> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/main.js'] }
  ).catch(() => { /* Ignore if already injected */ });

  const port = chrome.tabs.connect(tabId, { name: CHANNEL.PANEL_CONTENT });
  const rpc = new PortRpc(port);
  const api = new PanelApi(rpc);

  const listeners: Array<() => void> = [];
  port.onDisconnect.addListener(() => listeners.forEach(fn => fn()));

  return {
    api, port, rpc,
    onDisconnect: (cb) => listeners.push(cb),
    dispose: () => {
      try { port.disconnect(); } catch { /* no-op */ }
    },
  };
}
