import { ScreenItem } from '@common/types';

export type Effect =
  | { kind: 'RenderContent'; items: ScreenItem[] }
  | { kind: 'ToggleSelectOnContent'; enabled: boolean }
  | { kind: 'ClearContent' }
  | {
      kind: 'Capture';
      payload: {
        tabId: number;
        format: 'png' | 'jpeg';
        area: 'full' | 'viewport';
        quality: number;
        scale: number;
      };
    }
  | { kind: 'PersistState' }
  | { kind: 'ClosePanelIfMatch'; tabId?: number }
  | { kind: 'NotifyError'; error: unknown };
