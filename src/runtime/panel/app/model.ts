import {
  type ItemColor,
  ItemGroup,
  type ItemPosition,
  type ItemShape,
  type ScreenItem,
  ThemeMode,
  UNGROUPED_VALUE,
} from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import type { StatusKey } from '@panel/view/status';

export type Model = {
  status: StatusKey;
  tabId: number | null;
  pageKey: string;

  pageKeys: string[];

  theme: ThemeMode;

  selectionEnabled: boolean;
  items: ScreenItem[];

  defaultSize: number;
  defaultColor: ItemColor;
  defaultShape: ItemShape;
  defaultPosition: ItemPosition;
  defaultGroup: ItemGroup;

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
  pageKeys: [],
  theme: 'device',
  selectionEnabled: false,
  items: [],
  defaultSize: 14,
  defaultColor: 'Blue',
  defaultShape: 'circle',
  defaultPosition: 'left-top-outside',
  defaultGroup: UNGROUPED_VALUE,
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
