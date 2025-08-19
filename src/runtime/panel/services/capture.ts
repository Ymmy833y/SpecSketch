import { isRestricted } from '@common/url';
import { attach, type Debuggee, detach, send } from '@infra/cdp/cdp_client';

export type CaptureFormat = 'png' | 'jpeg';

export type CaptureOptions = {
  tabId: number;
  format?: CaptureFormat; // default: png
  quality?: number; // only for jpeg, 0–100
  scale?: number; // image scale factor
  bringToFront?: boolean; // default: true
  filename?: string; // auto-generated when omitted
  settleMs?: number; // layout settle delay (default: 500ms)
};

/**
 * Normalizes a string for safe use as a filename:
 * replaces reserved characters, collapses whitespace, and trims ends.
 *
 * @param s - Raw string to sanitize.
 * @returns Sanitized filename-safe string.
 */
function sanitizeForFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a timestamped filename for the capture based on the tab's title or host.
 * Truncates the base name to 80 characters and appends the proper extension.
 *
 * @param tab - Source tab (title/url used for naming).
 * @param fmt - Target image format ('png' | 'jpeg').
 * @returns A filename like `page-2025-08-13T10-20-30-000Z.png`.
 */
function makeFilename(tab: chrome.tabs.Tab, fmt: CaptureFormat): string {
  const title = tab.title && tab.title.trim() ? tab.title : '';
  let base =
    title ||
    (() => {
      try {
        return new URL(tab.url ?? '').host || 'page';
      } catch {
        return 'page';
      }
    })();

  base = sanitizeForFilename(base);
  if (base.length > 80) base = base.slice(0, 80);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base}-${ts}.${fmt}`;
}

/**
 * Captures a single full-page screenshot (including content beyond the viewport)
 * and saves it via the Downloads API.
 *
 * @param opts - Capture options (tab id, format, quality, scale, etc.).
 * @returns The `downloadId` when saved successfully; `undefined` when capture is skipped.
 */
export async function captureFullPage(opts: CaptureOptions): Promise<number | undefined> {
  const tab = await chrome.tabs.get(opts.tabId);
  if (!tab.id || isRestricted(tab.url)) {
    console.warn('Capturing is not possible due to restricted URL:', tab.url);
    return;
  }

  const target: Debuggee = { tabId: tab.id };
  const fmt: CaptureFormat = opts.format ?? 'png';
  const settleMs = opts.settleMs ?? 500;
  const scale = opts.scale ?? 1;

  await attach(target);

  try {
    await send(target, 'Page.enable');
    if (opts.bringToFront ?? true) {
      await send(target, 'Page.bringToFront');
    }

    // CSS content dimensions of the page
    const lm = await send<{ cssContentSize: { width: number; height: number } }>(
      target,
      'Page.getLayoutMetrics',
    );
    const width = Math.max(1, Math.ceil(lm.cssContentSize?.width ?? 1) | 0);
    const height = Math.max(1, Math.ceil(lm.cssContentSize?.height ?? 1) | 0);

    // Avoid repeated viewport stitching: override viewport to cover the full page
    await send(target, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
      positionX: 0,
      positionY: 0,
    });

    // Scroll to top & wait briefly for layout/image stabilization
    await send(target, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
    await new Promise((r) => setTimeout(r, settleMs));

    // Full-size capture
    const clip = { x: 0, y: 0, width, height, scale };
    const capParams: Record<string, unknown> = {
      format: fmt,
      fromSurface: true,
      captureBeyondViewport: true,
      clip,
    };
    if (fmt === 'jpeg' && typeof opts.quality === 'number') {
      capParams.quality = Math.min(100, Math.max(0, Math.round(opts.quality)));
    }

    const { data } = await send<{ data: string }>(target, 'Page.captureScreenshot', capParams);

    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const url = `data:${mime};base64,${data}`;
    const filename = opts.filename ?? makeFilename(tab, fmt);

    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });
    return downloadId;
  } finally {
    // Clear overridden viewport metrics
    try {
      await send(target, 'Emulation.clearDeviceMetricsOverride');
    } catch {
      /* no-op */
    }
    // Always detach
    try {
      await detach(target);
    } catch {
      /* no-op */
    }
  }
}
