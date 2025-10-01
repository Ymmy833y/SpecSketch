/**
 * Builds a page key from a URL. By default excludes the hash and uses
 * origin + pathname + search.
 *
 * @param url - Input URL (returned as-is if invalid)
 * @param includeHash - Whether to include the hash (default: false)
 * @returns Page key string
 */
export function pageKey(url: string, includeHash = false): string {
  try {
    const u = new URL(url);
    return includeHash
      ? `${u.origin}${u.pathname}${u.search}${u.hash}`
      : `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Determines whether a URL should be excluded from extension operation.
 *
 * Unparseable/unknown schemes are treated as restricted.
 * Non-web schemes (e.g., view-source:, data:, blob:, filesystem:) are blocked early.
 * Chrome Web Store pages are always excluded (content scripts are not allowed there).
 *
 * @param raw - URL string to evaluate.
 * @returns `true` if the URL should be skipped by the extension.
 */
export function isRestricted(raw?: string): boolean {
  if (!raw) return true;

  if (
    raw.startsWith('view-source:') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:') ||
    raw.startsWith('filesystem:')
  ) {
    return true;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Invalid or non-standard URL → skip for safety.
    return true;
  }

  // Allow-list policy: only operate on typical web pages.
  const allowed = new Set<string>(['http:', 'https:', 'file:']);
  if (!allowed.has(url.protocol)) {
    return true;
  }

  // Chrome Web Store (current and legacy host) — content scripts are disallowed by platform policy.
  const webStoreHosts = new Set<string>(['chromewebstore.google.com', 'chrome.google.com']);
  if (webStoreHosts.has(url.hostname)) {
    return true;
  }

  return false;
}
