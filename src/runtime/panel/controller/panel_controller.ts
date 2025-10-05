import { BackgroundToPanel, type ContentToPanel, MSG_TYPE } from '@common/messages';
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { initialModel, Model } from '@panel/app/model';
import { update } from '@panel/app/update';
import { connectToTab } from '@panel/messaging/connection';
import { capture } from '@panel/services/capture';
import { handleSelected } from '@panel/services/state';
import { screenStateTable, themeTable } from '@panel/storage/tables';
import { Action, ActionType } from '@panel/types/action_types';
import { Effect, EffectType } from '@panel/types/effect_types';
import { UIEventType } from '@panel/types/ui_event_types';
import { PanelView } from '@panel/view/panel_view';
import { STATUS } from '@panel/view/status';

type Connection = Awaited<ReturnType<typeof connectToTab>>;
type EnsureResult = { ok: true; contextChanged: boolean } | { ok: false };

export class PanelController {
  private model: Model = structuredClone(initialModel);
  private conn: Connection | null = null;
  private currentWindowId: number | null = null;

  private static REQUIRES_CONN = new Set([
    EffectType.RENDER_CONTENT,
    EffectType.TOGGLE_SELECT_ON_CONTENT,
    EffectType.CLEAR_CONTENT,
    EffectType.HOVER,
  ]);

  constructor(private view: PanelView) {}

  async start(): Promise<void> {
    this.dispatch({ type: ActionType.INIT });

    const { ok } = await this.ensureConnectionAlive({ forceReconnect: true });
    if (!ok) {
      this.view.render(this.model);
      return;
    }

    this.registerViewHandlers();

    this.view.render(this.model);

    const w = await chrome.windows.getCurrent();
    this.currentWindowId = w.id ?? null;

    chrome.runtime.onMessage.addListener((msg: BackgroundToPanel) => {
      if (msg.type !== MSG_TYPE.ACTIVE_TAB_CHANGED) return;

      const senderWindowId = msg.payload.windowId;
      if (this.currentWindowId == null || this.currentWindowId !== senderWindowId) return;

      void this.ensureConnectionAlive({ forceReconnect: true });
    });
  }

  private registerViewHandlers() {
    this.view.on(UIEventType.TOGGLE_SELECT, () =>
      this.dispatch({ type: ActionType.TOGGLE_SELECT }),
    );
    this.view.on(UIEventType.CLEAR, () => this.dispatch({ type: ActionType.CLEAR_ALL }));
    this.view.on(UIEventType.CAPTURE, () =>
      this.dispatch({ type: ActionType.MEASURE_CONTENT_SIZE }),
    );

    this.view.on(UIEventType.BADGE_SIZE_CHANGE, ({ size }) =>
      this.dispatch({ type: ActionType.SET_BADGE_SIZE, size }),
    );
    this.view.on(UIEventType.BADGE_COLOR_SELECT, ({ color }) =>
      this.dispatch({ type: ActionType.SET_BADGE_COLOR, color }),
    );
    this.view.on(UIEventType.BADGE_SHAPE_CHANGE, ({ shape }) =>
      this.dispatch({ type: ActionType.SET_BADGE_SHAPE, shape }),
    );
    this.view.on(UIEventType.BADGE_DELETE, () => this.dispatch({ type: ActionType.BADGE_DELETE }));
    this.view.on(UIEventType.BADGE_POSITION_SELECT, ({ position }) =>
      this.dispatch({ type: ActionType.SET_BADGE_POSITION, position }),
    );

    this.view.on(UIEventType.TOGGLE_CAPTURE_PANEL, () =>
      this.dispatch({ type: ActionType.TOGGLE_CAPTURE_PANEL }),
    );
    this.view.on(UIEventType.CAPTURE_FORMAT_CHANGE, ({ format }) =>
      this.dispatch({ type: ActionType.SET_CAPTURE_FORMAT, format }),
    );
    this.view.on(UIEventType.CAPTURE_AREA_CHANGE, ({ area }) =>
      this.dispatch({ type: ActionType.SET_CAPTURE_AREA, area }),
    );
    this.view.on(UIEventType.CAPTURE_QUALITY_CHANGE, ({ quality }) =>
      this.dispatch({ type: ActionType.SET_CAPTURE_QUALITY, quality }),
    );
    this.view.on(UIEventType.CAPTURE_SCALE_CHANGE, ({ scale }) =>
      this.dispatch({ type: ActionType.SET_CAPTURE_SCALE, scale }),
    );

    this.view.on(UIEventType.REORDER_ITEMS, ({ fromId, fromIndex, toIndex }) =>
      this.dispatch({ type: ActionType.REORDER_ITEMS, fromId, fromIndex, toIndex }),
    );

    this.view.on(UIEventType.SET_GROUP, ({ group }) =>
      this.dispatch({ type: ActionType.SET_GROUP, group }),
    );

    this.view.on(
      UIEventType.ITEM_SELECTION_CHANGED,
      (
        payload:
          | { id: number; isCheck: boolean }
          | { group: string; isCheck: boolean }
          | { allCheck: boolean },
      ) => this.dispatch({ type: ActionType.ITEM_SELECTION_CHANGED, ...payload }),
    );
    this.view.on(UIEventType.ITEM_HOVER_IN, ({ id }) =>
      this.dispatch({ type: ActionType.ITEM_HOVER_IN, id }),
    );
    this.view.on(UIEventType.ITEM_HOVER_OUT, () =>
      this.dispatch({ type: ActionType.ITEM_HOVER_OUT }),
    );
    this.view.on(UIEventType.ITEM_COMMENT_APPLY, ({ id, comment }) =>
      this.dispatch({ type: ActionType.UPDATE_ITEM_COMMENT, id, comment }),
    );
    this.view.on(UIEventType.UPDATE_THEME, ({ theme }) =>
      this.dispatch({ type: ActionType.UPDATE_THEME, theme }),
    );
  }

  private dispatch(action: Action): void {
    const { model: next, effects } = update(this.model, action);
    this.model = next;
    this.view.render(this.model);
    void this.execEffects(effects).catch(console.error);
  }

  private async execEffects(effects: Effect[]): Promise<void> {
    const needsConn = effects.some((fx) => PanelController.REQUIRES_CONN.has(fx.kind));
    if (needsConn) {
      const r = await this.ensureConnectionAlive();
      if (!r.ok || r.contextChanged) return;
    }

    for (const fx of effects) {
      switch (fx.kind) {
        case EffectType.RENDER_CONTENT:
          await this.conn?.api.render(fx.items);
          break;
        case EffectType.TOGGLE_SELECT_ON_CONTENT:
          await this.conn?.api.toggleSelect(fx.enabled);
          break;
        case EffectType.CLEAR_CONTENT:
          await this.conn?.api.clear();
          break;
        case EffectType.HOVER:
          await this.conn?.api.hover(fx.id);
          break;
        case EffectType.CLEAR_STATE:
          await screenStateTable.set(this.model.pageKey, {
            items: this.model.items,
            nextId: 1,
            defaultSize: this.model.defaultSize,
            defaultColor: this.model.defaultColor,
            defaultShape: this.model.defaultShape,
            defaultPosition: this.model.defaultPosition,
            defaultGroup: this.model.defaultGroup,
          });
          break;
        case EffectType.PERSIST_STATE: {
          const prev = await screenStateTable.get(this.model.pageKey);
          await screenStateTable.set(this.model.pageKey, {
            ...prev,
            items: this.model.items,
            defaultSize: this.model.defaultSize,
            defaultColor: this.model.defaultColor,
            defaultShape: this.model.defaultShape,
            defaultPosition: this.model.defaultPosition,
            defaultGroup: this.model.defaultGroup,
          });
          break;
        }
        case EffectType.SET_THEME: {
          const theme = await themeTable.get();
          this.dispatch({ type: ActionType.SET_THEME, theme });
          break;
        }
        case EffectType.UPDATE_THEME:
          await themeTable.set(fx.theme);
          break;
        case EffectType.MEASURE_CONTENT_SIZE:
          await this.conn?.api.measureSize();
          break;
        case EffectType.CAPTURE:
          try {
            await capture(fx.payload);
            this.dispatch({ type: ActionType.CAPTURE_SUCCEEDED });
          } catch (e) {
            this.dispatch({ type: ActionType.CAPTURE_FAILED, error: e });
          }
          break;
        case EffectType.NOTIFY_ERROR:
          console.error(fx.error);
          break;
      }
    }
  }

  private async ensureConnectionAlive(opts?: { forceReconnect: boolean }): Promise<EnsureResult> {
    const prevKey = this.model.pageKey;
    const force = opts?.forceReconnect === true;

    if (!force) {
      const pong = await this.conn?.api.ping();
      if (pong !== undefined) return { ok: true, contextChanged: false };
    }

    const tab = await getActiveTab();
    if (!tab?.id || isRestricted(tab.url)) {
      this.dispatch({ type: ActionType.SET_STATUS, status: STATUS.RESTRICTED });
      return { ok: false };
    }

    const newKey = pageKey(tab.url!);
    const tabId = tab.id!;

    this.dispatch({ type: ActionType.CONNECTED, tabId, pageKey: newKey });
    this.dispatch({ type: ActionType.SET_STATUS, status: STATUS.CONNECTING });

    // Explicitly close the old port
    try {
      this.conn?.port.disconnect();
    } catch {
      /* no-op */
    }

    this.conn = await connectToTab(tabId);
    this.conn.onDisconnect(() => this.dispatch({ type: ActionType.PORT_DISCONNECTED }));
    this.conn.port.onMessage.addListener(async (msg: ContentToPanel) => {
      if (msg?.type === MSG_TYPE.SELECTED) {
        const s = await handleSelected(this.model.pageKey, msg.payload.anchors);
        this.dispatch({
          type: ActionType.RESTORE_STATE,
          state: {
            items: s.items,
            defaultSize: s.defaultSize,
            defaultColor: s.defaultColor,
            defaultShape: s.defaultShape,
            defaultPosition: s.defaultPosition,
            defaultGroup: s.defaultGroup,
          },
        });
      } else if (msg?.type === MSG_TYPE.MISSING_IDS) {
        this.dispatch({
          type: ActionType.SET_MISSING_IDS,
          missingIds: msg.payload.missingIds,
        });
      } else if (msg?.type === MSG_TYPE.CONTENT_SIZE_RESULT) {
        this.dispatch({
          type: ActionType.CAPTURE_REQUESTED,
          contentSize: msg.payload,
        });
      }
    });

    const st = await screenStateTable.get(newKey);
    this.dispatch({
      type: ActionType.RESTORE_STATE,
      state: {
        items: st.items,
        defaultSize: st.defaultSize,
        defaultColor: st.defaultColor,
        defaultShape: st.defaultShape,
        defaultPosition: st.defaultPosition,
        defaultGroup: st.defaultGroup,
      },
    });

    this.dispatch({ type: ActionType.SET_STATUS, status: STATUS.CONNECTED });
    const contextChanged = !!prevKey && prevKey !== newKey;
    return { ok: true, contextChanged };
  }
}
