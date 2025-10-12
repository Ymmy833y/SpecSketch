import i18n from '@common/i18n';
import { isValidPayload, payload, ScreenItem, ScreenState } from '@common/types';
import { screenStateTable } from '@panel/storage/tables';

import { applyPatch } from './state';

/**
 * Import a ScreenState-like JSON file and merge its items into the current page.
 *
 * - Only `.json` (by extension) or `application/json` / `text/json` (by MIME) is accepted.
 * - Payload must match the "specsketch-export / screen-state" contract.
 * - Items are merged by **anchor** identity; an imported item is skipped if an item with the
 *   same anchor `{kind, version, value}` already exists in the current page.
 *
 * @param file     A user-selected JSON file that contains export payload.
 * @param pageKey  The target page key to merge into.
 * @returns A promise that resolves to an object containing the updated {@link ScreenState} and a human-readable success message.
 *
 * @throws Error with i18n message `import_file_not_json`
 *         when the file is not recognized as JSON.
 * @throws Error with i18n message `import_payload_invalid`
 *         when the parsed JSON does not satisfy the expected payload contract.
 */
export async function importScreanState(
  file: File,
  pageKey: string,
): Promise<{ state: ScreenState; successMessage: string }> {
  // Validate file type as JSON by extension or MIME (empty MIME is allowed on some browsers).
  const isJsonByExt = /\.json$/i.test(file.name);
  const isJsonByMime =
    file.type === 'application/json' || file.type === 'text/json' || file.type === '';
  if (!isJsonByExt && !isJsonByMime) {
    throw new Error(i18n.get('import_file_not_json'));
  }

  // Parse JSON text → value.
  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    // Treat malformed JSON the same as payload invalid.
    throw new Error(i18n.get('import_payload_invalid'));
  }

  // Validate payload contract: format/kind/version/pageKey/items (items must be array-like ScreenItem).
  if (!isValidPayload(parsed)) {
    throw new Error(i18n.get('import_payload_invalid'));
  }
  const payload = parsed as payload;
  const items = payload.items;

  // Fetch current state (if missing, treat as empty items for comparison).
  const state = await screenStateTable.get(pageKey);
  const existing = state?.items ?? [];

  // Build a fast lookup of existing anchors (identity = kind:version:value).
  const keyOf = (it: ScreenItem) => `${it.anchor.kind}:${it.anchor.version}:${it.anchor.value}`;
  const existingSet = new Set(existing.map(keyOf));

  // Create the minimal patch payload for `applyPatch` — only fields supported by "added".
  const added = items
    .filter((it) => !existingSet.has(keyOf(it)))
    .sort((a, b) => b.id - a.id)
    .map((it) => ({
      anchor: it.anchor,
      size: it.size,
      color: it.color,
      shape: it.shape,
      position: it.position,
      group: it.group,
      comment: it.comment,
    }));

  const newState = await applyPatch(pageKey, { added });
  const successMessage = i18n.get('import_succeeded_with_count', [String(added.length)]);

  return { state: newState, successMessage };
}
