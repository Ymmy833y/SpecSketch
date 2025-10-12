import { type Anchor, type ScreenItem, type ScreenState } from '@common/types';
import {
  applyPatch,
  handleSelected,
  normalizeGroupLabelsAndCountUngrouped,
} from '@panel/services/state';
import { screenStateTable } from '@panel/storage/tables';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Test helpers ------------------------------------------------------------
const PAGE = 'pg-1';

const css = (value: string): Anchor => ({
  kind: 'css',
  value,
  version: 1 as const,
});

const makeItem = (id: number, label: number, anchor: Anchor, group?: string): ScreenItem => ({
  id,
  label,
  anchor,
  size: 16 as ScreenItem['size'],
  color: 'indigo' as ScreenItem['color'],
  shape: 'square' as ScreenItem['shape'],
  position: 'left-top-outside' as ScreenItem['position'],
  ...(group !== undefined ? { group } : {}),
});

const makeState = (items: ScreenItem[], nextId: number): ScreenState => ({
  items,
  nextId,
  defaultSize: 16 as ScreenItem['size'],
  defaultColor: 'indigo' as ScreenItem['color'],
  defaultShape: 'square' as ScreenItem['shape'],
  defaultLabelFormat: 'Numbers' as ScreenState['defaultLabelFormat'],
  defaultPosition: 'left-top-outside' as ScreenItem['position'],
  defaultGroup: '',
});

describe('panel/services/state', () => {
  describe('applyPatch', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('removes specified ids and relabels sequentially; persists the state', async () => {
      // Arrange
      const i1 = makeItem(1, 1, css('#a'));
      const i2 = makeItem(2, 2, css('#b'));
      const i3 = makeItem(3, 3, css('#c'));
      const initial = makeState([i1, i2, i3], 4);
      const getSpy = vi.spyOn(screenStateTable, 'get').mockResolvedValueOnce(initial);
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await applyPatch(PAGE, { removedIds: [2] });

      // Assert
      expect(next.items.map((it: ScreenItem) => it.id)).toEqual([1, 3]);
      expect(next.items.map((it: ScreenItem) => it.label)).toEqual([1, 2]);

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(setSpy).toHaveBeenCalledTimes(1);
      const persisted = setSpy.mock.calls[0]?.[1] as ScreenState;
      expect(persisted.items.map((it) => it.id)).toEqual([1, 3]);
    });

    it('adds anchors using defaults, normalizes labels, advances nextId, and persists', async () => {
      // Arrange
      const i1 = makeItem(1, 1, css('#a'));
      const i2 = makeItem(2, 2, css('#b'));

      vi.spyOn(screenStateTable, 'get').mockResolvedValueOnce(makeState([i1, i2], 3));
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await applyPatch(PAGE, {
        added: [{ anchor: css('#x') }, { anchor: css('#y') }],
      });

      // Assert
      expect(next.items).toHaveLength(4);
      expect(next.items.map((it: ScreenItem) => it.label)).toEqual([1, 2, 3, 4]);
      expect(next.nextId).toBe(5);

      const addedX = next.items.find((it: ScreenItem) => it.anchor.value === '#x')!;
      expect(addedX.size).toBe(next.defaultSize);
      expect(addedX.color).toBe(next.defaultColor);
      expect(addedX.shape).toBe(next.defaultShape);
      expect(addedX.position).toBe(next.defaultPosition);
      expect(addedX.group ?? '').toBe(next.defaultGroup);
      // Assert labelFormat default to 'Numbers' when omitted
      expect(addedX.labelFormat).toBe('Numbers');

      const addedY = next.items.find((it: ScreenItem) => it.anchor.value === '#y')!;
      // Assert labelFormat default for the other added item as well
      expect(addedY.labelFormat).toBe('Numbers');

      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('handles empty patch by normalizing and persisting (no material change)', async () => {
      // Arrange
      const i1 = makeItem(1, 1, css('#a'));
      const i2 = makeItem(2, 2, css('#b'));
      vi.spyOn(screenStateTable, 'get').mockResolvedValueOnce(makeState([i1, i2], 3));
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await applyPatch(PAGE, {});

      // Assert
      expect(next.items.map((it: ScreenItem) => it.id)).toEqual([1, 2]);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('adds anchors with per-item overrides; falls back to defaults when omitted; persists', async () => {
      // Arrange
      const iA1 = makeItem(1, 1, css('#a'), 'A'); // group A
      const iU1 = makeItem(2, 1, css('#b')); // ungrouped
      vi.spyOn(screenStateTable, 'get').mockResolvedValueOnce(makeState([iA1, iU1], 3));
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await applyPatch(PAGE, {
        added: [
          {
            anchor: css('#a2'),
            size: 24 as ScreenItem['size'],
            color: 'lime' as ScreenItem['color'],
            shape: 'circle' as ScreenItem['shape'],
            position: 'right-bottom-inside' as ScreenItem['position'],
            group: 'A',
            comment: 'note',
            labelFormat: 'UpperAlpha' as ScreenItem['labelFormat'],
          },
          {
            // no overrides -> should use defaults
            anchor: css('#u2'),
          },
        ],
      });

      // Assert: length / nextId
      expect(next.items).toHaveLength(4);
      expect(next.nextId).toBe(5);

      // overrides item (#a2)
      const a2 = next.items.find((it) => it.anchor.value === '#a2')!;
      expect(a2.size).toBe(24);
      expect(a2.color).toBe('lime');
      expect(a2.shape).toBe('circle');
      expect(a2.position).toBe('right-bottom-inside');
      expect(a2.group).toBe('A');
      expect(a2.comment).toBe('note');
      expect(a2.labelFormat).toBe('UpperAlpha');

      // defaulted item (#u2)
      const u2 = next.items.find((it) => it.anchor.value === '#u2')!;
      expect(u2.size).toBe(next.defaultSize);
      expect(u2.color).toBe(next.defaultColor);
      expect(u2.shape).toBe(next.defaultShape);
      expect(u2.position).toBe(next.defaultPosition);
      expect(u2.group ?? '').toBe(next.defaultGroup);
      expect(u2.comment).toBe('');
      expect(u2.labelFormat).toBe('Numbers');

      // labels normalized by group
      const groupA = next.items
        .filter((it) => (it.group ?? '') === 'A')
        .sort((a, b) => a.label - b.label);
      expect(groupA.map((it) => it.anchor.value)).toEqual(['#a', '#a2']);
      expect(groupA.map((it) => it.label)).toEqual([1, 2]);

      const ungrouped = next.items
        .filter((it) => (it.group ?? '') === '')
        .sort((a, b) => a.label - b.label);
      expect(ungrouped.map((it) => it.anchor.value)).toEqual(['#b', '#u2']);
      expect(ungrouped.map((it) => it.label)).toEqual([1, 2]);

      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('adds into mixed groups and normalizes labels per group independently', async () => {
      // Arrange
      const a1 = makeItem(1, 2, css('#a1'), 'A'); // label will be normalized
      const a2 = makeItem(2, 1, css('#a0'), 'A');
      const u1 = makeItem(3, 3, css('#u1')); // ungrouped
      vi.spyOn(screenStateTable, 'get').mockResolvedValueOnce(makeState([a1, a2, u1], 4));
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await applyPatch(PAGE, {
        added: [
          { anchor: css('#a3'), group: 'A' }, // goes to group A
          { anchor: css('#u2') }, // goes to ungrouped
        ],
      });

      // Assert: nextId advanced by 2
      expect(next.nextId).toBe(6);

      // Group A should be relabeled 1..3
      const groupA = next.items
        .filter((it) => (it.group ?? '') === 'A')
        .sort((a, b) => a.label - b.label);
      expect(groupA).toHaveLength(3);
      expect(groupA.map((it) => it.label)).toEqual([1, 2, 3]);
      expect(groupA.map((it) => it.anchor.value).sort()).toEqual(['#a0', '#a1', '#a3'].sort());

      // Ungrouped should be relabeled 1..2
      const ungrouped = next.items
        .filter((it) => (it.group ?? '') === '')
        .sort((a, b) => a.label - b.label);
      expect(ungrouped).toHaveLength(2);
      expect(ungrouped.map((it) => it.label)).toEqual([1, 2]);
      expect(ungrouped.map((it) => it.anchor.value).sort()).toEqual(['#u1', '#u2'].sort());

      expect(setSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSelected', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('removes existing item when the same anchor is selected', async () => {
      // Arrange
      const i1 = makeItem(1, 1, css('#a'));
      const i2 = makeItem(2, 2, css('#b'));
      vi.spyOn(screenStateTable, 'get')
        .mockResolvedValueOnce(makeState([i1, i2], 3)) // for handleSelected
        .mockResolvedValueOnce(makeState([i1, i2], 3)); // for applyPatch
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await handleSelected(PAGE, [css('#a')]);

      // Assert
      expect(next.items.map((it: ScreenItem) => it.anchor.value)).toEqual(['#b']);
      expect(next.items.map((it: ScreenItem) => it.label)).toEqual([1]);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('adds new item once when duplicate values are provided (dedup by value)', async () => {
      // Arrange
      const i1 = makeItem(1, 1, css('#a'));

      vi.spyOn(screenStateTable, 'get')
        .mockResolvedValueOnce(makeState([i1], 2))
        .mockResolvedValueOnce(makeState([i1], 2));

      // Act
      const next = await handleSelected(PAGE, [css('#b'), css('#b')]);

      // Assert
      expect(next.items.map((it: ScreenItem) => it.anchor.value)).toEqual(['#a', '#b']);
      expect(next.items.map((it: ScreenItem) => it.label)).toEqual([1, 2]);
      expect(next.nextId).toBe(3);
    });

    it('removes existing and adds new in one call; labels normalized', async () => {
      // Arrange
      const i1 = makeItem(1, 1, css('#a'));
      const i2 = makeItem(2, 2, css('#c'));

      vi.spyOn(screenStateTable, 'get')
        .mockResolvedValueOnce(makeState([i1, i2], 3))
        .mockResolvedValueOnce(makeState([i1, i2], 3));
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      // Act
      const next = await handleSelected(PAGE, [css('#a'), css('#b'), css('#b')]);

      // Assert
      expect(next.items.map((it: ScreenItem) => it.anchor.value).sort()).toEqual(['#b', '#c']);
      expect(next.items.map((it: ScreenItem) => it.label)).toEqual([1, 2]);
      expect(next.nextId).toBe(4);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('normalizeGroupLabelsAndCountUngrouped', () => {
    it('relabels within each group (1..n per group); ungrouped are relabeled independently', () => {
      // Arrange
      const a1 = makeItem(1, 2, css('#a'), 'A'); // label 2
      const a2 = makeItem(2, 1, css('#b'), 'A'); // label 1
      const u1 = makeItem(3, 3, css('#c')); // no group
      const a3 = makeItem(4, 2, css('#d'), 'A'); // label 2 (dup)

      // Act
      const out = normalizeGroupLabelsAndCountUngrouped([a1, a2, u1, a3]);

      // Assert
      expect(out.find((it: ScreenItem) => it.id === 1)?.label).toBe(2);
      expect(out.find((it: ScreenItem) => it.id === 2)?.label).toBe(1);
      expect(out.find((it: ScreenItem) => it.id === 4)?.label).toBe(3);
      expect(out.find((it: ScreenItem) => it.id === 3)?.label).toBe(1);
    });
  });
});
