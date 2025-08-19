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
 * Checks if a URL is restricted or should not be operated by the extension.
 * Examples: chrome://, edge://, about:, moz-extension://
 *
 * @param url - URL to check
 * @returns True if the URL is restricted
 */
export function isRestricted(url?: string): boolean {
  return (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('moz-extension://')
  );
}
