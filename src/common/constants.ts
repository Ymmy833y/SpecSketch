export const PROTOCOL_VERSION = 1 as const;

export const CHANNEL = {
  PANEL_CONTENT: `spsk:panel-content:v${PROTOCOL_VERSION}`,
} as const;

export type ChannelName = typeof CHANNEL[keyof typeof CHANNEL];

export function isChannel(port: chrome.runtime.Port, name: ChannelName): boolean {
  return port.name === name;
}
export function isPanelContentPort(port: chrome.runtime.Port) {
  return isChannel(port, CHANNEL.PANEL_CONTENT);
}
