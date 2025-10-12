import {
  type ItemColor,
  ItemGroup,
  type ItemPosition,
  type ItemShape,
  LabelFormat,
  type ScreenItem,
  ThemeMode,
  ToastMessage,
  UNGROUPED_VALUE,
} from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import type { StatusKey } from '@panel/types/status';

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
  defaultLabelFormat: LabelFormat;
  defaultVisible: boolean;
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

  toastMessages: ToastMessage[];
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
  defaultLabelFormat: 'Numbers',
  defaultVisible: true,
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
  toastMessages: [],
};
