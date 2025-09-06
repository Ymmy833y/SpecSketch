import { MSG_TYPE } from '@common/messages';
import type { ScreenItem } from '@common/types';
import { PanelApi } from '@panel/messaging/api';
import type { PortRpc } from '@panel/messaging/port_rpc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MinimalCrypto = { randomUUID: () => string };

type MockLike<TArgs extends unknown[]> = { mock: { calls: TArgs[] } };
function onlyCall<TArgs extends unknown[]>(m: MockLike<TArgs>): TArgs {
  if (m.mock.calls.length !== 1) throw new Error('expected exactly one call');
  const first = m.mock.calls[0];
  if (!first) throw new Error('no call captured');
  return first;
}

describe('panel/messaging/api/PanelApi', () => {
  let sendMock: ReturnType<typeof vi.fn<(req: unknown, timeoutMs?: number) => Promise<unknown>>>;
  let rpc: PortRpc;
  let api: PanelApi;

  let originalCrypto: unknown;
  let uuidSpy: ReturnType<typeof vi.spyOn> | undefined;
  let seq = 0;

  beforeEach(() => {
    vi.restoreAllMocks();
    seq = 0;

    originalCrypto = (globalThis as Record<string, unknown>).crypto;
    if (
      !('crypto' in globalThis) ||
      typeof (globalThis as { crypto?: Partial<MinimalCrypto> }).crypto?.randomUUID !== 'function'
    ) {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: { randomUUID: () => `uuid-${++seq}` },
      });
    }
    uuidSpy = vi
      .spyOn(globalThis.crypto as MinimalCrypto, 'randomUUID')
      .mockImplementation(() => `uuid-${++seq}`);

    sendMock = vi.fn(async (_req: unknown, _timeout?: number) => undefined);
    rpc = { send: sendMock as unknown as PortRpc['send'] } as unknown as PortRpc;

    api = new PanelApi(rpc);
  });

  afterEach(() => {
    uuidSpy?.mockRestore();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
  });

  describe('render', () => {
    it('forwards items with expectReply=false (single arg, no timeout param)', async () => {
      // Arrange
      const items = [{ id: 1 }, { id: 2 }] as unknown as ScreenItem[];

      // Act
      await api.render(items);

      // Assert
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-1',
          type: MSG_TYPE.RENDER,
          expectReply: false,
          payload: { items },
        }),
      );
    });
  });

  describe('toggleSelect', () => {
    it('forwards enabled flag with expectReply=false (single arg)', async () => {
      // Arrange
      // (no special arrange)

      // Act
      await api.toggleSelect(true);
      await api.toggleSelect(false);

      // Assert
      expect(sendMock).toHaveBeenCalledTimes(2);

      expect(sendMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: 'uuid-1',
          type: MSG_TYPE.TOGGLE_SELECT,
          expectReply: false,
          payload: { enabled: true },
        }),
      );

      expect(sendMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: 'uuid-2',
          type: MSG_TYPE.TOGGLE_SELECT,
          expectReply: false,
          payload: { enabled: false },
        }),
      );
    });
  });

  describe('clear', () => {
    it('sends CLEAR without payload and expectReply=false (single arg)', async () => {
      // Arrange
      // (no special arrange)

      // Act
      await api.clear();

      // Assert
      expect(sendMock).toHaveBeenCalledTimes(1);

      // Strictly verify that there is no "payload" key
      const [arg1] = onlyCall(sendMock as unknown as MockLike<[Record<string, unknown>]>);
      expect(arg1).toMatchObject({
        id: 'uuid-1',
        type: MSG_TYPE.CLEAR,
        expectReply: false,
      });
      expect('payload' in arg1).toBe(false);
    });
  });

  describe('hover', () => {
    it('clears hover highlight with expectReply=false (single arg)', async () => {
      // Arrange
      // (no special arrange)

      // Act
      await api.hover(null);

      // Assert
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-1',
          type: MSG_TYPE.HOVER,
          expectReply: false,
          payload: { id: null },
        }),
      );
    });

    it('sets hover highlight with expectReply=false (single arg)', async () => {
      // Arrange
      // (no special arrange)

      // Act
      await api.hover(5);

      // Assert
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-1',
          type: MSG_TYPE.HOVER,
          expectReply: false,
          payload: { id: 5 },
        }),
      );
    });
  });

  describe('ping', () => {
    it('expectReply=true with 5000ms timeout and resolves value from rpc', async () => {
      // Arrange
      sendMock.mockResolvedValueOnce('pong');

      // Act
      const res = await api.ping();

      // Assert
      expect(res).toBe('pong');
      expect(sendMock).toHaveBeenCalledTimes(1);

      // First arg: request (PING / expectReply=true / no payload), second arg: 5000
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-1',
          type: MSG_TYPE.PING,
          expectReply: true,
        }),
        5000,
      );

      // Strictly verify that there is no "payload" key when expectReply=true
      const [arg1] = onlyCall(sendMock as unknown as MockLike<[Record<string, unknown>, number]>);
      expect('payload' in arg1).toBe(false);
    });
  });

  it('assigns distinct request ids across multiple calls', async () => {
    // Arrange
    // (no special arrange)

    // Act
    await api.render([] as unknown as ScreenItem[]);
    await api.clear();

    // Assert
    expect(sendMock).toHaveBeenCalledTimes(2);

    expect(sendMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'uuid-1' }));
    expect(sendMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'uuid-2' }));
  });
});
