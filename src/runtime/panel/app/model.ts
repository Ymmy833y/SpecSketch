import type { ItemColor, ItemPosition, ItemShape, ScreenItem } from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import type { StatusKey } from '@panel/view/status';

export type Model = {
  status: StatusKey;
  tabId: number | null;
  pageKey: string;

  selectionEnabled: boolean;
  items: ScreenItem[];

  nextLabel: number;
  defaultSize: number;
  defaultColor: ItemColor;
  defaultShape: ItemShape;
  defaultPosition: ItemPosition;

  capture: {
    format: CaptureFormat; // 'png' | 'jpeg'
    area: CaptureArea; // 'full' | 'viewport'
    quality: number; // jpeg only
    scale: number;
    panelExpanded: boolean;
  };

  selectItems: ScreenItem['id'][];
  missingIds: ScreenItem['id'][];
};

export const initialModel: Model = {
  status: 'DISCONNECTED',
  tabId: null,
  pageKey: '',
  selectionEnabled: false,
  items: [],
  nextLabel: 1,
  defaultSize: 14,
  defaultColor: 'Blue',
  defaultShape: 'circle',
  defaultPosition: 'left-top-outside',
  capture: {
    format: 'png',
    area: 'full',
    quality: 90,
    scale: 1,
    panelExpanded: false,
  },
  selectItems: [],
  missingIds: [],
};
