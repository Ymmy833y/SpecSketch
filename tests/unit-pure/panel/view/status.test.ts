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
import { getStatusMessage, STATUS, STATUS_LABEL_STYLE, type StatusKey } from '@panel/view/status';

const getMock = vi.mocked(i18n.get);

const EXPECTED_MSG_KEY: Record<StatusKey, string> = {
  RESTRICTED: 'status_restricted',
  CONNECTING: 'status_connecting',
  CONNECTED: 'status_connected',
  DISCONNECTED: 'status_disconnected',
};

const ALL_KEYS = Object.values(STATUS) as StatusKey[];

describe('panel/view/status', () => {
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

  it('STATUS_LABEL_STYLE provides expected body/dot classes for each status', () => {
    // Arrange
    const expected: Record<StatusKey, { body: string[]; dot: string[] }> = {
      RESTRICTED: {
        body: [
          'bg-amber-50',
          'border-amber-200',
          'text-amber-700',
          'dark:bg-amber-950',
          'dark:border-amber-900/50',
          'dark:text-amber-300',
        ],
        dot: ['bg-amber-500'],
      },
      CONNECTING: {
        body: [
          'bg-sky-50',
          'border-sky-200',
          'text-sky-700',
          'dark:bg-sky-950',
          'dark:border-sky-900/50',
          'dark:text-sky-300',
        ],
        dot: ['bg-sky-500'],
      },
      CONNECTED: {
        body: [
          'bg-emerald-50',
          'border-emerald-200',
          'text-emerald-700',
          'dark:bg-emerald-950',
          'dark:border-emerald-900/50',
          'dark:text-emerald-300',
        ],
        dot: ['bg-emerald-500'],
      },
      DISCONNECTED: {
        body: [
          'bg-rose-50',
          'border-rose-200',
          'text-rose-700',
          'dark:bg-rose-950',
          'dark:border-rose-900/50',
          'dark:text-rose-300',
        ],
        dot: ['bg-rose-500'],
      },
    };

    // Act & Assert
    for (const k of ALL_KEYS) {
      expect(STATUS_LABEL_STYLE[k]).toBeDefined();
      expect(STATUS_LABEL_STYLE[k].body).toEqual(expected[k].body);
      expect(STATUS_LABEL_STYLE[k].dot).toEqual(expected[k].dot);
    }
  });
});
