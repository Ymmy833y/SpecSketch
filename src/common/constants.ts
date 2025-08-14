export const PROTOCOL_VERSION = 1 as const;

export const CHANNEL = {
  PANEL_CONTENT: `spsk:panel-content:v${PROTOCOL_VERSION}`,
} as const;

export type ChannelName = typeof CHANNEL[keyof typeof CHANNEL];

/**
 * Checks whether the given Port.name matches the specified channel.
 * Use this to safely distinguish connection types between Panel and Content.
 *
 * @param port - A connected runtime.Port
 * @param name - Target channel name to compare
 * @returns True if the port belongs to the channel
 */
export function isChannel(port: chrome.runtime.Port, name: ChannelName): boolean {
  return port.name === name;
}

/**
 * Determines whether the port is used for Panel ↔ Content communication.
 * A convenience wrapper for CHANNEL.PANEL_CONTENT.
 *
 * @param port - A connected runtime.Port
 * @returns True if the port is the Panel–Content channel
 */
export function isPanelContentPort(port: chrome.runtime.Port) {
  return isChannel(port, CHANNEL.PANEL_CONTENT);
}
