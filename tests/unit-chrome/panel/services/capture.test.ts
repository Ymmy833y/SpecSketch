import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

// ---- Module mocks (declare BEFORE importing SUT) ----
vi.mock('@infra/cdp/cdp_client', () => {
  return {
    attachOwned: vi.fn(async (_target: unknown) => true), // must return boolean so that detach runs
    detachOwned: vi.fn(async (_target: unknown) => undefined),
    send: vi.fn(async (_target: unknown, _method: string, _params?: unknown) => ({})),
  };
});

vi.mock('@common/url', () => ({
  isRestricted: vi.fn((_url?: string) => false),
}));

// ---- Import SUT & mocked modules ----
import { isRestricted } from '@common/url';
import { attachOwned, detachOwned, send } from '@infra/cdp/cdp_client';
import { capture } from '@panel/services/capture';

// Typed mock handles
const attachOwnedMock = vi.mocked(attachOwned);
const detachOwnedMock = vi.mocked(detachOwned);
const sendMock = vi.mocked(send);
const isRestrictedMock = vi.mocked(isRestricted);

// Chrome API typed mocks from setup
type TabsGetPromiseSig = (tabId: number) => Promise<chrome.tabs.Tab>;
type DownloadPromiseSig = (options: chrome.downloads.DownloadOptions) => Promise<number>;

const tabsGetMock = chrome.tabs.get as unknown as MockInstance<TabsGetPromiseSig>;
const downloadMock = chrome.downloads.download as unknown as MockInstance<DownloadPromiseSig>;

const DEFAULT_CONTENT_SIZE = { width: 800, height: 1200 } as const;

describe('panel/services/capture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    attachOwnedMock.mockClear();
    detachOwnedMock.mockClear();
    sendMock.mockClear();
    isRestrictedMock.mockClear();
    tabsGetMock.mockClear();
    downloadMock.mockClear();

    // Default stubs (individual tests can override)
    isRestrictedMock.mockReturnValue(false);
    tabsGetMock.mockResolvedValue({
      id: 1,
      url: 'https://example.com/page',
      title: 'Example / Page: "SpecSketch"? <>| *',
    } as unknown as chrome.tabs.Tab);
    downloadMock.mockResolvedValue(123);
    sendMock.mockImplementation(async (_t, method, _params) => {
      if (method === 'Page.getLayoutMetrics') {
        return {
          cssContentSize: { width: 800, height: 1200 },
          cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: 800, clientHeight: 600 },
        };
      }
      if (method === 'Page.captureScreenshot') {
        return { data: 'BASE64DATA' };
      }
      return {};
    });
  });

  afterEach(() => {
    // Ensure timers are returned to real between tests
    try {
      vi.useRealTimers();
    } catch {
      /* ignore */
    }
  });

  it('returns undefined when URL is restricted', async () => {
    tabsGetMock.mockResolvedValue({
      id: 1,
      url: 'chrome://settings',
      title: 'Settings',
    } as unknown as chrome.tabs.Tab);
    isRestrictedMock.mockReturnValue(true);

    const res = await capture({ tabId: 1, settleMs: 0, contentSize: DEFAULT_CONTENT_SIZE });

    expect(res).toBeUndefined();
    expect(attachOwnedMock).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
  }, 3000);

  it('returns undefined when tab has no id', async () => {
    tabsGetMock.mockResolvedValue({
      id: undefined,
      url: 'https://example.com',
      title: 'NoId',
    } as unknown as chrome.tabs.Tab);

    const res = await capture({ tabId: 999, settleMs: 0, contentSize: DEFAULT_CONTENT_SIZE });

    expect(res).toBeUndefined();
    expect(attachOwnedMock).not.toHaveBeenCalled();
  }, 3000);

  it('captures full page (png, default bringToFront) with device metrics override, then clears & detaches', async () => {
    // We inspect send() calls to assert parameters
    const calls: Array<{ method: string; params?: unknown }> = [];
    sendMock.mockImplementation(async (_t, method, params?: unknown) => {
      calls.push({ method, params });
      if (method === 'Page.getLayoutMetrics') {
        return {
          cssContentSize: { width: 800, height: 1200 },
          cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: 800, clientHeight: 600 },
        };
      }
      if (method === 'Page.captureScreenshot') return { data: 'BASE64DATA' };
      return {};
    });

    // Use fake timers only for the short settle wait to avoid flakiness
    vi.useFakeTimers();
    const p = capture({ tabId: 1, settleMs: 10, contentSize: DEFAULT_CONTENT_SIZE }); // small wait for stability
    await vi.runAllTimersAsync();
    const downloadId = await p;
    vi.useRealTimers();

    expect(downloadId).toBe(123);

    // attach/detach
    expect(attachOwnedMock).toHaveBeenCalledTimes(1);
    expect(detachOwnedMock).toHaveBeenCalledTimes(1);

    // Called sequence essentials
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('Page.enable');
    expect(methods).toContain('Page.bringToFront');
    expect(methods).toContain('Emulation.setDeviceMetricsOverride');
    expect(methods).toContain('Page.captureScreenshot');
    expect(methods).toContain('Emulation.clearDeviceMetricsOverride');

    // Inspect capture params: use contentSize for full-page clip
    const cap = calls.find((c) => c.method === 'Page.captureScreenshot')!;
    const capParams = cap.params as {
      format: string;
      fromSurface: boolean;
      captureBeyondViewport: boolean;
      clip: { x: number; y: number; width: number; height: number; scale: number };
      quality?: number;
    };
    expect(capParams.format).toBe('png');
    expect(capParams.fromSurface).toBe(true);
    expect(capParams.captureBeyondViewport).toBe(true);
    expect(capParams.clip).toEqual({ x: 0, y: 0, width: 800, height: 1200, scale: 1 });

    // downloads: mime/url + filename sanity (no reserved chars, ends with .png)
    expect(downloadMock).toHaveBeenCalledTimes(1);
    const [dlArg] = downloadMock.mock.calls.at(-1)!;
    const opts = dlArg as chrome.downloads.DownloadOptions;

    // Verify opts
    expect(opts.url.startsWith('data:image/png;base64,')).toBe(true);
    expect(opts.filename?.endsWith('.png')).toBe(true);
    expect(/[\\/:*?"<>|]/.test(opts.filename!)).toBe(false);
  }, 5000);

  it('captures viewport (jpeg) without override, clamps quality to 100, bringToFront=false', async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    sendMock.mockImplementation(async (_t, method, params?: unknown) => {
      calls.push({ method, params });
      if (method === 'Page.getLayoutMetrics') {
        return {
          cssVisualViewport: {
            pageX: 10.5,
            pageY: 20.8,
            clientWidth: 640.3,
            clientHeight: 480.2,
          },
        };
      }
      if (method === 'Page.captureScreenshot') return { data: 'BASE64DATA' };
      return {};
    });

    const id = await capture({
      tabId: 1,
      area: 'viewport',
      format: 'jpeg',
      quality: 200, // -> clamp to 100
      scale: 2,
      bringToFront: false,
      settleMs: 0,
      contentSize: DEFAULT_CONTENT_SIZE, // still required by type; unused for viewport
    });

    expect(id).toBe(123);

    const methods = calls.map((c) => c.method);
    expect(methods).toContain('Page.enable');
    expect(methods).not.toContain('Page.bringToFront'); // bringToFront=false
    expect(methods).not.toContain('Emulation.setDeviceMetricsOverride');
    expect(methods).not.toContain('Emulation.clearDeviceMetricsOverride');

    const cap = calls.find((c) => c.method === 'Page.captureScreenshot')!;
    const capParams = cap.params as {
      format: string;
      clip: { x: number; y: number; width: number; height: number; scale: number };
      quality?: number;
    };
    expect(capParams.format).toBe('jpeg');
    expect(capParams.quality).toBe(100); // clamped
    expect(capParams.clip).toEqual({ x: 10, y: 20, width: 641, height: 481, scale: 2 });

    const [dlArg] = downloadMock.mock.calls.at(-1)!;
    expect(dlArg.filename?.endsWith('.jpeg')).toBe(true);
  }, 4000);

  it('always detaches even when an error occurs mid-sequence', async () => {
    sendMock.mockImplementation(async (_t, method) => {
      if (method === 'Page.enable') {
        throw new Error('boom');
      }
      return {};
    });

    await expect(
      capture({ tabId: 1, settleMs: 0, contentSize: DEFAULT_CONTENT_SIZE }),
    ).rejects.toThrow('boom');
    expect(detachOwnedMock).toHaveBeenCalledTimes(1);
  }, 3000);

  it('suppresses errors from Emulation.clearDeviceMetricsOverride and still returns downloadId', async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    sendMock.mockImplementation(async (_t, method, params?: unknown) => {
      calls.push({ method, params });
      if (method === 'Page.getLayoutMetrics') {
        return { cssContentSize: { width: 500, height: 700 } };
      }
      if (method === 'Page.captureScreenshot') return { data: 'BASE64DATA' };
      if (method === 'Emulation.clearDeviceMetricsOverride') {
        throw new Error('ignore-me');
      }
      return {};
    });

    vi.useFakeTimers();
    const p = capture({ tabId: 1, settleMs: 5, contentSize: { width: 500, height: 700 } });
    await vi.runAllTimersAsync();
    const result = await p;
    vi.useRealTimers();

    expect(result).toBe(123);
    expect(detachOwnedMock).toHaveBeenCalledTimes(1);

    const methods = calls.map((c) => c.method);
    expect(methods).toContain('Emulation.setDeviceMetricsOverride');
    expect(methods).toContain('Emulation.clearDeviceMetricsOverride');
  }, 4000);
});
