import { type BackgroundToPanel, type ContentToPanel, MSG_TYPE } from '@common/messages';
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { Action } from '@panel/app/actions';
import { initialModel, Model } from '@panel/app/model';
import { Effect, update } from '@panel/app/update';
import { connectToTab } from '@panel/messaging/connection';
import { capture } from '@panel/services/capture';
import { handleSelected } from '@panel/services/state';
import { getState, setState } from '@panel/state/store';
import { ActionType } from '@panel/types/action_types';
import { EffectType } from '@panel/types/effect_types';
import { UIEventType } from '@panel/types/ui_event_types';
import { PanelView } from '@panel/view/panel_view';
import { STATUS } from '@panel/view/status';

type Connection = Awaited<ReturnType<typeof connectToTab>>;

export class PanelController {
  private model: Model = structuredClone(initialModel);
  private conn: Connection | null = null;

  constructor(private view: PanelView) {}

  async start(): Promise<void> {
    this.dispatch({ type: ActionType.INIT });

    const tab = await getActiveTab();
    if (!tab?.id || isRestricted(tab.url)) {
      this.dispatch({ type: ActionType.SET_STATUS, status: STATUS.RESTRICTED });
      this.view.render(this.model);
      return;
    }

    const tabId = tab.id!;
    const key = pageKey(tab.url!);

    this.dispatch({ type: ActionType.CONNECTED, tabId, pageKey: key });
    this.dispatch({ type: ActionType.SET_STATUS, status: STATUS.CONNECTING });

    this.conn = await connectToTab(tabId);
    this.conn.onDisconnect(() => this.dispatch({ type: ActionType.PORT_DISCONNECTED }));

    // Receives messages from Content → Panel.
    this.conn.port.onMessage.addListener(async (msg: ContentToPanel) => {
      if (msg?.type === MSG_TYPE.SELECTED) {
        const newState = await handleSelected(this.model.pageKey, msg.payload.anchors);
        this.dispatch({
          type: ActionType.RESTORE_STATE,
          state: {
            items: newState.items,
            defaultSize: newState.defaultSize,
            defaultColor: newState.defaultColor,
            defaultShape: newState.defaultShape,
          },
        });
      }
    });

    // Receives messages from Background (SW) → Panel.
    chrome.runtime.onMessage.addListener((msg: BackgroundToPanel) => {
      if (msg?.type !== MSG_TYPE.CLOSE_PANEL) return;
      this.dispatch({ type: ActionType.CLOSE_PANEL_REQUESTED, tabId: msg.payload?.tabId });
    });

    const st = await getState(key);
    this.dispatch({
      type: ActionType.RESTORE_STATE,
      state: {
        items: st.items,
        defaultSize: st.defaultSize,
        defaultColor: st.defaultColor,
        defaultShape: st.defaultShape,
      },
    });
    this.dispatch({ type: ActionType.SET_STATUS, status: STATUS.CONNECTED });

    this.view.on(UIEventType.TOGGLE_SELECT, () =>
      this.dispatch({ type: ActionType.TOGGLE_SELECT }),
    );
    this.view.on(UIEventType.CLEAR, () => this.dispatch({ type: ActionType.CLEAR_ALL }));
    this.view.on(UIEventType.CAPTURE, () => this.dispatch({ type: ActionType.CAPTURE_REQUESTED }));

    this.view.on(UIEventType.BADGE_SIZE_CHANGE, ({ size }) =>
      this.dispatch({ type: ActionType.SET_BADGE_SIZE, size }),
    );
    this.view.on(UIEventType.BADGE_COLOR_SELECT, ({ color }) =>
      this.dispatch({ type: ActionType.SET_BADGE_COLOR, color }),
    );
    this.view.on(UIEventType.BADGE_SHAPE_CHANGE, ({ shape }) =>
      this.dispatch({ type: ActionType.SET_BADGE_SHAPE, shape }),
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

    this.view.on(UIEventType.REORDER_ITEMS, ({ fromId, toIndex }) =>
      this.dispatch({ type: ActionType.REORDER_ITEMS, fromId, toIndex }),
    );

    this.view.render(this.model);
  }

  private dispatch(action: Action): void {
    const { model: next, effects } = update(this.model, action);
    this.model = next;
    this.view.render(this.model);
    void this.execEffects(effects).catch(console.error);
  }

  private async execEffects(effects: Effect[]): Promise<void> {
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
        case EffectType.CLEAR_STATE:
          await setState(this.model.pageKey, {
            items: this.model.items,
            nextId: 1,
            nextLabel: 1,
            defaultSize: this.model.defaultSize,
            defaultColor: this.model.defaultColor,
            defaultShape: this.model.defaultShape,
          });
          break;
        case EffectType.PERSIST_STATE: {
          const prev = await getState(this.model.pageKey);
          await setState(this.model.pageKey, {
            ...prev,
            items: this.model.items,
            defaultSize: this.model.defaultSize,
            defaultColor: this.model.defaultColor,
            defaultShape: this.model.defaultShape,
          });
          break;
        }
        case EffectType.CAPTURE:
          try {
            await capture(fx.payload);
            this.dispatch({ type: ActionType.CAPTURE_SUCCEEDED });
          } catch (e) {
            this.dispatch({ type: ActionType.CAPTURE_FAILED, error: e });
          }
          break;
        case EffectType.CLOSE_PANEL_IF_MATCH:
          if (fx.tabId == null || fx.tabId === this.model.tabId) window.close();
          break;
        case EffectType.NOTIFY_ERROR:
          console.error(fx.error);
          break;
      }
    }
  }
}
