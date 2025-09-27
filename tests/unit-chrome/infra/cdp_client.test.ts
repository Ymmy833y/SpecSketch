import { attachOwned, type Debuggee, detachOwned, send } from '@infra/cdp/cdp_client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DETACH_REASON, emitDebuggerOnDetach, simulateLastError } from '../../setup/chrome.setup';

describe('infra/cdp/cdp_client', () => {
  const c = (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome;
  const attach = vi.mocked(c.debugger.attach);
  const detach = vi.mocked(c.debugger.detach);
  const sendCommand = vi.mocked(c.debugger.sendCommand);

  const target: Debuggee = { tabId: 1 } as unknown as Debuggee;
  const fresh = (id: number): Debuggee => ({ tabId: id }) as unknown as Debuggee;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attachOwned', () => {
    it('resolves true when newly attached (and records ownership)', async () => {
      attach.mockImplementationOnce(((_t, _v, cb) => cb?.()) as typeof chrome.debugger.attach);
      const ok = await attachOwned(target);
      expect(ok).toBe(true);
      expect(c.debugger.attach).toHaveBeenCalledTimes(1);
      expect(c.debugger.attach).toHaveBeenCalledWith(
        target,
        expect.any(String),
        expect.any(Function),
      );
    }, 1000);

    it('resolves false when already attached but owned by this extension (reuse)', async () => {
      attach.mockImplementationOnce(((_t, _v, cb) => cb?.()) as typeof chrome.debugger.attach);
      await attachOwned(target);

      // "Another debugger..." error → false if already owned
      attach.mockImplementationOnce(((_t, _v, cb) => {
        return simulateLastError('Another debugger is already attached', () => cb?.());
      }) as typeof chrome.debugger.attach);

      const reused = await attachOwned(target);
      expect(reused).toBe(false);
      expect(c.debugger.attach).toHaveBeenCalledTimes(2);
    }, 1000);

    it('rejects when already attached by another client (not owned)', async () => {
      const t2 = fresh(99);
      attach.mockImplementationOnce(((_t, _v, cb) => {
        return simulateLastError('Another debugger is already attached', () => cb?.());
      }) as typeof chrome.debugger.attach);

      await expect(attachOwned(t2)).rejects.toThrow(
        'Debugger is already attached by another client (DevTools/extension).',
      );
      expect(c.debugger.attach).toHaveBeenCalledTimes(1);
    }, 1000);

    it('rejects with other attach errors (propagates message)', async () => {
      const t3 = fresh(100);
      attach.mockImplementationOnce(((_t, _v, cb) => {
        return simulateLastError('Some other attach error', () => cb?.());
      }) as typeof chrome.debugger.attach);

      await expect(attachOwned(t3)).rejects.toThrow('Some other attach error');
      expect(c.debugger.attach).toHaveBeenCalledTimes(1);
    }, 1000);
  });

  describe('detachOwned', () => {
    it('no-ops when target is not owned (does not call chrome.debugger.detach)', async () => {
      const t2 = fresh(200); // Unowned ID
      await detachOwned(t2);
      expect(detach).not.toHaveBeenCalled();
    }, 1000);

    it('detaches when owned, then clears ownership (2nd call is no-op)', async () => {
      attach.mockImplementationOnce(((_t, _v, cb) => cb?.()) as typeof chrome.debugger.attach);
      await attachOwned(target);

      await detachOwned(target);
      await detachOwned(target);

      expect(detach).toHaveBeenCalledTimes(1);
      expect(detach).toHaveBeenCalledWith(target, expect.any(Function));
    }, 1000);

    it('onDetach listener clears ownership; then detachOwned is a no-op', async () => {
      attach.mockImplementationOnce(((_t, _v, cb) => cb?.()) as typeof chrome.debugger.attach);
      await attachOwned(target);
      emitDebuggerOnDetach(
        { tabId: target.tabId } as chrome.debugger.Debuggee,
        DETACH_REASON.TARGET_CLOSED,
      );

      await detachOwned(target);
      expect(detach).not.toHaveBeenCalled();
    }, 1000);
  });

  describe('send', () => {
    it('send: resolves with result when sendCommand returns a value', async () => {
      // Arrange
      sendCommand.mockImplementationOnce(((_t, _m, _p, cb) => {
        cb?.({ ok: true });
      }) as typeof chrome.debugger.sendCommand);

      // Act
      const res = await send<{ ok: boolean }>(target, 'Foo', { a: 1 });

      // Assert
      expect(c.debugger.sendCommand).toHaveBeenCalledTimes(1);
      expect(c.debugger.sendCommand).toHaveBeenCalledWith(
        target,
        'Foo',
        { a: 1 },
        expect.any(Function),
      );
      expect(res).toEqual({ ok: true });
    }, 1000);

    it('send: uses {} when params is omitted', async () => {
      // Act
      const res = await send(target, 'Bar');

      // Assert
      expect(c.debugger.sendCommand).toHaveBeenCalledTimes(1);
      expect(c.debugger.sendCommand).toHaveBeenCalledWith(target, 'Bar', {}, expect.any(Function));
      expect(typeof res).toBe('object');
    }, 1000);

    it('send: rejects with lastError message', async () => {
      // Arrange: sendCommand will call back something (it is assumed the value is not visible)
      sendCommand.mockImplementationOnce(((...args: unknown[]) => {
        const cb = args[3] as ((res?: object) => void) | undefined;
        cb?.({});
      }) as typeof chrome.debugger.sendCommand);

      // Act & Assert
      await expect(
        simulateLastError('send failed', () => send(target, 'Baz', { b: 2 })),
      ).rejects.toThrow('send failed');

      expect(c.debugger.sendCommand).toHaveBeenCalledTimes(1);
    }, 1000);

    it('send: returns {} when callback receives undefined', async () => {
      // Arrange
      sendCommand.mockImplementationOnce(((...args: unknown[]) => {
        const cb = args[3] as ((res?: object) => void) | undefined;
        cb?.({});
      }) as typeof chrome.debugger.sendCommand);

      // Act
      const res = await send(target, 'Qux', { c: 3 });

      // Assert
      expect(res).toEqual({});
    }, 1000);
  });
});
