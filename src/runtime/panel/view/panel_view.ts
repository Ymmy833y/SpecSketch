import i18n from '@common/i18n';
import {
  isItemColor,
  isItemShape,
  type ItemColor,
  type ItemShape,
  type ScreenItem,
} from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import { getStatusMessage, STATUS, STATUS_LABEL_STYLE, type StatusKey } from '@panel/view/status';

import type { Model } from '../app/model';
import { type UIEventPayloadMap, UIEventType } from '../types/ui_event_types';

const STATUS_BASE_BODY = [
  'inline-flex',
  'items-center',
  'gap-1',
  'rounded-full',
  'border',
  'px-2',
  'py-1',
  'text-xs',
  'transition-colors',
] as const;
const TOGGLE_ICON_BASE = ['inline-block', 'w-3', 'h-3', 'rounded-full'] as const;
const CAPTURE_OPTION_COLLAPSED = '▼';
const CAPTURE_OPTION_EXPANDED = '▲';

function byLabelThenId(a: { label: number; id: number }, b: { label: number; id: number }) {
  if (a.label !== b.label) return a.label - b.label;
  return a.id - b.id;
}

export class PanelView {
  private listeners: { [K in UIEventType]?: unknown[] } = {};

  private els!: {
    status: HTMLSpanElement;
    toggleBtn: HTMLButtonElement;
    toggleIcon: HTMLSpanElement;
    toggleLabel: HTMLSpanElement;
    clearBtn: HTMLButtonElement;
    captureBtn: HTMLButtonElement;

    list: HTMLDivElement;
    empty: HTMLDivElement;
    count: HTMLSpanElement;

    captureOptionsToggle: HTMLButtonElement;
    captureOptionsPanel: HTMLElement;
    captureFmtRadios: NodeListOf<HTMLInputElement>;
    captureAreaRadios: NodeListOf<HTMLInputElement>;
    jpegOnlyEls: NodeListOf<HTMLElement>;
    jpegQualityRange: HTMLInputElement;
    jpegQualityNumber: HTMLInputElement;
    captureScaleRange: HTMLInputElement;
    captureScaleNumber: HTMLInputElement;

    badgeSizeRange: HTMLInputElement;
    badgeSizeNumber: HTMLInputElement;
    badgeColorButtons: NodeListOf<HTMLButtonElement>;
    badgeColorLabel: HTMLSpanElement;
    badgeColorDot: HTMLSpanElement;
    badgeShapeSelect: HTMLSelectElement;

    selectItemAllCheckbox: HTMLInputElement;
  };

  private readonly CREATE_VALUE = '__create__';
  private readonly NOGROUP = '__nogroup__';
  private HOVER_OUT_DELAY = 1000;

  private dragEl: HTMLLIElement | null = null;
  private dragStartParent: Element | null = null;
  private dragStartIndex = -1;

  private hoverOutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private doc: Document) {
    i18n.localize(doc);

    this.els = {
      status: this.$('#status'),
      toggleBtn: this.$('#toggle-select'),
      toggleIcon: this.$('#toggle-select-icon'),
      toggleLabel: this.$('#toggle-select-label'),
      clearBtn: this.$('#clear'),
      captureBtn: this.$('#capture'),

      list: this.$('#select-list'),
      empty: this.$('#select-empty'),
      count: this.$('#select-count'),

      captureOptionsToggle: this.$('#capture-options-toggle'),
      captureOptionsPanel: this.$('#capture-options'),
      captureFmtRadios: this.$all<HTMLInputElement>('input[name="capture-format"]'),
      captureAreaRadios: this.$all<HTMLInputElement>('input[name="capture-area"]'),
      jpegOnlyEls: this.$all<HTMLElement>('.jpeg-only'),
      jpegQualityRange: this.$('#jpeg-quality-range'),
      jpegQualityNumber: this.$('#jpeg-quality-number'),
      captureScaleRange: this.$('#capture-scale-range'),
      captureScaleNumber: this.$('#capture-scale-number'),

      badgeSizeRange: this.$('#badge-size-range'),
      badgeSizeNumber: this.$('#badge-size-number'),
      badgeColorButtons: this.$all<HTMLButtonElement>('#badge-color-pop button'),
      badgeColorLabel: this.$('#badge-color-label'),
      badgeColorDot: this.$('#badge-color-dot'),
      badgeShapeSelect: this.$('#badge-shape-select'),

      selectItemAllCheckbox: this.$('input[type="checkbox"][name="item-select"][value="all"]'),
    };

    this.els.toggleBtn.addEventListener('click', () =>
      this.emit(UIEventType.TOGGLE_SELECT, undefined),
    );
    this.els.clearBtn.addEventListener('click', () => this.emit(UIEventType.CLEAR, undefined));
    this.els.captureBtn.addEventListener('click', () => this.emit(UIEventType.CAPTURE, undefined));

    // === Capture options ===
    this.els.captureOptionsToggle.addEventListener('click', () => {
      this.emit(UIEventType.TOGGLE_CAPTURE_PANEL, undefined);
    });

    this.els.captureFmtRadios.forEach((r) =>
      r.addEventListener('change', () => {
        this.updateQualityVisibility();
        this.emit(UIEventType.CAPTURE_FORMAT_CHANGE, { format: this.getSelectedCaptureFormat() });
      }),
    );
    this.els.captureAreaRadios.forEach((r) =>
      r.addEventListener('change', () => {
        this.emit(UIEventType.CAPTURE_AREA_CHANGE, { area: this.getSelectedCaptureArea() });
      }),
    );

    this.bindSync(this.els.jpegQualityRange, this.els.jpegQualityNumber, (v) =>
      this.emit(UIEventType.CAPTURE_QUALITY_CHANGE, { quality: v }),
    );
    this.bindSync(this.els.captureScaleRange, this.els.captureScaleNumber, (v) =>
      this.emit(UIEventType.CAPTURE_SCALE_CHANGE, { scale: v }),
    );

    // === Badge ===
    this.bindSync(this.els.badgeSizeRange, this.els.badgeSizeNumber);
    const fireSize = () => {
      const v = Number(this.els.badgeSizeNumber.value);
      if (Number.isFinite(v)) this.emit(UIEventType.BADGE_SIZE_CHANGE, { size: v });
    };
    this.els.badgeSizeRange.addEventListener('change', fireSize);
    this.els.badgeSizeNumber.addEventListener('change', fireSize);

    this.els.badgeColorButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.colorName ?? '';
        const color = isItemColor(raw) ? (raw as ItemColor) : 'Blue';
        this.emit(UIEventType.BADGE_COLOR_SELECT, { color });
      });
    });

    this.els.badgeShapeSelect.addEventListener('change', () => {
      const v = this.els.badgeShapeSelect.value ?? null;
      const shape = isItemShape(v) ? (v as ItemShape) : 'circle';
      this.emit(UIEventType.BADGE_SHAPE_CHANGE, { shape });
    });

    this.updateQualityVisibility();

    this.els.selectItemAllCheckbox.addEventListener('change', (e) => {
      const selected = (e.target as HTMLInputElement).checked;
      this.emit(UIEventType.ITEM_SELECTION_CHANGED, { allCheck: selected });
    });

    this.els.list.addEventListener('pointerenter', () => this.cancelHoverOut());
    this.els.list.addEventListener('pointerleave', () => this.scheduleHoverOut());
    doc.addEventListener('pointerleave', () => {
      this.cancelHoverOut();
      this.emit(UIEventType.ITEM_HOVER_OUT, undefined);
    });
  }

  on<K extends UIEventType>(type: K, handler: (e: UIEventPayloadMap[K]) => void): void {
    const arr = (this.listeners[type] ??= []) as Array<(e: UIEventPayloadMap[K]) => void>;
    arr.push(handler);
  }

  private emit<K extends UIEventType>(type: K, e: UIEventPayloadMap[K]): void {
    const arr = this.listeners[type] as Array<(x: UIEventPayloadMap[K]) => void> | undefined;
    arr?.forEach((h) => h(e));
  }

  render(model: Model): void {
    this.renderStatus(model.status);
    this.renderToggle(model.selectionEnabled);
    this.renderList(model.items, model.selectItems);

    this.selectRadioByValue(this.els.captureFmtRadios, model.capture.format);
    this.selectRadioByValue(this.els.captureAreaRadios, model.capture.area);
    this.els.jpegQualityNumber.value = String(model.capture.quality);
    this.els.jpegQualityRange.value = String(model.capture.quality);
    this.els.captureScaleNumber.value = String(model.capture.scale);
    this.els.captureScaleRange.value = String(model.capture.scale);
    this.updateQualityVisibility(model.capture.format);

    const expanded = model.capture.panelExpanded;
    this.els.captureOptionsToggle.setAttribute('aria-expanded', String(expanded));
    this.els.captureOptionsToggle.textContent = expanded
      ? CAPTURE_OPTION_EXPANDED
      : CAPTURE_OPTION_COLLAPSED;
    this.els.captureOptionsPanel.classList.toggle('hidden', !expanded);

    this.els.badgeSizeNumber.value = String(model.defaultSize);
    this.els.badgeSizeRange.value = String(model.defaultSize);
    this.applyBadgeColorUI(model.defaultColor);
    this.els.badgeShapeSelect.value = model.defaultShape;
  }

  private renderStatus(key: StatusKey): void {
    const style = STATUS_LABEL_STYLE[key];
    const el = this.els.status;
    el.className = '';
    el.classList.add(...STATUS_BASE_BODY, ...style.body);

    const dot = this.doc.createElement('span');
    dot.classList.add('h-1.5', 'w-1.5', 'rounded-full', ...style.dot);

    const text = this.doc.createElement('span');
    text.textContent = getStatusMessage(key);
    el.replaceChildren(dot, text);

    this.disabledAllButtons(key !== STATUS.CONNECTED);
  }

  private renderToggle(enabled: boolean): void {
    const icon = this.els.toggleIcon;
    icon.className = '';
    icon.classList.add(...TOGGLE_ICON_BASE, enabled ? 'bg-indigo-500' : 'bg-slate-300');
    this.els.toggleLabel.textContent = i18n.get(enabled ? 'toggle_on' : 'toggle_off');
  }

  private renderList(items: ScreenItem[], selectItems: number[]): void {
    this.els.count.textContent = String(items.length);
    const allChecked =
      items.length === 0 ? false : items.every((it) => selectItems.includes(it.id));
    this.els.selectItemAllCheckbox.checked = allChecked;
    if (!items.length) {
      this.els.empty.classList.remove('hidden');
      this.els.list.replaceChildren();
      return;
    }
    this.els.empty.classList.add('hidden');

    const existingGroups = this.getExistingGroups(items);
    const groups = this.groupByGroup(items);

    const groupKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === this.NOGROUP) return -1;
      if (b === this.NOGROUP) return 1;
      return a.localeCompare(b);
    });

    const frag = this.doc.createDocumentFragment();
    for (const gKey of groupKeys) {
      const section = this.renderGroupSection(gKey, groups.get(gKey)!, existingGroups, selectItems);
      frag.appendChild(section);
    }
    this.els.list.replaceChildren(frag);
  }

  private renderGroupSection(
    gKey: string,
    gItems: ScreenItem[],
    existingGroups: string[],
    selectItems: number[],
  ): HTMLElement {
    const section = this.el(
      'section',
      'rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden',
    );

    // header
    const header = this.el(
      'div',
      'flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/40',
    );
    // checkbox
    const checkboxWrap = this.el('div', 'shrink-0 self-stretch flex items-center');
    const checkbox = this.el(
      'input',
      'h-4 w-4 border border-slate-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 accent-indigo-600',
    ) as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.name = 'item-select';
    checkbox.value = gKey === this.NOGROUP ? i18n.get('group_ungrouped') : gKey;
    checkbox.checked = gItems.every((it) => selectItems.includes(it.id));
    checkbox.addEventListener('change', (e) => {
      const selected = (e.target as HTMLInputElement).checked;
      this.emit(UIEventType.ITEM_SELECTION_CHANGED, {
        group: gKey === this.NOGROUP ? '' : gKey,
        isCheck: selected,
      });
    });
    checkboxWrap.append(checkbox);
    const title = this.el(
      'span',
      'text-xs font-medium text-slate-600 dark:text-slate-300',
      gKey === this.NOGROUP ? i18n.get('group_ungrouped') : gKey,
    );
    const left = this.el('div', 'flex items-center gap-2 min-w-0 flex-1');
    left.append(checkboxWrap, title);
    const count = this.el('span', 'text-[11px] text-slate-400', String(gItems.length));
    header.append(left, count);

    // ul
    const ul = this.el('ul', 'divide-y divide-slate-200 dark:divide-slate-800') as HTMLUListElement;
    this.attachUlDnDHandlers(ul);

    for (const it of gItems.sort(byLabelThenId)) {
      const selectChecked = selectItems.includes(it.id);
      ul.appendChild(this.renderItem(it, existingGroups, selectChecked));
    }

    section.append(header, ul);
    return section;
  }

  private renderItem(
    it: ScreenItem,
    existingGroups: string[],
    selectChecked: boolean,
  ): HTMLLIElement {
    const li = this.el(
      'li',
      'group flex items-center gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60',
    ) as HTMLLIElement;
    li.dataset.id = String(it.id);
    li.draggable = true;

    // Only sorting within the same UL is allowed
    li.addEventListener('dragstart', (e) => {
      this.dragEl = li;
      this.dragStartParent = li.parentElement;
      this.dragStartIndex = Array.prototype.indexOf.call(li.parentElement?.children ?? [], li);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      li.classList.add('opacity-60');
    });

    li.addEventListener('dragend', () => {
      if (!this.dragEl) return;
      const parent = this.dragEl.parentElement;
      const endIndex = parent ? Array.prototype.indexOf.call(parent.children, this.dragEl) : -1;

      this.dragEl.classList.remove('opacity-60');
      const fromId = this.dragEl.dataset.id ?? '';
      this.dragEl = null;

      if (fromId && this.dragStartIndex >= 0 && endIndex >= 0 && endIndex !== this.dragStartIndex) {
        this.emit(UIEventType.REORDER_ITEMS, {
          fromId: Number(fromId),
          fromIndex: this.dragStartIndex,
          toIndex: endIndex,
        });
      }
      this.dragStartIndex = -1;
      this.dragStartParent = null;
    });

    // checkbox
    const checkboxWrap = this.el('div', 'shrink-0 self-stretch flex items-center');
    const checkbox = this.el(
      'input',
      'h-4 w-4 border border-slate-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 accent-indigo-600',
    ) as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.name = 'item-select';
    checkbox.value = String(it.id);
    checkbox.checked = selectChecked;
    checkbox.addEventListener('change', (e) => {
      const selected = (e.target as HTMLInputElement).checked;
      this.emit(UIEventType.ITEM_SELECTION_CHANGED, { id: it.id, isCheck: selected });
    });
    checkboxWrap.append(checkbox);

    // badge
    const badge = this.el(
      'span',
      'inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold',
      String(it.label),
    );

    // anchor
    const main = this.el('div', 'min-w-0 flex-1');
    const line1 = this.el('div', 'text-sm font-medium truncate', it.anchor.value);
    main.addEventListener('pointerenter', () => {
      if (this.dragStartParent) return;
      this.cancelHoverOut();
      this.emit(UIEventType.ITEM_HOVER_IN, { id: it.id });
    });
    main.append(line1);

    // group select
    const groupWrap = this.buildGroupSelect(it, existingGroups);

    li.append(checkboxWrap, badge, main, groupWrap);
    return li;
  }

  private buildGroupSelect(it: ScreenItem, existingGroups: string[]): HTMLElement {
    const groupWrap = this.el('div', 'min-w-0');

    const selectEl = this.el(
      'select',
      'block rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-2 py-1',
    ) as HTMLSelectElement;
    selectEl.style.maxWidth = '10rem';

    // options
    selectEl.append(this.makeOpt('', i18n.get('group_ungrouped'), !it.group || !it.group.trim()));
    for (const g of existingGroups) {
      selectEl.append(this.makeOpt(g, g, it.group?.trim() === g));
    }
    const createOpt = this.makeOpt(this.CREATE_VALUE, i18n.get('common_create'));
    selectEl.append(createOpt);

    // Inline input UI for create
    const showCreateInput = (prevValue: string) => {
      selectEl.classList.add('hidden');

      const input = this.el(
        'input',
        'w-40 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-2 py-1',
      ) as HTMLInputElement;
      input.type = 'text';
      input.placeholder = i18n.get('group_new_placeholder');

      const okBtn = this.el(
        'button',
        'rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm',
        i18n.get('common_create'),
      ) as HTMLButtonElement;
      okBtn.type = 'button';

      const cancelBtn = this.el(
        'button',
        'rounded-md border border-transparent px-2 py-1 text-sm text-slate-500',
        i18n.get('common_cancel'),
      ) as HTMLButtonElement;
      cancelBtn.type = 'button';

      const inputWrap = this.el('div', 'flex items-center gap-2');
      inputWrap.append(input, okBtn, cancelBtn);
      groupWrap.append(inputWrap);

      const cleanup = () => {
        inputWrap.remove();
        selectEl.classList.remove('hidden');
      };

      const commit = () => {
        const name = input.value.trim();
        // Undo any missing entries
        if (!name) {
          selectEl.value = prevValue;
          cleanup();
          return;
        }
        this.emit(UIEventType.SET_ITEM_GROUP, { id: it.id, group: name });
        cleanup();
      };

      okBtn.addEventListener('click', commit);
      cancelBtn.addEventListener('click', () => {
        selectEl.value = prevValue;
        cleanup();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          selectEl.value = prevValue;
          cleanup();
        }
      });

      input.focus();
    };

    selectEl.addEventListener('change', () => {
      const prev = (it.group ?? '').trim();
      const val = selectEl.value;
      if (val === this.CREATE_VALUE) {
        showCreateInput(prev);
        return;
      }
      const nextGroup = val.length ? val : '';
      if ((prev || '') !== nextGroup) {
        this.emit(UIEventType.SET_ITEM_GROUP, { id: it.id, group: nextGroup });
      }
    });

    groupWrap.append(selectEl);
    return groupWrap;
  }

  private scheduleHoverOut() {
    if (this.hoverOutTimer) clearTimeout(this.hoverOutTimer);
    if (this.dragStartParent) return;
    this.hoverOutTimer = setTimeout(() => {
      this.hoverOutTimer = null;
      this.emit(UIEventType.ITEM_HOVER_OUT, undefined);
    }, this.HOVER_OUT_DELAY);
  }

  private cancelHoverOut() {
    if (!this.hoverOutTimer) return;
    clearTimeout(this.hoverOutTimer);
    this.hoverOutTimer = null;
  }

  /**
   * UL D&D Handler
   * Only sorting within the same UL is allowed
   * @param ul
   */
  private attachUlDnDHandlers(ul: HTMLUListElement): void {
    ul.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.dragEl) return;

      if (this.dragStartParent && ul !== this.dragStartParent) return;

      const targetLi = (e.target as HTMLElement)?.closest('li') as HTMLLIElement | null;
      if (targetLi && targetLi !== this.dragEl) {
        const rect = targetLi.getBoundingClientRect();
        const isAfter = e.clientY - rect.top > rect.height / 2;
        ul.insertBefore(this.dragEl, isAfter ? targetLi.nextSibling : targetLi);
      } else if (!targetLi) {
        ul.appendChild(this.dragEl);
      }
    });
    ul.addEventListener('drop', (e) => e.preventDefault());
  }

  private getExistingGroups(items: ScreenItem[]): string[] {
    return Array.from(
      new Set(items.map((i) => (i.group ?? '').trim()).filter((g): g is string => g.length > 0)),
    ).sort((a, b) => a.localeCompare(b));
  }

  private groupByGroup(items: ScreenItem[]): Map<string, ScreenItem[]> {
    const m = new Map<string, ScreenItem[]>();
    for (const it of items) {
      const key = (it.group ?? '').trim() || this.NOGROUP;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return m;
  }

  private getSelectedCaptureFormat(): CaptureFormat {
    const val = this.doc.querySelector<HTMLInputElement>(
      'input[name="capture-format"]:checked',
    )?.value;
    return val === 'jpeg' ? 'jpeg' : 'png';
  }
  private getSelectedCaptureArea(): CaptureArea {
    const val = this.doc.querySelector<HTMLInputElement>(
      'input[name="capture-area"]:checked',
    )?.value;
    return val === 'viewport' ? 'viewport' : 'full';
  }
  private updateQualityVisibility(format?: CaptureFormat): void {
    const f = format ?? this.getSelectedCaptureFormat();
    const isJpeg = f === 'jpeg';
    this.els.jpegOnlyEls.forEach((el) => el.classList.toggle('hidden', !isJpeg));
    this.els.jpegQualityRange.disabled = !isJpeg;
    this.els.jpegQualityNumber.disabled = !isJpeg;
  }
  private selectRadioByValue(radios: NodeListOf<HTMLInputElement>, value: string): void {
    radios.forEach((r) => (r.checked = r.value === value));
  }
  private bindSync(
    rangeEl: HTMLInputElement,
    numberEl: HTMLInputElement,
    onValue?: (val: number) => void,
  ): void {
    const readNum = (s: string | null | undefined, fallback: number): number => {
      const v = s != null && s !== '' ? Number(s) : NaN;
      return Number.isFinite(v) ? v : fallback;
    };
    const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

    const sync = (rawStr: string) => {
      const min = readNum(numberEl.min || rangeEl.min, Number.NEGATIVE_INFINITY);
      const max = readNum(numberEl.max || rangeEl.max, Number.POSITIVE_INFINITY);
      const step = readNum(numberEl.step || rangeEl.step, 1);
      const raw = Number(rawStr);
      const clamped = clamp(Number.isFinite(raw) ? raw : 0, min, max);
      const rounded = Math.round(clamped / step) * step;
      const fixed = Number(rounded.toFixed(6));
      numberEl.value = String(fixed);
      rangeEl.value = String(fixed);
      onValue?.(fixed);
    };

    rangeEl.addEventListener('input', () => sync(rangeEl.value));
    numberEl.addEventListener('input', () => sync(numberEl.value));
  }
  private disabledAllButtons(isDisabled: boolean): void {
    this.doc.querySelectorAll('button').forEach((btn) => (btn.disabled = isDisabled));
  }
  private getBadgeColorStyleName(color: ItemColor): string {
    const colorName = color === 'Gray' ? 'slate' : color;
    return `bg-${colorName.toLowerCase()}-500`;
  }
  private applyBadgeColorUI(color: ItemColor): void {
    this.els.badgeColorButtons.forEach((button) => {
      const selected = button.dataset.colorName === color;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    this.els.badgeColorLabel.textContent = color;
    this.els.badgeColorDot.className = 'inline-block w-4 h-4 rounded-full';
    this.els.badgeColorDot.classList.add(this.getBadgeColorStyleName(color));
  }

  private $<T extends Element>(selector: string): T {
    const el = this.doc.querySelector(selector);
    if (!el) throw new Error(`[PanelView] Missing element: ${selector}`);
    return el as T;
  }
  private $all<T extends Element>(selector: string): NodeListOf<T> {
    return this.doc.querySelectorAll<T>(selector);
  }
  private el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = this.doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  private makeOpt(value: string, label: string, selected = false): HTMLOptionElement {
    const o = this.doc.createElement('option');
    o.value = value;
    o.textContent = label;
    if (selected) o.selected = true;
    return o;
  }
}
