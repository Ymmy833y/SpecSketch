import {
  isItemColor,
  isItemPosition,
  isItemShape,
  isLabelFormat,
  isScreenItemLike,
  isValidPayload,
  ITEM_POSITION_VALUES,
  LabelFormat,
  ScreenItem,
} from '@common/types';
import { describe, expect, it } from 'vitest';

describe('common/types', () => {
  describe('isItemColor', () => {
    it('returns true for all allowed ItemColor literals', () => {
      // Arrange
      const allowed = [
        'Gray',
        'Red',
        'Yellow',
        'Green',
        'Blue',
        'Lime',
        'Purple',
        'Pink',
        'Orange',
        'Cyan',
      ] as const;

      // Act & Assert
      for (const c of allowed) {
        expect(isItemColor(c)).toBe(true);
      }
    });

    it('returns false for null', () => {
      // Arrange
      const v = null;

      // Act
      const ok = isItemColor(v);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false for disallowed values (case, empty, unknown, non-string)', () => {
      // Arrange
      // Case-insensitive, whitespace, unknown color, empty string, numeric value (any), etc.
      const invalids = ['gray', 'Purple ', '  Blue', 'Teal', '', 'BLACK', 123];

      // Act & Assert
      for (const v of invalids) {
        expect(isItemColor(v)).toBe(false);
      }
    });

    it('acts as a type guard in Array.filter', () => {
      // Arrange
      const mixed: (string | null)[] = ['Gray', 'teal', null, 'Blue', 'Cyan', 'cyan'];

      // Act
      const colors = mixed.filter(isItemColor);

      // Assert
      expect(colors).toEqual(['Gray', 'Blue', 'Cyan']);
    });
  });

  describe('isItemShape', () => {
    it('returns true for "circle" and "square"', () => {
      // Arrange
      const allowed = ['circle', 'square'] as const;

      // Act & Assert
      for (const s of allowed) {
        expect(isItemShape(s)).toBe(true);
      }
    });

    it('returns false for null', () => {
      // Arrange
      const v = null;

      // Act
      const ok = isItemShape(v);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false for disallowed values (e.g., "triangle", case variations)', () => {
      // Arrange
      const invalids = ['triangle', 'Circle', 'SQUARE', '', ' round '];

      // Act & Assert
      for (const v of invalids) {
        expect(isItemShape(v)).toBe(false);
      }
    });

    it('acts as a type guard in Array.filter', () => {
      // Arrange
      const mixed: (string | null)[] = ['circle', 'triangle', null, 'square', 'Circle'];

      // Act
      const shapes = mixed.filter(isItemShape);

      // Assert
      expect(shapes).toEqual(['circle', 'square']);
    });
  });

  describe('isLabelFormat', () => {
    it('returns true for all allowed LabelFormat literals', () => {
      // Arrange
      const allowed = ['Numbers', 'UpperAlpha', 'LowerAlpha', 'None'] as const;

      // Act & Assert
      for (const v of allowed) {
        expect(isLabelFormat(v)).toBe(true);
      }
    });

    it('returns false for null', () => {
      // Arrange
      const v = null;

      // Act
      const ok = isLabelFormat(v);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false for disallowed values (case/spacing/unknown/non-string)', () => {
      // Arrange
      const invalids = [
        'numbers', // case mismatch
        'UPPERALPHA', // wrong casing
        'loweralpha', // wrong casing
        ' UpperAlpha ', // extra spaces
        'Hex', // unknown
        '', // empty
        123, // non-string
        {}, // non-string
        [], // non-string
      ];

      // Act & Assert
      for (const v of invalids) {
        expect(isLabelFormat(v as unknown)).toBe(false);
      }
    });

    it('acts as a type guard in Array.filter', () => {
      // Arrange
      const mixed: (string | null)[] = [
        'Numbers',
        'numbers',
        null,
        'UpperAlpha',
        'foo',
        'LowerAlpha',
        'none',
        'None',
      ];

      // Act
      const formats = mixed.filter(isLabelFormat);

      // Assert
      expect(formats).toEqual(['Numbers', 'UpperAlpha', 'LowerAlpha', 'None']);
      // Type-level guard check (no runtime effect): formats should be LabelFormat[]
      const _assertTypes: LabelFormat[] = formats;
      expect(_assertTypes.length).toBe(4);
    });
  });

  describe('isItemPosition', () => {
    it('returns true for all allowed ItemPosition literals (ITEM_POSITION_VALUES)', () => {
      // Arrange
      const allowed = ITEM_POSITION_VALUES;

      // Act & Assert
      for (const p of allowed) {
        expect(isItemPosition(p)).toBe(true);
      }
    });

    it('returns false for null', () => {
      // Arrange
      const v = null;

      // Act
      const ok = isItemPosition(v);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false for disallowed values (case/spacing/unknown/non-string)', () => {
      // Arrange
      const invalids = [
        'Right-top-outside', // case mismatch
        'right top outside', // spaces instead of hyphens
        'right-top-out-side', // extra hyphen
        'middle', // unknown value
        '', // empty
        42, // non-string
      ];

      // Act & Assert
      for (const v of invalids) {
        expect(isItemPosition(v)).toBe(false);
      }
    });

    it('acts as a type guard in Array.filter', () => {
      // Arrange
      const mixed: (string | null)[] = [
        'left-top-outside',
        'Right-top-outside',
        null,
        'center',
        'top-outside',
        'bottom_inside',
      ];

      // Act
      const positions = mixed.filter(isItemPosition);

      // Assert
      expect(positions).toEqual(['left-top-outside', 'center', 'top-outside']);
    });
  });

  describe('isScreenItemLike', () => {
    it('returns true for minimal ScreenItem-like object (anchor: kind=css, value, version)', () => {
      // Arrange
      const obj: unknown = {
        anchor: { kind: 'css', value: '#app', version: 1 },
      };

      // Act
      const ok = isScreenItemLike(obj);

      // Assert
      expect(ok).toBe(true);
    });

    it('returns true when anchor.version is a number other than 1 (loose check by design)', () => {
      // Arrange
      const obj: unknown = {
        anchor: { kind: 'css', value: '.foo', version: 2 },
      };

      // Act
      const ok = isScreenItemLike(obj);

      // Assert
      expect(ok).toBe(true);
    });

    it('returns false for null or non-object values', () => {
      // Arrange
      const values: unknown[] = [null, undefined, 'str', 0, true];

      // Act & Assert
      for (const v of values) {
        expect(isScreenItemLike(v)).toBe(false);
      }
    });

    it('returns false when anchor is missing or not an object', () => {
      // Arrange
      const cases: unknown[] = [{}, { anchor: null }, { anchor: 'x' }, { anchor: 1 }];

      // Act & Assert
      for (const c of cases) {
        expect(isScreenItemLike(c)).toBe(false);
      }
    });

    it('returns false when anchor.kind is not "css"', () => {
      // Arrange
      const obj: unknown = {
        anchor: { kind: 'xpath', value: '#app', version: 1 },
      };

      // Act
      const ok = isScreenItemLike(obj);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false when anchor.value is not a string', () => {
      // Arrange
      const cases: unknown[] = [
        { anchor: { kind: 'css', value: 1, version: 1 } },
        { anchor: { kind: 'css', value: null, version: 1 } },
      ];

      // Act & Assert
      for (const c of cases) {
        expect(isScreenItemLike(c)).toBe(false);
      }
    });

    it('acts as a type guard in Array.filter', () => {
      // Arrange
      const mixed: unknown[] = [
        { anchor: { kind: 'css', value: '#a', version: 1 } },
        { anchor: { kind: 'xpath', value: '#a', version: 1 } },
        null,
        { anchor: { kind: 'css', value: '.b', version: 3 } },
        { anchor: { kind: 'css', value: 123, version: 1 } },
      ];

      // Act
      const filtered = mixed.filter(isScreenItemLike);

      // Assert
      expect(filtered).toEqual([
        { anchor: { kind: 'css', value: '#a', version: 1 } },
        { anchor: { kind: 'css', value: '.b', version: 3 } },
      ]);
    });
  });

  describe('isValidPayload', () => {
    it('returns true for a valid payload with minimal valid items', () => {
      // Arrange
      const items: ScreenItem[] = [
        // Only anchor is checked by isScreenItemLike; other props are not required for the guard
        {
          id: 1,
          label: 1,
          anchor: { kind: 'css', value: '#app', version: 1 },
        } as unknown as ScreenItem,
      ];
      const payload: unknown = {
        format: 'specsketch-export',
        kind: 'screen-state',
        version: 1,
        exportedAt: new Date().toISOString(),
        pageKey: 'https://example.com',
        items,
      };

      // Act
      const ok = isValidPayload(payload);

      // Assert
      expect(ok).toBe(true);
    });

    it('returns true even when items is an empty array (contract allows empty list)', () => {
      // Arrange
      const payload: unknown = {
        format: 'specsketch-export',
        kind: 'screen-state',
        version: 1,
        exportedAt: new Date().toISOString(),
        pageKey: 'https://example.com',
        items: [],
      };

      // Act
      const ok = isValidPayload(payload);

      // Assert
      expect(ok).toBe(true);
    });

    it('returns false when format/kind are incorrect', () => {
      // Arrange
      const base = {
        version: 1,
        exportedAt: new Date().toISOString(),
        pageKey: 'https://example.com',
        items: [{ anchor: { kind: 'css', value: '#app', version: 1 } }],
      };

      const cases: unknown[] = [
        { ...base, format: 'other', kind: 'screen-state' },
        { ...base, format: 'specsketch-export', kind: 'other' },
      ];

      // Act & Assert
      for (const c of cases) {
        expect(isValidPayload(c)).toBe(false);
      }
    });

    it('returns false when version is not a number', () => {
      // Arrange
      const payload: unknown = {
        format: 'specsketch-export',
        kind: 'screen-state',
        version: '1',
        exportedAt: new Date().toISOString(),
        pageKey: 'https://example.com',
        items: [{ anchor: { kind: 'css', value: '#app', version: 1 } }],
      };

      // Act
      const ok = isValidPayload(payload);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false when pageKey is not a string', () => {
      // Arrange
      const payload: unknown = {
        format: 'specsketch-export',
        kind: 'screen-state',
        version: 1,
        exportedAt: new Date().toISOString(),
        pageKey: 123,
        items: [{ anchor: { kind: 'css', value: '#app', version: 1 } }],
      };

      // Act
      const ok = isValidPayload(payload);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false when items is not an array', () => {
      // Arrange
      const payload: unknown = {
        format: 'specsketch-export',
        kind: 'screen-state',
        version: 1,
        exportedAt: new Date().toISOString(),
        pageKey: 'https://example.com',
        items: { anchor: { kind: 'css', value: '#app', version: 1 } },
      };

      // Act
      const ok = isValidPayload(payload);

      // Assert
      expect(ok).toBe(false);
    });

    it('returns false when any item is not ScreenItem-like (delegates to isScreenItemLike)', () => {
      // Arrange
      const payload: unknown = {
        format: 'specsketch-export',
        kind: 'screen-state',
        version: 1,
        exportedAt: new Date().toISOString(),
        pageKey: 'https://example.com',
        items: [
          { anchor: { kind: 'css', value: '#ok', version: 1 } },
          { anchor: { kind: 'xpath', value: '#ng', version: 1 } }, // invalid
        ],
      };

      // Act
      const ok = isValidPayload(payload);

      // Assert
      expect(ok).toBe(false);
    });
  });
});
