import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module mock (declare BEFORE importing SUT) ----
vi.mock('@common/i18n', () => {
  return {
    default: {
      get: vi.fn<(key: string) => string>(),
    },
  };
});

import i18n from '@common/i18n';
import { getStatusMessage, STATUS, STATUS_CLASS_BY_KEY, type StatusKey } from '@panel/types/status';

const getMock = vi.mocked(i18n.get);

const EXPECTED_MSG_KEY: Record<StatusKey, string> = {
  RESTRICTED: 'status_restricted',
  CONNECTING: 'status_connecting',
  CONNECTED: 'status_connected',
  DISCONNECTED: 'status_disconnected',
};

const EXPECTED_CLASS_BY_KEY: Record<StatusKey, string> = {
  RESTRICTED: 'connect-status--restricted',
  CONNECTING: 'connect-status--connecting',
  CONNECTED: 'connect-status--connected',
  DISCONNECTED: 'connect-status--disconnected',
};

const ALL_KEYS = Object.values(STATUS) as StatusKey[];

describe('panel/types/status', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('returns localized message when i18n provides a value', () => {
    // Arrange
    getMock.mockImplementation((key) => `__${key}__`);

    // Act
    const msg = getStatusMessage('CONNECTED');

    // Assert
    expect(msg).toBe('__status_connected__');
  });

  it('falls back to message key when i18n returns empty string', () => {
    // Arrange
    getMock.mockReturnValue('');

    // Act & Assert
    for (const k of ALL_KEYS) {
      expect(getStatusMessage(k)).toBe(EXPECTED_MSG_KEY[k]);
    }
  });

  it('STATUS has four well-known keys', () => {
    // Arrange
    const keys = Object.keys(STATUS);

    // Assert
    expect(keys).toEqual(
      expect.arrayContaining(['RESTRICTED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED']),
    );
    expect(keys).toHaveLength(4);
  });

  it('STATUS_CLASS_BY_KEY maps each StatusKey to the expected class name', () => {
    // Arrange & Act & Assert
    for (const k of ALL_KEYS) {
      expect(STATUS_CLASS_BY_KEY[k]).toBe(EXPECTED_CLASS_BY_KEY[k]);
    }
  });

  it('STATUS_CLASS_BY_KEY has the same four keys as STATUS and values follow "connect-status--*" pattern', () => {
    // Arrange
    const classKeys = Object.keys(STATUS_CLASS_BY_KEY) as StatusKey[];

    // Assert: key set matches and count is exact
    expect(classKeys).toEqual(expect.arrayContaining(ALL_KEYS));
    expect(classKeys).toHaveLength(ALL_KEYS.length);

    // Assert: each value is a non-empty string with the expected prefix
    for (const k of ALL_KEYS) {
      const v = STATUS_CLASS_BY_KEY[k];
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
      expect(v).toMatch(/^connect-status--/);
    }
  });
});
