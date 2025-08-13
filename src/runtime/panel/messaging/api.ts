import { MSG_TYPE, PanelToContent, RpcRequest } from '@common/messages';
import { ScreenItem } from '@common/types';

import { PortRpc } from './port_rpc';

/**
 * Thin RPC wrapper for sending messages from Panel to Content.
 * Exposes high-level methods for each message type.
 */
export class PanelApi {
  constructor(private rpc: PortRpc) {}

  /**
   * Internal send helper that attaches an RPC request id as needed.
   *
   * @param body - Message payload to send
   * @returns Void-like when no reply is expected; otherwise resolves with a response
   */
  private send(body: PanelToContent) {
    const req: RpcRequest = {
      id: crypto.randomUUID(),
      expectReply: false,
      ...body
    };
    return this.rpc.send(req);
  }

  /**
   * Requests Content to render the given items.
   * @param items - Items to draw
   */
  render(items: ScreenItem[]) {
    return this.send({ type: MSG_TYPE.RENDER, payload: { items } });
  }

  /**
   * Toggles selection mode in Content.
   * @param enabled - True to enable
   */
  toggleSelect(enabled: boolean) {
    return this.send({ type: MSG_TYPE.TOGGLE_SELECT, payload: { enabled } });
  }

  /**
   * Clears the Content overlay.
   */
  clear() {
    return this.send({ type: MSG_TYPE.CLEAR });
  }

  /**
   * Performs a connectivity health check (round-trip).
   * Sent as a request expecting a reply.
   *
   * @returns The response, or undefined on timeout
   */
  ping() {
    const req: RpcRequest = {
      id: crypto.randomUUID(),
      expectReply: true,
      type: MSG_TYPE.PING
    };
    return this.rpc.send(req, 5000);
  }
}
