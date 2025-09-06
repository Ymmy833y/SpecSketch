import { isItemColor, isItemShape } from '@common/types';
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
});
