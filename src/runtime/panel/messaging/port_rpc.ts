import { isResponse, RpcRequest, RpcResponse } from '@common/messages';

/**
 * Implements a minimal request/response RPC over chrome.runtime.Port.
 * Tracks pending requests by id and handles timeouts and disconnects.
 */
export class PortRpc {
  private port: chrome.runtime.Port;
  private pending = new Map<string, (res?: RpcResponse) => void>();

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
      // Treat pending status as failure when a disconnection occurs.
      for (const [, resolve] of this.pending) resolve({ id: '', ok: false, error: 'disconnected' });
      this.pending.clear();
    });
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
      this.port.postMessage(req);
      if (!req.expectReply) resolve(undefined);
    });
  }
}
