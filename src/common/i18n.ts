const i18n = { get, localize };

/**
 * Retrieves a localized message by key. Falls back to the key itself when not found.
 *
 * @param key - Key defined in _locales/messages.json
 * @param subs - Optional substitution arguments
 * @returns Localized string
 */
function get(key: string, subs?: string[]) {
  return chrome.i18n.getMessage(key, subs) || key;
}

/**
 * Walks the DOM and applies localized strings to elements with
 * `data-i18n` and `data-i18n-attr`.
 *
 * @param root - Root node to localize (defaults to document)
 * @remarks
 * - `data-i18n` replaces `textContent`.
 * - `data-i18n-attr` uses `attr:key;attr:key;...` to set attributes.
 * - Mutates the DOM in place.
 */
function localize(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = get(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    const spec = el.getAttribute('data-i18n-attr');
    if (!spec) return;
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s?.trim());
      if (attr && key) el.setAttribute(attr, get(key));
    }
  });
}

export default i18n;
