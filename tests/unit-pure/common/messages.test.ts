import { isResponse, MSG_TYPE } from '@common/messages';
import { describe, expect, it } from 'vitest';

describe('common/messages', () => {
  describe('MSG_TYPE shape', () => {
    it('contains all expected keys and values without duplicates', () => {
      // Arrange
      const expected = [
        'PING',
        'TOGGLE_SELECT',
        'RENDER',
        'CLEAR',
        'HOVER',
        'SELECTED',
        'MISSING_IDS',
        'ACTIVE_TAB_CHANGED',
      ];

      // Act
      const keys = Object.keys(MSG_TYPE);
      const values = Object.values(MSG_TYPE);
      const uniqueValues = new Set(values);

      // Assert
      expect(keys.sort()).toEqual([...expected].sort());
      expect(values.sort()).toEqual([...expected].sort());
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('isResponse (type guard by structure)', () => {
    it('returns true for ok:true with id present', () => {
      // Arrange
      const msg = { id: '1', ok: true, data: { x: 1 } };

      // Act
      const result = isResponse(msg);

      // Assert
      expect(result).toBe(true);
    });

    it('returns true for ok:false with id present', () => {
      // Arrange
      const msg = { id: '2', ok: false, error: 'boom' };

      // Act
      const result = isResponse(msg);

      // Assert
      expect(result).toBe(true);
    });

    it('returns false when only id exists or only ok exists or empty object', () => {
      // Arrange
      const onlyId = { id: 'x' };
      const onlyOk = { ok: true };
      const empty = {};

      // Act
      const r1 = isResponse(onlyId);
      const r2 = isResponse(onlyOk);
      const r3 = isResponse(empty);

      // Assert
      expect(r1).toBe(false);
      expect(r2).toBe(false);
      expect(r3).toBe(false);
    });

    it('returns false for non-objects (null/undefined/primitives/array)', () => {
      // Arrange
      const cases: unknown[] = [null, undefined, 123, 'str', true, []];

      // Act & Assert
      for (const c of cases) {
        expect(isResponse(c)).toBe(false);
      }
    });

    it('still returns true when id/ok types are not the intended TS types (structural check only)', () => {
      // Arrange
      const weird = { id: 999, ok: 'yes' } as unknown;

      // Act
      const result = isResponse(weird);

      // Assert
      expect(result).toBe(true);
    });

    it('returns true even if id/ok come from prototype chain (because of `in` operator)', () => {
      // Arrange
      const proto = { id: 'proto', ok: true };
      const obj = Object.create(proto);

      // Act
      const result = isResponse(obj);

      // Assert
      expect(result).toBe(true);
    });

    it('filters an unknown[] to only RpcResponse-shaped objects', () => {
      // Arrange
      const inputs: unknown[] = [
        { id: '1', ok: true },
        { id: '2', ok: false, error: 'e' },
        { id: '3' },
        { ok: true },
        1,
        null,
        'x',
      ];

      // Act
      const filtered = inputs.filter(isResponse);

      // Assert
      expect(filtered).toEqual([
        { id: '1', ok: true },
        { id: '2', ok: false, error: 'e' },
      ]);
    });
  });
});
