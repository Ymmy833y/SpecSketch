import { isRestricted } from '@common/url';
import { attach, type Debuggee, detach, send } from '@infra/cdp/cdp_client';

export type CaptureFormat = 'png' | 'jpeg';
export type CaptureArea = 'full' | 'viewport';

export type CaptureOptions = {
  tabId: number;
  format?: CaptureFormat; // default: png
  area?: CaptureArea; // default: full
  quality?: number; // only for jpeg, 0–100
  scale?: number; // image scale factor
  bringToFront?: boolean; // default: true
  filename?: string; // auto-generated when omitted
  settleMs?: number; // layout settle delay (default: 500ms)
};

// Metrics to pass to Emulation.setDeviceMetricsOverride
type OverrideMetrics = {
  width: number;
  height: number;
  deviceScaleFactor: number;
  mobile: boolean;
  screenWidth: number;
  screenHeight: number;
  positionX: number;
  positionY: number;
};

// Specifying clip for Page.captureScreenshot
type CaptureClip = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

// full/viewport resolution result
type CaptureGeometry =
  | {
      useOverride: false;
      clip: CaptureClip;
      captureBeyondViewport: boolean;
      shouldScrollTop: boolean;
    }
  | {
      useOverride: true;
      metrics: OverrideMetrics; // Required when useOverride is true
      clip: CaptureClip;
      captureBeyondViewport: boolean;
      shouldScrollTop: boolean;
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
 * Returns the page's total scrollable content size in CSS pixels (for full-page capture).
 * @param target - DevTools Protocol target tab (`chrome.debugger.Debuggee`).
 * @returns Promise resolving to `{ width, height }` in CSS pixels.
 */
async function getContentCssSize(target: Debuggee): Promise<{ width: number; height: number }> {
  const lm = await send<{ cssContentSize?: { width: number; height: number } }>(
    target,
    'Page.getLayoutMetrics',
  );
  const width = Math.max(1, Math.ceil(lm.cssContentSize?.width ?? 1) | 0);
  const height = Math.max(1, Math.ceil(lm.cssContentSize?.height ?? 1) | 0);
  return { width, height };
}

/**
 * Returns the current visual viewport rectangle in CSS pixels (for viewport capture).
 * @param target - DevTools Protocol target tab (`chrome.debugger.Debuggee`).
 * @returns Promise resolving to `{ x, y, width, height }` in CSS pixels.
 */
async function getViewportCssRect(target: Debuggee): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const lm = await send<{
    cssVisualViewport: { pageX: number; pageY: number; clientWidth: number; clientHeight: number };
  }>(target, 'Page.getLayoutMetrics');

  const v = lm.cssVisualViewport;
  return {
    x: Math.max(0, Math.floor(v.pageX) | 0),
    y: Math.max(0, Math.floor(v.pageY) | 0),
    width: Math.max(1, Math.ceil(v.clientWidth) | 0),
    height: Math.max(1, Math.ceil(v.clientHeight) | 0),
  };
}

/**
 * Resolves screenshot geometry for the selected capture area.
 * @param target - DevTools Protocol target tab (`chrome.debugger.Debuggee`).
 * @param area - Capture area: `'full'` (entire page) or `'viewport'` (visible area).
 * @param scale - Image scale factor applied to `clip.scale`.
 * @returns `CaptureGeometry` indicating whether to use device metrics override and the `clip` for `Page.captureScreenshot`.
 */
async function resolveGeometry(
  target: Debuggee,
  area: CaptureArea,
  scale: number,
): Promise<CaptureGeometry> {
  if (area === 'viewport') {
    // No override required: Clip the current display area with clip
    const { x, y, width, height } = await getViewportCssRect(target);
    return {
      useOverride: false,
      clip: { x, y, width, height, scale },
      captureBeyondViewport: true,
      shouldScrollTop: false,
    };
  } else {
    // If full size, override and capture all at once
    const { width, height } = await getContentCssSize(target);
    return {
      useOverride: true,
      metrics: {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: width,
        screenHeight: height,
        positionX: 0,
        positionY: 0,
      },
      clip: { x: 0, y: 0, width, height, scale },
      captureBeyondViewport: true,
      shouldScrollTop: true,
    };
  }
}

/**
 * Capture screenshots and save them via the download API.
 *
 * @param opts - Capture options (tab id, format, quality, scale, etc.).
 * @returns The `downloadId` when saved successfully; `undefined` when capture is skipped.
 */
export async function capture(opts: CaptureOptions): Promise<number | undefined> {
  const tab = await chrome.tabs.get(opts.tabId);
  if (!tab.id || isRestricted(tab.url)) {
    console.warn('Capturing is not possible due to restricted URL:', tab.url);
    return;
  }

  const target: Debuggee = { tabId: tab.id };
  const fmt: CaptureFormat = opts.format ?? 'png';
  const settleMs = opts.settleMs ?? 500;
  const scale = opts.scale ?? 1;
  const area: CaptureArea = opts.area ?? 'full';

  await attach(target);

  let usedOverride = false;
  try {
    await send(target, 'Page.enable');
    if (opts.bringToFront ?? true) {
      await send(target, 'Page.bringToFront');
    }

    const geom = await resolveGeometry(target, area, scale);

    if (geom.shouldScrollTop) {
      await send(target, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
    }

    if (geom.useOverride && geom.metrics) {
      usedOverride = true;
      // Scroll to top & wait briefly for layout/image stabilization
      await send(target, 'Emulation.setDeviceMetricsOverride', geom.metrics);
    }

    await new Promise((r) => setTimeout(r, settleMs));

    const capParams: Record<string, unknown> = {
      format: fmt,
      fromSurface: true,
      captureBeyondViewport: geom.captureBeyondViewport,
      clip: geom.clip,
    };
    if (fmt === 'jpeg' && typeof opts.quality === 'number') {
      capParams.quality = Math.min(100, Math.max(0, Math.round(opts.quality)));
    }

    const { data } = await send<{ data: string }>(target, 'Page.captureScreenshot', capParams);

    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const url = `data:${mime};base64,${data}`;
    const filename = opts.filename ?? makeFilename(tab, fmt);

    return await chrome.downloads.download({ url, filename, saveAs: false });
  } finally {
    if (usedOverride) {
      try {
        await send(target, 'Emulation.clearDeviceMetricsOverride');
      } catch {
        /* no-op */
      }
    }
    // Always detach
    try {
      await detach(target);
    } catch {
      /* no-op */
    }
  }
}
