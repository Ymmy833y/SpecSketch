import { ScreenItem } from '@common/types';
import { sortScreenItemsByGroupAndLabel, timestamp } from '@common/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

function makeItem(id: number, label: number, group?: string): ScreenItem {
  return {
    id,
    label: label,
    anchor: { kind: 'css', value: `#el${id}`, version: 1 },
    size: 12,
    color: 'Blue',
    shape: 'circle',
    position: 'bottom-inside',
    ...(group !== undefined ? { group } : {}),
  };
}

describe('common/utils', () => {
  describe('timestamp', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('formats with zero padding and positive sign for UTC+09:00 (e.g., JST)', () => {
      // Arrange: Fixed date with single-digit components to verify zero-padding
      const d = new Date('2024-01-02T03:04:05.000Z');
      vi.spyOn(d, 'getFullYear').mockReturnValue(2024);
      vi.spyOn(d, 'getMonth').mockReturnValue(0); // January -> +1 => 1 -> "01"
      vi.spyOn(d, 'getDate').mockReturnValue(2); // "02"
      vi.spyOn(d, 'getHours').mockReturnValue(3); // "03"
      vi.spyOn(d, 'getMinutes').mockReturnValue(4); // "04"
      vi.spyOn(d, 'getSeconds').mockReturnValue(5); // "05"
      // JST (UTC+9) => Date#getTimezoneOffset() = -540
      vi.spyOn(d, 'getTimezoneOffset').mockReturnValue(-540);

      // Act
      const actual = timestamp(d);

      // Assert
      expect(actual).toBe('2024-01-02_03-04-05+0900');
    });

    it('uses negative sign for UTC-07:00 and keeps minutes as 00', () => {
      // Arrange: Two-digit components (no padding edge here, just sign/offset check)
      const d = new Date('1999-12-31T23:58:59.000Z');
      vi.spyOn(d, 'getFullYear').mockReturnValue(1999);
      vi.spyOn(d, 'getMonth').mockReturnValue(11); // December -> +1 => 12
      vi.spyOn(d, 'getDate').mockReturnValue(31);
      vi.spyOn(d, 'getHours').mockReturnValue(23);
      vi.spyOn(d, 'getMinutes').mockReturnValue(58);
      vi.spyOn(d, 'getSeconds').mockReturnValue(59);
      // UTC-7 => offset = +420 minutes, tzo = -420 => sign '-'
      vi.spyOn(d, 'getTimezoneOffset').mockReturnValue(420);

      // Act
      const actual = timestamp(d);

      // Assert
      expect(actual).toBe('1999-12-31_23-58-59-0700');
    });

    it('handles half-hour timezones (e.g., UTC+05:30 -> +0530)', () => {
      // Arrange: Any components are fine; we care about mm part of offset = 30
      const d = new Date('2021-06-15T10:20:30.000Z');
      vi.spyOn(d, 'getFullYear').mockReturnValue(2021);
      vi.spyOn(d, 'getMonth').mockReturnValue(5); // June -> +1 => 6 -> "06"
      vi.spyOn(d, 'getDate').mockReturnValue(15); // "15"
      vi.spyOn(d, 'getHours').mockReturnValue(10); // "10"
      vi.spyOn(d, 'getMinutes').mockReturnValue(20); // "20"
      vi.spyOn(d, 'getSeconds').mockReturnValue(30); // "30"
      // UTC+05:30 => offset = -330 minutes
      vi.spyOn(d, 'getTimezoneOffset').mockReturnValue(-330);

      // Act
      const actual = timestamp(d);

      // Assert
      expect(actual).toBe('2021-06-15_10-20-30+0530');
    });
  });

  describe('sortScreenItemsByGroupAndLabel', () => {
    it('sorts by first-seen group order and label ascending (example case)', () => {
      // Arrange
      const before = [
        makeItem(1, 1, 'A'),
        makeItem(2, 3, 'A'),
        makeItem(3, 2, 'B'),
        makeItem(4, 2, 'A'),
        makeItem(5, 1, 'B'),
      ];

      // Act
      const sorted = sortScreenItemsByGroupAndLabel(before);

      // Assert: group "A" keeps its first-seen priority, then "B"; inside each, label asc
      expect(sorted.map((x) => ({ id: x.id, label: x.label, group: x.group }))).toEqual([
        { id: 1, label: 1, group: 'A' },
        { id: 4, label: 2, group: 'A' },
        { id: 2, label: 3, group: 'A' },
        { id: 5, label: 1, group: 'B' },
        { id: 3, label: 2, group: 'B' },
      ]);
    });

    it('preserves original order for exact ties (same group and label)', () => {
      // Arrange: same group and same label → tie should keep original order (stability)
      const a = makeItem(10, 1, 'g');
      const b = makeItem(11, 1, 'g');
      const c = makeItem(12, 1, 'g');
      const before = [a, b, c];

      // Act
      const sorted = sortScreenItemsByGroupAndLabel(before);

      // Assert
      expect(sorted).toEqual([a, b, c]);
    });

    it('maintains first-seen order for multiple groups including undefined', () => {
      // Arrange: groups appear in order: undefined → "x" → "y"
      const i1 = makeItem(1, 2); // undefined group, label 2
      const i2 = makeItem(2, 1, 'x'); // x group, label 1
      const i3 = makeItem(3, 3); // undefined group, label 3
      const i4 = makeItem(4, 2, 'y'); // y group, label 2
      const i5 = makeItem(5, 2, 'x'); // x group, label 2

      const before = [i1, i2, i3, i4, i5];

      // Act
      const sorted = sortScreenItemsByGroupAndLabel(before);

      // Assert: group order = [undefined, 'x', 'y']; within each group label asc
      expect(sorted.map((x) => x.id)).toEqual([
        // undefined group by label: i1(label2), i3(label3)
        1, 3,
        // 'x' group by label: i2(label1), i5(label2)
        2, 5,
        // 'y' group by label: i4(label2)
        4,
      ]);
    });

    it('does not mutate the input array and returns a new array instance', () => {
      // Arrange
      const before = [makeItem(1, 2, 'a'), makeItem(2, 1, 'a'), makeItem(3, 1, 'b')];
      const snapshot = before.slice();

      // Act
      const sorted = sortScreenItemsByGroupAndLabel(before);

      // Assert: original array not mutated
      expect(before).toEqual(snapshot);
      expect(sorted).not.toBe(before); // new array instance
    });

    it('keeps object identity (same references) while reordering', () => {
      // Arrange
      const a = makeItem(1, 3, 'g1');
      const b = makeItem(2, 1, 'g1');
      const c = makeItem(3, 2, 'g2');
      const before = [a, b, c];

      // Act
      const sorted = sortScreenItemsByGroupAndLabel(before);

      // Assert: exact same objects are reused (no cloning)
      expect(sorted).toContain(a);
      expect(sorted).toContain(b);
      expect(sorted).toContain(c);
      // And order should be: g1 first (labels 1,3), then g2 (label 2)
      expect(sorted.map((x) => x.id)).toEqual([2, 1, 3]);
    });

    it('handles duplicated labels across different groups independently', () => {
      // Arrange: same labels appear in different groups; sort is per-group
      const before = [
        makeItem(1, 1, 'A'),
        makeItem(2, 2, 'B'),
        makeItem(3, 2, 'A'),
        makeItem(4, 1, 'B'),
        makeItem(5, 1, 'A'),
      ];

      // Act
      const sorted = sortScreenItemsByGroupAndLabel(before);

      // Assert: group order A → B (first seen). Inside A: labels 1,1,2; inside B: 1,2
      expect(sorted.map((x) => ({ id: x.id, group: x.group, label: x.label }))).toEqual([
        { id: 1, group: 'A', label: 1 },
        { id: 5, group: 'A', label: 1 },
        { id: 3, group: 'A', label: 2 },
        { id: 4, group: 'B', label: 1 },
        { id: 2, group: 'B', label: 2 },
      ]);
    });
  });
});
