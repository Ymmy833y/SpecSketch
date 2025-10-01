import { CHANNEL } from '@common/constants';
import { connectToTab } from '@panel/messaging/connection';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('panel/messaging/connection/connectToTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(chrome.scripting.executeScript).mockClear();
    vi.mocked(chrome.tabs.connect).mockClear();
  });

  it('injects content script then connects with PANEL_CONTENT channel', async () => {
    // Arrange
    const exec = vi.mocked(chrome.scripting.executeScript);
    exec.mockResolvedValueOnce();

    const tabId = 123;

    // Act
    const conn = await connectToTab(tabId);

    // Assert
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith({
      target: { tabId },
      files: ['content/main.js'],
    });

    expect(vi.mocked(chrome.tabs.connect)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chrome.tabs.connect)).toHaveBeenCalledWith(tabId, {
      name: CHANNEL.PANEL_CONTENT,
    });

    expect(conn.port.name).toBe(CHANNEL.PANEL_CONTENT);
    expect(conn.api).toBeTruthy();
    expect(conn.rpc).toBeTruthy();
  });

  it('swallows executeScript errors and still connects', async () => {
    // Arrange
    const exec = vi.mocked(chrome.scripting.executeScript);
    exec.mockRejectedValueOnce(new Error('already injected'));

    const tabId = 1;

    // Act
    const conn = await connectToTab(tabId);

    // Assert
    expect(vi.mocked(chrome.tabs.connect)).toHaveBeenCalledWith(tabId, {
      name: CHANNEL.PANEL_CONTENT,
    });
    expect(conn.port).toBeTruthy();
  });

  it('forwards port.onDisconnect to registered listeners', async () => {
    // Arrange
    vi.mocked(chrome.scripting.executeScript).mockResolvedValueOnce();
    const conn = await connectToTab(1);

    const onUserDisconnect = vi.fn();
    conn.onDisconnect(onUserDisconnect);

    const add = vi.mocked(conn.port.onDisconnect.addListener);
    expect(add.mock.calls.length).toBeGreaterThan(0);

    // Act
    for (const [handler] of add.mock.calls) {
      (handler as (p: chrome.runtime.Port) => void)(conn.port);
    }

    // Assert
    expect(onUserDisconnect).toHaveBeenCalledTimes(1);
  });

  it('dispose disconnects the port and does not throw even if disconnect fails', async () => {
    // Arrange
    vi.mocked(chrome.scripting.executeScript).mockResolvedValueOnce();
    const conn = await connectToTab(1);

    const disconnect = vi.mocked(conn.port.disconnect);
    disconnect.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    // Act & Assert
    expect(() => conn.dispose()).not.toThrow();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
