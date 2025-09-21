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

vi.mock('@panel/view/status', () => {
  const STATUS = { CONNECTED: 'connected', DISCONNECTED: 'disconnected' } as const;
  return {
    STATUS,
    STATUS_LABEL_STYLE: {
      connected: { body: ['bg-green-100'], dot: ['bg-green-500'] },
      disconnected: { body: ['bg-slate-100'], dot: ['bg-slate-400'] },
    } as Record<string, { body: string[]; dot: string[] }>,
    getStatusMessage: (k: string) => (k === STATUS.CONNECTED ? 'Connected' : 'Disconnected'),
  };
});

vi.mock('@common/types', () => {
  const validColors = new Set(['Blue', 'Red', 'Gray']);
  const validShapes = new Set(['circle', 'square']);
  const validPositions = new Set(['left-top-outside', 'right-top-outside', 'top-outside']);
  return {
    isItemColor: (v: unknown) => typeof v === 'string' && validColors.has(v),
    isItemShape: (v: unknown) => typeof v === 'string' && validShapes.has(v),
    isItemPosition: (v: unknown) => typeof v === 'string' && validPositions.has(v),
  };
});

// ---- Import SUT after mocks ----
import type { ItemColor, ItemPosition, ItemShape, ScreenItem } from '@common/types';
import { Model } from '@panel/app/model';
import { UIEventType } from '@panel/types/ui_event_types';
import { PanelView } from '@panel/view/panel_view';
import { STATUS } from '@panel/view/status';

// ---- Helpers ----
const basePanelHtml = () => `
<div id="panel-root">
  <div class="toolbar">
    <span id="status"></span>
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
    <button id="badge-delete-button" type="button">Delete</button>
    <span id="badge-position-label"></span>
    <div id="badge-position-pop">
      <button type="button" data-position-name="left-top-outside"></button>
      <button type="button" data-position-name="right-top-outside"></button>
      <button type="button" data-position-name="top-outside"></button>
    </div>    
  </div>

  <div id="list-wrap">
    <label><input type="checkbox" name="item-select" value="all"></label>
    <span id="select-count">0</span>
    <div id="select-empty" class="hidden">Empty</div>
    <div id="select-list"></div>
  </div>
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
    nextLabel: 1,
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
    defaultPosition: 'left-top-outside' as ItemPosition,
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
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders status and disables/enables all buttons by status', () => {
    const v = setupView();
    // DISCONNECTED → All buttons disabled
    renderWithModel(v, { status: 'disconnected' });
    expect(document.querySelector('#status')).toHaveTextContent('Disconnected');
    document.querySelectorAll('button').forEach((b) => {
      expect(b).toBeDisabled();
    });

    // CONNECTED → enabled
    renderWithModel(v, { status: 'connected' });
    expect(document.querySelector('#status')).toHaveTextContent('Connected');
    document.querySelectorAll('button').forEach((b) => {
      expect(b).not.toBeDisabled();
    });
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

  it('creates a new group via inline input or cancels/empty safely', () => {
    const v = setupView();
    const onSetGroup = vi.fn();
    v.on(UIEventType.SET_ITEM_GROUP, onSetGroup);

    const items = [makeItem(5, 1, 'X', '')];
    renderWithModel(v, { items, selectItems: [] });

    // Get the select of unassigned sections (in the first li)
    const sel = document.querySelector('#select-list li select') as HTMLSelectElement;
    // Select __create__ → inline input appears
    sel.value = '__create__';
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    // Input -> OK
    const input = sel.parentElement!.querySelector('input[type="text"]') as HTMLInputElement;
    const ok = sel.parentElement!.querySelector('button[type="button"]') as HTMLButtonElement;
    input.value = 'NewG';
    ok.click();
    expect(onSetGroup).toHaveBeenCalledWith({ id: 5, group: 'NewG' });

    // If you create it again and confirm it as empty, it will not be emitted and will return to its original value.
    sel.value = '__create__';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const input2 = sel.parentElement!.querySelector('input[type="text"]') as HTMLInputElement;
    const ok2 = sel.parentElement!.querySelector('button[type="button"]') as HTMLButtonElement;
    input2.value = '';
    ok2.click();
    expect(onSetGroup).toHaveBeenCalledTimes(1);
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
});
