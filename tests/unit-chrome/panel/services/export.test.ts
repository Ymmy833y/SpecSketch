import type { ScreenState } from '@common/types';
import { exportScreenState } from '@panel/services/export';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Deterministic timestamp() used by makeFilename
vi.mock('@common/utils', () => ({
  timestamp: () => '2025-10-11_12-34-56+0900',
}));

/**
 * Decode a data URL produced by exportScreenState and parse the JSON payload.
 */
function parseDataUrlJson(dataUrl: string): unknown {
  const idx = dataUrl.indexOf('base64,');
  expect(idx).toBeGreaterThan(-1);
  const b64 = dataUrl.slice(idx + 'base64,'.length);
  const json = Buffer.from(b64, 'base64').toString('utf-8');
  return JSON.parse(json) as unknown;
}

describe('exportScreenState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze Date so exportedAt is stable
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-11T03:45:00.000Z'));
  });

  it('downloads JSON data URL with default options', async () => {
    // Arrange
    const state = { items: [] } as unknown as ScreenState;
    const pageKey = 'https://example.com/';

    // Act
    const id = await exportScreenState(state, pageKey);

    // Assert: return value (download id)
    expect(id).toBe(1);

    // Assert: chrome.downloads.download called once with expected args
    expect(chrome.downloads.download).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(chrome.downloads.download).mock.calls[0]![0];

    // Verify filename (prefix + sanitized key + mocked timestamp + ext)
    expect(arg.filename).toBe('specsketch-screen-state_example.com_2025-10-11_12-34-56+0900.json');

    // Verify saveAs default
    expect(arg.saveAs).toBe(false);

    // Verify data URL JSON content
    const payload = parseDataUrlJson(arg.url as string) as {
      format: string;
      kind: string;
      version: number;
      exportedAt: string;
      pageKey: string;
      items: unknown[];
    };

    expect(payload.format).toBe('specsketch-export');
    expect(payload.kind).toBe('screen-state');
    expect(payload.version).toBe(1);
    expect(payload.pageKey).toBe(pageKey);
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBe(0);
    // exportedAt is taken from Date.now(); we froze the clock above
    expect(payload.exportedAt).toBe('2025-10-11T03:45:00.000Z');
  });

  it('respects custom options (prefix and saveAs)', async () => {
    // Arrange
    const state = { items: [] } as unknown as ScreenState;
    const pageKey = 'https://example.com/';

    // Act
    await exportScreenState(state, pageKey, { saveAs: true, prefix: 'myexport' });

    // Assert
    expect(chrome.downloads.download).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(chrome.downloads.download).mock.calls[0]![0];

    expect(arg.saveAs).toBe(true);
    expect(arg.filename).toBe('myexport_example.com_2025-10-11_12-34-56+0900.json');
  });

  it('sanitizes pageKey into a safe filename', async () => {
    // Arrange
    const state = { items: [] } as unknown as ScreenState;
    const pageKey = 'http://host.name/a b/c?x=1&y=2#zz';

    // Act
    await exportScreenState(state, pageKey);

    // Assert
    const arg = vi.mocked(chrome.downloads.download).mock.calls[0]![0];
    // protocol removed, non [a-zA-Z0-9._-] replaced by '-', collapsed, trimmed
    const expectedKey = 'host.name-a-b-c-x-1-y-2-zz';
    expect(arg.filename).toBe(
      `specsketch-screen-state_${expectedKey}_2025-10-11_12-34-56+0900.json`,
    );
  });

  it("falls back to 'page' when sanitized key becomes empty", async () => {
    // Arrange
    const state = { items: [] } as unknown as ScreenState;
    const pageKey = ''; // becomes empty -> fallback to 'page'

    // Act
    await exportScreenState(state, pageKey);

    // Assert
    const arg = vi.mocked(chrome.downloads.download).mock.calls[0]![0];
    expect(arg.filename).toBe('specsketch-screen-state_page_2025-10-11_12-34-56+0900.json');
  });
});
