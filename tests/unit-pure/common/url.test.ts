import { isRestricted, pageKey } from '@common/url';
import { describe, expect, it } from 'vitest';

describe('common/url', () => {
  describe('pageKey', () => {
    it('returns origin+pathname+search without hash by default', () => {
      // Arrange
      const url = 'https://example.com/path/to?p=1#section';
      // Act
      const key = pageKey(url);
      // Assert
      expect(key).toBe('https://example.com/path/to?p=1');
    });

    it('includes hash when includeHash = true', () => {
      // Arrange
      const url = 'https://example.com/path?p=1#sec';
      // Act
      const key = pageKey(url, true);
      // Assert
      expect(key).toBe('https://example.com/path?p=1#sec');
    });

    it('returns input as-is when URL is invalid', () => {
      // Arrange
      const input = 'not a url';
      // Act
      const key = pageKey(input);
      // Assert
      expect(key).toBe(input);
    });

    it('keeps trailing slash for bare origins', () => {
      // Arrange
      const url = 'https://example.com';
      // Act
      const key = pageKey(url);
      // Assert
      expect(key).toBe('https://example.com/');
    });

    it('preserves query parameter order', () => {
      // Arrange
      const url = 'https://example.com/a?b=2&a=1#x';
      // Act
      const key = pageKey(url);
      // Assert
      expect(key).toBe('https://example.com/a?b=2&a=1');
    });
  });

  describe('isRestricted', () => {
    it('returns true for undefined or empty string', () => {
      // Arrange / Act / Assert
      expect(isRestricted()).toBe(true);
      expect(isRestricted('')).toBe(true);
    });

    it('returns true when URL parsing fails (invalid/non-standard)', () => {
      // Arrange / Act / Assert
      expect(isRestricted('not a url')).toBe(true);
      expect(isRestricted('http://')).toBe(true); // missing host → URL() throws
    });

    it('flags restricted URL schemes (chrome, edge, about, moz-extension)', () => {
      // Arrange / Act / Assert
      expect(isRestricted('chrome://extensions')).toBe(true);
      expect(isRestricted('edge://settings')).toBe(true);
      expect(isRestricted('about:blank')).toBe(true);
      expect(isRestricted('moz-extension://abc')).toBe(true);
    });

    it('flags special non-web schemes (view-source, data, blob, filesystem)', () => {
      // Arrange / Act / Assert
      expect(isRestricted('view-source:https://example.com')).toBe(true);
      expect(isRestricted('data:text/plain,hello')).toBe(true);
      expect(isRestricted('blob:https://example.com/uuid')).toBe(true);
      expect(isRestricted('filesystem:https://example.com/temporary/abc')).toBe(true);
    });

    it('allows common web schemes http/https/file', () => {
      // Arrange / Act / Assert
      expect(isRestricted('https://example.com')).toBe(false);
      expect(isRestricted('http://example.com')).toBe(false);
      expect(isRestricted('file:///C:/temp.txt')).toBe(false);
    });

    it('blocks Chrome Web Store hosts', () => {
      // Arrange / Act / Assert
      expect(isRestricted('https://chromewebstore.google.com/detail/xxxx')).toBe(true);
      expect(isRestricted('https://chrome.google.com/webstore/detail/xxxx')).toBe(true);
    });

    it('treats uppercase schemes as restricted (URL parsing normalizes the scheme)', () => {
      // Arrange / Act / Assert
      expect(isRestricted('CHROME://extensions')).toBe(true);
    });
  });
});
