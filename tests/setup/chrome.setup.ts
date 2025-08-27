/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi } from 'vitest';

const makePort = (name: string) => ({
  name,
  onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
  postMessage: vi.fn(),
  disconnect: vi.fn(),
});

globalThis.chrome = {
  runtime: {
    id: 'test-ext-id',
    getURL: vi.fn(
      (path: string) => `chrome-extension://test-ext-id/${String(path ?? '').replace(/^\/+/, '')}`,
    ),
    sendMessage: vi.fn(async (_msg: unknown) => undefined),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onConnect: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: {
    query: vi.fn(async () => [{ id: 1, url: 'https://example.com/' }]),
    connect: vi.fn((_tabId: number, info?: { name?: string }) =>
      makePort(info?.name ?? 'content:tab-1'),
    ),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    get: vi.fn(
      async (_tabId: number) =>
        ({
          id: _tabId,
          url: 'https://example.com/',
          title: 'Example',
        }) as unknown as chrome.tabs.Tab,
    ),
  },
  sidePanel: {
    setPanelBehavior: vi.fn(async (_opts: { openPanelOnActionClick: boolean }) => undefined),
  },
  debugger: {
    attach: vi.fn((_t: unknown, _v: string, cb?: () => void) => cb?.()),
    detach: vi.fn((_t: unknown, cb?: () => void) => cb?.()),
    sendCommand: vi.fn((_t: unknown, _m: string, _p?: unknown, cb?: (res?: unknown) => void) =>
      cb?.({}),
    ),
  },
  scripting: {
    executeScript: vi.fn(async (_opts: { target: { tabId: number }; files: string[] }) => []),
  },
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
  },
  i18n: {
    getMessage: vi.fn((_key: string, _subs?: string[]) => ''),
  },
  downloads: {
    download: vi.fn(async (_opts: { url: string; filename?: string; saveAs?: boolean }) => 1),
  },
} as any;

let __lastError__: { message: string } | undefined;
Object.defineProperty(chrome.runtime, 'lastError', {
  configurable: true,
  get() {
    return __lastError__;
  },
});
export function simulateLastError<T>(message: string, fn: () => T): T {
  __lastError__ = { message };
  try {
    return fn();
  } finally {
    __lastError__ = undefined;
  }
}

(globalThis.chrome as any).windows = {
  getCurrent: vi.fn(async () => ({ id: 111 })),
};
