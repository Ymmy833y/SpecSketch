import { getIcon, type IconDef, type IconName, ICONS } from '@common/icons';
import { describe, expect, it } from 'vitest';

function asMutableIcons(): Record<string, IconDef> {
  return ICONS as unknown as Record<string, IconDef>;
}

describe('getIcon (happy paths)', () => {
  it('returns 20x20 icon for "caretDown"', () => {
    // Arrange
    const name: IconName = 'caretDown';

    // Act
    const icon = getIcon(name);

    // Assert
    expect(icon.d.length).toBeGreaterThan(0);
    expect(icon.viewBox).toBe('0 0 20 20');
  });

  it('returns 16x16 icon for "caretRightFill"', () => {
    // Arrange
    const name: IconName = 'caretRightFill';

    // Act
    const icon = getIcon(name);

    // Assert
    expect(icon.d.length).toBeGreaterThan(0);
    expect(icon.viewBox).toBe('0 0 16 16');
  });

  it('does not leak internal object references (defensive copy)', () => {
    // Arrange
    const original = ICONS.caretDown; // readonly view by type
    const beforeViewBox = original.viewBox;

    // Act
    const got = getIcon('caretDown');
    // Mutate the returned object
    (got as { viewBox: string }).viewBox = '0 0 1 1';

    // Assert
    // Internal ICONS must remain unchanged
    expect(ICONS.caretDown.viewBox).toBe(beforeViewBox);
  });
});

describe('getIcon (fallback behavior)', () => {
  it('fills default viewBox when missing on the source icon', () => {
    // Arrange
    const MUTABLE = asMutableIcons();
    const TEMP_NAME = '__tempNoViewBox__';
    MUTABLE[TEMP_NAME] = { d: 'M0 0' }; // intentionally omit viewBox

    try {
      // Act
      const icon = getIcon(TEMP_NAME as IconName);

      // Assert
      expect(icon.d).toBe('M0 0');
      expect(icon.viewBox).toBe('0 0 20 20'); // default fallback
    } finally {
      // Cleanup
      delete MUTABLE[TEMP_NAME];
    }
  });
});

describe('ICONS (data integrity)', () => {
  it('contains the expected icon keys', () => {
    // Arrange
    const keys = Object.keys(ICONS);

    // Act & Assert
    const expected = [
      'caretDown',
      'caretDownFill',
      'caretRight',
      'caretRightFill',
      'warn',
      'comment',
      'remove',
      'export',
    ];
    for (const k of expected) {
      expect(keys).toContain(k);
    }
  });

  it('every icon has a non-empty path and a valid viewBox shape (16 or 20 square)', () => {
    // Arrange
    const entries = Object.entries(ICONS);

    // Act & Assert
    for (const [_, def] of entries) {
      expect(def.d.length).toBeGreaterThan(0);

      // Icons are defined as 16x16 or 20x20 in this set.
      // We accept either "0 0 16 16" or "0 0 20 20".
      expect(['0 0 16 16', '0 0 20 20']).toContain(def.viewBox ?? '0 0 20 20');
    }
  });
});
