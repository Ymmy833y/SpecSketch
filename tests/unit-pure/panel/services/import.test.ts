import { beforeEach, describe, expect, it, vi } from 'vitest';

// i18n: return the key as-is for error messages
vi.mock('@common/i18n', () => ({
  default: { get: vi.fn((key: string, _subs?: string[]) => key) },
}));

// screenStateTable.get: expose a mock to verify calls
const getMock = vi.fn<(pageKey: string) => Promise<{ items: unknown[] } | undefined>>();
vi.mock('@panel/storage/tables', () => ({
  screenStateTable: { get: (...args: [string]) => getMock(...args) },
}));

// applyPatch: verify call arguments and control the return value
const applyPatchMock = vi.fn<(pageKey: string, patch: { added: unknown[] }) => Promise<unknown>>();
vi.mock('@panel/services/state', () => ({
  applyPatch: (...args: [string, { added: unknown[] }]) => applyPatchMock(...args),
}));

// isValidPayload: stubbed per test
const isValidPayloadMock = vi.fn<(v: unknown) => boolean>();
vi.mock('@common/types', () => ({
  isValidPayload: (v: unknown) => isValidPayloadMock(v),
}));

// Import target after mocks are defined
import i18n from '@common/i18n';
import { importScreanState } from '@panel/services/import';

// ---- Helpers ----------------------------------------------------------------

// In Node, don't implement File; use a minimal object and cast to File
function makeFile(content: string, name: string, type = 'application/json'): File {
  const fileLike = {
    name,
    type,
    text: async () => content,
  };
  return fileLike as unknown as File;
}

// ScreenItem-shaped object (runtime uses only selected fields like shape/position)
function mkItem(
  id: number,
  anchor: { kind: 'css'; version: 1; value: string },
): Record<string, unknown> {
  return {
    id,
    label: id,
    anchor,
    size: { w: 10, h: 10 },
    color: 'Red',
    shape: 'circle',
    position: { x: 1, y: 2 },
    group: { label: 1, value: 'G1' },
    comment: { text: 'c' },
    extra: 'ignored',
  };
}

function mkPayload(items: unknown[]) {
  return {
    format: 'specsketch-export',
    kind: 'screen-state',
    version: 1,
    pageKey: 'page-1',
    items,
  };
}

function pickAddedFields(it: Record<string, unknown>) {
  return {
    anchor: it.anchor,
    size: it.size,
    color: it.color,
    shape: it.shape,
    position: it.position,
    group: it.group,
    comment: it.comment,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Tests ------------------------------------------------------------------

describe('importScreanState (unit-pure)', () => {
  it('rejects non-JSON file (by extension and MIME)', async () => {
    // Arrange
    const f = makeFile('not-json', 'data.txt', 'text/plain');

    // Act & Assert
    await expect(importScreanState(f, 'page-1')).rejects.toThrowError('import_file_not_json');
    expect(isValidPayloadMock).not.toHaveBeenCalled();
    expect(applyPatchMock).not.toHaveBeenCalled();
  });

  it('treats malformed JSON as payload invalid', async () => {
    // Arrange
    const f = makeFile('{ invalid json', 'p.json', 'application/json');

    // Act & Assert
    await expect(importScreanState(f, 'page-1')).rejects.toThrowError('import_payload_invalid');
    expect(isValidPayloadMock).not.toHaveBeenCalled();
    expect(applyPatchMock).not.toHaveBeenCalled();
  });

  it('rejects when payload validation fails', async () => {
    // Arrange
    const bad = mkPayload([{ foo: 'bar' }]);
    const f = makeFile(JSON.stringify(bad), 'p.json', 'application/json');
    isValidPayloadMock.mockReturnValue(false);

    // Act & Assert
    await expect(importScreanState(f, 'page-1')).rejects.toThrowError('import_payload_invalid');
    expect(isValidPayloadMock).toHaveBeenCalledTimes(1);
    expect(applyPatchMock).not.toHaveBeenCalled();
  });

  it('skips duplicate anchors and adds only new ones (sorted by id desc)', async () => {
    // Arrange
    const exist = mkItem(10, { kind: 'css', version: 1, value: '#a' });
    getMock.mockResolvedValue({ items: [exist] });

    const importedA = mkItem(1, { kind: 'css', version: 1, value: '#a' }); // duplicate
    const importedB = mkItem(3, { kind: 'css', version: 1, value: '#b' }); // new
    const importedC = mkItem(2, { kind: 'css', version: 1, value: '#c' }); // new

    const payload = mkPayload([importedA, importedB, importedC]);
    const f = makeFile(JSON.stringify(payload), 'p.json', 'application/json');

    isValidPayloadMock.mockReturnValue(true);

    const patchedResult = { items: ['patched'] };
    applyPatchMock.mockResolvedValue(patchedResult);

    // Act
    const result = await importScreanState(f, 'page-1');

    // Assert
    expect(applyPatchMock).toHaveBeenCalledTimes(1);
    const [pageKeyArg, patchArg] = applyPatchMock.mock.calls[0]!;
    expect(pageKeyArg).toBe('page-1');

    // Excludes duplicate (#a) and keeps id-desc ordering (3,2)
    const expectedAdded = [importedB, importedC]
      .sort((a, b) => (b.id as number) - (a.id as number))
      .map((x) => pickAddedFields(x as Record<string, unknown>));

    expect((patchArg as { added: unknown[] }).added).toEqual(expectedAdded);

    expect(result).toEqual({
      state: patchedResult,
      successMessage: 'import_succeeded_with_count',
    });

    expect(i18n.get).toHaveBeenCalledWith('import_succeeded_with_count', ['2']);
  });

  it('passes only allowed fields to applyPatch (id/extra are excluded)', async () => {
    // Arrange
    getMock.mockResolvedValue({ items: [] });
    isValidPayloadMock.mockReturnValue(true);
    applyPatchMock.mockResolvedValue({ ok: true });

    const withExtra = mkItem(42, { kind: 'css', version: 1, value: '#x' });
    const payload = mkPayload([withExtra]);
    const f = makeFile(JSON.stringify(payload), 'p.json', 'application/json');

    // Act
    await importScreanState(f, 'page-1');

    // Assert
    const [, patchArg] = applyPatchMock.mock.calls[0]!;
    const added0 = (patchArg as { added: Array<Record<string, unknown>> }).added[0];

    // Disallowed properties must not exist
    expect(added0).not.toHaveProperty('id');
    expect(added0).not.toHaveProperty('label');
    expect(added0).not.toHaveProperty('extra');

    // Allowed properties must exist
    for (const k of ['anchor', 'size', 'color', 'shape', 'position', 'group', 'comment'] as const) {
      expect(added0).toHaveProperty(k);
    }
  });

  it('accepts .json by extension even if MIME is non-JSON', async () => {
    // Arrange
    getMock.mockResolvedValue({ items: [] });
    isValidPayloadMock.mockReturnValue(true);
    applyPatchMock.mockResolvedValue({ ok: true });

    const payload = mkPayload([mkItem(1, { kind: 'css', version: 1, value: '#a' })]);
    const f = makeFile(JSON.stringify(payload), 'any.json', 'text/plain');

    // Act & Assert
    await expect(importScreanState(f, 'page-1')).resolves.toBeDefined();
    expect(applyPatchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts application/json by MIME even if extension is non-JSON', async () => {
    // Arrange
    getMock.mockResolvedValue({ items: [] });
    isValidPayloadMock.mockReturnValue(true);
    applyPatchMock.mockResolvedValue({ ok: true });

    const payload = mkPayload([mkItem(1, { kind: 'css', version: 1, value: '#a' })]);
    const f = makeFile(JSON.stringify(payload), 'x.txt', 'application/json');

    // Act & Assert
    await expect(importScreanState(f, 'page-1')).resolves.toBeDefined();
    expect(applyPatchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts empty MIME ("") for browsers that omit type', async () => {
    // Arrange
    getMock.mockResolvedValue({ items: [] });
    isValidPayloadMock.mockReturnValue(true);
    applyPatchMock.mockResolvedValue({ ok: true });

    const payload = mkPayload([mkItem(1, { kind: 'css', version: 1, value: '#a' })]);
    const f = makeFile(JSON.stringify(payload), 'p.json', '');

    // Act & Assert
    await expect(importScreanState(f, 'page-1')).resolves.toBeDefined();
    expect(applyPatchMock).toHaveBeenCalledTimes(1);
  });

  it('works when current state is missing (treat as empty)', async () => {
    // Arrange
    getMock.mockResolvedValue(undefined);
    isValidPayloadMock.mockReturnValue(true);

    const items = [
      mkItem(2, { kind: 'css', version: 1, value: '#b' }),
      mkItem(1, { kind: 'css', version: 1, value: '#a' }),
    ];
    const payload = mkPayload(items);
    const f = makeFile(JSON.stringify(payload), 'p.json', 'application/json');

    const patched = { items: [{ id: 1 }, { id: 2 }] };
    applyPatchMock.mockResolvedValue(patched);

    // Act
    const result = await importScreanState(f, 'page-1');

    // Assert: all items are treated as new and passed in id-desc order
    const [, patchArg] = applyPatchMock.mock.calls[0]!;
    const added = (patchArg as { added: Array<Record<string, unknown>> }).added;
    const ordered = added.map((a) => (a.anchor as { value: string }).value);
    expect(ordered).toEqual(['#b', '#a']);

    expect(result).toEqual({
      state: patched,
      successMessage: 'import_succeeded_with_count',
    });
    expect(i18n.get).toHaveBeenCalledWith('import_succeeded_with_count', ['2']);
  });

  it('returns successMessage with the number of newly added items', async () => {
    // Arrange
    getMock.mockResolvedValue({ items: [] });
    isValidPayloadMock.mockReturnValue(true);

    const a = mkItem(1, { kind: 'css', version: 1, value: '#a' });
    const b = mkItem(2, { kind: 'css', version: 1, value: '#b' });
    const f = makeFile(JSON.stringify(mkPayload([a, b])), 'p.json', 'application/json');

    const patchedState = { items: [a, b] };
    applyPatchMock.mockResolvedValue(patchedState);

    // Act
    const { state, successMessage } = await importScreanState(f, 'page-1');

    // Assert
    expect(state).toBe(patchedState);
    expect(successMessage).toBe('import_succeeded_with_count');
    expect(i18n.get).toHaveBeenCalledTimes(1);
    expect(i18n.get).toHaveBeenCalledWith('import_succeeded_with_count', ['2']);
  });
});
