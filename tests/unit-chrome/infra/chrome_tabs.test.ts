import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── dependents used inside the module under test ──
vi.mock('@common/messages', () => ({
  MSG_TYPE: { ACTIVE_TAB_CHANGED: 'ACTIVE_TAB_CHANGED' as const },
}));

vi.mock('@common/url', () => ({
  pageKey: (url: string) => `key:${new URL(url).hostname}`,
}));

import { getActiveTab, registerActiveTabBroadcast } from '@infra/chrome/tabs';

function mockTabsQueryResolveOnce(value: chrome.tabs.Tab[]) {
  const impl = ((_: chrome.tabs.QueryInfo, cb?: (res: chrome.tabs.Tab[]) => void) => {
    if (cb) {
      cb(value);
      return undefined as void;
    }
    return Promise.resolve(value);
  }) as unknown as typeof chrome.tabs.query;

  return vi.spyOn(chrome.tabs, 'query').mockImplementation(impl);
}

function mockTabsQueryRejectOnce(error: unknown) {
  const impl = ((_: chrome.tabs.QueryInfo, cb?: (res: chrome.tabs.Tab[]) => void) => {
    if (cb) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    return Promise.reject(error);
  }) as unknown as typeof chrome.tabs.query;

  return vi.spyOn(chrome.tabs, 'query').mockImplementation(impl);
}

type OnActivatedHandler = (info: chrome.tabs.OnActivatedInfo) => void | Promise<void>;
type OnUpdatedHandler = (
  tabId: number,
  info: chrome.tabs.OnUpdatedInfo,
  tab?: chrome.tabs.Tab,
) => void | Promise<void>;

describe('infra/chrome/tabs', () => {
  describe('getActiveTab', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.clearAllMocks();
    });

    it('returns the first active tab and calls query with correct filter (happy path)', async () => {
      // Arrange
      const tab1 = { id: 101, url: 'https://example.com/a' } as unknown as chrome.tabs.Tab;
      const tab2 = { id: 102, url: 'https://example.com/b' } as unknown as chrome.tabs.Tab;
      const spy = mockTabsQueryResolveOnce([tab1, tab2]);

      // Act
      const result = await getActiveTab();

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(result).toBe(tab1);
    });

    it('returns undefined when active tab list is empty', async () => {
      // Arrange
      const spy = mockTabsQueryResolveOnce([]);

      // Act
      const result = await getActiveTab();

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('propagates errors when chrome.tabs.query rejects', async () => {
      // Arrange
      const spy = mockTabsQueryRejectOnce(new Error('boom'));

      // Act & Assert
      await expect(getActiveTab()).rejects.toThrow('boom');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerActiveTabBroadcast', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.clearAllMocks();
      vi.mocked(chrome.tabs.onActivated.addListener).mockClear();
      vi.mocked(chrome.tabs.onUpdated.addListener).mockClear();
    });

    it('registers listeners for onActivated and onUpdated', () => {
      // Act
      registerActiveTabBroadcast();

      // Assert
      expect(chrome.tabs.onActivated.addListener).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    it('onActivated → queries active tab in window and broadcast ACTIVE_TAB_CHANGED', async () => {
      // Arrange
      registerActiveTabBroadcast();

      const activatedHandler = vi.mocked(chrome.tabs.onActivated.addListener).mock
        .calls[0]?.[0] as OnActivatedHandler;

      const tab = {
        id: 3,
        url: 'https://foo.example.com/path',
        active: true,
        windowId: 200,
      } as unknown as chrome.tabs.Tab;

      const qSpy = mockTabsQueryResolveOnce([tab]);
      const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');

      // Act
      await activatedHandler({ tabId: 3, windowId: 200 });

      // Assert
      expect(qSpy).toHaveBeenCalledWith({ active: true, windowId: 200 });
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'ACTIVE_TAB_CHANGED',
        payload: {
          tabId: 3,
          windowId: 200,
          url: 'https://foo.example.com/path',
          pageKey: 'key:foo.example.com',
        },
      });
    });

    it('onActivated → errors in query are swallowed (no throw, no send)', async () => {
      // Arrange
      registerActiveTabBroadcast();
      const activatedHandler = vi.mocked(chrome.tabs.onActivated.addListener).mock
        .calls[0]?.[0] as OnActivatedHandler;

      mockTabsQueryRejectOnce(new Error('nope'));
      const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');

      // Act
      await expect(activatedHandler({ tabId: 9, windowId: 9 })).resolves.toBeUndefined();

      // Assert
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('onUpdated(status=loading, active=true) → broadcast ACTIVE_TAB_CHANGED', async () => {
      // Arrange
      registerActiveTabBroadcast();
      const updatedHandler = vi.mocked(chrome.tabs.onUpdated.addListener).mock
        .calls[0]?.[0] as OnUpdatedHandler;

      const tab = {
        id: 77,
        active: true,
        url: 'https://bar.example.org/now',
        windowId: 55,
      } as unknown as chrome.tabs.Tab;

      const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');

      // Act
      await updatedHandler(77, { status: 'loading' }, tab);

      // Assert
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'ACTIVE_TAB_CHANGED',
        payload: {
          tabId: 77,
          windowId: 55,
          url: 'https://bar.example.org/now',
          pageKey: 'key:bar.example.org',
        },
      });
    });

    it('onUpdated(info.url is string, active=true) → broadcast ACTIVE_TAB_CHANGED', async () => {
      // Arrange
      registerActiveTabBroadcast();
      const updatedHandler = vi.mocked(chrome.tabs.onUpdated.addListener).mock
        .calls[0]?.[0] as OnUpdatedHandler;

      const tab = {
        id: 88,
        active: true,
        url: 'https://baz.qux.dev/new',
        windowId: 66,
      } as unknown as chrome.tabs.Tab;

      const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');

      // Act
      await updatedHandler(
        88,
        { url: 'https://baz.qux.dev/new' } as chrome.tabs.OnUpdatedInfo,
        tab,
      );

      // Assert
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'ACTIVE_TAB_CHANGED',
        payload: {
          tabId: 88,
          windowId: 66,
          url: 'https://baz.qux.dev/new',
          pageKey: 'key:baz.qux.dev',
        },
      });
    });

    it('onUpdated → inactive tab does nothing', async () => {
      // Arrange
      registerActiveTabBroadcast();
      const updatedHandler = vi.mocked(chrome.tabs.onUpdated.addListener).mock
        .calls[0]?.[0] as OnUpdatedHandler;

      const tab = {
        id: 5,
        active: false,
        url: 'https://ignore.example.net/',
        windowId: 42,
      } as unknown as chrome.tabs.Tab;

      const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');

      // Act
      await updatedHandler(5, { status: 'loading' }, tab);

      // Assert
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });
});
