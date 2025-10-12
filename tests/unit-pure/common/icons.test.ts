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

describe('getIcon (happy paths) - status and close icons', () => {
  it('returns 16x16 icon for "success" with a non-empty path', () => {
    // Arrange
    const name: IconName = 'success';

    // Act
    const icon = getIcon(name);

    // Assert
    expect(icon.viewBox).toBe('0 0 16 16');
    expect(icon.d.length).toBeGreaterThan(0);
    // Optional guard: ensure the path looks like the expected glyph
    expect(icon.d.startsWith('M16 8A8')).toBe(true);
  });

  it('returns 16x16 icon for "error" with a non-empty path', () => {
    // Arrange
    const name: IconName = 'error';

    // Act
    const icon = getIcon(name);

    // Assert
    expect(icon.viewBox).toBe('0 0 16 16');
    expect(icon.d.length).toBeGreaterThan(0);
    // Optional guard: first move instruction matches expected shape
    expect(icon.d.startsWith('M16 8A8')).toBe(true);
  });

  it('returns 20x20 icon for "close" with a non-empty path', () => {
    // Arrange
    const name: IconName = 'close';

    // Act
    const icon = getIcon(name);

    // Assert
    expect(icon.viewBox).toBe('0 0 20 20');
    expect(icon.d.length).toBeGreaterThan(0);
    // Optional guard: first move instruction matches expected shape
    expect(icon.d.startsWith('M5.23 5.23')).toBe(true);
  });

  it('does not leak internal object references for "close" (defensive copy)', () => {
    // Arrange
    const before = ICONS.close.viewBox;

    // Act
    const got = getIcon('close');
    // Mutate the returned object and ensure the source remains intact
    (got as { viewBox: string }).viewBox = '0 0 1 1';

    // Assert
    expect(ICONS.close.viewBox).toBe(before);
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

describe('ICONS (data integrity) - presence of status and close keys', () => {
  it('includes "success", "error", and "close" icon definitions', () => {
    // Arrange
    const keys = Object.keys(ICONS);

    // Act & Assert
    expect(keys).toContain('success');
    expect(keys).toContain('error');
    expect(keys).toContain('close');
  });

  it('ensures "close" shapes are 20x20 or default to 20x20', () => {
    // Arrange & Act & Assert
    const def = ICONS['close'];
    // If viewBox is omitted it is treated as 20x20 by getIcon; here we just validate defined metadata.
    expect([undefined, '0 0 20 20']).toContain(def.viewBox);
    expect(def.d.length).toBeGreaterThan(0);
  });
});
