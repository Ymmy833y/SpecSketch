import type { RpcRequest, RpcResponse } from '@common/messages';
import { PortRpc } from '@panel/messaging/port_rpc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createPortMock(name = 'panel:test') {
  const msgListeners = new Set<(payload: unknown) => void>();
  const discListeners = new Set<() => void>();
  const postMessage = vi.fn<(msg: unknown) => void>();

  const port: chrome.runtime.Port = {
    name,
    onMessage: {
      addListener: (cb: (message: unknown) => void) => {
        msgListeners.add(cb);
      },
      removeListener: (cb: (message: unknown) => void) => {
        msgListeners.delete(cb);
      },
      hasListener: (cb: (message: unknown) => void) => msgListeners.has(cb),
      hasListeners: () => msgListeners.size > 0,
    } as unknown as chrome.events.Event<(message: unknown) => void>,
    onDisconnect: {
      addListener: (cb: () => void) => {
        discListeners.add(cb);
      },
      removeListener: (cb: () => void) => {
        discListeners.delete(cb);
      },
      hasListener: (cb: () => void) => discListeners.has(cb),
      hasListeners: () => discListeners.size > 0,
    } as unknown as chrome.events.Event<() => void>,
    postMessage: (message: unknown) => postMessage(message),
    disconnect: vi.fn<() => void>(() => {}),
  };

  const emitMessage = (m: unknown) => {
    for (const cb of msgListeners) cb(m);
  };
  const emitDisconnect = () => {
    for (const cb of discListeners) cb();
  };

  return { port, postMessage, emitMessage, emitDisconnect };
}

// ---- Helpers ----
const makeReq = (id: string, expectReply: boolean): RpcRequest =>
  ({
    id,
    expectReply,
  }) as RpcRequest;

// ---- Tests ----
describe('panel/messaging/port_rpc', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('resolves when a matching response arrives', async () => {
    const { port, postMessage, emitMessage } = createPortMock();
    const rpc = new PortRpc(port);

    const p = rpc.send(makeReq('r1', true), /*timeout*/ 1000);

    // Arrange a success response
    const res: RpcResponse = { id: 'r1', ok: true, data: { hello: 'world' } };
    emitMessage(res);

    await expect(p).resolves.toEqual(res);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('returns undefined immediately when expectReply is false', async () => {
    const { port, postMessage } = createPortMock();
    const rpc = new PortRpc(port);

    const result = await rpc.send(makeReq('nr1', false), 1000);
    expect(result).toBeUndefined();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'nr1' }));
  });

  it('times out and resolves undefined when no response arrives', async () => {
    vi.useFakeTimers();

    const { port } = createPortMock();
    const rpc = new PortRpc(port);

    const promise = rpc.send(makeReq('t1', true), 500);
    // No response; advance timers to trigger timeout
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
  });

  it('flushes all pendings with disconnected error on onDisconnect', async () => {
    const { port, emitDisconnect } = createPortMock();
    const rpc = new PortRpc(port);

    const p1 = rpc.send(makeReq('a', true), 5_000);
    const p2 = rpc.send(makeReq('b', true), 5_000);

    emitDisconnect();

    await expect(p1).resolves.toEqual({ id: '', ok: false, error: 'disconnected' });
    await expect(p2).resolves.toEqual({ id: '', ok: false, error: 'disconnected' });
  });

  it('cleans pending if postMessage throws and resolves undefined', async () => {
    const { port, postMessage, emitMessage } = createPortMock();
    postMessage.mockImplementation(() => {
      throw new Error('boom');
    });
    const rpc = new PortRpc(port);

    const p = rpc.send(makeReq('x1', true), 1000);
    await expect(p).resolves.toBeUndefined();

    // Even if a late response with the same id arrives, nothing should happen
    emitMessage({ id: 'x1', ok: true } satisfies RpcResponse);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores non-response messages and eventually times out', async () => {
    vi.useFakeTimers();

    const { port, emitMessage } = createPortMock();
    const rpc = new PortRpc(port);

    const p = rpc.send(makeReq('y1', true), 800);

    // Send a non-response-shaped message
    emitMessage({ foo: 'bar' });

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it('ignores responses with unmatched id while keeping pending', async () => {
    const { port, emitMessage } = createPortMock();
    const rpc = new PortRpc(port);

    const p = rpc.send(makeReq('z1', true), 1000);

    // Unmatched id -> should not resolve
    emitMessage({ id: 'other', ok: true } satisfies RpcResponse);

    // Now send the correct one
    const res: RpcResponse = { id: 'z1', ok: true, data: 123 };
    emitMessage(res);

    await expect(p).resolves.toEqual(res);
  });
});
