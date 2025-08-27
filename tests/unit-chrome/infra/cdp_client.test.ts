import { attach, CDP_VERSION, type Debuggee, detach, send } from '@infra/cdp/cdp_client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { simulateLastError } from '../../setup/chrome.setup';

describe('infra/cdp/cdp_client', () => {
  const c = (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome;
  const sendCommand = vi.mocked(c.debugger.sendCommand);

  const target: Debuggee = { tabId: 1 } as unknown as Debuggee;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attach', () => {
    it('attach: resolves when no lastError', async () => {
      await attach(target);

      // Assert
      expect(c.debugger.attach).toHaveBeenCalledTimes(1);
      expect(c.debugger.attach).toHaveBeenCalledWith(target, CDP_VERSION, expect.any(Function));
    }, 1000);

    it('attach: rejects with lastError message', async () => {
      // Arrange & Act & Assert
      await expect(simulateLastError('attach failed', () => attach(target))).rejects.toThrow(
        'attach failed',
      );

      expect(c.debugger.attach).toHaveBeenCalledTimes(1);
    }, 1000);
  });

  describe('detach', () => {
    it('detach: resolves', async () => {
      // Act
      await detach(target);

      // Assert
      expect(c.debugger.detach).toHaveBeenCalledTimes(1);
      expect(c.debugger.detach).toHaveBeenCalledWith(target, expect.any(Function));
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
