import i18n from '@common/i18n';
import { describe, expect, it, vi } from 'vitest';

describe('common/i18n.get', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns localized message when key exists', () => {
    // Arrange
    vi.spyOn(chrome.i18n, 'getMessage').mockImplementation((key: string) => {
      return key === 'hello' ? 'Hello World' : '';
    });

    // Act
    const result = i18n.get('hello');

    // Assert
    expect(result).toBe('Hello World');
    expect(chrome.i18n.getMessage).toHaveBeenCalledWith('hello', undefined);
  });

  it('passes substitutions through to chrome.i18n.getMessage', () => {
    // Arrange
    vi.spyOn(chrome.i18n, 'getMessage').mockImplementation(
      (key: string, subs?: string | string[]) => {
        if (key === 'greet') {
          const first = Array.isArray(subs) ? subs?.[0] : subs;
          return `Hello, ${first ?? ''}!`;
        }
        return '';
      },
    );

    // Act
    const result = i18n.get('greet', ['User']);

    // Assert
    expect(chrome.i18n.getMessage).toHaveBeenCalledWith('greet', ['User']);
    expect(result).toBe('Hello, User!');
  });

  it('falls back to the key when getMessage returns undefined', () => {
    // Arrange
    vi.spyOn(chrome.i18n, 'getMessage').mockImplementation(() => undefined as unknown as string);

    // Act
    const result = i18n.get('missing.key');

    // Assert
    expect(result).toBe('missing.key');
  });

  it('falls back to the key when getMessage returns empty string', () => {
    // Arrange
    vi.spyOn(chrome.i18n, 'getMessage').mockReturnValue('');

    // Act
    const result = i18n.get('empty.case');

    // Assert
    expect(result).toBe('empty.case');
  });
});
