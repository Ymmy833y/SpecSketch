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

export function isRestricted(url?: string): boolean {
  return !url
    || url.startsWith('chrome://')
    || url.startsWith('edge://')
    || url.startsWith('about:')
    || url.startsWith('moz-extension://');
}
