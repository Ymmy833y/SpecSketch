import { ScreenState } from '@common/types';
import { timestamp } from '@common/utils';

type ExportOptions = {
  /** Whether to show the "Save As" dialog. Default: false */
  saveAs?: boolean;
  /** Filename prefix. Default: 'specsketch-screen-state' */
  prefix?: string;
};

/**
 * Exports a {@link ScreenState} as a JSON file and saves
 *
 * The JSON payload includes basic metadata (format/kind/version/exportedAt/pageKey)
 * and the state's `items` for future compatibility and easy re-import.
 *
 * @param state - The screen state to export.
 * @param pageKey - A page key to embed into the exported metadata and to derive the filename.
 * @param opts - Export options (e.g., `saveAs`, `prefix`).
 * @returns A promise resolving to the download ID returned by `chrome.downloads.download`.
 */
export async function exportScreenState(
  state: ScreenState,
  pageKey: string,
  opts: ExportOptions = {},
): Promise<number> {
  const { saveAs = false, prefix = 'specsketch-screen-state' } = opts;

  // Metadata + payload (keep versioning for forward compatibility)
  const payload = {
    format: 'specsketch-export',
    kind: 'screen-state',
    version: 1,
    exportedAt: new Date().toISOString(),
    pageKey,
    items: state.items,
  };

  const json = JSON.stringify(payload, null, 2);
  const base64 = toBase64Utf8(json);
  const mime = 'application/json';
  const url = `data:${mime};charset=utf-8;base64,${base64}`;

  const filename = makeFilename(prefix, pageKey, 'json');

  // Save using the same API pattern as image download
  return await chrome.downloads.download({ url, filename, saveAs });
}

/**
 * Encodes a UTF-8 string to Base64 for use in a data URL.
 *
 * @param text - The UTF-8 text to encode.
 * @returns Base64 string (no data URL prefix).
 */
function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text); // Uint8Array
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}

/**
 * Builds a sanitized filename in the form:
 * `{prefix}_{sanitizedPageKey}_{YYYY-MM-DD_HH-mm-ss+0900}.{ext}`
 *
 * @param prefix - Filename prefix (e.g., product or feature name).
 * @param pageKey - The original page key string to derive a safe filename part.
 * @param ext - File extension without dot (e.g., 'json').
 * @returns A safe filename string.
 */
function makeFilename(prefix: string, pageKey: string, ext: string): string {
  const safeKey =
    (pageKey ?? '')
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'page';
  return `${prefix}_${safeKey}_${timestamp()}.${ext}`;
}
