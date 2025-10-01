import { isResponse, RpcRequest, RpcResponse } from '@common/messages';

/**
 * Implements a minimal request/response RPC over chrome.runtime.Port.
 * Tracks pending requests by id and handles timeouts and disconnects.
 */
export class PortRpc {
  private port: chrome.runtime.Port;
  private pending = new Map<string, (res?: RpcResponse) => void>();
  private alive = true;

  /**
   * Subscribes to port message and disconnect events.
   * @param port - The runtime.Port used for messaging
   */
  constructor(port: chrome.runtime.Port) {
    this.port = port;
    this.port.onMessage.addListener((msg) => {
      if (isResponse(msg)) {
        this.pending.get(msg.id)?.(msg);
        this.pending.delete(msg.id);
      }
    });
    this.port.onDisconnect.addListener(() => {
      this.alive = false;
      // Reasons such as BFCache may be included
      const reason = chrome.runtime.lastError?.message ?? 'disconnected';

      // Treat pending status as failure when a disconnection occurs.
      for (const [id, resolve] of this.pending) {
        resolve({ id, ok: false, error: reason });
      }
      this.pending.clear();
    });
  }

  // Get the current connection status
  get isAlive(): boolean {
    return this.alive;
  }

  /**
   * Sends an RPC request and optionally awaits a response.
   *
   * @param req - The RPC request to send
   * @param timeoutMs - Timeout (ms) when waiting for a reply (default 5000)
   * @returns The response when `expectReply` is true; otherwise undefined
   */
  send<T extends RpcRequest>(req: T, timeoutMs = 5000): Promise<RpcResponse | undefined> {
    return new Promise((resolve) => {
      // If already disconnected, immediately terminate (avoid Unchecked runtime.lastError)
      if (!this.alive) {
        return resolve(req.expectReply ? undefined : undefined);
      }

      if (req.expectReply) {
        const timer = setTimeout(() => {
          this.pending.delete(req.id);
          resolve(undefined);
        }, timeoutMs);
        this.pending.set(req.id, (res) => {
          clearTimeout(timer);
          resolve(res);
        });
      }
      try {
        this.port.postMessage(req);
      } catch {
        if (req.expectReply) this.pending.delete(req.id);
        resolve(undefined);
        return;
      }
      if (!req.expectReply) resolve(undefined);
    });
  }
}
