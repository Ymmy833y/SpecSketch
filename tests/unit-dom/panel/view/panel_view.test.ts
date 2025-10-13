import '@testing-library/jest-dom';

import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

// ---- Module mocks (declare BEFORE importing SUT) ----
vi.mock('@common/i18n', () => ({
  default: {
    localize: vi.fn((_doc: Document) => undefined),
    get: vi.fn((key: string) => {
      const dict: Record<string, string> = {
        toggle_on: 'ON',
        toggle_off: 'OFF',
        group_ungrouped: '(Ungrouped)',
        common_create: 'Create',
        common_cancel: 'Cancel',
        group_new_placeholder: 'Group name',
        missing_item: 'Missing element',
      };
      return dict[key] ?? key;
    }),
  },
}));

vi.mock('@panel/types/status', () => {
  const STATUS = {
    RESTRICTED: 'RESTRICTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECTED: 'DISCONNECTED',
  } as const;

  const STATUS_CLASS_BY_KEY = {
    RESTRICTED: 'connect-status--restricted',
    CONNECTING: 'connect-status--connecting',
    CONNECTED: 'connect-status--connected',
    DISCONNECTED: 'connect-status--disconnected',
  } as const;

  const STATUS_MSG_KEY = {
    RESTRICTED: 'status_restricted',
    CONNECTING: 'status_connecting',
    CONNECTED: 'status_connected',
    DISCONNECTED: 'status_disconnected',
  } as const;

  return {
    STATUS,
    STATUS_CLASS_BY_KEY,
    getStatusMessage: (k: keyof typeof STATUS) => STATUS_MSG_KEY[k],
  };
});

vi.mock('@common/types', () => {
  const validColors = new Set(['Blue', 'Red', 'Gray']);
  const validShapes = new Set(['circle', 'square']);
  const validPositions = new Set(['left-top-outside', 'right-top-outside', 'top-outside']);
  const validLabelFormats = new Set(['Numbers', 'UpperAlpha', 'LowerAlpha', 'None']); // ← 追加
  return {
    isItemColor: (v: unknown) => typeof v === 'string' && validColors.has(v),
    isItemShape: (v: unknown) => typeof v === 'string' && validShapes.has(v),
    isItemPosition: (v: unknown) => typeof v === 'string' && validPositions.has(v),
    isLabelFormat: (v: unknown) => typeof v === 'string' && validLabelFormats.has(v), // ← 追加
    UNGROUPED: '__ungrouped__',
  };
});

vi.mock('@common/icons', () => {
  return {
    getIcon: (name: string) => {
      switch (name) {
        case 'caretRight':
          return { d: 'M2 2L10 10', viewBox: '0 0 20 20' };
        case 'caretDown':
          return { d: 'M2 2L10 2', viewBox: '0 0 20 20' };
        case 'caretRightFill':
          return { d: 'M3 3L11 11', viewBox: '0 0 20 20' };
        case 'caretDownFill':
          return { d: 'M3 3L11 3', viewBox: '0 0 20 20' };
        case 'warn':
          return { d: 'M1 1L1 1', viewBox: '0 0 20 20' };
        default:
          return { d: 'M0 0L0 0', viewBox: '0 0 20 20' };
      }
    },
  };
});

// ---- Import SUT after mocks ----
import {
  type ItemColor,
  ItemGroup,
  type ItemPosition,
  type ItemShape,
  LabelFormat,
  type ScreenItem,
} from '@common/types';
import { Model } from '@panel/app/model';
import { STATUS } from '@panel/types/status';
import { UIEventType } from '@panel/types/ui_event_types';
import { PanelView } from '@panel/view/panel_view';

// ---- Helpers ----
const basePanelHtml = () => `
<div id="panel-root">
  <div class="toolbar">
    <span id="status"></span>
    <button id="setting-button" type="button" data-ignore-disable="true"></button>
    <button id="toggle-select"><span id="toggle-select-icon"></span><span id="toggle-select-label"></span></button>
    <button id="clear">Clear</button>
    <button id="capture">Capture</button>
    <button id="capture-options-toggle" aria-expanded="false">▼</button>
  </div>

  <div id="capture-options" class="hidden">
    <div>
      <label><input type="radio" name="capture-format" value="png" checked> png</label>
      <label><input type="radio" name="capture-format" value="jpeg"> jpeg</label>
    </div>
    <div>
      <label><input type="radio" name="capture-area" value="full" checked> full</label>
      <label><input type="radio" name="capture-area" value="viewport"> viewport</label>
    </div>

    <div class="jpeg-only hidden">
      <input id="jpeg-quality-range" type="range" min="50" max="95" step="5" value="80">
      <input id="jpeg-quality-number" type="number" min="50" max="95" step="5" value="80">
    </div>

    <div>
      <input id="capture-scale-range" type="range" min="1" max="3" step="0.5" value="1">
      <input id="capture-scale-number" type="number" min="1" max="3" step="0.5" value="1">
    </div>
  </div>

  <div class="badge">
    <input id="badge-size-range" type="range" min="8" max="32" step="1" value="16">
    <input id="badge-size-number" type="number" min="8" max="32" step="1" value="16">
    <div id="badge-color-pop">
      <button type="button" data-color-name="Blue">Blue</button>
      <button type="button" data-color-name="Gray">Gray</button>
      <button type="button" data-color-name="Invalid">Invalid</button>
    </div>
    <span id="badge-color-label"></span>
    <span id="badge-color-dot" class="inline-block w-4 h-4 rounded-full"></span>
    <select id="badge-shape-select">
      <option value="circle" selected>circle</option>
      <option value="square">square</option>
    </select>
    <select id="badge-visible-select" name="badgeVisible">
      <option value="true" selected>Show</option>
      <option value="false">Hide</option>
    </select>
    <select id="badge-label-format-select" name="labelFormat">
      <option value="Numbers">Numbers</option>
      <option value="UpperAlpha">UpperAlpha</option>
      <option value="LowerAlpha">LowerAlpha</option>
      <option value="None">None</option>
    </select>
    <button id="badge-delete-button" type="button">Delete</button>
    <span id="badge-position-label"></span>
    <div id="badge-position-pop">
      <button type="button" data-position-name="left-top-outside"></button>
      <button type="button" data-position-name="right-top-outside"></button>
      <button type="button" data-position-name="top-outside"></button>
    </div>
    <select id="badge-group-select"></select>
  </div>

  <div id="list-wrap">
    <label><input type="checkbox" name="item-select" value="all"></label>
    <span id="select-count">0</span>
    <div id="select-empty" class="hidden">Empty</div>
    <div id="select-list"></div>
  </div>
  <div id="group-name-modal" class="hidden">
    <input id="group-name-input"/>
    <button id="group-name-cancel-btn"></button>
    <button id="group-name-create-btn"></button>
  </div>
  <div id="item-comment-modal" class="hidden">
    <textarea id="item-comment-input"></textarea>
    <input id="item-comment-id-input"/>
    <button id="item-comment-cancel-btn"></button>
    <button id="item-comment-apply-btn"></button>
  </div>
  
  <div id="setting-modal" class="modal-base hidden" aria-labelledby="create-group-title" role="dialog">
    <button id="setting-close-btn" type="button" data-ignore-disable="true"></button>
    <button id="theme-light-btn" type="button" data-ignore-disable="true"></button>
    <button id="theme-dark-btn" type="button" data-ignore-disable="true"></button>
    <button id="theme-device-btn" type="button" data-ignore-disable="true"></button>
    <input id="import-file-input" type="file" accept=".json,application/json" />
    <button id="import-btn" type="button"></button>
    <span id="store-count"></span>
    <ul id="store-list"></ul>
    <div id="store-empty" class="hidden"></div>
  </div>

  <div id="toast-parent"></div>
</div>
`;

function setupView() {
  document.body.innerHTML = basePanelHtml();
  const view = new PanelView(document);
  return view;
}

function makeItem(id: number, label: number, anchor: string, group?: string | null): ScreenItem {
  return {
    id,
    label,
    anchor: { value: anchor },
    group: group ?? '',
  } as unknown as ScreenItem;
}

function renderWithModel(view: PanelView, model: Partial<Record<string, unknown>> = {}) {
  const m: Model = {
    tabId: 1,
    pageKey: 'test',
    pageKeys: [],
    theme: 'device',
    status: STATUS.CONNECTED,
    selectionEnabled: true,
    items: [] as ScreenItem[],
    selectItems: [] as number[],
    missingIds: [] as number[],
    capture: {
      format: 'png',
      area: 'full',
      quality: 80,
      scale: 1,
      panelExpanded: false,
    },
    defaultSize: 16,
    defaultColor: 'Gray' as ItemColor,
    defaultShape: 'circle' as ItemShape,
    defaultLabelFormat: 'Numbers' as LabelFormat,
    defaultVisible: true,
    defaultPosition: 'left-top-outside' as ItemPosition,
    defaultGroup: '' as ItemGroup,
    toastMessages: [],
    ...model,
  };
  view.render(m);
}

export function lastCallArg<T>(
  mockFn: Pick<MockInstance, 'mock'> | { mock: { calls: unknown[][] } },
  argIndex = 0,
): T | undefined {
  const last = mockFn.mock.calls.at(-1); // unknown[] | undefined
  return last?.[argIndex] as T | undefined;
}

// ---- Tests ----
describe('panel/view/panel_view', () => {
  // Prepare a matchMedia mockup
  const makeMatchMedia = (matches: boolean) =>
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.matchMedia = makeMatchMedia(false);
  });

  it('renderStatus applies class and text per StatusKey', () => {
    const v = setupView();

    // DISCONNECTED
    renderWithModel(v, { status: 'DISCONNECTED' });
    const s1 = document.querySelector('#status') as HTMLSpanElement;
    expect(s1).toHaveTextContent('status_disconnected');
    expect(s1.className).toBe('connect-status connect-status--disconnected');
    expect(s1.querySelector('.connect-status-dot')).toBeInTheDocument();

    // CONNECTING
    renderWithModel(v, { status: 'CONNECTING' });
    const s2 = document.querySelector('#status') as HTMLSpanElement;
    expect(s2).toHaveTextContent('status_connecting');
    expect(s2.className).toBe('connect-status connect-status--connecting');

    // RESTRICTED
    renderWithModel(v, { status: 'RESTRICTED' });
    const s3 = document.querySelector('#status') as HTMLSpanElement;
    expect(s3).toHaveTextContent('status_restricted');
    expect(s3.className).toBe('connect-status connect-status--restricted');

    // CONNECTED
    renderWithModel(v, { status: 'CONNECTED' });
    const s4 = document.querySelector('#status') as HTMLSpanElement;
    expect(s4).toHaveTextContent('status_connected');
    expect(s4.className).toBe('connect-status connect-status--connected');
  });

  it('disableFormControls policy: CONNECTED enables all, CONNECTING/DISCONNECTED enable only ignored, RESTRICTED disables all', () => {
    const v = setupView();

    // Helper to snapshot key controls
    const pick = () => ({
      toggle: document.querySelector('#toggle-select') as HTMLButtonElement,
      clear: document.querySelector('#clear') as HTMLButtonElement,
      capture: document.querySelector('#capture') as HTMLButtonElement,
      toggleCapture: document.querySelector('#capture-options-toggle') as HTMLButtonElement,
      ignoredSetting: document.querySelector('#setting-button') as HTMLButtonElement,
      ignoredClose: document.querySelector('#setting-close-btn') as HTMLButtonElement,
      themeLight: document.querySelector('#theme-light-btn') as HTMLButtonElement,
      shapeSelect: document.querySelector('#badge-shape-select') as HTMLSelectElement,
      scaleNum: document.querySelector('#capture-scale-number') as HTMLInputElement,
      commentText: document.querySelector('#item-comment-input') as HTMLTextAreaElement,
      jpegNum: document.querySelector('#jpeg-quality-number') as HTMLInputElement,
      jpegRange: document.querySelector('#jpeg-quality-range') as HTMLInputElement,
    });

    // DISCONNECTED → only data-ignore-disable remains enabled
    renderWithModel(v, {
      status: 'DISCONNECTED',
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });
    let c = pick();
    expect(c.toggle).toBeDisabled();
    expect(c.clear).toBeDisabled();
    expect(c.capture).toBeDisabled();
    expect(c.toggleCapture).toBeDisabled();
    expect(c.shapeSelect).toBeDisabled();
    expect(c.scaleNum).toBeDisabled();
    expect(c.commentText).toBeDisabled();
    expect(c.ignoredSetting).not.toBeDisabled();
    expect(c.ignoredClose).not.toBeDisabled();
    expect(c.themeLight).not.toBeDisabled();
    // JPEG-only is disabled in the UI because format=png
    expect(c.jpegNum).toBeDisabled();
    expect(c.jpegRange).toBeDisabled();
    // list has inert (enableIgnoreOnly = true)
    expect(document.querySelector('#select-list')).toHaveAttribute('inert');

    // CONNECTING → The rules are the same as for DISCONNECTED (only ignore is valid)
    renderWithModel(v, {
      status: 'CONNECTING',
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });
    c = pick();
    expect(c.toggle).toBeDisabled();
    expect(c.clear).toBeDisabled();
    expect(c.capture).toBeDisabled();
    expect(c.toggleCapture).toBeDisabled();
    expect(c.shapeSelect).toBeDisabled();
    expect(c.scaleNum).toBeDisabled();
    expect(c.commentText).toBeDisabled();
    expect(c.ignoredSetting).not.toBeDisabled();
    expect(c.ignoredClose).not.toBeDisabled();
    expect(c.themeLight).not.toBeDisabled();
    expect(c.jpegNum).toBeDisabled();
    expect(c.jpegRange).toBeDisabled();
    // list has inert (enableIgnoreOnly = true)
    expect(document.querySelector('#select-list')).toHaveAttribute('inert');

    // RESTRICTED → All disabled (including ignore)
    renderWithModel(v, {
      status: 'RESTRICTED',
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });
    c = pick();
    expect(c.toggle).toBeDisabled();
    expect(c.clear).toBeDisabled();
    expect(c.capture).toBeDisabled();
    expect(c.toggleCapture).toBeDisabled();
    expect(c.shapeSelect).toBeDisabled();
    expect(c.scaleNum).toBeDisabled();
    expect(c.commentText).toBeDisabled();
    expect(c.ignoredSetting).toBeDisabled();
    expect(c.ignoredClose).toBeDisabled();
    expect(c.themeLight).toBeDisabled();
    expect(c.jpegNum).toBeDisabled();
    expect(c.jpegRange).toBeDisabled();
    // list has inert (enableNone = true)
    expect(document.querySelector('#select-list')).toHaveAttribute('inert');

    // CONNECTED → All are valid (however, JPEG-only is disabled by UI specification because format=png)
    renderWithModel(v, {
      status: 'CONNECTED',
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });
    c = pick();
    expect(c.toggle).not.toBeDisabled();
    expect(c.clear).not.toBeDisabled();
    expect(c.capture).not.toBeDisabled();
    expect(c.toggleCapture).not.toBeDisabled();
    expect(c.shapeSelect).not.toBeDisabled();
    expect(c.scaleNum).not.toBeDisabled();
    expect(c.commentText).not.toBeDisabled();
    expect(c.ignoredSetting).not.toBeDisabled();
    expect(c.ignoredClose).not.toBeDisabled();
    expect(c.themeLight).not.toBeDisabled();
    // PNG → JPEG-only is still disabled in the UI.
    expect(c.jpegNum).toBeDisabled();
    expect(c.jpegRange).toBeDisabled();
    // list does NOT have inert (enableAll = true)
    expect(document.querySelector('#select-list')).not.toHaveAttribute('inert');
  });

  it('emits toggle/clear/capture button events', () => {
    const v = setupView();
    const onToggle = vi.fn();
    const onClear = vi.fn();
    const onCapture = vi.fn();
    v.on(UIEventType.TOGGLE_SELECT, onToggle);
    v.on(UIEventType.CLEAR, onClear);
    v.on(UIEventType.CAPTURE, onCapture);

    (document.querySelector('#toggle-select') as HTMLButtonElement).click();
    (document.querySelector('#clear') as HTMLButtonElement).click();
    (document.querySelector('#capture') as HTMLButtonElement).click();

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it('toggles JPEG-only UI and emits capture format/area changes', () => {
    const v = setupView();
    const onFmt = vi.fn();
    const onArea = vi.fn();
    v.on(UIEventType.CAPTURE_FORMAT_CHANGE, onFmt);
    v.on(UIEventType.CAPTURE_AREA_CHANGE, onArea);

    renderWithModel(v, {
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });

    const jpegOnly = document.querySelector('.jpeg-only') as HTMLElement;
    const qRange = document.querySelector('#jpeg-quality-range') as HTMLInputElement;
    const qNumber = document.querySelector('#jpeg-quality-number') as HTMLInputElement;

    // Initial: png → hidden & disabled
    expect(jpegOnly).toHaveClass('hidden');
    expect(qRange.disabled).toBe(true);
    expect(qNumber.disabled).toBe(true);

    // Change: jpeg
    const jpegRadio = document.querySelector(
      'input[name="capture-format"][value="jpeg"]',
    ) as HTMLInputElement;
    jpegRadio.checked = true;
    jpegRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onFmt).toHaveBeenCalledTimes(1);
    expect(lastCallArg<{ format: 'jpeg' }>(onFmt)).toEqual({ format: 'jpeg' });
    expect(jpegOnly).not.toHaveClass('hidden');
    expect(qRange.disabled).toBe(false);
    expect(qNumber.disabled).toBe(false);

    // area
    const vpRadio = document.querySelector(
      'input[name="capture-area"][value="viewport"]',
    ) as HTMLInputElement;
    vpRadio.checked = true;
    vpRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onArea).toHaveBeenCalledTimes(1);
    expect(lastCallArg<{ area: 'viewport' }>(onArea)).toEqual({ area: 'viewport' });
  });

  it('bindSync clamps/rounds and emits for capture scale change', () => {
    const v = setupView();
    const onScale = vi.fn();
    v.on(UIEventType.CAPTURE_SCALE_CHANGE, onScale);

    renderWithModel(v);
    const num = document.querySelector('#capture-scale-number') as HTMLInputElement;
    const range = document.querySelector('#capture-scale-range') as HTMLInputElement;

    // Invalid value → Round to 1 to 3, step=0.5
    num.value = '2.74';
    num.dispatchEvent(new Event('input', { bubbles: true }));

    expect(range.value).toBe('2.5');
    expect(num.value).toBe('2.5');
    expect(onScale).toHaveBeenCalled();
    expect(lastCallArg<{ scale: number }>(onScale)?.scale).toBe(2.5);
  });

  it('emits badge size/color/shape/delete and applies Gray→slate color dot', () => {
    const v = setupView();
    const onSize = vi.fn();
    const onColor = vi.fn();
    const onShape = vi.fn();
    const onDel = vi.fn();
    v.on(UIEventType.BADGE_SIZE_CHANGE, onSize);
    v.on(UIEventType.BADGE_COLOR_SELECT, onColor);
    v.on(UIEventType.BADGE_SHAPE_CHANGE, onShape);
    v.on(UIEventType.BADGE_DELETE, onDel);

    renderWithModel(v, { defaultColor: 'Gray' });

    // Gray → bg-slate-500 is assigned
    const dot = document.querySelector('#badge-color-dot') as HTMLElement;
    expect(dot.className).toContain('bg-slate-500');

    // Size
    const sizeNum = document.querySelector('#badge-size-number') as HTMLInputElement;
    sizeNum.value = '20';
    sizeNum.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSize).toHaveBeenCalledWith({ size: 20 });

    // Color
    const blueBtn = document.querySelector(
      '#badge-color-pop button[data-color-name="Blue"]',
    ) as HTMLButtonElement;
    blueBtn.click();
    expect(onColor).toHaveBeenCalledWith({ color: 'Blue' });

    // Color (invalid → falls back to Blue)
    const invalidBtn = document.querySelector(
      '#badge-color-pop button[data-color-name="Invalid"]',
    ) as HTMLButtonElement;
    invalidBtn.click();
    expect(onColor).toHaveBeenCalledWith({ color: 'Blue' });

    // Shape
    const shape = document.querySelector('#badge-shape-select') as HTMLSelectElement;
    shape.value = 'square';
    shape.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onShape).toHaveBeenCalledWith({ shape: 'square' });

    // Delete
    (document.querySelector('#badge-delete-button') as HTMLButtonElement).click();
    expect(onDel).toHaveBeenCalledTimes(1);
  });

  it('emits BADGE_LABEL_FORMAT_CHANGE when label-format select changes; falls back to Numbers for invalid', () => {
    const v = setupView();
    const onFmt = vi.fn();
    v.on(UIEventType.BADGE_LABEL_FORMAT_CHANGE, onFmt);

    renderWithModel(v, { defaultLabelFormat: 'Numbers' });

    const sel = document.querySelector('#badge-label-format-select') as HTMLSelectElement;

    // Valid value → emits with selected format
    sel.value = 'UpperAlpha';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onFmt).toHaveBeenCalledTimes(1);
    expect(lastCallArg<{ labelFormat: string }>(onFmt)).toEqual({ labelFormat: 'UpperAlpha' });

    // Invalid value → falls back to 'Numbers'
    onFmt.mockClear();
    // force an invalid option value
    sel.value = 'InvalidFormat';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onFmt).toHaveBeenCalledTimes(1);
    expect(lastCallArg<{ labelFormat: string }>(onFmt)).toEqual({ labelFormat: 'Numbers' });
  });

  it('render sets badgeLabelFormatSelect.value from model.defaultLabelFormat; falls back to Numbers when undefined', () => {
    const v = setupView();

    // Uses provided defaultLabelFormat
    renderWithModel(v, { defaultLabelFormat: 'LowerAlpha' });
    const sel = document.querySelector('#badge-label-format-select') as HTMLSelectElement;
    expect(sel.value).toBe('LowerAlpha');

    // Fallback when defaultLabelFormat is undefined (nullish coalescing to 'Numbers')
    renderWithModel(v, { defaultLabelFormat: undefined as unknown as LabelFormat });
    const sel2 = document.querySelector('#badge-label-format-select') as HTMLSelectElement;
    expect(sel2.value).toBe('Numbers');
  });

  it('emits BADGE_VISIBLE_CHANGE when badge-visible select changes ("true" / "false")', () => {
    const v = setupView();
    const onVisible = vi.fn();
    v.on(UIEventType.BADGE_VISIBLE_CHANGE, onVisible);

    // initial render (defaultVisible=true by helper)
    renderWithModel(v);

    const sel = document.querySelector('#badge-visible-select') as HTMLSelectElement;

    // Change to false → emits { visible:false }
    sel.value = 'false';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(lastCallArg<{ visible: boolean }>(onVisible)).toEqual({ visible: false });

    // Change to true → emits { visible:true }
    onVisible.mockClear();
    sel.value = 'true';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(lastCallArg<{ visible: boolean }>(onVisible)).toEqual({ visible: true });
  });

  it('render sets badgeVisibleSelect.value from model.defaultVisible; falls back to "true" when undefined', () => {
    const v = setupView();

    // defaultVisible=false → select value should be "false"
    renderWithModel(v, { defaultVisible: false });
    const selFalse = document.querySelector('#badge-visible-select') as HTMLSelectElement;
    expect(selFalse.value).toBe('false');

    // defaultVisible undefined → coalesces to 'true' in implementation
    renderWithModel(v, { defaultVisible: undefined as unknown as boolean });
    const selUndef = document.querySelector('#badge-visible-select') as HTMLSelectElement;
    expect(selUndef.value).toBe('true');

    // defaultVisible=true → select value should be "true"
    renderWithModel(v, { defaultVisible: true });
    const selTrue = document.querySelector('#badge-visible-select') as HTMLSelectElement;
    expect(selTrue.value).toBe('true');
  });

  it('renders grouped list (ungrouped first) and handles group/overall selection', () => {
    const v = setupView();
    const onSel = vi.fn();
    v.on(UIEventType.ITEM_SELECTION_CHANGED, onSel);

    const items = [
      makeItem(1, 2, 'A-2', 'A'),
      makeItem(2, 1, 'A-1', 'A'),
      makeItem(3, 1, 'B-3', 'B'),
      makeItem(4, 1, 'NoGroup', ''),
    ];

    renderWithModel(v, { items, selectItems: [1, 3], missingIds: [4] });

    const sections = document.querySelectorAll('#select-list section');
    expect(sections.length).toBe(3);

    // Unaffiliated → A → B
    expect(
      (sections[0]!.querySelector('span.select-item-gh-title') as HTMLElement).textContent,
    ).toBe('(Ungrouped)');
    expect(
      (sections[1]!.querySelector('span.select-item-gh-title') as HTMLElement).textContent,
    ).toBe('A');
    expect(
      (sections[2]!.querySelector('span.select-item-gh-title') as HTMLElement).textContent,
    ).toBe('B');

    // Missing item warning chip
    const missingChip = sections[0]!.querySelector('li span.chip-warn');
    expect(missingChip).toBeInTheDocument();

    // Group check (A ON → group:'A')
    const aGroupCheckbox = sections[1]!.querySelector(
      'input[type="checkbox"][name="item-select"]',
    ) as HTMLInputElement;
    aGroupCheckbox.checked = true;
    aGroupCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSel).toHaveBeenCalledWith({ group: 'A', isCheck: true });

    // Overall check
    const all = document.querySelector(
      'input[type="checkbox"][name="item-select"][value="all"]',
    ) as HTMLInputElement;
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSel).toHaveBeenCalledWith({ allCheck: true });
  });

  it('emits hover in immediately and hover out after delay (1s)', async () => {
    const v = setupView();
    const onIn = vi.fn();
    const onOut = vi.fn();
    v.on(UIEventType.ITEM_HOVER_IN, onIn);
    v.on(UIEventType.ITEM_HOVER_OUT, onOut);

    const items = [makeItem(10, 1, 'X', 'A')];
    renderWithModel(v, { items });

    const liMain = document.querySelector('#select-list li div.min-w-0.flex-1') as HTMLElement;

    // IN
    liMain.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    expect(onIn).toHaveBeenCalledWith({ id: 10 });

    // OUT (Pointerleave from list → 1,000ms later)

    vi.useFakeTimers();
    const list = document.querySelector('#select-list') as HTMLElement;
    // Pointerleave does not bubble, so send with bubbles:false (default).
    list.dispatchEvent(new Event('pointerleave'));
    expect(onOut).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();
    expect(onOut).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('reorders items via drag and drop within the same UL', () => {
    const v = setupView();
    const onReorder = vi.fn();
    v.on(UIEventType.REORDER_ITEMS, onReorder);

    const items = [makeItem(1, 1, 'A', 'G'), makeItem(2, 2, 'B', 'G')];
    renderWithModel(v, { items });

    const lis = document.querySelectorAll('#select-list ul > li');
    const li1 = lis[0] as HTMLLIElement;
    const li2 = lis[1] as HTMLLIElement;

    // dragstart on first
    li1.dispatchEvent(new Event('dragstart', { bubbles: true }));

    // dragover on li2
    const rect = li2.getBoundingClientRect();
    const dragoverEv = new Event('dragover', { bubbles: true }) as unknown as DragEvent;
    Object.defineProperty(dragoverEv, 'clientY', {
      value: rect.top + rect.height,
      configurable: true,
    });
    li2.dispatchEvent(dragoverEv);

    // dragend → emit
    li1.dispatchEvent(new Event('dragend', { bubbles: true }));

    expect(onReorder).toHaveBeenCalledTimes(1);
    const payload = lastCallArg<{ fromId: number; fromIndex: number; toIndex: number }>(onReorder)!;
    expect(payload.fromId).toBe(1);
    expect(payload.fromIndex).toBe(0);
    expect(payload.toIndex).toBe(1);
  });

  it('toggle label text follows selectionEnabled (ON/OFF)', () => {
    const v = setupView();
    renderWithModel(v, { selectionEnabled: false });
    expect(document.querySelector('#toggle-select-label')).toHaveTextContent('OFF');

    renderWithModel(v, { selectionEnabled: true });
    expect(document.querySelector('#toggle-select-label')).toHaveTextContent('ON');
  });

  it('shows empty state when no items and updates count/all-check accordingly', () => {
    const v = setupView();
    renderWithModel(v, { items: [], selectItems: [] });

    expect(document.querySelector('#select-count')!.textContent).toBe('0');
    expect(document.querySelector('#select-empty')).not.toHaveClass('hidden');
    expect(
      (document.querySelector('input[name="item-select"][value="all"]') as HTMLInputElement)
        .checked,
    ).toBe(false);

    // If you redraw with all items selected, all-check will be true
    const items = [makeItem(1, 1, 'x'), makeItem(2, 2, 'y')];
    renderWithModel(v, { items, selectItems: [1, 2] });
    expect(document.querySelector('#select-count')!.textContent).toBe('2');
    expect(
      (document.querySelector('input[name="item-select"][value="all"]') as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it('emits BADGE_POSITION_SELECT when a position button is clicked (with fallback for invalid)', () => {
    const v = setupView();
    const onPos = vi.fn();
    v.on(UIEventType.BADGE_POSITION_SELECT, onPos);

    renderWithModel(v);

    const rightTopBtn = document.querySelector(
      '#badge-position-pop button[data-position-name="right-top-outside"]',
    ) as HTMLButtonElement;
    rightTopBtn.click();
    expect(onPos).toHaveBeenCalledWith({ position: 'right-top-outside' });

    rightTopBtn.dataset.positionName = 'invalid-pos';
    rightTopBtn.click();

    const last = lastCallArg<{ position: ItemPosition }>(onPos);
    expect(last).toEqual({ position: 'left-top-outside' });
  });

  it('applyBadgePositonUI marks the selected button and updates the label text on render', () => {
    const v = setupView();

    renderWithModel(v, { defaultPosition: 'right-top-outside' as ItemPosition });

    const label = document.querySelector('#badge-position-label') as HTMLElement;
    const leftTopBtn = document.querySelector(
      '#badge-position-pop button[data-position-name="left-top-outside"]',
    ) as HTMLButtonElement;
    const rightTopBtn = document.querySelector(
      '#badge-position-pop button[data-position-name="right-top-outside"]',
    ) as HTMLButtonElement;
    const topOutsideBtn = document.querySelector(
      '#badge-position-pop button[data-position-name="top-outside"]',
    ) as HTMLButtonElement;

    expect(label.textContent).toBe('right top outside');
    expect(rightTopBtn.getAttribute('data-selected')).toBe('true');
    expect(leftTopBtn.getAttribute('data-selected')).toBe('false');
    expect(topOutsideBtn.getAttribute('data-selected')).toBe('false');

    renderWithModel(v, { defaultPosition: 'top-outside' as ItemPosition });
    expect(label.textContent).toBe('top outside');
    expect(topOutsideBtn.getAttribute('data-selected')).toBe('true');
    expect(leftTopBtn.getAttribute('data-selected')).toBe('false');
    expect(rightTopBtn.getAttribute('data-selected')).toBe('false');
  });

  it('applies capture options toggle UI by render (aria-expanded, icon svg, panel visibility)', () => {
    const v = setupView();

    // panelExpanded=false
    renderWithModel(v, {
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });
    const toggle = document.querySelector('#capture-options-toggle')!;
    const panel = document.querySelector('#capture-options')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel).toHaveClass('hidden');
    expect(toggle.querySelector('svg')).toBeInTheDocument();

    // panelExpanded=true
    renderWithModel(v, {
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: true },
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel).not.toHaveClass('hidden');
    expect(toggle.querySelector('svg')).toBeInTheDocument();
  });

  it('emits CAPTURE_QUALITY_CHANGE when jpeg quality inputs change (after switching to jpeg)', () => {
    const v = setupView();
    const onQuality = vi.fn();
    v.on(UIEventType.CAPTURE_QUALITY_CHANGE, onQuality);

    renderWithModel(v, {
      capture: { format: 'png', area: 'full', quality: 80, scale: 1, panelExpanded: false },
    });

    // jpeg
    const jpegRadio = document.querySelector(
      'input[name="capture-format"][value="jpeg"]',
    ) as HTMLInputElement;
    jpegRadio.checked = true;
    jpegRadio.dispatchEvent(new Event('change', { bubbles: true }));

    const qNum = document.querySelector('#jpeg-quality-number') as HTMLInputElement;
    const qRange = document.querySelector('#jpeg-quality-range') as HTMLInputElement;

    // number
    qNum.value = '90';
    qNum.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onQuality).toHaveBeenCalled();
    expect(lastCallArg<{ quality: number }>(onQuality)?.quality).toBe(90);

    // range
    onQuality.mockClear();
    qRange.value = '85';
    qRange.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onQuality).toHaveBeenCalled();
    expect(lastCallArg<{ quality: number }>(onQuality)?.quality).toBe(85);
  });

  it('badge color UI reflects selected color (aria-selected & label), and toggles correctly', () => {
    const v = setupView();

    renderWithModel(v, { defaultColor: 'Gray' });
    const label = document.querySelector('#badge-color-label') as HTMLElement;
    const grayBtn = document.querySelector(
      '#badge-color-pop button[data-color-name="Gray"]',
    ) as HTMLButtonElement;
    const blueBtn = document.querySelector(
      '#badge-color-pop button[data-color-name="Blue"]',
    ) as HTMLButtonElement;

    // Gray is selected
    expect(label.textContent).toBe('Gray');
    expect(grayBtn.getAttribute('aria-selected')).toBe('true');
    expect(blueBtn.getAttribute('aria-selected')).toBe('false');

    // Redraw to Blue
    renderWithModel(v, { defaultColor: 'Blue' });
    expect((document.querySelector('#badge-color-label') as HTMLElement).textContent).toBe('Blue');

    const grayBtn2 = document.querySelector(
      '#badge-color-pop button[data-color-name="Gray"]',
    ) as HTMLButtonElement;
    const blueBtn2 = document.querySelector(
      '#badge-color-pop button[data-color-name="Blue"]',
    ) as HTMLButtonElement;
    expect(blueBtn2.getAttribute('aria-selected')).toBe('true');
    expect(grayBtn2.getAttribute('aria-selected')).toBe('false');
  });

  it('badge group select is populated with (Ungrouped), existing groups (sorted), and Create option; default selected properly', () => {
    const v = setupView();

    const items = [
      makeItem(1, 1, 'a', 'Zeta'),
      makeItem(2, 2, 'b', 'Alpha'),
      makeItem(3, 3, 'c', 'Alpha'), // Duplicate groups only once
      makeItem(4, 4, 'd', ''), // Sky is not included (UNGROUPED is included separately)
    ];
    renderWithModel(v, {
      items,
      defaultGroup: 'Alpha',
    });

    const sel = document.querySelector('#badge-group-select') as HTMLSelectElement;
    const opts = Array.from(sel.querySelectorAll('option')).map((o) => ({
      value: o.value,
      text: o.textContent,
      selected: o.selected,
    }));

    // Expected order: (Ungrouped) / Alpha / Zeta / Create
    expect(opts.map((o) => o.text)).toEqual(['(Ungrouped)', 'Alpha', 'Zeta', 'Create']);
    expect(opts[1]!.selected).toBe(true);
  });

  it('selecting NEW_GROUP shows modal and emits SET_GROUP, then create button emits new group and hides modal', () => {
    const v = setupView();
    const onSetGroup = vi.fn();
    v.on(UIEventType.SET_GROUP, onSetGroup);

    const items = [makeItem(1, 1, 'a', 'A')];
    renderWithModel(v, { items, defaultGroup: '__ungrouped__' });

    const sel = document.querySelector('#badge-group-select') as HTMLSelectElement;
    // Select Create(option value="__newgroup__")
    const createOpt = Array.from(sel.options).find((o) => o.textContent === 'Create')!;
    sel.value = createOpt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    // First, it is emitted with the NEW_GROUP value and displayed modally.
    expect(onSetGroup).toHaveBeenCalled();
    const first = lastCallArg<{ group: string }>(onSetGroup)!;
    expect(first.group).toBe('__newgroup__');
    const modal = document.querySelector('#group-name-modal') as HTMLDivElement;
    expect(modal).not.toHaveClass('hidden');

    // Enter → Confirm with Create button
    const input = document.querySelector('#group-name-input') as HTMLInputElement;
    input.value = 'MyGroup';
    const createBtn = document.querySelector('#group-name-create-btn') as HTMLButtonElement;
    createBtn.click();

    // Emit with real group name & close modal
    const final = lastCallArg<{ group: string }>(onSetGroup)!;
    expect(final.group).toBe('MyGroup');
    expect(modal).toHaveClass('hidden');
    expect(input.value).toBe('');
  });

  it('group collapse toggle updates aria-expanded, list visibility, and caret path', () => {
    const v = setupView();

    const items = [makeItem(1, 1, 'a', 'A'), makeItem(2, 2, 'b', 'A')];
    renderWithModel(v, { items });

    const sections = Array.from(document.querySelectorAll('#select-list section'));
    const section = sections.find(
      (s) => s.querySelector('.select-item-gh-title')?.textContent === 'A',
    )!;
    const toggleBtn = section.querySelector('button.select-item-gh-toggle') as HTMLButtonElement;
    const ul = section.querySelector('ul') as HTMLUListElement;
    const path = toggleBtn.querySelector('svg path') as SVGPathElement;

    // Expanded state
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(ul).not.toHaveClass('hidden');
    const d1 = path.getAttribute('d');

    // Click to collapse
    toggleBtn.click();
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(ul).toHaveClass('hidden');
    const d2 = path.getAttribute('d');
    expect(d2).not.toBeNull();
    expect(d2).not.toEqual(d1);

    // Click again to expand
    toggleBtn.click();
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(ul).not.toHaveClass('hidden');
  });

  it('hover-in is suppressed for missing items and during drag operation', () => {
    const v = setupView();
    const onIn = vi.fn();
    v.on(UIEventType.ITEM_HOVER_IN, onIn);

    // missing item
    const items = [makeItem(1, 1, 'x', 'G')];
    renderWithModel(v, { items, missingIds: [1] });

    const main = document.querySelector('#select-list li div.min-w-0.flex-1') as HTMLElement;
    main.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    expect(onIn).not.toHaveBeenCalled();

    // drag
    renderWithModel(v, { items, missingIds: [] });
    const li = document.querySelector('#select-list li') as HTMLLIElement;
    li.dispatchEvent(new Event('dragstart', { bubbles: true }));

    const main2 = document.querySelector('#select-list li div.min-w-0.flex-1') as HTMLElement;
    main2.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    expect(onIn).not.toHaveBeenCalled(); // Suppressed during drag
  });

  it('pointerenter on list cancels scheduled hover-out', async () => {
    const v = setupView();
    const onOut = vi.fn();
    v.on(UIEventType.ITEM_HOVER_OUT, onOut);

    const items = [makeItem(1, 1, 'x', 'G')];
    renderWithModel(v, { items });

    vi.useFakeTimers();

    const list = document.querySelector('#select-list') as HTMLElement;
    // Hover-out after 1 second with pointerleave
    list.dispatchEvent(new Event('pointerleave'));
    list.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();
    expect(onOut).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('does not reorder across different ULs (cross-group DnD is ignored)', () => {
    const v = setupView();
    const onReorder = vi.fn();
    v.on(UIEventType.REORDER_ITEMS, onReorder);

    // A/B only (2 sections) without Ungrouped
    const items = [makeItem(1, 1, 'a', 'A'), makeItem(2, 2, 'b', 'B')];
    renderWithModel(v, { items });

    // Identify the section in question by title text (regardless of whether Ungrouped is present)
    const sections = Array.from(document.querySelectorAll('#select-list section'));
    const pickByTitle = (title: string) =>
      sections.find((s) => s.querySelector('.select-item-gh-title')?.textContent === title)!;

    const sectionA = pickByTitle('A');
    const sectionB = pickByTitle('B');

    const aUl = sectionA.querySelector('ul') as HTMLUListElement;
    const bUl = sectionB.querySelector('ul') as HTMLUListElement;

    const aLi = aUl.querySelector('li') as HTMLLIElement;
    const bLi = bUl.querySelector('li') as HTMLLIElement;

    // Drag start on side A
    aLi.dispatchEvent(new Event('dragstart', { bubbles: true }));

    // Even if you drag over on the B side, it should be ignored because the parent UL is different.
    const rect = bLi.getBoundingClientRect();
    const dragoverEv = new Event('dragover', { bubbles: true }) as unknown as DragEvent;
    Object.defineProperty(dragoverEv, 'clientY', {
      value: rect.top + rect.height / 2,
      configurable: true,
    });
    bLi.dispatchEvent(dragoverEv);

    // dragend
    aLi.dispatchEvent(new Event('dragend', { bubbles: true }));

    // REORDER_ITEMS does not fire because it is between different ULs
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('toggle icon color class follows selectionEnabled (bg-indigo-500 vs bg-slate-300)', () => {
    const v = setupView();

    renderWithModel(v, { selectionEnabled: false });
    expect(document.querySelector('#toggle-select-icon')!.className).toContain('bg-slate-300');

    renderWithModel(v, { selectionEnabled: true });
    expect(document.querySelector('#toggle-select-icon')!.className).toContain('bg-indigo-500');
  });

  it('comment button opens modal and pre-fills id and comment', () => {
    const v = setupView();

    const items = [makeItem(10, 1, 'anchor-10', 'A')];
    // Pre-fill with existing comment to verify initial values
    items[0]!.comment = 'existing note';
    renderWithModel(v, { items });

    // Each item's comment button is .btn-icon
    const btn = document.querySelector('#select-list li button.btn-icon') as HTMLButtonElement;
    expect(btn).toBeInTheDocument();

    // Click → modal opens & values are pre-filled
    btn.click();

    const modal = document.querySelector('#item-comment-modal') as HTMLDivElement;
    const textarea = document.querySelector('#item-comment-input') as HTMLTextAreaElement;
    const idInput = document.querySelector('#item-comment-id-input') as HTMLInputElement;

    expect(modal).not.toHaveClass('hidden');
    expect(textarea.value).toBe('existing note');
    expect(idInput.value).toBe('10');
  });

  it('comment modal: Cancel hides modal without emitting', () => {
    const v = setupView();
    const onApply = vi.fn();
    v.on(UIEventType.ITEM_COMMENT_APPLY, onApply);

    // Open modal by clicking the comment button
    const items = [makeItem(1, 1, 'a', 'A')];
    renderWithModel(v, { items });
    const openBtn = document.querySelector('#select-list li button.btn-icon') as HTMLButtonElement;
    openBtn.click();

    const modal = document.querySelector('#item-comment-modal') as HTMLDivElement;
    const cancelBtn = document.querySelector('#item-comment-cancel-btn') as HTMLButtonElement;

    expect(modal).not.toHaveClass('hidden');

    // Cancel → modal is hidden and no event is emitted
    cancelBtn.click();
    expect(modal).toHaveClass('hidden');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('comment modal: Apply emits ITEM_COMMENT_APPLY with {id, comment} and hides modal', () => {
    const v = setupView();
    const onApply = vi.fn();
    v.on(UIEventType.ITEM_COMMENT_APPLY, onApply);

    // Open the modal
    const items = [makeItem(2, 2, 'b', 'B')];
    renderWithModel(v, { items });
    const openBtn = document.querySelector('#select-list li button.btn-icon') as HTMLButtonElement;
    openBtn.click();

    const modal = document.querySelector('#item-comment-modal') as HTMLDivElement;
    const textarea = document.querySelector('#item-comment-input') as HTMLTextAreaElement;
    const idInput = document.querySelector('#item-comment-id-input') as HTMLInputElement;
    const applyBtn = document.querySelector('#item-comment-apply-btn') as HTMLButtonElement;

    // Change input value and click Apply
    textarea.value = 'new comment';
    // Sanity check id (should be set when opening)
    expect(idInput.value).toBe('2');

    applyBtn.click();

    // Event is emitted with expected payload and modal is hidden
    expect(onApply).toHaveBeenCalledTimes(1);
    const payload = lastCallArg<{ id: number; comment: string }>(onApply)!;
    expect(payload).toEqual({ id: 2, comment: 'new comment' });
    expect(modal).toHaveClass('hidden');
  });

  it('clicking theme-light applies light theme and emits UPDATE_THEME', () => {
    const v = setupView();
    const onTheme = vi.fn();
    v.on(UIEventType.UPDATE_THEME, onTheme);

    renderWithModel(v, { theme: 'dark' });

    const lightBtn = document.querySelector('#theme-light-btn') as HTMLButtonElement;
    lightBtn.click();

    expect(onTheme).toHaveBeenCalledWith({ theme: 'light' });
    // applyTheme('light') → dark class is removed from html root
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(lightBtn.getAttribute('data-active')).toBe('true');
    expect(
      (document.querySelector('#theme-dark-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
    expect(
      (document.querySelector('#theme-device-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
  });

  it('clicking theme-dark applies dark theme and emits UPDATE_THEME', () => {
    const v = setupView();
    const onTheme = vi.fn();
    v.on(UIEventType.UPDATE_THEME, onTheme);

    renderWithModel(v, { theme: 'light' });

    const darkBtn = document.querySelector('#theme-dark-btn') as HTMLButtonElement;
    darkBtn.click();

    expect(onTheme).toHaveBeenCalledWith({ theme: 'dark' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(darkBtn.getAttribute('data-active')).toBe('true');
    expect(
      (document.querySelector('#theme-light-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
    expect(
      (document.querySelector('#theme-device-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
  });

  it('clicking theme-device applies system preference (light system) and emits UPDATE_THEME', () => {
    // System lights: matches=false
    window.matchMedia = makeMatchMedia(false);

    const v = setupView();
    const onTheme = vi.fn();
    v.on(UIEventType.UPDATE_THEME, onTheme);

    renderWithModel(v, { theme: 'dark' });

    const deviceBtn = document.querySelector('#theme-device-btn') as HTMLButtonElement;
    deviceBtn.click();

    expect(onTheme).toHaveBeenCalledWith({ theme: 'device' });
    // matches=false → dark class is not added
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(deviceBtn.getAttribute('data-active')).toBe('true');
    expect(
      (document.querySelector('#theme-light-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
    expect(
      (document.querySelector('#theme-dark-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
  });

  it('clicking theme-device applies system preference (dark system) and emits UPDATE_THEME', () => {
    // System is dark: matches=true
    window.matchMedia = makeMatchMedia(true);

    const v = setupView();
    const onTheme = vi.fn();
    v.on(UIEventType.UPDATE_THEME, onTheme);

    renderWithModel(v, { theme: 'light' });

    const deviceBtn = document.querySelector('#theme-device-btn') as HTMLButtonElement;
    deviceBtn.click();

    expect(onTheme).toHaveBeenCalledWith({ theme: 'device' });
    // matches=true → dark class is added
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(deviceBtn.getAttribute('data-active')).toBe('true');
    expect(
      (document.querySelector('#theme-light-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
    expect(
      (document.querySelector('#theme-dark-btn') as HTMLElement).getAttribute('data-active'),
    ).toBe('false');
  });

  it('clicking setting-button shows modal and emits SETTING_MODAL_SHOW', () => {
    const v = setupView();
    const onShow = vi.fn();
    v.on(UIEventType.SETTING_MODAL_SHOW, onShow);

    renderWithModel(v);

    const btn = document.querySelector('#setting-button') as HTMLButtonElement;
    const modal = document.querySelector('#setting-modal') as HTMLDivElement;

    expect(modal).toHaveClass('hidden');

    btn.click();
    expect(modal).not.toHaveClass('hidden');
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(lastCallArg<undefined>(onShow)).toBeUndefined();
  });

  it('render → applyStore: empty state when pageKeys=[], list hidden & count=0', () => {
    const v = setupView();

    renderWithModel(v, { pageKeys: [] });

    const count = document.querySelector('#store-count') as HTMLSpanElement;
    const list = document.querySelector('#store-list') as HTMLUListElement;
    const empty = document.querySelector('#store-empty') as HTMLDivElement;

    expect(count.textContent).toBe('0');
    expect(list).toHaveClass('hidden');
    expect(empty).not.toHaveClass('hidden');
  });

  it('render → applyStore: renders links for pageKeys, shows list, hides empty, and emits REMOVE_PAGE_CLICK', () => {
    const v = setupView();
    const onRemove = vi.fn();
    v.on(UIEventType.REMOVE_PAGE_CLICK, onRemove);

    const keys = ['https://example.com/a', 'https://example.com/b'];
    renderWithModel(v, { pageKeys: keys });

    const count = document.querySelector('#store-count') as HTMLSpanElement;
    const list = document.querySelector('#store-list') as HTMLUListElement;
    const empty = document.querySelector('#store-empty') as HTMLDivElement;

    expect(count.textContent).toBe('2');
    expect(list).not.toHaveClass('hidden');
    expect(empty).toHaveClass('hidden');

    const lis = Array.from(list.querySelectorAll('li'));
    expect(lis.length).toBe(2);

    const a0 = lis[0]!.querySelector('a') as HTMLAnchorElement;
    const a1 = lis[1]!.querySelector('a') as HTMLAnchorElement;
    expect(a0.href).toBe(keys[0]);
    expect(a0.target).toBe('_blank');
    expect(a0.textContent).toBe(keys[0]);
    expect(a1.href).toBe(keys[1]);
    expect(a1.target).toBe('_blank');
    expect(a1.textContent).toBe(keys[1]);

    const btn1 = lis[0]!.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(btn1.getAttribute('data-ignore-disable')).toBe('true');
    btn1.click();

    expect(onRemove).toHaveBeenCalledTimes(1);
    const payload = lastCallArg<{ pageKey: string }>(onRemove)!;
    expect(payload).toEqual({ pageKey: keys[0] });
  });

  it('render → applyStore: emits EXPORT_PAGE_CLICK when export button is clicked', () => {
    const v = setupView();
    const onExport = vi.fn();
    v.on(UIEventType.EXPORT_PAGE_CLICK, onExport);

    const keys = ['https://example.com/a', 'https://example.com/b'];
    renderWithModel(v, { pageKeys: keys });

    const list = document.querySelector('#store-list') as HTMLUListElement;
    const lis = Array.from(list.querySelectorAll('li'));
    expect(lis.length).toBe(2);

    // The first button in each row is the Export button
    const exportBtn = lis[0]!.querySelectorAll('button')[0] as HTMLButtonElement;

    // Export button should be excluded from disableFormControls by data-ignore-disable
    expect(exportBtn.getAttribute('data-ignore-disable')).toBe('true');

    // Click → emits EXPORT_PAGE_CLICK with pageKey
    exportBtn.click();

    expect(onExport).toHaveBeenCalledTimes(1);
    const payload = lastCallArg<{ pageKey: string }>(onExport)!;
    expect(payload).toEqual({ pageKey: keys[0] });
  });

  it('import button: opens file dialog when no file is selected and does not emit', () => {
    const v = setupView();
    const onImport = vi.fn();
    v.on(UIEventType.IMPORT_SCREAN_STATE_FILE, onImport);

    renderWithModel(v);

    const input = document.querySelector('#import-file-input') as HTMLInputElement;
    const openSpy = vi.spyOn(input, 'click');

    // Simulate "no files selected"
    Object.defineProperty(input, 'files', { value: undefined, configurable: true });

    (document.querySelector('#import-btn') as HTMLButtonElement).click();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('import button: emits IMPORT_SCREAN_STATE_FILE with the selected file when a file exists', () => {
    const v = setupView();
    const onImport = vi.fn();
    v.on(UIEventType.IMPORT_SCREAN_STATE_FILE, onImport);

    renderWithModel(v);

    const input = document.querySelector('#import-file-input') as HTMLInputElement;
    const file = new File([JSON.stringify({})], 'state.json', { type: 'application/json' });

    // Minimal FileList-like shape is enough for the implementation (uses files[0])
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    (document.querySelector('#import-btn') as HTMLButtonElement).click();

    expect(onImport).toHaveBeenCalledTimes(1);
    const payload = lastCallArg<{ file: File }>(onImport)!;
    expect(payload.file).toBe(file);
  });

  it('applyToastMessages: appends toasts, emits TOAST_DISMISS_REQUESTED per toast, supports close and auto-dismiss', async () => {
    // Enable fake timers BEFORE rendering so the internal setTimeout is captured
    vi.useFakeTimers();

    const v = setupView();
    const onDismiss = vi.fn();
    v.on(UIEventType.TOAST_DISMISS_REQUESTED, onDismiss);

    // Render with two toast messages → appends two nodes and emits twice
    renderWithModel(v, {
      toastMessages: [
        { uuid: 'u1', message: 'Hello', kind: 'error' },
        { uuid: 'u2', message: 'World', kind: 'success' },
      ],
    });

    const container = document.querySelector('#toast-parent') as HTMLDivElement;
    expect(container.children.length).toBe(2);
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onDismiss.mock.calls.map((c) => c[0].uuid).sort()).toEqual(['u1', 'u2']);

    // Closing the first toast removes it immediately and clears its timer
    const firstToast = container.querySelector('.toast') as HTMLDivElement;
    const closeBtn = firstToast.querySelector('button.toast-close') as HTMLButtonElement;
    closeBtn.click();
    expect(firstToast.isConnected).toBe(false);
    expect(container.children.length).toBe(1);

    // Auto-dismiss removes the remaining toast after 10s
    vi.advanceTimersByTime(10000);
    await vi.runAllTimersAsync();
    expect(container.children.length).toBe(0);

    vi.useRealTimers();
  });
});
